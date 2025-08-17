import Fastify from 'fastify';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { SignJWT, importPKCS8 } from 'jose';
import { ZodError } from 'zod';
import bcrypt from 'bcryptjs';

// ✅ Define constants in a hoisted block
const ids = vi.hoisted(() => ({
    USER_ID:    '00000000-0000-0000-0000-000000000001',
    MISSING_ID: '00000000-0000-0000-0000-0000000000aa',
    DUPE_ID:    '00000000-0000-0000-0000-0000000000bb',
}));

// Convenience aliases for the rest of the test file
const USER_ID = ids.USER_ID;
const MISSING_ID = ids.MISSING_ID;
const DUPE_ID = ids.DUPE_ID;

// ✅ Mock runs at hoist time and can safely read ids.*
vi.mock('../modules/users/user.service', () => {
    const bcrypt = require('bcryptjs');
    const hashAlice = bcrypt.hashSync('s3cret12', 10);
    const hashBob   = bcrypt.hashSync('hunter22', 10);

    const userAliceRaw = {
        id: ids.USER_ID,
        username: 'alice',
        email: 'a@ex.com',
        verified: true,
        roles: ['user'],
        password_hash: hashAlice,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        deleted_at: null,
    };

    const deletedIds = new Set<string>();

    return {
        createUser: vi.fn(async (b: any) => {
            if (b.username === 'dupe' || b.email === 'dupe@ex.com') {
                const err: any = new Error('duplicate');
                err.code = '23505';
                throw err;
            }
            return {
                id: 'u2',
                username: b.username,
                email: b.email,
                verified: !!b.verified,
                roles: b.roles ?? [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                deleted_at: null,
            };
        }),

        getByUsername: vi.fn(async (u: string) => {
            if (deletedIds.has(ids.USER_ID)) return null;
            if (u === 'alice') {
                const { password_hash, ...pub } = userAliceRaw;
                return pub;
            }
            return null;
        }),

        getByEmail: vi.fn(async (e: string) => {
            if (deletedIds.has(ids.USER_ID)) return null;
            if (e === 'a@ex.com') {
                const { password_hash, ...pub } = userAliceRaw;
                return pub;
            }
            return null;
        }),

        getRawByUsername: vi.fn(async (u: string) => {
            if (deletedIds.has(ids.USER_ID)) return null;
            return u === 'alice' ? { ...userAliceRaw } : null;
        }),

        getRawByEmail: vi.fn(async (e: string) => {
            if (deletedIds.has(ids.USER_ID)) return null;
            return e === 'a@ex.com' ? { ...userAliceRaw } : null;
        }),

        updateUser: vi.fn(async (id: string, patch: any) => {
            if (id === ids.MISSING_ID) return null;
            if (id === ids.DUPE_ID) {
                const err: any = new Error('duplicate');
                err.code = '23505';
                throw err;
            }
            return {
                id,
                username: 'alice',
                email: 'a@ex.com',
                verified: patch.verified ?? true,
                roles: 'roles' in patch ? (patch.roles ?? []) : ['user'],
                created_at: '2024-01-01T00:00:00.000Z',
                updated_at: new Date().toISOString(),
                deleted_at: null,
            };
        }),

        softDeleteUser: vi.fn(async (id: string) => {
            if (id !== ids.USER_ID) return false;         // unknown id → not deleted
            if (deletedIds.has(id)) return false;         // already deleted → 404
            deletedIds.add(id);                           // first delete → 204
            return true;
        }),
    };
});

// ✅ Register Fastify plugins & routes after mocks (only once!)
import internalGuard from '../plugins/jwt';
import userRoutes from '../modules/users/user.routes';

describe('[db-service] users end-to-end (with mocked service + real JWT guard)', () => {
    const ISS = 'https://issuer.test';
    const AUD = 'db-service';
    const AZP = 'auth-service';

    let app: ReturnType<typeof Fastify>;
    let baseUrl: string;
    let privatePem: string;
    let publicPem: string;

    beforeAll(async () => {
        const keys = generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding:  { type: 'spki',  format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });
        privatePem = keys.privateKey;
        publicPem  = keys.publicKey;

        process.env.AUTH_MODE = 'PEM';
        process.env.AUTH_PUBLIC_KEY_PEM = publicPem;
        process.env.AUTH_ISSUER = ISS;
        process.env.AUTH_AUDIENCE = AUD;
        process.env.AUTH_SERVICE_AZP = AZP;

        app = Fastify({ logger: false });

        // Map Zod → 400
        app.setErrorHandler((err: any, _req, reply) => {
            if (err instanceof ZodError) {
                return reply
                    .code(400)
                    .send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.issues } });
            }
            const status = err.httpCode || 500;
            return reply.code(status).send({ error: err.public ?? { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
        });

        await app.register(internalGuard);
        await app.register(userRoutes);

        baseUrl = await app.listen({ port: 0 });
    });

    afterAll(async () => {
        await app.close();
    });

    async function signSvcToken({
                                    scope,
                                    azp = AZP,
                                    iss = ISS,
                                    aud = AUD,
                                    ttlSec = 60,
                                    kid = 'test-key',
                                    addPermissionsArray = false,
                                    expired = false,
                                }: {
        scope?: string | string[];
        azp?: string;
        iss?: string;
        aud?: string;
        ttlSec?: number;
        kid?: string;
        addPermissionsArray?: boolean;
        expired?: boolean;
    } = {}) {
        const key = await importPKCS8(privatePem, 'RS256');
        const scopes = Array.isArray(scope) ? scope.join(' ') : (scope ?? '');
        const jwt = new SignJWT({
            typ: 'access',
            scope: scopes,
            azp,
            ...(addPermissionsArray ? { permissions: scopes ? scopes.split(' ') : [] } : {}),
        })
            .setProtectedHeader({ alg: 'RS256', kid })
            .setIssuer(iss)
            .setAudience(aud)
            .setSubject('client_auth')
            .setIssuedAt();

        jwt.setExpirationTime(expired ? Math.floor(Date.now() / 1000) - 10 : `${ttlSec}s`);
        return jwt.sign(key);
    }

    // ───────── Auth guard basics ─────────

    it('401 when missing bearer token on internal read', async () => {
        await request(baseUrl).get('/internal/auth/users/alice').expect(401);
    });

    it('401 when wrong issuer', async () => {
        const bad = await signSvcToken({ scope: 'users:read', iss: 'https://evil.example' });
        await request(baseUrl)
            .get('/internal/auth/users/alice')
            .set('Authorization', `Bearer ${bad}`)
            .expect(401);
    });

    it('401 when wrong audience', async () => {
        const bad = await signSvcToken({ scope: 'users:read', aud: 'other-service' });
        await request(baseUrl)
            .get('/internal/auth/users/alice')
            .set('Authorization', `Bearer ${bad}`)
            .expect(401);
    });

    it('401 when token expired', async () => {
        const expired = await signSvcToken({ scope: 'users:read', expired: true });
        await request(baseUrl)
            .get('/internal/auth/users/alice')
            .set('Authorization', `Bearer ${expired}`)
            .expect(401);
    });

    it('403 when missing required scope', async () => {
        const tok = await signSvcToken({ scope: '' });
        await request(baseUrl)
            .get('/internal/auth/users/alice')
            .set('Authorization', `Bearer ${tok}`)
            .expect(403);
    });

    it('403 when wrong azp', async () => {
        const tok = await signSvcToken({ scope: 'users:read', azp: 'frontend-app' });
        await request(baseUrl)
            .get('/internal/auth/users/alice')
            .set('Authorization', `Bearer ${tok}`)
            .expect(403);
    });

    it('supports scope in permissions array', async () => {
        const tok = await signSvcToken({ scope: 'users:read', addPermissionsArray: true });
        await request(baseUrl)
            .get('/internal/auth/users/alice')
            .set('Authorization', `Bearer ${tok}`)
            .expect(200);
    });

    // ───────── Internal sanitized reads ─────────

    it('GET /internal/auth/users/:username returns sanitized user', async () => {
        const tok = await signSvcToken({ scope: 'users:read' });
        const res = await request(baseUrl)
            .get('/internal/auth/users/alice')
            .set('Authorization', `Bearer ${tok}`)
            .expect(200);

        expect(res.body.username).toBe('alice');
        expect(res.body).not.toHaveProperty('password_hash');
    });

    it('GET /internal/auth/users/email/:email returns sanitized user', async () => {
        const tok = await signSvcToken({ scope: 'users:read' });
        const res = await request(baseUrl)
            .get('/internal/auth/users/email/a@ex.com')
            .set('Authorization', `Bearer ${tok}`)
            .expect(200);

        expect(res.body.email).toBe('a@ex.com');
        expect(res.body).not.toHaveProperty('password_hash');
    });

    it('internal reads return 404 for unknown users', async () => {
        const tok = await signSvcToken({ scope: 'users:read' });
        await request(baseUrl)
            .get('/internal/auth/users/bob')
            .set('Authorization', `Bearer ${tok}`)
            .expect(404);

        await request(baseUrl)
            .get('/internal/auth/users/email/b@ex.com')
            .set('Authorization', `Bearer ${tok}`)
            .expect(404);
    });

    // ───────── Internal password verify ─────────

    it('POST /internal/auth/verify-password → 200 ok:true on correct creds', async () => {
        const tok = await signSvcToken({ scope: 'user.verify:password' });
        const res = await request(baseUrl)
            .post('/internal/auth/verify-password')
            .set('Authorization', `Bearer ${tok}`)
            .send({ usernameOrEmail: 'alice', password: 's3cret12' }) // ✅ >= 8 & matches stored hash
            .expect(200);

        expect(res.body.ok).toBe(true);
        expect(res.body.user.username).toBe('alice');
        expect(res.body.user).not.toHaveProperty('password_hash');
    });

    it('verify-password → 401 on wrong password or unknown user', async () => {
        const tok = await signSvcToken({ scope: 'user.verify:password' });

        await request(baseUrl)
            .post('/internal/auth/verify-password')
            .set('Authorization', `Bearer ${tok}`)
            .send({ usernameOrEmail: 'alice', password: 'wrongpass1' }) // ✅ still >= 8
            .expect(401);

        await request(baseUrl)
            .post('/internal/auth/verify-password')
            .set('Authorization', `Bearer ${tok}`)
            .send({ usernameOrEmail: 'nobody', password: 'whatever' })
            .expect(401);
    });

    it('verify-password → 400 on validation errors', async () => {
        const tok = await signSvcToken({ scope: 'user.verify:password' });
        await request(baseUrl)
            .post('/internal/auth/verify-password')
            .set('Authorization', `Bearer ${tok}`)
            .send({ usernameOrEmail: 'a', password: 'x' }) // too short
            .expect(400);
    });

    // ───────── Writes: create / update / delete ─────────

    it('POST /api/v1/users requires scope & azp and returns sanitized user', async () => {
        // 401: missing token
        await request(baseUrl)
            .post('/api/v1/users')
            .send({ username: 'bob', email: 'b@ex.com', password: 'hunter22' }) // ✅ >= 8
            .expect(401);

        // 403: wrong scope
        const wrongScope = await signSvcToken({ scope: 'users:update' });
        await request(baseUrl)
            .post('/api/v1/users')
            .set('Authorization', `Bearer ${wrongScope}`)
            .send({ username: 'bob', email: 'b@ex.com', password: 'hunter22' })
            .expect(403);

        // 403: wrong azp
        const wrongAzp = await signSvcToken({ scope: 'users:create', azp: 'frontend' });
        await request(baseUrl)
            .post('/api/v1/users')
            .set('Authorization', `Bearer ${wrongAzp}`)
            .send({ username: 'bob', email: 'b@ex.com', password: 'hunter22' })
            .expect(403);

        // 400: validation (neither password nor hash)
        const okScope = await signSvcToken({ scope: 'users:create' });
        await request(baseUrl)
            .post('/api/v1/users')
            .set('Authorization', `Bearer ${okScope}`)
            .send({ username: 'bob', email: 'b@ex.com' })
            .expect(400);

        // 201: created (sanitized)
        const res = await request(baseUrl)
            .post('/api/v1/users')
            .set('Authorization', `Bearer ${okScope}`)
            .send({ username: 'bob', email: 'b@ex.com', password: 'hunter22' })
            .expect(201);
        expect(res.body.username).toBe('bob');
        expect(res.body).not.toHaveProperty('password_hash');

        // 409: conflict mapping
        await request(baseUrl)
            .post('/api/v1/users')
            .set('Authorization', `Bearer ${okScope}`)
            .send({ username: 'dupe', email: 'dupe@ex.com', password: 'x12345678' })
            .expect(409);
    });

    it('PATCH /api/v1/users/:id requires scope & azp and returns sanitized user', async () => {
        // 401: missing token
        await request(baseUrl)
            .patch(`/api/v1/users/${USER_ID}`) // ✅ use UUID
            .send({ verified: true })
            .expect(401);

        // 403: wrong scope
        const wrongScope = await signSvcToken({ scope: 'users:create' });
        await request(baseUrl)
            .patch(`/api/v1/users/${USER_ID}`)
            .set('Authorization', `Bearer ${wrongScope}`)
            .send({ verified: true })
            .expect(403);

        // 403: wrong azp
        const wrongAzp = await signSvcToken({ scope: 'users:update', azp: 'frontend' });
        await request(baseUrl)
            .patch(`/api/v1/users/${USER_ID}`)
            .set('Authorization', `Bearer ${wrongAzp}`)
            .send({ verified: false })
            .expect(403);

        const okScope = await signSvcToken({ scope: 'users:update' });

        // 400: both password and password_hash provided
        await request(baseUrl)
            .patch(`/api/v1/users/${USER_ID}`)
            .set('Authorization', `Bearer ${okScope}`)
            .send({ password: 'newPasspass!', password_hash: 'abc'.repeat(10) })
            .expect(400);

        // 200: set verified true
        const res1 = await request(baseUrl)
            .patch(`/api/v1/users/${USER_ID}`)
            .set('Authorization', `Bearer ${okScope}`)
            .send({ verified: true })
            .expect(200);
        expect(res1.body).toMatchObject({ id: USER_ID, verified: true });
        expect(res1.body).not.toHaveProperty('password_hash');

        // 200: update roles and password via hash
        const res2 = await request(baseUrl)
            .patch(`/api/v1/users/${USER_ID}`)
            .set('Authorization', `Bearer ${okScope}`)
            .send({ roles: ['admin'], password_hash: bcrypt.hashSync('newp@ss', 10) })
            .expect(200);
        expect(res2.body.roles).toContain('admin');

        // 404: missing id (but valid format)
        await request(baseUrl)
            .patch(`/api/v1/users/${MISSING_ID}`)
            .set('Authorization', `Bearer ${okScope}`)
            .send({ verified: true })
            .expect(404);

        // 409: conflict mapping
        await request(baseUrl)
            .patch(`/api/v1/users/${DUPE_ID}`)
            .set('Authorization', `Bearer ${okScope}`)
            .send({ verified: true })
            .expect(409);
    });

    it('DELETE /api/v1/users/:id requires scope & azp and returns 204/404', async () => {
        // 401: missing token
        await request(baseUrl).delete(`/api/v1/users/${USER_ID}`).expect(401);

        // 403: wrong scope
        const wrongScope = await signSvcToken({ scope: 'users:update' });
        await request(baseUrl)
            .delete(`/api/v1/users/${USER_ID}`)
            .set('Authorization', `Bearer ${wrongScope}`)
            .expect(403);

        // 403: wrong azp
        const wrongAzp = await signSvcToken({ scope: 'users:delete', azp: 'frontend' });
        await request(baseUrl)
            .delete(`/api/v1/users/${USER_ID}`)
            .set('Authorization', `Bearer ${wrongAzp}`)
            .expect(403);

        // 204: ok
        const ok = await signSvcToken({ scope: 'users:delete' });
        await request(baseUrl)
            .delete(`/api/v1/users/${USER_ID}`)
            .set('Authorization', `Bearer ${ok}`)
            .expect(204);

        // 404: already deleted
        await request(baseUrl)
            .delete(`/api/v1/users/${USER_ID}`)
            .set('Authorization', `Bearer ${ok}`)
            .expect(404);
    });
});
