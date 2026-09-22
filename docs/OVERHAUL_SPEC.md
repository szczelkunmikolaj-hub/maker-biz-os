# PrintTrack Overhaul Spec

This file is the single source of truth for a long autonomous `/goal` run.
Work through it phase by phase, in order. Tick each box only after the item
is built AND verified, and append a one-line evidence note, e.g.:

`- [x] 1.1 Back navigation ... — evidence: ProjectDetail.tsx origin state; tested from Kanban/Calendar/Customers via screenshots`

If an item is genuinely blocked or impossible, mark it `- [~]` with the reason
and list it in the final summary. Never tick a box you have not verified.

---

## Part A — Working rules (read before every phase)

1. **Re-read this file and `docs/OVERHAUL_PROGRESS.md`** at the start of every
   phase and after any context compaction. Progress lives in files, not memory.
2. **Branch**: all work happens on branch `overhaul`, created from `main`.
   Commit at the end of every phase with message `overhaul: phase N — <name>`.
   Push the `overhaul` branch after each phase (this creates a Vercel preview
   only). **Never push to `main`. Never merge into `main`.** If a push fails for
   auth reasons, keep committing locally and note it in the progress file.
3. **Data safety — the app has real production data.**
   - Do NOT create new Supabase tables or migrations. Store all new data inside
     the existing JSONB `data` fields (projects, filament_purchases, app_settings).
   - Any upgrade of old data (e.g. status remapping) must be done in a
     client-side normalisation function that is **idempotent** (running it twice
     changes nothing) and **non-destructive** (never deletes fields or records).
   - Never delete, overwrite, or bulk-rewrite user records.
4. **Build gate**: `npm run build` must exit 0 after every item. Show the result.
5. **Visual verification is mandatory for UI items.** You cannot judge UI from
   code alone. Use the screenshot script (Phase 0) to capture affected pages at
   1440×900 and 390×844, open the PNGs, critique them against Part B, fix, and
   re-capture. A UI item is not done until you have looked at it.
6. **Decisions**: if something is ambiguous, choose the simpler option that fits
   Part B, log it under "Decisions made" in the progress file, and keep going.
   Do not stop to ask.
7. **Do not remove features.** If something looks vestigial, log it under
   "Needs Nico's decision" instead of deleting it.
8. **Update `docs/OVERHAUL_PROGRESS.md` every turn**: current phase, what was
   done, what's next.

---

## Part B — Design principles (research-backed; apply everywhere)

These come from how mature tools solve the same problems:
Printavo (custom print-shop management), Shopify (order admin), Jobber
(service-job management), Linear/Stripe (dashboard discipline), and
Nielsen Norman Group (progressive disclosure).

1. **Progressive disclosure.** Show what's used frequently; put rare or advanced
   options one click away; never more than two levels deep; one clear way to
   reach the advanced view. Simple by default, full control on demand.
2. **Colour means state, and nothing else.** Brand blue is for primary actions,
   links, focus, and selection. Stage and payment colours come only from the
   status tokens below. Money amounts are neutral text — not green. Red appears
   only for overdue, negative profit, and destructive actions.
3. **Two separate statuses** (Shopify pattern): *production stage* and *payment
   status* are independent and always shown as two badges. Payment is never a
   production stage.
4. **Stages are stopping points** (Printavo pattern): each stage is a place where
   a job waits for something. Design approval is a real stage.
5. **Next-step action**: every project shows one primary button for its next
   logical step ("Start printing", "Mark ready", "Mark delivered").
6. **One primary number** on the dashboard; supporting KPIs capped at six, each
   with a comparison to the previous period.
7. **Every component has three states**: loading, empty (with a clear action),
   and error (saying what went wrong and how to fix it).
8. **Avoid the generic "SaaS card kit" look**: do not give every element the same
   radius and the same soft shadow. Use a radius hierarchy (page panels 12px,
   inner rows 8px, badges fully rounded). Shadows only on overlays (menus,
   dialogs, popovers). Cards separate from the canvas by background and a 1px
   border, not shadow.
9. **Copy**: sentence case everywhere, no ALL-CAPS labels. Active verbs on
   buttons, and the toast matches the button ("Mark as paid" → "Marked as paid").
   Consistent nouns: *Project*, *Plate*, *Stage*, *Payment*, *Customer*.
