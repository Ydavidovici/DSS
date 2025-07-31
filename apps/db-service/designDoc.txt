# DB Service Design Doc

## 1. Overview & Objectives

* **Purpose**: Centralize all runtime data access via an HTTP/REST API microservice, abstracting direct database connections from client apps.
* **Learning goals**: Experience request/response latency, network bottlenecks, caching strategies, connection pooling, schema evolution, and operational challenges of a shared remote database.
* **Position**: We have an existing `db-service` scaffold (Bun/Node) and multiple client apps (`auth`, `pfm`, future ecommerce). Frontends do not currently use this service but we will onboard them.

---

## 2. Requirements & Constraints

### Functional

* Expose CRUD endpoints for core domains (users, products, orders, transactions, budgets).
* Support complex query parameters (filtering, pagination, sorting).
* JWT-based authentication/authorization integrated with `auth-service`.
* Consistent error-handling and HTTP status codes.
* Schema migrations and versioning via Knex or equivalent.

### Non-functional

* **Performance**: Measure and minimize latency; support 100+ req/s.
* **Scalability**: Stateless service, easy to horizontally scale.
* **Reliability**: Circuit-breaking on DB failures; retry/backoff strategies.
* **Observability**: Prometheus metrics, OpenTelemetry tracing.
* **Security**: Secure JWT verification, input validation, rate limiting.
* **Maintainability**: Clear module boundaries, documented API versioning.

---

## 3. Technology Decisions

| Aspect                                                                                                                                                | Choice                                                                | Rationale                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Language / Runtime                                                                                                                                    | TypeScript (Node.js)                                                  | Leverage TS for type safety and IDE support; minimal build overhead.                                                          |
| Web Framework                                                                                                                                         | Fastify                                                               | High performance, schema-based validation, plugin ecosystem.                                                                  |
| ORM / Query Builder                                                                                                                                   | Knex.js                                                               | Fine-grained SQL control and migrations.                                                                                      |
| Validation Library                                                                                                                                    | Zod                                                                   | Seamless TS integration, lightweight, expressive schemas.                                                                     |
| Logging Library                                                                                                                                       | Pino                                                                  | Fast JSON logging, low overhead, integrates with Fastify.                                                                     |
| API Documentation                                                                                                                                     | Manual README documentation                                           | Simple, flexible, no extra dependencies.                                                                                      |
| Testing Framework                                                                                                                                     | Jest + Fastify inject                                                 | Rich TS support, easy mocks, integrate with Fastify’s testing helper.                                                         |
| Secrets Management                                                                                                                                    | Environment variables                                                 | Simple, no external dependency.                                                                                               |
| Rate Limiting                                                                                                                                         | fastify-rate-limit with Redis backend                                 | Distributed rate limiting, enforce across scaled instances.                                                                   |
| CI/CD                                                                                                                                                 | Bash scripts + Docker Compose                                         | Lightweight, portable, version-controlled.                                                                                    |
| Deployment Strategy                                                                                                                                   | Docker Compose for staging; Bash scripts for orchestration            | Quick local iteration; evolve to Kubernetes later.                                                                            |
| API Versioning                                                                                                                                        | URL versioning (`/api/v1/`)                                           | Clear and widespread convention.                                                                                              |
| Cache Layer                                                                                                                                           | Redis (TTL, invalidation on writes)                                   | Central cache, high throughput.                                                                                               |
| -----------------------                                                                                                                               | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Language / Runtime                                                                                                                                    | JavaScript/TypeScript vs Python vs Go                                 | **Node.js/JavaScript**: event-driven, non-blocking I/O, massive ecosystem, fast iteration.                                    |
| **TypeScript**: adds static types, safer refactoring, IDE support (optional build step).                                                              |                                                                       |                                                                                                                               |
| **Python**: batteries-included standard library, easy scripting, slower throughput, GIL may limit concurrency.                                        |                                                                       |                                                                                                                               |
| **Go**: compiled binary, strong concurrency model, minimal runtime overhead, excellent for high-throughput services, steeper learning curve for ORMs. |                                                                       |                                                                                                                               |
| Web Framework                                                                                                                                         | Fastify vs Express                                                    | Fastify: schema-based validation, built-in hooks, superior performance under load.                                            |
| ORM / Query Builder                                                                                                                                   | Knex.js vs Prisma                                                     | Knex: fine-grained SQL control and migrations.                                                                                |
| Prisma: type-safe models, auto-generated client, but heavier around custom queries.                                                                   |                                                                       |                                                                                                                               |
| Migrations                                                                                                                                            | Knex Migrate vs Prisma Migrate                                        | Align with ORM choice: Knex Migrate for Knex, Prisma Migrate for Prisma.                                                      |
| Caching                                                                                                                                               | Redis vs in-memory                                                    | Redis: shared, distributed cache across instances; supports TTL, eviction.                                                    |
| Auth Integration                                                                                                                                      | Custom JWT vs passport-jwt                                            | Lightweight custom Fastify plugin for JWT verification against auth-service JWKS.                                             |
| Metrics & Tracing                                                                                                                                     | Prometheus + OpenTelemetry                                            | Prometheus for metrics; OpenTelemetry for distributed tracing and context propagation.                                        |
| Deployment                                                                                                                                            | Docker Compose vs Kubernetes                                          | Start simple with Docker Compose; evolve to Kubernetes as scale demands.                                                      |
| -----------------------                                                                                                                               | -------------------------------------                                 | ----------------------------------------                                                                                      |
| Language / Runtime                                                                                                                                    | JavaScript (ES202x) vs TypeScript                                     | TBD: tradeoffs below                                                                                                          |
| Web Framework                                                                                                                                         | Fastify vs Express                                                    | Fastify: better perf, built-in hooks.                                                                                         |
| ORM / Query Builder                                                                                                                                   | Knex.js vs Prisma                                                     | Knex: fine-grained SQL control; Prisma: strong typing.                                                                        |
| Migrations                                                                                                                                            | Knex Migrate vs Prisma Migrate                                        | Align with ORM choice.                                                                                                        |
| Caching                                                                                                                                               | Redis vs in-memory                                                    | Redis: shared cache across instances.                                                                                         |
| Auth Integration                                                                                                                                      | Custom JWT vs passport-jwt                                            | Lightweight: custom Fastify plugin.                                                                                           |
| Metrics & Tracing                                                                                                                                     | Prometheus + OpenTelemetry                                            | Both: metrics + distributed tracing.                                                                                          |
| Deployment                                                                                                                                            | Docker + Docker Compose vs Kubernetes                                 | Start with Docker Compose, evolve K8s.                                                                                        |

