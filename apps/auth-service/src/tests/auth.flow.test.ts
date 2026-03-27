import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import {describe, it, expect, beforeAll, beforeEach, vi} from "vitest";

const axiosMock = {get: vi.fn(), post: vi.fn(), patch: vi.fn()};
vi.mock("axios", () => ({default: axiosMock}));

vi.mock("../middleware/rateLimit", () => ({
    loginIpLimiter: (_request: any, _response: any, next: any) => next(),
    loginAccountLimiter: (_request: any, _response: any, next: any) => next(),
    resetLimiter: (_request: any, _response: any, next: any) => next(),
    refreshLimiter: (_request: any, _response: any, next: any) => next(),
}));

vi.mock("../utils/jwt", () => {
    const tokenStore = new Map<string, any>();
    const generateMockTokenString = (prefix: string) =>
        `${prefix}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

    const signServiceToken = vi.fn(async (_input: any) => "svc-token");

    const signUserAccessToken = vi.fn(async (input: any) => {
        const tokenString = generateMockTokenString("access");
        const currentTime = Math.floor(Date.now() / 1000);
        const tokenPayload = {
            sub: String(input.userId),
            roles: input.roles ?? [],
            preferred_username: input.preferred_username,
            email: input.email,
            scope: input.scope,
            typ: "access",
            iat: currentTime,
            exp: currentTime + (input.ttlSec ?? 900),
        };
        tokenStore.set(tokenString, tokenPayload);
        return tokenString;
    });

    const signRefreshToken = vi.fn(async (input: any) => {
        const tokenString = generateMockTokenString("refresh");
        const currentTime = Math.floor(Date.now() / 1000);
        const tokenPayload = {
            sub: String(input.userId),
            jti: input.jti ?? generateMockTokenString("jti"),
            sessionId: input.sessionId,
            roles: input.carry?.roles ?? [],
            preferred_username: input.carry?.preferred_username,
            email: input.carry?.email,
            typ: "refresh",
            iat: currentTime,
            exp: currentTime + (input.ttlSec ?? 7 * 24 * 3600),
        };
        tokenStore.set(tokenString, tokenPayload);
        return {token: tokenString};
    });

    const verifyToken = vi.fn(async (tokenString: string, expectedType: "access" | "refresh" = "access") => {
        const payload = tokenStore.get(tokenString);
        if (!payload) {
            throw new Error("Unknown token");
        }
        if (expectedType && payload.typ !== expectedType) {
            throw new Error("Incorrect token type");
        }
        const currentTime = Math.floor(Date.now() / 1000);
        if (typeof payload.exp === "number" && payload.exp <= currentTime) {
            throw new Error("Expired token");
        }
        return {payload};
    });

    return {signServiceToken, signUserAccessToken, signRefreshToken, verifyToken};
});

vi.mock("../utils/mailer", () => ({
    mailer: {sendMail: vi.fn().mockResolvedValue({})},
}));

describe("Authentication Flows (Mocked DB Service & JWT)", () => {
    let expressApp: express.Express;

    beforeAll(async () => {
        process.env.DB_SERVICE_API_URL ||= "http://db-service:4000/api/v1";
        process.env.DB_SERVICE_BASE_URL ||= "http://db-service:4000";
        process.env.JWT_ISSUER ||= "https://issuer.test";

        const authRouter = (await import("../routes/auth")).default;

        expressApp = express();
        expressApp.use(express.json());
        expressApp.use(cookieParser());
        expressApp.use("/", authRouter);
    });

    beforeEach(() => {
        vi.clearAllMocks();
        axiosMock.get.mockReset();
        axiosMock.post.mockReset();
        axiosMock.patch.mockReset();
    });

    it("Register -> Creates user via db-service and sends verification email", async () => {
        const {mailer} = await import("../utils/mailer");
        const {signServiceToken} = await import("../utils/jwt");

        axiosMock.post.mockResolvedValueOnce({status: 201, data: {data: {id: "u1"}}});

        const response = await request(expressApp)
        .post("/register")
        .send({
            username: "alice",
            password: "s3cretPassword",
            email: "alice@example.com",
        })
        .expect(201);

        expect(response.text).toMatch(/User created/i);

        expect(axiosMock.post).toHaveBeenCalledWith(
            expect.stringContaining("/users"),
            expect.objectContaining({
                username: "alice",
                email: "alice@example.com",
                password_hash: expect.any(String),
            }),
            expect.objectContaining({
                headers: expect.objectContaining({Authorization: "Bearer svc-token"}),
            }),
        );

        expect((signServiceToken as any).mock.calls.some(([arguments_]: any[]) => arguments_?.scope === "users:create")).toBe(true);

        expect(mailer.sendMail).toHaveBeenCalledTimes(1);
        const sentEmail = (mailer.sendMail as any).mock.calls[0][0];
        expect(sentEmail.to).toBe("alice@example.com");
        expect(sentEmail.text).toMatch(/https:\/\/issuer\.test\/verify-email\?token=/);
    });

    it("Login -> Fetches user by email, verifies password locally, sets cookies", async () => {
        const {signServiceToken} = await import("../utils/jwt");
        const bcrypt = await import("bcrypt");
        const hashedPw = await bcrypt.hash("s3cretPassword", 10);

        axiosMock.get.mockImplementation((url: string, config?: any) => {
            if (url.includes("alice%40example.com")) {
                expect(config?.headers?.Authorization).toBe("Bearer svc-token");
                return Promise.resolve({
                    status: 200,
                    data: {data: {id: "u1", username: "alice", email: "alice@example.com", verified: true, roles: ["user"], password_hash: hashedPw}},
                });
            }
            return Promise.reject(new Error(`Unknown GET request to ${url}`));
        });

        const loginResponse = await request(expressApp)
        .post("/login")
        .send({email: "alice@example.com", password: "s3cretPassword"})
        .expect(200);

        expect(loginResponse.body).toHaveProperty("accessToken");

        const loginCookies = loginResponse.headers["set-cookie"] as unknown as string[];
        const refreshTokenCookie = loginCookies.find((cookie: string) => cookie.startsWith("refresh_token="));
        expect(refreshTokenCookie).toBeTruthy();

        expect((signServiceToken as any).mock.calls.some(([arguments_]: any[]) => arguments_?.scope === "users:read")).toBe(true);
    });

    it("Login -> Returns 403 when db-service returns unverified user", async () => {
        const bcrypt = await import("bcrypt");
        const hashedPw = await bcrypt.hash("s3cretPassword", 10);

        axiosMock.get.mockResolvedValueOnce({
            status: 200,
            data: {data: {id: "u1", username: "alice", email: "alice@example.com", roles: [], verified: false, password_hash: hashedPw}},
        });

        await request(expressApp)
        .post("/login")
        .send({email: "alice@example.com", password: "s3cretPassword"})
        .expect(403);
    });

    it("Login -> Returns 401 for wrong password", async () => {
        const bcrypt = await import("bcrypt");
        const hashedPw = await bcrypt.hash("s3cretPassword", 10);

        axiosMock.get.mockResolvedValueOnce({
            status: 200,
            data: {data: {id: "u1", username: "alice", email: "alice@example.com", verified: true, roles: [], password_hash: hashedPw}},
        });

        await request(expressApp)
        .post("/login")
        .send({email: "alice@example.com", password: "wrongPassword"})
        .expect(401);
    });

    it("Login -> Maps db-service 401 to generic 401 to prevent enumeration", async () => {
        const error: any = new Error("Unauthorized");
        error.response = {status: 401, data: {ok: false}};
        axiosMock.get.mockRejectedValueOnce(error);

        await request(expressApp)
        .post("/login")
        .send({email: "alice@example.com", password: "wrongPassword"})
        .expect(401);
    });

    it("Verify Email -> Happy path updates user", async () => {
        const {signUserAccessToken, signServiceToken} = await import("../utils/jwt");
        axiosMock.patch.mockResolvedValueOnce({status: 200});

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

        expect(axiosMock.patch).toHaveBeenCalledWith(
            expect.stringContaining("/users/u1"),
            expect.objectContaining({verified: true}),
            expect.any(Object),
        );
        expect((signServiceToken as any).mock.calls.some(([arguments_]: any[]) => arguments_?.scope === "users:update")).toBe(true);
    });

    it("Reset Password -> Happy path patches DB", async () => {
        const {signUserAccessToken, signServiceToken} = await import("../utils/jwt");
        axiosMock.patch.mockResolvedValueOnce({status: 200});

        const passwordResetToken = await signUserAccessToken({
            userId: "u1",
            scope: "password_reset",
            ttlSec: 3600,
        });

        await request(expressApp)
        .post("/reset-password")
        .send({token: passwordResetToken, newPassword: "NewSecurePassword!@#"})
        .expect(200);

        expect(axiosMock.patch).toHaveBeenCalledWith(
            expect.stringContaining("/users/u1"),
            expect.objectContaining({password_hash: expect.any(String)}),
            expect.any(Object),
        );
        expect((signServiceToken as any).mock.calls.some(([arguments_]: any[]) => arguments_?.scope === "users:update")).toBe(true);
    });

    it("Forgot Password -> Looks up user and sends reset link with redirect", async () => {
        const {mailer} = await import("../utils/mailer");
        const {signServiceToken} = await import("../utils/jwt");

        axiosMock.get.mockResolvedValueOnce({
            status: 200,
            data: {data: {id: "u9", email: "alice@example.com"}},
        });

        const response = await request(expressApp)
        .post("/forgot-password")
        .send({email: "alice@example.com", redirect_uri: "https://app1.localhost:3000/reset"})
        .expect(200);

        expect(response.text).toMatch(/If that email exists/i);

        expect(axiosMock.get).toHaveBeenCalledWith(
            expect.stringMatching(/\/users\/email\/alice%40example\.com$/),
            expect.objectContaining({headers: expect.objectContaining({Authorization: "Bearer svc-token"})}),
        );
        expect((signServiceToken as any).mock.calls.some(([arguments_]: any[]) => arguments_?.scope === "users:read")).toBe(true);

        expect(mailer.sendMail).toHaveBeenCalledTimes(1);
        const emailMessage = (mailer.sendMail as any).mock.calls[0][0];
        expect(emailMessage.to).toBe("alice@example.com");
        expect(emailMessage.text).toMatch(/Reset your password:/);
        expect(emailMessage.text).toMatch(/token=/);
    });

    it("Forgot Password -> Enumeration-safe on unknown email (still 200, no mail)", async () => {
        const {mailer} = await import("../utils/mailer");

        axiosMock.get.mockRejectedValueOnce(Object.assign(new Error("Not Found"), {response: {status: 404}}));

        const response = await request(expressApp)
        .post("/forgot-password")
        .send({email: "nobody@example.com", redirect_uri: "https://app1.localhost:3000/reset"})
        .expect(200);

        expect(response.text).toMatch(/If that email exists/i);
        expect(mailer.sendMail).not.toHaveBeenCalled();
    });
});