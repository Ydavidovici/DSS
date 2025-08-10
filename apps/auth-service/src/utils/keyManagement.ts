import { generateKeyPairSync } from "crypto";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { kv } from "./redis";

dotenv.config();

const KEYS_DIR = process.env.JWKS_PATH || path.resolve(process.cwd(), "src/keys");
const ENV_PATH = process.env.ENV_FILE || path.resolve(process.cwd(), ".env");
const CURRENT_KID_ENV = "CURRENT_KID";
const DEFAULT_RSA_BITS = Number(process.env.RSA_MODULUS_BITS || 3072); // 3072 by default

// Strict kid whitelist to avoid path traversal and weird filenames
const KID_RE = /^[A-Za-z0-9._-]{1,64}$/;

function ensureKeysDir() {
  if (!fs.existsSync(KEYS_DIR)) fs.mkdirSync(KEYS_DIR, { recursive: true, mode: 0o755 });
}

function pathsForKid(kid: string) {
  if (!KID_RE.test(kid)) {
    throw new Error(`Invalid kid '${kid}'. Allowed: ${KID_RE}`);
  }
  return {
    priv: path.join(KEYS_DIR, `${kid}_private.pem`),
    pub: path.join(KEYS_DIR, `${kid}_public.pem`),
  };
}

function readEnvLines(): string[] {
  if (!fs.existsSync(ENV_PATH)) return [];
  return fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
}

function writeEnvLines(lines: string[]) {
  // Always end with newline so dotenv parsers are happy
  if (lines.length === 0 || lines[lines.length - 1] !== "") lines.push("");
  fs.writeFileSync(ENV_PATH, lines.join("\n"), { mode: 0o600 });
}

function getCurrentKid(): string | null {
  const lines = readEnvLines();
  const line = lines.find((l) => l.startsWith(`${CURRENT_KID_ENV}=`));
  return line ? line.split("=", 2)[1] : null;
}

function setCurrentKid(newKid: string) {
  const lines = readEnvLines();
  const idx = lines.findIndex((l) => l.startsWith(`${CURRENT_KID_ENV}=`));
  const row = `${CURRENT_KID_ENV}=${newKid}`;
  if (idx >= 0) lines[idx] = row;
  else lines.push(row);
  writeEnvLines(lines);
}

function chmodSafe(file: string, mode: number) {
  try {
    fs.chmodSync(file, mode);
  } catch {
    // ignore on FS that don't support chmod (e.g. some Docker volumes)
  }
}

/**
 * Generate an RSA keypair for a kid. Fails if files already exist unless overwrite=true.
 */
export function generateKeyPair(kid: string, opts?: { overwrite?: boolean; bits?: number }) {
  ensureKeysDir();
  const { priv, pub } = pathsForKid(kid);

  if (!opts?.overwrite) {
    if (fs.existsSync(priv) || fs.existsSync(pub)) {
      throw new Error(`Key files already exist for kid='${kid}'. Use overwrite option if intended.`);
    }
  }

  const modulusLength = opts?.bits ?? DEFAULT_RSA_BITS;
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  fs.writeFileSync(priv, privateKey, { mode: 0o600 });
  fs.writeFileSync(pub, publicKey, { mode: 0o644 });
  chmodSafe(priv, 0o600);
  chmodSafe(pub, 0o644);

  console.log(`Generated key-pair kid='${kid}' (${modulusLength} bits) in ${KEYS_DIR}`);
}

/**
 * Rotate to a new kid (generate + set CURRENT_KID). Does NOT remove old public key
 * so existing tokens still verify. Clears JWKS cache so verifiers see new key quickly.
 */
export async function rotateKey(newKid: string, opts?: { bits?: number }) {
  generateKeyPair(newKid, { bits: opts?.bits });
  setCurrentKid(newKid);
  console.log(`Rotated CURRENT_KID to '${newKid}'.`);
  // Bust JWKS cache so /.well-known/jwks.json refreshes
  try {
    await kv.clearJWKS();
    console.log("Cleared JWKS cache.");
  } catch {
    console.warn("Could not clear JWKS cache (Redis unavailable?).");
  }
}

/**
 * List key status for all kids found in KEYS_DIR.
 */
export function listKids(): Array<{ kid: string; hasPrivate: boolean; hasPublic: boolean; active: boolean }> {
  if (!fs.existsSync(KEYS_DIR)) return [];
  const files = fs.readdirSync(KEYS_DIR).filter((f) => f.endsWith(".pem"));
  const current = getCurrentKid();
  const set = new Map<string, { hasPrivate: boolean; hasPublic: boolean }>();
  for (const f of files) {
    const m = f.match(/^(.*)_(private|public)\.pem$/);
    if (!m) continue;
    const [, kid, type] = m;
    if (!KID_RE.test(kid)) continue;
    const rec = set.get(kid) || { hasPrivate: false, hasPublic: false };
    if (type === "private") rec.hasPrivate = true;
    if (type === "public") rec.hasPublic = true;
    set.set(kid, rec);
  }
  return Array.from(set.entries()).map(([kid, v]) => ({
    kid,
    hasPrivate: v.hasPrivate,
    hasPublic: v.hasPublic,
    active: current === kid,
  }));
}

/**
 * Safely archive a kid (moves both files into keys/archive).
 * WARNING: Do NOT archive keys still needed to verify unexpired tokens.
 * This will effectively remove the key from JWKS if your loader only scans KEYS_DIR.
 */
export async function revokeKey(kid: string) {
  const current = getCurrentKid();
  if (kid === current) {
    throw new Error(`Refusing to revoke CURRENT_KID='${kid}'. Rotate first, wait for token expiry, then revoke.`);
  }

  const { priv, pub } = pathsForKid(kid);
  const archiveDir = path.join(KEYS_DIR, "archive");
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

  let moved = false;
  if (fs.existsSync(priv)) {
    fs.renameSync(priv, path.join(archiveDir, path.basename(priv)));
    moved = true;
    console.log(`Archived: ${kid}_private.pem`);
  }
  if (fs.existsSync(pub)) {
    fs.renameSync(pub, path.join(archiveDir, path.basename(pub)));
    moved = true;
    console.log(`Archived: ${kid}_public.pem`);
  }

  if (!moved) {
    console.warn(`No files found for kid='${kid}'. Nothing to revoke.`);
  } else {
    // Bust JWKS cache so old key disappears from published JWKS promptly
    try {
      await kv.clearJWKS();
      console.log("Cleared JWKS cache.");
    } catch {
      console.warn("Could not clear JWKS cache (Redis unavailable?).");
    }
  }
}

/* ---------------- CLI ---------------- */
if (require.main === module) {
  const [, , command, arg] = process.argv;
  (async () => {
    try {
      switch (command) {
        case "generate":
          generateKeyPair(arg || `auth-key-${Date.now()}`);
          break;
        case "rotate":
          if (!arg) throw new Error("Usage: rotate <newKid>");
          await rotateKey(arg);
          break;
        case "list":
          console.table(listKids());
          break;
        case "revoke":
          if (!arg) throw new Error("Usage: revoke <kid>");
          await revokeKey(arg);
          break;
        default:
          console.log("Usage: generate <kid> | rotate <kid> | list | revoke <kid>");
      }
    } catch (e: any) {
      console.error(e.message || e);
      process.exit(1);
    }
  })();
}
