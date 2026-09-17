import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Columns3, TrendingUp, Globe, Calculator, Package, Calendar,
  CheckCircle2, ArrowRight, Zap, BarChart3, FlaskConical,
} from "lucide-react";

// ── Pricing constants — change these without touching the JSX ─────────────
const FREE_LIMIT_PROJECTS = 10;
const PRO_MONTHLY_PRICE = 17;
const PRO_ANNUAL_PRICE = 14; // per month, billed annually (saves ~18%)
const PRO_ANNUAL_TOTAL = PRO_ANNUAL_PRICE * 12;

const FREE_FEATURES = [
  `Up to ${FREE_LIMIT_PROJECTS} active projects`,
  "Kanban order pipeline",
  "Quote calculator with margin targets",
  "Filament & material inventory",
  "Customer order-tracking links",
  "Basic analytics dashboard",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Unlimited active projects",
  "Advanced analytics & exports",
  "Customer management database",
  "Calendar & deadline scheduling",
  "Priority support",
];
// ─────────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Columns3,
    title: "Kanban order pipeline",
    desc: "Move jobs through New → Printing → Finished → Paid → Shipped. Every order's status at a glance.",
  },
  {
    icon: TrendingUp,
    title: "Real margin tracking",
    desc: "See actual profit per job — not just revenue. Material cost, expenses, and margin calculated automatically.",
  },
  {
    icon: Globe,
    title: "Customer tracking links",
    desc: "Share a public order-status link with customers. They check their own order without logging in.",
  },
  {
    icon: Calculator,
    title: "Instant quote calculator",
    desc: "Enter grams, hours, and target margin. Get a suggested price based on your real costs in seconds.",
  },
  {
    icon: Package,
    title: "Filament inventory",
    desc: "Log every spool purchase. Track cost-per-gram across materials and see spend over time.",
  },
  {
    icon: Calendar,
    title: "Calendar & scheduling",
    desc: "Visualise due dates, spot bottlenecks, and avoid double-booking your printers.",
  },
];

function enterDemo() {
  localStorage.setItem("pt_demo_mode", "true");
  localStorage.setItem("pt_guest_mode", "true");
  localStorage.setItem("pt_welcome_dismissed", "true");
  window.location.href = "/";
}

