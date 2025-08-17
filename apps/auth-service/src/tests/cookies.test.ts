import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// --- axios mock (DB-service calls) ---
const axiosMock = { get: vi.fn(), post: vi.fn(), patch: vi.fn() };
vi.mock('axios', () => ({ default: axiosMock }));

// --- jwt utils mock (stable tokens; we only assert cookie flags here) ---
vi.mock('../utils/jwt', () => ({
    signServiceToken: vi.fn().mockResolvedValue('svc-token'),
    signUserAccessToken: vi.fn().mockResolvedValue('access-token'),
    signRefreshToken: vi.fn().mockResolvedValue({ token: 'refresh-token' }),
    verifyToken: vi.fn(), // not used here
    getJWKS: vi.fn(),     // not used here
}));

// --- rate limit middleware: make them no-ops for this test ---
vi.mock('../middleware/rateLimit', () => ({
    loginIpLimiter: (_req: any, _res: any, next: any) => next(),
    loginAccountLimiter: (_req: any, _res: any, next: any) => next(),
    resetLimiter: (_req: any, _res: any, next: any) => next(),
    refreshLimiter: (_req: any, _res: any, next: any) => next(),
}));

// --- lightweight Redis + kv mocks ---
vi.mock('../utils/redis', () => {
    const store = new Map<string, string>();
    return {
        redis: {
            get: async (k: string) => store.get(k) ?? null,
            set: async (k: string, v: string) => { store.set(k, v); return 'OK'; },
            del: async (k: string) => { store.delete(k); return 1; },
            ttl: async () => 60,
            sendCommand: async () => 'OK',
        },
        kv: {
            getJWKS: async () => null, setJWKS: async () => {}, clearJWKS: async () => {},
            addUserSession: async () => {}, removeUserSession: async () => {},
            listUserSessions: async () => [], clearUserSessions: async () => {},
            getAllowedRedirects: async () => ['https://app1.localhost:3000'],
            isAllowedRedirect: async () => true,
        },
    };
});

// --- mailer mock (unused; keeps import happy) ---
vi.mock('../utils/mailer', () => ({ mailer: { sendMail: vi.fn().mockResolvedValue({}) } }));

describe('Refresh cookie flags', () => {
    let app: express.Express;

    beforeAll(async () => {
        // Ensure env needed by routes is set before import
        process.env.DB_SERVICE_API_URL ||= 'http://db-service:4000/api/v1';
        process.env.DB_SERVICE_BASE_URL ||= 'http://db-service:4000';
        process.env.JWT_ISSUER ||= 'https://issuer.test';
        delete process.env.NODE_ENV; // ensure SameSite=Lax, Secure not forced

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

        // Mock db-service password verification endpoint
        axiosMock.post.mockImplementation((url: string, body?: any) => {
            if (url.includes('/internal/auth/verify-password')) {
                expect(body).toMatchObject({ usernameOrEmail: 'alice', password: 's3cret' });
                return Promise.resolve({
                    status: 200,
                    data: { ok: true, user: { id: 'u1', username: 'alice', email: 'a@ex.com', roles: [], verified: true } },
                });
            }
            return Promise.reject(new Error(`unknown POST ${url}`));
        });
    });

    it('login sets HttpOnly refresh cookie with SameSite and Path', async () => {
        const res = await request(app)
            .post('/login')
            .send({ username: 'alice', password: 's3cret' })
            .expect(200);

        const set = res.headers['set-cookie'];
        expect(Array.isArray(set)).toBe(true);
        const cookie = set.find((c: string) => c.startsWith('refresh_token='))!;
        expect(cookie).toBeTruthy();
        expect(cookie).toMatch(/HttpOnly/i);
        expect(cookie).toMatch(/Path=\//i);
        expect(cookie).toMatch(/SameSite=Lax/i);
        // In non-prod and SameSite !== 'none', Secure should not be set
        expect(cookie).not.toMatch(/Secure/i);
    });
});
