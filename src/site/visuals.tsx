import { useEffect, useRef, useState } from 'react';

/* Original Stockly mark: three stacked bars forming an abstract S. */
export function Logo({ size = 26, light = false }: { size?: number; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="20" height="6" rx="3" fill={light ? '#C7FF4D' : '#151515'} />
      <rect x="9" y="13" width="20" height="6" rx="3" fill={light ? '#C7FF4D' : '#151515'} opacity="0.72" />
      <rect x="3" y="22" width="20" height="6" rx="3" fill="#C7FF4D" stroke={light ? '#C7FF4D' : '#151515'} strokeWidth="1.4" />
    </svg>
  );
}

/* Scroll-reveal wrapper. Fully visible under reduced motion. */
export function Reveal({
  children,
  className = '',
  delay = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: string;
  as?: 'div' | 'section' | 'span';
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-in');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          el.classList.add('is-in');
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as never} className={`st-reveal ${delay} ${className}`}>
      {children}
    </Tag>
  );
}

/* Observe visibility once — drives count-ups and step sequences. */
export function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

/* Eased count-up. Jumps to target under reduced motion. */
export function useCountUp(target: number, started: boolean, duration = 1300) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!started) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, target, duration]);
  return val;
}

/* Gentle scroll parallax for one element. Skipped under reduced motion. */
export function useParallax<T extends HTMLElement>(speed = 0.06) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const update = () => {
      const el = ref.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const offset = (window.innerHeight / 2 - (r.top + r.height / 2)) * speed;
        el.style.transform = `translateY(${offset.toFixed(1)}px)`;
      }
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [speed]);
  return ref;
}

/* ---------------- mock data (interface illustration only) ---------------- */

const ROWS = [
  { init: 'B', tint: '#E4EBFF', ink: '#2B4BD3', name: 'Basmati Rice 5kg', meta: 'GROCERIES · SKU-4821', qty: '142 in stock', ok: true },
  { init: 'C', tint: '#E7F7E4', ink: '#1E7B3C', name: 'Cold-Pressed Oil 1L', meta: 'BEVERAGES · SKU-1180', qty: '86 in stock', ok: true },
  { init: 'D', tint: '#FBEACB', ink: '#9A5B00', name: 'Detergent Bar 200g', meta: 'HOUSEHOLD · SKU-3390', qty: '4 · low', ok: false },
];

/* Floating dashboard composition for the hero. */
export function DashboardMock() {
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      {/* main panel */}
      <div className="st-enter relative z-10 rounded-[28px] border border-[#D9D9D0] bg-white p-5 shadow-[0_30px_60px_-30px_rgba(21,21,21,0.35)] sm:p-6" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#151515]">Stock overview</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#151515] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[#C7FF4D]">
            <span className="st-blink h-1.5 w-1.5 rounded-full bg-[#C7FF4D]" />
            Synced
          </span>
        </div>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[52px] font-extrabold leading-none tracking-tight sm:text-[64px]">1,248</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">Units · 36 products</p>
          </div>
          <svg width="120" height="48" viewBox="0 0 120 48" fill="none" aria-hidden="true" className="shrink-0">
            <path d="M2 40 L20 34 L38 36 L56 26 L74 28 L92 14 L118 10" stroke="#151515" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="118" cy="10" r="4" fill="#C7FF4D" stroke="#151515" strokeWidth="2" />
          </svg>
        </div>
        <div className="mt-4 border-t border-[#EAEAE4]">
          {ROWS.map((r) => (
            <div key={r.name} className="flex items-center gap-3 border-b border-[#EAEAE4] py-3 last:border-0">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[15px] font-extrabold"
                style={{ background: r.tint, color: r.ink }}
              >
                {r.init}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold">{r.name}</span>
                <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-neutral-500">{r.meta}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${r.ok ? 'bg-[#E7F7E4] text-[#1E7B3C]' : 'bg-[#FBEACB] text-[#9A5B00]'}`}>
                {r.qty}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* floating: low-stock alert */}
      <div
        className="st-enter st-float absolute -left-3 top-16 z-20 flex items-center gap-2.5 rounded-2xl border border-[#D9D9D0] bg-[#F7F7F2] px-3.5 py-3 shadow-[0_18px_36px_-18px_rgba(21,21,21,0.4)] sm:-left-10"
        style={{ animationDelay: '0.35s' }}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#151515] text-[13px] font-extrabold text-[#C7FF4D]">!</span>
        <span>
          <span className="block text-[12.5px] font-extrabold">Low stock</span>
          <span className="block text-[11.5px] font-medium text-neutral-500">Detergent · 4 left</span>
        </span>
      </div>

      {/* floating: movement toast */}
      <div
        className="st-enter st-float-2 absolute -bottom-6 right-2 z-20 flex items-center gap-2.5 rounded-2xl bg-[#151515] px-3.5 py-3 text-white shadow-[0_18px_36px_-14px_rgba(21,21,21,0.55)] sm:-right-6"
        style={{ animationDelay: '0.5s' }}
      >
        <span className="rounded-lg bg-[#C7FF4D] px-2 py-1 text-[12px] font-extrabold text-[#151515]">+50</span>
        <span>
          <span className="block text-[12.5px] font-extrabold">Stock in recorded</span>
          <span className="block text-[11.5px] font-medium text-white/60">Rice · just now</span>
        </span>
      </div>
    </div>
  );
}

/* Smartphone mockup running a compact Stockly interface. */
export function PhoneMock() {
  return (
    <div className="relative mx-auto w-[270px] rounded-[44px] border border-[#D9D9D0] bg-[#151515] p-2.5 shadow-[0_40px_80px_-40px_rgba(21,21,21,0.5)] sm:w-[300px]">
      <div className="overflow-hidden rounded-[34px] bg-[#F7F7F2]">
        <div className="flex justify-center pt-2.5">
          <span className="h-5 w-24 rounded-full bg-[#151515]" />
        </div>
        <div className="px-4 pb-4 pt-2">
          <p className="text-[15px] font-extrabold tracking-tight">Products</p>
          <p className="text-[10.5px] font-semibold text-neutral-500">20 items · synced 09:41</p>
          <div className="mt-2.5 rounded-2xl border border-[#EAEAE4] bg-white px-3 py-2.5 text-[11.5px] font-medium text-neutral-400">
            Search name, SKU…
          </div>
          <div className="mt-2.5 space-y-1.5">
            {[
              { i: 'A', t: '#E4EBFF', c: '#2B4BD3', n: 'AB Chain', s: '20 in stock', ok: true },
              { i: 'C', t: '#E7F7E4', c: '#1E7B3C', n: 'Crystal Beads', s: '20 in stock', ok: true },
              { i: 'G', t: '#FBEACB', c: '#9A5B00', n: 'Gold Chain', s: '3 · low', ok: false },
            ].map((p) => (
              <div key={p.n} className="flex items-center gap-2.5 rounded-2xl border border-[#EAEAE4] bg-white px-2.5 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold" style={{ background: p.t, color: p.c }}>
                  {p.i}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold">{p.n}</span>
                  <span className={`block text-[10.5px] font-bold ${p.ok ? 'text-[#1E7B3C]' : 'text-[#9A5B00]'}`}>{p.s}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 grid grid-cols-4 gap-1 rounded-2xl bg-white p-1.5 text-center text-[8.5px] font-extrabold text-neutral-400">
            {['Home', 'Items', 'Logs', 'More'].map((t, i) => (
              <span key={t} className={`rounded-xl py-1.5 ${i === 1 ? 'bg-[#151515] text-[#C7FF4D]' : ''}`}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
