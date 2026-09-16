import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Package, Printer, CheckCircle, CreditCard, Send, Clock, AlertCircle } from "lucide-react";

type KanbanStatus = "new-order" | "printing" | "finished" | "paid" | "shipped";

interface TrackingData {
  found: boolean;
  name?: string;
  kanbanStatus?: KanbanStatus;
  dueDate?: string | null;
}

const STEPS: { key: KanbanStatus; label: string; icon: React.ElementType }[] = [
  { key: "new-order",  label: "New Order",  icon: Package },
  { key: "printing",   label: "Printing",   icon: Printer },
  { key: "finished",   label: "Finished",   icon: CheckCircle },
  { key: "paid",       label: "Paid",       icon: CreditCard },
  { key: "shipped",    label: "Shipped",    icon: Send },
];

const STATUS_ORDER: KanbanStatus[] = ["new-order", "printing", "finished", "paid", "shipped"];

export default function TrackOrderPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    supabase.functions
      .invoke("get-project-tracking", { body: { id: projectId } })
      .then(({ data: json, error }) => {
        if (error) { setData({ found: false }); return; }
        setData(json as TrackingData);
      })
      .catch(() => setData({ found: false }))
      .finally(() => setLoading(false));
  }, [projectId]);

  const currentIndex = data?.kanbanStatus ? STATUS_ORDER.indexOf(data.kanbanStatus) : -1;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-3">
            <Package className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Order Tracking</h1>
          <p className="text-sm text-muted-foreground">
            Check the status of your 3D print order
          </p>
        </div>

        {/* Content */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Looking up your order…</span>
          </div>
        )}

        {!loading && (!data?.found) && (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <AlertCircle className="h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">Order not found</p>
            <p className="text-xs text-center max-w-xs">
              Double-check the link you received. If you think this is an error, contact your shop.
            </p>
          </div>
        )}

        {!loading && data?.found && (
          <div className="space-y-6">
            {/* Order card */}
            <div className="rounded-2xl border bg-card p-5 space-y-1 shadow-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Your order</p>
              <p className="text-xl font-semibold">{data.name}</p>
              {data.dueDate && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 pt-1">
                  <Clock className="h-3.5 w-3.5" />
                  Estimated completion: {new Date(data.dueDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                </p>
              )}
            </div>

            {/* Status timeline */}
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-5">Status</p>
              <ol className="relative space-y-0">
                {STEPS.map((step, idx) => {
                  const isCompleted = idx < currentIndex;
                  const isActive    = idx === currentIndex;
                  const isFuture    = idx > currentIndex;
                  const Icon = step.icon;

                  return (
                    <li key={step.key} className="flex gap-4 pb-6 last:pb-0">
                      {/* Connector line */}
                      <div className="flex flex-col items-center">
                        <div className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 transition-colors
                          ${isCompleted ? "bg-primary text-primary-foreground" :
                            isActive    ? "bg-primary/15 text-primary ring-2 ring-primary" :
                                          "bg-muted text-muted-foreground"}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        {idx < STEPS.length - 1 && (
                          <div className={`w-0.5 flex-1 mt-1 transition-colors ${isCompleted ? "bg-primary" : "bg-border"}`} />
                        )}
                      </div>
                      {/* Label */}
                      <div className="pt-1.5 pb-1">
                        <p className={`text-sm font-medium leading-none ${isFuture ? "text-muted-foreground" : "text-foreground"}`}>
                          {step.label}
                        </p>
                        {isActive && (
                          <p className="text-xs text-primary mt-1">Current status</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Powered by{" "}
          <Link to="/about" className="underline underline-offset-2 hover:text-foreground transition-colors">
            PrintTrack
          </Link>
        </p>
      </div>
    </div>
  );
}
