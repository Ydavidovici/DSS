# Moments by Temima

A minimalist photography site for up-and-coming photographer **Temima** — **Vue 3 + Tailwind** frontend and **FastAPI** backend.

- Portfolio grid fed by the API
- Call/Text CTAs + simple contact form
- Light, soft-pastel theme; fast + accessible

## Dev Quickstart
API: `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cp .env.example .env && uvicorn app.main:app --reload --port 8000`  
Web: `cd frontend && cp .env.example .env && npm i && npm run dev`

Env highlights: `VITE_API_BASE_URL`, `VITE_PHONE`, `VITE_EMAIL`, `DATABASE_URL`, `EMAIL_FROM`, `EMAIL_TO`, `AUTH_JWT_SECRET`.
