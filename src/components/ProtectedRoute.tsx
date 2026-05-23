import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabaseConfigured } from '@/integrations/supabase/client';
import Landing from '@/pages/Landing';
import { Loader2 } from 'lucide-react';

// When OAuth redirects back with #access_token in the hash, keep the spinner
// until Supabase processes the token and fires SIGNED_IN. Without this guard,
// ProtectedRoute would flash Landing before the session is established.
function hasOAuthHash() {
  return window.location.hash.includes('access_token') ||
         window.location.hash.includes('error_description');
}

export function ProtectedRoute({ children, allowLanding = false }: { children: React.ReactNode; allowLanding?: boolean }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  // If Supabase is not configured, bypass auth entirely and show the app
  if (!supabaseConfigured) return <>{children}</>;

  if (loading || hasOAuthHash()) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!session) {
    const isGuest = localStorage.getItem('pt_guest_mode') === 'true';
    if (isGuest) return <>{children}</>;
    if (allowLanding) return <Landing />;
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  // Authenticated — clear any lingering guest flag synchronously before children render
  localStorage.removeItem('pt_guest_mode');
  return <>{children}</>;
}
