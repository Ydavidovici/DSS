import { redis } from "./redis";

/**
 * Check whether a given JWT ID (jti) has been revoked.
 * @param jti  the token’s JWT ID
 * @returns    true if blacklisted, false otherwise
 */
export async function isRevoked(jti: string): Promise<boolean> {
    return Boolean(await redis.get(`blacklist:${jti}`));
}

/**
 * Revoke a token by its JWT ID, storing it in Redis until it expires.
 * @param jti  the token’s JWT ID
 * @param exp  the token’s expiration time (unix seconds)
 */
export async function revokeToken(jti: string, exp: number): Promise<void> {
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
        await redis.set(`blacklist:${jti}`, "1", { EX: ttl });
    }
}
