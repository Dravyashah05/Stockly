/* Stockly App Store (/app-store → store.html) — editorial redesign.
 *
 * Premium download experience in the exact Stockly site language
 * (bg #F7F7F2, ink #151515, lime #C7FF4D, fine borders, extrabold
 * editorial type). All release data stays live from GitHub Releases
 * (see src/lib/releases.ts): no hardcoded versions, no invented
 * screenshots — the phone frame below shows a real app screen and the
 * QR code encodes the real public store URL.
 */

import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import QRCode from 'react-qr-code';
import './site.css';
import { Logo, Reveal } from './visuals';
import { APP_VERSION } from '../lib/config';
import { fetchLatestRelease, fetchReleaseChecksum, fetchReleaseHistory, formatApkSize } from '../lib/releases';
import type { ReleaseInfo, ReleaseSummary } from '../lib/releases';
import settingsShot from './stockly-settings.png';

/** Stable public URL of this page — the single payload of the QR code.
 *  Uses the canonical /app-store route (rewritten to store.html) so the
 *  code keeps pointing at the latest release after every publish. */
const STORE_URL = 'https://stocklybydns.vercel.app/app-store';

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

/** Group cleaned release-note lines for the §4 Features / Improvements /
 *  Bug Fixes card. Pure keyword classifier over live metadata only — when
 *  nothing matches a group, that group is omitted (never invented). */
export interface GroupedNotes {
  features: string[];
  improvements: string[];
  fixes: string[];
}

export function groupReleaseNotes(cleaned: string[]): GroupedNotes {
  const features: string[] = [];
  const improvements: string[] = [];
  const fixes: string[] = [];
  for (const n of cleaned) {
    if (isDetailLine(n)) continue;
    if (/\b(fix|fixes|fixed|bug|crash|resolve[sd]?|correct|patch)\b/i.test(n)) fixes.push(n);
    else if (
      /\b(improv|polish|faster|performance|refactor|replac|updat|validat|diagnos|workflow|pipeline|vercel|proxy|responsive|accessib|a11y)\b/i.test(
        n,
      )
    )
      improvements.push(n);
    else features.push(n);
  }
  return { features, improvements, fixes };
}

function useCopyFeedback(timeoutMs = 2000): [boolean, string | null, () => void] {
  const [copied, setCopied] = useState(false);
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
      const fail = () => {
        setError('Copy failed — long-press the link below to copy it manually.');
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setError(null), timeoutMs * 2);
      };
      const text = STORE_URL;
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
    },
  ];
}

