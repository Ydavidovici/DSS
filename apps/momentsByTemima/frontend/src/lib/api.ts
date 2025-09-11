// src/lib/api.ts
const API = import.meta.env.VITE_API_BASE || "http://localhost:8000";

/** Original asset URL served by StaticFiles at /media */
export function assetUrl(rel: string) {
    return `${API}/media/${rel.replace(/^\/+/, "")}`;
}

/** Ask backend for the best derivative by width; fallback to original */
export async function bestAssetUrl(rel: string, maxWidth = 1280, prefer: "avif" | "webp" = "avif") {
    try {
        const u = new URL(`${API}/api/assets/best`);
        u.searchParams.set("rel", rel);
        u.searchParams.set("max_width", String(maxWidth));
        u.searchParams.set("prefer", prefer);
        const res = await fetch(u.toString());
        if (res.ok) {
            const { url } = await res.json();     // url is a PATH like /media-deriv/...
            return `${API}${url}`;                // make absolute for <img>
        }
    } catch {/* ignore and fallback */}
    return assetUrl(rel);
}