### Why consider JavaScript over TypeScript?

* **JS Pros**: Faster iteration, no build-step overhead, lower cognitive load.
* **TS Pros**: Type safety, autocompletion, fewer runtime errors, safer refactoring.
* **Decision point**: Do we value startup speed and minimal build complexity, or do we prioritize type safety given the learning focus on infra rather than types?

---

## 4. API Design

### Versioning

* All routes under `/api/v1/`
* Plan for `/api/v2/` when breaking schema changes.

### Resource endpoints (HTTP semantics)

* `GET /api/v1/users?page=&limit=&sort=`

* `POST /api/v1/users`

* `GET /api/v1/users/:id`

* `PATCH /api/v1/users/:id`

* `DELETE /api/v1/users/:id`

* Similarly for `/products`, `/orders`, `/transactions`, `/budgets`.

### Validation & Error Schema

* Use Zod or Joi for request payloads.
* Standardized error format:

  ```json
  {"error": {"code": "INVALID_INPUT", "message": "...", "details": {...}}}
  ```

---

## 5. Database Schema & Migrations

* **Approach**: Keep migrations in this repo’s `migrations/` folder.
* **Future**: If we choose shared-schema code-gen later, export DDL here.
* **Initial tables**: `users`, `products`, `orders`, `order_items`, `transactions`, `budgets`, `categories`.
* **Versioning**: Each migration file prefixed with timestamp; review rollback strategies.

---

## 6. Connection Pooling & Performance

* Pool size: 20–50 connections. Monitor `pg_stat_activity`.
* Idle timeout: 30s.
* Max query timeouts: 5s default.
* **Decision**: Should we tune auto-disconnect on idle, or add a keepalive ping?