function StoreApp() {
  const [rel, setRel] = useState<LoadState>({ status: 'checking' });
  const [history, setHistory] = useState<ReleaseSummary[] | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [allNotes, setAllNotes] = useState(false);
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
  const notes = info ? cleanNotes(info.releaseNotes) : [];
  const nonDetail = notes.filter((n) => !isDetailLine(n));
  const groupCount = nonDetail.length;
  const visibleNotes = allNotes ? nonDetail : nonDetail.slice(0, 4);
  const visibleGroups = groupReleaseNotes(visibleNotes);
  const groupedSections = (
    [
      ['Features', visibleGroups.features],
      ['Improvements', visibleGroups.improvements],
      ['Bug fixes', visibleGroups.fixes],
    ] as [string, string[]][]
  ).filter(([, items]) => items.length > 0);
  const detailLines = notes.filter((n) => isDetailLine(n));
  const extraHighlights = nonDetail.slice(4);
  const visiblePrior = showAll ? prior.slice(0, 10) : prior.slice(0, 4);
  const versionLabel = info ? `v${info.version}` : `v${APP_VERSION}`;
  const metaLine = info
    ? `${versionLabel}${info.versionCode > 0 ? ` (${info.versionCode})` : ''}${
        info.apkSize > 0 ? ` · ${formatApkSize(info.apkSize)}` : ''
      }${info.publishedAt ? ` · ${fmtDate(info.publishedAt)}` : ''}`
    : null;

  return (
    <div className="min-h-screen overflow-x-clip bg-[#F7F7F2] text-[#151515]">
      <a
        href="#download"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[#151515] focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to download
      </a>

      {/* ---------------- compact header ---------------- */}
      <header className="sticky top-0 z-50 border-b border-[#D9D9D0] bg-[#F7F7F2]/90 backdrop-blur-md">
        <nav aria-label="Primary" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <a href="index.html" className="flex items-center gap-2.5" aria-label="Back to Stockly home">
            <Logo />
            <span className="text-[17px] font-extrabold tracking-tight">Stockly</span>
          </a>
          <div className="flex items-center gap-5">
            <div className="hidden items-center gap-7 md:flex">
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
            <span className="hidden text-[12px] font-extrabold uppercase tracking-[0.14em] text-neutral-400 sm:inline" aria-hidden="true">
              ·
            </span>
            <span className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-neutral-500">App Store</span>
            <a
              href="#download"
              aria-label="Download app"
              title="Download app"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C7FF4D] text-[#151515] transition-transform hover:scale-105 active:scale-95"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5" />
                <path d="M4 20h16" />
              </svg>
            </a>
          </div>
        </nav>
      </header>

      <main>
        {/* ---------------- hero ---------------- */}
        <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-14 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14 lg:pb-20">
          <div>
            <p className="st-enter inline-block rounded-full border border-[#D9D9D0] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em]">
              Official Stockly releases
            </p>
            <h1
              className="st-enter mt-5 text-[13vw] font-extrabold leading-[0.98] tracking-tight sm:text-6xl lg:text-[4.6rem]"
              style={{ animationDelay: '0.08s' }}
            >
              Your inventory.
              <br />
              <span className="relative inline-block">
                Under control.
                <span aria-hidden="true" className="absolute -bottom-1 left-0 h-[5px] w-full rounded-full bg-[#C7FF4D]" />
              </span>
            </h1>
            <p className="st-enter mt-5 max-w-[42ch] text-[16px] font-medium leading-relaxed text-neutral-600" style={{ animationDelay: '0.16s' }}>
              Take Stockly with you. Manage products, track stock movements, and keep your inventory organized from
              your Android device.
            </p>
            <p className="st-enter mt-5" style={{ animationDelay: '0.2s' }}>
              <span className="tnum inline-flex items-center gap-2 rounded-full bg-[#151515] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#C7FF4D]">
                <span className={`h-1.5 w-1.5 rounded-full ${info ? 'bg-[#C7FF4D]' : 'st-blink bg-[#C7FF4D]'}`} aria-hidden="true" />
                {info ? `Latest · ${metaLine}` : rel.status === 'error' ? rel.message : 'Checking the latest release…'}
              </span>
            </p>
            <div className="st-enter mt-7 flex flex-wrap gap-3" style={{ animationDelay: '0.24s' }}>
              {info ? (
                <a
                  href={info.apkUrl}
                  className="rounded-full bg-[#151515] px-7 py-3.5 text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#C7FF4D] transition-transform hover:scale-[1.03] active:scale-95"
                >
                  Download for Android
                </a>
              ) : (
                <a
                  href="#download"
                  className="rounded-full bg-[#151515] px-7 py-3.5 text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#C7FF4D] transition-transform hover:scale-[1.03] active:scale-95"
                >
                  {rel.status === 'checking' ? 'Checking…' : 'Get the APK'}
                </a>
              )}
              <a
                href="#release-notes"
                className="rounded-full border border-[#151515] px-7 py-3.5 text-[13px] font-extrabold uppercase tracking-[0.14em] transition-colors hover:bg-[#151515] hover:text-white"
              >
                View release notes
              </a>
            </div>
            <dl className="st-enter mt-9 flex gap-8 border-t border-[#D9D9D0] pt-5" style={{ animationDelay: '0.3s' }}>
              {[
                ['Android', 'APK direct'],
                [info && info.apkSize > 0 ? formatApkSize(info.apkSize) : 'Light', 'Download size'],
                [info ? fmtDate(info.publishedAt) || 'Official' : 'Official', 'Signed build'],
              ].map(([v, k]) => (
                <div key={k}>
                  <dt className="text-[10.5px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">{k}</dt>
                  <dd className="tnum mt-0.5 text-[16px] font-extrabold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* editorial release ticket — brand-derived, no invented UI */}
          <Reveal delay="st-d1" className="lg:pl-4">
            <div className="relative mx-auto w-full max-w-[420px]">
              <div className="overflow-hidden rounded-[28px] bg-[#151515] text-white shadow-[0_30px_60px_-30px_rgba(21,21,21,0.5)]">
                <div className="flex items-center justify-between px-6 pt-5">
                  <p className="inline-flex items-center gap-2 text-[10.5px] font-extrabold uppercase tracking-[0.22em] text-white/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#C7FF4D]" aria-hidden="true" />
                    Official release
                  </p>
                  <span className="rounded-full bg-[#C7FF4D] px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-widest text-[#151515]">
                    APK
                  </span>
                </div>
                <div className="px-6 pb-2 pt-4">
                  <p className="text-[15px] font-bold text-white/70">Stockly for Android</p>
                  <p className="tnum mt-1 text-[64px] font-extrabold leading-none tracking-tight text-white sm:text-[76px]">
                    {info ? `v${info.version}` : versionLabel}
                  </p>
                </div>
                <div aria-hidden="true" className="mx-6 my-4 border-t-2 border-dashed border-white/20" />
                <dl className="grid grid-cols-3 gap-3 px-6 pb-6">
                  {[
                    ['Updated', info && info.publishedAt ? fmtDate(info.publishedAt) : '—'],
                    ['Size', info && info.apkSize > 0 ? formatApkSize(info.apkSize) : '—'],
                    ['Build', info ? info.build : '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-2xl bg-white/[0.07] px-3 py-2.5">
                      <dt className="text-[9.5px] font-extrabold uppercase tracking-[0.2em] text-white/50">{k}</dt>
                      <dd className="tnum mt-0.5 truncate text-[14px] font-extrabold text-[#C7FF4D]">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="st-float absolute -right-2 -top-4 hidden items-center gap-2 rounded-2xl border border-[#D9D9D0] bg-white px-3.5 py-2.5 shadow-[0_18px_36px_-18px_rgba(21,21,21,0.4)] sm:flex">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#151515]">
                  <Logo size={20} light />
                </span>
                <span className="text-[12px] font-extrabold">Same Sheet, every device</span>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ---------------- latest release ---------------- */}
        <section id="download" className="mx-auto max-w-6xl scroll-mt-24 px-5 pb-4 sm:px-8">
          <Reveal>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">01 · Latest release</p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4 border-t-2 border-[#151515] pt-5">
              <h2 className="max-w-[14ch] text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
                Straight from the source.
              </h2>
              {info ? (
                <span className="rounded-full border border-[#151515] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em]">
                  Latest · {versionLabel}
                </span>
              ) : null}
            </div>
          </Reveal>

          <div className="mt-8 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            {/* left: release details */}
            <Reveal delay="st-d1">
              <div className="flex items-center gap-4">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-[#151515]">
                  <Logo size={34} light />
                </span>
                <div className="min-w-0">
                  <p className="text-[24px] font-extrabold tracking-tight">Stockly for Android</p>
                  <p className="tnum mt-0.5 text-[13px] font-semibold text-neutral-500">
                    {info
                      ? metaLine
                      : rel.status === 'error'
                        ? rel.message
                        : 'Checking the latest release…'}
                  </p>
                </div>
              </div>

              {groupCount > 0 ? (
                <div id="release-notes" className="mt-6 scroll-mt-28">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-neutral-500">What’s new</p>
                  {groupedSections.map(([label, items]) => (
                    <div key={label} className="mt-3">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-neutral-400">{label}</p>
                      <ul className="mt-1.5 space-y-2">
                        {items.map((n) => (
                          <li key={`${label}-${n}`} className="flex gap-2.5 text-[14.5px] font-medium leading-relaxed text-neutral-700">
                            <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#151515]" />
                            {n}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {extraHighlights.length > 0 ? (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setAllNotes((v) => !v)}
                        aria-expanded={allNotes}
                        className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-neutral-500 underline-offset-4 transition-colors hover:text-[#151515] hover:underline"
                      >
                        {allNotes ? 'Show fewer notes −' : `All ${nonDetail.length} notes +`}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : info ? (
                <div id="release-notes" className="mt-6 scroll-mt-28">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-neutral-500">What’s new</p>
                  <p className="mt-2 text-[14px] font-medium text-neutral-500">
                    {info.releaseUrl ? (
                      <>
                        Release notes for this version live on the{' '}
                        <a href={info.releaseUrl} target="_blank" rel="noreferrer" className="font-bold text-[#151515] underline underline-offset-4">
                          official GitHub release
                        </a>
                        .
                      </>
                    ) : (
                      'No release notes published for this version yet.'
                    )}
                  </p>
                </div>
              ) : null}

              {info ? (
                <a
                  href={info.apkUrl}
                  className="mt-7 block rounded-full bg-[#151515] py-4 text-center text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#C7FF4D] transition-transform hover:scale-[1.02] active:scale-95"
                >
                  Download APK{info.apkSize > 0 ? ` · ${formatApkSize(info.apkSize)}` : ''}
                </a>
              ) : (
                <span
                  aria-disabled="true"
                  className={`mt-7 block rounded-full py-4 text-center text-[13px] font-extrabold uppercase tracking-[0.14em] ${
                    rel.status === 'checking' ? 'bg-[#EAEAE4] text-neutral-500' : 'bg-[#151515] text-white/60'
                  }`}
                >
                  {rel.status === 'checking' ? 'Checking…' : 'APK coming soon'}
                </span>
              )}

              <dl className="mt-7 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
                {[
                  ['Version', info ? `${versionLabel}${info.versionCode > 0 ? ` · code ${info.versionCode}` : ''}` : '—'],
                  ['Released', info && info.publishedAt ? fmtDate(info.publishedAt) : '—'],
                  ['File size', info && info.apkSize > 0 ? formatApkSize(info.apkSize) : '—'],
                  ['Platform', 'Android'],
                  ['Build', info ? `${info.build}-signed` : '—'],
                  ['Source', info ? (info.source === 'release.json' ? 'release.json' : 'GitHub assets') : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="border-t border-[#D9D9D0] py-3">
                    <dt className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">{k}</dt>
                    <dd className="tnum mt-1 truncate text-[14px] font-extrabold" title={v}>
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[#D9D9D0] pt-4">
                {info?.releaseUrl ? (
                  <a
                    href={info.releaseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] font-extrabold uppercase tracking-[0.14em] underline-offset-4 hover:underline"
                  >
                    Official GitHub release →
                  </a>
                ) : null}
                {rel.status === 'error' ? (
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-neutral-500 underline-offset-4 hover:text-[#151515] hover:underline"
                  >
                    Retry
                  </button>
                ) : null}
              </div>

              <div className="mt-4">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-neutral-500">Verify</p>
                {sha ? (
                  <p className="tnum mt-2 break-all rounded-2xl border border-[#D9D9D0] bg-white px-3.5 py-3 text-[11.5px] font-semibold leading-relaxed text-neutral-600">
                    SHA-256 · {sha}
                  </p>
                ) : (
                  <p className="mt-2 text-[13px] font-medium text-neutral-500">
                    {info ? 'Checksum file not published for this release.' : 'Checksum appears with the release.'}
                  </p>
                )}
              </div>
            </Reveal>

            {/* right: real screenshot + QR */}
            <div className="space-y-6">
              <Reveal delay="st-d2">
                <figure className="mx-auto w-full max-w-[300px]">
                  <div className="rounded-[44px] border border-[#D9D9D0] bg-[#151515] p-2.5 shadow-[0_40px_80px_-40px_rgba(21,21,21,0.5)]">
                    <div className="overflow-hidden rounded-[34px]">
                      <img
                        src={settingsShot}
                        alt="Stockly app on Android — Settings screen with cloud connection, sync status and appearance controls"
                        className="block aspect-[9/19.5] w-full object-cover object-top"
                        loading="lazy"
                      />
                    </div>
                  </div>
                  <figcaption className="mt-3 text-center text-[12px] font-semibold text-neutral-500">
                    Real app screen · Settings, dark mode
                  </figcaption>
                </figure>
              </Reveal>

              <Reveal delay="st-d2">
                <aside aria-label="Download on another device" className="st-darkzone overflow-hidden rounded-[28px] bg-[#111210] p-6 text-white sm:p-7">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#C7FF4D]">Download on another device</p>
                  <h3 className="mt-2 text-2xl font-extrabold tracking-tight">Scan with your phone</h3>
                  <p className="mt-1.5 text-[13.5px] font-medium leading-relaxed text-white/65">
                    Point your Android camera at the code to open this App Store page and grab the latest release.
                  </p>
                  <div className="mt-5 flex justify-center">
                    <span className="inline-block rounded-2xl bg-white p-3.5">
                      <QRCode value={STORE_URL} size={168} bgColor="#FFFFFF" fgColor="#151515" aria-label={`QR code linking to ${STORE_URL}`} />
                    </span>
                  </div>
                  <p className="tnum mt-4 truncate text-center text-[12px] font-semibold text-white/50" title={STORE_URL}>
                    {STORE_URL.replace(/^https:\/\//, '')}
                  </p>
                  <p className="mt-2 text-center text-[12px] font-medium text-white/45">
                    The APK is for Android devices.
                  </p>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="mt-3 block w-full rounded-full bg-[#C7FF4D] py-3.5 text-center text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#151515] transition-transform hover:scale-[1.02] active:scale-95"
                  >
                    {copied ? 'Download link copied ✓' : 'Copy download link'}
                  </button>
                  <p aria-live="polite" className="sr-only">
                    {copied ? 'Store download link copied to clipboard.' : ''}
                  </p>
                  {copyError ? (
                    <p role="alert" className="mt-2 text-center text-[12.5px] font-semibold text-[#C7FF4D]">
                      {copyError}
                    </p>
                  ) : null}
                  <a
                    href={STORE_URL}
                    className="mt-3 block w-full rounded-full border border-white/25 py-3.5 text-center text-[12px] font-extrabold uppercase tracking-[0.14em] text-white transition-colors hover:bg-white/10"
                  >
                    Open download page
                  </a>
                </aside>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ---------------- why install ---------------- */}
        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
          <Reveal>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">02 · Why install</p>
            <h2 className="mt-3 max-w-[16ch] text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
              The shop floor, in your pocket.
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-8 border-t-2 border-[#151515] pt-8 sm:grid-cols-3 sm:pt-10">
            {[
              {
                t: 'Official builds',
                d: 'Every APK is published automatically from the Stockly source, with a SHA-256 checksum to verify.',
                icon: (
                  <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z M9.5 12l2 2 3.5-4" />
                ),
              },
              {
                t: 'One shared Sheet',
                d: 'Your Google Sheet stays the database — every device reads and writes the same inventory.',
                icon: (
                  <path d="M4 5h16v14H4z M4 10h16 M10 10v9" />
                ),
              },
              {
                t: 'Painless updates',
                d: 'New releases install over the existing app, keeping your data and connection intact.',
                icon: (
                  <path d="M20 12a8 8 0 1 1-2.3-5.6 M20 3v4h-4" />
                ),
              },
            ].map((f, i) => (
              <Reveal key={f.t} delay={i === 1 ? 'st-d1' : i === 2 ? 'st-d2' : ''}>
                <p className="text-[13px] font-extrabold text-neutral-400">0{i + 1}</p>
                <span className="mt-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#151515] text-[#C7FF4D]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {f.icon}
                  </svg>
                </span>
                <h3 className="mt-3 text-xl font-extrabold tracking-tight">{f.t}</h3>
                <p className="mt-1.5 max-w-[30ch] text-[14px] font-medium leading-relaxed text-neutral-600">{f.d}</p>
              </Reveal>
            ))}
          </div>
          {detailLines.length > 0 ? (
            <Reveal>
              <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-2 border-t border-[#D9D9D0] pt-4">
                {detailLines.map((n) => {
                  const [k, ...rest] = n.split(':');
                  return (
                    <div key={n} className="flex gap-2 text-[12.5px]">
                      <dt className="font-extrabold uppercase tracking-[0.14em] text-neutral-400">{k}</dt>
                      <dd className="tnum font-semibold text-neutral-600">{rest.join(':').trim()}</dd>
                    </div>
                  );
                })}
              </dl>
            </Reveal>
          ) : null}
        </section>

        {/* ---------------- version history ---------------- */}
        <section id="history" className="mx-auto max-w-6xl scroll-mt-24 px-5 pb-4 sm:px-8">
          <Reveal>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">03 · Version history</p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4 border-t-2 border-[#151515] pt-5">
              <h2 className="max-w-[14ch] text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
                Every release, on record.
              </h2>
              <p className="max-w-[30ch] text-[13.5px] font-medium leading-relaxed text-neutral-500">
                Read straight from official GitHub releases — nothing hardcoded.
              </p>
            </div>
          </Reveal>
          <Reveal delay="st-d1">
            <div className="mt-8">
              {history === null ? (
                <p className="rounded-[24px] border border-[#D9D9D0] bg-white px-5 py-6 text-[14px] font-medium text-neutral-500">
                  Couldn’t load the release history.
                </p>
              ) : prior.length === 0 && !info ? (
                <p className="rounded-[24px] border border-[#D9D9D0] bg-white px-5 py-6 text-[14px] font-medium text-neutral-500">
                  No releases published yet.
                </p>
              ) : (
                <>
                  <ol className="overflow-hidden rounded-[24px] border border-[#D9D9D0] bg-white">
                    {info ? (
                      <li className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b-2 border-[#151515] bg-[#F7F7F2] px-5 py-4">
                        <a href={info.releaseUrl || '#download'} target={info.releaseUrl ? '_blank' : undefined} rel="noreferrer" className="text-[16px] font-extrabold underline-offset-4 hover:underline">
                          v{info.version}
                        </a>
                        <span className="rounded-full bg-[#151515] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[#C7FF4D]">
                          Latest
                        </span>
                        <span className="tnum text-[12.5px] font-semibold text-neutral-500">
                          {fmtDate(info.publishedAt)}{info.apkSize > 0 ? ` · ${formatApkSize(info.apkSize)}` : ''}
                        </span>
                        <span className="ml-auto flex items-center gap-4">
                          <a href={info.apkUrl} className="rounded-full bg-[#151515] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#C7FF4D] transition-transform hover:scale-105 active:scale-95">
                            APK
                          </a>
                          {info.releaseUrl ? (
                            <a href={info.releaseUrl} target="_blank" rel="noreferrer" className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-neutral-500 underline-offset-4 hover:text-[#151515] hover:underline">
                              Notes
                            </a>
                          ) : null}
                        </span>
                      </li>
                    ) : null}
                    {visiblePrior.map((h, i) => (
                      <li key={h.tag} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 ${i < visiblePrior.length - 1 ? 'border-b border-[#EAEAE4]' : ''}`}>
                        <span className="w-6 text-[12px] font-extrabold text-neutral-300">{String(i + 1).padStart(2, '0')}</span>
                        <a href={h.releaseUrl} target="_blank" rel="noreferrer" className="text-[15px] font-extrabold underline-offset-4 hover:underline">
                          v{h.version}
                        </a>
                        <span className="tnum text-[12.5px] font-semibold text-neutral-500">
                          {fmtDate(h.publishedAt)}{h.apkSize > 0 ? ` · ${formatApkSize(h.apkSize)}` : ''}
                        </span>
                        <span className="ml-auto flex items-center gap-4">
                          {h.apkUrl ? (
                            <a href={h.apkUrl} className="text-[12px] font-extrabold uppercase tracking-[0.14em] underline-offset-4 hover:underline">
                              APK
                            </a>
                          ) : (
                            <span className="text-[12px] font-semibold text-neutral-400">No APK</span>
                          )}
                          <a href={h.releaseUrl} target="_blank" rel="noreferrer" className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-neutral-500 underline-offset-4 hover:text-[#151515] hover:underline">
                            Notes
                          </a>
                        </span>
                      </li>
                    ))}
                    {prior.length === 0 ? (
                      <li className="px-5 py-4 text-[13.5px] font-medium text-neutral-500">
                        This is the first published release.
                      </li>
                    ) : null}
                  </ol>
                  {prior.length > 4 ? (
                    <button
                      type="button"
                      onClick={() => setShowAll((v) => !v)}
                      aria-expanded={showAll}
                      className="mt-4 w-full rounded-full border border-[#151515] py-3.5 text-[12px] font-extrabold uppercase tracking-[0.14em] transition-colors hover:bg-[#151515] hover:text-white"
                    >
                      {showAll ? 'Show fewer releases −' : `Show all ${Math.min(prior.length, 10)} releases +`}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </Reveal>
        </section>

        {/* ---------------- install + trust ---------------- */}
        <section id="install" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-14 sm:px-8 sm:py-20">
          <Reveal>
            <div className="overflow-hidden rounded-[28px] border border-[#D9D9D0] bg-white">
              <div className="grid gap-0 md:grid-cols-[1fr_1fr]">
                <div className="p-6 sm:p-9">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">04 · Install in minutes</p>
                  <h2 className="mt-3 text-3xl font-extrabold leading-[1.02] tracking-tight sm:text-4xl">
                    Three steps to Stockly.
                  </h2>
                  <ol className="mt-7 space-y-0">
                    {[
                      ['Download the official APK', info ? `Get ${versionLabel} from this page — free, no account needed.` : 'Get the latest APK from this page — free, no account needed.'],
                      ['Open the downloaded file', 'Follow Android’s installation prompts, allowing “install unknown apps” once when asked.'],
                      ['Open Stockly', 'Connect your Google Sheet and start managing inventory.'],
                    ].map(([t, d], i) => (
                      <li key={t} className="flex gap-4 border-t border-[#EAEAE4] py-4 first:border-t-2 first:border-[#151515]">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#151515] text-[13px] font-extrabold text-[#C7FF4D]">
                          {i + 1}
                        </span>
                        <span>
                          <span className="block text-[15.5px] font-extrabold">{t}</span>
                          <span className="mt-0.5 block max-w-[36ch] text-[13.5px] font-medium leading-relaxed text-neutral-600">{d}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="st-darkzone bg-[#111210] p-6 text-white sm:p-9">
                  <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#C7FF4D]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
                    </svg>
                    A note on safety
                  </p>
                  <p className="mt-3 max-w-[38ch] text-[14.5px] font-medium leading-relaxed text-white/75">
                    Install only official releases — from this page or the app’s built-in updater. Only accept
                    updates carrying Stockly’s official release signature.
                  </p>
                  {sha ? (
                    <p className="tnum mt-4 break-all rounded-2xl bg-white/[0.07] px-3.5 py-3 text-[11.5px] font-semibold leading-relaxed text-white/70">
                      SHA-256 · {sha}
                    </p>
                  ) : null}
                  <p className="mt-4 text-[12.5px] font-medium leading-relaxed text-white/45">
                    Stockly is distributed as a direct APK download and is not Play Protect-certified. Verification
                    details live on each official GitHub release page.
                  </p>
                  {info ? (
                    <a
                      href={info.apkUrl}
                      className="mt-6 block rounded-full bg-[#C7FF4D] py-4 text-center text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#151515] transition-transform hover:scale-[1.02] active:scale-95"
                    >
                      Download APK
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-[#D9D9D0] px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2.5">
            <Logo />
            <span className="text-[15px] font-extrabold tracking-tight">Stockly · v{APP_VERSION}</span>
          </span>
          <a href="index.html" className="text-[12px] font-bold uppercase tracking-[0.14em] text-neutral-500 transition-colors hover:text-[#151515]">
            ← Back to home
          </a>
          <p className="text-[12px] font-medium text-neutral-500">Made for small businesses.</p>
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
