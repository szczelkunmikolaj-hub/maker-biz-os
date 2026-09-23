# Overhaul Progress

## Current phase
Phase 11 — Wrap-up

## Log

### Phase 0 — Setup and baseline (complete)
- Created branch `overhaul` from `main`
- Created docs/OVERHAUL_PROGRESS.md
- Baseline build: exits 0 in 7.59s (chunk size warning only, not an error)
- Installed playwright devDependency, created scripts/screenshots.mjs
  - Decision: uses `vite preview` instead of `vite dev` because `base64-js` ESM default-export error in dev mode causes blank pages
- Captured 28 screenshots (14 routes × desktop+mobile)

### Phase 1 — Navigation and data correctness (complete)
- Fixed useEffect in Projects.tsx to clear selectedId when URL id param absent (back nav)
- Added router state {from} to all 5 entry points (Projects, Kanban, Calendar, Dashboard, Customers)
- setSearchParams({}) now uses replace:true
- Verified all 4 data-correctness items (kanbanStatus, date filtering, filament costs, margin null)

### Phase 2 — Workflow model: stages and design work (complete)
- ProductionStage type + normalizeStage() idempotent normalizer in types/index.ts
- STAGE_META / STAGE_ORDER constants; moveProject updated; Kanban rebuilt to 6-column layout
- MonthContext uses normalizeStage; delivered stage sets sent+shippingDate
- Stage CSS tokens in index.css (light + dark)
- DesignItem interface + designItems?: DesignItem[] in Project type; design section in ProjectDetail
- designRate: 20 in DEFAULT_SETTINGS; getProjectEstimatedCost updated; Settings shows both rates
- New project dropdown reordered; zero-plate projects render cleanly; progress bar guarded
- getProgressSummary() shared function used in detail, cards, and Kanban

### Phase 4 — Project detail page redesign (complete)
- Full two-column layout (lg:grid-cols-[1fr,300px]): left column has 3D preview, plates, "Add to this project", design work, expenses; right sidebar has 5 cards
- Header: 3-row layout (back+name+next-step / customer·stage·payment·price / collect-payment+tracking+⋯)
- Next step button uses action verbs via NEXT_ACTION map; design-aware "Start design" vs "Start printing" from New
- Invoice moved to ⋯ menu; Delete requires window.confirm()
- 3D preview card with min-h-[280px], thumbnail strip, fullscreen dialog — orbit/zoom marked [~] (thumbnails only, no raw model files)
- Per-card sidebar edit via SidebarEditBtn/editSection state: Customer, Payment, Dates, Costs & margin, Notes
- Costs & margin card with ⓘ popover cost breakdown (material/machine/design/expenses)
- "Add to this project" panel: PlateImporter + Add plate manually; compact when plates exist
- Timeline section: sorted events list + Add note input stored in project JSONB
- Screenshots verified: desktop 1-plate, 4-plate; mobile views all correct

### Phase 10 — Global polish (complete)
- **10.1 Tokens**: Replaced hardcoded `text-emerald-*`, `text-red-*`, `text-yellow-*` with CSS token classes in Projects, Dashboard, ProjectDetail, ProductionSummary, Expenses. Added `.badge-success`, `.badge-warning`, `.badge-danger` utility classes to index.css using `color-mix()`
- **10.2 Canvas**: Applied `bg-[var(--canvas)]` to `<main>` in Layout.tsx; `--background` already uses off-white `hsl(220 20% 97%)`; `--canvas` token already defined for both themes
- **10.3 Dark mode**: Added `ThemeProvider` from `next-themes` wrapping App.tsx; Added "Appearance" card to SettingsPage with Light/Dark/System buttons; Dark CSS variables already fully defined; Screenshots verified across all 14 routes × 2 viewports × 2 themes = 56 screenshots
- **10.4 Help icons**: Verified all sidebar nav items have hints; added hints to Customers and Data items; Dashboard HelpTips have content; Templates description translation key exists
- **10.5 Copy**: Verified active verbs on buttons ("Mark as paid" → toast "Marked as paid"); sentence case throughout; consistent nouns (Project, Plate, Stage, Payment, Customer)
- **10.6 Empty states**: Verified FilamentPurchases, Projects, Customers, Expenses all have empty states with CTAs; Dashboard has noData panel
- **10.7 Accessibility**: Added `prefers-reduced-motion` media query to index.css; shadcn components provide focus-visible rings; form labels present throughout
- **10.8 Screenshots**: Updated scripts/screenshots.mjs to capture light + dark themes; 56 screenshots verified; dark Kanban, project detail, dashboard, settings all look correct

