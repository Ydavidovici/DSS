import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});


// src/middleware/rateLimit.ts
import rateLimit from "express-rate-limit";

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { message: "Too many login attempts. Please try again later." }
});

export const resetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many reset attempts. Please try again later."
});

export const refreshLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 20,
    message: "Too many refresh attempts. Please try again later."
});