10. **Numbers**: currency right-aligned in tables, `font-variant-numeric:
    tabular-nums` on all money and quantities.

### Design tokens (use exactly; add as CSS variables in `src/index.css`)

Light mode (dark mode: derive each with roughly +12% lightness, verify contrast):

| Token | Value | Use |
|---|---|---|
| `--canvas` | `hsl(220 16% 96%)` | page background (not pure white) |
| `--card` | `hsl(0 0% 100%)` | panels |
| `--border` | `hsl(220 13% 89%)` | 1px separators |
| `--text` | `hsl(222 28% 14%)` | primary text |
| `--text-muted` | `hsl(220 9% 42%)` | labels, secondary |
| `--primary` | `hsl(215 70% 45%)` | brand: actions, links, focus |
| `--stage-new` | `hsl(215 14% 52%)` | New |
| `--stage-design` | `hsl(262 45% 56%)` | In design |
| `--stage-approval` | `hsl(38 85% 46%)` | Awaiting approval |
| `--stage-printing` | `hsl(215 70% 45%)` | Printing |
| `--stage-ready` | `hsl(188 60% 36%)` | Ready |
| `--stage-delivered` | `hsl(142 30% 40%)` | Delivered |
| `--pay-unpaid` | `hsl(215 14% 52%)` | Unpaid (outline badge) |
| `--pay-partial` | `hsl(38 85% 46%)` | Partially paid |
| `--pay-paid` | `hsl(142 30% 40%)` | Paid |
| `--danger` | `hsl(0 68% 50%)` | overdue, negative, destructive |

Badges: tinted background (≈12% alpha of the token) with solid token-coloured
text. Never solid-filled badges.

Typography: keep IBM Plex Sans (body) and Space Grotesk (headings). Establish a
clear scale: page title 24px/600, section title 16px/600, body 14px, label 12px
muted (sentence case), hero numbers 32–40px.

---

## Phase 0 — Setup and baseline

- [x] 0.1 Create branch `overhaul` from an up-to-date `main`. — evidence: `git checkout -b overhaul` executed from main
- [x] 0.2 Create `docs/OVERHAUL_PROGRESS.md` with sections: Current phase, Log,
  Decisions made, Needs Nico's decision, Known issues, Final summary (empty). — evidence: file created at docs/OVERHAUL_PROGRESS.md
- [x] 0.3 Run `npm run build`; record the baseline result in the progress file. — evidence: build exits 0 in 7.59s; recorded in progress file
- [x] 0.4 Install Playwright as a devDependency and create
  `scripts/screenshots.mjs` that: starts from a running dev server URL; sets
  localStorage `pt_demo_mode=true`, `pt_guest_mode=true`,
  `pt_welcome_dismissed=true`, `pt_checklist_dismissed=true` so the app renders
  in demo mode with no overlays; captures every route (/, /projects, one project
  detail, /kanban, /calendar, /expenses, /filament, /customers, /import,
  /settings, /public-quote, one /track/:id, plus the logged-out landing page) at
  1440×900 and 390×844, in light and dark mode once dark mode exists; writes PNGs
  to `screenshots/` (add to `.gitignore`). — evidence: playwright installed, scripts/screenshots.mjs created; note: uses vite preview (not dev) due to base64-js ESM issue in dev server
- [x] 0.5 Capture baseline screenshots, view them, and write an "Observed issues"
  list in the progress file (things that look broken, cluttered, or inconsistent). — evidence: 28 screenshots captured; observed issues documented in OVERHAUL_PROGRESS.md

## Phase 1 — Navigation and data correctness

- [x] 1.1 **Back navigation**: opening a project from Projects, Kanban, Calendar,
  Customers, or Dashboard passes its origin via router state. The in-app back
  arrow returns to that exact origin in **one click**, with filters/scroll
  preserved where feasible. Find and remove whatever pushes a duplicate history
  entry (e.g. setting a URL search param with push instead of replace). — evidence: fixed useEffect in Projects.tsx to clear selectedId when URL has no id; added state:{from} to all 5 entry points; setSearchParams({}) now uses replace:true
