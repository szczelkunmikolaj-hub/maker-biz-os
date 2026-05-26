import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useDemo } from '@/context/DemoContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/useToast';
import { Loader2, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const { isDemoMode, toggleDemoMode } = useDemo();
  const toast = useToast();
  const { t } = useTranslation();
  const [tab, setTab] = useState(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [signUpDone, setSignUpDone] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate('/', { replace: true });
  }, [session, loading, navigate]);

  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('email address is already')) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        setBusy(false);
        if (signInErr) {
          toast.error(t('auth.emailExistsWrongPassword'));
        } else {
          navigate('/', { replace: true });
        }
      } else {
        setBusy(false);
        toast.error(error.message);
      }
    } else {
      setBusy(false);
      setSignUpDone(true);
    }
  };

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else navigate('/', { replace: true });
  };

  const onForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error(t('auth.emailRequired')); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else setResetSent(true);
  };

  const onGoogle = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://printrack.xyz/' },
    });
    if (error) { toast.error(t('auth.googleSignInFailed')); setBusy(false); }
  };

  const handleTryWithoutAccount = () => {
    localStorage.setItem('pt_guest_mode', 'true');
    localStorage.setItem('pt_first_visit_done', 'true');
    if (!isDemoMode) toggleDemoMode();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="p-6 space-y-5">
          {/* Logo + headline */}
          <div className="text-center space-y-3">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold" style={{ fontFamily: 'Space Grotesk' }}>PT</span>
              </div>
              <span className="font-bold text-xl" style={{ fontFamily: 'Space Grotesk' }}>PrintTrack</span>
            </Link>
            <h1 className="text-lg font-semibold leading-tight" style={{ fontFamily: 'Space Grotesk' }}>
              Track your 3D printing business like a pro
            </h1>
          </div>

          {/* Google — primary CTA */}
          <Button variant="outline" className="w-full h-11 text-sm font-medium" onClick={onGoogle} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : (
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {t('auth.continueWithGoogle')}
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">{t('common.or')}</span></div>
          </div>

          {/* Email / password */}
          <Tabs value={tab} onValueChange={v => { setTab(v); setSignUpDone(false); setShowForgotPassword(false); setResetSent(false); }}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">{t('auth.logIn')}</TabsTrigger>
              <TabsTrigger value="signup">{t('auth.signUp')}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              {showForgotPassword ? (
                resetSent ? (
                  <div className="mt-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 flex items-start gap-3">
                    <Mail className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800 dark:text-green-300">{t('auth.resetPasswordSent')}</p>
                      <button type="button" className="text-xs text-green-700 dark:text-green-400 underline hover:no-underline mt-2" onClick={() => { setShowForgotPassword(false); setResetSent(false); }}>
                        {t('auth.backToSignIn')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={onForgotPassword} className="space-y-3 mt-4">
                    <p className="text-sm text-muted-foreground">{t('auth.forgotPasswordDesc')}</p>
                    <div><Label>{t('auth.email')}</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t('auth.sendResetEmail')}
                    </Button>
                    <button type="button" className="block w-full text-center text-sm text-muted-foreground underline hover:no-underline" onClick={() => setShowForgotPassword(false)}>
                      {t('auth.backToSignIn')}
                    </button>
                  </form>
                )
              ) : (
                <>
                  <form onSubmit={onSignIn} className="space-y-3 mt-4">
                    <div><Label>{t('auth.email')}</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div>
                    <div><Label>{t('auth.password')}</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></div>
                    <div className="flex justify-end">
                      <button type="button" className="text-xs text-muted-foreground underline hover:no-underline" onClick={() => setShowForgotPassword(true)}>
                        {t('auth.forgotPassword')}
                      </button>
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t('auth.logIn')}
                    </Button>
                  </form>
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    {t('auth.noAccount')}{' '}
                    <button type="button" className="text-primary underline hover:no-underline" onClick={() => setTab('signup')}>
                      {t('auth.signUpLink')}
                    </button>
                  </p>
                </>
              )}
            </TabsContent>

            <TabsContent value="signup">
              {signUpDone ? (
                <div className="mt-4 rounded-lg bg-primary/10 border border-primary/25 p-4 flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-primary">{t('auth.confirmEmailMsg')}</p>
                    <button type="button" className="text-xs text-primary/70 underline hover:no-underline mt-2"
                      onClick={() => { setSignUpDone(false); setTab('signin'); }}>
                      {t('auth.backToSignIn')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <form onSubmit={onSignUp} className="space-y-3 mt-4">
                    <div><Label>{t('auth.email')}</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div>
                    <div><Label>{t('auth.password')}</Label><Input type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" /></div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t('auth.createAccount')}
                    </Button>
                  </form>
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    {t('auth.hasAccount')}{' '}
                    <button type="button" className="text-primary underline hover:no-underline" onClick={() => setTab('signin')}>
                      {t('auth.logInLink')}
                    </button>
                  </p>
                </>
              )}
            </TabsContent>
          </Tabs>

          {/* Try without account */}
          <button
            type="button"
            onClick={handleTryWithoutAccount}
            className="block w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Try without account →
          </button>
        </Card>

        {/* Footer links */}
        <div className="text-center space-y-2">
          <Link
            to="/about"
            className="block text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
          >
            Learn more about PrintTrack →
          </Link>
          <Link to="/trust" className="block text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors underline underline-offset-4">
            Trust &amp; Privacy
          </Link>
        </div>
      </div>
    </div>
  );
}
