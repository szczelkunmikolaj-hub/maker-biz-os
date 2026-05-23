import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Box, Clock, TrendingUp, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';

const LANGUAGES = [
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'pl', flag: '🇵🇱', label: 'Polski' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'pt', flag: '🇧🇷', label: 'Português' },
];

export default function Landing() {
  const { t } = useTranslation();

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('pt_language', lang);
  };

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  const features = [
    { icon: Box, title: t('landing.feature1Title'), desc: t('landing.feature1Desc') },
    { icon: Clock, title: t('landing.feature2Title'), desc: t('landing.feature2Desc') },
    { icon: TrendingUp, title: t('landing.feature3Title'), desc: t('landing.feature3Desc') },
  ];

  const mockupStats = [
    { l: t('landing.mockupRevenue'), v: '€2,340' },
    { l: t('landing.mockupProfit'), v: '€1,612' },
    { l: t('landing.mockupActivePrints'), v: '7' },
    { l: t('landing.mockupFilamentLeft'), v: '1.2 kg' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b bg-card/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm" style={{ fontFamily: 'Space Grotesk' }}>PT</span>
            </div>
            <span className="font-bold" style={{ fontFamily: 'Space Grotesk' }}>Maker Biz OS</span>
          </Link>
          <div className="flex items-center gap-2">
            <Select value={i18n.language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="h-8 w-auto gap-1 border-0 bg-transparent px-2 text-sm">
                <SelectValue>
                  <span>{currentLang.flag} {currentLang.label}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(l => (
                  <SelectItem key={l.code} value={l.code}>{l.flag} {l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" asChild><Link to="/auth?mode=signin">{t('auth.logIn')}</Link></Button>
            <Button asChild><Link to="/auth?mode=signup">{t('auth.signUp')}</Link></Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground mb-6">
          <Sparkles className="h-3 w-3" /> {t('landing.badge')}
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          {t('landing.heroTitle')}
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto">
          {t('landing.heroSub')}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" asChild><Link to="/auth?mode=signup">{t('landing.cta1')}</Link></Button>
          <Button size="lg" variant="outline" asChild><Link to="/auth?mode=signin">{t('landing.cta2')}</Link></Button>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-4">
        {features.map(b => (
          <div key={b.title} className="rounded-xl border bg-card p-6 hover:border-primary/40 transition-colors">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3"><b.icon className="h-5 w-5" /></div>
            <h3 className="font-semibold mb-1" style={{ fontFamily: 'Space Grotesk' }}>{b.title}</h3>
            <p className="text-sm text-muted-foreground">{b.desc}</p>
          </div>
        ))}
      </section>

      {/* Mockup */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="rounded-2xl border bg-gradient-to-br from-card to-background p-2 shadow-2xl">
          <div className="rounded-xl bg-background border overflow-hidden">
            <div className="flex items-center gap-1.5 border-b px-3 py-2">
              <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
              <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
              <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
              <span className="ml-2 text-xs text-muted-foreground">{t('landing.mockupDashboard')}</span>
            </div>
            <div className="p-6 grid md:grid-cols-4 gap-3">
              {mockupStats.map(k => (
                <div key={k.l} className="rounded-lg border p-4">
                  <div className="text-xs text-muted-foreground">{k.l}</div>
                  <div className="text-2xl font-bold mt-1" style={{ fontFamily: 'Space Grotesk' }}>{k.v}</div>
                </div>
              ))}
              <div className="md:col-span-4 rounded-lg border p-4 h-32 flex items-end gap-1.5">
                {[40, 60, 35, 80, 55, 95, 70, 88, 50, 72, 90, 65].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t bg-primary/70" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>{t('landing.ctaTitle')}</h2>
        <p className="text-muted-foreground mt-3">{t('landing.ctaSub')}</p>
        <Button size="lg" className="mt-6" asChild><Link to="/auth?mode=signup">{t('landing.ctaButton')}</Link></Button>
      </section>

      <footer className="border-t mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          {t('landing.footer')}
        </div>
      </footer>
    </div>
  );
}
