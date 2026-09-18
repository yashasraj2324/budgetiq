# Migrate BudgetIQ frontend from Next.js to Vite + React (repo root)

## Context

The preview iframe shows 502 because Enter's preview layer only auto-runs the
supported stack — **Vite + React + Tailwind + TypeScript at the project root**.
This project's UI is a Next.js App Router app nested in `frontend/`, which the
preview infrastructure cannot start.

Goal: convert the frontend to Vite + React at the repo root so the live preview
works. **All pages, UI, and behavior stay identical** — only tooling changes.

Key facts gathered from exploration:
- All pages are already `"use client"` (client-rendered), so a Vite SPA conversion is natural.
- Next.js APIs used: `next/link` `Link`, `next/navigation` `useRouter`/`useParams`, async `searchParams` prop (dashboard), `next/font/google` (layout), `process.env.NEXT_PUBLIC_*`.
- Design system is Tailwind v4 (`@import "tailwindcss"` + `@config`) with a Material-3 token set in `tailwind.config.ts` — reusable as-is.
- Backend (FastAPI :8000) stays untouched. A Vite dev proxy `/api → http://localhost:8000` lets the app call relative `/api`, which works from any preview origin.

## Implementation checklist

- [ ] Create root `package.json` (replace `frontend/package.json`): deps `react`, `react-dom`, `react-router-dom`, `recharts`; devDeps `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `typescript`, `@types/react`, `@types/react-dom`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`. Scripts: `dev: vite`, `build: tsc -b && vite build`, `lint: eslint`, `preview: vite preview`.
- [ ] Create root `vite.config.ts`: `@vitejs/plugin-react` + `@tailwindcss/vite`, `server: { port: 3000, strictPort: true, host: true, proxy: { "/api": "http://localhost:8000" } }`, alias `@` → `./src`.
- [ ] Create root `index.html`: title BudgetIQ, viewport, Google Fonts `<link>` for **Geist**, **JetBrains Mono**, **Material Symbols Outlined**, module script `/src/main.tsx`, stylesheet `/src/index.css`.
- [ ] Create root `tsconfig.json` (Vite React: `jsx: react-jsx`, `moduleResolution: bundler`, `paths: {"@/*": ["./src/*"]}`, `types: ["vite/client"]`) + `tsconfig.node.json` for `vite.config.ts`.
- [ ] Move `frontend/src/` → `src/` and rename `src/app/` → `src/pages/` (20 page files + layout removed).
- [ ] Move `frontend/src/app/globals.css` → `src/index.css`, fix `@config` path to `../tailwind.config.ts`.
- [ ] Move `frontend/tailwind.config.ts` → root `tailwind.config.ts`.
- [ ] Move `frontend/public/` → `public/` (keep only `favicon.ico`).
- [ ] Create `src/main.tsx`: `createRoot` + `<BrowserRouter>` + `<Routes>` (App.tsx).
- [ ] Create `src/App.tsx` with the full route table:
      `/` Login, `/signup`, `/reset-password`, `/onboarding`, `/onboarding/data`,
      `/onboarding/policies`, `/onboarding/priorities`, `/dashboard`,
      `/recommendations`, `/recommendations/:id`, `/approvals`, `/signals`,
      `/reports`, `/audit`, `/scenarios`, `/settings`, `/governance`,
      `/integrations`, `/billing`, `/budget-lines/:id`, `*` → Navigate to `/`.
- [ ] `src/lib/api.ts`: replace `process.env.NEXT_PUBLIC_*` with `import.meta.env.VITE_*`; default `API` to `/api` (relative, proxied).
- [ ] Replace `import Link from "next/link"` → `import { Link } from "react-router-dom"` in all pages + Shell (usage `href`→`to`, identical otherwise).
- [ ] Replace `import { useRouter } from "next/navigation"` → `import { useNavigate } from "react-router-dom"`; `router.push(x)` → `navigate(x)` in: login, onboarding (x3), recommendations (x2), recommendations/[id], signals, ApprovalsTable.
- [ ] `ApprovalsTable.tsx`: replace `.catch(() => router.refresh())` with `.catch(() => window.location.reload())`.
- [ ] `src/pages/budget-lines/[id].tsx` + `src/pages/recommendations/[id].tsx`: `useParams` from `react-router-dom` (same API).
- [ ] `src/pages/dashboard.tsx`: convert to client component — replace async `searchParams` prop with `useSearchParams` from `react-router-dom`; move the API fetch into `useEffect` with loading/error state (also fixes the previous server-side 401 bug).
- [ ] `src/components/Shell.tsx`: `process.env.NEXT_PUBLIC_AUTH_MODE` → `import.meta.env.VITE_AUTH_MODE`; `Link` import.
- [ ] Login + `reset-password`: `process.env.NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` → `import.meta.env.VITE_*`; update dev-token error message text.
- [ ] Root `.env`: add `VITE_API_URL=/api`, `VITE_AUTH_MODE=dev`, `VITE_DEV_AUTH_TOKEN=dev-token-for-local`, `VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=` (harmless to the backend's python-dotenv).
- [ ] Update `.env.example` and `README.md` frontend instructions (Vite + VITE_* vars, dev proxy).
- [ ] Delete `frontend/` directory and its Next.js leftovers (package-lock.json, next.config.ts, postcss.config.mjs, tsconfig.json, tests/, AGENTS.md, CLAUDE.md, .env.local).
- [ ] Create root `eslint.config.mjs` (flat config: `@eslint/js` + `typescript-eslint` recommended, react-hooks, react-refresh; ignores: dist, node_modules, backend).
- [ ] Stop the old Next.js dev server on :3000; install root deps with `pnpm install` (or `npm install`).

## Verification checklist

- [ ] `npm run lint` passes with zero errors.
- [ ] `npm run build` (tsc + vite build) succeeds — proves every page compiles under Vite.
- [ ] Backend on :8000 still healthy (`/api/health` → 200).
- [ ] Start `npm run dev` on :3000; `curl localhost:3000/` → 200 (login page HTML).
- [ ] Proxy works: `curl localhost:3000/api/health` → 200 (Vite → FastAPI).
- [ ] SPA fallback: `curl localhost:3000/dashboard` → 200 (not 404).
- [ ] Screenshot `http://localhost:3000/` renders the BudgetIQ login page (dev-mode auth), confirming the preview layer can now serve the app.
- [ ] Sign-in flow: with `VITE_AUTH_MODE=dev`, `/dashboard` fetches seeded data through the `/api` proxy (spot-check dashboard JSON via authenticated curl through the proxy).
