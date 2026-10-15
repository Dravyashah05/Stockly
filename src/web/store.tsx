/* Stockly App Store (/app-store → store.html) — minimal creative redesign.
 *
 * Minimal editorial launch page in the exact Stockly site language
 * (bg #F7F7F2, ink #151515, lime #C7FF4D). Short text, oversized type,
 * one real app screenshot, live GitHub release data only — no hardcoded
 * versions, no invented screenshots, no fake QR.
 */

import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import QRCode from 'react-qr-code';
import { ArrowDown, ArrowUpRight, Barcode, Package, ShieldCheck, Zap } from 'lucide-react';
import './site.css';
import { Logo, Reveal } from './visuals';
import { APP_VERSION } from '../shared/config';
import { fetchLatestRelease, fetchReleaseChecksum, fetchReleaseHistory, formatApkSize } from '../shared/releases';
import type { ReleaseInfo, ReleaseSummary } from '../shared/releases';
import settingsShot from './stockly-settings.png';

/** Stable public URL of this page — the single payload of the QR code. */
const STORE_URL = 'https://stocklybydns.vercel.app/store.html';

type LoadState =
  | { status: 'checking' }
  | { status: 'ready'; info: ReleaseInfo }
  | { status: 'error'; message: string };

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Strip release-notes markdown into plain display lines. */
function cleanNotes(notes: string[]): string[] {
  return notes
    .map((n) => n.replace(/^#{1,3}\s*/, '').replace(/^[-·*]\s*/, '').trim())
    .filter((n) => n !== '' && !/^what's new$/i.test(n) && !/^details$/i.test(n));
}

function isDetailLine(n: string): boolean {
  return /^(version|build|commit|note|signed with)\s*:/i.test(n);
}

function useCopyFeedback(timeoutMs = 2000): [boolean, string | null, () => void] {  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [
    copied,
    error,
    () => {
      setError(null);
      const done = () => {
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), timeoutMs);
      };
      const fail = () => setError('Copy failed — long-press the link to copy it.');
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(STORE_URL).then(done).catch(fail);
      } else {
        try {
          const ta = document.createElement('textarea');
          ta.value = STORE_URL;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          done();
        } catch {
          fail();
        }
      }
    },
  ];
}

/* App screen gallery. Each slide points at a real capture — today every
 * slide tours a genuine region of the Settings screenshot; when new app
 * screenshots land in src/web/, just add { img, kicker, caption } entries
 * below and the gallery, counter, and progress pick them up. Nothing here
 * is fabricated: every caption names something truly visible. */
interface TourSlide {
  img: string;
  scale: number;
  origin: string;
  kicker: string;
  caption: string;
  alt: string;
}

const TOUR_SLIDES: TourSlide[] = [
  {
    img: settingsShot,
    scale: 1,
    origin: '50% 0%',
    kicker: 'Settings',
    caption: 'Everything in one place.',
    alt: 'Stockly app on Android — real Settings screen',
  },
  {
    img: settingsShot,
    scale: 2.1,
    origin: '50% 20%',
    kicker: 'Cloud database',
    caption: 'Connected, on every device.',
    alt: 'Stockly app close-up — cloud database card showing connected state',
  },
  {
    img: settingsShot,
    scale: 2.1,
    origin: '50% 50%',
    kicker: 'Sync status',
    caption: 'Fresh data in one tap.',
    alt: 'Stockly app close-up — sync status card with Sync now button',
  },
  {
    img: settingsShot,
    scale: 2.1,
    origin: '50% 72%',
    kicker: 'Appearance',
    caption: 'Dark mode, done right.',
    alt: 'Stockly app close-up — appearance controls with Dark mode selected',
  },
  {
    img: settingsShot,
    scale: 2.1,
    origin: '50% 92%',
    kicker: 'Navigate',
    caption: 'Home, products, history.',
    alt: 'Stockly app close-up — bottom navigation bar',
  },
];

