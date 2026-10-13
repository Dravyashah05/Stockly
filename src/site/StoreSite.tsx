import { useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '../lib/config';
import { DashboardMock, Logo, PhoneMock, Reveal, useCountUp, useInView, useParallax } from './visuals';

const NAV = [
  { label: 'Product', href: '#product' },
  { label: 'Features', href: '#features' },
  { label: 'About', href: '#about' },
  { label: 'Open app', href: 'app.html' },
];

export default function StoreSite() {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
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

  const heroMockRef = useParallax<HTMLDivElement>(0.05);

  return (
    <div className="min-h-screen overflow-x-clip bg-[#F7F7F2] text-[#151515]">
      <a href="#product" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[#151515] focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>

      {/* ---------------- nav ---------------- */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? 'border-b border-[#D9D9D0] bg-[#F7F7F2]/90 backdrop-blur-md' : 'border-b border-transparent bg-transparent'
        }`}
      >
        <nav aria-label="Primary" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <a href="#top" className="flex items-center gap-2.5" aria-label="Stockly home">
            <Logo />
            <span className="text-[17px] font-extrabold tracking-tight">Stockly</span>
          </a>
          <div className="hidden items-center gap-8 md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-[13px] font-bold uppercase tracking-[0.14em] text-neutral-600 transition-colors hover:text-[#151515]">
                {n.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#store"
              className="hidden rounded-full bg-[#151515] px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-[0.14em] text-white transition-transform hover:scale-[1.03] active:scale-95 md:inline-block"
            >
              Get started
            </a>
            <button
              type="button"
              onClick={() => setMenu((m) => !m)}
              aria-expanded={menu}
              aria-label={menu ? 'Close menu' : 'Open menu'}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D9D9D0] md:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
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
          <div className="border-t border-[#D9D9D0] bg-[#F7F7F2] px-5 pb-5 pt-2 md:hidden">
            {[...NAV, { label: 'Get started', href: '#store' }].map((n) => (
              <a
                key={n.href + n.label}
                href={n.href}
                onClick={() => setMenu(false)}
                className="block border-b border-[#EAEAE4] py-3.5 text-[15px] font-extrabold last:border-0"
              >
                {n.label}
              </a>
            ))}
          </div>
        ) : null}
      </header>

      {/* ---------------- hero ---------------- */}
      <section id="top" className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-32 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-40">
        <div>
          <p className="st-enter inline-block rounded-full border border-[#D9D9D0] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em]">
            Stock management, reimagined.
          </p>
          <h1 className="st-enter mt-5 text-[13.5vw] font-extrabold leading-[0.98] tracking-tight sm:text-6xl lg:text-[5.2rem]" style={{ animationDelay: '0.08s' }}>
            Know your stock.
            <br />
            Move with <span className="relative inline-block">clarity<span aria-hidden="true" className="absolute -bottom-1 left-0 h-[5px] w-full rounded-full bg-[#C7FF4D]" />.</span>
          </h1>
          <p className="st-enter mt-5 max-w-[34ch] text-[17px] font-medium leading-relaxed text-neutral-600" style={{ animationDelay: '0.16s' }}>
            Your inventory. Under control.
          </p>
          <div className="st-enter mt-8 flex flex-wrap gap-3" style={{ animationDelay: '0.24s' }}>
            <a href="#product" className="rounded-full bg-[#151515] px-7 py-3.5 text-[13px] font-extrabold uppercase tracking-[0.14em] text-white transition-transform hover:scale-[1.03] active:scale-95">
              Explore Stockly
            </a>
            <a href="#how" className="rounded-full border border-[#151515] px-7 py-3.5 text-[13px] font-extrabold uppercase tracking-[0.14em] transition-colors hover:bg-[#151515] hover:text-white">
              See how it works
            </a>
          </div>
          <dl className="st-enter mt-10 flex gap-8 border-t border-[#D9D9D0] pt-5" style={{ animationDelay: '0.32s' }}>
            {[
              ['Android', 'Mobile-first'],
              ['Sheets', 'Your database'],
              ['Cached', 'Last synced data'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10.5px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">{v}</dt>
                <dd className="mt-0.5 text-[16px] font-extrabold">{k}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div ref={heroMockRef} className="lg:pl-4">
          <DashboardMock />
        </div>
      </section>

      {/* ---------------- A: canvas ---------------- */}
      <section id="product" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 sm:py-24">
        <Reveal>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">01 · The inventory canvas</p>
          <h2 className="mt-3 max-w-[12ch] text-5xl font-extrabold leading-[1.0] tracking-tight sm:text-7xl">
            Less searching. More knowing.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <Reveal delay="st-d1">
            <CanvasNumbers />
          </Reveal>
          <Reveal delay="st-d2" className="rounded-[28px] border border-[#D9D9D0] bg-white p-4 shadow-[0_24px_48px_-30px_rgba(21,21,21,0.3)] sm:p-5">
            {[
              { n: 'AB Chain', m: 'Bracelet · min 5', s: '20 in stock', ok: true },
              { n: 'Crystal Beads', m: 'Only chain · min 10', s: '20 in stock', ok: true },
              { n: 'Gold Chain', m: 'Only chain · min 8', s: '3 · low', ok: false },
              { n: 'Rhodium Chain', m: 'Only chain · min 6', s: '12 in stock', ok: true },
            ].map((p, i) => (
              <div key={p.n} className="flex items-center gap-3 border-b border-[#EAEAE4] px-2 py-3 last:border-0">
                <span className="w-7 text-[13px] font-extrabold text-neutral-400">0{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{p.n}</span>
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{p.m}</span>
                </span>
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#EAEAE4] sm:w-24" aria-hidden="true">
                  <span className={`block h-full rounded-full ${p.ok ? 'bg-[#151515]' : 'bg-[#9A5B00]'}`} style={{ width: p.ok ? '82%' : '24%' }} />
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${p.ok ? 'bg-[#E7F7E4] text-[#1E7B3C]' : 'bg-[#FBEACB] text-[#9A5B00]'}`}>
                  {p.s}
                </span>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <HowItWorks />

      <Features />

      {/* ---------------- D: everywhere ---------------- */}
      <section id="about" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal className="order-2 lg:order-1">
            <PhoneMock />
          </Reveal>
          <div className="order-1 lg:order-2">
            <Reveal>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">04 · Your stock. Everywhere.</p>
              <h2 className="mt-3 text-5xl font-extrabold leading-[1.0] tracking-tight sm:text-6xl">
                The shop floor, in your pocket.
              </h2>
            </Reveal>
            <Reveal delay="st-d1">
              <ul className="mt-8 space-y-4">
                {[
                  ['Built for thumbs', 'Products, stock moves and history — two taps away.'],
                  ['Your latest stock, at hand', 'The app keeps a local copy of your last synced inventory for quick reference.'],
                  ['One shared Sheet', 'Every device reads and writes the same Google Sheet.'],
                ].map(([t, d]) => (
                  <li key={t} className="flex gap-4 border-t border-[#D9D9D0] pt-4">
                    <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#151515]" />
                    <span>
                      <span className="block text-[16px] font-extrabold">{t}</span>
                      <span className="mt-0.5 block max-w-[38ch] text-[14px] font-medium leading-relaxed text-neutral-600">{d}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- E: closing ---------------- */}
      <section className="st-darkzone bg-[#111210] px-5 py-20 text-white sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#C7FF4D]">05 · Begin</p>
            <h2 className="mt-4 max-w-[14ch] text-5xl font-extrabold leading-[1.0] tracking-tight sm:text-7xl">
              Get a better grip on your inventory.
            </h2>
            <a href="#store" className="mt-9 inline-block rounded-full bg-[#C7FF4D] px-8 py-4 text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#151515] transition-transform hover:scale-[1.03] active:scale-95">
              Discover Stockly
            </a>
          </Reveal>
        </div>
      </section>

      <Store />


      <footer className="border-t border-[#D9D9D0] px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2.5">
            <Logo />
            <span className="text-[15px] font-extrabold tracking-tight">Stockly · v{APP_VERSION}</span>
          </span>
          <div className="flex gap-6">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-[12px] font-bold uppercase tracking-[0.14em] text-neutral-500 transition-colors hover:text-[#151515]">
                {n.label}
              </a>
            ))}
          </div>
          <p className="text-[12px] font-medium text-neutral-500">Made for small businesses.</p>
        </div>
      </footer>
    </div>
  );
}

/* ---------------- canvas numbers ---------------- */

function CanvasNumbers() {
  const [ref, inView] = useInView<HTMLDivElement>();
  const units = useCountUp(1248, inView);
  const prods = useCountUp(36, inView);
  const low = useCountUp(4, inView);
  return (
    <div ref={ref} className="grid grid-cols-3 gap-4 border-t border-[#151515] pt-6 lg:grid-cols-1 lg:gap-6">
      <p className="col-span-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500 lg:col-span-1">Example inventory</p>
      {[
        [units.toLocaleString('en-IN'), 'Units in example'],
        [String(prods), 'Sample products'],
        [String(low), 'Low stock examples'],
      ].map(([v, l]) => (
        <div key={l}>
          <p className="tnum text-5xl font-extrabold tracking-tight sm:text-6xl">{v}</p>
          <p className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">{l}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------------- B: stock-move sequence (dark) ---------------- */

const STEPS = ['Stock in', 'Updated', 'Synced'] as const;

function HowItWorks() {
  const [ref, inView] = useInView<HTMLDivElement>();
  const [step, setStep] = useState(2);
  // Latch the count-up on its first run so later cycle loops don't restart it.
  const [counted, setCounted] = useState(false);
  const qty = useCountUp(170, counted, 900);
  const shown = step < 1 ? 120 : Math.min(Math.max(qty, 120), 170);

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
    <section id="how" className="st-darkzone scroll-mt-20 bg-[#111210] px-5 py-16 text-white sm:px-8 sm:py-24">
      <div ref={ref} className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#C7FF4D]">02 · Stock moves. You stay ahead.</p>
          <h2 className="mt-3 max-w-[12ch] text-5xl font-extrabold leading-[1.0] tracking-tight sm:text-6xl">
            One tap. Counted, logged, confirmed.
          </h2>
          <ol className="mt-9 space-y-0" aria-label="Stock operation sequence">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-4 py-3" aria-current={step === i ? 'step' : undefined}>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold transition-colors duration-300 ${
                    step >= i ? 'bg-[#C7FF4D] text-[#151515]' : 'border border-white/25 text-white/50'
                  }`}
                >
                  {i + 1}
                </span>
                <span className={`text-[19px] font-extrabold uppercase tracking-wide transition-colors duration-300 ${step >= i ? 'text-white' : 'text-white/40'}`}>
                  {s}
                </span>
                {step === i ? <span className="st-blink ml-1 h-2 w-2 rounded-full bg-[#C7FF4D]" aria-hidden="true" /> : null}
              </li>
            ))}
          </ol>
        </Reveal>
        <Reveal delay="st-d1">
          <div className="relative overflow-hidden rounded-[32px] bg-[#1A1B18] p-8 text-center sm:p-12">
            <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#C7FF4D]/15 blur-3xl" />
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/50">Basmati Rice 5kg</p>
            <p className="tnum mt-2 text-[88px] font-extrabold leading-none tracking-tight text-[#C7FF4D] sm:text-[120px]">{shown}</p>
            <p className="mt-2 text-[13px] font-bold uppercase tracking-[0.2em] text-white/60">+50 recorded</p>
            <div className="mx-auto mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
              <div className="h-full rounded-full bg-[#C7FF4D] transition-all duration-500" style={{ width: `${((step + 1) / 3) * 100}%` }} />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- C: feature moments ---------------- */

const KNOW_ROWS = [
  { n: 'Basmati Rice 5kg', s: '142 in stock' },
  { n: 'Cold-Pressed Oil 1L', s: '86 in stock' },
  { n: 'Detergent Bar 200g', s: '4 · low' },
  { n: 'Sugar 1kg', s: '64 in stock' },
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
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 sm:py-24">
      <Reveal>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">03 · Designed for the everyday</p>
      </Reveal>

      {/* 01 KNOW */}
      <div className="mt-10 grid gap-8 border-t-2 border-[#151515] pt-10 lg:grid-cols-[220px_1fr_1fr] lg:gap-12">
        <Reveal>
          <p className="text-[15px] font-extrabold text-neutral-400">01</p>
          <h3 className="mt-1 text-3xl font-extrabold tracking-tight">Know</h3>
          <p className="mt-2 max-w-[26ch] text-[14px] font-medium leading-relaxed text-neutral-600">Search everything. See stock at a glance.</p>
        </Reveal>
        <Reveal delay="st-d1" className="lg:col-span-2">
          <div className="rounded-[24px] border border-[#D9D9D0] bg-white p-4 sm:p-5">
            <label className="sr-only" htmlFor="st-know-search">Try the search</label>
            <input
              id="st-know-search"
              value={knowQ}
              onChange={(e) => setKnowQ(e.target.value)}
              placeholder="Try it — type “oil”…"
              className="w-full rounded-2xl border border-[#D9D9D0] bg-[#F7F7F2] px-4 py-3 text-[15px] font-medium outline-none placeholder:text-neutral-400 focus:border-[#151515]"
            />
            <div className="mt-2">
              {knowRows.length === 0 ? (
                <p className="px-2 py-4 text-[14px] font-medium text-neutral-500">Nothing matches — try “rice”.</p>
              ) : (
                knowRows.map((r) => (
                  <div key={r.n} className="flex items-center justify-between border-b border-[#EAEAE4] px-2 py-2.5 last:border-0">
                    <span className="text-[14.5px] font-bold">{r.n}</span>
                    <span className="text-[12.5px] font-extrabold text-neutral-500">{r.s}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Reveal>
      </div>

      {/* 02 MOVE */}
      <div className="mt-14 grid gap-8 border-t-2 border-[#151515] pt-10 lg:grid-cols-[220px_1fr_1fr] lg:gap-12">
        <Reveal>
          <p className="text-[15px] font-extrabold text-neutral-400">02</p>
          <h3 className="mt-1 text-3xl font-extrabold tracking-tight">Move</h3>
          <p className="mt-2 max-w-[26ch] text-[14px] font-medium leading-relaxed text-neutral-600">Stock in, stock out. Counted instantly.</p>
        </Reveal>
        <Reveal delay="st-d1" className="lg:col-span-2">
          <div className="flex flex-col items-center gap-5 rounded-[24px] bg-[#151515] p-6 text-white sm:flex-row sm:justify-around sm:p-8">
            <div className="flex items-center gap-5">
              <button type="button" onClick={() => move(-1)} aria-label="Decrease quantity" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 text-[22px] font-extrabold transition-transform hover:scale-105 active:scale-95">
                −
              </button>
              <span className="tnum min-w-[3ch] text-center text-6xl font-extrabold tracking-tight">{moveQty}</span>
              <button type="button" onClick={() => move(1)} aria-label="Increase quantity" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C7FF4D] text-[22px] font-extrabold text-[#151515] transition-transform hover:scale-105 active:scale-95">
                +
              </button>
            </div>
            <ul aria-label="Recorded movements" className="w-full max-w-[220px] space-y-1.5">
              {moveLog.map((l, i) => (
                <li key={`${l}-${i}`} className={`rounded-xl px-3 py-2 text-[13px] font-bold ${i === 0 ? 'bg-[#C7FF4D] text-[#151515]' : 'bg-white/10 text-white/70'}`}>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>

      {/* 03 TRUST */}
      <div className="mt-14 grid gap-8 border-t-2 border-[#151515] pt-10 lg:grid-cols-[220px_1fr_1fr] lg:gap-12">
        <Reveal>
          <p className="text-[15px] font-extrabold text-neutral-400">03</p>
          <h3 className="mt-1 text-3xl font-extrabold tracking-tight">Trust</h3>
          <p className="mt-2 max-w-[26ch] text-[14px] font-medium leading-relaxed text-neutral-600">Review stock movements and sync status.</p>
        </Reveal>
        <Reveal delay="st-d1" className="lg:col-span-2">
          <div className="rounded-[24px] border border-[#D9D9D0] bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-extrabold uppercase tracking-[0.16em]">History · today</p>
              <button
                type="button"
                role="switch"
                aria-checked={trustOn}
                aria-label="Toggle connection preview"
                onClick={() => setTrustOn((o) => !o)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${trustOn ? 'bg-[#151515]' : 'bg-neutral-300'}`}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${trustOn ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <div className="mt-3 space-y-1.5">
              {[
                ['+50', 'Basmati Rice · 09:41'],
                ['−2', 'Detergent Bar · 09:12'],
                ['+10', 'Sugar 1kg · 08:58'],
              ].map(([q, m]) => (
                <div key={m} className="flex items-center justify-between rounded-2xl bg-[#F7F7F2] px-3.5 py-2.5">
                  <span className={`tnum text-[15px] font-extrabold ${q.startsWith('+') ? 'text-[#1E7B3C]' : 'text-[#9A3C00]'}`}>{q}</span>
                  <span className="text-[12.5px] font-semibold text-neutral-500">{m}</span>
                </div>
              ))}
            </div>
            <p className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest ${trustOn ? 'bg-[#E7F7E4] text-[#1E7B3C]' : 'bg-[#FBEACB] text-[#9A5B00]'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${trustOn ? 'bg-[#1E7B3C]' : 'st-blink bg-[#9A5B00]'}`} />
              {trustOn ? 'Synced' : 'Waiting — kept on this phone'}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- store / download ---------------- */

function Store() {
  const [apk, setApk] = useState<'checking' | 'ready' | 'soon'>('checking');
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    fetch('stockly.apk', { method: 'HEAD' })
      .then((r) => {
        if (alive.current) setApk(r.ok ? 'ready' : 'soon');
      })
      .catch(() => {
        if (alive.current) setApk('soon');
      });
    return () => {
      alive.current = false;
    };
  }, []);

  return (
    <section id="store" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">Stockly store</p>
          <h2 className="mt-3 text-5xl font-extrabold leading-[1.0] tracking-tight sm:text-6xl">
            Take Stockly to the shop.
          </h2>
          <p className="mt-4 max-w-[38ch] text-[15px] font-medium leading-relaxed text-neutral-600">
            Free for small businesses. Use your Google Sheet as the shared database across devices.
          </p>
          <ul className="mt-6 space-y-2.5">
            {['Android phone or tablet', `Version ${APP_VERSION}`, 'No account needed'].map((t) => (
              <li key={t} className="flex items-center gap-3 text-[14px] font-bold">
                <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-[#151515] text-[12px] font-extrabold text-[#C7FF4D]">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay="st-d1">
          <div className="rounded-[28px] border border-[#D9D9D0] bg-white p-6 shadow-[0_30px_60px_-30px_rgba(21,21,21,0.35)] sm:p-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#151515]">
              <Logo size={30} light />
            </span>
            <p className="mt-4 text-[22px] font-extrabold tracking-tight">Stockly for Android</p>
            <p className="tnum mt-1 text-[13px] font-semibold text-neutral-500">v{APP_VERSION} · APK download</p>
            {apk === 'ready' ? (
              <a
                href="stockly.apk"
                download
                className="mt-6 block rounded-full bg-[#151515] py-4 text-center text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#C7FF4D] transition-transform hover:scale-[1.02] active:scale-95"
              >
                Download APK
              </a>
            ) : (
              <span
                aria-disabled="true"
                className={`mt-6 block rounded-full py-4 text-center text-[13px] font-extrabold uppercase tracking-[0.14em] ${
                  apk === 'checking' ? 'bg-[#EAEAE4] text-neutral-500' : 'bg-[#151515] text-white/60'
                }`}
              >
                {apk === 'checking' ? 'Checking…' : 'APK coming soon'}
              </span>
            )}
            <p className="mt-4 text-[12.5px] font-medium leading-relaxed text-neutral-500">
              {apk === 'ready'
                ? 'After downloading, open the file and allow “install unknown apps” once when asked.'
                : 'The install file isn’t published yet — check back soon. The app itself is ready to build from this project.'}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
