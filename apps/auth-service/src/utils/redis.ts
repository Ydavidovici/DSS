import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

export const redis = createClient({ url: process.env.REDIS_URL });

redis.on("error", (err) => console.error("[redis] error:", err));
redis.on("connect", () => console.log("[redis] connected"));
redis.connect().catch((e) => console.error("[redis] failed to connect:", e));

function asJSON<T>(raw: string | null): T | null {
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

function getOrigin(u: string): string | null {
    try {
        const url = new URL(u);
        return `${url.protocol}//${url.host}`;
    } catch {
        return null;
    }
}

export const kv = {
    // Generic JSON helpers
    async getJSON<T = any>(key: string): Promise<T | null> {
        const v = await redis.get(key);
        return asJSON<T>(v);
    },
    async setJSON(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
        const payload = JSON.stringify(value);
        if (ttlSeconds && ttlSeconds > 0) await redis.set(key, payload, { EX: ttlSeconds });
        else await redis.set(key, payload);
    },

    // JWKS cache
    async getJWKS<T = { keys: any[] }>(): Promise<T | null> {
        return this.getJSON<T>("jwks");
    },
    async setJWKS(jwks: unknown, ttlSeconds = 3600): Promise<void> {
        await this.setJSON("jwks", jwks, ttlSeconds);
    },
    // JWKS cache bust
    async clearJWKS(): Promise<void> {
        await redis.del("jwks");
    },


    // User sessions
    async addUserSession(userId: string, jti: string): Promise<void> {
        await redis.sAdd(`uid:${userId}:sessions`, jti);
    },
    async removeUserSession(userId: string, jti: string): Promise<void> {
        await redis.sRem(`uid:${userId}:sessions`, jti);
    },
    async listUserSessions(userId: string): Promise<string[]> {
        return await redis.sMembers(`uid:${userId}:sessions`);
    },
    async clearUserSessions(userId: string): Promise<void> {
        await redis.del(`uid:${userId}:sessions`);
    },

    // Redirect allowlist (per-frontend)
    async getAllowedRedirects(): Promise<string[]> {
        const members = await redis.sMembers("redirects:allow");
        if (members.length > 0) return members;

        // Bootstrap from env if Redis set is empty
        const envList = (process.env.ALLOWED_REDIRECTS || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

        if (envList.length) {
            await redis.sAdd("redirects:allow", envList);
            return envList;
        }
        return [];
    },

    async addAllowedRedirect(baseOriginOrBaseURL: string): Promise<void> {
        const origin = getOrigin(baseOriginOrBaseURL) ?? baseOriginOrBaseURL;
        await redis.sAdd("redirects:allow", origin);
    },

    async removeAllowedRedirect(baseOriginOrBaseURL: string): Promise<void> {
        const origin = getOrigin(baseOriginOrBaseURL) ?? baseOriginOrBaseURL;
        await redis.sRem("redirects:allow", origin);
    },

    async isAllowedRedirect(target: string): Promise<boolean> {
        const allowed = await this.getAllowedRedirects();
        if (allowed.length === 0) return false;

        // Compare by origin and prefix safety
        const origin = getOrigin(target);
        if (!origin) return false;

        // Allowed if exact origin matches, or the full URL starts with an allowed origin + '/'
        if (allowed.includes(origin)) return true;
        return allowed.some((base) => target.startsWith(base.endsWith("/") ? base : `${base}/`));
    },
};

export default redis;
