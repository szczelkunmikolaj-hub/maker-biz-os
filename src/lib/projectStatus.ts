import { Project } from "@/types";
import { parseISO, isBefore, startOfToday } from "date-fns";

export type UnifiedStatus =
  | "new"
  | "preparing"
  | "printing"
  | "postprocessing"
  | "ready"
  | "shipped"
  | "completed"
  | "overdue";

export interface StatusMeta {
  key: UnifiedStatus;
  label: string;
  /** Tailwind text class using semantic token */
  text: string;
  /** Tailwind bg tinted class */
  bg: string;
  /** Tailwind border class */
  border: string;
  /** Tailwind border-top class for cards */
  borderTop: string;
  /** Solid dot bg class */
  dot: string;
}

const META: Record<UnifiedStatus, StatusMeta> = {
  new:            { key: "new",            label: "New",             text: "text-status-new",            bg: "bg-status-new/10",            border: "border-status-new/30",            borderTop: "border-t-status-new",            dot: "bg-status-new" },
  preparing:      { key: "preparing",      label: "Preparing",       text: "text-status-preparing",      bg: "bg-status-preparing/10",      border: "border-status-preparing/30",      borderTop: "border-t-status-preparing",      dot: "bg-status-preparing" },
  printing:       { key: "printing",       label: "Printing",        text: "text-status-printing",       bg: "bg-status-printing/10",       border: "border-status-printing/30",       borderTop: "border-t-status-printing",       dot: "bg-status-printing" },
  postprocessing: { key: "postprocessing", label: "Post-processing", text: "text-status-postprocessing", bg: "bg-status-postprocessing/10", border: "border-status-postprocessing/30", borderTop: "border-t-status-postprocessing", dot: "bg-status-postprocessing" },
  ready:          { key: "ready",          label: "Ready",           text: "text-status-ready",          bg: "bg-status-ready/10",          border: "border-status-ready/30",          borderTop: "border-t-status-ready",          dot: "bg-status-ready" },
  shipped:        { key: "shipped",        label: "Shipped",         text: "text-status-shipped",        bg: "bg-status-shipped/10",        border: "border-status-shipped/30",        borderTop: "border-t-status-shipped",        dot: "bg-status-shipped" },
  completed:      { key: "completed",      label: "Completed",       text: "text-status-completed",      bg: "bg-status-completed/15",      border: "border-status-completed/30",      borderTop: "border-t-status-completed",      dot: "bg-status-completed" },
  overdue:        { key: "overdue",        label: "Overdue",         text: "text-status-overdue",        bg: "bg-status-overdue/15",        border: "border-status-overdue/30",        borderTop: "border-t-status-overdue",        dot: "bg-status-overdue" },
};

export function getStatusMeta(status: UnifiedStatus): StatusMeta {
  return META[status];
}

/** Derive a unified status from a Project for visual display. */
export function deriveProjectStatus(p: Project): UnifiedStatus {
  const isCompleted = p.printed && p.paid && p.sent;
  if (isCompleted) return "completed";
  if (p.sent) return "shipped";

  const overdue = p.dueDate && isBefore(parseISO(p.dueDate), startOfToday());
  if (overdue) return "overdue";

  const prints = p.prints || [];
  const anyPrinting = prints.some(pr => pr.status === "printing");
  if (anyPrinting) return "printing";

  const allDone = prints.length > 0 && prints.every(pr => (pr.completedQuantity || 0) >= (pr.quantity || 1));
  if (allDone || p.printed) return "ready";

  if (prints.length > 0) return "preparing";
  return "new";
}
