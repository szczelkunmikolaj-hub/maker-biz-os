<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Maker Biz OS — a React + Vite SPA for managing 3D printing business operations. The `posthog-js` browser SDK was already installed and initialized in `src/main.tsx` with the persistent device user ID (`getUserId()`) used as the PostHog distinct ID. This session audited all existing event coverage and added tracking for four previously uninstrumented actions: template creation, template deletion, filament purchase deletion, and settings changes (debounced). Environment variables were verified and updated.

| Event | Description | File |
|---|---|---|
| `project_created` | User manually creates a new project via the New Project dialog | `src/pages/Projects.tsx` |
| `project_imported` | User imports a project from a .3mf or .gcode file | `src/pages/Projects.tsx` |
| `project_status_updated` | User toggles printed/paid/shipped status on a project | `src/pages/Projects.tsx` |
| `project_deleted` | User deletes a project | `src/components/ProjectDetail.tsx` |
| `project_duplicated` | User duplicates an existing project | `src/components/ProjectDetail.tsx` |
| `project_kanban_moved` | User drags a project card to a different Kanban column | `src/pages/KanbanBoard.tsx` |
| `expense_added` | User adds a new expense entry | `src/pages/Expenses.tsx` |
| `expense_deleted` | User deletes an expense entry | `src/pages/Expenses.tsx` |
| `filament_purchase_added` | User records a new filament purchase | `src/pages/FilamentPurchases.tsx` |
| `filament_purchase_deleted` | User deletes a filament purchase record *(added)* | `src/pages/FilamentPurchases.tsx` |
| `quote_calculated` | User uses the quote generator to compute a suggested price | `src/pages/QuoteGenerator.tsx` |
| `data_exported` | User exports all data as a JSON backup file | `src/pages/DataManagement.tsx` |
| `data_imported` | User imports data from a JSON backup (replace or merge) | `src/pages/DataManagement.tsx` |
| `template_created` | User saves a new reusable print template *(added)* | `src/pages/TemplatesPage.tsx` |
| `template_deleted` | User deletes a print template *(added)* | `src/pages/TemplatesPage.tsx` |
| `settings_updated` | User changes an app setting, debounced 1.5s *(added)* | `src/pages/SettingsPage.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](https://us.posthog.com/project/435066/dashboard/1618291)
- [Projects Created Over Time](https://us.posthog.com/project/435066/insights/8Xs9e1LP) — Weekly trend of new project creation
- [Project Payment & Shipping Conversion](https://us.posthog.com/project/435066/insights/FtkeUgjS) — Funnel: created → paid → shipped
- [Expenses Added by Category](https://us.posthog.com/project/435066/insights/0d2tQ25W) — Expense breakdown by category (Filament, Shipping, Equipment, etc.)
- [Project Churn (Deletions vs Creations)](https://us.posthog.com/project/435066/insights/JhcvsFBm) — Tracks project deletions alongside creations
- [Customer Source Breakdown](https://us.posthog.com/project/435066/insights/Jy7c1ZAe) — Projects created by acquisition channel (Instagram, Wallapop, Website, Other)

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