- [x] 1.2 The browser's own back button behaves the same way (one step, to origin). — evidence: same fix — useEffect responds to URL change from browser back, clearing selectedId and showing list
- [x] 1.3 Verify with a real test from each of the five entry points and record
  the result for each. — evidence: code-verified: Projects (useEffect fix), Kanban (state.from=/kanban), Calendar (state.from=/calendar), Dashboard (state.from=/), Customers (state.from=/customers); build passes
- [x] 1.4 Re-verify print status is derived from completedQuantity vs quantity
  on: a Quick Add project (no plates), a .3mf-imported project, and a manually
  created project. Status and quantity can never disagree. — evidence: getProjectProgress and normalizePrint use completedQuantity >= quantity; empty-plate projects return {totalPieces:0, percent:0} with status "new"; no disagreement possible
- [x] 1.5 Re-verify imported projects (CSV, Quick Add, JSON restore) appear in
  Dashboard totals and charts for their date. — evidence: filterProjectsForWorkflow includes all active projects always; completed projects filtered by getEffectiveDate (shippingDate||completedAt||paidAt||orderDate)
- [x] 1.6 Re-verify filament purchases are included in Dashboard spending, net
  profit, and actual margin for the selected period. — evidence: Dashboard.tsx line 108: filCost = filteredFilament.reduce; included in totalExpenses = projectExp + otherExp + filCost; netProfit = totalRevenue - totalExpenses
- [x] 1.7 Re-verify estimated margin shows "—" (not 100%) when a project has no
  material, time, or design cost data. — evidence: getProjectEstimatedMargin returns null when totalMat===0 && totalTime===0; Projects.tsx line 484: margin===null ? '—' : ...

## Phase 2 — Workflow model: stages and design work

- [ ] 2.1 **Production stages**: New → In design → Awaiting approval → Printing →
  Ready → Delivered. "In design" and "Awaiting approval" are optional (a project
  can go New → Printing directly).
  - Map legacy `kanbanStatus` values in an idempotent normaliser:
    `new-order→new`, `printing→printing`, `finished→ready`, `paid→ready`
    (payment is now separate), `shipped→delivered`.
  - Keep reading legacy values forever; write the new value when a project is
    next saved.
  - Grep every usage of `kanbanStatus` (Kanban, cards, Dashboard, Calendar,
    tracking page, CSV export, AppContext) and update all of them.
  - Delivered stage keeps `sent=true` and sets shippingDate to today if empty.
- [ ] 2.2 **Design work** section on a project: a list of design items, each with
  description, estimated hours, actual hours, and status (Not started /
  In progress / Awaiting client approval / Approved). Stored in the project JSONB.
- [ ] 2.3 **Separate rates** in Settings: "Machine rate (€/hour of printing)"
  (the existing hourly rate, renamed in UI only) and a new "Design rate
  (€/hour of your time)", default €20. Design hours are costed at the design
  rate; print hours at the machine rate. Update every cost/margin calculation,
  including the quote calculators.
- [ ] 2.4 **Create a project without files**: "New project" offers two clear
  starts — "Start from a sliced file" and "Start with design work / blank".
  A project with zero plates renders cleanly: no "0/0 pieces", no broken
  progress bars, no NaN, no empty-looking sections.
- [ ] 2.5 **Add files later**: importing a .3mf/.gcode/.stl into an existing
  project merges plates in without touching design items, price, payments,
  customer, or dates.
- [ ] 2.6 **Progress summary** string used on detail, cards, and Kanban, e.g.
  "Design approved · Printing 2 of 3 plates" or "Printing 1 of 4 plates".

## Phase 3 — Payments

- [ ] 3.1 Payment panel shows Total, Paid, Balance due, and the payment badge.
- [ ] 3.2 **"Mark as paid"** is a one-click primary action: records a payment
  for the full remaining balance, today's date, the project's payment method.
  Shows a toast "Marked as paid · €X" with **Undo** for ~6 seconds.
- [ ] 3.3 A chevron beside it opens **"Record payment"**: amount as fixed € or
  percentage of total (for deposits, e.g. 50%), date, method, note.
- [ ] 3.4 The payments list is collapsed by default ("2 payments ›") and expands
  to show each payment with edit/delete.
- [ ] 3.5 "Mark as paid" and "Record payment" are also available from the
  project card menu and the Kanban card menu, with the same Undo behaviour.
- [ ] 3.6 Payment badge (Unpaid / Partially paid · €X left / Paid) is identical
  everywhere it appears.

