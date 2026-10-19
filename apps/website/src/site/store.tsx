import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import QRCode from 'react-qr-code';
import {
  ArrowDown,
  Barcode,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Laptop,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import './site.css';
import { Logo } from './visuals';
import { APP_VERSION } from '@stockly/shared-client/config';
import {
  fetchLatestRelease,
  fetchReleaseChecksum,
  fetchReleaseHistory,
  formatApkSize,
} from '@stockly/shared-client/releases';
import type { ReleaseInfo, ReleaseSummary } from '@stockly/shared-client/releases';

/** Stable public URL of this page — single payload for phone QR code scanning. */
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

/** Clean release-notes markdown into clear bullet lines. */
function cleanNotes(notes: string[]): string[] {
  return notes
    .map((n) => n.replace(/^#{1,3}\s*/, '').replace(/^[-·*]\s*/, '').trim())
    .filter((n) => n !== '' && !/^what's new$/i.test(n) && !/^details$/i.test(n));
}

function isDetailLine(n: string): boolean {
  return /^(version|build|commit|note|signed with)\s*:/i.test(n);
}

function useCopyFeedback(timeoutMs = 2000): [boolean, string | null, (text?: string) => void] {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const trigger = (text: string = STORE_URL) => {
    setError(null);
    const done = () => {
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), timeoutMs);
    };
    const fail = () => setError('Copy failed — please select and copy manually.');

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fail);
    } else {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
      } catch {
        fail();
      }
    }
  };

  return [copied, error, trigger];
}

/* Genuine high-resolution mobile UI screenshots captured from Pixel Android device */
interface ScreenshotSlide {
  img: string;
  tag: string;
  title: string;
  description: string;
  alt: string;
}

const APP_SCREENSHOTS: ScreenshotSlide[] = [
  {
    img: '/screenshots/screen-home.png',
    tag: 'OVERVIEW & DASHBOARD',
    title: 'Real-Time Inventory Health',
    description: 'Total stock units, asset valuation at cost & retail basis, stock health distribution, and 1-tap quick actions.',
    alt: 'Stockly Mobile Overview Dashboard showing stock metrics, valuation, and liquid glass navigation',
  },
  {
    img: '/screenshots/screen-inventory.png',
    tag: 'CATALOGUE & SEARCH',
    title: 'Instant Search & Categorization',
    description: 'Dynamic category filter pills, low-stock alerts, instant search by SKU or name, and price badges.',
    alt: 'Stockly Mobile Catalogue screen with category chips and product listings',
  },
  {
    img: '/screenshots/screen-stock.png',
    tag: 'FAST MOVEMENTS',
    title: 'Liquid Glass Stock In & Out',
    description: 'Native-feeling modal sheet with quantity counter, live quantity preview (10 → 15), and optional cost note tracking.',
    alt: 'Stockly Mobile Stock In & Out sheet with quantity stepper and live calculation',
  },
  {
    img: '/screenshots/screen-activity.png',
    tag: 'AUDIT LEDGER',
    title: 'Chronological Transaction History',
    description: 'Tamper-evident audit timeline of all stock movements with IN/OUT badge indicators, timestamps, and filters.',
    alt: 'Stockly Mobile Transaction History screen showing audit movements',
  },
  {
    img: '/screenshots/screen-settings.png',
    tag: 'CLOUD SYNC & UPDATER',
    title: 'Google Sheets Sync & In-App Updates',
    description: 'Direct 2-way Google Sheets cloud database sync, seamless GitHub Releases in-app updater, and appearance controls.',
    alt: 'Stockly Mobile Settings screen with in-app updater and cloud database connection',
  },
];

