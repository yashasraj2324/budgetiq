# BudgetIQ — UI/UX Audit & Remediation Plan

## Context

An executive-level UI/UX evaluation of the BudgetIQ web application, commissioned
ahead of the hackathon demo. The goal is a systematic, evidence-based assessment
across six dimensions — information architecture, interaction consistency,
visual hierarchy, perceived performance, accessibility (WCAG 2.1 AA), and
cross-device coherence — with severity-ranked friction points and remediation
actions. No code changes are executed under this plan; this document is the
deliverable.

**Methodology (stated honestly):** This is an **expert heuristic evaluation**,
not a user study. Evidence sources: (1) full source inspection of every page and
component, (2) live visual capture of the public auth pages at desktop 1280 and
mobile 390, (3) design-token and build-metric data. The authenticated interior
(dashboard, signals, approvals, audit, settings, etc.) is behind the login wall
and was assessed from code; any claim about interior pages is code-verified, not
pixel-verified. No interviews or usability sessions were run, so prevalence and
"user-reported" severity are estimated via established heuristics (Nielsen) and
WCAG 2.1 AA, not measured. Findings marked **[visual]** are confirmed in a
rendered capture; **[code]** are confirmed by source inspection.

---

## 1. Information Architecture & Navigational Clarity

**Verdict: core flows meet the three-click bar; secondary administration does not.**

- Core functions are 1–2 clicks from anywhere via the persistent sidebar
  (Dashboard, Recommendations, Approvals, Signals, Reports, Audit, Scenarios,
  Settings, Governance, Integrations, Import Data). **[code]**
- The recommendation journey is exemplary: dashboard "Resolve" → signals →
  auto-target → generate modal → detail page with trace → approve. 2 clicks to
  the decision point. **[code]**

### Friction points

| # | Finding | Severity | Evidence |
|---|---|---|---|
| IA-1 | **Settings is a 584-line single page** (org config, fiscal calendar, members, invitations, API keys, billing) with no in-page anchors or tabs. Finding "API keys" requires scrolling a long form page — a secondary admin function is more than 3 interactions to locate. | **High** | `src/pages/settings.tsx` (584 lines, six sections, no anchor nav) |
| IA-2 | **Flat 11-item sidebar with no grouping.** "Signals", "Scenarios", "Settings" are all S-nouns; there is no section hierarchy to scaffold recall. | Medium | `src/components/Shell.tsx` — single "Workspace" label, 11 flat links |
| IA-3 | **No breadcrumbs** on the two deep routes (budget-line detail, recommendation detail). Impact is minor because the hierarchy is one level deep. | Low | `src/pages/budget-lines/[id].tsx` renders a single "← Back to dashboard" link |

**Recommended interventions:**
- Convert Settings into tabbed sections (Workspace / Team & Access / API / Billing)
  or add a sticky in-page anchor list. Highest-impact IA fix.
- Group the sidebar into two sections — **Finance** (Dashboard, Signals,
  Recommendations, Approvals, Reports, Audit, Scenarios) and **Admin**
  (Governance, Settings, Integrations, Import Data) — with a divider label.
- Add breadcrumbs only if the hierarchy deepens; not required at one level.

---

## 2. Interaction Design Consistency

**Verdict: feedback and error recovery are above average; consistency across
touchpoints is fragmented.**

Strengths **[code]**: every mutation surfaces a message (`role="alert"` /
`role="status"`); destructive and guarded actions are server-validated with
inline errors; the AI-generate button shows a real in-progress state
("Running AI Reasoning…"); 401 redirects to login.

### Friction points

