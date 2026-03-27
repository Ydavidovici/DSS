import {Router, Request, Response} from "express";
import axios from "axios";
import bcrypt from "bcrypt";
import crypto from "crypto";
import {signUserAccessToken, signServiceToken, signRefreshToken, verifyToken} from "../utils/jwt";
import {loginIpLimiter, loginAccountLimiter, resetLimiter, refreshLimiter} from "../middleware/rateLimit";
import {mailer} from "../utils/mailer";
import {requireAuth, AuthRequest} from "../middleware/requireAuth";

const router = Router();

const DB_SERVICE_API_URL = process.env.DB_SERVICE_API_URL!;
const DB_SERVICE_BASE_URL = process.env.DB_SERVICE_BASE_URL!;
const JWT_ISSUER = (process.env.JWT_ISSUER || "").replace(/\/+$/, "");

const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE as "lax" | "strict" | "none" | undefined) || "lax";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const IS_PROD = process.env.NODE_ENV === "production";

const cookieOptions = {
    httpOnly: true,
    secure: IS_PROD || COOKIE_SAMESITE === "none",
    sameSite: COOKIE_SAMESITE,
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: "/",
    domain: COOKIE_DOMAIN,
} as const;

function appendQueryParameters(baseUrl: string, parameters: Record<string, string | number | boolean | undefined>) {
    const urlObject = new URL(baseUrl);
    for (const [key, value] of Object.entries(parameters)) {
        if (value !== undefined) {
            urlObject.searchParams.set(key, String(value));
        }
    }
    return urlObject.toString();
}

router.post("/register", async (req: Request, res: Response) => {
    const {username, password, email} = req.body;
    if (!username || !password || !email) {
        return res.status(400).send("Missing required fields.");
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const serviceToken = await signServiceToken({scope: "users:create"});

        const {data: responseBody} = await axios.post(
            `${DB_SERVICE_API_URL}/users`,
            {username, password_hash: passwordHash, email},
            {headers: {Authorization: `Bearer ${serviceToken}`}},
        );

        const createdUser = responseBody.data;

        const emailVerificationToken = await signUserAccessToken({
            userId: String(createdUser.id),
            scope: "email_verify",
            ttlSec: 24 * 3600,
        });

        const verificationLink = JWT_ISSUER
            ? appendQueryParameters(`${JWT_ISSUER}/verify-email`, {token: emailVerificationToken})
            : null;

        await mailer.sendMail({
            to: email,
            subject: "Verify your email",
            text: verificationLink
                ? `Click to verify: ${verificationLink}`
                : `Your verification token: ${emailVerificationToken}`,
        });

        res.status(201).send("User created. If the email is valid, a verification link was sent.");
    } catch (error: any) {
        res.status(500).send(error.message);
    }
});

router.get("/verify-email", async (req: Request, res: Response) => {
    const token = req.query.token as string;
    try {
        const {payload} = await verifyToken(token);
        if (payload.scope !== "email_verify") {
            throw new Error("Incorrect token type.");
        }

        const serviceToken = await signServiceToken({scope: "users:update"});
        await axios.patch(
            `${DB_SERVICE_API_URL}/users/${payload.sub}`,
            {verified: true, verified_at: new Date().toISOString()},
            {headers: {Authorization: `Bearer ${serviceToken}`}},
        );

        res.send("Email successfully verified.");
    } catch (error) {
        res.status(400).send("Invalid or expired verification link.");
    }
});

router.post("/forgot-password", resetLimiter, async (req: Request, res: Response) => {
    const {email, redirect_uri} = req.body;
    try {
        const serviceToken = await signServiceToken({scope: "users:read"});
        const {data: responseBody} = await axios.get(
            `${DB_SERVICE_API_URL}/users/email/${encodeURIComponent(email)}`,
            {headers: {Authorization: `Bearer ${serviceToken}`}},
        );

        const userRecord = responseBody.data;

        const passwordResetToken = await signUserAccessToken({
            userId: String(userRecord.id),
            scope: "password_reset",
            ttlSec: 3600,
        });

        let emailBodyText = `Your password reset token: ${passwordResetToken}`;
        if (redirect_uri) {
            const resetLink = appendQueryParameters(redirect_uri, {token: passwordResetToken});
            emailBodyText = `Reset your password: ${resetLink}`;
        }

        await mailer.sendMail({
            to: email,
            subject: "Reset your password",
            text: emailBodyText,
        });
    } catch (error) {}
    res.send("If that email exists in our system, we have sent reset instructions.");
});