function ScreenTour() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const total = TOUR_SLIDES.length;
  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + total) % total);

  useEffect(() => {
    if (paused || reduceMotion) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % total), 5000);
    return () => window.clearInterval(t);
  }, [paused, total, reduceMotion]);

  const slide = TOUR_SLIDES[index];
  const num = String(index + 1).padStart(2, '0');
  return (
    <figure
      className="relative mx-auto w-full max-w-[340px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* gallery backdrop */}
      <span aria-hidden="true" className="tnum pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 select-none text-[7rem] font-extrabold leading-none tracking-tight text-[#EAEAE4]">
        {num}
      </span>
      <span aria-hidden="true" className="absolute left-1/2 top-24 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-[#C7FF4D]/50 blur-3xl" />
      <span aria-hidden="true" className="absolute -right-4 top-1/3 -z-10 h-28 w-28 rounded-full border-[10px] border-[#C7FF4D]" />

      {/* device */}
      <div className="relative -rotate-2 rounded-[48px] bg-[#151515] p-3 shadow-[0_60px_100px_-40px_rgba(21,21,21,0.6)] ring-1 ring-black transition-transform duration-500 hover:rotate-0">
        <div
          className="overflow-hidden rounded-[38px] bg-black"
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (dx < -40) go(1);
            else if (dx > 40) go(-1);
            touchX.current = null;
          }}
        >
          <img
            key={slide.img}
            src={slide.img}
            alt={slide.alt}
            className="block aspect-[9/19.5] w-full object-cover object-top"
            style={{
              transform: `scale(${slide.scale})`,
              transformOrigin: slide.origin,
              transition: reduceMotion ? 'none' : 'transform 0.9s cubic-bezier(0.22, 0.9, 0.3, 1)',
            }}
            loading="lazy"
          />
        </div>
        <span aria-hidden="true" className="absolute -left-1.5 top-24 h-10 w-1 rounded-full bg-[#C7FF4D]" />
        <span aria-hidden="true" className="absolute -right-1.5 top-28 h-14 w-1 rounded-full bg-white/25" />
      </div>

      {/* caption deck */}
      <div className="mt-8 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p aria-live="polite" className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-neutral-400">
            {slide.kicker} · {num} / {String(total).padStart(2, '0')}
          </p>
          <p aria-live="polite" className="mt-1.5 truncate text-[19px] font-extrabold tracking-tight" title={slide.caption}>
            {slide.caption}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous app view"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#151515] transition-all hover:bg-[#151515] hover:text-white active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5m0 0l6-6m-6 6l6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next app view"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#C7FF4D] text-[#151515] transition-transform hover:scale-105 active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14m0 0l-6-6m6 6l-6 6" />
            </svg>
          </button>
        </div>
      </div>
      {/* autoplay progress, in sync with the 5s interval */}
      <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-[#EAEAE4]" aria-hidden="true">
        {!reduceMotion && !paused ? (
          <div key={index} className="st-tour-bar h-full w-full bg-[#151515]" />
        ) : (
          <div className="h-full w-full bg-[#151515]" style={{ transform: `scaleX(${(index + 1) / total})`, transformOrigin: 'left center' }} />
        )}
      </div>
      <div className="mt-3 flex items-center gap-2" role="tablist" aria-label="App views">
        {TOUR_SLIDES.map((s, i) => (
          <button
            key={`${s.kicker}-${i}`}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Show: ${s.kicker} — ${s.caption}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? 'w-6 bg-[#151515]' : 'w-1.5 bg-[#D9D9D0] hover:bg-neutral-400'
            }`}
          />
        ))}
      </div>
      <figcaption className="sr-only">Real Stockly app screens.</figcaption>
    </figure>
  );
}

function StoreApp() {
  const [rel, setRel] = useState<LoadState>({ status: 'checking' });
  const [history, setHistory] = useState<ReleaseSummary[] | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [copied, copyError, copyLink] = useCopyFeedback();
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
    fetchReleaseHistory(20)
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

  useEffect(() => {
    if (rel.status !== 'ready') return;
    if (rel.info.sha256) {
      setSha(rel.info.sha256);
      return;
    }
    fetchReleaseChecksum(rel.info.tag)
      .then((digest) => {
        if (alive.current && digest) setSha(digest);
      })
      .catch(() => {
        /* checksum stays hidden — download still works */
      });
  }, [rel]);

  const info = rel.status === 'ready' ? rel.info : null;
  const prior = (history || []).filter((h) => h.tag !== info?.tag);
  const notes = info ? cleanNotes(info.releaseNotes).filter((n) => !isDetailLine(n)) : [];
  const versionLabel = info ? `v${info.version}` : `v${APP_VERSION}`;
  const sizeLabel = info && info.apkSize > 0 ? formatApkSize(info.apkSize) : '';
  const dateLabel = info && info.publishedAt ? fmtDate(info.publishedAt) : '';

  return (
    <div className="min-h-screen overflow-x-clip bg-[#F7F7F2] text-[#151515]">
      <a
        href="#download"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[#151515] focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to download
      </a>

      {/* ---------------- nav ---------------- */}
      <header className="sticky top-0 z-50 border-b border-[#D9D9D0] bg-[#F7F7F2]/90 backdrop-blur-md">
        <nav aria-label="Primary" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <a href="index.html" className="flex items-center gap-2.5" aria-label="Back to Stockly home">
            <Logo />
            <span className="text-[17px] font-extrabold tracking-tight">Stockly</span>
          </a>
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden items-center gap-6 md:flex">
              <a href="#download" className="text-[12px] font-bold uppercase tracking-[0.14em] text-neutral-500 transition-colors hover:text-[#151515]">
                Latest
              </a>
              <a href="#history" className="text-[12px] font-bold uppercase tracking-[0.14em] text-neutral-500 transition-colors hover:text-[#151515]">
                History
              </a>
              <a href="#install" className="text-[12px] font-bold uppercase tracking-[0.14em] text-neutral-500 transition-colors hover:text-[#151515]">
                Install
              </a>
            </div>
            <span className="hidden text-[12px] font-extrabold uppercase tracking-[0.14em] text-neutral-500 md:inline">
              App Store
            </span>
            <a
              href="#download"
              aria-label="Download app"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C7FF4D] text-[#151515] transition-transform hover:scale-105 active:scale-95"
            >
              <ArrowDown size={17} strokeWidth={2.5} aria-hidden="true" />
            </a>
          </div>
        </nav>
      </header>

      <main>
        {/* ---------------- hero ---------------- */}
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-2 lg:items-center lg:gap-8 lg:pb-28">
          <div>
            <p className="st-enter inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.28em] text-neutral-500">
              <span className="h-1.5 w-1.5 rounded-full bg-[#151515]" aria-hidden="true" />
              Official release
            </p>
            <h1
              className="st-enter mt-5 text-[17vw] font-extrabold leading-[0.95] tracking-tight sm:text-7xl lg:text-[5.5rem]"
              style={{ animationDelay: '0.08s' }}
            >
              Stock up.
              <br />
              Stay{' '}
              <span className="relative inline-block">
                ahead.
                <span aria-hidden="true" className="absolute -bottom-1 left-0 h-[6px] w-full rounded-full bg-[#C7FF4D]" />
              </span>
            </h1>
            <p className="st-enter mt-6 text-[17px] font-medium text-neutral-600" style={{ animationDelay: '0.16s' }}>
              Inventory management, in your pocket.
            </p>
            <div className="st-enter mt-8" style={{ animationDelay: '0.22s' }}>
              {info ? (
                <a
                  href={info.apkUrl}
                  className="inline-block rounded-full bg-[#C7FF4D] px-9 py-4 text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#151515] transition-transform hover:scale-[1.03] active:scale-95"
                >
                  Download for Android
                </a>
              ) : (
                <a
                  href="#download"
                  className="inline-block rounded-full bg-[#C7FF4D] px-9 py-4 text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#151515] transition-transform hover:scale-[1.03] active:scale-95"
                >
                  {rel.status === 'checking' ? 'Checking…' : 'Get the APK'}
                </a>
              )}
            </div>
            <p className="st-enter tnum mt-5 text-[12.5px] font-bold uppercase tracking-[0.16em] text-neutral-400" style={{ animationDelay: '0.28s' }}>
              {info ? (
                <>
                  {versionLabel}
                  {sizeLabel ? ` · ${sizeLabel}` : ''}
                  {dateLabel ? ` · ${dateLabel}` : ''}
                </>
              ) : rel.status === 'error' ? (
                rel.message
              ) : (
                'Checking the latest release…'
              )}
            </p>
          </div>

          {/* app preview — the centerpiece */}
          <Reveal delay="st-d1" className="relative">
            <div className="relative mx-auto w-full max-w-[320px]">
              <span aria-hidden="true" className="absolute -left-10 top-16 h-24 w-24 rounded-full bg-[#C7FF4D]/60 blur-2xl" />
              <div className="relative rounded-[48px] bg-[#151515] p-3 shadow-[0_50px_100px_-40px_rgba(21,21,21,0.55)] transition-transform duration-500 hover:-translate-y-1.5">
                <div className="overflow-hidden rounded-[36px]">
                  <img
                    src={settingsShot}
                    alt="Stockly app on Android — Settings screen with cloud connection, sync status and appearance controls"
                    className="block aspect-[9/19.5] w-full object-cover object-top"
                    loading="eager"
                  />
                </div>
              </div>
              <div className="st-float absolute -right-3 top-10 flex items-center gap-2.5 rounded-2xl bg-[#151515] py-3 pl-3.5 pr-5 text-white shadow-[0_18px_36px_-14px_rgba(21,21,21,0.55)] sm:-right-8">
                <span className="h-2 w-2 rounded-full bg-[#C7FF4D]" aria-hidden="true" />
                <span>
                  <span className="tnum block text-[15px] font-extrabold leading-none">{info ? versionLabel : `v${APP_VERSION}`}</span>
                  <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/50">Latest</span>
                </span>
              </div>
              <div className="absolute -bottom-5 -left-3 flex items-center gap-2 rounded-full border border-[#D9D9D0] bg-white/90 py-2 pl-3 pr-4 backdrop-blur sm:-left-8">
                <Logo size={18} />
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em]">Android · APK</span>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ---------------- latest release ---------------- */}
        <section id="download" className="scroll-mt-24 border-t border-[#D9D9D0]">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1fr_1fr] lg:items-center">
            <Reveal className="order-2 lg:order-1">
              <ScreenTour />
            </Reveal>

            <div className="order-1 lg:order-2">
              <Reveal>
                <p className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#151515]">
                    <Logo size={24} light />
                  </span>
                  <span className="text-[19px] font-extrabold tracking-tight">Stockly for Android</span>
                </p>
                <p className="tnum mt-6 text-7xl font-extrabold leading-none tracking-tight sm:text-8xl">
                  {info ? versionLabel : `v${APP_VERSION}`}
                </p>
                <p className="tnum mt-4 text-[13px] font-bold uppercase tracking-[0.18em] text-neutral-500">
                  {info ? (
                    <>
                      {dateLabel || 'Official build'}
                      {sizeLabel ? ` · ${sizeLabel}` : ''}
                    </>
                  ) : rel.status === 'error' ? (
                    rel.message
                  ) : (
                    'Checking the latest release…'
                  )}
                </p>
                {info ? (
                  <a
                    href={info.apkUrl}
                    className="mt-8 block rounded-full bg-[#151515] py-4 text-center text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#C7FF4D] transition-transform hover:scale-[1.02] active:scale-95"
                  >
                    Download APK{sizeLabel ? ` · ${sizeLabel}` : ''}
                  </a>
                ) : (
                  <span
                    aria-disabled="true"
                    className="mt-8 block rounded-full bg-[#EAEAE4] py-4 text-center text-[13px] font-extrabold uppercase tracking-[0.14em] text-neutral-500"
                  >
                    {rel.status === 'checking' ? 'Checking…' : 'APK coming soon'}
                  </span>
                )}
                <div className="mt-5 flex items-center gap-6">
                  {notes.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setNotesOpen((v) => !v)}
                      aria-expanded={notesOpen}
                      className="group inline-flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.16em] underline-offset-4 hover:underline"
                    >
                      Release notes
                      <ArrowUpRight size={15} strokeWidth={2.5} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </button>
                  ) : null}
                  {info?.releaseUrl ? (
                    <a
                      href={info.releaseUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.16em] text-neutral-400 underline-offset-4 transition-colors hover:text-[#151515] hover:underline"
                    >
                      GitHub
                      <ArrowUpRight size={15} strokeWidth={2.5} aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
                {notesOpen && notes.length > 0 ? (
                  <ul className="mt-4 space-y-2 border-t border-[#D9D9D0] pt-4">
                    {notes.slice(0, 8).map((n) => (
                      <li key={n} className="flex gap-2.5 text-[14px] font-medium leading-relaxed text-neutral-600">
                        <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#C7FF4D] ring-1 ring-[#151515]" />
                        {n}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="tnum mt-5 break-all text-[11.5px] font-semibold leading-relaxed text-neutral-400">
                  {sha ? (
                    <>SHA-256 · {sha}</>
                  ) : (
                    <>Checksum appears with the release.</>
                  )}
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ---------------- QR ---------------- */}
        <section aria-label="Get Stockly on your phone" className="border-t border-[#D9D9D0] bg-[#111210] text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-2">
            <Reveal>
              <h2 className="text-5xl font-extrabold leading-[1.0] tracking-tight sm:text-6xl">
                Your phone.
                <br />
                Your stock.
              </h2>
              <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.28em] text-[#C7FF4D]">
                Scan to get Stockly
              </p>
              <p className="mt-3 max-w-[32ch] text-[14px] font-medium leading-relaxed text-white/55">
                Point your camera. Open the store. Download the latest APK.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={copyLink}
                  className="rounded-full bg-[#C7FF4D] px-7 py-3.5 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#151515] transition-transform hover:scale-[1.03] active:scale-95"
                >
                  {copied ? 'Link copied ✓' : 'Copy link'}
                </button>
                <a
                  href={STORE_URL}
                  className="rounded-full border border-white/25 px-7 py-3.5 text-[12px] font-extrabold uppercase tracking-[0.14em] text-white transition-colors hover:bg-white/10"
                >
                  Open page
                </a>
              </div>
              <p aria-live="polite" className="sr-only">
                {copied ? 'Store download link copied to clipboard.' : ''}
              </p>
              {copyError ? (
                <p role="alert" className="mt-3 text-[13px] font-semibold text-[#C7FF4D]">
                  {copyError}
                </p>
              ) : null}
            </Reveal>
            <Reveal delay="st-d1" className="flex justify-center lg:justify-end">
              <div className="text-center">
                <span className="inline-block rounded-[28px] bg-white p-5 shadow-[0_30px_60px_-20px_rgba(199,255,77,0.25)]">
                  <QRCode value={STORE_URL} size={192} bgColor="#FFFFFF" fgColor="#151515" aria-label={`QR code linking to ${STORE_URL}`} />
                </span>
                <p className="tnum mt-4 text-[12px] font-semibold text-white/40">{STORE_URL.replace(/^https:\/\//, '')}</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------------- features ---------------- */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <h2 className="max-w-[12ch] text-5xl font-extrabold leading-[1.0] tracking-tight sm:text-6xl">
              Made for the shop floor.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-[#D9D9D0]">
            {[
              { icon: Package, t: 'Track stock', d: 'Every product, counted.' },
              { icon: Zap, t: 'Move faster', d: 'Stock in and out in seconds.' },
              { icon: ShieldCheck, t: 'Stay in control', d: 'One shared Sheet, always synced.' },
            ].map((f, i) => (
              <Reveal key={f.t} delay={i === 1 ? 'st-d1' : i === 2 ? 'st-d2' : ''} className="sm:px-10 sm:first:pl-0 sm:last:pr-0">
                <f.icon size={40} strokeWidth={1.5} aria-hidden="true" />
                <h3 className="mt-5 text-[13px] font-extrabold uppercase tracking-[0.22em]">{f.t}</h3>
                <p className="mt-2 text-[15px] font-medium text-neutral-600">{f.d}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------- history ---------------- */}
        <section id="history" className="scroll-mt-24 border-t border-[#D9D9D0]">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <Reveal>
              <h2 className="text-5xl font-extrabold leading-[1.0] tracking-tight sm:text-6xl">Releases.</h2>
            </Reveal>
            <Reveal delay="st-d1">
              <div className="mt-10">
                {history === null ? (
                  <p className="border-t-2 border-[#151515] pt-5 text-[14px] font-medium text-neutral-500">
                    Couldn’t load the release history.
                  </p>
                ) : info || prior.length > 0 ? (
                  <ol>
                    {info ? (
                      <li className="flex items-baseline gap-4 border-t-2 border-[#151515] py-5">
                        <span className="tnum text-3xl font-extrabold tracking-tight sm:text-4xl">v{info.version}</span>
                        <span className="rounded-full bg-[#C7FF4D] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em]">
                          Latest
                        </span>
                        <span className="tnum ml-auto hidden text-[13px] font-semibold text-neutral-500 sm:inline">
                          {dateLabel}
                          {sizeLabel ? ` · ${sizeLabel}` : ''}
                        </span>
                        <span className="ml-auto flex items-center gap-4 sm:ml-0">
                          <a href={info.apkUrl} aria-label={`Download v${info.version} APK`} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#151515] text-[#C7FF4D] transition-transform hover:scale-105 active:scale-95">
                            <ArrowDown size={16} strokeWidth={2.5} aria-hidden="true" />
                          </a>
                          {info.releaseUrl ? (
                            <a href={info.releaseUrl} target="_blank" rel="noreferrer" aria-label={`Release notes for v${info.version}`} className="text-neutral-400 transition-colors hover:text-[#151515]">
                              <ArrowUpRight size={18} strokeWidth={2.5} aria-hidden="true" />
                            </a>
                          ) : null}
                        </span>
                      </li>
                    ) : null}
                    {prior.slice(0, 6).map((h) => (
                      <li key={h.tag} className="flex items-baseline gap-4 border-t border-[#D9D9D0] py-4">
                        <span className="tnum text-xl font-extrabold tracking-tight text-neutral-400">v{h.version}</span>
                        <span className="tnum ml-auto hidden text-[13px] font-semibold text-neutral-400 sm:inline">
                          {fmtDate(h.publishedAt)}
                          {h.apkSize > 0 ? ` · ${formatApkSize(h.apkSize)}` : ''}
                        </span>
                        <span className="ml-auto flex items-center gap-4 sm:ml-0">
                          {h.apkUrl ? (
                            <a href={h.apkUrl} aria-label={`Download v${h.version} APK`} className="text-neutral-400 transition-colors hover:text-[#151515]">
                              <ArrowDown size={16} strokeWidth={2.5} aria-hidden="true" />
                            </a>
                          ) : null}
                          <a href={h.releaseUrl} target="_blank" rel="noreferrer" aria-label={`Release notes for v${h.version}`} className="text-neutral-400 transition-colors hover:text-[#151515]">
                            <ArrowUpRight size={18} strokeWidth={2.5} aria-hidden="true" />
                          </a>
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="border-t-2 border-[#151515] pt-5 text-[14px] font-medium text-neutral-500">
                    No releases published yet.
                  </p>
                )}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------------- install ---------------- */}
        <section id="install" className="scroll-mt-24 border-t border-[#D9D9D0]">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <Reveal>
              <h2 className="text-5xl font-extrabold leading-[1.0] tracking-tight sm:text-6xl">Three steps.</h2>
            </Reveal>
            <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-[#D9D9D0]">
              {[
                { n: '01', t: 'Download', d: 'Get the official APK.', icon: ArrowDown },
                { n: '02', t: 'Install', d: 'Allow install once, then open.', icon: Package },
                { n: '03', t: 'Get started', d: 'Connect your Sheet.', icon: Barcode },
              ].map((s, i) => (
                <Reveal key={s.n} delay={i === 1 ? 'st-d1' : i === 2 ? 'st-d2' : ''} className="sm:px-10 sm:first:pl-0 sm:last:pr-0">
                  <p className="tnum text-6xl font-extrabold tracking-tight text-[#D9D9D0]">{s.n}</p>
                  <p className="mt-3 flex items-center gap-2.5">
                    <s.icon size={20} strokeWidth={2} aria-hidden="true" />
                    <span className="text-[13px] font-extrabold uppercase tracking-[0.22em]">{s.t}</span>
                  </p>
                  <p className="mt-2 text-[15px] font-medium text-neutral-600">{s.d}</p>
                </Reveal>
              ))}
            </div>
            <Reveal>
              <p className="mt-12 max-w-[52ch] border-t border-[#D9D9D0] pt-5 text-[13px] font-medium leading-relaxed text-neutral-500">
                Android may ask permission to install from your browser. Install only official Stockly releases — from
                this page or the app’s updater. Direct APK, not Play Protect-certified.
              </p>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#D9D9D0] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <span className="flex items-center gap-2.5">
            <Logo />
            <span className="tnum text-[14px] font-extrabold tracking-tight">Stockly · v{APP_VERSION}</span>
          </span>
          <a href="index.html" className="text-[12px] font-bold uppercase tracking-[0.14em] text-neutral-500 transition-colors hover:text-[#151515]">
            Home
          </a>
        </div>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('store-root')!).render(
  <StrictMode>
    <StoreApp />
  </StrictMode>,
);
