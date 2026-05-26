import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export function GuestGateModal() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handler = (e: Event) => {
      const { message: msg } = (e as CustomEvent<{ message: string }>).detail;
      setMessage(msg);
      setOpen(true);
    };
    document.addEventListener('guest-gate', handler);
    return () => document.removeEventListener('guest-gate', handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-1">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-base leading-snug px-2">{message}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5 pt-1">
          <Button asChild className="w-full">
            <Link to="/auth?mode=signup">Create free account</Link>
          </Button>
          <button
            onClick={() => setOpen(false)}
            className="block w-full text-center text-sm text-muted-foreground underline underline-offset-4 hover:no-underline py-1"
          >
            Continue exploring demo
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
