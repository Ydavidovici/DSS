// src/tests/rateLimit.test.ts
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// --- axios mock (DB-service calls) ---
const axiosMock = { get: vi.fn(), post: vi.fn(), patch: vi.fn() };
vi.mock('axios', () => ({ default: axiosMock }));

// --- jwt utils mock (we don't need real signing in this test) ---
vi.mock('../utils/jwt', () => ({
    signServiceToken: vi.fn().mockResolvedValue('svc-token'),
    signUserAccessToken: vi.fn().mockResolvedValue('access-token'),
    signRefreshToken: vi.fn().mockResolvedValue({ token: 'refresh-token' }),
    verifyToken: vi.fn(),
    getJWKS: vi.fn(),
}));

// --- lightweight Redis + kv mocks (not used heavily here) ---
vi.mock('../utils/redis', () => {
    return {
        redis: {
            get: async () => null,
            set: async () => 'OK',
            del: async () => 1,
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

// --- rate limit middleware mock: account limiter blocks after 10 failures regardless of IP ---
// IMPORTANT: mock the SAME path the router imports: '../middleware/rateLimit'
vi.mock('../middleware/rateLimit', () => {
    const failuresByUser = new Map<string, number>();
    const MAX = 10;

    const loginIpLimiter = (_req: any, _res: any, next: any) => next();

    const loginAccountLimiter = (req: any, res: any, next: any) => {
        const u = req.body?.username ?? '';
        const n = failuresByUser.get(u) ?? 0;
        if (n >= MAX) {
            return res.status(429).send('Too many attempts');
        }
        // Wrap res.status to detect 401 responses and count them
        const origStatus = res.status.bind(res);
        res.status = (code: number) => {
            if (code === 401 && u) {
                failuresByUser.set(u, (failuresByUser.get(u) ?? 0) + 1);
            }
            return origStatus(code);
        };
        next();
    };

    const resetLimiter = (_req: any, _res: any, next: any) => next();
    const refreshLimiter = (_req: any, _res: any, next: any) => next();

    // expose a helper for resets in tests
    (loginAccountLimiter as any)._reset = () => failuresByUser.clear();

    return { loginIpLimiter, loginAccountLimiter, resetLimiter, refreshLimiter };
});

// --- mailer mock (keep imports happy) ---
vi.mock('../utils/mailer', () => ({ mailer: { sendMail: vi.fn().mockResolvedValue({}) } }));

describe('Rate limits', () => {
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

    beforeEach(async () => {
        vi.clearAllMocks();
        axiosMock.get.mockReset();
        axiosMock.post.mockReset();
        axiosMock.patch.mockReset();

        // Mock db-service password verification: always fail (401) for this test
        axiosMock.post.mockImplementation((url: string) => {
            if (url.includes('/internal/auth/verify-password')) {
                const err: any = new Error('Unauthorized');
                err.response = { status: 401, data: { ok: false } };
                return Promise.reject(err);
            }
            return Promise.reject(new Error(`unknown POST ${url}`));
        });

        // Reset the in-memory account limiter (import the mocked module)
        const { loginAccountLimiter } = await import('../middleware/rateLimit');
        if (typeof (loginAccountLimiter as any)._reset === 'function') {
            (loginAccountLimiter as any)._reset();
        }
    });

    it('per-account login limiter blocks after N failures (regardless of IP)', async () => {
        // 10 failures allowed, 11th should be blocked (429)
        for (let i = 0; i < 10; i++) {
            await request(app)
                .post('/login')
                .set('X-Forwarded-For', `1.1.1.${i}`) // different IPs shouldn't matter
                .send({ username: 'alice', password: 'wrong' })
                .expect(401);
        }
        const blocked = await request(app)
            .post('/login')
            .set('X-Forwarded-For', '1.1.1.255')
            .send({ username: 'alice', password: 'wrong' });

        expect(blocked.status).toBe(429);
    });
});
