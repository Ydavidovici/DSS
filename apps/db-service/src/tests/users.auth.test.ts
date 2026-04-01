import express from "express";
import request from "supertest";
import {describe, it, expect, beforeAll, beforeEach, afterEach, afterAll} from "bun:test";
import {SignJWT} from "jose";
import {db, closeDB} from "../config/db";

describe("[db-service] Users End-to-End (Express + HS256 Service Tokens)", () => {
    let app: express.Express;

    const TEST_SECRET = "super_secret_test_key_that_is_long_enough";
    const ISS = "dss-auth";
    const AUD = "db-service";
    const USER_ID = "00000000-0000-0000-0000-000000000001";

    const TEST_EMAILS = ["alice@example.com", "dupe@example.com", "bob@example.com"];

    beforeAll(async () => {
        process.env.JWT_SECRET = TEST_SECRET;
        process.env.JWT_ISSUER = ISS;
        process.env.JWT_AUDIENCE = AUD;

        app = express();
        app.use(express.json());

        const userRoutes = (await import("../modules/users/user.routes")).default;
        app.use("/internal/users", userRoutes);
    });

    beforeEach(async () => {
        await db("users").whereIn("email", TEST_EMAILS).delete();

        await db("users").insert([
            {
                id: USER_ID,
                email: "alice@example.com",
                password_hash: "hashed_alice_pass",
                verified: true,
            },
            {
                id: "00000000-0000-0000-0000-000000000002",
                email: "dupe@example.com",
                password_hash: "x123",
                verified: true,
            },
        ]);
    });

    afterEach(async () => {
        await db("users").whereIn("email", TEST_EMAILS).delete();
    });

    afterAll(async () => {
        await closeDB();
    });

    async function signSvcToken({
        sub = "client_auth",
        expired = false,
        wrongSecret = false,
    } = {}) {
        const secretKey = new TextEncoder().encode(wrongSecret ? "wrong_secret" : TEST_SECRET);
        const jwt = new SignJWT({typ: "access"})
        .setProtectedHeader({alg: "HS256"})
        .setIssuer(ISS)
        .setAudience(AUD)
        .setSubject(sub)
        .setIssuedAt();

        jwt.setExpirationTime(expired ? Math.floor(Date.now() / 1000) - 10 : "60s");
        return jwt.sign(secretKey);
    }

    it("401 when missing bearer token", async () => {
        await request(app).get(`/internal/users/email/alice@example.com`).expect(401);
    });

    it("401 when token is signed with the wrong secret", async () => {
        const badToken = await signSvcToken({wrongSecret: true});
        await request(app)
        .get("/internal/users/email/alice@example.com")
        .set("Authorization", `Bearer ${badToken}`)
        .expect(401);
    });

    it("401 when token is expired", async () => {
        const expiredToken = await signSvcToken({expired: true});
        await request(app)
        .get("/internal/users/email/alice@example.com")
        .set("Authorization", `Bearer ${expiredToken}`)
        .expect(401);
    });

    it("403 when token subject is not client_auth (e.g., a user access token)", async () => {
        const userToken = await signSvcToken({sub: "some-user-id"});
        await request(app)
        .get("/internal/users/email/alice@example.com")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);
    });

    it("GET /internal/users/email/:email returns user including password_hash", async () => {
        const token = await signSvcToken();
        const res = await request(app)
        .get("/internal/users/email/alice@example.com")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

        expect(res.body.data.email).toBe("alice@example.com");
        expect(res.body.data).toHaveProperty("password_hash");
    });

    it("GET /internal/users/email/:email returns 404 for unknown users", async () => {
        const token = await signSvcToken();
        await request(app)
        .get("/internal/users/email/nobody@example.com")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });

    it("POST /internal/users creates user and maps 23505 to 409 Conflict", async () => {
        const token = await signSvcToken();

        await request(app)
        .post("/internal/users")
        .set("Authorization", `Bearer ${token}`)
        .send({email: "bob@example.com"})
        .expect(400);

        const res = await request(app)
        .post("/internal/users")
        .set("Authorization", `Bearer ${token}`)
        .send({email: "bob@example.com", password_hash: "hashed123"})
        .expect(201);

        expect(res.body.data.email).toBe("bob@example.com");

        await request(app)
        .post("/internal/users")
        .set("Authorization", `Bearer ${token}`)
        .send({email: "dupe@example.com", password_hash: "x123"})
        .expect(409);
    });

    it("PATCH /internal/users/:id updates user fields", async () => {
        const token = await signSvcToken();

        const res = await request(app)
        .patch(`/internal/users/${USER_ID}`)
        .set("Authorization", `Bearer ${token}`)
        .send({verified: false})
        .expect(200);

        expect(res.body.data.verified).toBe(false);

        await request(app)
        .patch("/internal/users/00000000-0000-0000-0000-000000000099")
        .set("Authorization", `Bearer ${token}`)
        .send({verified: true})
        .expect(404);
    });

    it("DELETE /internal/users/:id returns 204 or 404", async () => {
        const token = await signSvcToken();

        await request(app)
        .delete(`/internal/users/${USER_ID}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);

        await request(app)
        .delete(`/internal/users/${USER_ID}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });

    it("GET /internal/users/:id returns user", async () => {
        const token = await signSvcToken();
        const res = await request(app)
        .get(`/internal/users/${USER_ID}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

        expect(res.body.data.id).toBe(USER_ID);
    });

    it("GET /internal/users/:id returns 404 for unknown users", async () => {
        const token = await signSvcToken();
        await request(app)
        .get(`/internal/users/00000000-0000-0000-0000-000000000099`)
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });

    it("PATCH /internal/users/:id returns 400 when no valid fields provided", async () => {
        const token = await signSvcToken();
        await request(app)
        .patch(`/internal/users/${USER_ID}`)
        .set("Authorization", `Bearer ${token}`)
        .send({id: USER_ID})
        .expect(400);
    });
});