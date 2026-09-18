# Repository Guidelines

## Project Structure & Module Organization
- `backend/app/` contains the FastAPI service (`main.py`), API routes (`api/routes.py`), auth/config, and domain services in `services/`.
- `backend/tests/` contains Python test coverage for core engine logic, API scopes, onboarding, approvals, and tenant isolation.
- `frontend/src/app/` contains Next.js App Router pages; shared UI lives in `frontend/src/components/`, and API helpers in `frontend/src/lib/`.
- `supabase/migrations/` stores the Postgres/RLS target schema used for production migration planning.
- Root docs (`README.md`, `prd.md`, `mrd.md`, `tech_func.md`) describe product and architecture context.

## Build, Test, and Development Commands
- Backend setup: `python -m pip install -e ".[dev]"`
- Run backend locally: `python main.py` (serves API at `http://localhost:8000`)
- Run backend tests: `python -m pytest backend/tests/ -q`
- Frontend setup: `cd frontend && npm ci`
- Run frontend dev server: `cd frontend && npm run dev`
- Frontend quality/build checks: `cd frontend && npm run lint` then `npm run build`

## Coding Style & Naming Conventions
- Python: 4-space indentation, type hints where practical, `snake_case` functions/variables, `PascalCase` classes.
- TypeScript/React: follow ESLint + Next.js defaults, `PascalCase` components (e.g., `ApprovalsTable.tsx`), `camelCase` helpers/hooks.
- Keep modules focused: business rules in `backend/app/services/`; transport logic stays in API route handlers.
- Prefer explicit, deterministic financial calculations; do not move money math into LLM-generated logic.

## Testing Guidelines
- Framework: `pytest` with `pytest-asyncio` (configured via `pyproject.toml`).
- Add tests in `backend/tests/` with names `test_*.py`; keep one behavioral concern per test.
- When changing API behavior, update/add endpoint tests plus related domain-service tests.
- For frontend changes, run `npm run lint` and `npm run build` before opening a PR.

## Commit & Pull Request Guidelines
- Use short, imperative commit subjects (e.g., `Add tenant guard to approvals route`).
- Group related backend/frontend changes in a single PR only when they ship one feature.
- PRs should include: summary, impacted paths, test evidence (commands + results), and screenshots/GIFs for UI changes.
- Link relevant issue/task IDs and highlight config/env changes (for example, additions to `.env.example`).

## Security & Configuration Tips
- Copy `.env.example` to local env files; never commit real secrets or production tokens.
- Validate tenant/auth behavior for any new endpoint (organization scoping must fail closed).
- Keep demo-seed behavior opt-in and non-destructive.