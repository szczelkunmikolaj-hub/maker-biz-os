import { useState } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useDemo } from "@/context/DemoContext";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";

const DISMISSED_KEY = "pt_checklist_dismissed";

interface Step {
  id: string;
  label: string;
  hint: string;
  linkTo?: string;
  linkLabel?: string;
}

const STEPS: Step[] = [
  { id: "project",  label: "Add your first project",            hint: "Start tracking orders right away.", linkTo: "/projects", linkLabel: "Go to Projects" },
  { id: "filament", label: "Log a filament purchase",           hint: "Track your material costs accurately.", linkTo: "/filament", linkLabel: "Go to Filament" },
  { id: "expense",  label: "Add an expense",                    hint: "Keep your overheads in the picture.", linkTo: "/expenses", linkLabel: "Go to Expenses" },
  { id: "tracking", label: "Copy an order tracking link",       hint: "Share it with a customer from any project." },
  { id: "quote",    label: "Try the quote calculator",          hint: "See how to price your next job.", linkTo: "/quote", linkLabel: "Open Quote Calculator" },
];

export function ActivationChecklist() {
  const { projects, filamentPurchases, expenses } = useApp();
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === "true");
  const [open, setOpen] = useState(true);

  const isGuest = localStorage.getItem("pt_guest_mode") === "true";
  if (!user || isGuest || isDemoMode || dismissed) return null;

  const done: Record<string, boolean> = {
    project:  projects.length > 0,
    filament: filamentPurchases.length > 0,
    expense:  expenses.length > 0,
    tracking: localStorage.getItem("pt_checklist_copied_tracking") === "true",
    quote:    localStorage.getItem("pt_checklist_visited_quote") === "true",
  };

  const completedCount = Object.values(done).filter(Boolean).length;

  // Hide once everything is done
  if (completedCount === STEPS.length) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {/* Header row — always visible */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-sm font-semibold text-foreground">Getting started</p>
            <span className="text-xs text-muted-foreground">{completedCount}/{STEPS.length} done</span>
          </div>
          <Progress value={(completedCount / STEPS.length) * 100} className="h-1.5" />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); handleDismiss(); }}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Step list */}
      {open && (
        <ul className="border-t border-border/40 divide-y divide-border/30">
          {STEPS.map(step => {
            const isComplete = done[step.id];
            return (
              <li key={step.id} className="flex items-start gap-3 px-4 py-2.5">
                {isComplete
                  ? <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  : <Circle className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${isComplete ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {step.label}
                  </p>
                  {!isComplete && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {step.hint}
                      {step.linkTo && (
                        <>
                          {" "}
                          <Link to={step.linkTo} className="text-primary underline underline-offset-2 hover:no-underline">
                            {step.linkLabel}
                          </Link>
                        </>
                      )}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
