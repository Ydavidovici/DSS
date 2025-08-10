import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import crypto from "crypto";
import type { Request } from "express";
import { redis } from "../utils/redis";

// ----- shared store (falls back to in-memory if Redis unavailable) -----
const store = process.env.RATE_LIMIT_USE_MEMORY === "true"
    ? undefined
    : new RedisStore({
        // reuse your existing client; rate-limit-redis wants a sendCommand fn
        sendCommand: async (...args: string[]) => redis.sendCommand(args as any),
    });

// Helpful defaults
const baseOpts = {
    standardHeaders: true,
    legacyHeaders: false,
    store,
};

// ---------- Helpers ----------
function norm(s?: string) {
    return (s || "").trim().toLowerCase();
}

function hashToken(s: string) {
    return crypto.createHash("sha256").update(s).digest("hex");
}

function loginWasSuccessful(_req: Request, res: any) {
    // Treat 2xx as success; count only failed attempts
    return res.statusCode < 400;
}

// ---------- Limiters ----------

// 1) Login: per-IP limiter
export const loginIpLimiter = rateLimit({
    ...baseOpts,
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.ip,
    requestWasSuccessful: loginWasSuccessful,
    skipSuccessfulRequests: true,
    message: { message: "Too many login attempts from this IP. Try again later." },
});

// 2) Login: per-account limiter (username/email)
export const loginAccountLimiter = rateLimit({
    ...baseOpts,
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => {
        const u = norm((req.body && (req.body.username || req.body.email)) as string);
        return u || `anon:${req.ip}`;
    },
    requestWasSuccessful: loginWasSuccessful,
    skipSuccessfulRequests: true,
    message: { message: "Too many login attempts for this account. Try again later." },
});

// 3) Forgot/password-reset request: throttle by email (falls back to IP)
export const resetLimiter = rateLimit({
    ...baseOpts,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    keyGenerator: (req) => {
        const email = norm(req.body?.email);
        return email || `ip:${req.ip}`;
    },
    message: "Too many reset attempts. Please try again later.",
});

// 4) Refresh: throttle by refresh token (hash) with IP fallback
export const refreshLimiter = rateLimit({
    ...baseOpts,
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20,
    keyGenerator: (req) => {
        const raw = req.cookies?.refresh_token as string | undefined;
        return raw ? `rt:${hashToken(raw)}` : `ip:${req.ip}`;
    },
    message: "Too many refresh attempts. Please try again later.",
});
