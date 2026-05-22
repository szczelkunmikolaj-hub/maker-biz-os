# Major Platform Upgrade — 5 Workstreams

This is a large, multi-phase upgrade. I recommend we ship it in **3 phases** to keep each step testable, rather than one giant changeset that risks breaking core functionality. Below is the full plan; we can adjust scope after you review.

---

## Phase 1 — Foundation: Cloud Backend + Auth + Landing

The biggest piece. Everything else builds on this.

### 1.1 Enable Lovable Cloud
- Spins up a managed backend (Postgres + auth + storage). No external account needed.
- Required for auth, sync, language prefs, and "welcome dismissed" state.

### 1.2 Database schema
Tables (all RLS-protected, scoped to `auth.users.id`):
- `profiles` — `user_id`, `display_name`, `language` (default `en`), `welcome_dismissed` (bool), `demo_mode` (bool)
- `projects` — JSONB column mirroring current `Project` type, plus `user_id`, `id`, `updated_at`
- `expenses` — same pattern
- `templates` — same pattern
- `filament_purchases` — same pattern
- `settings` — single row per user with the `AppSettings` shape

Using JSONB for the entity tables keeps the existing rich shape (prints[], models[], plates, colors, etc.) without flattening — no risk to existing logic.

### 1.3 Auth pages
- `/auth` — combined login/signup with tabs, email+password, plus **Google OAuth** button
- `onAuthStateChange` listener set up at app root, before `getSession()`
- Auth guard: unauthenticated users on `/` see the **Landing Page**; on any other route, redirect to `/auth`
- Sign-out button in the navbar user menu

### 1.4 LocalStorage → Cloud migration (one-time, per user)
On first login:
1. Read all `pt_*` keys from localStorage
2. If `profiles.migrated_at` is null AND localStorage has data → upload everything to user's tables in a single batch
3. Mark `migrated_at = now()`, keep localStorage as a backup (do not delete) for one session, then clear

### 1.5 Replace AppContext storage layer
- `AppContext` keeps the same public API (`projects`, `addProject`, `updateProject`, etc.) — no component changes needed
- Internally swaps `localStorage` reads/writes for Supabase queries with optimistic updates + debounced sync
- Realtime subscription so multi-device edits sync

### 1.6 Landing page (`/` when logged out)
- Dark theme matching app (Space Grotesk + Inter, existing tokens)
- Hero: "Run your 3D printing business like a pro" + subtitle
- 3 benefit cards (icons: Box, Clock, TrendingUp)
- Dashboard mockup screenshot section (rendered with real components in read-only mode)
- "Start free — no credit card needed" → `/auth?mode=signup`
- Navbar with PT logo + "Log in" button
- Footer: "Made by a maker, for makers"
- SEO meta + JSON-LD `Organization`

---

## Phase 2 — Onboarding, Demo Mode, Mobile

### 2.1 Welcome modal
- After signup, opens once when `profiles.welcome_dismissed = false`
- 3 slides introducing: Project tracking · Kanban & calendar · Profit analytics
- "Let's go" button → sets `welcome_dismissed = true` in Supabase

### 2.2 Demo mode
- Toggle in navbar (Switch with "Demo" label)
- When ON: AppContext serves 5 realistic seed projects + matching expenses from a `demoSeed.ts` file (in-memory, not written to DB)
- Persistent banner at top: "Demo mode — sample data. Toggle off to use your real data."
- When OFF: returns to real user data
- Preference stored in `profiles.demo_mode`

### 2.3 Help tooltips
- New `<HelpTip>` component (question-mark icon + Radix tooltip)
- Added next to: Projects header, Kanban columns, Calendar, Expenses, Filament, Quote Generator, Analytics KPIs, Material Usage Summary
- One-sentence explanations, translatable strings

### 2.4 Mobile responsiveness (375px+)
- Sidebar: already uses shadcn `Sidebar` with `collapsible="icon"` — confirm it switches to hamburger sheet on `<md`
- All grids: audit `grid-cols-*` → ensure `grid-cols-1` base, larger at `md:` / `lg:`
- Tables: wrap in `overflow-x-auto` containers
- Kanban: horizontal scroll container with snap points
- Buttons/inputs: enforce `min-h-10` (40px tap target) globally where missing
- Global status bar: stack/wrap on narrow widths
- Test pass at 375 / 414 / 768

---

## Phase 3 — Branding + i18n

### 3.1 Branding
- Title → "Maker Biz OS — 3D Printing Business Manager"
- New favicon (generate small PT mark, multiple sizes)
- OG image (1200×630) generated and referenced in `index.html`
- Open Graph + Twitter card meta tags (already partially present, will refresh)

### 3.2 Internationalization (6 languages)
- Add `react-i18next` + `i18next-browser-languagedetector`
- Locale files: `en`, `es`, `de`, `pl`, `fr`, `pt`
- Wrap all visible UI strings with `t('key')` — biggest mechanical change in this phase
- Language switcher dropdown in navbar (globe icon + language name)
- Auto-detect from `navigator.language` on first visit
- Persisted to `profiles.language`; loaded on auth state change
- Translation scope: navbar, sidebar, page titles, form labels, button labels, toasts, status pills, empty states, help tooltips, landing page. Dynamic data (project names, etc.) stays as-is.

---

## Technical notes

- **No breaking changes** to current data shape — JSONB storage preserves `models[]`, `plates`, colors, custom fields
- AppContext API stays identical so existing components don't need rewrites
- Migration is idempotent and reversible (localStorage retained as backup until verified)
- Auth uses Lovable Cloud's built-in Google OAuth (no extra config needed)
- i18n keys organized by page/feature for maintainability

---

## Recommended execution

I suggest we ship **Phase 1 first**, you verify auth + your data migrated cleanly, then I do Phase 2, then Phase 3. Each phase is ~1 large changeset.

**Reply with one of:**
- "Go" — I'll start Phase 1 (enable Cloud, auth, migration, landing page)
- "All in one" — I'll do everything in a single pass (higher risk, longer to verify)
- Edits to the plan (e.g. "skip demo mode", "only EN + ES for now", "do mobile first")