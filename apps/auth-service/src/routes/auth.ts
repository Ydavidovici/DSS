// src/routes/auth.ts
import { Router, Request, Response } from "express";
import axios from "axios";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { signAccessToken, signRefreshToken, verifyToken, getJWKS } from "../utils/jwt";
import { redis, kv } from "../utils/redis";
import { revokeToken, isRevoked } from "../utils/tokenBlacklist";
import { loginIpLimiter, loginAccountLimiter, resetLimiter, refreshLimiter } from "../middleware/rateLimit";
import { mailer } from "../utils/mailer";
import { requireAuth, AuthRequest } from "../middleware/requireAuth"; // ⬅️ use middleware

const router = Router();

const DB_SERVICE_URL = process.env.DB_SERVICE_URL!;
const JWT_ISSUER = (process.env.JWT_ISSUER || "").replace(/\/+$/, "");

// Cookie options (configurable for cross-site)
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE as "lax" | "strict" | "none" | undefined) || "lax";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const IS_PROD = process.env.NODE_ENV === "production";
const refreshCookieOpts = {
    httpOnly: true,
    secure: IS_PROD || COOKIE_SAMESITE === "none",
    sameSite: COOKIE_SAMESITE,
    maxAge: 7 * 24 * 3600 * 1000,
    path: "/",
    domain: COOKIE_DOMAIN,
} as const;

function appendQuery(url: string, params: Record<string, string | number | boolean | undefined>) {
    const u = new URL(url);
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined) continue;
        u.searchParams.set(k, String(v));
    }
    return u.toString();
}

/*******************
 *  Routes: User Lifecycle
 *******************/
// Registration (optionally accepts redirect_uri)
router.post("/register", async (req: Request, res: Response) => {
    const { username, password, email, redirect_uri } = req.body;
    if (!username || !password || !email) return res.status(400).send("Missing fields");
    try {
        const hash = await bcrypt.hash(password, 10);
        await axios.post(`${DB_SERVICE_URL}/users`, { username, password_hash: hash, email });

        // prepare verification token (longer TTL) and link
        let redir: string | undefined;
        if (redirect_uri && (await kv.isAllowedRedirect(redirect_uri))) {
            redir = redirect_uri;
        }
        const verifyToken = await signAccessToken({ sub: username, type: "email_verify", redir }, 24 * 3600);

        let link: string | null = null;
        if (JWT_ISSUER) {
            link = appendQuery(`${JWT_ISSUER}/verify-email`, { token: verifyToken });
        }

        await mailer.sendMail({
            to: email,
            subject: "Verify your email",
            text: link ? `Click to verify: ${link}` : `Your verification token: ${verifyToken}`,
        });

        res.status(201).send("User created. If the email is valid, a verification link was sent.");
    } catch (err: any) {
        res.status(500).send(err.message);
    }
});

// Email verification (handles optional redirect after success)
router.get("/verify-email", async (req: Request, res: Response) => {
    const token = req.query.token as string;
    try {
        const payload: any = await verifyToken(token);
        if (payload.type !== "email_verify") throw new Error("Wrong token type");

        await axios.patch(`${DB_SERVICE_URL}/users/${payload.sub}`, {
            verified: true,
            verified_at: new Date().toISOString(),
        });

        const redir = payload.redir as string | undefined;
        if (redir && (await kv.isAllowedRedirect(redir))) {
            return res.redirect(302, appendQuery(redir, { status: "verified" }));
        }
        res.send("Email verified.");
    } catch {
        res.status(400).send("Invalid or expired verification link.");
    }
});

// Forgot password (avoid user enumeration; optionally accepts redirect_uri)
router.post("/forgot-password", resetLimiter, async (req: Request, res: Response) => {
    const { email, redirect_uri } = req.body;
    try {
        const { data: user } = await axios.get(`${DB_SERVICE_URL}/users/email/${encodeURIComponent(email)}`);
        const resetToken = await signAccessToken({ sub: user.id, type: "password_reset" }, 3600);

        let bodyText = `Your password reset token: ${resetToken}`;
        if (redirect_uri && (await kv.isAllowedRedirect(redirect_uri))) {
            const link = appendQuery(redirect_uri, { token: resetToken });
            bodyText = `Reset your password: ${link}`;
        }

        await mailer.sendMail({ to: email, subject: "Reset your password", text: bodyText });
    } catch {
        // do nothing to avoid enumeration
    }
    res.send("If that email exists, we’ve sent reset instructions.");
});

// Reset password (revoke all sessions)
router.post("/reset-password", resetLimiter, async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).send("Missing fields");
    try {
        const payload: any = await verifyToken(token);
        if (payload.type !== "password_reset") throw new Error("Wrong token type");

        const hash = await bcrypt.hash(newPassword, 10);
        await axios.patch(`${DB_SERVICE_URL}/users/${payload.sub}`, { password_hash: hash });

        // Revoke all refresh sessions for this user
        const userId = String(payload.sub);
        const sessions = await kv.listUserSessions(userId);
        for (const oldJti of sessions) {
            const rk = `refresh:${oldJti}`;
            const ttl = await redis.ttl(rk);
            const exp = Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : 0);
            await revokeToken(oldJti, exp || Math.floor(Date.now() / 1000) + 24 * 3600);
            await redis.del(rk);
        }
        await kv.clearUserSessions(userId);

        res.send("Password has been reset.");
    } catch {
        res.status(400).send("Invalid or expired reset link.");
    }
});

