import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

// --- Redis + mailer mocks (minimal) ---
vi.mock('../utils/redis', () => {
  return {
    redis: {
      get: async () => null, set: async () => 'OK', del: async () => 1, ttl: async () => 60, sendCommand: async () => 'OK',
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
    const res = await request(app).get('/verify').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.user.sub).toBe('u1');
    expect(res.body.user.roles).toContain('user');
  });

  it('GET /userinfo returns subset claims', async () => {
    const token = await signUserAccessToken({
      userId: 'u1',
      roles: ['user'],
      preferred_username: 'alice',
      email: 'a@ex.com',
    });
    const res = await request(app).get('/userinfo').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body).toMatchObject({
      sub: 'u1',
      preferred_username: 'alice',
      email: 'a@ex.com',
    });
  });

  it('rejects expired token', async () => {
    const token = await signUserAccessToken({ userId: 'u1', ttlSec: 1 });
    vi.setSystemTime(new Date(Date.now() + 2000)); // after expiry
    await request(app).get('/verify').set('Authorization', `Bearer ${token}`).expect(401);
  });
});