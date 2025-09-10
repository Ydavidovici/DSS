# Temima Photography — Internal UI Brief v0.2

**Owner:** Yaakov Davidovici
**Client:** Temima Edgar
**Last updated:** v0.2

---

## A) TL;DR — Text this for fast confirmation (copy/paste)

**Yo! Quick confirm before I start building:**

1. **Look & feel:** Soft pastels on a **light** background, warm/friendly/calm vibe, tiny/subtle animations only. Fonts: **Cormorant Garamond** (headings) + **Inter** (body).
2. **Pages & flow:** Home, Portfolio, Services (says **“Call for pricing”**), About, Contact/Book. Home hero uses your photos with **Call** + **Text** buttons; Portfolio is a grid with a tap-to-expand gallery; Contact form has **Name, Email, Message** only.
3. **Booking & policies:** Primary booking = **Call/Text** (form optional). Availability **Sun–Fri**, mostly **outdoor/on‑location**; no fixed hours and **no travel radius** listed (moving soon). **No cancellation fee** for now. Offer **discount** if photos can be used in portfolio. Delivery via **online gallery**.

**Reply “Yes” or tell me what to tweak.**

---

## B) Locked Decisions (from client answers)

* **Primary actions:** Call/Text to book; form as secondary path.

    * **Tel:** 747‑717‑9328
    * **Email:** [temimaedgar@gmail.com](mailto:temimaedgar@gmail.com)
* **Vibe keywords:** Warm, Friendly, Calm
* **Theme:** Light background, soft pastels, nothing bright
* **Motion:** Subtle only (≤250ms fades/lifts; respect `prefers-reduced-motion`)
* **Service model:** Outdoor/on‑location; **no travel radius** shown
* **Availability:** Sun–Fri; **no strict hours**
* **Pricing:** “**Call for pricing**” (hide exact numbers for now)
* **Policies:** No cancellation fee; **portfolio‑use discount** available
* **Delivery:** **Online gallery**
* **Likes:** rivkakindermanphotography.com, meltzphotography.com
* **Dislikes:** elanalouis.com ("not as clean/put together")
* **Assets:** 2 logo ideas + client photos for hero/portfolio

---

## C) IA / Pages

```
/
├─ /portfolio (All; categories can come later)
├─ /services (no prices; bullet inclusions + “Call for pricing”)
├─ /about
└─ /contact (call, text, 3‑field form)
```

**Home**

* Hero (client photo) + headline/subline + **Call**/**Text** buttons
* Featured images (3–6)
* Services snapshot + link
* CTA bar (mobile sticky): Call/Text

**Portfolio**

* Responsive grid; **lightbox** with arrows/swipe
* Optional tags later (Portraits / Couples/Family / Events)

**Services**

* What you shoot; inclusions (shoot length, edited images, typical turnaround)
* **Call for pricing** prominent (tel/sms links)
* Portfolio‑discount sentence

**About**

* Friendly headshot + short, calm bio

**Contact**

* Big **Call**/**Text** buttons (tel/sms)
* **Form:** name\* / email\* / message\* (+ optional preferred date/time)
* Notes: Sun–Fri; outdoor/on‑location; delivery via online gallery

---

## D) Visual Direction (dev‑ready tokens)

**Palette (soft, low‑saturation pastels + warm neutrals)**

* `background`: #FAFAF8 (Pearl)
* `text`: #2B2B2B (Charcoal)
* `primary/50-500`: #FEF7FA → #F4E6EC (Blush)
* `accentSky/100-400`: #F5F9FF → #E6F0FA
* `accentSage/100-400`: #F3F8F6 → #E8F3EE
* `neutral/200`: #EAE6E3; `neutral/600`: #6B6460

**Type**

* Headings: **Cormorant Garamond** (600/700)
* Body/UI: **Inter** (400/500/600)

**Spacing/Radius/Shadow/Motion**

* 4px scale; base `16`
* Radius: `12–16`
* Shadow: soft `md`
* Motion: `200–250ms`, ease‑out; hover lift ≤4px

**Tokens JSON (drop into codebase)**

