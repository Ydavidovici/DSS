import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// FIXME: migrate these for bun reqs, not express

import userRoutes from "./modules/users/user.routes";
import { requireServiceToken } from "./middleware/requireServiceToken";

const app = express();
const PORT = Number(process.env.PORT || 4001);
const HOST = process.env.HOST || "0.0.0.0";

app.use((req: Request, res: Response, next: NextFunction) => {
    req.headers["x-request-id"] = req.headers["x-request-id"] || crypto.randomUUID();
    res.setHeader("x-request-id", req.headers["x-request-id"]);
    next();
});

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
}));

app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Too many requests" } },
}));

app.get("/api/healthz", (_req: Request, res: Response) => {
    res.json({ ok: true });
});

app.use("/api/v1/users", requireServiceToken, userRoutes);

// 404 Handler
app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
});

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.httpCode || (err.validation ? 400 : 500);
    const payload = err.public || (err.validation
        ? { code: "VALIDATION_ERROR", message: "Invalid request", details: err.validation }
        : { code: "INTERNAL_ERROR", message: "Unexpected error" });

    const safeBody = { ...req.body };
    if (safeBody.password) {
        safeBody.password = "***";
    }
    if (safeBody.password_hash) {
        safeBody.password_hash = "***";
    }

    console.error(`[${req.headers["x-request-id"]}] Error:`, err.message);
    if (status >= 500) {
        console.error("Payload:", safeBody);
        console.error(err.stack);
    }

    res.status(status).json({ error: payload });
});

app.listen(PORT, HOST, () => {
    console.log(`[db-service] listening on http://${HOST}:${PORT}`);
});