import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors, { CorsOptions } from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

import authRouter from "./routes/auth";
import { kv } from "./utils/redis"; // <- use the shared Redis client/util

const app = express();
const PORT = Number(process.env.PORT || 4000);

// If you're behind a proxy/ingress, keep this so secure cookies work.
app.set("trust proxy", 1);

// --- CORS: dynamic allowlist from Redis, with ENV fallback ---
const envOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

// Delegate lets us compute per-request CORS options (and can be async via callback)
const corsOptionsDelegate = async (req: express.Request, cb: (err: Error | null, options: CorsOptions) => void) => {
    const originHeader = req.header("Origin");
    // Allow same-origin / non-browser / server-to-server (no Origin)
    if (!originHeader) return cb(null, { origin: true, credentials: true });

    // Build allowlist
    let allowlist = envOrigins;
    if (allowlist.length === 0) {
        try {
            allowlist = await kv.getAllowedRedirects(); // e.g. ["https://app1.example.com", ...]
        } catch {
            // fall through to deny if Redis unavailable and no ENV
        }
    }

    let isAllowed = false;
    try {
        const u = new URL(originHeader);
        const originOnly = `${u.protocol}//${u.host}`;
        isAllowed = allowlist.includes(originOnly);
    } catch {
        isAllowed = false;
    }

    cb(null, {
        origin: isAllowed,        // true/false
        credentials: true,
    });
};

// --- Global middleware ---
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors(corsOptionsDelegate));
// (Optional) respond to preflight quickly
app.options("*", cors(corsOptionsDelegate));

// Mild global rate-limit (you also have route-level ones)
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Health checks
app.get("/healthz", (_req, res) => res.send("ok"));
app.get("/readyz", (_req, res) => res.send("ready"));

// Mount the single router at root so /.well-known/* is at the service root (OIDC expects that)
app.use("/", authRouter);

/**
 * If you MUST mount at "/auth":
 * - keep the auth endpoints under "/auth/*"
 * - BUT expose `/.well-known/*` at root by adding small passthrough routes here that call into the same handlers.
 */

// 404 handler
app.use((_req, res) => res.status(404).send("Not found"));

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).send("Internal server error");
});

app.listen(PORT, () => {
    console.log(`[auth-service] listening on :${PORT}`);
});
