// Lightweight toast wrapper around sonner.
// Provides a uniform variant-based API: success / error / warning / info.
// Sonner's <Toaster /> is already mounted in App.tsx (bottom-right by default).
import { toast as sonnerToast, type ExternalToast } from "sonner";

export type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastOptions extends ExternalToast {
  /** Auto dismiss in ms. Defaults to 4000. */
  duration?: number;
}

function show(variant: ToastVariant, message: string, opts: ToastOptions = {}) {
  const duration = opts.duration ?? 4000;
  const common = { duration, closeButton: true, ...opts };
  switch (variant) {
    case "success":
      return sonnerToast.success(message, common);
    case "error":
      return sonnerToast.error(message, common);
    case "warning":
      return sonnerToast.warning(message, common);
    case "info":
    default:
      return sonnerToast.info(message, common);
  }
}

export const appToast = {
  success: (msg: string, opts?: ToastOptions) => show("success", msg, opts),
  error: (msg: string, opts?: ToastOptions) => show("error", msg, opts),
  warning: (msg: string, opts?: ToastOptions) => show("warning", msg, opts),
  info: (msg: string, opts?: ToastOptions) => show("info", msg, opts),
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
};

/** Hook form for ergonomic usage in components. Stable identity. */
export function useToast() {
  return appToast;
}

export default useToast;
