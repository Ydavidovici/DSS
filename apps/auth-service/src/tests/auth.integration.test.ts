import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import {describe, it, expect, beforeAll, afterAll, mock} from "bun:test";

mock.module("../utils/mailer", () => ({
    mailer: {sendMail: mock().mockResolvedValue({})},
}));

describe("Auth Service Integration & Nginx Gateway", () => {
    let expressApp: express.Express;

    const testRunId = Math.random().toString(36).substring(7);
    const testUser = {
        username: `gateway_user_${testRunId}`,
        password: "SuperSecurePassword123!",
        email: `gateway_${testRunId}@example.com`,
    };

    let validRefreshToken: string;
    let validAccessToken: string;

    beforeAll(async () => {
        process.env.DB_SERVICE_API_URL ||= "http://127.0.0.1:4001/api/v1";
        process.env.DB_SERVICE_BASE_URL ||= "http://127.0.0.1:4001";

        process.env.JWT_ISSUER = "dss-auth";
        process.env.JWT_AUDIENCE = "db-service";

        const authRouter = (await import("../routes/auth")).default;

        expressApp = express();
        expressApp.use(express.json());
        expressApp.use(cookieParser());
        expressApp.use("/", authRouter);
    });

    it("1. Registers a new user directly in the running db-service", async () => {
        const response = await request(expressApp)
        .post("/register")
        .send(testUser)
        .expect(201);

        expect(response.text).toMatch(/User created/i);
    });

    it("1.5. Verifies the user's email from the mocked mailer", async () => {
        const {mailer} = await import("../utils/mailer");

        const sentEmail = (mailer.sendMail as any).mock.calls[0][0];

        const token = sentEmail.text.split("token=")[1];

        await request(expressApp)
        .get("/verify-email")
        .query({token})
        .expect(200);
    });

    it("2. Logs in the user and receives real JWTs", async () => {
        const response = await request(expressApp)
        .post("/login")
        .send({
            email: testUser.email,
            password: testUser.password,
        })
        .expect(200);

        expect(response.body).toHaveProperty("accessToken");
        validAccessToken = response.body.accessToken;

        const cookies = response.headers["set-cookie"] as unknown as string[];
        const refreshCookie = cookies.find(c => c.startsWith("refresh_token="));

        expect(refreshCookie).toBeDefined();
        validRefreshToken = refreshCookie!;
    });

    it("3. Nginx Gateway Flow: /validate returns 200 OK for valid access token", async () => {
        const response = await request(expressApp)
        .get("/verify")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .expect(200);

        expect(response.body).toHaveProperty("user");
        expect(response.body.user).toHaveProperty("sub");
    });

    it("4. Nginx Gateway Flow: /validate returns 401 for missing/invalid token", async () => {
        await request(expressApp)
        .get("/verify")
        .set("Authorization", `Bearer invalid.token.string`)
        .expect(401);
    });

    it("5. Refresh token flow generates a new valid access token", async () => {
        const response = await request(expressApp)
        .post("/refresh")
        .set("Cookie", validRefreshToken)
        .expect(200);

        expect(response.body).toHaveProperty("accessToken");
        expect(response.body.accessToken).not.toBe(validAccessToken);

        await request(expressApp)
        .get("/verify")
        .set("Authorization", `Bearer ${response.body.accessToken}`)
        .expect(200);
    });
});