```json
{
  "color": {
    "background": "#FAFAF8",
    "text": "#2B2B2B",
    "primary": {"100": "#FBEFF4", "200": "#F8E9EF", "300": "#F6E3EA", "400": "#F5DCE6", "500": "#F4E6EC"},
    "sky": {"200": "#EEF5FD", "300": "#EAF2FB", "400": "#E6F0FA"},
    "sage": {"200": "#EEF6F3", "300": "#ECF4F1", "400": "#E8F3EE"},
    "neutral": {"200": "#EAE6E3", "600": "#6B6460"}
  },
  "font": {
    "heading": "Cormorant Garamond",
    "body": "Inter",
    "scale": {"h1": 42, "h2": 34, "h3": 28, "body": 16, "button": 15}
  },
  "radius": {"md": 12, "lg": 16},
  "shadow": {"card": "0 8px 24px rgba(0,0,0,0.06)"},
  "motion": {"fast": 200, "base": 250}
}
```

---

## E) Component Inventory (MVP)

* **Nav** (transparent → solid on scroll)
* **Buttons** (primary, outline)
* **Inputs** (text, email, textarea + error)
* **Hero** slice (image + text + CTAs)
* **Image grid** + **Lightbox**
* **Card** (service/feature)
* **Sticky mobile CTA** (Call/Text)
* **Footer** (contact + socials)
* **Toast/confirmation** for form submit

---

## F) Copy Stubs (internal placeholders)

* **Hero H1:** "Soft, natural‑light photography—warm, real, you."
* **Subline:** "Outdoor and on‑location sessions, Sun–Fri. Call or text to book."
* **Services blurb:** "Portraits, couples & family sessions. Delivery via online gallery. Call for pricing."
* **Discount note:** "Beginner rate available when images may be used in portfolio."

---

## G) Performance & A11y

* LCP < 2.7s (optimize hero; AVIF/WebP; responsive `srcset`/`sizes`)
* CLS < 0.1; explicit image sizes
* Keyboard reachable nav; visible focus rings; alt text
* Respect reduced‑motion

---

## H) Build Plan — DSS Microservices + FastAPI (backend) + Vue 3 (Vite) + Tailwind (frontend)

**Goal:** Keep the UI fast and simple in Vue; keep business logic in your DSS backend. The Temima services talk to your existing **dss-auth** (JWT) and **dss-db** (Postgres).

### H.1 Services (who does what)

* **dss-db** — PostgreSQL (shared).
* **dss-auth** — existing JWT issuer/validator (HS256 or JWKS). Only required for **admin** endpoints.
* **temima-api** — **FastAPI** service: portfolio listing/upload, contact messages, bookings, email notifications, static media.
* **temima-web** — **Vue 3 + Vite + Tailwind** SPA (can add SSG later); consumes `temima-api` over HTTPS.

### H.2 Frontend (temima-web)

* **Routes:** `/`, `/portfolio`, `/services`, `/about`, `/contact`
* **UI:** Tailwind themed with tokens (Cormorant Garamond/Inter, soft pastels, light theme)
* **Images:** Responsive grid + lightbox; `<img>` with `srcset/sizes` (or vite-plugin-image-presets). Preload LCP hero.
* **Forms:** POST to API (`/api/contact`, `/api/bookings`).
* **Primary actions:** `tel:7477179328`, `sms:7477179328` links visible on mobile.
* **SEO:** Static meta + OpenGraph; optional SSG later (vite-ssg) if needed.
* **Env:** `VITE_API_BASE`, `VITE_PHONE`, `VITE_EMAIL`.

### H.3 Backend (temima-api — FastAPI)

**Public endpoints**

* `GET /api/health` → `{ status: "ok" }`
* `GET /api/portfolio` → `{ images: Image[] }`
* `POST /api/contact` → `{ name, email, message }` → store + email → `{ ok: true }`
* `POST /api/bookings` → `{ name, email, message, preferredDateTime? }` → store + email → `{ ok: true }`

**Admin endpoints** (require `Authorization: Bearer <jwt>` validated via **dss-auth**)