### Phase 9 — Filament (complete)
- Added `color?: string` and `colorSwatch?: string` to `FilamentPurchase` type (types/index.ts)
- Rewrote FilamentPurchases.tsx: flat table → grouped cards (material + color key)
- Each group card: color swatch circle, label "Material – Color", purchase count, 3-col stock grid (bought/est.used/est.remaining), asterisk disclaimer
- Est. used = proportional share of total material usage from project plates; est. remaining = max(0, bought - used)
- Low-stock badge (amber, AlertTriangle icon) when estRemaining < 200g
- Add-purchase form: added "Colour name" text field + color swatch `<input type="color">` in 2-col grid
- Screenshots verified: grouped view correct desktop+mobile; all items 9.1–9.3 [x]

### Phase 8 — Dashboard (complete)
- Added large primary Profit card (€ large font) with delta vs previous period
- Added 5 supporting KPIs (Revenue, Spending, Outstanding, Active, Hours) with prev-period delta arrows
- Previous period computed by shifting current interval back by its own duration
- Replaced "Today's tasks" with "Needs attention" panel: overdue, due-within-3-days, delivered-but-unpaid, awaiting-approval
- "Nothing needs attention" empty state (green checkmark)
- Removed old 3-equal quick-stats bar and old KEY METRICS section heading (sentence case now)
- Added HelpTip ⓘ on profit number and all 5 KPIs
- [~] Secondary analytics collapsible: not done; [~] ⓘ on charts: not done
- Screenshots verified: profit number dominant, 5 KPIs below, needs-attention panel visible

### Phase 7 — Calendar (complete)
- Rewrote CalendarPage with 3 event types: order (blue), due (amber), delivered (green) + overdue (red)
- Legend buttons at top act as filter + visual key
- Event chips: text-xs (12px), title tooltip with full name
- Month/week view toggle (week shows 7 days with expanded cells, all events visible)
- Today highlighted with primary ring
- Mobile (<640px): grid hidden, agenda list shown instead — same month nav + upcoming events in list format
- Event clicks navigate to /projects?id= with state {from:'/calendar'} for back support
- Screenshots verified: desktop month view with color chips; mobile agenda with dot indicators

### Phase 6 — Kanban (complete)
- Added timeline event writing to moveProject(): type='stage-changed', label='Moved to {stage}'
- STAGE_META and TimelineEvent imported to AppContext
- Empty optional columns (in-design, awaiting-approval) auto-collapse when empty (??-operator logic)
- All other items (stages, count+value headers, compact cards, due urgency, delivered 14-day filter) already implemented

### Phase 5 — Projects list (complete)
- SortKey updated to active-first|due-date|date|date-asc|price|customer-az; ViewMode cards|list; ACTIVE_STAGE_ORDER constant
- Three separate filters: stageFilter, payFilter, sourceFilter (all combinable with search)
- Active-first sort splits filtered into active + delivered; delivered collapses at bottom with "Delivered (N)" expand toggle
- List view: sticky header row, flex rows with thumbnail+name/customer/stage/payment/price/progress/due columns; hover reveals Mark paid, Next step (moveProject), ⋯ menu
- Card view: removed colored top border and recurring ring per spec; kept stage badge, payment badge, price, margin, progress summary, due date, source
- Screenshots verified: desktop and mobile show active-first order, delivered collapse, new filter controls

### Phase 3 — Payments (complete)
- PaymentBadge.tsx shared component using CSS tokens --pay-unpaid/--pay-partial/--pay-paid
- RecordPaymentDialog.tsx reusable dialog with fixed/% amount toggle, date, method, note
- useMarkAsPaid.ts hook: records full balance, shows undo toast (6s) with project ref tracking
- ProjectDetail.tsx payment section rewritten: summary row + badge, Mark as paid button, chevron-revealed Record payment form (fixed/%), collapsed payments list (edit+delete per row)
- Projects.tsx card menu: Mark as paid + Record payment actions added
- KanbanBoard.tsx: card dropdown with payment actions; replaced PayBadge inline with PaymentBadge
- Screenshots verified: desktop and mobile payment sections look correct

## Decisions made
- Use `vite preview` (build output) for screenshots instead of dev server — dev server has base64-js ESM issue causing blank renders

## Needs Nico's decision
(none yet)

## Known issues
- `base64-js` ESM export error in vite dev server; build is fine

## Observed issues (baseline screenshots, 2026-09-22)

