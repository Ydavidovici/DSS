// src/index.ts
import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import pino from 'pino';

import rateLimit from './plugins/rateLimit';
import jwt from './plugins/jwt';
import userRoutes from './modules/users/user.routes';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.password_hash'],
    censor: '***'
  }
});

const app = Fastify({
  logger,
  requestIdHeader: 'x-request-id',
  genReqId: () => crypto.randomUUID()
});

await app.register(fastifyCors, {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET','POST','PATCH','DELETE']
});

await app.register(rateLimit);
await app.register(jwt);

app.get('/healthz', async () => ({ ok: true }));

await app.register(userRoutes);

app.setErrorHandler((err: any, req, reply) => {
  const status = err.httpCode || (err.validation ? 400 : 500);
  const payload = err.public ||
    (err.validation ? { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.validation }
      : { code: 'INTERNAL_ERROR', message: 'Unexpected error' });
  req.log.error({ err }, 'request failed');
  reply.code(status).send({ error: payload });
});

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';
await app.listen({ host, port });
app.log.info(`db-service listening on http://${host}:${port}`);