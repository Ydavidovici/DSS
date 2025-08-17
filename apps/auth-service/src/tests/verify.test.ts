import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

/**
 * Mock JWT utils with an in-memory signer/verifier.
 * - signUserAccessToken returns a unique token and stores its payload & exp.
 * - verifyToken checks type, existence, and expiry.
 * This isolates the tests from real key material and avoids "No private key..." errors.
 */
vi.mock('../utils/jwt', () => {
    type Typ = 'access' | 'refresh';
    const issued = new Map<string, { payload: any; exp: number; typ: Typ }>();
    let counter = 0;
    const nowSec = () => Math.floor(Date.now() / 1000);

    const signUserAccessToken = vi.fn(async (input: any) => {
        const {
            userId,
            ttlSec = 900,
            roles = [],
            preferred_username,
            email,
            extra,
            scope, // tolerated
        } = input || {};
        const token = `atk_${++counter}`;
        const payload = {
            sub: String(userId),
            roles,
            preferred_username,
            email,
            ...(extra ?? {}),
        };
        issued.set(token, { payload, exp: nowSec() + ttlSec, typ: 'access' });
        return token;
    });

    const signRefreshToken = vi.fn(async (input: any) => {
        const { userId, jti, carry } = input || {};
        const token = `rtk_${++counter}`;
        const payload = { sub: String(userId), jti, ...(carry ?? {}) };
        issued.set(token, { payload, exp: nowSec() + 7 * 24 * 3600, typ: 'refresh' });
        return { token, payload };
    });

    const verifyToken = vi.fn(async (token: string, typ: Typ = 'access') => {
        const rec = issued.get(token);
        if (!rec || rec.typ !== typ) throw new Error('invalid token');
        if (nowSec() >= rec.exp) throw new Error('expired token');
        return { payload: rec.payload };
    });

    const signServiceToken = vi.fn(async () => 'svc-token');
    const getJWKS = vi.fn(async () => ({ keys: [] }));

    return {
        signUserAccessToken,
        signRefreshToken,
        verifyToken,
        signServiceToken,
        getJWKS,
    };
});

/**
 * Mock requireAuth to use the mocked verifyToken above and
 * attach its payload to req.user. This ensures routes see the
 * expected shape (sub, roles, preferred_username, email).
 */
vi.mock('../middleware/requireAuth', () => {
    return {
        requireAuth:
            () =>
                async (req: any, res: any, next: any) => {
                    try {
                        const auth = req.headers?.authorization || '';
                        const m = /^Bearer\s+(.+)/i.exec(auth);
                        if (!m) return res.status(401).json({ message: 'Missing token' });
                        const { verifyToken } = await import('../utils/jwt');
                        const { payload } = await (verifyToken as any)(m[1], 'access');
                        req.user = payload;
                        next();
                    } catch {
                        return res.status(401).json({ message: 'Invalid or expired token.' });
                    }
                },
    };
});

// --- Redis + mailer + blacklist mocks (minimal & stable) ---
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
            listUserSessions: async () => [], clearUserSessions: async () => [],
            getAllowedRedirects: async () => ['https://app1.localhost:3000'],
            isAllowedRedirect: async () => true,
        },
    };
});
vi.mock('../utils/mailer', () => ({ mailer: { sendMail: vi.fn().mockResolvedValue({}) } }));
vi.mock('../utils/tokenBlacklist', () => ({
    revokeToken: vi.fn().mockResolvedValue(undefined),
    isRevoked: vi.fn().mockResolvedValue(false),
}));

describe('Verify & UserInfo', () => {
    let app: express.Express;
    let signUserAccessToken: (input: any) => Promise<string>;

    beforeAll(async () => {
        // Ensure required env before importing router
        process.env.DB_SERVICE_API_URL ||= 'http://db-service:4000/api/v1';
        process.env.DB_SERVICE_BASE_URL ||= 'http://db-service:4000';
        process.env.JWT_ISSUER ||= 'https://issuer.test';

        const router = (await import('../routes/auth')).default;
        ({ signUserAccessToken } = await import('../utils/jwt'));

        app = express();
        app.use(express.json());
        app.use(cookieParser());
        app.use('/', router);
    });

    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('GET /verify with valid access token returns user payload', async () => {
        const token = await signUserAccessToken({
            userId: 'u1',
            roles: ['user'],
            preferred_username: 'alice',
            email: 'a@ex.com',
        });
        const res = await request(app)
            .get('/verify')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(res.body.user.sub).toBe('u1');
        expect(res.body.user.roles).toContain('user');
        expect(res.body.user.preferred_username).toBe('alice');
        expect(res.body.user.email).toBe('a@ex.com');
    });

    it('GET /userinfo returns subset claims', async () => {
        const token = await signUserAccessToken({
            userId: 'u1',
            roles: ['user'],
            preferred_username: 'alice',
            email: 'a@ex.com',
        });
        const res = await request(app)
            .get('/userinfo')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(res.body).toMatchObject({
            sub: 'u1',
            preferred_username: 'alice',
            email: 'a@ex.com',
        });
        expect(res.body.roles).toContain('user');
    });

    it('rejects expired token', async () => {
        const token = await signUserAccessToken({ userId: 'u1', ttlSec: 1 });
        vi.setSystemTime(new Date(Date.now() + 2000)); // after expiry
        await request(app)
            .get('/verify')
            .set('Authorization', `Bearer ${token}`)
            .expect(401);
    });
});
