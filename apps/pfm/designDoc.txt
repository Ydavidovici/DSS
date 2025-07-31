## 1. Overview

**Purpose:** Define requirements, architecture, and roadmap for a web-based Personal Finance Manager MVP to upload bank statements, record transactions, and provide budgeting insights. This will be a small, iterative project with potential integration into an existing Python-based trading bot.

**Scope:**

* Upload and parse bank statements (CSV/PDF).
* Categorize and record transactions.
* Create budgets and track spending vs. budget.
* Visualize spending, flag overspending.
* Expose REST API for integration with Python trading bot.

---

## 2. User Stories & Use Cases

1. **As a user**, I want to upload my bank statement so that I can import transactions automatically.
2. **As a user**, I want to review and categorize transactions for accurate budgeting.
3. **As a user**, I want to set monthly budgets per category and get alerts when I approach or exceed them.
4. **As a user**, I want to view summary dashboards (spending by category, trends over time).
5. **As a developer**, I want a REST endpoint to fetch transaction data for my trading bot.

---

## 3. Functional Requirements

* **Statement Upload**: Accept CSV and/or PDF uploads; parse to structured data.
* **Transaction Management**: CRUD operations on transactions; category assignments with suggestions.
* **Budgeting Module**: Create budgets, allocate amounts by category, track actual vs. planned.
* **Notifications**: Email or in-app alerts for overspending or budget milestones.
* **Reporting & Visualization**: Charts for spending trends, category breakdowns.
* **API**: Secure RESTful API endpoints for data retrieval and sync.

---

## 4. Non-Functional Requirements

* **Security**: HTTPS, input validation, secure file handling.
* **Performance**: Fast parsing of statements; database optimized for read-heavy dashboards.
* **Scalability**: Modular, feature-based structure to balance organization without microservices overhead. Example file structure (pseudocode):

```text
apps/
  auth/
  ds-frontend/
  klvn-frontend/
  pfm-service/
    Dockerfile
    requirements.txt
    src/
      main.py            # FastAPI app entrypoint
      routers/           # HTTP route handlers
        auth.py          # (optional) reuse shared auth or extend
        statements.py    # file upload & parsing endpoints
        transactions.py  # CRUD for transactions
        budgets.py       # CRUD for budgets & alerts
        reports.py       # dashboard & analytics routes
      services/          # business logic and processing
        parser.py        # CSV/PDF statement parsing
        transaction_service.py
        budget_service.py
      models/            # Pydantic & ORM models
        user.py
        transaction.py
        budget.py
      common/            # shared code within PFM service
        db.py            # database session/util
        utils.py         # helper functions
    templates/          # Jinja2/HTMX views
      base.html
      dashboard.html
      upload.html
      transactions.html
      budgets.html
    static/             # CSS/JS assets
      css/
        tailwind.css
      js/
        htmx.min.js
```

* **Maintainability**: Clear code structure, tests, documentation.

---

## 5. System Architecture

* **Monorepo Integration**: Add a new FastAPI service under `apps/pfm-service` in your existing `ds.klvn` repo. Leverage shared utilities and config (`shared/config/db.ts` can be replaced or complemented with Python `shared/db.py`). Update `docker-compose.yml` and `nginx/default.conf` to expose the new service (e.g. `pfm-service:8000` at `/pfm/`).

* **Frontend**: Server-rendered templates (FastAPI’s Jinja2 templating) with Tailwind CSS and HTMX for interactivity, delivered by the `pfm-service` container—no separate JS-first frontend app required.

* **Backend**: Python (FastAPI) service in `apps/pfm-service` (Dockerfile, requirements.txt).

* **Database**: PostgreSQL shared via the existing `docker-compose.yml` (reuse or provision a new volume `pfm_db`).

* **Storage**: local disk or attached volume defined in `docker-compose.yml` for uploaded statements.

---

## 6. Technology Stack Decision

| Layer    | Options                                    | Recommendation                                                     |
| -------- | ------------------------------------------ | ------------------------------------------------------------------ |
| Frontend | Server-rendered (Jinja2/Templating) + HTMX | Tailwind CSS with minimal JavaScript and HTMX-driven interactivity |
| Backend  | FastAPI                                    | FastAPI (Python)                                                   |
| Database | PostgreSQL, MySQL, SQLite                  | PostgreSQL (SQLite for MVP)                                        |
| Auth     | JWT, OAuth2                                | JWT with optional OAuth2 later                                     |

**Rationale:** FastAPI pairs well with Python trading bot, offers automatic docs and high performance.

---

## 7. Data Flow

1. User uploads statement → Frontend sends file → Backend parses → Transactions stored.
2. User reviews/categorizes → Frontend updates categories via API → Database updated.
3. Budget set → Backend stores budgets → Periodic job calculates usage.
4. Dashboard fetches aggregates via API.

---

## 8. UI/UX Outline

* **Landing/Dashboard**: Summary cards (total spend, budget status).
* **Upload Page**: Drag-and-drop or file selector.
* **Transactions View**: Table with filtering, inline categorization.
* **Budget View**: Category list with progress bars.
* **Reports**: Charts for trends.

---

## 9. Integration Points

* **REST API**: `/api/transactions`, `/api/budgets`, `/api/reports`.
* **Webhooks**: Optional notifications to trading bot when new data arrives.

---

## 10. Security & Compliance

* Encrypt sensitive data at rest.
* Validate & sanitize file uploads.
* Follow OWASP guidelines.

---

## 11. Roadmap & Milestones

1. **Week 1**: Setup repo, choose stack, scaffold frontend & backend.
2. **Week 2**: Implement CSV upload & parsing; basic transaction model.
3. **Week 3**: Build transaction review UI + categorization.
4. **Week 4**: Budget CRUD + dashboard visualization.
5. **Week 5**: API endpoints and trading bot integration demo.

---

## 12. Testing & Deployment Strategy

* **Testing**: Unit tests for parsing logic, API tests with pytest.
* Deployment on minipc for now, server later
* **Monitoring**: Sentry for error tracking.