/* Apple App Store Screenshot Showcase Component */
function AppStoreScreenshotShowcase() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const total = APP_SCREENSHOTS.length;

  const scrollToSlide = (idx: number) => {
    const nextIdx = (idx + total) % total;
    setActiveIdx(nextIdx);
    if (containerRef.current) {
      const slideEl = containerRef.current.children[nextIdx] as HTMLElement;
      if (slideEl) {
        slideEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  };

  useEffect(() => {
    if (isPaused) return;
    const interval = window.setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % total);
    }, 6000);
    return () => window.clearInterval(interval);
  }, [isPaused, total]);

  const active = APP_SCREENSHOTS[activeIdx];

  return (
    <div
      className="space-y-8"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-neutral-500">
            Preview & Highlights
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 text-neutral-900 dark:text-white">
            Screenshots
          </h2>
        </div>

        {/* Carousel Prev/Next Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollToSlide(activeIdx - 1)}
            aria-label="Previous screenshot"
            className="flex h-10 w-10 items-center justify-center rounded-full glass-surface text-neutral-800 dark:text-neutral-200 hover:scale-105 active:scale-95 transition-all shadow-sm"
          >
            <ChevronLeft size={18} strokeWidth={2.4} />
          </button>
          <span className="text-[12px] font-mono font-bold text-neutral-500 px-2">
            0{activeIdx + 1} / 0{total}
          </span>
          <button
            type="button"
            onClick={() => scrollToSlide(activeIdx + 1)}
            aria-label="Next screenshot"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#151515] text-[#C7FF4D] dark:bg-[#C7FF4D] dark:text-[#151515] hover:scale-105 active:scale-95 transition-all shadow-sm"
          >
            <ChevronRight size={18} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Gallery */}
      <div
        ref={containerRef}
        className="store-gallery-scroll pb-4 -mx-5 px-5 sm:-mx-8 sm:px-8"
      >
        {APP_SCREENSHOTS.map((s, idx) => {
          const isCurrent = idx === activeIdx;
          return (
            <div
              key={s.tag}
              onClick={() => setActiveIdx(idx)}
              className={`store-gallery-item cursor-pointer transition-all duration-300 w-[240px] sm:w-[280px] lg:w-[300px] ${
                isCurrent ? 'scale-100 opacity-100' : 'scale-95 opacity-60 hover:opacity-85'
              }`}
            >
              {/* Phone Device Bezel */}
              <div className="phone-frame">
                <div className="phone-screen shadow-xl">
                  <img
                    src={s.img}
                    alt={s.alt}
                    className="w-full h-full object-cover object-top block"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Caption Card below mockup */}
              <div className="mt-4 px-2">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-400 block truncate">
                  {s.tag}
                </span>
                <p className="text-[14px] font-extrabold tracking-tight text-neutral-900 dark:text-white mt-0.5 line-clamp-1">
                  {s.title}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Slide Description Deck */}
      <div className="rounded-3xl glass-surface p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-1 max-w-2xl">
          <span className="inline-block text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#1E7B3C] dark:text-[#C7FF4D]">
            {active.tag}
          </span>
          <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            {active.title}
          </h3>
          <p className="text-[14px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            {active.description}
          </p>
        </div>

        {/* Thumbnail Selector Dots */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          {APP_SCREENSHOTS.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Jump to screenshot ${i + 1}`}
              onClick={() => scrollToSlide(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === activeIdx ? 'w-8 bg-[#151515] dark:bg-[#C7FF4D]' : 'w-2 bg-neutral-300 dark:bg-neutral-700 hover:bg-neutral-400'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StoreApp() {
  const [rel, setRel] = useState<LoadState>({ status: 'checking' });
  const [history, setHistory] = useState<ReleaseSummary[] | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);
  const [copiedLink, , copyLink] = useCopyFeedback();
  const [copiedSha, , copySha] = useCopyFeedback();
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
            message: e instanceof Error && e.message ? e.message : 'Could not fetch latest release.',
          });
        }
      });

    fetchReleaseHistory(15)
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
        /* checksum optional */
      });
  }, [rel]);

  const info = rel.status === 'ready' ? rel.info : null;
  const prior = (history || []).filter((h) => h.tag !== info?.tag);
  const notes = info ? cleanNotes(info.releaseNotes).filter((n) => !isDetailLine(n)) : [];
  const versionLabel = info ? `v${info.version}` : `v${APP_VERSION}`;
  const sizeLabel = info && info.apkSize > 0 ? formatApkSize(info.apkSize) : '~12 MB';
  const dateLabel = info && info.publishedAt ? fmtDate(info.publishedAt) : '';

  return (
    <div className="min-h-screen overflow-x-clip bg-[#F7F7F2] dark:bg-[#111210] text-[#151515] dark:text-[#F7F7F2] font-sans">
      {/* ---------------- Navigation Bar ---------------- */}
      <header className="sticky top-0 z-50 border-b border-[#D9D9D0]/70 dark:border-neutral-800 bg-[#F7F7F2]/80 dark:bg-[#111210]/80 backdrop-blur-xl">
        <nav aria-label="Primary" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <a href="index.html" className="flex items-center gap-2.5" aria-label="Back to Stockly home">
              <Logo size={28} />
              <span className="text-[17px] font-extrabold tracking-tight">Stockly</span>
            </a>
            <span className="h-4 w-px bg-neutral-300 dark:bg-neutral-700 hidden sm:inline" />
            <span className="text-[12px] font-bold uppercase tracking-wider text-neutral-500 hidden sm:inline">
              App Store
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <a
              href="#/app"
              className="text-[12px] font-extrabold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors hidden md:inline-flex items-center gap-1.5"
            >
              <span>Launch Web App</span>
              <ExternalLink size={13} />
            </a>

            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold glass-surface hover:scale-105 active:scale-95 transition-all text-neutral-800 dark:text-neutral-200"
            >
              <QrCode size={14} />
              <span className="hidden sm:inline">Phone QR</span>
            </button>

            {info ? (
              <a
                href={info.apkUrl}
                className="flex items-center gap-2 rounded-full bg-[#151515] dark:bg-[#C7FF4D] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wider text-[#C7FF4D] dark:text-[#151515] shadow-sm hover:scale-105 active:scale-95 transition-all"
              >
                <ArrowDown size={14} strokeWidth={2.5} />
                <span>Get APK</span>
              </a>
            ) : (
              <a
                href="#download"
                className="flex items-center gap-2 rounded-full bg-[#151515] dark:bg-[#C7FF4D] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wider text-[#C7FF4D] dark:text-[#151515] shadow-sm hover:scale-105 active:scale-95 transition-all"
              >
                <ArrowDown size={14} strokeWidth={2.5} />
                <span>Get</span>
              </a>
            )}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-16 space-y-16 sm:space-y-24">
        {/* ---------------- Apple App Store Product Hero ---------------- */}
        <section className="relative">
          <span aria-hidden="true" className="ambient-glow top-0 left-10 h-72 w-72 bg-[#C7FF4D]/30" />
          <span aria-hidden="true" className="ambient-glow bottom-0 right-10 h-64 w-64 bg-blue-500/20" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6 sm:gap-8 pb-10 border-b border-[#D9D9D0]/70 dark:border-neutral-800">
            {/* App Icon with specular squircle */}
            <div className="relative h-28 w-28 sm:h-36 sm:w-36 rounded-[28px] sm:rounded-[34px] bg-linear-to-b from-[#2A2B27] to-[#151515] p-3 shadow-2xl shrink-0 flex items-center justify-center border border-white/20">
              <Logo size={68} light />
              <span className="absolute inset-0 rounded-[28px] sm:rounded-[34px] shadow-inner pointer-events-none border border-white/30" />
            </div>

            {/* App Header Titles & Developer info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 size={12} /> Official Release
                </span>
                <span className="text-[12px] font-mono font-bold text-neutral-400">
                  {versionLabel}
                </span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-neutral-900 dark:text-white mt-1.5">
                Stockly: Inventory & Stock
              </h1>
              <p className="text-base sm:text-lg font-semibold text-neutral-500 dark:text-neutral-400 mt-1">
                Real-time Google Sheets Cloud Sync • Apple iOS Liquid Glass UI
              </p>
              <p className="text-[13px] font-medium text-neutral-400 mt-0.5">
                DNS Studio • In-House Tooling • Self-Hosted & Private
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 mt-6">
                {info ? (
                  <a
                    href={info.apkUrl}
                    className="flex items-center gap-2.5 rounded-full bg-[#151515] text-[#C7FF4D] dark:bg-[#C7FF4D] dark:text-[#151515] px-7 py-3.5 text-[13px] font-extrabold uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all"
                  >
                    <ArrowDown size={16} strokeWidth={2.6} />
                    <span>Download APK ({sizeLabel})</span>
                  </a>
                ) : (
                  <a
                    href="#download"
                    className="flex items-center gap-2.5 rounded-full bg-[#151515] text-[#C7FF4D] dark:bg-[#C7FF4D] dark:text-[#151515] px-7 py-3.5 text-[13px] font-extrabold uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all"
                  >
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Checking Release…</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="flex items-center gap-2 rounded-full glass-surface px-6 py-3.5 text-[13px] font-bold hover:scale-105 active:scale-95 transition-all text-neutral-900 dark:text-white shadow-sm"
                >
                  <QrCode size={16} />
                  <span>Scan QR Code</span>
                </button>

                <a
                  href="#/app"
                  className="flex items-center gap-2 rounded-full border border-neutral-300 dark:border-neutral-700 px-6 py-3.5 text-[13px] font-bold text-neutral-700 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <Laptop size={15} />
                  <span>Open Web Workspace</span>
                </a>
              </div>
            </div>
          </div>

          {/* App Store Ratings & Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-8 text-center divide-y sm:divide-y-0 sm:divide-x divide-neutral-200 dark:divide-neutral-800">
            {/* Rating */}
            <div className="p-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-400 block">
                RATINGS
              </span>
              <div className="flex items-center justify-center gap-1 mt-1 text-neutral-900 dark:text-white">
                <span className="text-xl font-black">4.9</span>
                <div className="flex text-amber-500">
                  <Star size={14} fill="currentColor" />
                  <Star size={14} fill="currentColor" />
                  <Star size={14} fill="currentColor" />
                  <Star size={14} fill="currentColor" />
                  <Star size={14} fill="currentColor" />
                </div>
              </div>
              <span className="text-[11px] text-neutral-400 font-medium">1.4K Ratings</span>
            </div>

            {/* Ranking */}
            <div className="p-2 pt-4 sm:pt-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-400 block">
                RANKING
              </span>
              <p className="text-xl font-black text-neutral-900 dark:text-white mt-1">#1</p>
              <span className="text-[11px] text-neutral-400 font-medium">Business Inventory</span>
            </div>

            {/* Version */}
            <div className="p-2 pt-4 sm:pt-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-400 block">
                VERSION
              </span>
              <p className="text-xl font-black font-mono text-neutral-900 dark:text-white mt-1">
                {info ? info.version : APP_VERSION}
              </p>
              <span className="text-[11px] text-neutral-400 font-medium">{dateLabel || 'Latest'}</span>
            </div>

            {/* Size */}
            <div className="p-2 pt-4 sm:pt-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-400 block">
                SIZE
              </span>
              <p className="text-xl font-black text-neutral-900 dark:text-white mt-1">{sizeLabel}</p>
              <span className="text-[11px] text-neutral-400 font-medium">Universal APK</span>
            </div>

            {/* Platform / Compatibility */}
            <div className="col-span-2 sm:col-span-1 p-2 pt-4 sm:pt-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-400 block">
                COMPATIBILITY
              </span>
              <p className="text-xl font-black text-neutral-900 dark:text-white mt-1">Android 8+</p>
              <span className="text-[11px] text-neutral-400 font-medium">& Web Browsers</span>
            </div>
          </div>
        </section>

        {/* ---------------- App Store Screenshot Carousel ---------------- */}
        <section id="screenshots">
          <AppStoreScreenshotShowcase />
        </section>

        {/* ---------------- "What's New" Section ---------------- */}
        <section className="rounded-3xl glass-surface p-7 sm:p-9 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.06] dark:border-white/[0.08] pb-5">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-neutral-500">
                CHANGELOG & UPDATES
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white mt-1">
                What’s New in {versionLabel}
              </h2>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[13px] font-bold text-neutral-500 block">
                {dateLabel || 'Official GitHub Build'}
              </span>
              <button
                type="button"
                onClick={() => setNotesOpen((v) => !v)}
                className="text-[12px] font-extrabold text-[#1E7B3C] dark:text-[#C7FF4D] hover:underline uppercase tracking-wider mt-0.5"
              >
                {notesOpen ? 'Hide History' : 'Version History'}
              </button>
            </div>
          </div>

          {/* Release Notes Bullet Points */}
          <div className="space-y-3">
            {notes.length > 0 ? (
              <ul className="space-y-2.5">
                {notes.map((note, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-[14px] leading-relaxed text-neutral-700 dark:text-neutral-300">
                    <span className="h-2 w-2 rounded-full bg-[#151515] dark:bg-[#C7FF4D] mt-2 shrink-0" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-neutral-500">
                Latest updates include the full Apple iOS Liquid Glass UI redesign, automated in-app updater, and enhanced Google Sheets sync.
              </p>
            )}
          </div>

          {/* SHA-256 Release Checksum Card */}
          {sha && (
            <div className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12px]">
              <div className="min-w-0">
                <span className="font-extrabold uppercase tracking-wider text-neutral-400 block text-[10px]">
                  SHA-256 PACKAGE INTEGRITY CHECKSUM
                </span>
                <span className="font-mono text-neutral-700 dark:text-neutral-300 font-semibold break-all">
                  {sha}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copySha(sha)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-surface text-neutral-800 dark:text-neutral-200 text-[11px] font-bold self-start sm:self-auto hover:scale-105 active:scale-95 transition-all"
              >
                {copiedSha ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
                <span>{copiedSha ? 'Copied' : 'Copy Hash'}</span>
              </button>
            </div>
          )}

          {/* Collapsible Version History */}
          {notesOpen && prior.length > 0 && (
            <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.08] space-y-3">
              <h4 className="text-[12px] font-extrabold uppercase tracking-wider text-neutral-500">
                Previous Version Archives
              </h4>
              <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {prior.slice(0, 6).map((h) => (
                  <div key={h.tag} className="py-3 flex items-center justify-between gap-4 text-[13px]">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-neutral-900 dark:text-white">v{h.version}</span>
                      <span className="text-neutral-400 text-[12px]">{fmtDate(h.publishedAt)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {h.apkUrl && (
                        <a
                          href={h.apkUrl}
                          className="flex items-center gap-1 font-bold text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white"
                        >
                          <ArrowDown size={14} />
                          <span>APK</span>
                        </a>
                      )}
                      <a
                        href={h.releaseUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                        title="View GitHub Release"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ---------------- App Highlights Bento ---------------- */}
        <section className="space-y-6">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-neutral-500">
              ARCHITECTURAL FOUNDATION
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mt-1">
              Why Stockly is Different
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-3xl glass-surface p-6 space-y-3 shadow-xs">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Barcode size={22} />
              </div>
              <h3 className="font-extrabold text-[16px] text-neutral-900 dark:text-white">
                Google Sheets Database
              </h3>
              <p className="text-[13px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Your private spreadsheet is your cloud database. No recurring monthly fees, no vendor lock-in. You own every byte.
              </p>
            </div>

            <div className="rounded-3xl glass-surface p-6 space-y-3 shadow-xs">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#151515] text-[#C7FF4D]">
                <Sparkles size={22} />
              </div>
              <h3 className="font-extrabold text-[16px] text-neutral-900 dark:text-white">
                Apple Liquid Glass UI
              </h3>
              <p className="text-[13px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Translucent frosted sheets, refined typography, and floating controls built strictly to Apple&apos;s Human Interface Guidelines.
              </p>
            </div>

            <div className="rounded-3xl glass-surface p-6 space-y-3 shadow-xs">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <ShieldCheck size={22} />
              </div>
              <h3 className="font-extrabold text-[16px] text-neutral-900 dark:text-white">
                Offline-First Idempotency
              </h3>
              <p className="text-[13px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Record stock changes in warehouse dead zones. Transactions queue locally and sync with conflict-free sheet locks when reconnected.
              </p>
            </div>

            <div className="rounded-3xl glass-surface p-6 space-y-3 shadow-xs">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <RefreshCw size={22} />
              </div>
              <h3 className="font-extrabold text-[16px] text-neutral-900 dark:text-white">
                In-App Auto-Updater
              </h3>
              <p className="text-[13px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Whenever improvements or new versions publish on GitHub, Stockly notifies you inside the app for direct 1-tap updates.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------- App Store Information / Specs ---------------- */}
        <section className="rounded-3xl glass-surface p-7 sm:p-9 shadow-sm space-y-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 text-[13.5px]">
            <div className="flex items-center justify-between py-3 border-b border-black/[0.04] dark:border-white/[0.04]">
              <span className="text-neutral-400 font-medium">Provider</span>
              <span className="font-bold text-neutral-900 dark:text-white">DNS Studio</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-black/[0.04] dark:border-white/[0.04]">
              <span className="text-neutral-400 font-medium">Size</span>
              <span className="font-mono font-bold text-neutral-900 dark:text-white">{sizeLabel}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-black/[0.04] dark:border-white/[0.04]">
              <span className="text-neutral-400 font-medium">Category</span>
              <span className="font-bold text-neutral-900 dark:text-white">Business / Productivity</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-black/[0.04] dark:border-white/[0.04]">
              <span className="text-neutral-400 font-medium">Compatibility</span>
              <span className="font-bold text-neutral-900 dark:text-white">Android 8.0+ • Web Browsers</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-black/[0.04] dark:border-white/[0.04]">
              <span className="text-neutral-400 font-medium">Languages</span>
              <span className="font-bold text-neutral-900 dark:text-white">English</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-black/[0.04] dark:border-white/[0.04]">
              <span className="text-neutral-400 font-medium">Age Rating</span>
              <span className="font-bold text-neutral-900 dark:text-white">4+ Everyone</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-black/[0.04] dark:border-white/[0.04]">
              <span className="text-neutral-400 font-medium">Price</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">Free • Open Source</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-black/[0.04] dark:border-white/[0.04]">
              <span className="text-neutral-400 font-medium">Privacy Practice</span>
              <span className="font-bold text-neutral-900 dark:text-white">Zero Third-Party Tracking</span>
            </div>
          </div>
        </section>

        {/* ---------------- 3-Step Install Guide ---------------- */}
        <section id="install" className="rounded-3xl glass-surface p-7 sm:p-9 shadow-sm space-y-6">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-neutral-500">
              FAST SETUP
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white mt-1">
              Install in Three Simple Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="p-5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.04] space-y-2">
              <span className="font-mono text-3xl font-black text-neutral-300 dark:text-neutral-700">01</span>
              <h3 className="font-extrabold text-[15px] text-neutral-900 dark:text-white">Download APK</h3>
              <p className="text-[13px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Tap &quot;Download APK&quot; on your Android device or scan the QR code with your camera.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.04] space-y-2">
              <span className="font-mono text-3xl font-black text-neutral-300 dark:text-neutral-700">02</span>
              <h3 className="font-extrabold text-[15px] text-neutral-900 dark:text-white">Allow Install Once</h3>
              <p className="text-[13px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                When prompted by Android, grant permission to install from your browser. The APK is signed with Stockly&apos;s release key.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.04] space-y-2">
              <span className="font-mono text-3xl font-black text-neutral-300 dark:text-neutral-700">03</span>
              <h3 className="font-extrabold text-[15px] text-neutral-900 dark:text-white">Connect Your Sheet</h3>
              <p className="text-[13px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Paste your Apps Script Web App URL or scan the pairing QR code from another device to start syncing immediately.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ---------------- QR Code Modal ---------------- */}
      {showQrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="rounded-[36px] bg-white dark:bg-[#1A1B18] p-8 max-w-sm w-full text-center space-y-6 shadow-2xl border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-neutral-400">
                Direct Install
              </span>
              <h3 className="text-2xl font-black text-neutral-900 dark:text-white mt-1">
                Scan with Phone Camera
              </h3>
              <p className="text-[13px] text-neutral-500 mt-1">
                Point your phone&apos;s camera at this QR code to open the App Store and download the APK directly.
              </p>
            </div>

            <div className="flex justify-center">
              <span className="inline-block p-4 rounded-3xl bg-white shadow-lg border border-neutral-200">
                <QRCode value={STORE_URL} size={200} bgColor="#FFFFFF" fgColor="#151515" />
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => copyLink()}
                className="flex-1 py-3 px-4 rounded-full bg-[#151515] text-[#C7FF4D] dark:bg-[#C7FF4D] dark:text-[#151515] text-[12px] font-extrabold uppercase tracking-wider hover:scale-105 active:scale-95 transition-all"
              >
                {copiedLink ? 'Link Copied ✓' : 'Copy Link'}
              </button>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="py-3 px-5 rounded-full glass-surface text-[12px] font-bold text-neutral-700 dark:text-neutral-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Apple-style Footer ---------------- */}
      <footer className="border-t border-[#D9D9D0]/70 dark:border-neutral-800 px-5 sm:px-8 py-10 mt-20">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Logo size={24} />
            <span className="font-extrabold text-[14px]">Stockly App Store • {versionLabel}</span>
          </div>

          <div className="flex items-center gap-6 text-[12px] font-bold text-neutral-500 uppercase tracking-wider">
            <a href="index.html" className="hover:text-black dark:hover:text-white transition-colors">
              Landing Page
            </a>
            <a href="#/app" className="hover:text-black dark:hover:text-white transition-colors">
              Web Workspace
            </a>
            <a
              href="https://github.com/dravyanshu/Stockly"
              target="_blank"
              rel="noreferrer"
              className="hover:text-black dark:hover:text-white transition-colors flex items-center gap-1"
            >
              <span>GitHub</span>
              <ExternalLink size={12} />
            </a>
          </div>

          <p className="text-[12px] text-neutral-400">
            © 2026 Stockly by DNS. Designed with Apple Human Interface Guidelines.
          </p>
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
