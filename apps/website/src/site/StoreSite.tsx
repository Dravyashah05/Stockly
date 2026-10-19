import { useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '@stockly/shared-client/config';
import { fetchLatestRelease, fetchReleaseHistory, formatApkSize } from '@stockly/shared-client/releases';
import type { ReleaseInfo, ReleaseSummary } from '@stockly/shared-client/releases';
import { Logo, Reveal, useCountUp, useInView } from './visuals';
import {
  ArrowDown,
  Check,
  Copy,
  Database,
  Layers,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

const NAV = [
  { label: 'Overview', href: '#top' },
  { label: 'Showcase', href: '#showcase' },
  { label: 'Features', href: '#features' },
  { label: 'Tech Specs', href: '#specs' },
  { label: 'Download APK', href: '#store' },
];

const SHOWCASE_SCREENS = [
  {
    id: 'overview',
    tab: 'Overview',
    badge: 'LIVE OVERVIEW',
    img: '/screenshots/screen-home.png',
    title: 'Your inventory, at a glance.',
    desc: '413 stock units across your catalogue, real-time 95% optimal health bar, valuation metrics (₹6,450), and 1-tap quick actions for Stock In and Stock Out.',
    highlights: ['413 total stock units', '95% optimal health rating', 'Quick stock movement triggers'],
  },
  {
    id: 'inventory',
    tab: 'Catalogue',
    badge: 'INSTANT SEARCH',
    img: '/screenshots/screen-inventory.png',
    title: 'Every product. Zero friction.',
    desc: 'Instant search by SKU or name, dynamic category filter pills, clear price badges, and automatic low-stock replenishment alerts.',
    highlights: ['Category filter pills', 'Sub-second SKU search', 'Visual stock status indicators'],
  },
  {
    id: 'stock',
    tab: 'Stock Moves',
    badge: 'RAPID OPERATIONS',
    img: '/screenshots/screen-stock.png',
    title: 'Stock In & Out. Counted instantly.',
    desc: 'Translucent modal sheet with large quantity controls, live quantity preview (10 → 15), and optional cost note tracking.',
    highlights: ['Live quantity preview', 'Single-tap increment/decrement', 'Idempotent transaction submission'],
  },
  {
    id: 'activity',
    tab: 'Audit Ledger',
    badge: 'TRANSACTION HISTORY',
    img: '/screenshots/screen-activity.png',
    title: 'Tamper-evident activity trail.',
    desc: 'Chronological timeline of every stock movement with IN/OUT badge indicators, timestamps, operator tags, and filters.',
    highlights: ['Audit trail with timestamps', 'Clear IN/OUT direction badges', 'Filter by date or movement type'],
  },
  {
    id: 'settings',
    tab: 'Cloud Sync',
    badge: 'GOOGLE SHEETS BACKEND',
    img: '/screenshots/screen-settings.png',
    title: 'Your private Google Sheet database.',
    desc: 'Direct 2-way cloud database sync, seamless GitHub Releases in-app updater, and customizable light or dark appearance.',
    highlights: ['100% private Google Drive storage', 'Automated in-app APK updater', 'Native light & dark appearance'],
  },
];

export default function StoreSite() {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menu]);

  const activeScreen = SHOWCASE_SCREENS[activeTab];

  return (
    <div className="min-h-screen overflow-x-clip bg-[#FBFBFD] dark:bg-[#000000] text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors duration-300">
      <a
        href="#showcase"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-black focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      {/* ---------------- Floating Nav Ribbon ---------------- */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'border-b border-black/5 dark:border-white/10 bg-white/80 dark:bg-black/80 backdrop-blur-xl shadow-xs'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <nav aria-label="Primary" className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
          <a href="#top" className="flex items-center gap-2.5 group" aria-label="Stockly home">
            <Logo size={28} />
            <span className="text-[17px] font-semibold tracking-tight">Stockly</span>
          </a>

          <div className="hidden items-center gap-7 md:flex text-[12px] font-medium text-neutral-600 dark:text-neutral-400">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="transition-colors hover:text-black dark:hover:text-white"
              >
                {n.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <a
              href="#/app"
              className="hidden text-[12px] font-semibold text-neutral-600 dark:text-neutral-300 transition-colors hover:text-black dark:hover:text-white md:inline-block"
            >
              Open Web App
            </a>
            <a
              href="#store"
              className="rounded-full bg-[#007AFF] px-4 py-1.5 text-[12px] font-semibold text-white shadow-xs hover:bg-[#0066D6] active:scale-95 transition-all"
            >
              Get APK
            </a>
            <button
              type="button"
              onClick={() => setMenu((m) => !m)}
              aria-expanded={menu}
              aria-label={menu ? 'Close menu' : 'Open menu'}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 dark:border-white/20 md:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                {menu ? (
                  <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                ) : (
                  <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </nav>

        {menu ? (
          <div className="border-t border-black/5 dark:border-white/10 bg-white/95 dark:bg-black/95 px-6 py-4 md:hidden backdrop-blur-xl">
            {[...NAV, { label: 'Open Web App', href: '#/app' }].map((n) => (
              <a
                key={n.href + n.label}
                href={n.href}
                onClick={() => setMenu(false)}
                className="block border-b border-black/5 dark:border-white/5 py-3 text-[14px] font-semibold last:border-0"
              >
                {n.label}
              </a>
            ))}
          </div>
        ) : null}
      </header>

      {/* ---------------- Hero Section (Keynote Product Reveal) ---------------- */}
      <section id="top" className="relative mx-auto max-w-5xl px-5 pt-32 pb-16 sm:px-8 sm:pt-40 sm:pb-24 text-center">
        {/* Ambient backdrop glow */}
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-20 -translate-x-1/2 h-96 w-[600px] rounded-full bg-blue-500/10 blur-3xl -z-10" />

        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/10 backdrop-blur-md px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-600 dark:text-neutral-300 shadow-xs">
          <span className="h-2 w-2 rounded-full bg-[#007AFF] animate-pulse" />
          Liquid Glass Design • Google Sheets Backend
        </div>

        <h1 className="mt-8 text-5xl sm:text-7xl lg:text-[5.4rem] font-bold tracking-tight text-neutral-900 dark:text-white leading-[1.04]">
          Know your stock.
          <br />
          <span className="text-neutral-400 dark:text-neutral-500">Move with clarity.</span>
        </h1>

        <p className="mt-6 mx-auto max-w-2xl text-[18px] sm:text-[21px] font-normal leading-relaxed text-neutral-600 dark:text-neutral-400">
          A minimalist inventory management experience. Translucent liquid glass surfaces, live 2-way Google Sheets cloud sync, and effortless stock control for Android and Web.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <a
            href="#store"
            className="rounded-full bg-[#007AFF] px-8 py-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-[#0066D6] active:scale-95 transition-all flex items-center gap-2"
          >
            <span>Download for Android</span>
            <span className="text-xs opacity-75 font-mono">v{APP_VERSION}</span>
          </a>
          <a
            href="#/app"
            className="rounded-full bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 px-7 py-3.5 text-[13px] font-semibold text-neutral-900 dark:text-white hover:bg-black/10 dark:hover:bg-white/15 active:scale-95 transition-all"
          >
            Launch Web App
          </a>
          <a
            href="store.html"
            className="rounded-full border border-black/10 dark:border-white/15 px-6 py-3.5 text-[13px] font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:border-black/30 dark:hover:border-white/30 transition-all"
          >
            App Store Page →
          </a>
        </div>

        {/* Value props badge strip */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-[12px] font-medium text-neutral-500">
          <span className="flex items-center gap-1.5">
            <span className="text-emerald-500 font-bold">✓</span> Android 14 Ready
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-emerald-500 font-bold">✓</span> 100% Private Cloud Sheet
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-emerald-500 font-bold">✓</span> Offline Idempotency
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-emerald-500 font-bold">✓</span> Zero Monthly Fees
          </span>
        </div>
      </section>

      {/* ---------------- Interactive Showcase (Flagship Device Studio) ---------------- */}
      <section id="showcase" className="relative mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#007AFF]">
              INTERACTIVE TOUR
            </p>
            <h2 className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Every screen, crafted with intent.
            </h2>
            <p className="mt-3 text-[15px] text-neutral-500">
              Explore the authentic mobile interface. Select any workflow below to preview live screens.
            </p>
          </div>
        </Reveal>

        {/* Showcase Segmented Controller */}
        <div className="flex justify-center mb-10 overflow-x-auto no-scrollbar py-1">
          <div className="inline-flex items-center rounded-full bg-black/5 dark:bg-white/10 p-1.5 backdrop-blur-md border border-black/5 dark:border-white/10">
            {SHOWCASE_SCREENS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveTab(idx)}
                className={`px-4 py-2 rounded-full text-[12px] font-semibold transition-all whitespace-nowrap ${
                  activeTab === idx
                    ? 'bg-white dark:bg-white/20 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {s.tab}
              </button>
            ))}
          </div>
        </div>

        {/* Device Frame with Active Screen */}
        <div className="relative mx-auto max-w-[340px] sm:max-w-[360px]">
          {/* Subtle device ambient glow */}
          <div aria-hidden="true" className="pointer-events-none absolute -inset-4 rounded-[60px] bg-blue-500/15 blur-2xl -z-10" />

          {/* Realistic smartphone bezel */}
          <div className="phone-frame relative z-10 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.35)] dark:shadow-[0_30px_70px_-20px_rgba(0,0,0,0.8)] border border-white/10 dark:border-white/10">
            <div className="phone-screen relative overflow-hidden bg-black aspect-[9/19.5]">
              <img
                key={activeScreen.id}
                src={activeScreen.img}
                alt={activeScreen.title}
                className="w-full h-full object-cover object-top block transition-opacity duration-300"
                loading="eager"
              />
            </div>
          </div>
        </div>

        {/* Feature Detail Editorial Card below Phone */}
        <div className="mt-10 max-w-xl mx-auto text-center rounded-3xl glass-surface p-6 sm:p-8 border border-black/5 dark:border-white/10 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#007AFF] block">
            {activeScreen.badge}
          </span>
          <h3 className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">
            {activeScreen.title}
          </h3>
          <p className="mt-2 text-[14px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
            {activeScreen.desc}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {activeScreen.highlights.map((h) => (
              <span
                key={h}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 dark:bg-white/10 text-[11px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                <Check size={12} className="text-[#007AFF]" />
                {h}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Live Numbers Canvas ---------------- */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24 border-t border-black/5 dark:border-white/10">
        <Reveal>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-400">
            METRICS AT A GLANCE
          </p>
          <h2 className="mt-2 text-4xl sm:text-6xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Less searching. More knowing.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <Reveal delay="st-d1">
            <CanvasNumbers />
          </Reveal>
          <Reveal delay="st-d2" className="rounded-3xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#161618] p-5 shadow-xs">
            <div className="space-y-1">
              {[
                { n: 'Crystal Beads', m: 'Only Chain · min 10', s: '10 · low', ok: false },
                { n: 'FC Chain', m: 'Bracelet · min 5', s: '43 in stock', ok: true },
                { n: 'BB Single Tukda', m: 'Black beads · min 5', s: '20 in stock', ok: true },
                { n: 'Rhodium Chain', m: 'Only Chain · min 5', s: '20 in stock', ok: true },
              ].map((p, i) => (
                <div key={p.n} className="flex items-center gap-3 border-b border-black/5 dark:border-white/5 px-2 py-3.5 last:border-0">
                  <span className="w-6 text-[12px] font-mono text-neutral-400">0{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-neutral-900 dark:text-white">{p.n}</span>
                    <span className="block text-[11px] font-medium text-neutral-400">{p.m}</span>
                  </div>
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-black/5 dark:bg-white/10 sm:w-24" aria-hidden="true">
                    <span className={`block h-full rounded-full ${p.ok ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: p.ok ? '85%' : '25%' }} />
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${p.ok ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                    {p.s}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Interactive Stock Movements Demo ---------------- */}
      <HowItWorks />

      <Features />

      {/* ---------------- Architecture Bento Grid ---------------- */}
      <section id="features" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-16 sm:px-8 sm:py-24 border-t border-black/5 dark:border-white/10">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#007AFF]">
              ARCHITECTURE
            </span>
            <h2 className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Every detail, engineered for velocity.
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Bento Card 1: Google Sheets */}
          <div className="rounded-3xl glass-surface p-7 sm:p-8 space-y-4 border border-black/5 dark:border-white/10 shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Database size={24} />
            </div>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
              Your Google Sheet. As your serverless cloud.
            </h3>
            <p className="text-[14px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Your private spreadsheet is your database. No monthly SaaS fees, no proprietary vendor lock-in. 2-way real-time sync with conflict-free row locking.
            </p>
          </div>

          {/* Bento Card 2: Liquid Glass Design */}
          <div className="rounded-3xl glass-surface p-7 sm:p-8 space-y-4 border border-black/5 dark:border-white/10 shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Layers size={24} />
            </div>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
              Liquid Glass Design Language
            </h3>
            <p className="text-[14px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Frosted glass navigation, translucent sheet overlays, and high-contrast numerical surfaces designed for effortless touch interactions on mobile.
            </p>
          </div>

          {/* Bento Card 3: Offline Idempotency */}
          <div className="rounded-3xl glass-surface p-7 sm:p-8 space-y-4 border border-black/5 dark:border-white/10 shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
              Offline-First Idempotency
            </h3>
            <p className="text-[14px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Moving items in a basement stockroom with dead Wi-Fi? Transactions queue safely in local IndexedDB and reconcile seamlessly without duplicates.
            </p>
          </div>

          {/* Bento Card 4: Sideload & In-App Updates */}
          <div className="rounded-3xl glass-surface p-7 sm:p-8 space-y-4 border border-black/5 dark:border-white/10 shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <RefreshCw size={24} />
            </div>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
              Direct Sideload & Auto Updates
            </h3>
            <p className="text-[14px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
              No store delays. Stockly checks GitHub releases automatically. When an update is published, update directly with a single tap from Settings.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- Technical Specifications ---------------- */}
      <section id="specs" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-16 sm:px-8 sm:py-24 border-t border-black/5 dark:border-white/10">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#007AFF]">
              SPECIFICATIONS
            </span>
            <h2 className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Technical Details.
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#161618] p-5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">OS PLATFORM</span>
            <h4 className="mt-1 text-[17px] font-bold text-neutral-900 dark:text-white">Android 14 Ready</h4>
            <p className="mt-1.5 text-[12px] text-neutral-500 leading-relaxed">
              Tested on Android 14 (API 34). Compatible from Android 7.0 (API 24) to Android 16.
            </p>
          </div>

          <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#161618] p-5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">SIGNATURE & INTEGRITY</span>
            <h4 className="mt-1 text-[17px] font-bold text-neutral-900 dark:text-white">v1 & v2 Signature</h4>
            <p className="mt-1.5 text-[12px] text-neutral-500 leading-relaxed">
              Signed with official release keystore. Dual v1 (JAR) and v2 scheme for universal install.
            </p>
          </div>

          <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#161618] p-5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">PACKAGE SIZE</span>
            <h4 className="mt-1 text-[17px] font-bold text-neutral-900 dark:text-white">Lightweight ~4.3 MB</h4>
            <p className="mt-1.5 text-[12px] text-neutral-500 leading-relaxed">
              Universal 64-bit ARM / x86_64 build with zero heavy background bloat or analytics daemons.
            </p>
          </div>

          <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#161618] p-5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">DATABASE BACKEND</span>
            <h4 className="mt-1 text-[17px] font-bold text-neutral-900 dark:text-white">Google Apps Script</h4>
            <p className="mt-1.5 text-[12px] text-neutral-500 leading-relaxed">
              Tamper-resistant HMAC session tokens, optimistic concurrency, and zero third-party databases.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- Download / Release Section ---------------- */}
      <Store />

      {/* ---------------- Minimal Footer ---------------- */}
      <footer className="border-t border-black/5 dark:border-white/10 px-5 py-10 sm:px-8 mt-16">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between text-[12px] text-neutral-500">
          <div className="flex items-center gap-2.5">
            <Logo size={22} />
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">Stockly · v{APP_VERSION}</span>
          </div>

          <div className="flex flex-wrap gap-6">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-black dark:hover:text-white transition-colors">
                {n.label}
              </a>
            ))}
            <a href="store.html" className="hover:text-black dark:hover:text-white transition-colors">
              App Store Page
            </a>
            <a href="#/app" className="hover:text-black dark:hover:text-white transition-colors">
              Web Workspace
            </a>
          </div>

          <p>© 2026 Stockly by DNS. Crafted with precision for modern mobile commerce.</p>
        </div>
      </footer>
    </div>
  );
}

