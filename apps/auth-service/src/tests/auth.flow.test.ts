import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// --- axios mock (DB-service calls) ---
const axiosMock = { get: vi.fn(), post: vi.fn(), patch: vi.fn() };
vi.mock('axios', () => ({ default: axiosMock }));

// --- lightweight Redis + kv mocks ---
vi.mock('../utils/redis', () => {
    const store = new Map<string, string>();
    const sessions = new Map<string, Set<string>>();
    const redirects = new Set<string>(['https://app1.localhost:3000']);
    return {
        redis: {
            get: async (k: string) => store.get(k) ?? null,
            set: async (k: string, v: string) => { store.set(k, v); return 'OK'; },
            del: async (k: string) => { store.delete(k); return 1; },
            ttl: async () => 3600,
            sendCommand: async () => 'OK',
        },
        kv: {
            getJWKS: async () => (store.has('jwks') ? JSON.parse(store.get('jwks')!) : null),
            setJWKS: async (jwks: any) => { store.set('jwks', JSON.stringify(jwks)); },
            clearJWKS: async () => { store.delete('jwks'); },
            addUserSession: async (uid: string, jti: string) => {
                const set = sessions.get(uid) ?? new Set<string>(); set.add(jti); sessions.set(uid, set);
            },
            removeUserSession: async (uid: string, jti: string) => { sessions.get(uid)?.delete(jti); },
            listUserSessions: async (uid: string) => Array.from(sessions.get(uid) ?? []),
            clearUserSessions: async (uid: string) => { sessions.delete(uid); },
            getAllowedRedirects: async () => Array.from(redirects),
            isAllowedRedirect: async (url: string) => {
                try { const u = new URL(url); return redirects.has(`${u.protocol}//${u.host}`); } catch { return false; }
            },
        },
    };
});

// --- mailer + blacklist mocks ---
vi.mock('../utils/mailer', () => ({ mailer: { sendMail: vi.fn().mockResolvedValue({}) } }));
vi.mock('../utils/tokenBlacklist', () => ({
    revokeToken: vi.fn().mockResolvedValue(undefined),
    isRevoked: vi.fn().mockResolvedValue(false),
}));

describe('Auth flows', () => {
    let app: express.Express;

    beforeAll(async () => {
        // Ensure env needed by routes is set before import
        process.env.DB_SERVICE_API_URL ||= 'http://db-service:4000/api/v1';
        process.env.DB_SERVICE_BASE_URL ||= 'http://db-service:4000';
        process.env.JWT_ISSUER ||= 'https://issuer.test';

        const router = (await import('../routes/auth')).default;

        app = express();
        app.use(express.json());
        app.use(cookieParser());
        app.use('/', router);
    });

    beforeEach(() => {
        vi.clearAllMocks();
        axiosMock.get.mockReset();
        axiosMock.post.mockReset();
        axiosMock.patch.mockReset();
    });

    it('register → sends verification email (link)', async () => {
        axiosMock.post.mockResolvedValueOnce({ status: 201, data: { id: 'u1' } }); // DB create returns id

        const res = await request(app)
          .post('/register')
          .send({
              username: 'alice',
              password: 's3cret',
              email: 'a@ex.com',
              redirect_uri: 'https://app1.localhost:3000/auth/verified',
          })
          .expect(201);

        expect(res.text).toMatch(/User created/i);
        // DB create called with hashed password
        expect(axiosMock.post).toHaveBeenCalledWith(
          expect.stringContaining('/users'),
          expect.objectContaining({ username: 'alice', email: 'a@ex.com', password_hash: expect.any(String) }),
          expect.objectContaining({ headers: expect.any(Object) })
        );
    });

    it('login → refresh rotation → logout', async () => {
        const hash = await bcrypt.hash('s3cret', 10);
        axiosMock.get.mockImplementation((url: string) => {
            if (url.includes('/internal/auth/users/alice')) {
                return Promise.resolve({
                    status: 200,
                    data: { id: 'u1', username: 'alice', email: 'a@ex.com', verified: true, password_hash: hash, roles: ['user'] },
                });
            }
            return Promise.reject(new Error('unknown path'));
        });

        // Login
        const login = await request(app).post('/login').send({ username: 'alice', password: 's3cret' }).expect(200);
        expect(login.body).toHaveProperty('accessToken');
        const cookie = login.headers['set-cookie'].find((c: string) => c.startsWith('refresh_token='));
        expect(cookie).toBeTruthy();

        // Refresh (rotation)
        const r1 = await request(app).post('/refresh').set('Cookie', cookie).expect(200);
        expect(r1.body).toHaveProperty('accessToken');
        const newCookie = r1.headers['set-cookie'].find((c: string) => c.startsWith('refresh_token='));
        expect(newCookie).toBeTruthy();

        // Reuse old refresh should fail
        await request(app).post('/refresh').set('Cookie', cookie).expect(401);

        // Logout kills new refresh
        await request(app).post('/logout').set('Cookie', newCookie).expect(200);
        await request(app).post('/refresh').set('Cookie', newCookie).expect(401);
    });

    it('verify-email happy path updates user and redirects', async () => {
        const { signUserAccessToken } = await import('../utils/jwt');
        axiosMock.patch.mockResolvedValueOnce({ status: 200 });

        const token = await signUserAccessToken({
            userId: 'u1',
            scope: 'email_verify',
            ttlSec: 3600,
            extra: { redir: 'https://app1.localhost:3000/auth/verified' },
        });

        const res = await request(app).get('/verify-email').query({ token }).expect(302);
        expect(axiosMock.patch).toHaveBeenCalledWith(
          expect.stringContaining('/users/u1'),
          expect.objectContaining({ verified: true }),
          expect.any(Object)
        );
        expect(res.headers.location).toMatch(/status=verified/);
    });

    it('reset-password happy path patches DB and revokes sessions', async () => {
        const { signUserAccessToken } = await import('../utils/jwt');
        axiosMock.patch.mockResolvedValueOnce({ status: 200 });

        const token = await signUserAccessToken({
            userId: 'u1',
            scope: 'password_reset',
            ttlSec: 3600,
        });

        await request(app).post('/reset-password').send({ token, newPassword: 'N3wPass!@#' }).expect(200);
        expect(axiosMock.patch).toHaveBeenCalledWith(
          expect.stringContaining('/users/u1'),
          expect.objectContaining({ password_hash: expect.any(String) }),
          expect.any(Object)
        );
    });
});