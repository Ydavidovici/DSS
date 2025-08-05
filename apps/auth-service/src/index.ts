import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { createClient } from "redis";

import authRouter from "./routes/auth";
import oidcRouter from "./routes/oidc";

// Load environment variables
dotenv.config();
const PORT = process.env.PORT || 4000;

// Initialize Redis (used by routers for token revocation, refresh storage)
const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(console.error);

const app = express();

// Global middleware
app.use(express.json());
app.use(cookieParser());
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGINS?.split(","), credentials: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Mount routers
app.use("/auth", authRouter);
app.use(oidcRouter);

// 404 handler
app.use((_req, res) => res.status(404).send("Not found"));

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).send("Internal server error");
});

// Start the server
app.listen(PORT, () =>
    console.log(`Auth-service running on http://localhost:${PORT}`)
);