/* ---------------- Canvas Numbers Snapshot ---------------- */

function CanvasNumbers() {
  const [ref, inView] = useInView<HTMLDivElement>();
  const units = useCountUp(413, inView);
  const prods = useCountUp(20, inView);
  const low = useCountUp(1, inView);
  return (
    <div ref={ref} className="grid grid-cols-3 gap-4 border-t border-black/10 dark:border-white/10 pt-6 lg:grid-cols-1 lg:gap-6">
      <p className="col-span-3 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 lg:col-span-1">Live inventory snapshot</p>
      {[
        [units.toLocaleString('en-IN'), 'Units in stock'],
        [String(prods), 'Catalogue products'],
        [String(low), 'Needs replenishment'],
      ].map(([v, l]) => (
        <div key={l}>
          <p className="tnum text-4xl sm:text-5xl font-bold tracking-tight text-neutral-900 dark:text-white">{v}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">{l}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Stock Move Sequence Demo ---------------- */

const STEPS = ['Stock in', 'Updated', 'Synced'] as const;

function HowItWorks() {
  const [ref, inView] = useInView<HTMLDivElement>();
  const [step, setStep] = useState(2);
  const [counted, setCounted] = useState(false);
  const qty = useCountUp(15, counted, 900);
  const shown = step < 1 ? 10 : Math.min(Math.max(qty, 10), 15);

  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep(2);
      setCounted(true);
      return;
    }
    setStep(0);
    const id = window.setInterval(() => {
      setStep((s) => {
        if (s === 0) setCounted(true);
        return (s + 1) % 3;
      });
    }, 1700);
    return () => window.clearInterval(id);
  }, [inView]);

  return (
    <section id="how" className="scroll-mt-20 bg-[#161618] text-white px-5 py-16 sm:px-8 sm:py-24">
      <div ref={ref} className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#007AFF]">02 · RAPID STOCK OPERATIONS</p>
          <h2 className="mt-3 max-w-[14ch] text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight">
            One tap. Counted, logged, confirmed.
          </h2>
          <ol className="mt-8 space-y-2" aria-label="Stock operation sequence">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-4 py-2.5" aria-current={step === i ? 'step' : undefined}>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-colors duration-300 ${
                    step >= i ? 'bg-[#007AFF] text-white' : 'border border-white/20 text-white/40'
                  }`}
                >
                  {i + 1}
                </span>
                <span className={`text-[17px] font-bold tracking-wide transition-colors duration-300 ${step >= i ? 'text-white' : 'text-white/40'}`}>
                  {s}
                </span>
                {step === i ? <span className="h-2 w-2 rounded-full bg-[#007AFF] animate-ping ml-1" aria-hidden="true" /> : null}
              </li>
            ))}
          </ol>
        </Reveal>
        <Reveal delay="st-d1">
          <div className="relative overflow-hidden rounded-3xl bg-black/40 border border-white/10 p-8 text-center sm:p-12">
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">Crystal Beads (Only Chain)</p>
            <p className="tnum mt-2 text-7xl sm:text-8xl font-bold leading-none tracking-tight text-white">{shown}</p>
            <p className="mt-2 text-[13px] font-semibold tracking-wider text-blue-400">+5 recorded (10 → 15)</p>
            <div className="mx-auto mt-6 h-1.5 w-44 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
              <div className="h-full rounded-full bg-[#007AFF] transition-all duration-500" style={{ width: `${((step + 1) / 3) * 100}%` }} />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Interactive Features Playground ---------------- */

const KNOW_ROWS = [
  { n: 'Crystal Beads', s: '10 · low' },
  { n: 'FC Chain', s: '43 in stock' },
  { n: 'BB Single Tukda', s: '20 in stock' },
  { n: 'Rhodium Chain', s: '20 in stock' },
  { n: 'Gold Chain', s: '20 in stock' },
];

function Features() {
  const [knowQ, setKnowQ] = useState('');
  const [moveQty, setMoveQty] = useState(20);
  const [moveLog, setMoveLog] = useState<string[]>(['+50 · morning']);
  const [trustOn, setTrustOn] = useState(true);
  const knowRows = KNOW_ROWS.filter((r) => `${r.n} ${r.s}`.toLowerCase().includes(knowQ.trim().toLowerCase()));

  const move = (d: number) => {
    setMoveQty((q) => {
      const next = Math.max(0, q + d);
      setMoveLog((log) => [`${d > 0 ? '+' : ''}${d} · just now`, ...log].slice(0, 3));
      return next;
    });
  };

  return (
    <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <Reveal>
        <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#007AFF]">
          03 · DIRECT CONTROLS
        </span>
        <h2 className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Simplicity at your fingertips.
        </h2>
      </Reveal>

      {/* 01 KNOW */}
      <div className="mt-10 grid gap-8 border-t border-black/10 dark:border-white/10 pt-10 lg:grid-cols-[220px_1fr_1fr] lg:gap-12">
        <Reveal>
          <p className="text-[13px] font-bold text-neutral-400 uppercase tracking-wider">Search</p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Instant Lookup</h3>
          <p className="mt-2 text-[13px] text-neutral-500 leading-relaxed">Search anything in your warehouse. Filter by name or SKU instantly.</p>
        </Reveal>
        <Reveal delay="st-d1" className="lg:col-span-2">
          <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#161618] p-4 sm:p-5 shadow-xs">
            <input
              id="st-know-search"
              value={knowQ}
              onChange={(e) => setKnowQ(e.target.value)}
              placeholder="Try searching “beads” or “chain”…"
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] px-4 py-2.5 text-[14px] outline-none placeholder:text-neutral-400 focus:border-[#007AFF]"
            />
            <div className="mt-3 space-y-1">
              {knowRows.length === 0 ? (
                <p className="px-2 py-3 text-[13px] text-neutral-400">No match found.</p>
              ) : (
                knowRows.map((r) => (
                  <div key={r.n} className="flex items-center justify-between border-b border-black/5 dark:border-white/5 px-2 py-2.5 last:border-0 text-[13.5px]">
                    <span className="font-semibold text-neutral-900 dark:text-white">{r.n}</span>
                    <span className="font-mono text-xs text-neutral-500">{r.s}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Reveal>
      </div>

      {/* 02 MOVE */}
      <div className="mt-12 grid gap-8 border-t border-black/10 dark:border-white/10 pt-10 lg:grid-cols-[220px_1fr_1fr] lg:gap-12">
        <Reveal>
          <p className="text-[13px] font-bold text-neutral-400 uppercase tracking-wider">Movements</p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Fast Quantity Stepper</h3>
          <p className="mt-2 text-[13px] text-neutral-500 leading-relaxed">Stock in and stock out with large, accessible touch targets.</p>
        </Reveal>
        <Reveal delay="st-d1" className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 rounded-2xl bg-neutral-900 text-white p-6 sm:p-8">
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => move(-1)}
                aria-label="Decrease quantity"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-xl font-bold transition-transform hover:scale-105 active:scale-95"
              >
                −
              </button>
              <span className="tnum min-w-[3ch] text-center text-5xl font-bold tracking-tight">{moveQty}</span>
              <button
                type="button"
                onClick={() => move(1)}
                aria-label="Increase quantity"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#007AFF] text-xl font-bold text-white transition-transform hover:scale-105 active:scale-95"
              >
                +
              </button>
            </div>
            <ul aria-label="Recorded movements" className="w-full max-w-[200px] space-y-1.5 text-[12px]">
              {moveLog.map((l, i) => (
                <li key={`${l}-${i}`} className={`rounded-lg px-3 py-1.5 font-semibold ${i === 0 ? 'bg-[#007AFF] text-white' : 'bg-white/10 text-white/70'}`}>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>

      {/* 03 TRUST */}
      <div className="mt-12 grid gap-8 border-t border-black/10 dark:border-white/10 pt-10 lg:grid-cols-[220px_1fr_1fr] lg:gap-12">
        <Reveal>
          <p className="text-[13px] font-bold text-neutral-400 uppercase tracking-wider">Audit</p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Synced Ledger</h3>
          <p className="mt-2 text-[13px] text-neutral-500 leading-relaxed">Instant visual indicators confirm whether records have safely reached the cloud.</p>
        </Reveal>
        <Reveal delay="st-d1" className="lg:col-span-2">
          <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#161618] p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] font-bold uppercase tracking-wider text-neutral-400">Transaction Status Preview</p>
              <button
                type="button"
                role="switch"
                aria-checked={trustOn}
                aria-label="Toggle connection preview"
                onClick={() => setTrustOn((o) => !o)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${trustOn ? 'bg-[#007AFF]' : 'bg-neutral-300 dark:bg-neutral-700'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${trustOn ? 'left-5.5' : 'left-0.5'}`} />
              </button>
            </div>
            <div className="mt-3 space-y-1.5">
              {[
                ['+1', 'Crystal Beads · 14:07'],
                ['−1', 'FC Chain · 14:05'],
                ['+1', 'FC Chain · 13:54'],
                ['+20', 'FC Chain · 17 Oct'],
              ].map(([q, m]) => (
                <div key={m} className="flex items-center justify-between rounded-xl bg-black/[0.02] dark:bg-white/[0.04] px-3.5 py-2">
                  <span className={`tnum text-[14px] font-bold ${q.startsWith('+') ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{q}</span>
                  <span className="text-[12px] text-neutral-500">{m}</span>
                </div>
              ))}
            </div>
            <p className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${trustOn ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${trustOn ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'}`} />
              {trustOn ? 'Connected to Google Sheets' : 'Offline — safely buffered on this device'}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Store & Download Section ---------------- */

function Store() {
  const [rel, setRel] = useState<
    | { status: 'checking' }
    | { status: 'ready'; info: ReleaseInfo }
    | { status: 'error'; message: string }
  >({ status: 'checking' });
  const [history, setHistory] = useState<ReleaseSummary[] | null>(null);
  const [copiedSha, setCopiedSha] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    fetchLatestRelease()
      .then((info) => {
        if (alive.current) setRel({ status: 'ready', info });
      })
      .catch((e: unknown) => {
        if (alive.current) {
          setRel({
            status: 'error',
            message: e instanceof Error && e.message ? e.message : 'Couldn’t load release info.',
          });
        }
      });
    fetchReleaseHistory(6)
      .then((list) => {
        if (alive.current) setHistory(list);
      })
      .catch(() => {
        if (alive.current) setHistory(null);
      });
    return () => {
      alive.current = false;
    };
  }, []);

  const info = rel.status === 'ready' ? rel.info : null;
  const prior = (history || []).filter((h) => h.tag !== info?.tag).slice(0, 4);

  const copySha = () => {
    if (!info?.sha256) return;
    navigator.clipboard?.writeText(info.sha256);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
  };

  return (
    <section id="store" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-16 sm:px-8 sm:py-24 border-t border-black/5 dark:border-white/10">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <Reveal>
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#007AFF]">
            DIRECT DOWNLOAD
          </span>
          <h2 className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Get Stockly for Android.
          </h2>
          <p className="mt-4 text-[15px] text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-lg">
            Free and open. Built for small businesses, stockrooms, and shop floors. Direct universal APK with permanent release signature.
          </p>

          <div className="mt-6 space-y-3">
            {[
              'Android 14 Ready (API 34) & backwards compatible to Android 7.0',
              'Official release signature (v1 & v2 schemes verified)',
              '100% private: your own Google Drive spreadsheet is your database',
              'Instant in-app updates whenever new versions publish',
            ].map((t) => (
              <div key={t} className="flex items-center gap-2.5 text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                  ✓
                </span>
                <span>{t}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 text-[12px] leading-relaxed text-neutral-500">
            <strong className="font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
              Android 14 Installation Instructions:
            </strong>
            1. Tap “Download APK” and open the file once downloaded.<br />
            2. If prompted, toggle “Allow from this source” in Android Settings.<br />
            3. Tap Install. If you previously installed a test build, uninstall that older version first so Android can apply the permanent release certificate.
          </div>
        </Reveal>

        <Reveal delay="st-d1">
          <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#161618] p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-900 text-white shadow-xs">
                <Logo size={32} light />
              </div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Stockly for Android</h3>
                <p className="text-[12px] text-neutral-500 font-mono mt-0.5">
                  {info
                    ? `v${info.version}${info.versionCode > 0 ? ` (${info.versionCode})` : ''} · ${formatApkSize(info.apkSize)}`
                    : `Version ${APP_VERSION}`}
                </p>
              </div>
            </div>

            {info?.releaseNotes.length ? (
              <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                  WHAT’S NEW
                </span>
                <ul className="space-y-1 text-[12.5px] text-neutral-600 dark:text-neutral-400">
                  {info.releaseNotes.slice(0, 3).map((n) => (
                    <li key={n} className="line-clamp-1">· {n}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {info ? (
              <a
                href={info.apkUrl}
                className="mt-6 flex items-center justify-center gap-2 rounded-full bg-[#007AFF] py-3.5 text-center text-[13px] font-semibold text-white shadow-xs hover:bg-[#0066D6] active:scale-95 transition-all"
              >
                <ArrowDown size={16} />
                <span>Download APK ({formatApkSize(info.apkSize)})</span>
              </a>
            ) : (
              <a
                href="https://github.com/Dravyashah05/Stockly/releases"
                className="mt-6 block rounded-full bg-neutral-900 py-3.5 text-center text-[13px] font-semibold text-white"
              >
                View Releases on GitHub
              </a>
            )}

            {info?.sha256 ? (
              <div className="mt-4 flex items-center justify-between gap-2 p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] text-[11px]">
                <div className="min-w-0 font-mono text-neutral-500 truncate select-all">
                  SHA-256: {info.sha256}
                </div>
                <button
                  type="button"
                  onClick={copySha}
                  className="shrink-0 flex items-center gap-1 text-[#007AFF] font-semibold hover:underline"
                >
                  {copiedSha ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedSha ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            ) : null}

            {prior.length > 0 ? (
              <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                  PREVIOUS RELEASES
                </span>
                <div className="space-y-2">
                  {prior.map((h) => (
                    <div key={h.tag} className="flex items-center justify-between text-[12px]">
                      <a href={h.releaseUrl} target="_blank" rel="noreferrer" className="font-semibold text-neutral-800 dark:text-neutral-200 hover:text-[#007AFF]">
                        v{h.version}
                      </a>
                      <span className="text-neutral-400 font-mono text-xs">
                        {h.apkSize > 0 ? formatApkSize(h.apkSize) : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
