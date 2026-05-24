import { Link } from 'react-router-dom';
import { Shield, Database, User, Code2, Mail, Globe, Lock } from 'lucide-react';

// TODO: replace with real repo URL once public
const GITHUB_URL = 'https://github.com/mikolajszczelkun/printrack';

// Email stored as char codes to avoid plain-text scraping
const rc = (n: number[]) => n.map(c => String.fromCharCode(c)).join('');

function ContactEmail() {
  const addr = rc([115,122,99,122,101,108,107,117,110,109,105,107,111,108,97,106,64,103,109,97,105,108,46,99,111,109]);
  return (
    <a
      href={`mailto:${addr}`}
      className="font-medium text-primary underline underline-offset-4 hover:no-underline"
      onClick={e => { (e.currentTarget as HTMLAnchorElement).href = `mailto:${addr}`; }}
    >
      {addr.replace('@', ' [at] ')}
    </a>
  );
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function Section({ icon, title, children }: SectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {icon}
        </div>
        <h2 className="text-lg font-bold" style={{ fontFamily: 'Space Grotesk' }}>{title}</h2>
      </div>
      <div className="pl-12 space-y-2 text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function TrustPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b bg-card/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm" style={{ fontFamily: 'Space Grotesk' }}>PT</span>
            </div>
            <span className="font-bold" style={{ fontFamily: 'Space Grotesk' }}>PrintTrack</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-16 space-y-12">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
            Trust &amp; Privacy
          </h1>
          <p className="text-muted-foreground text-lg">
            No legal jargon. Just a straightforward explanation of who built this, what we collect, and how we handle your data.
          </p>
          <p className="text-xs text-muted-foreground/60">Last updated: May 2025</p>
        </div>

        <div className="border-t" />

        {/* Who built this */}
        <Section icon={<User className="h-5 w-5" />} title="Who built this">
          <p>
            PrintTrack is a solo side-project built by Mikołaj Szczelkun — a maker based in <strong className="text-foreground">Barcelona, Spain</strong> who runs his own 3D printing business. I built this because I needed it myself: a simple, no-nonsense tool to track filament costs, project margins, and print hours.
          </p>
          <p>
            There is no company, no VC funding, and no team of engineers. It's just me. That means your feedback goes directly to the person who wrote the code, and decisions about your data are made by a single person with a clear interest in keeping this trustworthy.
          </p>
        </Section>

        {/* What data we collect */}
        <Section icon={<Database className="h-5 w-5" />} title="What data we collect">
          <p>We collect only what the app needs to function:</p>
          <ul className="space-y-1.5 mt-2">
            {[
              'Project names, prices, statuses, and notes you enter',
              'Print hours, material weights, and filament costs per order',
              'Expense records and categories you create',
              'Your email address (for your account)',
              'App preferences like language and display settings',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-primary mt-1 shrink-0">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-medium text-foreground">We do not collect:</p>
          <ul className="space-y-1.5 mt-2">
            {[
              'STL files or any 3D model files — they are processed entirely in your browser and never uploaded',
              'Payment information of any kind — there is no payment processor integrated',
              'Analytics or tracking cookies beyond basic session management',
              'Any data from your device, camera, microphone, or contacts',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-red-500/70 mt-1 shrink-0">✕</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Where your data lives */}
        <Section icon={<Globe className="h-5 w-5" />} title="Where your data lives">
          <p>
            All data is stored on <strong className="text-foreground">Supabase</strong>, hosted on servers in the <strong className="text-foreground">European Union</strong> (AWS eu-west-1, Frankfurt). Supabase is SOC 2 Type II certified and GDPR-compliant.
          </p>
          <p>
            <strong className="text-foreground">You own your data.</strong> You can export everything at any time from the Data Management page — projects, expenses, filament records — as a CSV file. If you delete your account, all your data is permanently removed from our servers within 30 days.
          </p>
          <p>
            Guest mode data is stored only in your browser's local storage and never touches any server. It disappears if you clear your browser data.
          </p>
        </Section>

        {/* We never sell your data */}
        <Section icon={<Shield className="h-5 w-5" />} title="We never sell your data">
          <p>
            <strong className="text-foreground">Your data is never sold, shared with advertisers, or used to train AI models.</strong> Full stop.
          </p>
          <p>
            The only third-party service that touches your data is Supabase (database and authentication). No analytics platforms, no advertising networks, no data brokers.
          </p>
          <p>
            In the future, if a paid plan is introduced, it will be a simple subscription — the business model is charging for the software, not monetising your data.
          </p>
        </Section>

        {/* GDPR */}
        <Section icon={<Lock className="h-5 w-5" />} title="GDPR compliance">
          <p>
            PrintTrack is operated from the EU and is designed to comply with the General Data Protection Regulation (GDPR). As a user you have the right to:
          </p>
          <ul className="space-y-1.5 mt-2">
            {[
              'Access a copy of all data we hold about you',
              'Correct any inaccurate data',
              'Request deletion of your account and all associated data',
              'Export your data in a portable format (CSV) at any time',
              'Withdraw consent at any time by deleting your account',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-primary mt-1 shrink-0">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3">
            To exercise any of these rights, email us using the contact below. We will respond within 30 days.
          </p>
        </Section>

        {/* Open source */}
        <Section icon={<Code2 className="h-5 w-5" />} title="Open source">
          <p>
            PrintTrack is open source. You can inspect every line of code, verify exactly what data is collected, and run your own instance if you prefer.
          </p>
          <p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-4 hover:no-underline"
            >
              View the source code on GitHub →
            </a>
          </p>
        </Section>

        {/* Contact */}
        <Section icon={<Mail className="h-5 w-5" />} title="Contact">
          <p>
            Questions about privacy, data deletion requests, or anything else — email me directly:
          </p>
          <p className="mt-2">
            <ContactEmail />
          </p>
          <p className="mt-2">
            I read every email and reply personally. No support ticket systems, no bots.
          </p>
        </Section>

        <div className="border-t pt-8 text-xs text-muted-foreground/60 text-center space-y-1">
          <p>PrintTrack · Barcelona, Spain · EU-hosted data</p>
          <p>Built by a maker, for makers.</p>
        </div>
      </main>
    </div>
  );
}
