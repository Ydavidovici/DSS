// src/modules/users/user.controller.ts
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import {
    createUser,
    getByUsername as svcGetByUsername,
    getByEmail as svcGetByEmail,
    updateUser,
    softDeleteUser,
    getRawByUsername,
    getRawByEmail,
} from './user.service';
import { FastifyReply, FastifyRequest } from 'fastify';

const usernameRegex = /^[a-zA-Z0-9_]{3,32}$/;

const createSchema = z.object({
    username: z.string().regex(usernameRegex, '3–32 word chars/underscore').max(32),
    email: z.string().email().max(254),
    password: z.string().min(8).max(200).optional(),
    password_hash: z.string().min(20).max(255).optional(),
    verified: z.boolean().optional(),
    verified_at: z.string().datetime().optional(),
    roles: z.array(z.unknown()).optional(),
})
    .refine(b => !!b.password || !!b.password_hash, { message: 'password or password_hash required' })
    .refine(b => !(b.password && b.password_hash), { message: 'provide only one of password or password_hash' });

const updateSchema = z.object({
    verified: z.boolean().optional(),
    verified_at: z.string().datetime().optional(),
    password: z.string().min(8).max(200).optional(),
    password_hash: z.string().min(20).max(255).optional(),
    roles: z.array(z.unknown()).optional(),
})
    .refine(b => !(b.password && b.password_hash), { message: 'provide only one of password or password_hash' })
    .refine(d => Object.keys(d).length > 0, 'Provide at least one field');

const idParams = z.object({
    // support UUID or numeric string ids (normalize to string)
    id: z.union([z.string().uuid(), z.string().regex(/^\d+$/)]).transform(String),
});

const usernameParams = z.object({ username: z.string().regex(usernameRegex) });
const emailParams = z.object({ email: z.string().email().max(254) });

const verifyBody = z.object({
    usernameOrEmail: z.string().min(3).max(254),
    password: z.string().min(8).max(200),
});

const sanitize = <T extends Record<string, any> | null | undefined>(u: T): T => {
    if (u && typeof u === 'object') delete (u as any).password_hash;
    return u;
};

const handleUniqueConflict = (e: any, reply: FastifyReply) => {
    if (e && (e.code === '23505' || e.constraint?.includes('unique'))) {
        return reply.code(409).send({
            error: { code: 'CONFLICT', message: 'Username or email already exists' },
        });
    }
    throw e;
};

export const UsersController = {
    // ───────────────────────────────
    // Writes (service-to-service)
    create: async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const body = createSchema.parse(req.body);
            const user = await createUser(body); // service hashes if only password provided
            return reply.code(201).send(sanitize(user));
        } catch (e: any) {
            return handleUniqueConflict(e, reply);
        }
    },

    update: async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const params = idParams.parse(req.params);
            const body = updateSchema.parse(req.body);
            const user = await updateUser(params.id, body); // service hashes if only password provided
            if (!user) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
            return reply.send(sanitize(user));
        } catch (e: any) {
            return handleUniqueConflict(e, reply);
        }
    },

    remove: async (req: FastifyRequest, reply: FastifyReply) => {
        const params = idParams.parse(req.params);
        const ok = await softDeleteUser(params.id);
        if (!ok) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
        return reply.code(204).send();
    },

    // ───────────────────────────────
    // Internal (service-to-service) sanitized reads
    internalGetByUsername: async (req: FastifyRequest, reply: FastifyReply) => {
        const { username } = usernameParams.parse(req.params);
        const user = await svcGetByUsername(username);
        if (!user) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
        return reply.send(sanitize(user));
    },

    internalGetByEmail: async (req: FastifyRequest, reply: FastifyReply) => {
        const { email } = emailParams.parse(req.params);
        const user = await svcGetByEmail(email);
        if (!user) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
        return reply.send(sanitize(user));
    },

    // ───────────────────────────────
    // Internal password verification (no hash leaves this service)
    internalVerifyPassword: async (req: FastifyRequest, reply: FastifyReply) => {
        const { usernameOrEmail, password } = verifyBody.parse(req.body);

        const lookUpRaw =
            usernameOrEmail.includes('@') ? getRawByEmail : getRawByUsername;

        const row = await lookUpRaw(usernameOrEmail);
        // Use 401 for both not found and bad password to avoid enumeration
        if (!row) return reply.code(401).send({ ok: false });

        const ok = await bcrypt.compare(password, row.password_hash);
        if (!ok) return reply.code(401).send({ ok: false });

        return reply.send({ ok: true, user: sanitize({ ...row }) });
    },

    // ───────────────────────────────
    // (Optional) If you keep public reads, keep these and gate them with end-user auth in routes.
    getByUsername: async (req: FastifyRequest, reply: FastifyReply) => {
        const params = usernameParams.parse(req.params);
        const user = await svcGetByUsername(params.username);
        if (!user) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
        return reply.send(sanitize(user));
    },

    getByEmail: async (req: FastifyRequest, reply: FastifyReply) => {
        const params = emailParams.parse(req.params);
        const user = await svcGetByEmail(params.email);
        if (!user) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
        return reply.send(sanitize(user));
    },
};