export default function LandingPage() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>PT</span>
            </div>
            <span className="font-bold text-lg text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>PrintTrack</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              to="/auth?mode=signin"
              className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-zinc-800"
            >
              Sign in
            </Link>
            <Link
              to="/auth?mode=signup"
              className="text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Subtle grid texture */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 md:pt-28 md:pb-32 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 rounded-full px-3.5 py-1.5 text-xs font-medium text-blue-400 mb-8">
            <Zap className="h-3.5 w-3.5" />
            Built for 3D print shop owners, not hobbyists
          </div>

          {/*
            Headline options considered:
            A. "Run your 3D print shop like a real business." — direct, confrontational in a good way
            B. "Every order. Every margin. Every deadline." — punchy, specific
            C. "The business layer your 3D print shop has been missing." — creates FOMO
            → Using A as primary
          */}
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight leading-tight max-w-3xl mx-auto"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Run your 3D print shop{" "}
            <span className="text-blue-400">like a real business.</span>
          </h1>

          <p className="mt-6 text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed">
            PrintTrack gives small print shops a complete operations dashboard — Kanban
            pipeline, real profit margins, customer order tracking, and instant quoting.
            No spreadsheets.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={enterDemo}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-7 py-3.5 rounded-xl text-base transition-colors shadow-lg shadow-blue-600/25"
            >
              <FlaskConical className="h-4 w-4" />
              View Live Demo
            </button>
            <Link
              to="/auth?mode=signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-zinc-600 hover:border-zinc-400 text-zinc-200 hover:text-white font-semibold px-7 py-3.5 rounded-xl text-base transition-colors"
            >
              Sign Up Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <p className="mt-4 text-xs text-zinc-500">
            No credit card needed &nbsp;·&nbsp; Up to {FREE_LIMIT_PROJECTS} projects free &nbsp;·&nbsp; Live demo takes 10 seconds
          </p>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="bg-zinc-900 border-y border-zinc-800 py-20 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2
              className="text-3xl md:text-4xl font-bold text-white"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Everything your shop needs
            </h2>
            <p className="mt-3 text-zinc-400 max-w-md mx-auto">
              Built around how a real print shop actually operates — not a generic project manager with a 3D-printing skin.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="rounded-2xl border border-zinc-700/60 bg-zinc-800/50 p-6 space-y-3 hover:border-blue-500/30 hover:bg-zinc-800 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <f.icon className="h-5 w-5 text-blue-400" />
                </div>
                <h3 className="font-semibold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {f.title}
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof / credibility ────────────────────────────────────── */}
      <section className="bg-zinc-950 py-20 md:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-6">
            <BarChart3 className="h-6 w-6 text-blue-400" />
          </div>
          <h2
            className="text-3xl md:text-4xl font-bold text-white"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Built by an actual print shop owner
          </h2>
          <p className="mt-4 text-zinc-400 text-lg leading-relaxed max-w-xl mx-auto">
            PrintTrack exists because spreadsheets and generic tools don't cut it when
            you're managing dozens of custom orders a month. Every feature came from a real
            problem.
          </p>

          {/* ── TESTIMONIAL PLACEHOLDER ─────────────────────────────────────
               Replace this block with a real quote from a user or your own business.
               Example format:
               <blockquote>
                 "Before PrintTrack I had no idea which jobs were profitable..."
                 — [Business name / first name]
               </blockquote>
          ──────────────────────────────────────────────────────────────── */}
          <div className="mt-10 rounded-2xl border border-zinc-700 bg-zinc-900 p-8 text-left">
            <p className="text-zinc-300 text-lg leading-relaxed italic">
              "Since switching to PrintTrack I always know which orders are profitable
              and nothing falls through the cracks. The customer tracking links alone
              save me 20 messages a week."
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">
                {/* TODO: replace with real avatar or initials */}
                MP
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {/* TODO: replace with real name/business */}
                  Print shop owner
                </p>
                <p className="text-xs text-zinc-500">
                  {/* TODO: add location or business name */}
                  Running a print shop since 2021
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <section className="bg-zinc-900 border-y border-zinc-800 py-20 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2
              className="text-3xl md:text-4xl font-bold text-white"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Simple, honest pricing
            </h2>
            <p className="mt-3 text-zinc-400">Start free. Upgrade when you're ready.</p>

            {/* Monthly / Annual toggle */}
            <div className="mt-6 inline-flex items-center bg-zinc-800 border border-zinc-700 rounded-xl p-1 gap-1">
              <button
                onClick={() => setAnnual(false)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${!annual ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${annual ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
              >
                Annual
                <span className="text-xs font-semibold text-blue-400">save 18%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free tier */}
            <div className="rounded-2xl border border-zinc-700 bg-zinc-800/60 p-8 flex flex-col">
              <div>
                <p className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Free</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>$0</span>
                  <span className="text-zinc-400 text-sm">/ month</span>
                </div>
                <p className="mt-2 text-sm text-zinc-400">Perfect for getting started.</p>
              </div>
              <ul className="mt-6 space-y-3 flex-1">
                {FREE_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <CheckCircle2 className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth?mode=signup"
                className="mt-8 block text-center border border-zinc-600 hover:border-zinc-400 text-zinc-200 hover:text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
              >
                Start for free
              </Link>
            </div>

            {/* Pro tier */}
            <div className="rounded-2xl border-2 border-blue-500/50 bg-zinc-800/60 p-8 flex flex-col relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <span className="text-xs font-semibold bg-blue-600 text-white px-2.5 py-1 rounded-full">
                  Most popular
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-400 uppercase tracking-wide">Pro</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    ${annual ? PRO_ANNUAL_PRICE : PRO_MONTHLY_PRICE}
                  </span>
                  <span className="text-zinc-400 text-sm">/ month</span>
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                  {annual
                    ? `$${PRO_ANNUAL_TOTAL} billed annually`
                    : `Billed monthly — switch to annual and save`}
                </p>
              </div>
              <ul className="mt-6 space-y-3 flex-1">
                {PRO_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth?mode=signup"
                className="mt-8 block text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
              >
                Get started — free trial included
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section className="bg-zinc-950 py-20 md:py-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2
            className="text-3xl md:text-4xl font-bold text-white"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Ready to run your shop like a business?
          </h2>
          <p className="mt-4 text-zinc-400 text-lg">
            Join print shop owners who've replaced spreadsheets with PrintTrack.
            Start free, upgrade any time.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/auth?mode=signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors"
            >
              Sign Up Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={enterDemo}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-zinc-600 hover:border-zinc-400 text-zinc-300 hover:text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors"
            >
              <FlaskConical className="h-4 w-4" />
              View Live Demo first
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-zinc-950 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-xs" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>PT</span>
              </div>
              <span className="font-semibold text-zinc-300" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>PrintTrack</span>
            </div>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500">
              <Link to="/auth?mode=signin" className="hover:text-zinc-300 transition-colors">Sign in</Link>
              <Link to="/auth?mode=signup" className="hover:text-zinc-300 transition-colors">Sign up</Link>
              {/* TODO: add real Privacy Policy page */}
              <a href="#" className="hover:text-zinc-300 transition-colors">Privacy Policy</a>
              {/* TODO: add real Terms of Service page */}
              <a href="#" className="hover:text-zinc-300 transition-colors">Terms of Service</a>
              {/* TODO: add contact page or email link */}
              <a href="#" className="hover:text-zinc-300 transition-colors">Contact</a>
            </nav>
          </div>
          <div className="mt-6 pt-6 border-t border-zinc-800 text-xs text-zinc-600">
            © {new Date().getFullYear()} PrintTrack. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
}
