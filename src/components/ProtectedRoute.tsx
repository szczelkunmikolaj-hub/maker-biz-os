import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabaseConfigured } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

// When OAuth redirects back with #access_token in the hash, keep the spinner
// until Supabase processes the token and fires SIGNED_IN. Without this guard,
// ProtectedRoute would flash before the session is established.
function hasOAuthHash() {
  return window.location.hash.includes('access_token') ||
         window.location.hash.includes('error_description');
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (!supabaseConfigured) return <>{children}</>;

  if (loading || hasOAuthHash()) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!session) {
    const isGuest = localStorage.getItem('pt_guest_mode') === 'true';
    if (isGuest) return <>{children}</>;
    return <Navigate to="/auth?mode=signup" state={{ from: location }} replace />;
  }
  // Authenticated — clear any lingering guest flag synchronously before children render
  localStorage.removeItem('pt_guest_mode');
  return <>{children}</>;
}
