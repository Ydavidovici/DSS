import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { describe, it, expect, beforeAll, vi } from 'vitest';

const axiosMock = { get: vi.fn() };
vi.mock('axios', () => ({ default: axiosMock }));

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
vi.mock('../utils/mailer', () => ({ mailer: { sendMail: vi.fn().mockResolvedValue({}) } }));

describe('Rate limits', () => {
  let app: express.Express;

  beforeAll(async () => {
    const router = (await import('../routes/auth')).default;
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/', router);
  });

  it('per-account login limiter blocks after N failures (regardless of IP)', async () => {
    const hash = await bcrypt.hash('right', 10);
    axiosMock.get.mockResolvedValue({
      status: 200,
      data: { id: 'u1', username: 'alice', verified: true, password_hash: hash, roles: [] },
    });

    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/login')
        .set('X-Forwarded-For', `1.1.1.${i}`)
        .send({ username: 'alice', password: 'wrong' });
    }
    const blocked = await request(app)
      .post('/login')
      .set('X-Forwarded-For', '1.1.1.255')
      .send({ username: 'alice', password: 'wrong' });
    expect(blocked.status).toBe(429);
  });
});