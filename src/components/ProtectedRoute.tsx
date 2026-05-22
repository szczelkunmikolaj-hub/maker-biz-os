import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabaseConfigured } from '@/integrations/supabase/client';
import Landing from '@/pages/Landing';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({ children, allowLanding = false }: { children: React.ReactNode; allowLanding?: boolean }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  // If Supabase is not configured, bypass auth entirely and show the app
  if (!supabaseConfigured) return <>{children}</>;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!session) {
    if (allowLanding) return <Landing />;
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
