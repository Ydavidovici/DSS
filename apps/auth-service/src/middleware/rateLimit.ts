import {rateLimit} from "express-rate-limit";
import type {Request, Response} from "express";

const baseRateLimitOptions = {
    standardHeaders: true,
    legacyHeaders: false,
};

const normalizeString = (inputString?: string) => (inputString || "").trim().toLowerCase();

const hashToken = (tokenString: string) => {
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(tokenString);
    return hasher.digest("hex");
};

const loginWasSuccessful = (_req: Request, res: Response | any) => res.statusCode < 400;

const getClientIpAddress = (req: Request) => req.ip || "127.0.0.1";

export const loginIpLimiter = rateLimit({
    ...baseRateLimitOptions,
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 10,
    requestWasSuccessful: loginWasSuccessful,
    skipSuccessfulRequests: true,
    message: {message: "Too many login attempts from this IP. Try again later."},
});

export const loginAccountLimiter = rateLimit({
    ...baseRateLimitOptions,
    windowMs: 15 * 60 * 1000,
    limit: 10,
    keyGenerator: (req) => {
        const usernameOrEmail = normalizeString((req.body && (req.body.username || req.body.email)) as string);
        return usernameOrEmail || `anonymousUser:${getClientIpAddress(req)}`;
    },
    requestWasSuccessful: loginWasSuccessful,
    skipSuccessfulRequests: true,
    message: {message: "Too many login attempts for this account. Try again later."},
});

export const resetLimiter = rateLimit({
    ...baseRateLimitOptions,
    windowMs: 15 * 60 * 1000,
    limit: 5,
    keyGenerator: (req) => {
        const normalizedEmail = normalizeString(req.body?.email);
        return normalizedEmail || `ipAddress:${getClientIpAddress(req)}`;
    },
    message: "Too many reset attempts. Please try again later.",
});

export const refreshLimiter = rateLimit({
    ...baseRateLimitOptions,
    windowMs: 5 * 60 * 1000, // 5 minutes
    limit: 20,
    keyGenerator: (req) => {
        const providedRefreshToken = req.cookies?.refresh_token as string | undefined;
        return providedRefreshToken
            ? `refreshToken:${hashToken(providedRefreshToken)}`
            : `ipAddress:${getClientIpAddress(req)}`;
    },
    message: "Too many refresh attempts. Please try again later.",
});