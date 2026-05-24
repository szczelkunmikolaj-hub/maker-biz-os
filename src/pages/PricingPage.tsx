import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, Building2, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';

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
  'tier.proFeat1',
  'tier.proFeat2',
  'tier.proFeat3',
  'tier.bizFeat1',
  'tier.bizFeat2',
  'tier.bizFeat3',
];

function WaitlistForm({ tier }: { tier: 'pro' | 'business' }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
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
      <div className="flex items-center gap-2 text-green-600 text-sm font-medium justify-center py-3 rounded-lg bg-green-50 dark:bg-green-950/30">
        <Check className="h-4 w-4" /> {t('tier.pricingWaitlistSuccess')}
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
      />
      <Button onClick={handleJoin} disabled={saving || !email.trim()} className="w-full gap-2">
        {t('tier.pricingUpgradeComingSoon')}
        <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="text-xs text-muted-foreground text-center">{t('tier.pricingWaitlistDesc')}</p>
    </div>
  );
}

export default function PricingPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b bg-card/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm" style={{ fontFamily: 'Space Grotesk' }}>PT</span>
            </div>
            <span className="font-bold" style={{ fontFamily: 'Space Grotesk' }}>PrintTrack</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth?mode=signin">{t('auth.logIn')}</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/auth?mode=signup">{t('auth.signUp')}</Link>
            </Button>
          </div>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-4 pt-16 pb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          {t('tier.pricingTitle')}
        </h1>
        <p className="text-lg text-muted-foreground mt-4">{t('tier.pricingSubtitle')}</p>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-16 grid md:grid-cols-3 gap-6">
        {/* Free */}
        <div className="rounded-2xl border bg-card p-6 flex flex-col gap-4">
          <div>
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center font-bold text-sm mb-3">F</div>
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>{t('tier.tierFree')}</h2>
            <div className="text-3xl font-bold mt-1" style={{ fontFamily: 'Space Grotesk' }}>
              €0 <span className="text-base font-normal text-muted-foreground">{t('tier.pricingPerMonth')}</span>
            </div>
          </div>
          <ul className="space-y-2 flex-1">
            {FREE_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                {t(f)}
              </li>
            ))}
          </ul>
          <Button variant="outline" asChild className="mt-auto">
            <Link to="/auth?mode=signup">{t('tier.pricingStartFree')}</Link>
          </Button>
        </div>

        {/* Pro */}
        <div className="rounded-2xl border-2 border-primary bg-card p-6 flex flex-col gap-4 relative shadow-lg">
          <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs">{t('tier.mostPopular')}</Badge>
          <div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>{t('tier.tierPro')}</h2>
            <div className="text-3xl font-bold mt-1" style={{ fontFamily: 'Space Grotesk' }}>
              €6.99 <span className="text-base font-normal text-muted-foreground">{t('tier.pricingPerMonth')}</span>
            </div>
          </div>
          <ul className="space-y-2 flex-1">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                {t(f)}
              </li>
            ))}
          </ul>
          <WaitlistForm tier="pro" />
        </div>

        {/* Business */}
        <div className="rounded-2xl border bg-card p-6 flex flex-col gap-4">
          <div>
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>{t('tier.tierBusiness')}</h2>
            <div className="text-3xl font-bold mt-1" style={{ fontFamily: 'Space Grotesk' }}>
              €14.99 <span className="text-base font-normal text-muted-foreground">{t('tier.pricingPerMonth')}</span>
            </div>
          </div>
          <ul className="space-y-2 flex-1">
            {BUSINESS_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                {t(f)}
              </li>
            ))}
          </ul>
          <WaitlistForm tier="business" />
        </div>
      </section>

      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>{t('landing.footer')}</span>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-foreground transition-colors">{t('nav.dashboard')}</Link>
            <Link to="/pricing" className="hover:text-foreground transition-colors">{t('tier.pricingNav')}</Link>
            <Link to="/auth?mode=signup" className="hover:text-foreground transition-colors">{t('auth.signUp')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
