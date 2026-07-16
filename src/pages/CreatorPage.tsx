import { Link } from 'react-router-dom';

export default function CreatorPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
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
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>Built by Mikołaj Szczełkun</h1>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            PrintTrack was designed and built from scratch by Mikołaj Szczełkun (Nico),
            an independent developer based in Barcelona.
          </p>
          <p>
            It's one of several digital products he's built solo — spanning 3D printing
            business tools, SaaS platforms, and local service products.
          </p>
          <p>
            See more of his work at{' '}
            <a
              href="https://nico-portfolio-gold.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-4 hover:no-underline"
            >
              nico-portfolio-gold.vercel.app
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
