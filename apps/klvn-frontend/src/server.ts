import { serve } from "bun";
import { readFileSync, existsSync } from "fs";
import { extname } from "path";

const PORT = Number(process.env.FRONTEND_PORT || 3000);
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || "";
const AUTH_ORIGIN = process.env.AUTH_ORIGIN || "";

const MIME: Record<string,string> = {
    ".html":"text/html; charset=utf-8",
    ".css":"text/css; charset=utf-8",
    ".js":"application/javascript; charset=utf-8",
    ".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",
    ".svg":"image/svg+xml",".ico":"image/x-icon",".json":"application/json; charset=utf-8",
};

function serveFile(path: string) {
    if (!existsSync(path)) return new Response("Not found", { status: 404 });
    const data = readFileSync(path);
    const mime = MIME[extname(path)] || "application/octet-stream";
    return new Response(data, { headers: { "Content-Type": mime } });
}

async function proxy(req: Request, base: string) {
    const url = new URL(req.url);
    const target = base.replace(/\/$/, "") + url.pathname + url.search;
    const headers = new Headers(req.headers);
    headers.delete("host"); headers.delete("content-length");
    const res = await fetch(target, {
        method: req.method,
        headers,
        body: ["GET","HEAD"].includes(req.method) ? undefined : await req.blob(),
        redirect: "manual",
    });
    return new Response(res.body, { status: res.status, headers: res.headers });
}

serve({
    port: PORT,
    async fetch(req) {
        const { pathname } = new URL(req.url);
        if (pathname.startsWith("/api/") && BACKEND_ORIGIN) return proxy(req, BACKEND_ORIGIN);
        if (pathname.startsWith("/auth/") && AUTH_ORIGIN)   return proxy(req, AUTH_ORIGIN);

        // hashed assets emitted by Vite
        if (pathname.startsWith("/assets/")) return serveFile("./public" + pathname);
        if (pathname === "/favicon.ico")     return serveFile("./public/favicon.ico");

        // SPA fallback
        const htmlPath = "./public/index.html";
        if (existsSync(htmlPath)) {
            const html = readFileSync(htmlPath, "utf8");
            return new Response(html, { headers: { "Content-Type": MIME[".html"] } });
        }
        return new Response("Build not found", { status: 404 });
    }
});

console.log(`🟢 Frontend: http://localhost:${PORT}`);
if (BACKEND_ORIGIN) console.log(`  ↳ /api/*  → ${BACKEND_ORIGIN}`);
if (AUTH_ORIGIN)   console.log(`  ↳ /auth/* → ${AUTH_ORIGIN}`);