| # | Finding | Severity | Evidence |
|---|---|---|---|
| IX-1 | **Two design languages coexist.** The three onboarding steps (`data`, `priorities`, `policies`) use legacy plain-Tailwind styling (`bg-slate-50`, `text-blue-700`, `bg-amber-500`) while every other surface uses the Material-token design system. A judge's first experience after sign-up is visually inconsistent with the rest of the product. | **High** | `src/pages/onboarding/data.tsx`, `priorities.tsx`, `policies.tsx` vs token-based pages |
| IX-2 | **No skeleton/placeholder loaders** — interior pages flash bare text ("Loading dashboard…") before content arrives; with 5–6 requests on dashboard mount this reads as slowness. | Medium | `src/pages/dashboard.tsx`, `signals.tsx`, `reports.tsx` |
| IX-3 | **Session expiry is silent.** A 401 hard-redirects to `/` with no explanation; the user loses their place and is not told why. | Medium | `src/lib/api.ts` `apiFetch` |
| IX-4 | **Native `window.confirm()`** for scenario deletion breaks the visual and interaction language of the app. | Low | `src/pages/scenarios.tsx` `deleteScenario` |
| IX-5 | **Button label swaps** (icon/text change during loading) cause small layout shifts and no ARIA busy state on the modal confirm button. | Low | `src/pages/recommendations.tsx` generate button |

**Recommended interventions:**
- Restyle the three onboarding pages onto the token system (same card/input/button
  patterns as the rest of the app). Highest-consistency win, directly on the demo
  path.
- Replace text-loading states with lightweight skeleton rows on dashboard and
  signals tables.
- On 401, keep the redirect but add a "Your session expired — sign in again"
  status message (sessionStorage flag read by the login page).
- Replace `window.confirm` with a small in-app confirm dialog (or keep native as a
  deliberate, documented trade-off — it is honest but inconsistent).

---

## 3. Visual Hierarchy & Cognitive Load

**Verdict: strong hierarchy and data scannability; a few density and
color-dependency issues.**

Strengths **[code]**: metric cards use label-caps headings + numeric-metric-lg
values; status/anomaly chips pair an icon with text; severity badges pair color
with text ("Critical 3.2×"); consistent token spacing.

### Friction points

| # | Finding | Severity | Evidence |
|---|---|---|---|
| VH-1 | **Color-only encoding in the audit log's before→after budget cell** — the new value is communicated solely by `text-error` vs `text-primary`. Color-deficient users cannot distinguish an increase from a decrease. | Medium | `src/pages/audit.tsx` (lines ~164–170) |
| VH-2 | **Dashboard single-view density** — four metric cards + a six-column table + a chart on one viewport. Organized, but the "Pending Reviews" card mixes pending count, an anomaly pulse, and two links, competing for attention. | Low/Med | `src/pages/dashboard.tsx` |
| VH-3 | **No empty-state distinction between "no data" and "loading"** in a few tables (Recommendations lists "No recommendations yet" only after loading completes — correct, but the copy could offer the next action). | Low | `src/pages/recommendations.tsx` |

**Recommended interventions:**
- Add an explicit direction glyph (↑/↓ via lucide icons) next to the
  before→after values in the audit table so the change is never color-only.
- Split the Pending card's anomaly indicator into its own visual unit (it already
  has a pulse dot — give it a label like "N anomalies under review").
- Make the Recommendations empty state actionable: "No recommendations yet —
  Generate one" (it already links via the header CTA).

---

## 4. Performance & Perceived Smoothness

**Verdict: interaction animation is minimal and smooth; first-load performance is
the real problem.**

Strengths **[code]**: transitions are 150ms; the shell uses `overflow-hidden`
to prevent scroll chaining; the modal backdrop-blur is GPU-friendly; no
layout-shifting ads or third-party widgets.

### Friction points

| # | Finding | Severity | Evidence |
|---|---|---|---|
| PF-1 | **Single 1.43 MB JS chunk (284 KB gzipped), zero route-level code-splitting.** First meaningful paint is gated on the whole bundle — a real risk on demo-day machines and projectors. | **High** | `pnpm build` output: `index-BhOIEVfW.js 1,426.98 kB` |
| PF-2 | **N+1 server queries inflate perceived latency on first load.** `/dashboard` runs one anomaly query per budget line; `/anomalies` does the same; the dashboard chart additionally fetches anomalies + lines + forecast. A workspace with hundreds of lines will feel sluggish. | Medium | `supabase/functions/api/index.ts` dashboard + anomalies handlers |
| PF-3 | **No `prefers-reduced-motion` handling** — the pulsing anomaly dot and transitions ignore OS motion settings (also WCAG 2.3.3). | Low | `src/index.css` has no reduced-motion rules; `animate-pulse` in dashboard/signals |
| PF-4 | **Loading flash**: white/blank during auth redirect + bare text loading states compound perceived latency beyond actual latency. | Low | `src/pages/index.tsx` / dashboard loading branch |

