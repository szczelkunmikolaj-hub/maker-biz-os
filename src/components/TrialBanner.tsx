import { Link } from 'react-router-dom';
import { useTier } from '@/context/TierContext';
import { useDemo } from '@/context/DemoContext';
import { useTranslation } from 'react-i18next';

export function TrialBanner() {
  const { effectiveTier, isTrialActive, trialExpired, trialDaysLeft } = useTier();
  const { isDemoMode } = useDemo();
  const { t } = useTranslation();

  if (isDemoMode) return null;
  if (localStorage.getItem('pt_guest_mode') === 'true') return null;
  // Pro/Business users never see the banner
  if (effectiveTier === 'pro' || effectiveTier === 'business') return null;

  if (isTrialActive) {
    return (
      <div className="bg-primary/10 border-b border-primary/25 px-4 py-2 flex items-center justify-between shrink-0">
        <span className="text-sm font-medium text-primary">
          {t('tier.trialActiveBanner', { days: trialDaysLeft })}
        </span>
        <Link to="/pricing" className="text-xs text-primary underline hover:no-underline font-medium ml-4 shrink-0">
          {t('tier.viewPlans')}
        </Link>
      </div>
    );
  }

  if (trialExpired) {
    return (
      <div className="bg-orange-500/10 border-b border-orange-500/25 px-4 py-2 flex items-center justify-between shrink-0">
        <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
          {t('tier.trialEndedBanner')}
        </span>
        <Link to="/pricing" className="text-xs text-orange-700 dark:text-orange-400 underline hover:no-underline font-medium ml-4 shrink-0">
          {t('tier.upgradeCta')}
        </Link>
      </div>
    );
  }

  if (effectiveTier === 'free') {
    return (
      <div className="bg-muted/60 border-b px-4 py-2 flex items-center justify-between shrink-0">
        <span className="text-sm text-muted-foreground">
          {t('tier.freeBanner')}
        </span>
        <Link to="/pricing" className="text-xs text-primary underline hover:no-underline font-medium ml-4 shrink-0">
          {t('tier.upgradeCta')}
        </Link>
      </div>
    );
  }

  return null;
}