---

## 7. Caching Strategy

* Redis for GET endpoints.
* Cache key patterns: `users:page:limit:sort`, `products:id`, `orders:userId`.
* TTL: 60s default, configurable per-route.
* Eviction: Invalidate on POST/PATCH/DELETE.

---

## 8. Observability, Error Handling & Logging

* **Error Handling**: introduce a centralized Fastify error handler to capture and normalize errors.  Map common error types to our standard schema:

  ```json
  {"error": {"code": "VALIDATION_ERROR", "message": "Request payload invalid", "details": {"field":"username"}}}
  ```

  * Categories: `VALIDATION_ERROR`, `NOT_FOUND`, `DB_TIMEOUT`, `UNAUTHORIZED`, `INTERNAL_ERROR`.
  * HTTP codes: 400 for validation, 404 for not found, 408 for timeouts, 401 for auth, 500 for everything else.

* **Logging**: use structured JSON logging (e.g. Pino or Bunyan):

  * Include fields: `timestamp`, `level`, `service`, `route`, `requestId`, `userId`, `errorCode`, `message`, `stack`.
  * Configure log level (`debug`, `info`, `warn`, `error`) via env var.
  * Correlate logs with request context (attach a unique `requestId` per HTTP call).

* **Metrics** (Prometheus): instrument the service to expose `/metrics`:

  * Counters: `http_requests_total{method,route,status}`
  * Histograms: `http_request_duration_seconds{method,route}`
  * Gauges: `db_pool_active_connections`, `cache_hits_total`, `cache_misses_total`
  * Counters for error types: `errors_total{type}`

* **Tracing** (OpenTelemetry): instrument:

  * HTTP routes (Fastify spans)
  * Outbound DB queries
  * Propagate context across middleware and plugins
  * Export to an OTEL collector or Jaeger for end-to-end visibility

---

## 9. Security

* JWT verification: reuse `auth-service` public JWKS URL.
* Rate limiting: Fastify’s rate-limit plugin (100 req/min per IP).
* Input sanitization: prevent SQL injection (via Knex parameterization).
* TLS termination at ingress (nginx).

---

## 10. Deployment & CI/CD

* **Dockerfile**: multi-stage build (bun install, build, run).
* **Compose**: `db-service`, `postgres`, `redis` in dev.
* **CI**: lint, test (supertest + pg-mem), `knex migrate:latest`, build image.
* **Staging**: run migrations → deploy containers behind `nginx`.

---

## 11. Next Steps & Decision Points

All major technology choices have been locked in:

* **Language**: TypeScript
* **Web Framework**: Fastify
* **ORM / Query Builder**: Knex.js
* **Validation**: Zod
* **Logging**: Pino
* **API Documentation**: Manual in README
* **Testing**: Jest with Fastify inject
* **Secrets Management**: Environment variables
* **Rate Limiting**: fastify-rate-limit with Redis
* **CI/CD**: Bash scripts + Docker Compose
* **Deployment**: Docker Compose for staging
* **API Versioning**: URL versioning (`/api/v1/`)
* **Cache Layer**: Redis

**Upcoming Milestones:**

1. **Scaffold Project**: Initialize repo, install dependencies, configure TS, Fastify, Knex.
2. **Define Migrations**: Create initial migration files for `users`, `products`, `orders`, `order_items`, `transactions`, `budgets`, `categories`.
3. **Implement `/users` Module End-to-End**:

   * Migration → Model → Service → Controller → Routes → Zod validation → Pino logging → Redis caching → Tests.
4. **CI/CD Setup**: Write bash scripts for linting, testing, migrations (`knex migrate:latest`), and Docker Compose orchestration.
5. **Instrumentation**: Add Prometheus metrics and OpenTelemetry tracing to HTTP routes and DB calls.
6. **Load Testing**: Use k6 or Artillery to simulate 100+ req/s, monitor latency, errors, pool saturation.
7. **Expand Modules**: Implement `/products`, `/orders`, etc., following the established pattern.
8. **Documentation**: Consolidate API endpoint details in README with examples for each resource.
9. **Review & Hardening**: Implement rate-limiting rules, configure environment variables, finalize error-handling schemas.
