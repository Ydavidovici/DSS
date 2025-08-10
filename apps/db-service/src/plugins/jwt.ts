import fp from 'fastify-plugin';
import {
  createRemoteJWKSet,
  jwtVerify,
  importSPKI,
  decodeProtectedHeader,
  JWK
} from 'jose';
import fs from 'node:fs';
import path from 'node:path';

type RequireAuthOpts = { scopes?: string[]; azp?: string };

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (opts?: RequireAuthOpts) => any;
  }
}

// Small utility: load all .pem files in a dir
async function loadPemDir(dir: string, log: (o: any, m: string) => void) {
  const keys: { kid?: string; key: CryptoKey; name: string }[] = [];
  if (!fs.existsSync(dir)) return keys;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith('.pem')) continue;
    const full = path.join(dir, entry.name);
    try {
      const pem = fs.readFileSync(full, 'utf8');
      const key = await importSPKI(pem, 'RS256');
      // If filename looks like kid.pem, remember kid for fast match
      const base = path.basename(entry.name, '.pem');
      keys.push({ kid: base, key, name: entry.name });
    } catch (e) {
      log({ err: e, file: entry.name }, 'failed to import PEM');
    }
  }
  return keys;
}

// Try to verify against a list of keys (PEM mode, multi-key)
async function verifyAgainstAny(token: string, keys: CryptoKey[], iss: string, aud: string, clockTol: number) {
  let lastErr: any;
  for (const k of keys) {
    try {
      return await jwtVerify(token, k, { issuer: iss, audience: aud, clockTolerance: clockTol });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export default fp(async (app) => {
  const mode = (process.env.AUTH_MODE || 'PEM').toUpperCase(); // 'PEM' or 'JWKS'
  const issuer = process.env.AUTH_ISSUER || '';
  const audience = process.env.AUTH_AUDIENCE || 'db-service';
  const clockTolerance = Number(process.env.AUTH_CLOCK_TOLERANCE || 5); // seconds

  // PEM inputs
  const inlinePem = process.env.AUTH_PUBLIC_KEY_PEM;
  const pemPath = process.env.AUTH_PUBLIC_KEY_PATH;         // e.g. ./keys/public.pem
  const pemDir  = process.env.AUTH_PUBLIC_KEYS_DIR;         // e.g. ./keys/public/ (supports multiple keys + hot reload)

  // JWKS input
  const jwksUrl = process.env.AUTH_JWKS_URL;

  if (!issuer) app.log.warn('AUTH_ISSUER not set; set e.g. https://dss-auth');
  if (!audience) app.log.warn('AUTH_AUDIENCE not set; defaulting to "db-service"');

  // --- Build verifiers ---
  let jwksVerifier: ((t: string) => Promise<{ payload: any }>) | null = null;
  let pemSingleKey: CryptoKey | null = null;
  let pemKeyList: { kid?: string; key: CryptoKey; name: string }[] = [];

  if (mode === 'JWKS') {
    if (!jwksUrl) app.log.warn('AUTH_MODE=JWKS but AUTH_JWKS_URL not set');
    else {
      const JWKS = createRemoteJWKSet(new URL(jwksUrl));
      jwksVerifier = async (token: string) =>
        jwtVerify(token, JWKS, { issuer, audience, clockTolerance });
    }
  } else if (mode === 'PEM') {
    // Priority: directory (multi-key) > single key (file or inline)
    if (pemDir) {
      pemKeyList = await loadPemDir(pemDir, app.log.warn.bind(app.log));
      // Hot reload watcher
      try {
        fs.watch(pemDir, { persistent: false }, async () => {
          try {
            const reloaded = await loadPemDir(pemDir, app.log.warn.bind(app.log));
            pemKeyList = reloaded;
            app.log.info({ count: pemKeyList.length }, 'reloaded PEM keys from directory');
          } catch (e) {
            app.log.warn({ err: e }, 'failed to reload PEM dir');
          }
        });
        app.log.info({ dir: pemDir, count: pemKeyList.length }, 'PEM directory watch enabled');
      } catch (e) {
        app.log.warn({ err: e, dir: pemDir }, 'PEM directory watch not supported');
      }
    } else if (inlinePem || pemPath) {
      let pem = inlinePem;
      if (!pem && pemPath) {
        try {
          pem = fs.readFileSync(pemPath, 'utf8');
          // watch single file for rotation
          try {
            fs.watch(pemPath, { persistent: false }, async () => {
              try {
                const newer = fs.readFileSync(pemPath!, 'utf8');
                pemSingleKey = await importSPKI(newer, 'RS256');
                app.log.info({ file: pemPath }, 'reloaded PEM public key');
              } catch (e) {
                app.log.warn({ err: e, file: pemPath }, 'failed to reload PEM file');
              }
            });
            app.log.info({ file: pemPath }, 'PEM file watch enabled');
          } catch (e) {
            app.log.warn({ err: e, file: pemPath }, 'PEM file watch not supported');
          }
        } catch (e) {
          app.log.error({ err: e, file: pemPath }, 'failed to read AUTH_PUBLIC_KEY_PATH');
        }
      }
      if (pem) {
        pemSingleKey = await importSPKI(pem, 'RS256');
      } else {
        app.log.warn('AUTH_MODE=PEM but no key provided (AUTH_PUBLIC_KEYS_DIR / AUTH_PUBLIC_KEY_PATH / AUTH_PUBLIC_KEY_PEM)');
      }
    } else {
      app.log.warn('AUTH_MODE=PEM but no key source configured');
    }
  } else {
    app.log.warn(`Unknown AUTH_MODE="${mode}"`);
  }

  // --- requireAuth decorator ---
  const extractScopes = (payload: any): Set<string> => {
    if (Array.isArray(payload?.permissions)) return new Set(payload.permissions);
    if (typeof payload?.scope === 'string') return new Set(payload.scope.split(' ').filter(Boolean));
    return new Set<string>();
  };

  app.decorate('requireAuth', (opts?: RequireAuthOpts) => {
    const needed = new Set(opts?.scopes ?? []);
    const needAzp = opts?.azp;

    return async (req, reply) => {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) {
        return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' } });
      }
      const token = auth.slice(7);

      try {
        let payload: any;

        if (mode === 'JWKS') {
          if (!jwksVerifier) throw new Error('JWKS verifier not configured');
          ({ payload } = await jwksVerifier(token));
        } else {
          if (pemDir && pemKeyList.length) {
            // If token has kid and we have a matching file-named kid, try that first
            try {
              const { kid } = decodeProtectedHeader(token) || {};
              if (kid) {
                const match = pemKeyList.find(k => k.kid === kid);
                if (match) {
                  ({ payload } = await jwtVerify(token, match.key, { issuer, audience, clockTolerance }));
                } else {
                  ({ payload } = await verifyAgainstAny(
                    token,
                    pemKeyList.map(k => k.key),
                    issuer, audience, clockTolerance
                  ));
                }
              } else {
                ({ payload } = await verifyAgainstAny(
                  token,
                  pemKeyList.map(k => k.key),
                  issuer, audience, clockTolerance
                ));
              }
            } catch (e) {
              throw e;
            }
          } else if (pemSingleKey) {
            ({ payload } = await jwtVerify(token, pemSingleKey, { issuer, audience, clockTolerance }));
          } else {
            throw new Error('PEM verifier not configured');
          }
        }

        (req as any).user = payload;

        if (needAzp && payload.azp !== needAzp) {
          return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Invalid authorized party' } });
        }
        if (needed.size) {
          const have = extractScopes(payload);
          for (const s of needed) if (!have.has(s)) {
            return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient scope' } });
          }
        }
      } catch (err) {
        req.log.warn({ err }, 'JWT verification failed');
        return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
      }
    };
  });
});