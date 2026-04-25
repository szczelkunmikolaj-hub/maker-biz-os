import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** "sm" for inline next to names, "md" for card headers */
  size?: "sm" | "md";
  /** Show pulse glow */
  glow?: boolean;
}

/** Glowing gradient "RECURRING" badge for repeat customers. */
export function RecurringBadge({ className, size = "sm", glow = true }: Props) {
  const sizeClass = size === "md" ? "text-[10px] px-2 py-0.5" : "text-[9px] px-1.5 py-0.5";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide",
        "bg-gradient-to-r from-recurring-from to-recurring-to text-white border border-recurring-from/40",
        glow && "animate-recurring-glow",
        sizeClass,
        className,
      )}
      title="Recurring customer"
    >
      <Star className={cn("fill-current", size === "md" ? "h-3 w-3" : "h-2.5 w-2.5")} />
      Recurring
    </span>
  );
}

/** Small star marker that can sit next to a customer name. */
export function RecurringStar({ className }: { className?: string }) {
  return (
    <Star
      className={cn("h-3 w-3 fill-recurring-from text-recurring-from drop-shadow-[0_0_4px_hsl(var(--recurring-to)/0.6)]", className)}
      aria-label="Recurring customer"
    />
  );
}
