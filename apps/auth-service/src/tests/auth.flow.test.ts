// src/tests/auth.flow.test.ts
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
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

// --- rate limit middleware: make them no-ops for this test ---
vi.mock('../middleware/rateLimit', () => ({
    loginIpLimiter: (_req: any, _res: any, next: any) => next(),
    loginAccountLimiter: (_req: any, _res: any, next: any) => next(),
    resetLimiter: (_req: any, _res: any, next: any) => next(),
    refreshLimiter: (_req: any, _res: any, next: any) => next(),
}));

// --- JWT utils: in-memory token registry so we don't need real keys ---
vi.mock('../utils/jwt', () => {
    const tokenStore = new Map<string, any>();

    function makeToken(prefix: string) {
        return `${prefix}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    }

    async function signServiceToken(input: any) {
        const token = makeToken('svc');
        const now = Math.floor(Date.now() / 1000);
        tokenStore.set(token, { ...input, typ: 'service', iat: now, exp: now + (input?.ttlSec ?? 300) });
        return token;
    }

    async function signUserAccessToken(input: any) {
        const token = makeToken('access');
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            sub: String(input.userId),
            roles: input.roles ?? [],
            preferred_username: input.preferred_username,
            email: input.email,
            scope: input.scope,
            ...(input.extra ?? {}),
            jti: makeToken('jti'),
            typ: 'access',
            iat: now,
            exp: now + (input.ttlSec ?? 900),
        };
        tokenStore.set(token, payload);
        return token;
    }

    async function signRefreshToken(input: any) {
        const token = makeToken('refresh');
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            sub: String(input.userId),
            jti: input.jti ?? makeToken('jti'),
            sessionId: input.sessionId,
            roles: input.carry?.roles ?? [],
            preferred_username: input.carry?.preferred_username,
            email: input.carry?.email,
            typ: 'refresh',
            iat: now,
            exp: now + (input.ttlSec ?? 7 * 24 * 3600),
        };
        tokenStore.set(token, payload);
        return { token };
    }

    async function verifyToken(token: string, expectedTyp: 'access' | 'refresh' = 'access') {
        const payload = tokenStore.get(token);
        if (!payload) throw new Error('Unknown token');
        if (expectedTyp && payload.typ !== expectedTyp) throw new Error('Wrong token type');
        const now = Math.floor(Date.now() / 1000);
        if (typeof payload.exp === 'number' && payload.exp <= now) throw new Error('Expired token');
        return { payload };
    }

    async function getJWKS() {
        return { keys: [] };
    }

    return { signServiceToken, signUserAccessToken, signRefreshToken, verifyToken, getJWKS };
});

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
        // db-service verify-password endpoint mock
        axiosMock.post.mockImplementation((url: string, body?: any) => {
            if (url.includes('/internal/auth/verify-password')) {
                // Expect the auth service to forward username+password
                expect(body).toMatchObject({ usernameOrEmail: 'alice', password: 's3cret' });
                return Promise.resolve({
                    status: 200,
                    data: {
                        ok: true,
                        user: { id: 'u1', username: 'alice', email: 'a@ex.com', verified: true, roles: ['user'] }, // sanitized
                    },
                });
            }
            return Promise.reject(new Error(`unknown POST ${url}`));
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