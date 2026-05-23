import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FolderKanban, TrendingUp, CalendarDays } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, supabaseConfigured } from '@/integrations/supabase/client';

const LS_KEY = 'pt_welcome_dismissed';

const SLIDES = [
  {
    icon: FolderKanban,
    color: 'text-primary',
    bg: 'bg-primary/10',
    title: 'Track your projects',
    body: 'See all your 3D printing orders in one place — from new order to delivered.',
  },
  {
    icon: TrendingUp,
    color: 'text-emerald-600',
    bg: 'bg-emerald-500/10',
    title: 'Know your profit',
    body: 'Revenue, expenses, and net profit are calculated automatically for every project.',
  },
  {
    icon: CalendarDays,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    title: 'Manage your workload',
    body: 'Use the Kanban board and calendar to visualize deadlines and stay on schedule.',
  },
];

export function WelcomeModal() {
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (authLoading || !user) return;
    if (localStorage.getItem(LS_KEY) === 'true') return;

    if (!supabaseConfigured) {
      setOpen(true);
      return;
    }

    supabase
      .from('profiles')
      .select('welcome_dismissed')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.welcome_dismissed) {
          localStorage.setItem(LS_KEY, 'true');
        } else {
          setOpen(true);
        }
      })
      .catch(() => setOpen(true));
  }, [user, authLoading]);

  const dismiss = () => {
    setOpen(false);
    localStorage.setItem(LS_KEY, 'true');
    if (supabaseConfigured && user) {
      supabase
        .from('profiles')
        .update({ welcome_dismissed: true })
        .eq('user_id', user.id)
        .then(({ error }) => { if (error) console.warn('[welcome] profile update', error); });
    }
  };

  const Slide = SLIDES[step];
  const Icon = Slide.icon;
  const isLast = step === SLIDES.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent
        className="max-w-sm"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center gap-5 pt-2 pb-2 text-center">
          <div className={`h-16 w-16 rounded-2xl ${Slide.bg} flex items-center justify-center`}>
            <Icon className={`h-8 w-8 ${Slide.color}`} />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-bold tracking-tight">{Slide.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{Slide.body}</p>
          </div>

          <div className="flex gap-1.5 items-center">
            {SLIDES.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-200 ${i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted'}`}
              />
            ))}
          </div>

          <div className="flex gap-2 w-full">
            {step > 0 && (
              <Button variant="ghost" className="flex-1" onClick={() => setStep(s => s - 1)}>
                Back
              </Button>
            )}
            {!isLast ? (
              <Button className={step === 0 ? 'w-full' : 'flex-1'} onClick={() => setStep(s => s + 1)}>
                Next
              </Button>
            ) : (
              <Button className={step === 0 ? 'w-full' : 'flex-1'} onClick={dismiss}>
                Let's go
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
