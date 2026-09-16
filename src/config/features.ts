// ── Feature flags ─────────────────────────────────────────────────────────────
// Set to true once the corresponding Supabase edge functions are deployed and
// their secrets (STRIPE_SECRET_KEY, RESEND_API_KEY, etc.) are configured.

/** Show the "Send Payment Link" button in ProjectDetail and call create-payment-link. */
export const PAYMENTS_ENABLED = false;

/** Fire notify-shipped edge function when a project moves to "shipped" status. */
export const NOTIFICATIONS_ENABLED = false;
