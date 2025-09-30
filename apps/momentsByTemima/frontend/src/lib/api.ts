const API = import.meta.env.VITE_API_BASE || "http://localhost:8000";

/** Static media served by FastAPI StaticFiles at /media */
export function assetUrl(rel: string): string {
    return `${API}/media/${encodeURIComponent(rel.replace(/^\/+/, ""))}`;
}
