import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let done = false;
    const go = (dest: '/' | '/auth') => {
      if (!done) { done = true; navigate(dest, { replace: true }); }
    };

    // Subscribe first so we don't miss the SIGNED_IN event that fires
    // once detectSessionInUrl (implicit) parses the hash.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) go('/');
    });

    // Primary: check if Supabase already established a session from the hash.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { go('/'); return; }

      // Fallback: manually parse #access_token=... from the URL hash and call setSession.
      // This handles the case where flowType or timing prevents auto-detection.
      const hash = window.location.hash.substring(1); // strip leading '#'
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token') ?? '';

      if (accessToken) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ data, error }) => {
            if (!error && data.session) go('/');
          });
      }
    });

    // Retry getSession after 1 s — Supabase may need a tick to finish processing the hash.
    const retry = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) go('/');
    }, 1000);

    // Give up and return to /auth after 5 s (satisfies ≥ 2 s requirement).
    const giveUp = setTimeout(() => go('/auth'), 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(retry);
      clearTimeout(giveUp);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