/*******************
 *  Routes: Auth Flows
 *******************/
// Login (per-IP + per-account limiters)
router.post("/login", loginIpLimiter, loginAccountLimiter, async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Missing credentials" });
    try {
        const { data: user } = await axios.get(`${DB_SERVICE_URL}/users/${encodeURIComponent(username)}`);
        if (!user.verified) return res.status(403).send("Email not verified.");
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) throw new Error("Invalid");

        const accessToken = await signAccessToken({
            sub: user.id,
            roles: user.roles,
            preferred_username: user.username,
            email: user.email,
        });

        const jti = crypto.randomUUID();
        const refreshToken = await signRefreshToken(jti, String(user.id));
        await redis.set(`refresh:${jti}`, "1", { EX: 7 * 24 * 3600 });
        await kv.addUserSession(String(user.id), jti);

        res.cookie("refresh_token", refreshCookieOpts ? refreshToken : "", refreshCookieOpts).json({ accessToken });
    } catch {
        res.status(401).json({ message: "Invalid username or password." });
    }
});

// Token refresh (rotation with reuse detection)
router.post("/refresh", refreshLimiter, async (req: Request, res: Response) => {
    const token = req.cookies["refresh_token"];
    if (!token) return res.status(401).send("No refresh token.");
    try {
        const payload: any = await verifyToken(token);
        const { jti, sub, exp } = payload;
        if (!jti || !sub) throw new Error("Malformed");
        if (!(await redis.get(`refresh:${jti}`))) throw new Error("Missing allow key");
        if (await isRevoked(jti)) throw new Error("Revoked");

        await revokeToken(jti, exp as number);
        await redis.del(`refresh:${jti}`);
        await kv.removeUserSession(String(sub), jti);

        const newJti = crypto.randomUUID();
        const newRefresh = await signRefreshToken(newJti, String(sub));
        await redis.set(`refresh:${newJti}`, "1", { EX: 7 * 24 * 3600 });
        await kv.addUserSession(String(sub), newJti);

        const newAccess = await signAccessToken({
            sub,
            roles: payload.roles,
            preferred_username: payload.preferred_username,
            email: payload.email,
        });

        res.cookie("refresh_token", refreshCookieOpts ? newRefresh : "", refreshCookieOpts).json({ accessToken: newAccess });
    } catch {
        res.status(401).send("Invalid or expired refresh token.");
    }
});

// Logout / revoke refresh
router.post("/logout", async (req: Request, res: Response) => {
    const token = req.cookies["refresh_token"];
    if (token) {
        try {
            const payload: any = await verifyToken(token);
            const jti = payload.jti as string;
            const exp = payload.exp as number;
            const uid = String(payload.sub);
            await revokeToken(jti, exp);
            await redis.del(`refresh:${jti}`);
            await kv.removeUserSession(uid, jti);
        } catch {
            // ignore
        }
    }
    res.clearCookie("refresh_token", { path: "/", domain: COOKIE_DOMAIN }).send("Logged out.");
});

/*******************
 *  Routes: Introspection & OIDC
 *******************/
router.get("/verify", requireAuth(), async (req: AuthRequest, res: Response) => {
    const payload: any = req.user;
    if (payload?.jti && (await isRevoked(payload.jti as string))) {
        return res.status(401).json({ message: "Invalid or expired token." });
    }
    res.json({ user: payload });
});

router.get("/userinfo", requireAuth(), (req: AuthRequest, res: Response) => {
    const u: any = req.user;
    res.json({
        sub: u.sub,
        preferred_username: u.preferred_username,
        roles: u.roles,
        email: u.email,
    });
});

// JWKS & OIDC discovery (same router)
router.get("/.well-known/jwks.json", async (_req: Request, res: Response) => {
    try {
        let jwks = await kv.getJWKS();
        if (!jwks) {
            jwks = await getJWKS();
            await kv.setJWKS(jwks, 3600);
        }
        res.json(jwks);
    } catch {
        res.status(500).send("JWKS unavailable");
    }
});

router.get("/.well-known/openid-configuration", (_req: Request, res: Response) => {
    if (!JWT_ISSUER) return res.status(500).send("Issuer not configured");
    res.json({
        issuer: JWT_ISSUER,
        jwks_uri: `${JWT_ISSUER}/.well-known/jwks.json`,
        authorization_endpoint: `${JWT_ISSUER}/authorize`,
        token_endpoint: `${JWT_ISSUER}/token`,
        userinfo_endpoint: `${JWT_ISSUER}/userinfo`,
        response_types_supported: ["code", "token"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
    });
});

export default router;
