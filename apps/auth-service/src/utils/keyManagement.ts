// src/utils/keyManagement.ts
import { generateKeyPairSync } from "crypto";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const ENV_PATH = process.env.ENV_FILE || path.resolve(process.cwd(), ".env");
const CURRENT_KID_ENV = "CURRENT_KID";
const DEFAULT_RSA_BITS = Number(process.env.RSA_MODULUS_BITS || 3072); // 3072 by default

// Always read keys dir from env so --dir can override at runtime
function keysDir() {
  return process.env.JWKS_PATH || path.resolve(process.cwd(), "src/keys");
}

// Strict kid whitelist to avoid path traversal and weird filenames
const KID_RE = /^[A-Za-z0-9._-]{1,64}$/;

function ensureKeysDir() {
  const dir = keysDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
}

function pathsForKid(kid: string) {
  if (!KID_RE.test(kid)) {
    throw new Error(`Invalid kid '${kid}'. Allowed: ${KID_RE}`);
  }
  const dir = keysDir();
  return {
    priv: path.join(dir, `${kid}_private.pem`),
    pub: path.join(dir, `${kid}_public.pem`),
  };
}

function readEnvLines(): string[] {
  if (!fs.existsSync(ENV_PATH)) return [];
  return fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
}

function writeEnvLines(lines: string[]) {
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
  try { fs.chmodSync(file, mode); } catch {}
}

/* ---------------- Redis/JWKS cache (lazy & optional) ---------------- */
async function clearJwksCacheIfPossible() {
  try {
    const { kv } = await import("./redis");
    if (kv?.clearJWKS) await kv.clearJWKS();
    console.log("Cleared JWKS cache.");
  } catch {
    // fine if Redis isn't available
  }
}

/* ---------------- Core ops ---------------- */
export function generateKeyPair(kid: string, opts?: { overwrite?: boolean; bits?: number }) {
  ensureKeysDir();
  const { priv, pub } = pathsForKid(kid);

  if (!opts?.overwrite) {
    if (fs.existsSync(priv) || fs.existsSync(pub)) {
      throw new Error(`Key files already exist for kid='${kid}'. Use -f/--overwrite if intended.`);
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

  console.log(`Generated key-pair kid='${kid}' (${modulusLength} bits) in ${keysDir()}`);
}

export async function rotateKey(newKid: string, opts?: { bits?: number }) {
  generateKeyPair(newKid, { bits: opts?.bits });
  setCurrentKid(newKid);
  console.log(`Rotated CURRENT_KID to '${newKid}'.`);
  await clearJwksCacheIfPossible();
}

export function listKids(): Array<{ kid: string; hasPrivate: boolean; hasPublic: boolean; active: boolean }> {
  const dir = keysDir();
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".pem"));
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

export async function revokeKey(kid: string) {
  const current = getCurrentKid();
  if (kid === current) {
    throw new Error(`Refusing to revoke CURRENT_KID='${kid}'. Rotate first, wait for token expiry, then revoke.`);
  }

  const { priv, pub } = pathsForKid(kid);
  const archiveDir = path.join(keysDir(), "archive");
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
    await clearJwksCacheIfPossible();
  }
}

/* ---------------- Tiny argv parser ---------------- */
type Flags = { overwrite?: boolean; bits?: number; dir?: string; setActive?: boolean; json?: boolean; };

function parseArgv(argv: string[]) {
  const args = [...argv];
  const flags: Flags = {};
  const positionals: string[] = [];
  while (args.length) {
    const a = args.shift()!;
    if (a === "--") { positionals.push(...args); break; }
    if (a === "-f" || a === "--overwrite") flags.overwrite = true;
    else if (a === "-s" || a === "--set-active") flags.setActive = true;
    else if (a === "--json") flags.json = true;
    else if (a === "-b" || a === "--bits") flags.bits = Number(args.shift());
    else if (a === "-d" || a === "--dir") flags.dir = args.shift();
    else if (a.startsWith("-")) throw new Error(`Unknown flag: ${a}`);
    else positionals.push(a);
  }
  const [cmd, kid] = positionals;
  return { cmd, kid, flags };
}

/* ---------------- CLI ---------------- */
if (require.main === module) {
  (async () => {
    try {
      const { cmd, kid, flags } = parseArgv(process.argv.slice(2));

      // Allow changing dir at runtime via --dir
      if (flags.dir) process.env.JWKS_PATH = flags.dir;

      switch (cmd) {
        case "help":
        case undefined:
          console.log(`
Usage:
  tsx src/utils/keyManagement.ts <command> [kid] [flags]

Commands:
  generate <kid>        Generate RSA keypair for <kid>.
  ensure <kid>          Generate only if missing.
  rotate  <kid>         Generate new keypair and set CURRENT_KID=<kid>.
  revoke  <kid>         Archive <kid> (move files to keys/archive). Won't revoke CURRENT_KID.
  set-active <kid>      Set CURRENT_KID in .env (no file changes).
  show-active           Print CURRENT_KID from .env.
  list                  List kids found in JWKS_PATH (or src/keys).
  jwks                  Print JWKS JSON returned by the service.

Flags:
  -f, --overwrite       Overwrite existing files on generate.
  -b, --bits <n>        RSA modulus bits (default env RSA_MODULUS_BITS or 3072).
  -d, --dir <path>      Keys directory (overrides JWKS_PATH for this run).
  -s, --set-active      Also set CURRENT_KID=<kid> in .env after generate/ensure.
      --json            For list/jwks, output JSON only.
`); process.exit(0);

        case "generate": {
          const name = kid || `auth-key-${Date.now()}`;
          generateKeyPair(name, { overwrite: !!flags.overwrite, bits: flags.bits });
          if (flags.setActive) { setCurrentKid(name); console.log(`Set CURRENT_KID=${name}`); }
          break;
        }

        case "ensure": {
          if (!kid) throw new Error("Usage: ensure <kid>");
          const { priv, pub } = pathsForKid(kid);
          const exists = fs.existsSync(priv) && fs.existsSync(pub);
          if (!exists) {
            generateKeyPair(kid, { overwrite: false, bits: flags.bits });
            console.log(`Created new keypair for '${kid}'.`);
          } else {
            console.log(`Keypair for '${kid}' already exists.`);
          }
          if (flags.setActive) { setCurrentKid(kid); console.log(`Set CURRENT_KID=${kid}`); }
          break;
        }

        case "rotate": {
          if (!kid) throw new Error("Usage: rotate <newKid>");
          await rotateKey(kid, { bits: flags.bits });
          break;
        }

        case "revoke": {
          if (!kid) throw new Error("Usage: revoke <kid>");
          await revokeKey(kid);
          break;
        }

        case "set-active": {
          if (!kid) throw new Error("Usage: set-active <kid>");
          setCurrentKid(kid);
          console.log(`Set CURRENT_KID=${kid}`);
          await clearJwksCacheIfPossible();
          break;
        }

        case "show-active": {
          const cur = getCurrentKid();
          console.log(cur ?? "(none)");
          break;
        }

        case "list": {
          const rows = listKids();
          if (flags.json) console.log(JSON.stringify(rows, null, 2));
          else console.table(rows);
          break;
        }

        case "jwks": {
          // Use the same util your server uses, to mirror behavior exactly
          const { getJWKS } = await import("../lib/jwt");
          const jwks = await getJWKS();
          console.log(JSON.stringify(jwks, null, 2));
          break;
        }

        default:
          throw new Error(`Unknown command: ${cmd}. Try "help".`);
      }
    } catch (e: any) {
      console.error(e?.message || e);
      process.exit(1);
    }
  })();
}