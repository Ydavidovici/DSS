import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';

// Inline mocks: utils/redis + mailer (no need to hit real Redis/Mailer)
vi.mock('../utils/redis', () => {
  const store = new Map<string, string>();
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
      // other kv methods not used here
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

describe('JWKS endpoint', () => {
  let app: express.Express;

  beforeAll(async () => {
    process.env.DB_SERVICE_API_URL ||= 'http://db-service:4000/api/v1';
    process.env.DB_SERVICE_BASE_URL ||= 'http://db-service:4000';
    process.env.JWT_ISSUER ||= 'https://issuer.test';

    const router = (await import('../routes/auth')).default;
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/', router);
  });

  it('returns only public JWKs and correct fields', async () => {
    const res = await request(app).get('/.well-known/jwks.json').expect(200);
    expect(Array.isArray(res.body.keys)).toBe(true);
    for (const k of res.body.keys) {
      expect(k).toHaveProperty('kid');
      expect(k).toHaveProperty('kty');
      expect(k).toHaveProperty('alg', 'RS256');
      expect(k).toHaveProperty('use', 'sig');
      expect(k).not.toHaveProperty('d');
      expect(k).not.toHaveProperty('p');
      expect(k).not.toHaveProperty('q');
      expect(k).not.toHaveProperty('dp');
      expect(k).not.toHaveProperty('dq');
      expect(k).not.toHaveProperty('qi');
    }
  });
});