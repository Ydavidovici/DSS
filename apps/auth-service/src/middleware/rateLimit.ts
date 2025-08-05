import rateLimit from "express-rate-limit";

// Limit login attempts: max 10 per 15 minutes
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { message: "Too many login attempts. Please try again later." }
});

// Limit password‐reset requests: max 5 per 15 minutes
export const resetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: "Too many reset attempts. Please try again later."
});

// Limit token‐refresh calls: max 20 per 5 minutes
export const refreshLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20,
    message: "Too many refresh attempts. Please try again later."
});