**Recommended interventions:**
- Route-level code splitting (`React.lazy`) with `recharts` in a manually chunked
  vendor split. Target: shell first-load well under the current 1.43 MB.
- Consolidate the dashboard payload into a single gateway call (one endpoint that
  returns metrics + decorated lines + anomaly flags) to remove the per-line
  anomaly loop and the client's 5–6 parallel fetches.
- Add `@media (prefers-reduced-motion: reduce)` to disable the pulse and soften
  transitions, per WCAG 2.3.3.
- Prefer inline skeleton markup over text-only loading states (ties to IX-2).

---

## 5. Accessibility — WCAG 2.1 AA

**Verdict: semantics and keyboard operability are decent; contrast, focus
visibility, and unnamed icon controls fail AA.**

Strengths **[code]**: all interactive controls are native elements (keyboard
operable by default); forms use real `<label>`s; error/status messages use
`role="alert"` / `role="status"`; tables use proper `<thead>/<th>`; the priority
slider has an `aria-label`.

### Friction points

| # | Finding | Severity | Evidence |
|---|---|---|---|
| A11Y-1 | **`text-outline` (#737686) on surface (#f8f9ff) computes to ≈ 4.3:1 — below the 4.5:1 AA floor for normal text.** This token is used for secondary labels at 11–12 px across the app (nav labels, table headers, captions, timestamps). | **High** | `tailwind.config.ts` (`outline: "#737686"`), used site-wide as `text-outline`; luminance calc ≈ 4.33:1 |
| A11Y-2 | **No visible focus-visible styling anywhere.** `src/` contains zero `:focus` / `:focus-visible` rules; focus visibility is left to browser defaults, and several custom-styled links/buttons (e.g., `hover:underline` links) provide no authored focus indication. | High | `grep` over `src/` — no `:focus` matches |
| A11Y-3 | **Unnamed icon-only controls.** The generate-modal close button has no `aria-label` or `title` (its only child is a Material Symbol span). Screen readers announce nothing. | Medium | `src/pages/recommendations.tsx` `#btn-close-modal` |
| A11Y-4 | **`prefers-reduced-motion` not honored** (see PF-3). | Low | `src/index.css` |
| A11Y-5 | **Touch-target sizing below recommendation.** Sidebar nav rows are ~30 px tall (`py-space-sm` = 6 px); table action chips are smaller; below the 44/48 px guidance. On the interior app this compounds with the mobile layout issue (below). | Medium | `src/components/Shell.tsx` |
| A11Y-6 | Color-only change indication in audit (see VH-1) violates 1.4.1 Use of Color. | Medium | `src/pages/audit.tsx` |

**Recommended interventions (AA-gated):**
- Darken the `outline` token to ≥ 4.5:1 on surface (e.g., `#5f6373`-range) or
  elevate those labels to `on-surface-variant`. Verify with a contrast tool.
- Add a global `:focus-visible { outline: 2px solid <primary>; outline-offset: 2px }`
  rule in `index.css` (one line, app-wide).
- Add `aria-label="Close"` to the modal close button (and audit the remaining
  icon-only buttons for accessible names).
- Honor reduced motion (shared with PF-3).
- Enlarge nav rows (`py-2`+) and table action hit areas to ≥ 44 px when the
  responsive sidebar (section 6) lands.

---

## 6. Cross-Device Coherence

**Verdict: public/auth pages are genuinely responsive; the authenticated product
is desktop-only in practice.**

Verified **[visual]**: the login page at 390×844 renders cleanly — card fits,
inputs and button are full-width and comfortably tappable, no overflow or
horizontal scroll. The auth pages (login, signup, reset, accept-invitation) are
mobile-ready. The onboarding data page uses responsive grids (`sm:grid-cols-2`,
`max-w-4xl`).

### Friction points

| # | Finding | Severity | Evidence |
|---|---|---|---|
| XD-1 | **The sidebar never collapses.** `Shell.tsx` renders a fixed `w-[240px]` sidebar and `pl-[240px]` main with no breakpoint — at 390 px the content column is ~150 px wide. Tables scroll horizontally and most controls become unusable. The product is effectively broken on phones/tablets. | **High** | `src/components/Shell.tsx` |
| XD-2 | **No mobile navigation pattern** (no hamburger, no bottom nav, no collapsible rail) to preserve functional parity per breakpoint. | High | `src/components/Shell.tsx` |
| XD-3 | **Interior tables rely on horizontal overflow** rather than reflowing (dashboard, approvals, audit, reports). Acceptable as a desktop product, but it amplifies XD-1. | Medium | dashboard/audit/reports table markup |

**Recommended interventions:**
- Introduce a responsive shell: collapsible icon rail at `md`, off-canvas drawer
  with hamburger at `< md`, `min-h-11` touch targets. This is the largest
  cross-device remediation and should be scoped deliberately (it is also the
  biggest UI change in this plan).
- At minimum, gate the claim: if mobile support is out of scope for the demo,
  add a clear "Best experienced on desktop" viewport notice rather than showing
  a broken layout — honest and cheap.

---

## Severity Summary

**P1 — fix before demo:**
- A11Y-1 contrast (`text-outline` ≈ 4.3:1)
- A11Y-2 missing focus-visible styling
- IX-1 onboarding pages use a second design language
- XD-1/XD-2 interior app unusable on mobile (scope decision required)
- PF-1 single 1.43 MB bundle (first-load latency)

**P2 — next pass:**
- IA-1 Settings mega-page, IA-2 flat sidebar grouping
- IX-2 skeleton loaders, IX-3 silent session expiry
- VH-1 / A11Y-6 color-only audit encoding
- PF-2 N+1 dashboard queries
- A11Y-3 unnamed close button, A11Y-5 touch targets

**P3 — polish:**
- IA-3 breadcrumbs, IX-4 native confirm, IX-5 button label swap,
  PF-3/PF-4/A11Y-4 reduced-motion + loading flash, VH-3 actionable empty states

---

## Implementation checklist

- [ ] Darken `outline` token in `tailwind.config.ts` to reach ≥ 4.5:1 on surface
      (or migrate affected labels to `on-surface-variant`); re-verify the
      computed ratio.
- [ ] Add global `:focus-visible` outline rule + `prefers-reduced-motion: reduce`
      rule in `src/index.css`.
- [ ] Add `aria-label="Close"` to the generate-modal close button
      (`src/pages/recommendations.tsx`).
- [ ] Restyle `src/pages/onboarding/data.tsx`, `priorities.tsx`, `policies.tsx`
      onto the design tokens (cards, inputs, buttons, typography) matching the
      app shell.
- [ ] Convert `Settings` (`src/pages/settings.tsx`) to tabbed sections or add a
      sticky anchor list.
- [ ] Split `Shell.tsx` sidebar into Finance/Admin groups; on mobile add a
      collapsible drawer or a deliberate "desktop recommended" viewport notice.
- [ ] Enlarge Shell nav rows and table action hit areas to ≥ 44 px.
- [ ] Add direction glyphs (↑/↓) to audit before→after values
      (`src/pages/audit.tsx`).
- [ ] Route-level code-split (`React.lazy`) and manually chunk `recharts` in
      `vite.config.ts`.
- [ ] Consolidate dashboard data into one gateway response to remove per-line
      anomaly queries (`supabase/functions/api/index.ts`).
- [ ] Surface "session expired" messaging on 401 redirect (`src/lib/api.ts` +
      login page read of a flag).
- [ ] Replace text-only loading states with lightweight skeleton rows on
      dashboard and signals tables.

## Verification checklist

- [ ] `pnpm build` and `pnpm lint` pass with zero errors after changes.
- [ ] Contrast: computed ratio for the adjusted `outline` token on `#f8f9ff`
      (and dark surface) is ≥ 4.5:1 for normal text.
- [ ] Keyboard-only walkthrough: tab order reaches every interactive control;
      focus ring is visible on buttons, links, inputs, and the modal close button
      in both light and dark mode.
- [ ] Screen-reader pass (e.g., VoiceOver/NVDA quick check): close button
      announces "Close"; error/status messages announce; tables announce headers.
- [ ] Screenshots at `mobile_390` and `desktop_1280` of login, signup, onboarding
      data, dashboard, and settings: no overflow, no horizontal scroll at mobile
      (or the desktop-notice is present), consistent visual language across
      onboarding and interior pages.
- [ ] Motion: with OS reduced-motion enabled, the anomaly pulse is disabled and
      transitions are softened.
- [ ] Performance: `pnpm build` reports the route/vendor split; first-load JS
      per route is meaningfully below the previous 1.43 MB single chunk.
- [ ] Dashboard first-load network trace shows the consolidated dashboard call
      (≤ 2 gateway requests on mount, down from 5–6).
- [ ] Functional regression: signup → onboarding → import → signals → generate →
      approve → audit still completes end-to-end after the restyle and shell
      changes.

*Limitations: interior pages were code-verified, not pixel-verified (auth-gated).
A short usability session with a finance-persona participant would validate the
IA and touch-target findings with real usage data before the demo.*

---

# Part 2 — Visual & Aesthetic Refinement Roadmap (Quick Wins)

## Context

Following the Part 1 UX audit, this roadmap targets **visual appearance only**,
per stakeholder direction. Scope confirmed by decision: (1) introduce a
**success-green semantic** for positive financial values; (2) execute the
**quick-wins cluster** — color harmonization, chart colors, radius consistency,
onboarding header cleanup, and dashboard metric-card icon chips. Reference style
profile: "Data-Dense Dashboard" (KPI cards, grid layout, minimal padding, green
positive indicators, WCAG AA).

## A. Success-green semantic for positive values

**Problem:** "Reallocatable surplus" and other positive metrics render in the
burnt-orange `secondary` (#904d00 / container #fe932c), which reads as a warning
in a finance context; no positive color exists in the palette.

**Plan:**
- Add tokens to `tailwind.config.ts`: `success: "#1a7f37"`,
  `on-success: "#ffffff"`, `success-container: "#d7f3e3"`,
  `on-success-container: "#0b3d22"`.
- Re-point positive-value surfaces from `secondary`/orange to `success`:
  - `src/pages/dashboard.tsx` — "Reallocatable" card value and its
    "Generate →" footer link: `text-secondary` → `text-success`.
  - `src/pages/signals.tsx` — surplus figure `text-secondary` → `text-success`.
  - `src/pages/recommendations.tsx` — modal source-option surplus value gains a
    `text-success` tint.
- Keep `secondary`/orange for warning/attention surfaces only (Modified status,
  severity badges, overdue escalation) — no semantic confusion.

**Rationale:** green = available capital (finance convention); removes the
"warning" reading of surplus at a glance.

## B. Chart token colors (`src/components/RechartsChart.tsx`)

**Problem:** hardcoded pastel hex fills (#ffb4ab pink, #c3e7ff blue, #e0e2ec
gray) clash with the token palette; ticks use `#888`.

**Plan:**
- Projected bars → `rgba(37, 99, 235, 0.35)` (primary-container-derived);
  actual bars → `rgba(220, 233, 255, 1)` (surface-container-high-derived);
  anomaly bars → `rgba(255, 183, 125, 1)` (secondary-fixed, attention).
- Axis ticks → `#626570` (outline token).
- Add a subtle dashed `CartesianGrid` in `outline-variant` for data
  scannability; tooltip background `surface-container-lowest`, border
  `outline-variant`, text `on-surface`.

**Rationale:** the chart becomes palette-consistent — the dashboard is the first
visual judges see.

## C. Radius consistency (quick system pass)

**Problem:** `rounded` = 2px on cards/tables/buttons/inputs sits beside
`rounded-xl` (8px) and pills — a sharp-vs-round mix that reads as template
default.

**Plan:** one radius language — surfaces & inputs 8px, pills/badges/avatars
`rounded-full`.
- Card/table containers currently `rounded` → `rounded-xl` (dashboard metric
  cards + table, reports/audit/approvals tables).
- Primary/secondary buttons currently `rounded` → `rounded-lg` (dashboard,
  signals, recommendations, settings, governance, import, onboarding pages).
- Form inputs `rounded` → `rounded-lg`.
- Badges/chips stay `rounded-full` (most already are).

## D. Onboarding header cleanup (`src/pages/onboarding.tsx`)

**Problem:** the workspace page still carries a marketing header ("256-Bit
Financial Encryption", "Enterprise security controls") unlike the lean step
pages, and prefills `defaultValue="Acme Technologies Inc."` — a foreign company
name can appear on stage.

**Plan:**
- Remove the marketing header strip entirely (steps 2–4 have no header).
- Replace the prefilled company name with an empty `placeholder="Enter company
  name"`.
- Convert the right-card classes to tokens: `bg-surface-container-lowest border
  border-outline-variant rounded-xl shadow-sm` (drop `bg-white`/`border-slate-*`).

**Rationale:** onboarding becomes one coherent system; removes demo-artifact look.

## E. Dashboard metric-card icon chips (`src/pages/dashboard.tsx`)

**Plan:** each of the 4 metric cards gets a tinted icon container instead of a
bare glyph:
- Total Allocated (`account_balance_wallet`): `bg-primary-container/15
  text-primary rounded-lg p-2`
- Total Remaining (`savings`): `bg-primary/10 text-primary rounded-lg p-2`
- Reallocatable (`swap_horiz`): `bg-success-container text-success rounded-lg
  p-2` (new semantic)
- Pending Reviews (`verified_user`): `bg-secondary-fixed/40 text-secondary
  rounded-lg p-2`

**Rationale:** a designed focal element per card; icon-chip color encodes the
metric's meaning (neutral / positive / attention).

## Files to modify

- `tailwind.config.ts` — success token set
- `src/components/RechartsChart.tsx` — fills, grid, ticks, tooltip
- `src/pages/dashboard.tsx` — success colors, icon chips, card radii
- `src/pages/signals.tsx` — surplus → success
- `src/pages/recommendations.tsx` — surplus tint, button/input radii
- `src/pages/onboarding.tsx` — header removal, default value, card tokens
- `src/components/ApprovalsTable.tsx`, `src/pages/reports.tsx`,
  `src/pages/audit.tsx` — container radius pass
- `src/pages/settings.tsx`, `src/pages/governance.tsx`,
  `src/pages/import.tsx` — input/button radius pass

## Implementation checklist

- [ ] Add `success` / `on-success` / `success-container` / `on-success-container`
      tokens to `tailwind.config.ts`.
- [ ] `dashboard.tsx`: Reallocatable value + footer link use `text-success`;
      swap_horiz card icon gets `bg-success-container text-success rounded-lg
      p-2`; remaining 3 cards get tinted icon containers; metric cards and table
      container use `rounded-xl`.
- [ ] `signals.tsx`: surplus figure `text-success`; signal card container
      `rounded-xl`.
- [ ] `recommendations.tsx`: source-option surplus gains `text-success`;
      generate modal buttons and selects use `rounded-lg`.
- [ ] `RechartsChart.tsx`: token-derived bar fills, outline tick color, dashed
      outline-variant CartesianGrid, token tooltip styling.
- [ ] `onboarding.tsx`: marketing header removed; company name input has no
      defaultValue (placeholder only); card uses token classes.
- [ ] Radius pass on `ApprovalsTable.tsx`, `reports.tsx`, `audit.tsx`,
      `settings.tsx`, `governance.tsx`, `import.tsx` (cards/buttons/inputs →
      8px, pills stay full).
- [ ] Grep confirms no `rounded ` (2px) remains on card/input/button surfaces in
      the touched files.

## Verification checklist

- [ ] `pnpm build` and `pnpm lint` pass with zero errors.
- [ ] Contrast: computed ratio for `success #1a7f37` on `#f8f9ff` is ≥ 4.5:1
      (normal text) and for `on-success #ffffff` on `success #1a7f37` is ≥ 4.5:1.
- [ ] Screenshot `mobile_390` and `desktop_1280` of login + signup: unchanged
      clean rendering; onboarding workspace page no longer shows "Acme
      Technologies Inc." and has no marketing header.
- [ ] Interior (code-verified, auth-gated): dashboard shows 4 tinted icon chips,
      success-green Reallocatable, rounded-xl cards, token-colored chart with
      grid; surplus values are green on signals; modified/warning surfaces keep
      orange.
- [ ] No new motion added; `prefers-reduced-motion` rules from Part 1 still
      intact.
- [ ] Functional regression: login → onboarding → dashboard → signals →
      generate → approve still completes (status 200s on gateway calls).

---

# Part 3 — Demo "Wow" Cluster (Next-Tier UI/UX)

## Context

Following the quick-wins execution, this cluster targets the highest-leverage
**visual-impact surfaces for the hackathon demo**, per stakeholder decision:
(1) hero recommendation card, (2) premium chart, (3) login polish,
(4) micro-interactions. All changes are token-based and reversible.

## A. Hero recommendation card (`src/pages/recommendations/[id].tsx`)

**Problem:** the detail page's headline is plain text ("Decision REC-…" +
status); the amount is not visually the hero even though the recommendation IS
the product.

**Plan:**
- Fetch `/budget-lines` (pattern already used in approvals/signals) to resolve
  source/target line names + guardrail inputs
  (necessary_future_spend, safety_reserve, policy_maximum_transfer, remaining).
- Render a hero card at the top of the detail page:
  - **Flow chips**: source chip (line name, dept) → arrow icon → target chip,
    using `bg-surface-container rounded-lg px-3 py-1.5` containers.
  - **Hero amount**: transfer value in `font-numeric-metric-lg` at 2× scale with
    `formatMoney(value, currency)` from `@/lib/format` (already reused).
  - **Guardrail sub-line**: "From source surplus ₹X · capped by policy ₹Y" —
    computed from the fetched line data via the same surplus math used on the
    dashboard (`remaining - necessary_future_spend - safety_reserve`).
  - **Pills**: confidence (`font-code-sm` pill) + status pill beside the amount.
- Keep the existing escalation banner, reasoning trace, and action buttons below.

**Rationale:** finance judges read the amount and its guardrail first; the hero
makes the deterministic-engine story visually obvious.

## B. Premium chart (`src/components/RechartsChart.tsx` + dashboard donut)

**Problem:** the burn-velocity bar chart is flat single-color; the dashboard has
no utilization visualization.

**Plan:**
- Add a `<defs>` linear gradient (`spendGrad`, primary-container at 50% →
  10%) and fill non-anomaly bars with `url(#spendGrad)`; keep the anomaly bars
  solid secondary-fixed. Slightly larger bar radius `[6, 6, 0, 0]`.
- Add a compact **Budget utilisation donut** on the dashboard using `recharts`
  `PieChart` (already in the bundle): "Allocated vs Remaining" fed from the
  existing `total_budget` / `total_remaining` payload — a donut in
  `success`/`primary` slices with a center label showing remaining %. Place it
  beside the burn chart in a 2-col `lg:grid-cols-2` row (empty state if no
  budget).
- Tooltip stays token-styled (done in Part 2).

**Rationale:** gradient depth + a utilization donut read as "designed" in
seconds; both are token-derived, no new dependencies.

## C. Login polish (`src/pages/index.tsx`, `src/pages/signup.tsx`)

**Problem:** the auth card sits on a flat background — a flat first impression
for the demo.

**Plan:**
- Page wrapper: layer two token-derived radial tints over `bg-background`
  (primary blue ~8% at top-left, success green ~6% at bottom-right) via
  arbitrary-value background-image classes — no new assets.
- Under the card header add a one-line value prop:
  "Detect · Calculate · Explain · Approve — AI explains, the engine decides,
  humans approve." in `text-on-surface-variant font-body-sm`.
- Submit button: add `hover:shadow-md` elevation.

**Rationale:** first-impression lift with pure token work; reinforces the pitch
in words on the entry screen.

## D. Micro-interactions

**Problem:** interactions are functional but flat (no press feedback, no modal
entrance, no card lift).

**Plan:**
- `src/index.css`: add `@keyframes modal-in` (opacity 0→1, translateY 8px→0,
  scale 0.98→1, 180ms ease-out). Global reduced-motion rule (Part 1) already
  disables it for users who request that.
- Generate modal card (`src/pages/recommendations.tsx`): apply
  `animate-[modal-in_0.18s_ease-out]`.
- Dashboard metric cards: add `hover:shadow-md transition-shadow duration-150`
  (lift shadow, no layout shift; no translate to avoid jank).
- Key CTAs (sign-in, generate, primary save buttons): add
  `active:scale-[0.98]` for a tactile press state.

**Rationale:** motion is the cheapest "polished" signal; kept minimal and
reduced-motion-safe per Part 1 rules.

## Files to modify

- `src/pages/recommendations/[id].tsx` — hero card (flow chips, hero amount,
  guardrail sub-line, pills)
- `src/components/RechartsChart.tsx` — gradient bars
- `src/pages/dashboard.tsx` — utilisation donut, card hover lift, active press
- `src/pages/index.tsx`, `src/pages/signup.tsx` — background tints + value prop
- `src/pages/recommendations.tsx` — modal entrance animation
- `src/index.css` — `modal-in` keyframes
- `src/components/ApprovalsTable.tsx`, primary buttons — `active:scale-[0.98]`

## Implementation checklist

- [ ] `recommendations/[id].tsx`: fetch `/budget-lines`; hero card renders flow
      chips (source → target), `formatMoney` hero amount, guardrail sub-line
      (source surplus + policy cap from fetched line data), confidence + status
      pills.
- [ ] `RechartsChart.tsx`: `<defs>` linear gradient; non-anomaly bars use
      `url(#spendGrad)`; anomaly bars stay secondary-fixed; radius `[6,6,0,0]`.
- [ ] `dashboard.tsx`: Budget-utilisation donut (PieChart, total_budget vs
      total_remaining, success/primary slices, center remaining % label) in a
      `lg:grid-cols-2` row beside the burn chart; graceful empty state when
      `total_budget` is 0.
- [ ] `index.css`: `modal-in` keyframes; `index.tsx` + `signup.tsx`: layered
      radial tints + one-line value prop + `hover:shadow-md` on submit.
- [ ] Generate modal card gets `animate-[modal-in_0.18s_ease-out]`.
- [ ] Dashboard metric cards get `hover:shadow-md transition-shadow
      duration-150`; key CTAs get `active:scale-[0.98]`.
- [ ] Grep: no new hardcoded hex in chart/dashboard (tokens or rgba of tokens
      only).

## Verification checklist

- [ ] `pnpm build` and `pnpm lint` pass with zero errors.
- [ ] Screenshot `desktop_1280` of login: gradient background present, value
      prop visible, no overflow; signup matches.
- [ ] Interior (code-verified, auth-gated): recommendation detail shows flow
      chips + hero amount + guardrail sub-line; dashboard shows donut + gradient
      bars + hover shadow on metric cards; generate modal animates in.
- [ ] Reduced-motion: with OS reduce-motion on, `modal-in` is suppressed by the
      Part 1 global rule (no visible entrance animation).
- [ ] Donut empty state renders text (not a broken chart) when `total_budget` is
      0.
- [ ] Functional regression: generate → open detail → approve still returns 200
      and the hero values match the recommendation amount and line guardrails.