router.post("/reset-password", resetLimiter, async (req: Request, res: Response) => {
    const {token, newPassword} = req.body;
    if (!token || !newPassword) {
        return res.status(400).send("Missing required fields.");
    }

    try {
        const {payload} = await verifyToken(token);
        if (payload.scope !== "password_reset") {
            throw new Error("Incorrect token type.");
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        const serviceToken = await signServiceToken({scope: "users:update"});

        await axios.patch(
            `${DB_SERVICE_API_URL}/users/${payload.sub}`,
            {password_hash: newPasswordHash},
            {headers: {Authorization: `Bearer ${serviceToken}`}},
        );

        res.send("Password has been successfully reset.");
    } catch (error) {
        res.status(400).send("Invalid or expired reset link.");
    }
});

router.post("/login", loginIpLimiter, loginAccountLimiter, async (req: Request, res: Response) => {
    const {email, password} = req.body;

    if (!email || !password) {
        return res.status(400).json({message: "Missing credentials."});
    }

    try {
        const serviceToken = await signServiceToken({scope: "users:read"});

        const {data: responseBody} = await axios.get(
            `${DB_SERVICE_API_URL}/users/email/${encodeURIComponent(email)}`,
            {headers: {Authorization: `Bearer ${serviceToken}`}},
        );

        const userRecord = responseBody.data;

        if (!userRecord || !userRecord.password_hash) {
            throw new Error("Invalid credentials.");
        }

        const isPasswordValid = await bcrypt.compare(password, userRecord.password_hash);
        if (!isPasswordValid) {
            throw new Error("Invalid credentials.");
        }

        if (userRecord.verified === false) {
            return res.status(403).send("Email address is not verified.");
        }

        const accessToken = await signUserAccessToken({
            userId: String(userRecord.id),
            roles: userRecord.roles,
            preferred_username: userRecord.username,
            email: userRecord.email,
        });

        const {token: refreshToken} = await signRefreshToken({
            userId: String(userRecord.id),
            sessionId: crypto.randomUUID(),
            carry: {
                roles: userRecord.roles,
                preferred_username: userRecord.username,
                email: userRecord.email,
            },
        });

        res.cookie("refresh_token", refreshToken, cookieOptions)
        .cookie("access_token", accessToken, cookieOptions)
        .json({accessToken});
    } catch (error: any) {
        console.log("=== LOGIN ERROR ===");
        if (error.response) {
            console.log("DB Service Status:", error.response.status);
            console.log("DB Service Data:", error.response.data);
        } else {
            console.log("Error Message:", error.message);
        }

        res.status(401).json({message: "Invalid email or password."});
    }
});

router.post("/refresh", refreshLimiter, async (req: Request, res: Response) => {
    const existingRefreshToken = req.cookies["refresh_token"];
    if (!existingRefreshToken) {
        return res.status(401).send("No refresh token provided.");
    }

    try {
        const {payload} = await verifyToken(existingRefreshToken, "refresh");

        if (!payload.sub) {
            throw new Error("Malformed token payload.");
        }

        const newAccessToken = await signUserAccessToken({
            userId: String(payload.sub),
            roles: (payload as any).roles,
            preferred_username: (payload as any).preferred_username,
            email: (payload as any).email,
        });

        res.cookie("access_token", newAccessToken, cookieOptions)
        .json({accessToken: newAccessToken});
    } catch (error) {
        res.status(401).send("Invalid or expired refresh token.");
    }
});

router.post("/logout", async (req: Request, res: Response) => {
    res.clearCookie("refresh_token", {path: "/", domain: COOKIE_DOMAIN})
    .clearCookie("access_token", {path: "/", domain: COOKIE_DOMAIN})
    .send("Successfully logged out.");
});

router.get("/verify", requireAuth(), async (req: AuthRequest, res: Response) => {
    const authenticatedUser = req.user;
    res.json({user: authenticatedUser});
});

router.get("/userinfo", requireAuth(), (req: AuthRequest, res: Response) => {
    const authenticatedUser: any = req.user;
    res.json({
        sub: authenticatedUser.sub,
        preferred_username: authenticatedUser.preferred_username,
        roles: authenticatedUser.roles,
        email: authenticatedUser.email,
    });
});

export default router;