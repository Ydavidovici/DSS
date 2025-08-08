import { generateKeyPairSync, createPrivateKey, createPublicKey } from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const KEYS_DIR = process.env.JWKS_PATH || path.resolve(__dirname, '../keys');
const ENV_PATH = path.resolve(__dirname, '../.env');

/**
 * Generates an RSA key-pair for a given key ID (kid).
 * Writes `<kid>_private.pem` and `<kid>_public.pem` into the keys directory.
 */
export function generateKeyPair(kid: string) {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  if (!fs.existsSync(KEYS_DIR)) fs.mkdirSync(KEYS_DIR, { recursive: true });

  fs.writeFileSync(path.join(KEYS_DIR, `${kid}_private.pem`), privateKey);
  fs.writeFileSync(path.join(KEYS_DIR, `${kid}_public.pem`), publicKey);

  console.log(`Generated key-pair for kid='${kid}' in ${KEYS_DIR}`);
}

/**
 * Rotates to a new key: generate and then update .env CURRENT_KID.
 */
export function rotateKey(newKid: string) {
  generateKeyPair(newKid);
  updateEnv('CURRENT_KID', newKid);
  console.log(`Rotated CURRENT_KID to '${newKid}'. Remember to deploy new public key.`);
}

/**
 * Updates an environment variable in your .env file (or creates it).
 */
function updateEnv(key: string, value: string) {
  const env = fs.existsSync(ENV_PATH)
    ? fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)
    : [];

  const idx = env.findIndex(line => line.startsWith(key + '='));
  if (idx >= 0) {
    env[idx] = `${key}=${value}`;
  } else {
    env.push(`${key}=${value}`);
  }
  fs.writeFileSync(ENV_PATH, env.join('\n'));
}

/**
 * Lists all existing kids by scanning the keys directory.
 */
export function listKids(): string[] {
  if (!fs.existsSync(KEYS_DIR)) return [];
  return fs.readdirSync(KEYS_DIR)
    .filter(f => f.endsWith('_public.pem'))
    .map(f => f.replace('_public.pem', ''));
}

/**
 * Archives (revokes) an old key by moving its files to an `archive/` subfolder.
 */
export function revokeKey(kid: string) {
  const archiveDir = path.join(KEYS_DIR, 'archive');
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir);

  ['private', 'public'].forEach(type => {
    const file = path.join(KEYS_DIR, `${kid}_${type}.pem`);
    if (fs.existsSync(file)) {
      fs.renameSync(file, path.join(archiveDir, `${kid}_${type}.pem`));
      console.log(`Moved ${kid}_${type}.pem to archive/`);
    }
  });
}

// CLI handling
const [,, command, kidArg] = process.argv;
if (require.main === module) {
  switch (command) {
    case 'generate':
      generateKeyPair(kidArg || `auth-key-${Date.now()}`);
      break;
    case 'rotate':
      if (!kidArg) return console.error('Usage: rotate <newKid>');
      rotateKey(kidArg);
      break;
    case 'list':
      console.log('Available kids:', listKids());
      break;
    case 'revoke':
      if (!kidArg) return console.error('Usage: revoke <kid>');
      revokeKey(kidArg);
      break;
    default:
      console.log(`Usage: generate <kid> | rotate <kid> | list | revoke <kid>`);
  }
}
