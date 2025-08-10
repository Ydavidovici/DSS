import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';

// Inline mocks: utils/redis + mailer
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
vi.mock('../utils/mailer', () => ({ mailer: { sendMail: vi.fn().mockResolvedValue({}) } }));

describe('JWKS endpoint', () => {
  let app: express.Express;

  beforeAll(async () => {
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