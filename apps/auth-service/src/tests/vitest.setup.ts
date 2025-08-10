// vitest.setup.ts
import { vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { generateKeyPairSync } from 'crypto';

// Deterministic time for tokens
vi.useFakeTimers();
vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

// Minimal env your routes expect
process.env.NODE_ENV = 'test';
process.env.JWT_ISSUER = 'http://auth.test';
process.env.JWT_AUDIENCE = 'dss-services';
process.env.CURRENT_KID = 'test-key';
process.env.RATE_LIMIT_USE_MEMORY = 'true'; // if your limiter supports in-memory fallback
process.env.COOKIE_SAMESITE = 'lax';
process.env.DB_SERVICE_URL = 'http://db.service.test';

// Generate a temporary RSA keypair on the fly
(function ensureTestKeys() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-keys-'));
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  fs.writeFileSync(path.join(dir, `${process.env.CURRENT_KID}_private.pem`), privateKey);
  fs.writeFileSync(path.join(dir, `${process.env.CURRENT_KID}_public.pem`), publicKey);
  process.env.JWKS_PATH = dir;
})();