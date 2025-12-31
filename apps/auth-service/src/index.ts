import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors, {CorsOptions} from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

import authRouter from "./routes/auth";
import {kv} from "./utils/redis";

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.set("trust proxy", 1);

const envOrigins = (process.env.CORS_ORIGINS || "")
.split(",")
.map(s => s.trim())
.filter(Boolean);

const corsOptionsDelegate = async (req: express.Request, cb: (err: Error | null, options: CorsOptions) => void) => {
    const originHeader = req.header("Origin");
    if (!originHeader) {
        return cb(null, {origin: true, credentials: true});
    }

    let allowlist = envOrigins;
    if (allowlist.length === 0) {
        try {
            allowlist = await kv.getAllowedRedirects();
        } catch {
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
        origin: isAllowed,
        credentials: true,
    });
};

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(cors(corsOptionsDelegate));
app.options("*", cors(corsOptionsDelegate));

app.use(rateLimit({windowMs: 15 * 60 * 1000, limit: 100}));

app.get("/healthz", (_req, res) => res.send("ok"));
app.get("/readyz", (_req, res) => res.send("ready"));

app.use("/", authRouter);

app.use((_req, res) => res.status(404).send("Not found"));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).send("Internal server error");
});

app.listen(PORT, () => {
    console.log(`[auth-service] listening on :${PORT}`);
});