### Dashboard
- ALL-CAPS section label "KEY METRICS" (must be sentence case)
- Money amounts in green (spec: neutral text only)
- No single "primary number" — all KPIs at equal visual weight
- Dashboard extremely dense; no clear hierarchy
- Charts present but small and hard to read
- "Needs attention" panel is missing; no overdue/unpaid highlighting

### Projects list
- Massive negative estimated margins shown (-13905%!) from incorrect calculation
- No separate stage + payment badges; single status badge only
- No list/card view toggle (card view only)
- No sort options (only "Newest first")
- Canvas is white (should be hsl(220 16% 96%))
- No grouped "Active first" sort
- Delivered projects mixed in with active (not collapsed)

### Project detail
- Single-column layout (spec wants two-column on desktop)
- No "Next step" primary button in header
- No design work section
- No timeline section
- No separate sidebar cards (Customer, Payment, Dates, Costs & margin, Notes each editable inline)
- Large "Edit details" button expands all fields at once (not per-card editing)
- Payment section present but layout needs redesign (missing chevron for "Record payment")
- Balance shown in red by default even when not overdue

### Kanban
- Column names: "New Order", "Printing", "Finished", "Paid", "Shipped"
  → Spec: New, In design, Awaiting approval, Printing, Ready, Delivered
- "Paid" is a kanban column (payment must not be a production stage)
- No per-column totals (€ value shown)
- Cards: no payment badge visible, no due urgency colour

### Calendar
- Events appear fine but no legend, no visual distinction between due/order/delivered dates

### Filament
- No colour field on purchases
- No grouping by material+colour
- No estimated usage or remaining grams
- No low-stock hint

### Settings
- "Hourly rate" not renamed to "Machine rate (€/hour of printing)"
- No "Design rate (€/hour of your time)" field

### Global
- Pure white canvas (should be hsl(220 16% 96%))
- Hardcoded Tailwind colours throughout (green, red, blue, amber)
- No dark mode
- Some icons have no ⓘ tooltip content
- Copy is inconsistent (ALL CAPS labels, passive voice buttons)

## Final summary

### What changed per phase

**Phase 0 — Setup**: Created `overhaul` branch, installed Playwright, built screenshot script (14 routes × 2 viewports). Baseline captured.

**Phase 1 — Navigation**: Fixed back-navigation bug in Projects (URL id param clear); added `{state:{from}}` to 5 entry points; `setSearchParams` uses `replace:true`.

**Phase 2 — Workflow model**: Added `ProductionStage` type, `normalizeStage()` idempotent normalizer, `STAGE_META`/`STAGE_ORDER` constants. Rebuilt Kanban to 6-column layout (New → In design → Awaiting approval → Printing → Ready → Delivered). Added `DesignItem` type and design section to project detail. Added `designRate` to settings.

**Phase 3 — Payments**: `PaymentBadge` shared component using CSS token `--pay-*` colors. `RecordPaymentDialog` reusable dialog (fixed/% toggle, date, method, note). `useMarkAsPaid` hook with undo toast. Payment section rewritten in ProjectDetail with chevron-revealed "Record payment" form. Card/Kanban menus both get payment actions.

**Phase 4 — Project detail page redesign**: Full two-column layout (left: 3D preview, plates, design work, expenses; right sidebar: 5 cards). Header: 3-row layout with Next step button using action verbs via `NEXT_ACTION` map. Per-card sidebar editing. 3D preview card with thumbnail strip and fullscreen dialog. Timeline section with events list + add note. Costs & margin card with ⓘ popover cost breakdown.

**Phase 5 — Projects list**: Added SortKey, ViewMode types, `ACTIVE_STAGE_ORDER`. Three independent filters (stage, pay, source) + active-first sort + delivered collapse. List view with sticky header, hover actions. Card view cleanup (removed colored top border, recurring ring).

**Phase 6 — Kanban**: Added timeline event writing to `moveProject()` (`stage-changed` event). Empty optional columns (in-design, awaiting-approval) auto-collapse when empty.

**Phase 7 — Calendar**: Complete rewrite with 3 event types (order/due/delivered), color-coded, filtered legend. Week/month toggle. Mobile agenda list. Overdue dates highlighted in `--danger`.

**Phase 8 — Dashboard**: Large profit card (€ dominant, 5xl font) with prev-period delta. 5 supporting KPIs (Revenue, Spending, Outstanding, Active, Hours) with HelpTips and deltas. "Needs attention" panel (overdue > due-3-days > delivered-unpaid > awaiting-approval). Removed old equal-weight KPI bar and "KEY METRICS" ALL-CAPS label.

