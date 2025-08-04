import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import pino from 'pino';

const logger = pino();
const app = Fastify({ logger });

// allow any origin (or lock it down by env var)
app.register(fastifyCors, {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET','POST','PATCH','DELETE']
});

// … your JWT, rateLimit, routes, etc.

await app.listen({
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 4000)
});
logger.info(`Listening on ${process.env.HOST || '0.0.0.0'}:${process.env.PORT}`);