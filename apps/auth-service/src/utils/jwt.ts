import fs from "fs/promises";
import path from "path";
import { JWK, SignJWT, jwtVerify, exportJWK, JWTPayload } from "jose";
import dotenv from "dotenv";

dotenv.config();

const JWKS_PATH = process.env.JWKS_PATH || path.resolve(__dirname, "../../keys");
const currentKid = process.env.CURRENT_KID || "auth-key-1";

// Load and cache keys
const keyFiles = await fs.readdir(JWKS_PATH);
const keyMap: Record<string, { privateJwk: JWK; publicJwk: JWK }> = {};
for (const file of keyFiles) {
    if (!file.endsWith(".pem")) continue;
    const pem = await fs.readFile(path.resolve(JWKS_PATH, file), "utf8");
    const isPrivate = file.includes("private");
    const kid = file.replace(/_private\.pem|_public\.pem/, "");
    const jwk = JWK.asKey(pem, { use: "sig", alg: "RS256", kid });
    keyMap[kid] = keyMap[kid] || ({} as any);
    if (isPrivate) keyMap[kid].privateJwk = jwk;
    else keyMap[kid].publicJwk = jwk;
}

// JWKS export
export const JWKS = { keys: Object.values(keyMap).map(k => exportJWK(k.publicJwk)) };

// Sign short-lived access token (15m)
export function signAccessToken(payload: object): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ ...payload, iat: now, exp: now + 60 * 15 })
        .setProtectedHeader({ alg: "RS256", kid: currentKid })
        .sign(keyMap[currentKid].privateJwk);
}

// Sign long-lived refresh token (7d)
export function signRefreshToken(jti: string, sub: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ jti, sub, iat: now, exp: now + 60 * 60 * 24 * 7 })
        .setProtectedHeader({ alg: "RS256", kid: currentKid })
        .sign(keyMap[currentKid].privateJwk);
}

// Verify token
export async function verifyToken(token: string): Promise<JWTPayload> {
    const { payload } = await jwtVerify(token, keyMap[currentKid].publicJwk, {
        algorithms: ["RS256"],
    });
    return payload as JWTPayload;
}


// src/utils/tokenBlacklist.ts
import { redis } from "./redis";

export async function isRevoked(jti: string): Promise<boolean> {
    return Boolean(await redis.get(`blacklist:${jti}`));
}

export async function revokeToken(jti: string, exp: number): Promise<void> {
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
        await redis.set(`blacklist:${jti}`, "1", { EX: ttl });
    }
}