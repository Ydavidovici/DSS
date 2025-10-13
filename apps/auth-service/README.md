# DSS Auth Service

A stateless authentication microservice for DSS. It issues short‑lived **access tokens** and rotating **refresh tokens**, publishes a **JWKS** for verification, and cleanly supports **multiple frontends** via an allow‑listed `redirect_uri`. User data (password hashes, verified flags, roles) lives in a separate **DB Service**; this service uses **Redis** for refresh rotation, session indexing, and small caches.

---

## Features

- **Register → Email Verify** — sends a 
verification link that hits this service; 
can optionally **redirect** to a client 
`redirect_uri` if allow‑listed.
- **Forgot / Reset Password** — emails a reset 
token (or a link to a client `redirect_uri`); 
on reset, **revokes all sessions** for that user.
- **Login / Refresh / Logout** — Access 
JWT (~15m) + HttpOnly Refresh JWT (~7d) 
with **rotation & reuse detection**.
- **Introspection & UserInfo** — `GET /verify` and 
`GET /userinfo` for resource servers / clients.
- **JWKS & OIDC Discovery** — `/.well-known/jwks.json` 
and `/.well-known/openid-configuration`.
- **Multi-frontend** — clients pass 
`redirect_uri`; service validates against an allowlist stored in Redis.
- **Rate Limiting** — per‑IP **and** per‑account 
login limiting; per‑email reset limiting; per‑token 
refresh limiting.
- **Key Management** — on‑disk RSA keys, `CURRENT_KID` 
rotation, JWKS cache bust.

---

## What this service is agnostic of

- **Frontend/UI:** Any number of frontends can 
integrate, as long as their origins are allow‑listed.  
- **Client routing:** Verification/reset flows can 
redirect to any approved `redirect_uri` (or just send tokens).  
- **DB schema (beyond required fields):** This service 
only depends on a few fields (see DB Service below).

---

## Architecture & Tokens

### Access Token (header `typ=at+jwt`)
- `alg=RS256`, `kid` present  
- Claims include: `iss`, `aud`, `exp`, `iat`, 
plus `sub` (user id), `roles`, `preferred_username`, 
`email`  
- TTL: ~15 minutes (configurable)

### Refresh Token (header `typ=rt+jwt`)
- `alg=RS256`, `kid` present  
- Claims include: `iss`, `aud`, `exp`, `iat`, 
plus `sub` (user id), `jti` (unique)  
- TTL: ~7 days (configurable)

### Rotation & Reuse Detection
On refresh, the old `jti` is **blacklisted** and 
removed from the allowlist; a new `jti` is issued and 
stored.

### Key Rotation
Multiple keys live side‑by‑side. New tokens use 
`CURRENT_KID`; verifiers rely on JWKS.

---

## External Dependencies

### DB Service (required)

This service delegates user data to the DB Service. 
Expected endpoints:

- `POST /users` — create `{ username, email, password_hash }`
- `GET  /users/:username` — fetch user by **username**
- `GET  /users/email/:email` — fetch user by **email**
- `PATCH /users/:username` — set `{ verified: true, 
verified_at }` for email verification
- `PATCH /users/:id` — update `{ password_hash }` 
during password reset

### Redis (required)

Keys used:

- `refresh:{jti}` → `"1"`; TTL = refresh lifetime 
(allowlist for active refresh tokens)  
- `blacklist:{jti}` → `"1"`; TTL until token expiry 
(revoked tokens / reused tokens)  
- `uid:{userId}:sessions` → **Set** of JTIs (lets 
you revoke **all** sessions on password reset)  
- `jwks` → Cached JWKS JSON; TTL ~1h  
- `redirects:allow` → **Set** of allowed origins 
(e.g., `https://app1.example.com`)

### SMTP (required in prod)

Configured via `utils/mailer.ts` (Nodemailer). 

---

## Endpoints

### Lifecycle

- `POST /register`  
  **Body:** `{ username, password, email, redirect_uri? }`  
Creates user and emails a verification link that hits 
`GET /verify-email`. If `redirect_uri` is allow‑listed,  
it’s embedded and used after success.

- `GET /verify-email?token=...`  
Verifies email (`verified=true`, `verified_at`), 
then *optionally* redirects to the embedded allow‑listed 
`redir` (adds `?status=verified`).

- `POST /forgot-password` *(rate‑limited by email)*  
  **Body:** `{ email, redirect_uri? }`   
Sends a reset token. If `redirect_uri` is allow‑listed, 
the email includes a direct reset link with `?token=`.

- `POST /reset-password` *(rate‑limited)*  
  **Body:** `{ token, newPassword }`  
  Updates hash and **revokes all sessions** for the 
  user (deletes allow‑listed JTIs and blacklists them 
  until expiry).

### Auth

- `POST /login` *(per‑IP + per‑account rate limits)*  
  **Body:** `{ username, password }`   
    Returns `{ accessToken }`; sets `refresh_token` 
    HttpOnly cookie.

- `POST /refresh` *(rate‑limited by token hash)*  
  **Cookie:** `refresh_token`  
  Rotates refresh token (blacklists old `jti`, issues new),
  returns `{ accessToken }`.

- `POST /logout`  
  Revokes the current refresh token (blacklists its 
  `jti`, removes from allowlist) and clears the cookie.

### Read / OIDC

- `GET /verify` *(protected by `requireAuth`)*  
  Returns `{ user: <access token payload> }`; optionally 
  checks `jti` revocation if you add one to ATs.

- `GET /userinfo` *(protected by `requireAuth`)*  
  Returns OIDC‑ish claims `{ sub, preferred_username, 
  roles, email }`.

