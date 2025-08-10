import Fastify from 'fastify';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { SignJWT, importPKCS8 } from 'jose';

// --- Mock the users service layer so we don't need a real DB ---
vi.mock('../modules/users/user.service', () => {
  const row = {
    id: 'u1',
    username: 'alice',
    email: 'a@ex.com',
    verified: true,
    roles: ['user'],
    password_hash: '$2b$10$abcdef...' // fake bcrypt hash
  };

  return {
    createUser: vi.fn(async (b) => ({
      ...row,
      id: 'u2',
      username: b.username ?? row.username,
      email: b.email ?? row.email,
      verified: !!b.verified,
      roles: b.roles ?? [],
      // controller should strip this; keep it undefined here
      password_hash: undefined
    })),

    getByUsername: vi.fn(async (u: string) =>
      u === 'alice' ? { ...row, password_hash: undefined } : null
    ),

    getByEmail: vi.fn(async (e: string) =>
      e === 'a@ex.com' ? { ...row, password_hash: undefined } : null
    ),

    updateUser: vi.fn(async (_id: string, _body: any) => ({
      ...row,
      password_hash: undefined
    })),

    softDeleteUser: vi.fn(async (_id: string) => true),

    getRawByUsername: vi.fn(async (u: string) =>
      u === 'alice' ? { ...row } : null
    ),
  };
});

// Register Fastify plugins & routes *after* mocks
import internalGuard from '../plugins/jwt';
import userRoutes from '../modules/users/user.routes';

describe('[db-service] users auth & internal comms', () => {
  const ISS = 'https://issuer.test';
  const AUD = 'db-service';
  const AZP = 'auth-service';

  let app: ReturnType<typeof Fastify>;
  let baseUrl: string;
  let privatePem: string;
  let publicPem: string;

  beforeAll(async () => {
    // Generate a one-off RSA pair; db-service will verify with the public part
    const keys = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding:  { type: 'spki',  format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    privatePem = keys.privateKey;
    publicPem  = keys.publicKey;

    // Configure jwt plugin to accept PEM and enforce iss/aud
    process.env.AUTH_MODE = 'PEM';
    process.env.AUTH_PUBLIC_KEY_PEM = publicPem;
    process.env.AUTH_ISSUER = ISS;
    process.env.AUTH_AUDIENCE = AUD;
    process.env.AUTH_SERVICE_AZP = AZP;

    app = Fastify({ logger: false });
    await app.register(internalGuard);
    await app.register(userRoutes);

    baseUrl = await app.listen({ port: 0 });
  });

  afterAll(async () => {
    await app.close();
  });

  async function signServiceToken(scope: string, azp: string = AZP, ttlSec = 60) {
    const key = await importPKCS8(privatePem, 'RS256');
    return new SignJWT({ typ: 'access', scope, azp })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(ISS)
      .setAudience(AUD)
      .setSubject('client_auth')
      .setIssuedAt()
      .setExpirationTime(`${ttlSec}s`)
      .sign(key);
  }

  it('public GET /api/v1/users/:username returns sanitized user (no password_hash)', async () => {
    const res = await request(baseUrl)
      .get('/api/v1/users/alice')
      .expect(200);

    expect(res.body.username).toBe('alice');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('public GET /api/v1/users/email/:email returns sanitized user', async () => {
    const res = await request(baseUrl)
      .get('/api/v1/users/email/a@ex.com')
      .expect(200);

    expect(res.body.email).toBe('a@ex.com');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('internal GET /internal/auth/users/:username requires bearer token', async () => {
    await request(baseUrl)
      .get('/internal/auth/users/alice')
      .expect(401);
  });

  it('internal GET rejects when scope is wrong', async () => {
    const badScope = await signServiceToken('users:create');
    await request(baseUrl)
      .get('/internal/auth/users/alice')
      .set('Authorization', `Bearer ${badScope}`)
      .expect(403);
  });

  it('internal GET rejects when azp is wrong', async () => {
    const wrongAzp = await signServiceToken('user.read:credentials', 'some-other-service');
    await request(baseUrl)
      .get('/internal/auth/users/alice')
      .set('Authorization', `Bearer ${wrongAzp}`)
      .expect(403);
  });

  it('internal GET succeeds with correct scope+azp and includes password_hash', async () => {
    const ok = await signServiceToken('user.read:credentials', AZP);
    const res = await request(baseUrl)
      .get('/internal/auth/users/alice')
      .set('Authorization', `Bearer ${ok}`)
      .expect(200);

    expect(res.body.username).toBe('alice');
    expect(res.body).toHaveProperty('password_hash');
  });

  it('POST /api/v1/users requires users:create scope', async () => {
    // no auth -> 401
    await request(baseUrl)
      .post('/api/v1/users')
      .send({ username: 'bob', email: 'b@ex.com', password_hash: 'x' })
      .expect(401);

    // wrong scope -> 403
    const wrong = await signServiceToken('users:update');
    await request(baseUrl)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${wrong}`)
      .send({ username: 'bob', email: 'b@ex.com', password_hash: 'x' })
      .expect(403);

    // correct scope -> 201
    const ok = await signServiceToken('users:create');
    const res = await request(baseUrl)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ok}`)
      .send({ username: 'bob', email: 'b@ex.com', password_hash: 'x' })
      .expect(201);

    expect(res.body.username).toBe('bob');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('PATCH /api/v1/users/:id requires users:update scope', async () => {
    // no auth -> 401
    await request(baseUrl)
      .patch('/api/v1/users/u1')
      .send({ verified: true })
      .expect(401);

    // wrong scope -> 403
    const wrong = await signServiceToken('users:create');
    await request(baseUrl)
      .patch('/api/v1/users/u1')
      .set('Authorization', `Bearer ${wrong}`)
      .send({ verified: true })
      .expect(403);

    // correct scope -> 200 and sanitized
    const ok = await signServiceToken('users:update');
    const res = await request(baseUrl)
      .patch('/api/v1/users/u1')
      .set('Authorization', `Bearer ${ok}`)
      .send({ verified: true })
      .expect(200);

    expect(res.body.verified).toBe(true);
    expect(res.body).not.toHaveProperty('password_hash');
  });
});