import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Box, Clock, TrendingUp, Sparkles } from 'lucide-react';

export default function Landing() {
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
          <div className="flex gap-2">
            <Button variant="ghost" asChild><Link to="/auth?mode=signin">Log in</Link></Button>
            <Button asChild><Link to="/auth?mode=signup">Sign up</Link></Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground mb-6">
          <Sparkles className="h-3 w-3" /> Free for makers, built by a maker
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
          Run your 3D printing business like a pro
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto">
          Track projects, print hours, filament costs and profit — all in one free tool built by a maker, for makers.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" asChild><Link to="/auth?mode=signup">Start free — no credit card needed</Link></Button>
          <Button size="lg" variant="outline" asChild><Link to="/auth?mode=signin">I already have an account</Link></Button>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-4">
        {[
          { icon: Box, title: 'Every project, organized', desc: 'Import .3mf plates, track prints, models, materials and colors visually.' },
          { icon: Clock, title: 'Kanban + calendar in sync', desc: 'See what to print today, what is shipping tomorrow, what is overdue.' },
          { icon: TrendingUp, title: 'Know your profit', desc: 'Auto-track filament costs, expenses and revenue. See real margins per project.' },
        ].map(b => (
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
              <span className="ml-2 text-xs text-muted-foreground">dashboard</span>
            </div>
            <div className="p-6 grid md:grid-cols-4 gap-3">
              {[
                { l: 'Revenue', v: '€2,340' }, { l: 'Profit', v: '€1,612' },
                { l: 'Active prints', v: '7' }, { l: 'Filament left', v: '1.2 kg' },
              ].map(k => (
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
        <h2 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>Ready to take your print farm seriously?</h2>
        <p className="text-muted-foreground mt-3">Free forever. Your data stays yours.</p>
        <Button size="lg" className="mt-6" asChild><Link to="/auth?mode=signup">Start free</Link></Button>
      </section>

      <footer className="border-t mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          Made by a maker, for makers.
        </div>
      </footer>
    </div>
  );
}
