// src/middleware/rateLimit.ts
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import crypto from "crypto";
import type { Request } from "express";
import { redis } from "../utils/redis";

const createStore = (prefix: string) =>
  process.env.RATE_LIMIT_USE_MEMORY === "true"
    ? undefined
    : new RedisStore({
        sendCommand: async (...args: string[]) => redis.sendCommand(args as any),
        prefix,
    });

const baseOpts = {
    standardHeaders: true,
    legacyHeaders: false,
};

const norm = (s?: string) => (s || "").trim().toLowerCase();
const hashToken = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const loginWasSuccessful = (_req: Request, res: any) => res.statusCode < 400;

// 1) per-IP
export const loginIpLimiter = rateLimit({
    ...baseOpts,
    store: createStore("rl:login:ip:"),
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: ipKeyGenerator, // <-- handles IPv6 correctly
    requestWasSuccessful: loginWasSuccessful,
    skipSuccessfulRequests: true,
    message: { message: "Too many login attempts from this IP. Try again later." },
});

// 2) per-account (fallback to IP)
export const loginAccountLimiter = rateLimit({
    ...baseOpts,
    store: createStore("rl:login:acct:"),
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => {
        const u = norm((req.body && (req.body.username || req.body.email)) as string);
        return u || `anon:${ipKeyGenerator(req)}`; // <-- IPv6-safe fallback
    },
    requestWasSuccessful: loginWasSuccessful,
    skipSuccessfulRequests: true,
    message: { message: "Too many login attempts for this account. Try again later." },
});

// 3) reset by email (fallback to IP)
export const resetLimiter = rateLimit({
    ...baseOpts,
    store: createStore("rl:reset:"),
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => {
        const email = norm(req.body?.email);
        return email || `ip:${ipKeyGenerator(req)}`;
    },
    message: "Too many reset attempts. Please try again later.",
});

// 4) refresh by token hash (fallback to IP)
export const refreshLimiter = rateLimit({
    ...baseOpts,
    store: createStore("rl:refresh:"),
    windowMs: 5 * 60 * 1000,
    max: 20,
    keyGenerator: (req) => {
        const raw = req.cookies?.refresh_token as string | undefined;
        return raw ? `rt:${hashToken(raw)}` : `ip:${ipKeyGenerator(req)}`;
    },
    message: "Too many refresh attempts. Please try again later.",
});