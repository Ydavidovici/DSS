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

// --- rate limit middleware: make them no-ops for this test ---
vi.mock('../middleware/rateLimit', () => ({
    loginIpLimiter: (_req: any, _res: any, next: any) => next(),
    loginAccountLimiter: (_req: any, _res: any, next: any) => next(),
    resetLimiter: (_req: any, _res: any, next: any) => next(),
    refreshLimiter: (_req: any, _res: any, next: any) => next(),
}));

// --- JWT utils: in-memory token registry (realistic enough for flows) ---
vi.mock('../utils/jwt', () => {
    const tokenStore = new Map<string, any>();
    const makeToken = (p: string) => `${p}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

    const signServiceToken = vi.fn(async (_input: any) => 'svc-token');

    const signUserAccessToken = vi.fn(async (input: any) => {
        const token = makeToken('access');
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            sub: String(input.userId),
            roles: input.roles ?? [],
            preferred_username: input.preferred_username,
            email: input.email,
            scope: input.scope,
            ...(input.extra ?? {}),
            typ: 'access',
            iat: now,
            exp: now + (input.ttlSec ?? 900),
        };
        tokenStore.set(token, payload);
        return token;
    });

    const signRefreshToken = vi.fn(async (input: any) => {
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
    });

    const verifyToken = vi.fn(async (token: string, expectedTyp: 'access' | 'refresh' = 'access') => {
        const payload = tokenStore.get(token);
        if (!payload) throw new Error('Unknown token');
        if (expectedTyp && payload.typ !== expectedTyp) throw new Error('Wrong token type');
        const now = Math.floor(Date.now() / 1000);
        if (typeof payload.exp === 'number' && payload.exp <= now) throw new Error('Expired token');
        return { payload };
    });

    const getJWKS = vi.fn(async () => ({ keys: [] }));

    return { signServiceToken, signUserAccessToken, signRefreshToken, verifyToken, getJWKS };
});

// --- mailer + blacklist mocks ---
vi.mock('../utils/mailer', () => ({ mailer: { sendMail: vi.fn().mockResolvedValue({}) } }));
vi.mock('../utils/tokenBlacklist', () => ({
    revokeToken: vi.fn().mockResolvedValue(undefined),
    isRevoked: vi.fn().mockResolvedValue(false),
}));

describe('Auth flows (end-to-end-ish, with mocked db-service + jwt)', () => {
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

    it('register → creates user via db-service and sends verification email with issuer link', async () => {
        const { mailer } = await import('../utils/mailer');
        const { signServiceToken } = await import('../utils/jwt');

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

        // DB create called with hashed password and svc token
        expect(axiosMock.post).toHaveBeenCalledWith(
            expect.stringContaining('/users'),
            expect.objectContaining({ username: 'alice', email: 'a@ex.com', password_hash: expect.any(String) }),
            expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer svc-token' }) }),
        );

        // Service token scope was requested at least once (we don't assert order across routes here)
        expect((signServiceToken as any).mock.calls.some(([arg]: any[]) => arg?.scope === 'users:create')).toBe(true);

        // Email contains issuer link with token
        expect(mailer.sendMail).toHaveBeenCalledTimes(1);
        const sent = (mailer.sendMail as any).mock.calls[0][0];
        expect(sent.to).toBe('a@ex.com');
        expect(sent.text).toMatch(/https:\/\/issuer\.test\/verify-email\?token=/);
    });

    it('login (username) → forwards to db-service verify-password with svc token and rotates refresh', async () => {
        const { signServiceToken } = await import('../utils/jwt');

        // db-service verify-password endpoint mock
        axiosMock.post.mockImplementation((url: string, body?: any, cfg?: any) => {
            if (url.endsWith('/internal/auth/verify-password')) {
                expect(body).toEqual({ usernameOrEmail: 'alice', password: 's3cret' });
                expect(cfg?.headers?.Authorization).toBe('Bearer svc-token');
                return Promise.resolve({
                    status: 200,
                    data: { ok: true, user: { id: 'u1', username: 'alice', email: 'a@ex.com', verified: true, roles: ['user'] } },
                });
            }
            return Promise.reject(new Error(`unknown POST ${url}`));
        });

        const login = await request(app).post('/login').send({ username: 'alice', password: 's3cret' }).expect(200);
        expect(login.body).toHaveProperty('accessToken');
        const cookie = login.headers['set-cookie'].find((c: string) => c.startsWith('refresh_token='));
        expect(cookie).toBeTruthy();

        // signServiceToken requested correct scope
        expect((signServiceToken as any).mock.calls.some(([arg]: any[]) => arg?.scope === 'user.verify:password')).toBe(true);

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

    it('login (email) → still posts usernameOrEmail and succeeds', async () => {
        axiosMock.post.mockImplementation((url: string, body?: any) => {
            if (url.endsWith('/internal/auth/verify-password')) {
                expect(body).toEqual({ usernameOrEmail: 'a@ex.com', password: 'pw' });
                return Promise.resolve({
                    status: 200,
                    data: { ok: true, user: { id: 'u42', username: 'alice', email: 'a@ex.com', verified: true, roles: [] } },
                });
            }
            return Promise.reject(new Error(`unknown POST ${url}`));
        });

        await request(app).post('/login').send({ username: 'a@ex.com', password: 'pw' }).expect(200);
        expect(axiosMock.post).toHaveBeenCalledWith(
            expect.stringMatching(/\/internal\/auth\/verify-password$/),
            { usernameOrEmail: 'a@ex.com', password: 'pw' },
            expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer svc-token' }) }),
        );
    });

    it('login → returns 403 when db-service returns unverified user', async () => {
        axiosMock.post.mockResolvedValueOnce({
            status: 200,
            data: { ok: true, user: { id: 'u1', username: 'alice', email: 'a@ex.com', roles: [], verified: false } },
        });

        await request(app).post('/login').send({ username: 'alice', password: 'pw' }).expect(403);
    });

    it('login → maps db-service 401/unknown to 401 (no enumeration)', async () => {
        const err: any = new Error('Unauthorized');
        err.response = { status: 401, data: { ok: false } };
        axiosMock.post.mockRejectedValueOnce(err);

        await request(app).post('/login').send({ username: 'alice', password: 'wrong' }).expect(401);
    });

    it('verify-email happy path updates user and redirects', async () => {
        const { signUserAccessToken, signServiceToken } = await import('../utils/jwt');
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
            expect.any(Object),
        );
        expect(res.headers.location).toMatch(/status=verified/);
        expect((signServiceToken as any).mock.calls.some(([arg]: any[]) => arg?.scope === 'users:update')).toBe(true);
    });

    it('reset-password happy path patches DB and revokes sessions', async () => {
        const { signUserAccessToken, signServiceToken } = await import('../utils/jwt');
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
            expect.any(Object),
        );
        expect((signServiceToken as any).mock.calls.some(([arg]: any[]) => arg?.scope === 'users:update')).toBe(true);
    });

    it('forgot-password → looks up user via internal email endpoint and sends reset link (allowed redirect)', async () => {
        const { mailer } = await import('../utils/mailer');
        const { signServiceToken } = await import('../utils/jwt');

        axiosMock.get.mockResolvedValueOnce({
            status: 200,
            data: { id: 'u9', email: 'a@ex.com' },
        });

        const res = await request(app)
            .post('/forgot-password')
            .send({ email: 'a@ex.com', redirect_uri: 'https://app1.localhost:3000/reset' })
            .expect(200);

        expect(res.text).toMatch(/If that email exists/i);

        // internal endpoint with svc token
        expect(axiosMock.get).toHaveBeenCalledWith(
            expect.stringMatching(/\/internal\/auth\/users\/email\/a%40ex\.com$/),
            expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer svc-token' }) }),
        );
        expect((signServiceToken as any).mock.calls.some(([arg]: any[]) => arg?.scope === 'users:read')).toBe(true);

        // mail sent with link containing token
        expect(mailer.sendMail).toHaveBeenCalledTimes(1);
        const msg = (mailer.sendMail as any).mock.calls[0][0];
        expect(msg.to).toBe('a@ex.com');
        expect(msg.text).toMatch(/Reset your password:/);
        expect(msg.text).toMatch(/token=/);
    });

    it('forgot-password → enumeration-safe on unknown email (still 200, no mail)', async () => {
        const { mailer } = await import('../utils/mailer');

        // Simulate db-service 404/unknown
        axiosMock.get.mockRejectedValueOnce(Object.assign(new Error('Not Found'), { response: { status: 404 } }));

        const res = await request(app)
            .post('/forgot-password')
            .send({ email: 'nobody@ex.com', redirect_uri: 'https://app1.localhost:3000/reset' })
            .expect(200);

        expect(res.text).toMatch(/If that email exists/i);
        expect(mailer.sendMail).not.toHaveBeenCalled();
    });
});