* `POST /api/admin/images` (multipart) → upload to `MEDIA_ROOT` (or S3) → `{ id, url }`
* `DELETE /api/admin/images/{id}` → `{ ok: true }`
* `GET /api/admin/bookings` → list; `PATCH /api/admin/bookings/{id}` → update status (`new/contacted/scheduled/done/cancelled`)

**Models (SQLAlchemy)**

* `image(id, file_path, url, alt, category, featured, sort_order, created_at)`
* `contact_message(id, name, email, message, created_at)`
* `booking(id, name, email, message, preferred_datetime, status, created_at)`

**Integrations**

* **Email:** Resend or SMTP (Mailhog in dev). Helper in `services/email.py`.
* **Media:** Local `MEDIA_ROOT=./media` served at `/media/*` (uvicorn static) → switch to S3/Cloudinary later.
* **Auth:** `get_current_user()` hits dss-auth (HS256 secret or JWKS).
* **CORS:** allow `http://localhost:5173` in dev and prod domain in production.

### H.4 API Contracts (JSON)

* **GET /api/portfolio** → `200 { images: [{ id, url, alt, width?, height?, category?, featured? }] }`
* **POST /api/contact**

```json
{ "name": "Temima", "email": "temima@example.com", "message": "Hello!" }
```

`201 { "ok": true }`

* **POST /api/bookings**

```json
{ "name": "Temima", "email": "temima@example.com", "message": "Family shoot", "preferredDateTime": "2025-09-22T15:00:00Z" }
```

`201 { "ok": true }`

### H.5 Local Dev (docker-compose optional)

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: temima
      POSTGRES_USER: temima
      POSTGRES_PASSWORD: temima
    ports: ["5432:5432"]
  api:
    build: ./backend
    environment:
      DATABASE_URL: postgresql+psycopg://temima:temima@db:5432/temima
      MEDIA_ROOT: /app/media
      MEDIA_BASE_URL: http://localhost:8000/media
      RESEND_API_KEY: ${RESEND_API_KEY}
      EMAIL_TO: temimaedgar@gmail.com
      EMAIL_FROM: no-reply@temima.local
      AUTH_JWT_SECRET: ${AUTH_JWT_SECRET}
      CORS_ORIGINS: http://localhost:5173
    volumes: ["./backend:/app"]
    ports: ["8000:8000"]
    depends_on: [db]
  web:
    build: ./frontend
    environment:
      VITE_API_BASE_URL: http://localhost:8000/api
      VITE_PHONE: 7477179328
      VITE_EMAIL: temimaedgar@gmail.com
    volumes: ["./frontend:/app"]
    ports: ["5173:5173"]
    depends_on: [api]
  mailhog:
    image: mailhog/mailhog
    ports: ["1025:1025", "8025:8025"]
```

### H.6 Env samples

**backend/.env.example**

```
PORT=8000
DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/temima
RESEND_API_KEY=...
EMAIL_TO=temimaedgar@gmail.com
EMAIL_FROM=no-reply@yourdomain.com
AUTH_JWT_SECRET=supersecret # or AUTH_JWKS_URL=https://auth/.well-known/jwks.json
MEDIA_BASE_URL=http://localhost:8000/media
MEDIA_ROOT=./media
CORS_ORIGINS=http://localhost:5173
```

**frontend/.env.example**

```
VITE_API_BASE_URL=http://localhost:8000/api
VITE_PHONE=7477179328
VITE_EMAIL=temimaedgar@gmail.com
```

### H.7 Deployment

* **API:** Containerize and deploy to VPS/Render/Fly.io; mount persistent `media/`; set env vars; restrict CORS to prod web origin.
* **Web:** Deploy Vite build to Netlify/Vercel or an Nginx static site; `VITE_API_BASE_URL` → `https://api.temimaphoto.com/api`.
* **Domains:** `www.temimaphoto.com` (web) and `api.temimaphoto.com` (API). Enforce HTTPS.

---

## I) Open Items

* Pick **Logo** (Logo vs Logo 2 vs simplified mark)
* Portfolio categories (v1 can be "All" only)
* Social links (IG assumed)
* Optional: typical turnaround time to display

---

## J) Versioning

* v0.2 — Converted to **internal** brief + added SMS confirmation block; added tokens JSON.
