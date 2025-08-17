# DSS DB Service — API (Users Module)

**Base URL:** `http://db-service:4000`

**Versioned root:** `/api/v1`

**Health:** `GET /healthz` → `{ "ok": true }`

> This file documents the **Users** endpoints that currently exist. It’s meant as a quick reference while building other services.

---

## Auth model (service→service JWT)

The service validates **RS256** JWTs (PEM mode) via the `requireAuth` Fastify plugin.

**Required claims**

* `iss` must equal **`AUTH_ISSUER`**
* `aud` must equal **`AUTH_AUDIENCE`** (default: `db-service`)
* For **internal** service-to-service routes, `azp` must equal **`AUTH_SERVICE_AZP`** (default: `auth-service`)
* Scopes may be supplied via either:

    * `scope` (space-separated string), **or**
    * `permissions` (array of strings)

**Authorization header**

```
Authorization: Bearer <access_token>
```

**Example JWT payload (minimal)**

```json
{
  "typ": "access",
  "scope": "users:read users:create users:update users:delete user.verify:password",
  "azp": "auth-service",
  "iss": "https://issuer.example",
  "aud": "db-service",
  "sub": "client_auth",
  "iat": 1710000000,
  "exp": 1710000600
}
```

---

## Common types

### User (sanitized)

> All reads return sanitized users (no `password_hash`).

```ts
User {
  id: string;                // UUID or numeric string
  username: string;          // ^[A-Za-z0-9_]{3,32}$
  email: string;             // RFC email, ≤ 254
  verified: boolean;
  roles: any[];              // opaque array (service-defined)
  created_at: string;        // ISO 8601
  updated_at: string;        // ISO 8601
  deleted_at: string | null; // null for active
}
```

### Error envelope

```json
{
  "error": { "code": "STRING", "message": "Human message" }
}
```

Validation errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": [ /* zod issues */ ]
  }
}
```

### ID parameter

`id` accepts **UUID** or **numeric string** (normalized to string).

---

## Endpoints

### 1) Internal sanitized reads (service→service)

Internal endpoints require `azp=AUTH_SERVICE_AZP` and the scopes below.

#### GET `/internal/auth/users/:username`

* **Scope:** `users:read`
* **Auth:** service JWT (see above)
* **Params:** `username` (regex `^[A-Za-z0-9_]{3,32}$`)
* **200 →** `User`
* **404 →** `{ error: { code: "NOT_FOUND" } }`

**cURL**

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://db-service:4000/internal/auth/users/alice
```

#### GET `/internal/auth/users/email/:email`

* **Scope:** `users:read`
* **Auth:** service JWT
* **Params:** `email` (valid email ≤ 254)
* **200 →** `User`
* **404 →** `{ error: { code: "NOT_FOUND" } }`

**cURL**

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://db-service:4000/internal/auth/users/email/a@ex.com
```

---

### 2) Internal password verification

Avoids ever exposing `password_hash` outside the DB service.

#### POST `/internal/auth/verify-password`

* **Scope:** `user.verify:password`
* **Auth:** service JWT
* **Body:**

  ```json
  { "usernameOrEmail": "alice", "password": "s3cret12" }
  ```

    * `usernameOrEmail`: string (3–254)
    * `password`: string (8–200)
* **200 →**

  ```json
  { "ok": true, "user": { /* sanitized User */ } }
  ```
* **401 →** `{ "ok": false }` (unknown user **or** bad password)
* **400 →** validation error envelope

**cURL**

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"usernameOrEmail":"alice","password":"s3cret12"}' \
  http://db-service:4000/internal/auth/verify-password
```

---

### 3) Writes (service→service only)

All write routes require `azp=AUTH_SERVICE_AZP` and the listed scopes.

#### POST `/api/v1/users`

* **Scope:** `users:create`
* **Rate limit:** `20 / minute`
* **Body:** one of password **or** password\_hash is required (mutually exclusive)

  ```json
  {
    "username": "bob",
    "email": "b@ex.com",
    "password": "hunter22",
    "verified": false,
    "verified_at": "2024-01-01T00:00:00.000Z",
    "roles": []
  }
  ```

  Constraints:

    * `username`: ^\[A-Za-z0-9\_]{3,32}\$
    * `email`: valid, ≤ 254
    * `password`: 8–200 **or** `password_hash`: 20–255
* **201 →** `User` (sanitized)
* **409 →** `{ error: { code: "CONFLICT", message: "Username or email already exists" } }`
* **400 →** validation
* **401/403 →** auth/scope/azp failure

**cURL**

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"bob","email":"b@ex.com","password":"hunter22"}' \
  http://db-service:4000/api/v1/users
```

#### PATCH `/api/v1/users/:id`

* **Scope:** `users:update`
* **Params:** `id` (UUID or numeric string)
* **Body:** at least one field; `password` and `password_hash` are mutually exclusive

  ```json
  { "verified": true }
  ```

  or

  ```json
  { "roles": ["admin"], "password_hash": "<bcrypt>$2b$..." }
  ```
* **200 →** `User` (sanitized)
* **404 →** `{ error: { code: "NOT_FOUND" } }`
* **409 →** conflict mapping (e.g., duplicate username/email)
* **400 →** validation

**cURL**

```bash
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"verified":true}' \
  http://db-service:4000/api/v1/users/00000000-0000-0000-0000-000000000001
```

#### DELETE `/api/v1/users/:id`

* **Scope:** `users:delete`
* **Params:** `id` (UUID or numeric string)
* **204 →** empty body
* **404 →** `{ error: { code: "NOT_FOUND" } }`

**cURL**

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://db-service:4000/api/v1/users/00000000-0000-0000-0000-000000000001
```

---

## Notes & guidance

* **Sanitization:** All outward user payloads remove `password_hash`.
* **Enumeration safety:** `verify-password` uses `401` for both unknown user and wrong password.
* **Public reads:** If you enable public reads in the future, gate with end-user auth and heavy rate limiting.
* **Conflicts:** Database unique violations (e.g., username/email) map to `409 CONFLICT`.
* **Validation:** Zod schemas enforce formats and mutually-exclusive password fields across create/update.

---

## Quick checklist when integrating another service

* Include `azp=AUTH_SERVICE_AZP` and the needed scopes in the issued JWT.
* Use **internal** routes for username/email lookups and password verification.
* For user creation, send either `password` **or** `password_hash`.
* Handle `409` for duplicates and `400` for validation errors.
* Expect sanitized user objects in all responses.
