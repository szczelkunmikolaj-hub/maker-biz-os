import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useDemo } from "@/context/DemoContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, Bell, ChevronRight } from "lucide-react";

const TOTAL_STEPS = 3;

export function OnboardingWizard() {
  const { settings, updateSettings, loading } = useApp();
  const { user } = useAuth();
  const { isDemoMode } = useDemo();

  const [step, setStep] = useState(1);
  const [printerCount, setPrinterCount] = useState(settings.printerCount || 1);
  const [printerModels, setPrinterModels] = useState(settings.printerModels || "");
  const [notificationEmail, setNotificationEmail] = useState(
    settings.notificationEmail || user?.email || ""
  );

  const isGuest = localStorage.getItem("pt_guest_mode") === "true";
  // Don't open until settings have finished loading from Supabase — prevents
  // a false-positive open during the async load while onboardingCompleted is
  // still undefined in the DEFAULT_SETTINGS initial state.
  const isOpen = !!(user && !isDemoMode && !isGuest && !loading && !settings.onboardingCompleted);

  const finish = (skipped = false) => {
    updateSettings({
      ...settings,
      printerCount: skipped ? settings.printerCount : printerCount,
      printerModels: skipped ? settings.printerModels : printerModels,
      notificationEmail: skipped ? settings.notificationEmail : notificationEmail,
      onboardingCompleted: true,
    });
  };

  const next = () => {
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1);
    } else {
      finish(false);
    }
  };

  const stepIcons = [
    <Printer key="p" className="h-5 w-5 text-primary" />,
    <Printer key="p2" className="h-5 w-5 text-primary" />,
    <Bell key="b" className="h-5 w-5 text-primary" />,
  ];

  const stepTitles = [
    "How many printers do you have?",
    "What printer(s) do you use?",
    "Notification email",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {stepIcons[step - 1]}
            Quick Setup ({step}/{TOTAL_STEPS})
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 mb-4">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <p className="text-sm font-medium mb-3">{stepTitles[step - 1]}</p>

        {step === 1 && (
          <div className="space-y-2">
            <Label>Number of printers</Label>
            <Input
              type="number"
              min={1}
              value={printerCount}
              onChange={e => setPrinterCount(Math.max(1, parseInt(e.target.value) || 1))}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Used to calculate your available print capacity.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <Label>Printer model(s)</Label>
            <Input
              placeholder="e.g. Bambu X1C, Prusa MK4"
              value={printerModels}
              onChange={e => setPrinterModels(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated if you have multiple. This is just for your reference.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <Label>Email for notifications</Label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={notificationEmail}
              onChange={e => setNotificationEmail(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              You'll get an email when new quote requests come in from your public quote page.
            </p>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between pt-2">
          <button
            onClick={() => finish(true)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
          <Button onClick={next} className="gap-1.5">
            {step < TOTAL_STEPS ? (
              <>Next <ChevronRight className="h-4 w-4" /></>
            ) : (
              "Finish setup"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