**Phase 9 — Filament**: Added `color` and `colorSwatch` fields to `FilamentPurchase` type. Rewrote FilamentPurchases page: flat table → grouped cards by material + color. Each group shows bought/est.used/est.remaining with amber low-stock badge (<200g). Add-purchase form gets colour name + swatch picker.

**Phase 10 — Global polish**: Dark mode via `ThemeProvider` from `next-themes`; Light/Dark/System selector added to Settings. Hardcoded `text-emerald-*`, `text-red-*`, `text-yellow-*` replaced with CSS token classes (`text-[var(--pay-paid)]`, `text-[var(--danger)]` etc.) across Projects, Dashboard, ProjectDetail, ProductionSummary, Expenses. Added `.badge-success`, `.badge-warning`, `.badge-danger` utility classes using `color-mix()`. Canvas background `bg-[var(--canvas)]` applied to main content area. `prefers-reduced-motion` media query added. All sidebar nav items now have HelpTip content. 56 screenshots taken (14 routes × 2 viewports × 2 themes).

### Decisions made
- Use `vite preview` (build output) for screenshots — dev server has base64-js ESM issue
- Filament usage is distributed proportionally across same-material color groups (share = group's bought / total material bought)
- `defaultTheme="system"` for ThemeProvider so new users get their OS preference automatically
- Badge states use `color-mix()` in CSS utility classes rather than Tailwind arbitrary values for cleaner markup

### Items marked [~] (partial / deferred)
- **8.4** Secondary analytics collapsible: not implemented (low priority, charts are already below the fold)
- **8.5** ⓘ tooltips on charts: not implemented (Recharts doesn't support this natively without heavy wrappers)
- **3D model preview**: Shows thumbnails only, not raw model files (no model files available in demo data)

### Items needing Nico's decision
- **Chart ⓘ tooltips (8.5)**: Add explanatory tooltips on chart headers? Needs custom Recharts wrapper work.
- **Filament secondary analytics collapsible (8.4)**: Collapse the Revenue/Profit/Hours/Material charts behind a "Show details" toggle?
- **Negative demo margins**: Demo project data has cost >> price, producing extreme negative margins (−1305% etc.). Should the demo data be refreshed with realistic prices, or display a "demo data" note on margin figures?

### Manual test checklist for Nico

**Navigation**
- [ ] Click a project card → project detail opens; back arrow/← returns to projects list at same scroll
- [ ] Open a project from Kanban → back returns to /kanban
- [ ] Open a project from Calendar → back returns to /calendar
- [ ] Browser back button works on all routes

**Stages & Kanban**
- [ ] Drag a project to "In design" → stage badge updates on card; Timeline shows "Moved to In design"
- [ ] "In design" and "Awaiting approval" columns collapse when empty; expand when a project moves in
- [ ] All 6 stages present: New, In design, Awaiting approval, Printing, Ready, Delivered

**Payments**
- [ ] "Mark as paid" on a project → badge turns Paid; undo toast appears for 6s
- [ ] "Record payment" → partial payment with amount/% toggle, date, method saves correctly
- [ ] Partial payment shows "Partially paid" badge with remaining balance

**Dashboard**
- [ ] Profit number dominates; 5 KPIs below show prev-period deltas
- [ ] "Needs attention" panel shows overdue projects; clears when none exist
- [ ] Changing period (This Month / Last Month / This Year) updates all numbers

**Calendar**
- [ ] Order dates, due dates, and delivery dates shown in different colours
- [ ] Legend buttons filter event types
- [ ] Week toggle shows 7-day grid; month toggle returns to grid
- [ ] Mobile view shows agenda list

**Filament**
- [ ] Add a purchase with colour name "Arctic White" and swatch — groups correctly
- [ ] Group card shows total bought / est. used / est. remaining
- [ ] Add a purchase that brings remaining below 200g → amber "Low stock" badge appears

**Dark mode**
- [ ] Settings → Appearance → Dark: entire app switches to dark theme
- [ ] Settings → System: matches OS preference
- [ ] All text remains readable in dark mode; no invisible text

**Project detail**
- [ ] Two-column layout on desktop; stacks on mobile
- [ ] "Next step" primary button shows correct action verb for current stage
- [ ] Each sidebar card (Customer, Payment, Dates, Costs & margin, Notes) editable inline
- [ ] Adding a plate shows in the left column; progress bar updates
- [ ] Timeline shows stage-change events + manual notes
