import {rateLimit} from "express-rate-limit";
import {RedisStore} from "rate-limit-redis";
import crypto from "crypto";
import type {Request} from "express";
import {redis} from "../utils/redis";

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

const getIp = (req: Request) => req.ip || "127.0.0.1";

export const loginIpLimiter = rateLimit({
    ...baseOpts,
    store: createStore("rl:login:ip:"),
    windowMs: 15 * 60 * 1000,
    limit: 10, // Note: v8 uses 'limit', 'max' is deprecated
    requestWasSuccessful: loginWasSuccessful,
    skipSuccessfulRequests: true,
    message: {message: "Too many login attempts from this IP. Try again later."},
});

export const loginAccountLimiter = rateLimit({
    ...baseOpts,
    store: createStore("rl:login:acct:"),
    windowMs: 15 * 60 * 1000,
    limit: 10,
    keyGenerator: (req) => {
        const u = norm((req.body && (req.body.username || req.body.email)) as string);
        return u || `anon:${getIp(req)}`; // Fallback to raw IP
    },
    requestWasSuccessful: loginWasSuccessful,
    skipSuccessfulRequests: true,
    message: {message: "Too many login attempts for this account. Try again later."},
});

export const resetLimiter = rateLimit({
    ...baseOpts,
    store: createStore("rl:reset:"),
    windowMs: 15 * 60 * 1000,
    limit: 5,
    keyGenerator: (req) => {
        const email = norm(req.body?.email);
        return email || `ip:${getIp(req)}`;
    },
    message: "Too many reset attempts. Please try again later.",
});

export const refreshLimiter = rateLimit({
    ...baseOpts,
    store: createStore("rl:refresh:"),
    windowMs: 5 * 60 * 1000,
    limit: 20,
    keyGenerator: (req) => {
        const raw = req.cookies?.refresh_token as string | undefined;
        return raw ? `rt:${hashToken(raw)}` : `ip:${getIp(req)}`;
    },
    message: "Too many refresh attempts. Please try again later.",
});