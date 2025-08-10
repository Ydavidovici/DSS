import { FastifyInstance } from 'fastify';
import { UsersController } from './user.controller';

export default async function userRoutes(app: FastifyInstance) {
  // Public reads
  app.get(
    '/api/v1/users/:username',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    UsersController.getByUsername
  );

  app.get(
    '/api/v1/users/email/:email',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    UsersController.getByEmail
  );

  // Protected writes
  app.post(
    '/api/v1/users',
    {
      preHandler: app.requireAuth({ scopes: ['users:create'], azp: process.env.AUTH_SERVICE_AZP || 'auth-service' }),
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } }
    },
    UsersController.create
  );

  app.patch(
    '/api/v1/users/:id',
    { preHandler: app.requireAuth({ scopes: ['users:update'] }) },
    UsersController.update
  );

  app.delete(
    '/api/v1/users/:id',
    { preHandler: app.requireAuth({ scopes: ['users:delete'] }) },
    UsersController.remove
  );

  // Internal credential lookup (auth-service only)
  app.get(
    '/internal/auth/users/:username',
    { preHandler: app.requireAuth({ scopes: ['user.read:credentials'], azp: process.env.AUTH_SERVICE_AZP || 'auth-service' }) },
    UsersController.internalGetRaw
  );
}