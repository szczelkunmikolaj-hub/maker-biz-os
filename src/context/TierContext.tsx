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
          const loadedTier = (data.tier as TierName) ?? 'free';
          const loadedTrialAt = (data as any).trial_started_at ?? null;
          setTier(loadedTier);
          setTrialStartedAt(loadedTrialAt);

          // Apply pending trial opt-in from signup welcome screen
          if (loadedTier === 'free' && localStorage.getItem('pt_pending_trial') === 'true') {
            localStorage.removeItem('pt_pending_trial');
            const now = new Date().toISOString();
            supabase
              .from('profiles')
              .update({ tier: 'pro_trial', trial_started_at: now })
              .eq('id', user.id)
              .then(({ error }) => {
                if (!error) {
                  setTier('pro_trial');
                  setTrialStartedAt(now);
                }
              });
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user, authLoading]);

  // Admin email always gets Business tier — unless they're previewing Free
  const baseTier: TierName = isAdminUser ? 'business' : tier;
  const baseTrialStartedAt = isAdminUser ? null : trialStartedAt;

  const effectiveTier: TierName = adminPreviewFree && isAdminUser
    ? 'free'
    : getEffectiveTier(baseTier, baseTrialStartedAt);

  const trialDaysLeft = baseTier === 'pro_trial' ? getTrialDaysLeft(baseTrialStartedAt) : 0;
  const isTrialActive = baseTier === 'pro_trial' && trialDaysLeft > 0;
  const trialExpired = baseTier === 'pro_trial' && trialDaysLeft === 0;
  const isPro = hasProAccess(effectiveTier);

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
      canUseFeature: (f: ProFeature) => canUseFeature(effectiveTier, f),
      canAddProject: (count: number) => canAddProject(effectiveTier, count),
      loading,
    }}>
      {children}
    </TierContext.Provider>
  );
}

export const useTier = () => useContext(TierContext);