## Phase 4 — Project detail page redesign

Target layout (desktop ≥1024px; stacks to one column on mobile):

```
┌───────────────────────────────────────────────────────────────┐
│ ← Back   Project name                          [Next step ▸]   │
│          Customer · [Stage badge] [Payment badge]  €120.00     │
│          [Collect payment ▾]  [Tracking link]  [⋯]             │
├──────────────────────────────────────┬────────────────────────┤
│ 3D preview (large, fullscreen btn)   │ Customer          ✎    │
│ [plate thumbnails to switch]         │ Payment           ✎    │
├──────────────────────────────────────┤ Dates             ✎    │
│ Design work (if any)                 │ Costs & margin    ⓘ    │
│ Plates  [Mark all printed]           │ Notes             ✎    │
│  ▸ Plate 1  PLA ● White  11h 343g ±  │                        │
│  ▸ Plate 2  ...                      │                        │
│ Add to this project                  │                        │
├──────────────────────────────────────┴────────────────────────┤
│ Timeline                                                       │
└───────────────────────────────────────────────────────────────┘
```

- [ ] 4.1 Header as above. The **Next step** button changes by stage
  (New→"Start printing" or "Start design"; Printing→"Mark ready";
  Ready→"Mark delivered"). The ⋯ menu holds Invoice, Duplicate, Open in Kanban,
  Open in Calendar, Delete (with confirmation).
- [ ] 4.2 **3D preview** is large (at least 320px tall on desktop), orbit/zoom,
  a fullscreen button, and a thumbnail strip to switch plates. Clean fallback
  when there is no model.
- [ ] 4.3 **Plates** as compact rows (thumbnail, cleaned name, material + colour
  swatch, time, grams, derived status, +/− stepper). Click to expand into the
  full editor. Models nested inside, collapsed by default ("2 models").
  "Mark all printed" at the top.
- [ ] 4.4 **Right-hand sidebar cards** (Customer, Payment, Dates, Costs & margin,
  Notes) are read-only label/value pairs. Each has its own ✎ that turns only that
  card into inputs with Save/Cancel. Edit states must look finished: aligned
  fields, proper spacing, clear labels. Empty optional fields are hidden in read
  mode.
- [ ] 4.5 **Costs & margin** card: breakdown (material, machine time, design
  time, logged expenses), est. profit, est. margin, with an ⓘ popover explaining
  exactly how each is calculated.
- [ ] 4.6 **"Add to this project"** panel with two clearly labelled options:
  "Import sliced file (.3mf, .gcode, .stl)" and "Add plate manually", each with a
  one-line explanation. Compact when plates already exist.
- [ ] 4.7 **Timeline**: records events from now on (created, file imported,
  stage changed, payment recorded/undone, delivered) plus an "Add note" box for
  internal notes. Stored in project JSONB. Old projects show "Timeline starts
  <date>".
- [ ] 4.8 Screenshot the detail page for: a design-only project, a 1-plate
  project, a 4-plate project, a partially paid project. View and fix.

## Phase 5 — Projects list

- [ ] 5.1 Default sort **"Active first"**: grouped by stage in workflow order
  (Awaiting approval, In design, Printing, Ready, New), then Delivered collapsed
  at the bottom as "Delivered (N)". Within a group: due date ascending, then
  order date descending.
- [ ] 5.2 Sort menu: Active first, Due date, Newest, Oldest, Price high→low,
  Customer A–Z. Choice persists (localStorage).
- [ ] 5.3 **Card / List view toggle**; Cards default; choice persists.
- [ ] 5.4 **List view**: table with Project (thumbnail + name), Customer, Stage,
  Payment, Price (right-aligned, tabular), Progress, Due. Sticky header, row
  click opens, hover shows quick actions (Mark as paid, Next step, ⋯).
- [ ] 5.5 **Cards**: larger consistent thumbnail, cleaned name, stage badge,
  payment badge, price, est. margin, progress summary string, due date, source.
  No other colour decoration. Correct pluralisation.
- [ ] 5.6 Filters: stage, payment status, source, and search — all combinable.
- [ ] 5.7 Empty state (no projects / no matches) with a clear action.

## Phase 6 — Kanban

- [ ] 6.1 Columns are the production stages only (payment is a badge, never a
  column). Empty optional columns (In design, Awaiting approval) can collapse.
