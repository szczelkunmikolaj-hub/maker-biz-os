import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import {
  TierName, ProFeature,
  getEffectiveTier, getTrialDaysLeft,
  hasProAccess, canUseFeature, canAddProject,
} from '@/lib/tiers';

interface TierContextType {
  tier: TierName;
  effectiveTier: TierName;
  trialStartedAt: string | null;
  trialDaysLeft: number;
  isTrialActive: boolean;
  trialExpired: boolean;
  isPro: boolean;
  canUseFeature: (feature: ProFeature) => boolean;
  canAddProject: (currentCount: number) => boolean;
  loading: boolean;
}

const TierContext = createContext<TierContextType>({
  tier: 'pro_trial',
  effectiveTier: 'pro_trial',
  trialStartedAt: null,
  trialDaysLeft: 30,
  isTrialActive: true,
  trialExpired: false,
  isPro: true,
  canUseFeature: () => true,
  canAddProject: () => true,
  loading: false,
});

export function TierProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [tier, setTier] = useState<TierName>('pro_trial');
  const [trialStartedAt, setTrialStartedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setTier('pro_trial');
      setTrialStartedAt(new Date().toISOString());
      setLoading(false);
      return;
    }
    supabase
      .from('profiles')
      .select('tier, trial_started_at')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setTier((data.tier as TierName) ?? 'pro_trial');
          setTrialStartedAt((data as any).trial_started_at ?? null);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user, authLoading]);

  const effectiveTier = getEffectiveTier(tier, trialStartedAt);
  const trialDaysLeft = tier === 'pro_trial' ? getTrialDaysLeft(trialStartedAt) : 0;
  const isTrialActive = tier === 'pro_trial' && trialDaysLeft > 0;
  const trialExpired = tier === 'pro_trial' && trialDaysLeft === 0;
  const isPro = hasProAccess(effectiveTier);

  return (
    <TierContext.Provider value={{
      tier,
      effectiveTier,
      trialStartedAt,
      trialDaysLeft,
      isTrialActive,
      trialExpired,
      isPro,
      canUseFeature: (f: ProFeature) => canUseFeature(effectiveTier, f),
      canAddProject: (count: number) => canAddProject(effectiveTier, count),
      loading,
    }}>
      {children}
    </TierContext.Provider>
  );
}

export const useTier = () => useContext(TierContext);
