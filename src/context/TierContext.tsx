import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { isAdmin } from '@/lib/admin';
import {
  TierName, ProFeature,
  getEffectiveTier, getTrialDaysLeft,
  hasProAccess, canUseFeature, canAddProject,
} from '@/lib/tiers';

const PREVIEW_KEY = 'pt_admin_preview_free';

interface TierContextType {
  tier: TierName;
  effectiveTier: TierName;
  trialStartedAt: string | null;
  trialDaysLeft: number;
  isTrialActive: boolean;
  trialExpired: boolean;
  isPro: boolean;
  isAdmin: boolean;
  adminPreviewFree: boolean;
  setAdminPreviewFree: (v: boolean) => void;
  canUseFeature: (feature: ProFeature) => boolean;
  canAddProject: (currentCount: number) => boolean;
  loading: boolean;
}

const TierContext = createContext<TierContextType>({
  tier: 'free',
  effectiveTier: 'free',
  trialStartedAt: null,
  trialDaysLeft: 0,
  isTrialActive: false,
  trialExpired: false,
  isPro: false,
  isAdmin: false,
  adminPreviewFree: false,
  setAdminPreviewFree: () => {},
  canUseFeature: () => false,
  canAddProject: () => true,
  loading: false,
});

export function TierProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [tier, setTier] = useState<TierName>('free');
  const [trialStartedAt, setTrialStartedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminPreviewFree, setAdminPreviewFreeState] = useState(
    () => localStorage.getItem(PREVIEW_KEY) === 'true'
  );

  const setAdminPreviewFree = (v: boolean) => {
    localStorage.setItem(PREVIEW_KEY, v ? 'true' : 'false');
    setAdminPreviewFreeState(v);
  };

  const isAdminUser = isAdmin(user?.email);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setTier('free');
      setTrialStartedAt(null);
      setLoading(false);
      return;
    }
    supabase
      .from('profiles')
      .select('tier, trial_started_at')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setTier((data.tier as TierName) ?? 'free');
          setTrialStartedAt((data as any).trial_started_at ?? null);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user, authLoading]);

  // Admin email always gets Business tier — unless they're previewing Free
  const baseTier: TierName = isAdminUser ? 'business' : tier;
  const baseTrialStartedAt = isAdminUser ? null : trialStartedAt;

  // PAYMENTS_TODO: restore gating logic below when payments are ready.
  // const effectiveTier: TierName = adminPreviewFree && isAdminUser
  //   ? 'free'
  //   : getEffectiveTier(baseTier, baseTrialStartedAt);
  // const trialDaysLeft = baseTier === 'pro_trial' ? getTrialDaysLeft(baseTrialStartedAt) : 0;
  // const isTrialActive = baseTier === 'pro_trial' && trialDaysLeft > 0;
  // const trialExpired = baseTier === 'pro_trial' && trialDaysLeft === 0;
  // const isPro = hasProAccess(effectiveTier);

  // Temporarily give everyone full Pro access — all features free until payments are ready.
  const effectiveTier: TierName = 'pro';
  const trialDaysLeft = 0;
  const isTrialActive = false;
  const trialExpired = false;
  const isPro = true;

  return (
    <TierContext.Provider value={{
      tier: baseTier,
      effectiveTier,
      trialStartedAt: baseTrialStartedAt,
      trialDaysLeft,
      isTrialActive,
      trialExpired,
      isPro,
      isAdmin: isAdminUser,
      adminPreviewFree,
      setAdminPreviewFree,
      canUseFeature: () => true,
      canAddProject: () => true,
      loading,
    }}>
      {children}
    </TierContext.Provider>
  );
}

export const useTier = () => useContext(TierContext);
