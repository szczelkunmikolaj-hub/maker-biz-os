export type TierName = 'free' | 'pro_trial' | 'pro' | 'business';
export type ProFeature =
  | 'pdf_invoice'
  | 'excel_csv_import'
  | 'data_export'
  | 'templates'
  | 'advanced_dashboard'
  | 'stl_viewer'
  | 'production_summary'
  | 'recurring_orders';

export const FREE_PROJECT_LIMIT = 8;
export const TRIAL_DAYS = 30;

export const PRO_FEATURES: ProFeature[] = [
  'pdf_invoice',
  'excel_csv_import',
  'data_export',
  'templates',
  'advanced_dashboard',
  'stl_viewer',
  'production_summary',
  'recurring_orders',
];

export interface TierConfig {
  monthlyPrice: number;
  currency: string;
  maxProjects: number | null;
  hasProFeatures: boolean;
  hasTeamFeatures: boolean;
}

export const TIER_CONFIG: Record<TierName, TierConfig> = {
  free: { monthlyPrice: 0, currency: 'EUR', maxProjects: FREE_PROJECT_LIMIT, hasProFeatures: false, hasTeamFeatures: false },
  pro_trial: { monthlyPrice: 0, currency: 'EUR', maxProjects: null, hasProFeatures: true, hasTeamFeatures: false },
  pro: { monthlyPrice: 6.99, currency: 'EUR', maxProjects: null, hasProFeatures: true, hasTeamFeatures: false },
  business: { monthlyPrice: 14.99, currency: 'EUR', maxProjects: null, hasProFeatures: true, hasTeamFeatures: true },
};

export function getEffectiveTier(tier: TierName, trialStartedAt: string | null): TierName {
  if (tier !== 'pro_trial') return tier;
  if (!trialStartedAt) return 'free';
  const daysSince = (Date.now() - new Date(trialStartedAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince < TRIAL_DAYS ? 'pro_trial' : 'free';
}

export function getTrialDaysLeft(trialStartedAt: string | null): number {
  if (!trialStartedAt) return 0;
  const daysSince = (Date.now() - new Date(trialStartedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(TRIAL_DAYS - daysSince));
}

export function hasProAccess(effectiveTier: TierName): boolean {
  return effectiveTier === 'pro_trial' || effectiveTier === 'pro' || effectiveTier === 'business';
}

export function canUseFeature(_effectiveTier: TierName, _feature: ProFeature): boolean {
  return hasProAccess(_effectiveTier);
}

export function canAddProject(effectiveTier: TierName, currentCount: number): boolean {
  if (hasProAccess(effectiveTier)) return true;
  return currentCount < FREE_PROJECT_LIMIT;
}
