// src/index.ts
import express from "express";
import fs from "fs/promises";
import path from "path";
import { SignJWT, exportJWK, jwtVerify, JWK, JWTPayload } from "jose";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

/** 1) Load and prepare your keys + JWK Set **/
const privKeyPem = await fs.readFile(path.resolve(process.env.PRIVATE_KEY_PATH!), "utf8");
const pubKeyPem  = await fs.readFile(path.resolve(process.env.PUBLIC_KEY_PATH!), "utf8");

// Build JWK objects
const privateJwk = JWK.asKey(privKeyPem, { use: "sig", alg: "RS256", kid: "auth-key-1" });
const publicJwk  = JWK.asKey(pubKeyPem,  { use: "sig", alg: "RS256", kid: "auth-key-1" });

// JWKS = { keys: [ publicJwk ] }
const JWKS = { keys: [ await exportJWK(publicJwk) ] };

/** 2) JWKS discovery endpoint **/
app.get("/.well-known/jwks.json", (_req, res) => {
    res.json(JWKS);
});

/** 3) Login → issue RS256 JWT **/
app.post("/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (username !== "admin" || password !== "password123") {
        return res.status(401).json({ message: "Invalid credentials" });
    }
    const now = Math.floor(Date.now() / 1000);
    const payload: JWTPayload = {
        sub: username,
        iat: now,
        exp: now + 60 * 60,        // or use process.env.JWT_EXPIRES_IN
    };
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "RS256", kid: "auth-key-1" })
      .sign(privateJwk);
    res.json({ token });
});

/** 4) Verify endpoint → HTTP introspection **/
app.get("/auth/verify", async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Missing or malformed token." });
    }
    const token = auth.slice(7);
    try {
        // Verify against the public JWK we loaded
        const { payload } = await jwtVerify(token, publicJwk, { algorithms: ["RS256"] });
        res.json({ user: payload });
    } catch (err) {
        res.status(401).json({ message: "Invalid or expired token." });
    }
});

app.listen(process.env.PORT, () =>
  console.log(`Auth-service running on http://localhost:${process.env.PORT}`)
);