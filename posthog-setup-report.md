<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Maker Biz OS — a React + Vite SPA for managing 3D printing business operations. The `posthog-js` browser SDK was installed and initialized in `src/main.tsx` with the persistent device user ID (`getUserId()`) used as the PostHog distinct ID, enabling per-device analytics without requiring user login. A central `src/lib/posthog.ts` module initializes the client from environment variables.

Event tracking was added across 8 files covering every major user workflow: project creation and file import, status progression (printed/paid/shipped), Kanban drag-and-drop, expense management, filament inventory, the quote generator, and data backup/restore.

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
| `quote_calculated` | User uses the quote generator to compute a suggested price | `src/pages/QuoteGenerator.tsx` |
| `data_exported` | User exports all data as a JSON backup file | `src/pages/DataManagement.tsx` |
| `data_imported` | User imports data from a JSON backup (replace or merge) | `src/pages/DataManagement.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1615337)
- [Key Business Actions Over Time](/insights/h8NddI61) — weekly trend of project creation, expense logging, and filament purchases
- [Project Lifecycle Funnel](/insights/I9sAmgnC) — conversion from project created → paid → shipped
- [Project Kanban Activity](/insights/R8WP1CoU) — how projects move between Kanban stages, broken down by destination column
- [Quote Calculator Usage](/insights/souSyliu) — weekly frequency of quote generator use
- [Data Exports & Imports](/insights/Z1Ah52z0) — backup and restore activity over time

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
