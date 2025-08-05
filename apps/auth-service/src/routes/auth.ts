// src/routes/auth.ts
import { Router, Request, Response } from "express";
import axios from "axios";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { signAccessToken, signRefreshToken, verifyToken } from "../utils/jwt";
import { redis } from "../utils/redis";
import { revokeToken, isRevoked } from "../utils/tokenBlacklist";
import { loginLimiter, resetLimiter, refreshLimiter } from "../middleware/rateLimit";
import { mailer } from "../utils/mailer";

const router = Router();
const DB_SERVICE_URL = process.env.DB_SERVICE_URL!;
const FRONTEND_URL = process.env.FRONTEND_URL!;

/*******************
 *  Routes: User Lifecycle
 *******************/
// Registration
router.post(
    "/register",
    async (req: Request, res: Response) => {
        const { username, password, email } = req.body;
        if (!username || !password || !email) return res.status(400).send("Missing fields");
        try {
            const hash = await bcrypt.hash(password, 10);
            // create user in DB-service
            await axios.post(
                `${DB_SERVICE_URL}/users`,
                { username, password_hash: hash, email }
            );
            // send verification email
            const verifyToken = await signAccessToken({ sub: username, type: "email_verify" });
            const link = `${FRONTEND_URL}/verify-email?token=${verifyToken}`;
            await mailer.sendMail({
                to: email,
                subject: "Verify your email",
                text: `Click to verify: ${link}`
            });
            res.status(201).send("User created. Verification email sent.");
        } catch (err: any) {
            res.status(500).send(err.message);
        }
    }
);

// Email verification
router.get(
    "/verify-email",
    async (req: Request, res: Response) => {
        const token = req.query.token as string;
        try {
            const payload = await verifyToken(token);
            if (payload.type !== "email_verify") throw new Error();
            await axios.patch(
                `${DB_SERVICE_URL}/users/${payload.sub}`,
                { verified: true }
            );
            res.send("Email verified.");
        } catch {
            res.status(400).send("Invalid or expired verification link.");
        }
    }
);

// Forgot password
router.post(
    "/forgot-password",
    resetLimiter,
    async (req: Request, res: Response) => {
        const { email } = req.body;
        try {
            const { data: user } = await axios.get(
                `${DB_SERVICE_URL}/users/email/${encodeURIComponent(email)}`
            );
            const resetToken = await signAccessToken({ sub: user.id, type: "password_reset" });
            const link = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
            await mailer.sendMail({
                to: email,
                subject: "Reset your password",
                text: `Reset: ${link}`
            });
            res.send("Password reset email sent.");
        } catch {
            res.status(404).send("Email not found.");
        }
    }
);

// Reset password
router.post(
    "/reset-password",
    resetLimiter,
    async (req: Request, res: Response) => {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).send("Missing fields");
        try {
            const payload = await verifyToken(token);
            if (payload.type !== "password_reset") throw new Error();
            const hash = await bcrypt.hash(newPassword, 10);
            await axios.patch(
                `${DB_SERVICE_URL}/users/${payload.sub}`,
                { password_hash: hash }
            );
            res.send("Password has been reset.");
        } catch {
            res.status(400).send("Invalid or expired reset link.");
        }
    }
);

/*******************
 *  Routes: Auth Flows
 *******************/
// Login
router.post(
    "/login",
    loginLimiter,
    async (req: Request, res: Response) => {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: "Missing credentials" });
        try {
            const { data: user } = await axios.get(
                `${DB_SERVICE_URL}/users/${encodeURIComponent(username)}`
            );
            if (!user.verified) return res.status(403).send("Email not verified.");
            const valid = await bcrypt.compare(password, user.password_hash);
            if (!valid) throw new Error();
            const accessToken = await signAccessToken({ sub: user.id, roles: user.roles });
            const jti = crypto.randomUUID();
            const refreshToken = await signRefreshToken(jti, user.id);
            // store valid refresh jti
            await redis.set(`refresh:${jti}`, '1', { EX: 7 * 24 * 3600 });
            // send refresh in HttpOnly cookie
            res
                .cookie('refresh_token', refreshToken, {
                    httpOnly: true,
                    secure: true,
                    maxAge: 7 * 24 * 3600 * 1000
                })
                .json({ accessToken });
        } catch {
            res.status(401).json({ message: "Invalid username or password." });
        }
    }
);

// Token refresh
router.post(
    "/refresh",
    refreshLimiter,
    async (req: Request, res: Response) => {
        const token = req.cookies['refresh_token'];
        if (!token) return res.status(401).send("No refresh token.");
        try {
            const payload = await verifyToken(token);
            const { jti, sub, exp } = payload as any;
            if (!await redis.get(`refresh:${jti}`)) throw new Error();
            if (await isRevoked(jti)) throw new Error();
            // rotate
            await revokeToken(jti, exp as number);
            const newJti = crypto.randomUUID();
            const newRefresh = await signRefreshToken(newJti, sub as string);
            await redis.set(`refresh:${newJti}`, '1', { EX: 7 * 24 * 3600 });
            const newAccess = await signAccessToken({ sub, roles: payload.roles });
            res
                .cookie('refresh_token', newRefresh, {
                    httpOnly: true,
                    secure: true,
                    maxAge: 7 * 24 * 3600 * 1000
                })
                .json({ accessToken: newAccess });
        } catch {
            res.status(401).send("Invalid or expired refresh token.");
        }
    }
);

// Logout / revoke refresh
router.post(
    "/logout",
    async (_req: Request, res: Response) => {
        const token = _req.cookies['refresh_token'];
        if (token) {
            try {
                const payload = await verifyToken(token);
                const jti = payload.jti as string;
                const exp = payload.exp as number;
                await revokeToken(jti, exp);
            } catch {}
        }
        res.clearCookie('refresh_token').send("Logged out.");
    }
);

/*******************
 *  Routes: Introspection & OIDC
 *******************/
// Token introspection
router.get(
    "/verify",
    async (req: Request, res: Response) => {
        const auth = req.headers.authorization;
        if (!auth?.startsWith("Bearer ")) return res.status(401).json({ message: "Missing token." });
        try {
            const payload = await verifyToken(auth.slice(7));
            if (await isRevoked(payload.jti as string)) throw new Error();
            res.json({ user: payload });
        } catch {
            res.status(401).json({ message: "Invalid or expired token." });
        }
    }
);

// OIDC userinfo
router.get(
    "/userinfo",
    async (req: Request, res: Response) => {
        const auth = req.headers.authorization;
        try {
            const payload = await verifyToken(auth?.slice(7) || '');
            res.json({ sub: payload.sub, username: payload.username, roles: payload.roles });
        } catch {
            res.status(401).send('Unauthorized');
        }
    }
);

export default router;
