import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';

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

describe('Verify & UserInfo', () => {
  let app: express.Express;
  let signAccessToken: (payload: any, ttl?: number) => Promise<string>;

  beforeAll(async () => {
    const router = (await import('../routes/auth')).default;
    ({ signAccessToken } = await import('../utils/jwt'));

    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/', router);
  });

  it('GET /verify with valid access token returns user payload', async () => {
    const token = await signAccessToken({
      sub: 'u1',
      roles: ['user'],
      preferred_username: 'alice',
      email: 'a@ex.com',
    });
    const res = await request(app).get('/verify').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.user.sub).toBe('u1');
    expect(res.body.user.roles).toContain('user');
  });

  it('GET /userinfo returns subset claims', async () => {
    const token = await signAccessToken({
      sub: 'u1',
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
    const token = await signAccessToken({ sub: 'u1' }, 1); // 1s TTL
    vi.advanceTimersByTime(2000);
    await request(app).get('/verify').set('Authorization', `Bearer ${token}`).expect(401);
  });
});