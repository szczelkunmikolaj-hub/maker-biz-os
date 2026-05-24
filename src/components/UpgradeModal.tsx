import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check, Lock, Zap, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import type { ProFeature } from '@/lib/tiers';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature?: ProFeature;
}

const FREE_FEATURES = [
  'tier.freeFeat1',
  'tier.freeFeat2',
  'tier.freeFeat3',
  'tier.freeFeat4',
  'tier.freeFeat5',
  'tier.freeFeat6',
];

const PRO_FEATURES = [
  'tier.proFeat1',
  'tier.proFeat2',
  'tier.proFeat3',
  'tier.proFeat4',
  'tier.proFeat5',
  'tier.proFeat6',
  'tier.proFeat7',
  'tier.proFeat8',
  'tier.proFeat9',
];

const BUSINESS_FEATURES = [
  'tier.bizFeat1',
  'tier.bizFeat2',
  'tier.bizFeat3',
];

function WaitlistButton({ tier }: { tier: 'pro' | 'business' }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? '');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleJoin = async () => {
    if (!email.trim()) return;
    setSaving(true);
    await supabase.from('waitlist').insert({ email: email.trim(), tier });
    setSaving(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 text-green-600 text-sm font-medium justify-center py-2">
        <Check className="h-4 w-4" /> {t('tier.waitlistSuccess')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        type="email"
        placeholder={t('tier.waitlistEmailPlaceholder')}
        value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleJoin()}
        className="text-sm"
      />
      <Button onClick={handleJoin} disabled={saving || !email.trim()} className="w-full">
        {t('tier.upgradeModalWaitlistCta')}
      </Button>
      <p className="text-xs text-muted-foreground text-center">{t('tier.upgradeModalWaitlistNote')}</p>
    </div>
  );
}

function TierCard({
  title,
  price,
  features,
  highlighted,
  icon,
  waitlistTier,
  isFree,
}: {
  title: string;
  price: string;
  features: string[];
  highlighted?: boolean;
  icon: React.ReactNode;
  waitlistTier?: 'pro' | 'business';
  isFree?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 ${highlighted ? 'border-primary ring-1 ring-primary' : ''}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-semibold">{title}</span>
        {highlighted && <Badge className="ml-auto text-[10px] py-0">{t('tier.mostPopular')}</Badge>}
      </div>
      <div className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>{price}</div>
      <ul className="space-y-1.5 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
            {t(f)}
          </li>
        ))}
      </ul>
      {isFree ? (
        <Button variant="outline" size="sm" asChild>
          <Link to="/auth?mode=signup">{t('tier.startFree')}</Link>
        </Button>
      ) : waitlistTier ? (
        <WaitlistButton tier={waitlistTier} />
      ) : null}
    </div>
  );
}

export function UpgradeModal({ open, onClose, feature }: UpgradeModalProps) {
  const { t } = useTranslation();

  const featureDescKey = feature ? `tier.feature${feature.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join('')}Desc` : null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Lock className="h-5 w-5 text-muted-foreground" />
            {t('tier.upgradeModalTitle')}
          </DialogTitle>
        </DialogHeader>

        {featureDescKey && (
          <p className="text-sm text-muted-foreground -mt-2">{t(featureDescKey)}</p>
        )}

        <div className="grid grid-cols-3 gap-3 mt-1">
          <TierCard
            title={t('tier.tierFree')}
            price="€0/mo"
            features={FREE_FEATURES}
            icon={<div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-xs font-bold">F</div>}
            isFree
          />
          <TierCard
            title={t('tier.tierPro')}
            price="€6.99/mo"
            features={PRO_FEATURES}
            highlighted
            icon={<Zap className="h-5 w-5 text-primary" />}
            waitlistTier="pro"
          />
          <TierCard
            title={t('tier.tierBusiness')}
            price="€14.99/mo"
            features={[...PRO_FEATURES.slice(0, 3), ...BUSINESS_FEATURES]}
            icon={<Building2 className="h-5 w-5 text-muted-foreground" />}
            waitlistTier="business"
          />
        </div>

        <div className="flex justify-center mt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('tier.upgradeModalMaybeLater')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectLimitModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            {t('tier.projectLimitTitle')}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('tier.projectLimitDesc')}</p>
        <div className="space-y-2 mt-2">
          <WaitlistButton tier="pro" />
        </div>
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={onClose}>{t('tier.upgradeModalMaybeLater')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
