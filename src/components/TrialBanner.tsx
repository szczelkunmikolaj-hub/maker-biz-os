import { Link } from 'react-router-dom';
import { useTier } from '@/context/TierContext';
import { useDemo } from '@/context/DemoContext';
import { useTranslation } from 'react-i18next';

export function TrialBanner() {
  const { tier, isTrialActive, trialExpired, trialDaysLeft } = useTier();
  const { isDemoMode } = useDemo();
  const { t } = useTranslation();

  if (isDemoMode) return null;
  if (localStorage.getItem('pt_guest_mode') === 'true') return null;
  if (tier === 'pro' || tier === 'business') return null;
  if (tier !== 'pro_trial') return null;

  if (isTrialActive) {
    return (
      <div className="bg-primary/10 border-b border-primary/25 px-4 py-2 flex items-center justify-between shrink-0">
        <span className="text-sm font-medium text-primary">
          {t('tier.trialActiveBanner', { days: trialDaysLeft })}
        </span>
        <Link to="/pricing" className="text-xs text-primary underline hover:no-underline font-medium">
          {t('tier.upgradeCta')}
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
        <Link to="/pricing" className="text-xs text-orange-700 dark:text-orange-400 underline hover:no-underline font-medium">
          {t('tier.upgradeCta')}
        </Link>
      </div>
    );
  }

  return null;
}
