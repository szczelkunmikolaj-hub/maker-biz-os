import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useTier } from '@/context/TierContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Check } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

const CHOICE_KEY = 'pt_trial_choice_made';

export function useTrialOptInNeeded(): boolean {
  const { user } = useAuth();
  const { tier, loading } = useTier();
  if (!user) return false;
  if (loading) return false;
  if (localStorage.getItem(CHOICE_KEY) === 'true') return false;
  // Only show for users on free tier who haven't chosen yet
  return tier === 'free';
}

export function TrialOptInModal() {
  const { user } = useAuth();
  const { loading: tierLoading } = useTier();
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const show = useTrialOptInNeeded();

  if (!show || done || tierLoading) return null;

  const dismiss = () => {
    localStorage.setItem(CHOICE_KEY, 'true');
    setDone(true);
  };

  const chooseFree = async () => {
    localStorage.setItem(CHOICE_KEY, 'true');
    setDone(true);
  };

  const startTrial = async () => {
    if (!user) return;
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('profiles')
      .update({ tier: 'pro_trial', trial_started_at: now })
      .eq('id', user.id);
    setBusy(false);
    if (error) {
      toast.error('Could not start trial. Please try again.');
      return;
    }
    localStorage.setItem(CHOICE_KEY, 'true');
    toast.success(t('tier.trialStartedToast'));
    // Reload to pick up new tier from Supabase
    window.location.reload();
  };

  const freeFeatures = [
    t('tier.freeFeat1'),
    t('tier.freeFeat2'),
    t('tier.freeFeat3'),
  ];

  const proFeatures = [
    t('tier.proFeat2'),
    t('tier.proFeat3'),
    t('tier.proFeat4'),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-6 border">
        {/* Header */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
            {t('tier.welcomeTitle')}
          </h2>
          <p className="text-muted-foreground">{t('tier.welcomeDesc')}</p>
        </div>

        {/* Two plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Free plan */}
          <div className="rounded-xl border bg-card p-5 space-y-4 flex flex-col">
            <div>
              <p className="font-semibold text-lg">{t('tier.tierFree')}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{t('tier.freeFeat1')}</p>
            </div>
            <ul className="space-y-2 flex-1">
              {freeFeatures.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full" onClick={chooseFree} disabled={busy}>
              {t('tier.continueFreePlan')}
            </Button>
          </div>

          {/* Pro trial */}
          <div className="rounded-xl border-2 border-primary bg-primary/5 p-5 space-y-4 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground px-3 py-0.5 text-xs font-semibold">
                {t('tier.mostPopular')}
              </Badge>
            </div>
            <div>
              <p className="font-semibold text-lg text-primary flex items-center gap-1.5">
                {t('tier.tierProTrial')} <Zap className="h-4 w-4" />
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">{t('tier.trialNoCreditCard')}</p>
            </div>
            <ul className="space-y-2 flex-1">
              {proFeatures.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Button className="w-full gap-2" onClick={startTrial} disabled={busy}>
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                  {t('tier.startTrialBtn')}
                </span>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  {t('tier.startTrialBtn')}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Dismiss link */}
        <p className="text-center text-xs text-muted-foreground">
          <button type="button" className="underline hover:no-underline" onClick={dismiss}>
            {t('tier.decideLaterId')}
          </button>
        </p>
      </div>
    </div>
  );
}