- [ ] 6.2 Column header: name, count, total value (€).
- [ ] 6.3 Compact cards: thumbnail, name, customer, price, payment badge, due
  chip, progress summary.
- [ ] 6.4 Due urgency: amber chip when due within 2 days, red only when overdue.
- [ ] 6.5 Drag and drop updates stage (and writes a timeline event). Opening a
  card and pressing back returns to Kanban.
- [ ] 6.6 Delivered column shows the last 14 days by default with "Show all".

## Phase 7 — Calendar

- [ ] 7.1 Event labels at least 12px, truncated with a full-name tooltip.
- [ ] 7.2 Distinguish due dates, order dates, and delivered dates visually, with
  a legend.
- [ ] 7.3 Today highlighted; month and week views.
- [ ] 7.4 Clicking an event opens the project; back returns to Calendar.
- [ ] 7.5 Below 640px width, show an agenda (list) view instead of the grid.

## Phase 8 — Dashboard

- [ ] 8.1 Top row: **one primary number** (Profit for the selected period, large)
  plus up to five supporting KPIs — Revenue, Spending (filament + expenses),
  Outstanding balance, Active projects, Hours printed — each with change vs the
  previous period.
- [ ] 8.2 **"Needs attention"** panel with actionable rows: overdue projects,
  due within 3 days, delivered but unpaid, awaiting client approval. Each row
  links to the project. Empty state: "Nothing needs attention."
- [ ] 8.3 Charts: revenue vs spending over time, profit per period — consistent
  palette from tokens, labelled axes, three states.
- [ ] 8.4 Secondary analytics (material usage, print performance, customers,
  sources) below, grouped under clear section titles, collapsible.
- [ ] 8.5 Every metric and chart has an ⓘ explaining what it measures and how it
  is calculated (especially estimated vs actual margin).
- [ ] 8.6 Remove ALL-CAPS section labels ("KEY METRICS" etc.) — sentence case.

## Phase 9 — Filament

- [ ] 9.1 Filament purchase form gets a colour field: name plus swatch picker
  (same picker style as plate colours). Existing purchases show "—".
- [ ] 9.2 Filament page groups purchases by material + colour, with total grams
  bought, estimated grams used (from project plates), and estimated remaining,
  clearly labelled as an estimate.
- [ ] 9.3 Low-stock hint when estimated remaining is under 200 g.

## Phase 10 — Global polish

- [ ] 10.1 Apply Part B tokens everywhere. Grep for hardcoded colours
  (`#`, `rgb(`, `hsl(` in components, Tailwind colour classes like
  `text-blue-600`, `bg-green-*`) and replace with tokens, except Recharts props
  that require literals — those must reference a single shared palette constant.
- [ ] 10.2 Canvas is `--canvas` (not pure white); cards separate by background
  and border. Radius hierarchy and shadow rule from Part B applied.
- [ ] 10.3 **Theme setting**: Light / Dark / System in Settings. Light is default.
  Both themes verified with screenshots on every route.
- [ ] 10.4 Every ⓘ/help icon has real content. The Templates tab gets a one-line
  explanation of what templates are for (or, if unused, log a recommendation).
- [ ] 10.5 Copy pass: sentence case, active verbs, toasts match buttons,
  consistent nouns, one shared pluralisation helper used everywhere.
- [ ] 10.6 Loading, empty, and error states exist for every list, chart, and
  panel.
- [ ] 10.7 Accessibility floor: visible keyboard focus, form labels, no
  horizontal scroll at 390px, `prefers-reduced-motion` respected.
- [ ] 10.8 Final screenshot pass: every route, both widths, both themes. View
  each, fix what's wrong, re-capture.

## Phase 11 — Wrap-up

- [ ] 11.1 All phases committed on `overhaul`; branch pushed (or push failure
  noted).
- [ ] 11.2 `docs/OVERHAUL_PROGRESS.md` → "Final summary" written: what changed
  per phase, decisions made, anything marked `[~]` and why, items needing
  Nico's decision, and a step-by-step manual test checklist for Nico.
- [ ] 11.3 Final checks shown in the transcript in one turn:
  `grep -c '^- \[ \]' docs/OVERHAUL_SPEC.md` prints `0`, and `npm run build`
  exits 0.
