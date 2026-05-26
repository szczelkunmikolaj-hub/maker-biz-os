import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

export function GuestBanner() {
  const [dismissed, setDismissed] = useState(false);

  const isGuest = localStorage.getItem('pt_guest_mode') === 'true';
  const overlayDismissed = localStorage.getItem('pt_welcome_dismissed') === 'true';

  if (!isGuest || dismissed || !overlayDismissed) return null;

  return (
    <div className="bg-primary/8 border-b border-primary/20 px-4 py-2.5 flex items-center gap-3 shrink-0">
      <p className="text-sm text-foreground/75 min-w-0 flex-1 truncate">
        You're viewing demo data — create a free account to track your real orders
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          to="/auth?mode=signup"
          className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          Create free account
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
          aria-label="Dismiss banner"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
