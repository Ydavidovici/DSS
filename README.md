# Davidovici Software Services (DSS)

A modular, microservices-based monorepo 
powering Davidovici Software’s array of apps 
and services. This root README outlines the 
overall architecture, how to get everything up 
and running, and where to find more details on 
each individual service.

---

## 📦 Repository Structure

```
/
├── apps/
│   ├── auth/              # Central authentication microservice (Fastify, TypeScript, Knex, Zod, Pino)
│   ├── db-service/        # Shared database service (Fastify, Knex, PostgreSQL, Redis caching)
│   ├── ds-frontend/       # Static marketing site (Bun, TypeScript optional)
│   ├── klvn-frontend/     # Kehilas Lev Vnefesh site (Express + templating)
│   ├── pfm/               # Personal Finance Manager app (Node.js, Vue or React)
│   └── Trading-bot/       # Trading Bot designed to automatically make trades to earn money
├── .env.example           # Root‐level environment variable template
├── ecosystem.config.js    # PM2 process definitions for production or staging
├── README.md              # ← You are here
└── scripts/               # Helper scripts (build, lint, deploy, migrations, etc.)
```

---

## 🚀 Getting Started

### Prerequisites

* **Node.js** ≥ 18.x (LTS)
* **Bun** ≥ 1.x (for ds-frontend)
* **PostgreSQL** ≥ 13.x
* **Redis** ≥ 6.x
* **npm**

### Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/Ydavidovici/dss.git
   cd dss
   ```

2. **Copy & update your .env**

   ```bash
   cp .env.example .env
   # Fill in DB URLs, JWT secrets, API keys, etc.
   ```

3. **Install root‐level dependencies**

   ```bash
   npm install
   ```

4. **Bootstrap individual services**
   Each service lives under `apps/`. From the repo root you can:

   ```bash
   # e.g. for auth service
   cd apps/auth
   npm install
   npm run migrate    # runs Knex migrations
   npm run dev        # starts Fastify on port 4000 by default

   # in a new shell, for db-service
   cd ../../apps/db-service
   npm install
   npm run migrate
   npm run dev        # starts Fastify on port 4001
   ```

   Repeat for each app—see that app’s own README for details.

5. **Run all services together**
   From the root, with PM2 configured:

   ```bash
   npx pm2 start ecosystem.config.js
   npx pm2 logs
   ```

---

## 🏗️ Architecture Overview

* **Auth Service**
  Handles registration, login, JWT issuance/verification. Exposes REST endpoints under `/auth`. Shared by all frontends and other microservices.

* **DB Service**
  Centralized data-access API using Fastify + Knex. Implements common models (users, roles) and can be extended. Provides caching via Redis for read-heavy endpoints.

* **Frontends**

    * **ds-frontend**: Static marketing site (built/deployed via Bun).
    * **klvn-frontend**: Dynamic Express-based site for synagogue schedules.
    * **pfm**: Personal Finance Manager (SPA with React or Vue).

* **Other Apps**
---

## 🔄 Common Workflows

* **Lint & Format**

  ```bash
  npm run lint
  npm run format
  ```

* **Database Migrations**

  ```bash
  # In any service that uses Knex
  npm migrate:latest
  npm migrate:rollback
  ```

* **Testing**

  ```bash
  npm test        # runs Jest across services
  ```

* **Building for Production**

  ```bash
  # Example for ds-frontend
  cd apps/ds-frontend
  bun build
  ```

---

## 🤝 Contributing

1. Fork the repo & create a feature branch (`git checkout -b feature/xyz`)
2. Commit your changes with clear messages
3. Open a PR against `main` with description & testing steps
4. Ensure CI passes (lint, tests, build)
5. On approval, your branch will be merged & deployed

---

## 📞 Contact & Support

* **Owner**: Yaakov Davidovici
* **Email**: [yaakov@davidovicisoftware.com](mailto:yaakov@davidovicisoftware.com)
* **Phone**: (973) 747-7186
* **Website**: [https://davidovicisoftware.com](https://davidovicisoftware.com)

---

## ⚖️ License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
