import { cn } from "@/lib/utils";
import { UnifiedStatus, getStatusMeta } from "@/lib/projectStatus";

interface Props {
  status: UnifiedStatus;
  className?: string;
  withDot?: boolean;
}

/** Unified status pill used across Kanban, Calendar, Project cards, Dashboard. */
export function StatusPill({ status, className, withDot = true }: Props) {
  const m = getStatusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        m.bg,
        m.text,
        m.border,
        className,
      )}
    >
      {withDot && <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />}
      {m.label}
    </span>
  );
}
