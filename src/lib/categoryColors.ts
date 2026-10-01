import type { PaymentMethod, CustomerSource } from "@/types";

/** CSS variable token for each payment method (defined in index.css). */
export const PAYMENT_METHOD_TOKENS: Record<PaymentMethod, string> = {
  Cash:            "--pm-cash",
  PayPal:          "--pm-paypal",
  "Bank Transfer": "--pm-bank-transfer",
  Bizum:           "--pm-bizum",
  Stripe:          "--pm-stripe",
  Other:           "--pm-other",
};

/** CSS variable token for each customer source (defined in index.css). */
export const CUSTOMER_SOURCE_TOKENS: Record<CustomerSource, string> = {
  Wallapop:  "--cs-wallapop",
  Instagram: "--cs-instagram",
  Website:   "--cs-website",
  Other:     "--cs-other",
};

/** Resolved hex/hsl colors for Recharts — kept in sync with CSS variables. */
export const PAYMENT_METHOD_CHART_COLORS: Record<PaymentMethod, string> = {
  Cash:            "hsl(43,88%,40%)",
  PayPal:          "hsl(207,87%,37%)",
  "Bank Transfer": "hsl(238,55%,56%)",
  Bizum:           "hsl(338,70%,46%)",
  Stripe:          "hsl(255,72%,60%)",
  Other:           "hsl(220,8%,50%)",
};

export const CUSTOMER_SOURCE_CHART_COLORS: Record<CustomerSource, string> = {
  Wallapop:  "hsl(22,82%,48%)",
  Instagram: "hsl(303,60%,50%)",
  Website:   "hsl(171,62%,34%)",
  Other:     "hsl(220,8%,50%)",
};

/** Returns inline style for a tinted categorical badge. */
export function categoryBadgeStyle(token: string): React.CSSProperties {
  return {
    background: `color-mix(in srgb, var(${token}) 13%, transparent)`,
    color: `var(${token})`,
    border: `1px solid color-mix(in srgb, var(${token}) 28%, transparent)`,
  };
}

// React type import needed for React.CSSProperties
import type React from "react";
