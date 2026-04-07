import express from "express";
import {join, dirname} from "path";
import {fileURLToPath} from "url";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://127.0.0.1:4000";
const DB_SERVICE_URL = process.env.DB_SERVICE_URL || "http://127.0.0.1:4001";

async function startServer() {
	let vite;

	if (process.env.NODE_ENV !== "production") {
		const {createServer: createViteServer} = await import("vite");
		vite = await createViteServer({
			server: {middlewareMode: true},
			appType: "custom",
		});
	}

	const serveHtml = async (req, res, filePath) => {
		try {
			let html = fs.readFileSync(filePath, "utf-8");
			if (vite) {
				html = await vite.transformIndexHtml(req.originalUrl, html);
			}
			res.status(200).set({"Content-Type": "text/html"}).end(html);
		} catch (e) {
			if (vite) vite.ssrFixStacktrace(e);
			console.error(e);
			res.status(500).end(e.message);
		}
	};

	const requireAuth = async (req, res, next) => {
		console.log(`\n[Gatekeeper] Intercepted request for ${req.path}`);
		try {
			const rawCookies = req.headers.cookie || "";
			const match = rawCookies.match(/token=([^;]+)/);
			const token = match ? match[1] : null;
			const headers = {Cookie: rawCookies};

			if (token) {
				headers["Authorization"] = `Bearer ${token}`;
			} else {
				console.log("[Gatekeeper] No token found in incoming browser cookies.");
			}

			const response = await fetch(`${AUTH_SERVICE_URL}/verify`, {
				headers,
			});
			const responseBody = await response.text();

			console.log(`[Gatekeeper] Auth Service returned Status: ${response.status}`);
			console.log(`[Gatekeeper] Auth Service Message: ${responseBody}`);

			if (response.ok) {
				console.log("[Gatekeeper] Access Granted. Serving dashboard...");
				next();
			} else {
				console.log("[Gatekeeper] Access Denied. Redirecting to /login...");
				res.redirect("/login");
			}
		} catch (error) {
			console.error(`[Gatekeeper] Fetch completely failed: ${error.message}`);
			res.redirect("/login");
		}
	};

	app.get("/api/auth/health", async (req, res) => {
		try {
			const response = await fetch(`${AUTH_SERVICE_URL}/healthz`);
			const text = await response.text();
			res.status(response.status).send(text);
		} catch (err) {
			res.status(503).send("Service Unavailable");
		}
	});

	app.get("/api/db/health", async (req, res) => {
		try {
			const response = await fetch(`${DB_SERVICE_URL}/api/healthz`);
			const data = await response.json();
			res.status(response.status).json(data);
		} catch (err) {
			res.status(503).json({ok: false});
		}
	});

	app.post("/api/login", express.json(), async (req, res) => {
		try {
			const response = await fetch(`${AUTH_SERVICE_URL}/login`, {
				method: "POST",
				headers: {"Content-Type": "application/json"},
				body: JSON.stringify(req.body),
			});
			const data = await response.json();
			if (response.ok) {
				res.status(200).json(data);
			} else {
				res.status(response.status).json(data);
			}
		} catch (error) {
			console.error("[Proxy] Login request failed:", error);
			res.status(500).json({message: "Internal server error"});
		}
	});

	if (vite) {
		app.use(vite.middlewares);
	} else {
		app.use(express.static(join(__dirname, "public")));
	}

	app.get("/login", (req, res) => {
		serveHtml(req, res, join(__dirname, "public/pages/login.html"));
	});

	app.get("/dashboard", requireAuth, (req, res) => {
		serveHtml(req, res, join(__dirname, "public/pages/dashboard.html"));
	});

	app.get("*", (req, res) => {
		serveHtml(req, res, join(__dirname, "index.html"));
	});

	app.listen(3000, "0.0.0.0", () => {
		console.log("🚀 Server listening on http://localhost:3000");
	});
}

startServer();
