import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { describe, it, expect, beforeAll, vi } from 'vitest';

const axiosMock = { get: vi.fn() };
vi.mock('axios', () => ({ default: axiosMock }));

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
      listUserSessions: async () => [], clearUserSessions: async () => [],
      getAllowedRedirects: async () => ['https://app1.localhost:3000'],
      isAllowedRedirect: async () => true,
    },
  };
});
vi.mock('../utils/mailer', () => ({ mailer: { sendMail: vi.fn().mockResolvedValue({}) } }));

describe('Refresh cookie flags', () => {
  let app: express.Express;

  beforeAll(async () => {
    const router = (await import('../routes/auth')).default;
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/', router);
  });

  it('login sets HttpOnly refresh cookie with SameSite and Path', async () => {
    const hash = await bcrypt.hash('s3cret', 10);
    axiosMock.get.mockResolvedValue({
      status: 200,
      data: { id: 'u1', username: 'alice', verified: true, password_hash: hash, roles: [] },
    });

    const res = await request(app)
      .post('/login')
      .send({ username: 'alice', password: 's3cret' })
      .expect(200);

    const set = res.headers['set-cookie'];
    expect(Array.isArray(set)).toBe(true);
    const cookie = set.find((c: string) => c.startsWith('refresh_token='))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\//i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });
});