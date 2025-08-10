// src/utils/jwt.ts  (or whichever file the app really imports)
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import {
    SignJWT,
    jwtVerify,
    importPKCS8,
    importSPKI,
    exportJWK,
    JWTPayload,
    JWSHeaderParameters,
} from "jose";

type TokenKind = "access" | "refresh";

export interface JwtConfig {
    issuer: string;
    audience: string;
    accessTtlSec: number;
    refreshTtlSec: number;
    clockToleranceSec: number;
    jwksPath: string;   // baseline default
    activeKid: string;  // baseline default
}

const cfg: JwtConfig = {
    issuer: process.env.JWT_ISSUER ?? "dss-auth",
    audience: process.env.JWT_AUDIENCE ?? "dss-services",
    accessTtlSec: Number(process.env.ACCESS_TTL_SEC ?? 900),
    refreshTtlSec: Number(process.env.REFRESH_TTL_SEC ?? 1209600),
    clockToleranceSec: Number(process.env.JWT_CLOCK_TOLERANCE_SEC ?? 5),

    // sensible defaults for repo layout
    jwksPath: process.env.JWKS_PATH ?? path.resolve(process.cwd(), "src/keys"),
    activeKid: process.env.CURRENT_KID ?? "auth-key-1",
};

const keyMap = new Map<string, {
    kid: string;
    privateKey?: CryptoKey;
    publicKey?: CryptoKey;
    publicJwk?: any;
}>();

// helpers read env at runtime
const envKid = () => process.env.CURRENT_KID ?? cfg.activeKid;
const envJwksPath = () => process.env.JWKS_PATH ?? cfg.jwksPath;

async function loadKeysOnce() {
    if (keyMap.size) return;

    const jwksPath = envJwksPath();
    const files = await fs.readdir(jwksPath);
    const byKid: Record<string, any> = {};

    for (const file of files) {
        if (!file.endsWith(".pem")) continue;
        const pem = await fs.readFile(path.join(jwksPath, file), "utf8");
        const kid = file.replace(/_(private|public)\.pem$/, "");
        byKid[kid] ||= { kid };

        if (file.includes("_private.pem")) {
            byKid[kid].privateKey = await importPKCS8(pem, "RS256");
        } else if (file.includes("_public.pem")) {
            const pub = await importSPKI(pem, "RS256");
            byKid[kid].publicKey = pub;
            const jwk = await exportJWK(pub);
            byKid[kid].publicJwk = { ...jwk, kid, use: "sig", alg: "RS256" };
        }
    }

    for (const kid of Object.keys(byKid)) {
        const k = byKid[kid];
        if (!k.publicKey) throw new Error(`Missing public key for kid=${kid}`);
        keyMap.set(kid, k);
    }

    const activeKid = envKid();
    if (!keyMap.has(activeKid)) {
        const available = [...keyMap.keys()].join(", ") || "(none)";
        throw new Error(`Active kid '${activeKid}' not found in ${jwksPath}. Available: ${available}`);
    }
}

function assert(v: any, msg: string): asserts v {
    if (!v) throw new Error(msg);
}

export interface AccessClaims extends JWTPayload {
    typ: "access";
    sub: string;
    sessionId: string;
    scope?: string;
}

export interface RefreshClaims extends JWTPayload {
    typ: "refresh";
    sub: string;
    sessionId: string;
}

// add an options type
type SignOpts = { audience?: string; ttlSec?: number };

// change signature:
async function sign(
  kind: TokenKind,
  claims: JWTPayload & { sub: string; sessionId: string },
  opts: SignOpts = {}
) {
    await loadKeysOnce();
    const kid = envKid();
    const loaded = keyMap.get(kid)!;
    assert(loaded.privateKey, `No private key for active kid=${kid}`);

    const base = new SignJWT({ ...claims, typ: kind })
      .setProtectedHeader({ alg: "RS256", kid } as JWSHeaderParameters)
      .setIssuer(cfg.issuer)
      .setAudience(opts.audience ?? cfg.audience)   // <-- override-able audience
      .setSubject(claims.sub)
      .setIssuedAt();

    const ttl = opts.ttlSec ?? (kind === "access" ? cfg.accessTtlSec : cfg.refreshTtlSec);
    base.setExpirationTime(`${ttl}s`);
    return base.sign(loaded.privateKey!);
}

export async function signAccessToken(input: { userId: string; sessionId: string; scope?: string }) {
    return sign("access", { sub: input.userId, sessionId: input.sessionId, scope: input.scope });
}

export async function signRefreshToken(input: {
    userId: string;
    sessionId: string;
    jti?: string;
    carry?: {
        roles?: unknown[];
        preferred_username?: string;
        email?: string;
    };
}) {
    const jti = input.jti ?? randomUUID();
    return {
        token: await sign("refresh", {
            sub: input.userId,
            sessionId: input.sessionId,
            jti,
            ...(input.carry || {}),  // <— embed minimal claims for refresh -> access
        }),
        jti,
    };
}

export async function signServiceToken(params: {
    scope: string | string[];
    audience?: string;   // default: db-service
    azp?: string;        // default: auth-service
    ttlSec?: number;     // default: 60
}) {
    const scopeStr = Array.isArray(params.scope) ? params.scope.join(' ') : params.scope;
    const sessionId = randomUUID();
    return sign("access", {
        sub: "client_auth",
        sessionId,
        scope: scopeStr,
        azp: params.azp ?? "auth-service",
    }, { audience: params.audience ?? "db-service", ttlSec: params.ttlSec ?? 60 });
}

export async function signUserAccessToken(input: {
    userId: string;
    roles?: unknown[];
    preferred_username?: string;
    email?: string;
    scope?: string;
    audience?: string;   // leave undefined to use default user audience
    ttlSec?: number;
    extra?: Record<string, unknown>;
}) {
    return sign("access", {
        sub: input.userId,
        sessionId: randomUUID(),
        roles: input.roles,
        preferred_username: input.preferred_username,
        email: input.email,
        scope: input.scope,
        ...(input.extra || {}),
    }, { audience: input.audience, ttlSec: input.ttlSec });
}

export async function verifyToken<T extends JWTPayload>(token: string, expectedTyp: TokenKind = "access") {
    await loadKeysOnce();
    const { payload, protectedHeader } = await jwtVerify(
      token,
      async (header) => {
          const kid = header.kid;
          assert(kid, "Missing kid");
          const found = keyMap.get(kid);
          assert(found?.publicKey, `Unknown kid: ${kid}`);
          return found!.publicKey!;
      },
      { issuer: cfg.issuer, audience: cfg.audience, clockTolerance: cfg.clockToleranceSec }
    );

    assert((payload as any).typ === expectedTyp, "Unexpected token type");
    assert(typeof protectedHeader.kid === "string", "Invalid header.kid");
    return { payload: payload as T, headerKid: protectedHeader.kid! };
}

export async function getJWKS() {
    await loadKeysOnce();
    return { keys: Array.from(keyMap.values()).map(k => k.publicJwk).filter(Boolean) };
}

export const jwtConfig = cfg;