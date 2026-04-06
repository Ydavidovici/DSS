import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import {describe, it, expect, beforeAll, beforeEach, afterAll, mock} from "bun:test";

mock.module("../middleware/rateLimit", () => ({
    loginIpLimiter: (_request: any, _response: any, next: any) => next(),
    loginAccountLimiter: (_request: any, _response: any, next: any) => next(),
    resetLimiter: (_request: any, _response: any, next: any) => next(),
    refreshLimiter: (_request: any, _response: any, next: any) => next(),
}));

mock.module("../utils/mailer", () => ({
    mailer: {sendMail: mock().mockResolvedValue({})},
}));

const decodeJwtPayload = (token: string) => {
    const base64Url = token.split(".")[1] ?? "";
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(base64, "base64").toString());
};

describe("Authentication Flows", () => {
    let expressApp: express.Express;

    let fetchMock: ReturnType<typeof mock>;
    const originalFetch = global.fetch;

    beforeAll(async () => {
        process.env.DB_SERVICE_API_URL ||= "http://db-service:4000/api/v1";
        process.env.DB_SERVICE_BASE_URL ||= "http://db-service:4000";

        process.env.JWT_SECRET ||= "8f4e92a7b1c6d3f8e5a0b9c4d2e7f1a3b5c8d9e0f4a2b7c6d1e8f3a9b0c5d4e2";

        process.env.JWT_ISSUER = "dss-auth";
        process.env.JWT_AUDIENCE = "db-service";

        fetchMock = mock();
        global.fetch = fetchMock;

        const authRouter = (await import("../routes/auth")).default;

        expressApp = express();
        expressApp.use(express.json());
        expressApp.use(cookieParser());
        expressApp.use("/", authRouter);
    });

    beforeEach(async () => {
        const {mailer} = await import("../utils/mailer");

        (mailer.sendMail as any).mockClear();

        fetchMock.mockReset();
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    it("Register -> Creates user via db-service and sends verification email", async () => {
        const {mailer} = await import("../utils/mailer");

        fetchMock.mockResolvedValueOnce(new Response(
            JSON.stringify({data: {id: "u1"}}),
            {status: 201},
        ));

        const response = await request(expressApp)
        .post("/register")
        .send({
            username: "alice",
            password: "s3cretPassword",
            email: "alice@example.com",
        });

        expect(response.status).toBe(201);

        expect(response.text).toMatch(/User created/i);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];

        expect(url).toContain("/users");
        expect(options.method).toBe("POST");

        const authHeader = (options.headers as any)["Authorization"];
        expect(authHeader).toMatch(/^Bearer .+/);
        const tokenPayload = decodeJwtPayload(authHeader.split(" ")[1]);
        expect(tokenPayload.scope).toBe("users:create");

        const parsedBody = JSON.parse(options.body);
        expect(parsedBody.username).toBe("alice");
        expect(parsedBody.email).toBe("alice@example.com");
        expect(parsedBody.password_hash).toBeString();

        expect(mailer.sendMail).toHaveBeenCalledTimes(1);
        const sentEmail = (mailer.sendMail as any).mock.calls[0][0];
        expect(sentEmail.to).toBe("alice@example.com");
        expect(sentEmail.text).toContain("/verify-email?token=");
    });

    it("Login -> Fetches user by email, verifies password natively, sets cookies", async () => {
        const hashedPw = await Bun.password.hash("s3cretPassword");

        fetchMock.mockImplementationOnce(async (url: string, options?: any) => {
            if (url.includes("alice%40example.com")) {
                const authHeader = options?.headers?.Authorization;
                expect(authHeader).toMatch(/^Bearer .+/);

                const tokenPayload = decodeJwtPayload(authHeader.split(" ")[1]);
                expect(tokenPayload.scope).toBe("users:read");

                return new Response(JSON.stringify({
                    data: {id: "u1", username: "alice", email: "alice@example.com", verified: true, roles: ["user"], password_hash: hashedPw},
                }), {status: 200});
            }
            return new Response("Not Found", {status: 404});
        });

        const loginResponse = await request(expressApp)
        .post("/login")
        .send({email: "alice@example.com", password: "s3cretPassword"})
        .expect(200);

        expect(loginResponse.body).toHaveProperty("accessToken");

        const loginCookies = loginResponse.headers["set-cookie"] as unknown as string[];
        const refreshTokenCookie = loginCookies.find((cookie: string) => cookie.startsWith("refresh_token="));
        expect(refreshTokenCookie).toBeTruthy();
    });

    it("Login -> Returns 403 when db-service returns unverified user", async () => {
        const hashedPw = await Bun.password.hash("s3cretPassword");

        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
            data: {id: "u1", username: "alice", email: "alice@example.com", roles: [], verified: false, password_hash: hashedPw},
        }), {status: 200}));

        await request(expressApp)
        .post("/login")
        .send({email: "alice@example.com", password: "s3cretPassword"})
        .expect(403);
    });

    it("Login -> Returns 401 for wrong password", async () => {
        const hashedPw = await Bun.password.hash("s3cretPassword");

        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
            data: {id: "u1", username: "alice", email: "alice@example.com", verified: true, roles: [], password_hash: hashedPw},
        }), {status: 200}));

        await request(expressApp)
        .post("/login")
        .send({email: "alice@example.com", password: "wrongPassword"})
        .expect(401);
    });

    it("Login -> Maps db-service 401/error to generic 401 to prevent enumeration", async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ok: false}), {status: 401}));

        await request(expressApp)
        .post("/login")
        .send({email: "alice@example.com", password: "wrongPassword"})
        .expect(401);
    });

    it("Verify Email -> Happy path updates user", async () => {
        const {signUserAccessToken} = await import("../utils/jwt");

        fetchMock.mockResolvedValueOnce(new Response(null, {status: 200}));

        const verificationToken = await signUserAccessToken({
            userId: "u1",
            scope: "email_verify",
            ttlSec: 3600,
        });

        const response = await request(expressApp)
        .get("/verify-email")
        .query({token: verificationToken})
        .expect(200);

        expect(response.text).toMatch(/Email successfully verified/);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toContain("/users/u1");
        expect(options.method).toBe("PATCH");
        expect(JSON.parse(options.body).verified).toBe(true);

        const authHeader = (options.headers as any)["Authorization"];
        const tokenPayload = decodeJwtPayload(authHeader.split(" ")[1]);
        expect(tokenPayload.scope).toBe("users:update");
    });

    it("Reset Password -> Happy path patches DB", async () => {
        const {signUserAccessToken} = await import("../utils/jwt");

        fetchMock.mockResolvedValueOnce(new Response(null, {status: 200}));

        const passwordResetToken = await signUserAccessToken({
            userId: "u1",
            scope: "password_reset",
            ttlSec: 3600,
        });

        await request(expressApp)
        .post("/reset-password")
        .send({token: passwordResetToken, newPassword: "NewSecurePassword!@#"})
        .expect(200);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toContain("/users/u1");
        expect(options.method).toBe("PATCH");
        expect(JSON.parse(options.body).password_hash).toBeString();

        const authHeader = (options.headers as any)["Authorization"];
        const tokenPayload = decodeJwtPayload(authHeader.split(" ")[1]);
        expect(tokenPayload.scope).toBe("users:update");
    });

    it("Forgot Password -> Looks up user and sends reset link with redirect", async () => {
        const {mailer} = await import("../utils/mailer");

        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
            data: {id: "u9", email: "alice@example.com"},
        }), {status: 200}));

        const response = await request(expressApp)
        .post("/forgot-password")
        .send({email: "alice@example.com", redirect_uri: "https://app1.localhost:3000/reset"})
        .expect(200);

        expect(response.text).toMatch(/If that email exists/i);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toMatch(/\/users\/email\/alice%40example\.com$/);

        const authHeader = (options.headers as any)["Authorization"];
        const tokenPayload = decodeJwtPayload(authHeader.split(" ")[1]);
        expect(tokenPayload.scope).toBe("users:read");

        expect(mailer.sendMail).toHaveBeenCalledTimes(1);
        const emailMessage = (mailer.sendMail as any).mock.calls[0][0];
        expect(emailMessage.to).toBe("alice@example.com");
        expect(emailMessage.text).toMatch(/Reset your password:/);
        expect(emailMessage.text).toMatch(/token=/);
    });

    it("Forgot Password -> Enumeration-safe on unknown email (still 200, no mail)", async () => {
        const {mailer} = await import("../utils/mailer");

        fetchMock.mockResolvedValueOnce(new Response("Not Found", {status: 404}));

        const response = await request(expressApp)
        .post("/forgot-password")
        .send({email: "nobody@example.com", redirect_uri: "https://app1.localhost:3000/reset"})
        .expect(200);

        expect(response.text).toMatch(/If that email exists/i);
        expect(mailer.sendMail).not.toHaveBeenCalled();
    });

    it("Register -> Returns 400 for missing fields", async () => {
        await request(expressApp)
        .post("/register")
        .send({username: "alice"})
        .expect(400);
    });

    it("Register -> Returns 500 when db-service rejects", async () => {
        fetchMock.mockResolvedValueOnce(new Response("Conflict", {status: 409}));

        await request(expressApp)
        .post("/register")
        .send({username: "alice", password: "s3cretPassword", email: "alice@example.com"})
        .expect(500);
    });

    it("Verify Email -> Returns 400 for invalid token", async () => {
        await request(expressApp)
        .get("/verify-email")
        .query({token: "garbage.token.value"})
        .expect(400);
    });

    it("Verify Email -> Returns 400 when token has wrong scope", async () => {
        const {signUserAccessToken} = await import("../utils/jwt");

        const wrongScopeToken = await signUserAccessToken({
            userId: "u1",
            scope: "password_reset",
            ttlSec: 3600,
        });

        await request(expressApp)
        .get("/verify-email")
        .query({token: wrongScopeToken})
        .expect(400);
    });

    it("Reset Password -> Returns 400 for missing fields", async () => {
        await request(expressApp)
        .post("/reset-password")
        .send({token: "something"})
        .expect(400);
    });

    it("Reset Password -> Returns 400 when token has wrong scope", async () => {
        const {signUserAccessToken} = await import("../utils/jwt");

        const wrongScopeToken = await signUserAccessToken({
            userId: "u1",
            scope: "email_verify",
            ttlSec: 3600,
        });

        await request(expressApp)
        .post("/reset-password")
        .send({token: wrongScopeToken, newPassword: "NewPass123!"})
        .expect(400);
    });

    it("Login -> Returns 400 for missing credentials", async () => {
        await request(expressApp)
        .post("/login")
        .send({email: "alice@example.com"})
        .expect(400);
    });

    it("Login -> Returns 401 when user record has no password_hash", async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
            data: {id: "u1", username: "alice", email: "alice@example.com", verified: true, roles: []},
        }), {status: 200}));

        await request(expressApp)
        .post("/login")
        .send({email: "alice@example.com", password: "s3cretPassword"})
        .expect(401);
    });

    it("Refresh -> Returns 401 when no refresh cookie is present", async () => {
        await request(expressApp)
        .post("/refresh")
        .expect(401);
    });

    it("Refresh -> Returns 401 for an invalid refresh token", async () => {
        await request(expressApp)
        .post("/refresh")
        .set("Cookie", "refresh_token=invalid.token.here")
        .expect(401);
    });

    it("Logout -> Clears cookies and returns success", async () => {
        const response = await request(expressApp)
        .post("/logout")
        .expect(200);

        expect(response.text).toMatch(/logged out/i);

        const cookies = response.headers["set-cookie"] as unknown as string[];
        const clearedRefresh = cookies.find((c: string) => c.includes("refresh_token=;"));
        const clearedAccess = cookies.find((c: string) => c.includes("access_token=;"));
        expect(clearedRefresh).toBeTruthy();
        expect(clearedAccess).toBeTruthy();
    });

    it("Userinfo -> Returns user details for a valid token", async () => {
        const {signUserAccessToken} = await import("../utils/jwt");

        const token = await signUserAccessToken({
            userId: "u1",
            roles: ["user"],
            preferred_username: "alice",
            email: "alice@example.com",
        });

        const response = await request(expressApp)
        .get("/userinfo")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

        expect(response.body.sub).toBe("u1");
        expect(response.body.preferred_username).toBe("alice");
        expect(response.body.email).toBe("alice@example.com");
        expect(response.body.roles).toContain("user");
    });
});

