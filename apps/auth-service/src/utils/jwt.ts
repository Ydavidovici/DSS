// src/lib/jwt.ts
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
    jwksPath: string;
    activeKid: string;
}

const cfg: JwtConfig = {
    issuer: process.env.JWT_ISSUER ?? "dss-auth",
    audience: process.env.JWT_AUDIENCE ?? "dss-services",
    accessTtlSec: Number(process.env.ACCESS_TTL_SEC ?? 900),       // 15m
    refreshTtlSec: Number(process.env.REFRESH_TTL_SEC ?? 1209600),  // 14d
    clockToleranceSec: Number(process.env.JWT_CLOCK_TOLERANCE_SEC ?? 5),
    jwksPath: process.env.JWKS_PATH ?? path.resolve(process.cwd(), "keys"),
    activeKid: process.env.CURRENT_KID ?? "auth-key-1",
};

type LoadedKey = {
    kid: string;
    privateKey?: CryptoKey;
    publicKey?: CryptoKey;
    publicJwk?: any;
};

const keyMap = new Map<string, LoadedKey>();

async function loadKeysOnce() {
    if (keyMap.size) return;

    const files = await fs.readdir(cfg.jwksPath);
    // Expect files like: <kid>_private.pem and <kid>_public.pem
    const byKid: Record<string, Partial<LoadedKey>> = {};

    for (const file of files) {
        if (!file.endsWith(".pem")) continue;
        const pem = await fs.readFile(path.join(cfg.jwksPath, file), "utf8");
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
        keyMap.set(kid, k as LoadedKey);
    }

    if (!keyMap.has(cfg.activeKid)) {
        throw new Error(`Active kid '${cfg.activeKid}' not found in ${cfg.jwksPath}`);
    }
}

export async function getActiveKid() {
    await loadKeysOnce();
    return cfg.activeKid;
}

function assert(val: any, msg: string): asserts val {
    if (!val) throw new Error(msg);
}

export interface AccessClaims extends JWTPayload {
    typ: "access";
    sub: string;              // user id
    sessionId: string;
    scope?: string;           // space-delimited
}

export interface RefreshClaims extends JWTPayload {
    typ: "refresh";
    sub: string;              // user id
    sessionId: string;
}

async function sign(kind: TokenKind, claims: JWTPayload & { sub: string; sessionId: string }) {
    await loadKeysOnce();
    const kid = cfg.activeKid;
    const loaded = keyMap.get(kid)!;
    assert(loaded.privateKey, `No private key for active kid=${kid}`);

    const base = new SignJWT({ ...claims, typ: kind })
        .setProtectedHeader({ alg: "RS256", kid } as JWSHeaderParameters)
        .setIssuer(cfg.issuer)
        .setAudience(cfg.audience)
        .setSubject(claims.sub)
        .setIssuedAt();

    if (kind === "access") {
        base.setExpirationTime(`${cfg.accessTtlSec}s`);
    } else {
        base.setExpirationTime(`${cfg.refreshTtlSec}s`);
    }
    return base.sign(loaded.privateKey!);
}

export async function signAccessToken(input: {
    userId: string;
    sessionId: string;
    scope?: string;
}) {
    return sign("access", {
        sub: input.userId,
        sessionId: input.sessionId,
        scope: input.scope,
    });
}

export async function signRefreshToken(input: {
    userId: string;
    sessionId: string;
    jti?: string; // allow caller to pass the stored jti
}) {
    const jti = input.jti ?? randomUUID();
    return {
        token: await sign("refresh", {
            sub: input.userId,
            sessionId: input.sessionId,
            jti,
        }),
        jti,
    };
}

export async function verifyToken<T extends JWTPayload>(
    token: string,
    expectedTyp: TokenKind
): Promise<{ payload: T; headerKid: string }> {
    await loadKeysOnce();

    const { payload, protectedHeader } = await jwtVerify(token, async (header) => {
        const kid = header.kid;
        assert(kid, "Missing kid");
        const found = kid && keyMap.get(kid);
        assert(found?.publicKey, `Unknown kid: ${kid}`);
        return found!.publicKey!;
    }, {
        issuer: cfg.issuer,
        audience: cfg.audience,
        clockTolerance: cfg.clockToleranceSec,
    });

    assert((payload as any).typ === expectedTyp, "Unexpected token type");
    assert(typeof protectedHeader.kid === "string", "Invalid header.kid");

    return { payload: payload as T, headerKid: protectedHeader.kid! };
}

export async function getJWKS() {
    await loadKeysOnce();
    return {
        keys: Array.from(keyMap.values())
            .map(k => k.publicJwk)
            .filter(Boolean),
    };
}

export const jwtConfig = cfg;
