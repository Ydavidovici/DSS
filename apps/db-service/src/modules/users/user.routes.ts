import { FastifyInstance } from 'fastify';
import { UsersController } from './user.controller';

export default async function userRoutes(app: FastifyInstance) {
    const AZP = process.env.AUTH_SERVICE_AZP || 'auth-service';
    const svc = (scopes: string[]) => ({ preHandler: app.requireAuth({ scopes, azp: AZP }) });

    // ────────────────────────────────────────────────────────────────────────────
    // Internal (service-to-service) reads — sanitized (no password_hash)
    // If you still want username/email lookups, make them INTERNAL, not public.
    app.get('/internal/auth/users/:username',
        svc(['users:read']),
        UsersController.internalGetByUsername
    );

    app.get('/internal/auth/users/email/:email',
        svc(['users:read']),
        UsersController.internalGetByEmail
    );

    // OPTIONAL: If you truly need public or end-user reads, gate with end-user auth and heavy RL.
    // app.get('/api/v1/users/:username', app.requireAuth(), UsersController.getByUsername);
    // app.get('/api/v1/users/email/:email', app.requireAuth(), UsersController.getByEmail);

    // ────────────────────────────────────────────────────────────────────────────
    // Internal password verification — avoids exposing password_hash anywhere
    app.post('/internal/auth/verify-password',
        svc(['user.verify:password']),
        UsersController.internalVerifyPassword
    );

    // ────────────────────────────────────────────────────────────────────────────
    // Writes (service-to-service only; scope + azp enforced)
    app.post('/api/v1/users',
        { ...svc(['users:create']), config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
        UsersController.create
    );

    app.patch('/api/v1/users/:id',
        svc(['users:update']),
        UsersController.update
    );

    app.delete('/api/v1/users/:id',
        svc(['users:delete']),
        UsersController.remove
    );
}
