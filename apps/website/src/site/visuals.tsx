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

/* Floating dashboard composition for the hero showcasing authentic app UI */
export function DashboardMock() {
  return (
    <div className="relative mx-auto w-full max-w-[480px]">
      {/* Background ambient glow */}
      <span aria-hidden="true" className="ambient-glow -top-12 -left-12 h-64 w-64 bg-[#C7FF4D]/35" />
      <span aria-hidden="true" className="ambient-glow -bottom-10 -right-10 h-72 w-72 bg-blue-500/20" />

      {/* Hero Smartphone Bezel showing real Overview screen */}
      <div className="phone-frame relative z-10 mx-auto max-w-[310px] transform hover:scale-[1.02] transition-transform duration-500">
        <div className="phone-screen shadow-2xl">
          <img
            src="/screenshots/screen-home.png"
            alt="Stockly Mobile App on Android with Apple iOS Liquid Glass UI"
            className="w-full h-full object-cover object-top block"
            loading="eager"
          />
        </div>
      </div>

      {/* Floating Card 1: Google Sheets Live Sync */}
      <div
        className="st-enter st-float absolute -left-4 top-20 z-20 flex items-center gap-2.5 rounded-2xl glass-surface px-4 py-3 sm:-left-12"
        style={{ animationDelay: '0.25s' }}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#151515] text-[#C7FF4D]">
          <span className="st-blink h-2 w-2 rounded-full bg-[#C7FF4D]" />
        </span>
        <div>
          <span className="block text-[13px] font-extrabold text-[#151515] dark:text-white">Sheets Live Sync</span>
          <span className="block text-[11px] font-medium text-neutral-500">2-way instant sync</span>
        </div>
      </div>

      {/* Floating Card 2: Stock In movement toast */}
      <div
        className="st-enter st-float-2 absolute -right-4 bottom-24 z-20 flex items-center gap-2.5 rounded-2xl bg-[#151515] px-4 py-3 text-white shadow-xl sm:-right-8"
        style={{ animationDelay: '0.45s' }}
      >
        <span className="rounded-xl bg-[#C7FF4D] px-2.5 py-1 text-[13px] font-black text-[#151515]">+50</span>
        <div>
          <span className="block text-[13px] font-extrabold text-white">Stock In Recorded</span>
          <span className="block text-[11px] font-medium text-neutral-400">Crystal Beads · ₹10</span>
        </div>
      </div>

      {/* Floating Card 3: Asset Valuation & Health Pill */}
      <div
        className="st-enter absolute -bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-full glass-surface px-5 py-2.5 shadow-lg whitespace-nowrap"
        style={{ animationDelay: '0.6s' }}
      >
        <span className="text-[12px] font-bold text-neutral-500">Stock Health:</span>
        <span className="text-[12px] font-extrabold text-emerald-600 dark:text-emerald-400">95% Optimal</span>
        <span className="h-3 w-px bg-neutral-300 dark:bg-neutral-700" />
        <span className="text-[12px] font-extrabold text-[#151515] dark:text-white">20 Products</span>
      </div>
    </div>
  );
}

/* Smartphone mockup showing authentic Inventory catalogue */
export function PhoneMock() {
  return (
    <div className="relative mx-auto max-w-[320px]">
      <span aria-hidden="true" className="ambient-glow top-1/4 left-1/4 h-56 w-56 bg-[#C7FF4D]/30" />
      <div className="phone-frame relative z-10 hover:-translate-y-2 transition-transform duration-500">
        <div className="phone-screen shadow-2xl">
          <img
            src="/screenshots/screen-inventory.png"
            alt="Stockly Real-time Inventory Catalog screen"
            className="w-full h-full object-cover object-top block"
            loading="lazy"
          />
        </div>
      </div>

      {/* Overlapping Sheet Preview badge */}
      <div className="absolute -bottom-4 -right-4 z-20 flex items-center gap-2 rounded-2xl bg-[#151515] px-4 py-2.5 text-white shadow-lg sm:-right-6">
        <span className="h-2 w-2 rounded-full bg-[#C7FF4D]" />
        <span className="text-[12px] font-extrabold uppercase tracking-wider text-white">Liquid Glass iOS UI</span>
      </div>
    </div>
  );
}
