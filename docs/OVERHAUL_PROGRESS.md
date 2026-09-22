# Overhaul Progress

## Current phase
Phase 1 — Navigation and data correctness

## Log

### Phase 0 — Setup and baseline (complete)
- Created branch `overhaul` from `main`
- Created docs/OVERHAUL_PROGRESS.md
- Baseline build: exits 0 in 7.59s (chunk size warning only, not an error)
- Installed playwright devDependency, created scripts/screenshots.mjs
  - Decision: uses `vite preview` instead of `vite dev` because `base64-js` ESM default-export error in dev mode causes blank pages
- Captured 28 screenshots (14 routes × desktop+mobile)

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
(to be written in Phase 11)
