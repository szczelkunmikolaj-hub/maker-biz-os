import type { PaymentMethod, CustomerSource } from "@/types";
import { PAYMENT_METHOD_TOKENS, CUSTOMER_SOURCE_TOKENS, categoryBadgeStyle } from "@/lib/categoryColors";

interface PaymentMethodBadgeProps {
  method: PaymentMethod;
  className?: string;
}

interface CustomerSourceBadgeProps {
  source: CustomerSource;
  className?: string;
}

export function PaymentMethodBadge({ method, className = "" }: PaymentMethodBadgeProps) {
  const token = PAYMENT_METHOD_TOKENS[method] ?? "--pm-other";
  return (
    <span
      className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${className}`}
      style={categoryBadgeStyle(token)}
    >
      {method}
    </span>
  );
}

export function CustomerSourceBadge({ source, className = "" }: CustomerSourceBadgeProps) {
  const token = CUSTOMER_SOURCE_TOKENS[source] ?? "--cs-other";
  return (
    <span
      className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${className}`}
      style={categoryBadgeStyle(token)}
    >
      {source}
    </span>
  );
}

/** Compact coloured dot — for select option previews. */
export function CategoryDot({ token }: { token: string }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full shrink-0"
      style={{ background: `var(${token})` }}
    />
  );
}