- `GET /.well-known/jwks.json`  
  Public JWKS for verifiers (includes `kid`, 
  `alg=RS256`, `use=sig`).

- `GET /.well-known/openid-configuration`  
  Minimal OIDC discovery document. `issuer` is 
  `JWT_ISSUER`.

---

## Multi‑Frontend Support

- Clients can pass `redirect_uri` to `/register` and
 `/forgot-password`.
- The service validates `redirect_uri` against Redis 
set `redirects:allow`.  
  Bootstrap from env `ALLOWED_REDIRECTS` (comma‑separated) or manage dynamically:
  - `kv.addAllowedRedirect("https://app1.example.com")`
  - `kv.removeAllowedRedirect("https://app1.example.com")`

**CORS** is separate but related: the gateway 
pulls origins from Redis or `CORS_ORIGINS` for 
browser requests with credentials.

---

## Security

- **Rate Limiting**
  - Login: per‑IP **and** per‑account; failed logins 
    count (skip successful).
  - Forgot/Reset: by email (fallback IP).
  - Refresh: by refresh token (SHA‑256 hash), fallback IP.
- **Cookies**
  - Refresh token is `HttpOnly`.
  - `SameSite=lax` by default. For cross‑site SPAs, 
     set `COOKIE_SAMESITE=none` and use HTTPS 
    (`secure=true`).
- **CORS**
  - Dynamic allowlist; `credentials: true`. 
    Deny unknown origins.
- **CSRF**
  - If `SameSite=None`, consider requiring a 
    header (e.g., `X-Requested-With`) for `/refresh`.
- **Key Rotation**
  - Use the CLI in `utils/keyManagement.ts`.
  - Don’t revoke keys needed to verify unexpired tokens. 
    Rotate (`CURRENT_KID`) first, then revoke after the
    longest token TTL passes.

---

## Environment

Create a `.env` (or inject via your orchestrator):

```env
PORT=4000

# Redis
REDIS_URL=redis://localhost:6379

# DB service (internal)
DB_SERVICE_URL=http://localhost:3002

# JWT / OIDC
JWT_ISSUER=https://auth.localhost:4000
JWT_AUDIENCE=dss-services
CURRENT_KID=auth_rsa
JWKS_PATH=./src/keys
RSA_MODULUS_BITS=3072

# Cookies / CORS
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=
CORS_ORIGINS=                     # optional bootstrap; otherwise use Redis allowlist
NODE_ENV=development

# Redirect allowlist bootstrap (comma-separated origins)
ALLOWED_REDIRECTS=https://app1.localhost:3000,https://app2.localhost:3000

# SMTP
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
```

---

## Quickstart

### Install
```bash
# bun
bun install

# or npm / pnpm
npm install
# pnpm install
```

### Generate keys
```bash
# using tsx (or ts-node) – adjust to your runner
bunx tsx src/utils/keyManagement.ts generate auth_rsa
# or
npx tsx src/utils/keyManagement.ts generate auth_rsa
```

### Allow your frontend origins
Set `ALLOWED_REDIRECTS` in `.env` **or** add at runtime via `kv.addAllowedRedirect(...)`.

### Run
```bash
# dev example (adjust to your scripts)
bunx tsx src/index.ts
# or
bun run dev
# or
npm run dev
```

### Try it
```bash
# register
curl -X POST http://localhost:4000/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"s3cret","email":"a@ex.com","redirect_uri":"https://app1.localhost:3000/auth/verified"}'

# login
curl -i -X POST http://localhost:4000/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"s3cret"}'
# -> access token in JSON, refresh token in HttpOnly cookie
```

---

## Implementation Notes

- **Middleware** — `requireAuth()` protects read endpoints; 
    supports future role checks.
- **Validation** — add `zod`/`joi` 
    for payloads (email format, password policy).
- **Observability** — log errors (without secrets).
    Consider metrics (Prometheus/OpenTelemetry).
- **Testing** — unit test JWT utils and key 
    rotation; integration test login/refresh and revoke‑all on reset.

---

## Route Summary

| Method | Path                                | Notes                                                     |
|:------:|-------------------------------------|-----------------------------------------------------------|
|  POST  | `/register`                         | Create user, send verify email (optional `redirect_uri`)  |
|  GET   | `/verify-email?token=...`          | Mark verified; optional redirect to allow‑listed `redir`  |
|  POST  | `/forgot-password`                  | Email reset token or link                                 |
|  POST  | `/reset-password`                   | Set new password; **revoke all sessions**                 |
|  POST  | `/login`                            | Return `{ accessToken }`; set refresh cookie              |
|  POST  | `/refresh`                          | Rotate refresh; return new `{ accessToken }`              |
|  POST  | `/logout`                           | Revoke current refresh; clear cookie                      |
|  GET   | `/verify`                           | *(requireAuth)* Return verified access payload            |
|  GET   | `/userinfo`                         | *(requireAuth)* OIDC‑style user info                      |
|  GET   | `/.well-known/jwks.json`            | Public JWKS                                               |
|  GET   | `/.well-known/openid-configuration` | Discovery doc                                             |

---

## Suggested `package.json` Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "bun run src/index.js",
    "key:generate": "tsx src/utils/keyManagement.ts generate",
    "key:rotate": "tsx src/utils/keyManagement.ts rotate",
    "key:list": "tsx src/utils/keyManagement.ts list",
    "key:revoke": "tsx src/utils/keyManagement.ts revoke",
    "key:show-active": "tsx src/utils/keyManagement.ts show-active"
  }
}
```