describe("requireAuth Middleware", () => {
    let expressApp: express.Express;

    beforeAll(async () => {
        const {requireAuth} = await import("../middleware/requireAuth");

        expressApp = express();
        expressApp.use(express.json());
        expressApp.use(cookieParser());

        expressApp.get("/protected", requireAuth(), (req: any, res) => {
            res.json({user: req.user});
        });

        expressApp.get("/admin-only", requireAuth("admin"), (req: any, res) => {
            res.json({user: req.user});
        });
    });

    it("returns 401 when no token is provided", async () => {
        const response = await request(expressApp)
        .get("/protected")
        .expect(401);

        expect(response.body.message).toBe("Authentication required");
    });

    it("accepts a valid token from the Authorization header", async () => {
        const {signUserAccessToken} = await import("../utils/jwt");

        const token = await signUserAccessToken({
            userId: "u1",
            roles: ["user"],
            preferred_username: "alice",
            email: "alice@example.com",
        });

        const response = await request(expressApp)
        .get("/protected")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

        expect(response.body.user.sub).toBe("u1");
        expect(response.headers["x-user-id"]).toBe("u1");
        expect(response.headers["x-user-email"]).toBe("alice@example.com");
        expect(response.headers["x-user-roles"]).toBe("user");
        expect(response.headers["x-user-name"]).toBe("alice");
    });

    it("falls back to access_token cookie when no Authorization header", async () => {
        const {signUserAccessToken} = await import("../utils/jwt");

        const token = await signUserAccessToken({
            userId: "u2",
            roles: ["user"],
            preferred_username: "bob",
            email: "bob@example.com",
        });

        const response = await request(expressApp)
        .get("/protected")
        .set("Cookie", `access_token=${token}`)
        .expect(200);

        expect(response.body.user.sub).toBe("u2");
    });

    it("returns 401 for an invalid token", async () => {
        const response = await request(expressApp)
        .get("/protected")
        .set("Authorization", "Bearer invalid.token.here")
        .expect(401);

        expect(response.body.message).toBe("Invalid or expired token");
    });

    it("returns 403 when user lacks the required role", async () => {
        const {signUserAccessToken} = await import("../utils/jwt");

        const token = await signUserAccessToken({
            userId: "u3",
            roles: ["user"],
            preferred_username: "carol",
        });

        const response = await request(expressApp)
        .get("/admin-only")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);

        expect(response.body.message).toBe("Insufficient permissions");
    });

    it("passes when user has the required role", async () => {
        const {signUserAccessToken} = await import("../utils/jwt");

        const token = await signUserAccessToken({
            userId: "u4",
            roles: ["admin"],
            preferred_username: "dave",
        });

        await request(expressApp)
        .get("/admin-only")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
    });
});