import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, DollarSign, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DISMISSED_KEY = 'pt_welcome_dismissed';

const FEATURES = [
  { icon: BarChart3, title: 'Track orders', desc: 'Every print, margin, and deadline in one place' },
  { icon: DollarSign, title: 'Know your profit', desc: 'See exactly what you earn per project' },
  { icon: FileText, title: 'Generate invoices', desc: 'Professional invoices with one click' },
];

export function GuestWelcomeOverlay() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === 'true'
  );

  if (dismissed || localStorage.getItem('pt_guest_mode') !== 'true') return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/97 backdrop-blur-sm px-4">
      <div className="max-w-lg w-full text-center space-y-8">
        <div className="flex items-center justify-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-lg" style={{ fontFamily: 'Space Grotesk' }}>PT</span>
          </div>
          <span className="font-bold text-2xl" style={{ fontFamily: 'Space Grotesk' }}>PrintTrack</span>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
            Welcome to PrintTrack
          </h1>
          <p className="text-base text-muted-foreground max-w-sm mx-auto">
            You're exploring with sample data. Everything you see is real — just not yours yet.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {FEATURES.map(f => (
            <div key={f.title} className="rounded-xl border bg-card p-4 space-y-2.5">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <f.icon className="h-5 w-5" />
              </div>
              <p className="font-semibold text-sm" style={{ fontFamily: 'Space Grotesk' }}>{f.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <Button size="lg" className="w-full max-w-xs text-base py-6 h-auto mx-auto block" onClick={dismiss}>
            Start exploring →
          </Button>
          <Link
            to="/auth?mode=signin"
            className="block text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
