import { z } from 'zod';
import {
  createUser, getByUsername as svcGetByUsername, getByEmail as svcGetByEmail,
  updateUser, softDeleteUser, getRawByUsername
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
  roles: z.array(z.unknown()).optional()
})
  .refine(b => !!b.password || !!b.password_hash, { message: 'password or password_hash required' })
  .refine(b => !(b.password && b.password_hash), { message: 'provide only one of password or password_hash' });

const updateSchema = z.object({
  verified: z.boolean().optional(),
  verified_at: z.string().datetime().optional(),
  password: z.string().min(8).max(200).optional(),
  password_hash: z.string().min(20).max(255).optional(),
  roles: z.array(z.unknown()).optional()
})
  .refine(b => !(b.password && b.password_hash), { message: 'provide only one of password or password_hash' })
  .refine(d => Object.keys(d).length > 0, 'Provide at least one field');

// If your users.id is UUID, keep uuid(). If it's serial INT, allow digits.
// This union handles both and passes a string "id" to the service.
const idParams = z.object({
  id: z.union([z.string().uuid(), z.string().regex(/^\d+$/)]).transform(String)
});

const usernameParams = z.object({ username: z.string().regex(usernameRegex) });
const emailParams = z.object({ email: z.string().email().max(254) });

const sanitize = <T extends Record<string, any> | null | undefined>(u: T): T => {
  if (u && typeof u === 'object') delete (u as any).password_hash;
  return u;
};

const handleUniqueConflict = (e: any, reply: FastifyReply) => {
  // Postgres unique violation
  if (e && (e.code === '23505' || e.constraint?.includes('unique'))) {
    return reply.code(409).send({
      error: { code: 'CONFLICT', message: 'Username or email already exists' }
    });
  }
  // otherwise let the global error handler take it
  throw e;
};

export const UsersController = {
  create: async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createSchema.parse(req.body);
      const user = await createUser(body); // service should hash if only password provided
      return reply.code(201).send(sanitize(user));
    } catch (e: any) {
      return handleUniqueConflict(e, reply);
    }
  },

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

  update: async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = idParams.parse(req.params);
      const body = updateSchema.parse(req.body);
      const user = await updateUser(params.id, body); // service should hash if only password provided
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

  // INTERNAL for auth-service ONLY — returns password_hash by design
  internalGetRaw: async (req: FastifyRequest, reply: FastifyReply) => {
    const params = usernameParams.parse(req.params);
    const row = await getRawByUsername(params.username);
    if (!row) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return reply.send(row); // includes password_hash; route is scope/azp-guarded
  }
};