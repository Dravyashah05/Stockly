/* Dedicated Stockly App Store page (/app-store → store.html).
 *
 * Exclusively Stockly: latest Android release, install guidance, checksum
 * verification, and version history — all from live GitHub Releases data.
 * No invented versions, no placeholder downloads.
 */

import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './site.css';
import { Logo, Reveal } from './visuals';
import { APP_VERSION } from '../lib/config';
import { fetchLatestRelease, fetchReleaseChecksum, fetchReleaseHistory, formatApkSize } from '../lib/releases';
import type { ReleaseInfo, ReleaseSummary } from '../lib/releases';

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

function StoreApp() {
  const [rel, setRel] = useState<LoadState>({ status: 'checking' });
  const [history, setHistory] = useState<ReleaseSummary[] | null>(null);
  const [sha, setSha] = useState<string | null>(null);
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

  return (
    <div className="min-h-screen overflow-x-clip bg-[#F7F7F2] text-[#151515]">
      <a href="#download" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[#151515] focus:px-4 focus:py-2 focus:text-white">
        Skip to download
      </a>

      <header className="border-b border-[#D9D9D0] bg-[#F7F7F2]/90 backdrop-blur-md">
        <nav aria-label="Primary" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <a href="index.html" className="flex items-center gap-2.5" aria-label="Back to Stockly home">
            <Logo />
            <span className="text-[17px] font-extrabold tracking-tight">Stockly</span>
          </a>
          <span className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-neutral-500">App Store</span>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
        <Reveal>
          <p className="inline-block rounded-full border border-[#D9D9D0] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em]">
            Official releases
          </p>
          <h1 className="mt-5 max-w-[16ch] text-5xl font-extrabold leading-[1.0] tracking-tight sm:text-6xl">
            Stockly for Android.
          </h1>
          <p className="mt-4 max-w-[52ch] text-[15px] font-medium leading-relaxed text-neutral-600">
            Every build below is published automatically from the Stockly source code. Download the APK, check the
            version notes, and verify the checksum before installing.
          </p>
        </Reveal>

        <Reveal delay="st-d1">
          <div id="download" className="mt-10 scroll-mt-24 rounded-[28px] border border-[#D9D9D0] bg-white p-6 shadow-[0_30px_60px_-30px_rgba(21,21,21,0.35)] sm:p-8">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#151515]">
                <Logo size={34} light />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[24px] font-extrabold tracking-tight">Stockly for Android</p>
                <p className="tnum mt-0.5 text-[13px] font-semibold text-neutral-500">
                  {info
                    ? `v${info.version}${info.versionCode > 0 ? ` (${info.versionCode})` : ''} · Android${info.publishedAt ? ` · ${fmtDate(info.publishedAt)}` : ''}${info.apkSize > 0 ? ` · ${formatApkSize(info.apkSize)}` : ''}`
                    : rel.status === 'error'
                      ? rel.message
                      : 'Checking the latest release…'}
                </p>
              </div>
              <span className="rounded-full bg-[#151515] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-[#C7FF4D]">
                Android
              </span>
            </div>

            {info?.releaseNotes.length ? (
              <div className="mt-5 border-t border-[#EAEAE4] pt-4">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-neutral-500">What’s new</p>
                <ul className="mt-2 space-y-1.5">
                  {info.releaseNotes.map((n) => (
                    <li key={n} className="text-[14px] font-medium leading-relaxed text-neutral-700">· {n}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {info ? (
              <a
                href={info.apkUrl}
                className="mt-6 block rounded-full bg-[#151515] py-4 text-center text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#C7FF4D] transition-transform hover:scale-[1.02] active:scale-95"
              >
                Download APK
              </a>
            ) : (
              <span
                aria-disabled="true"
                className={`mt-6 block rounded-full py-4 text-center text-[13px] font-extrabold uppercase tracking-[0.14em] ${
                  rel.status === 'checking' ? 'bg-[#EAEAE4] text-neutral-500' : 'bg-[#151515] text-white/60'
                }`}
              >
                {rel.status === 'checking' ? 'Checking…' : 'APK coming soon'}
              </span>
            )}

            <div className="mt-5 grid gap-4 border-t border-[#EAEAE4] pt-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-neutral-500">Install</p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13.5px] font-medium leading-relaxed text-neutral-700">
                  <li>Download the APK above on your phone or tablet.</li>
                  <li>Open the file and allow “install unknown apps” once when asked.</li>
                  <li>Confirm the Android installer prompt — updates install over the existing app.</li>
                </ol>
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-neutral-500">Verify</p>
                {sha ? (
                  <p className="tnum mt-2 break-all rounded-2xl bg-[#F7F7F2] px-3.5 py-3 text-[11.5px] font-semibold leading-relaxed text-neutral-600">
                    SHA-256 · {sha}
                  </p>
                ) : (
                  <p className="mt-2 text-[13px] font-medium text-neutral-500">
                    {info ? 'Checksum file not published for this release.' : 'Checksum appears with the release.'}
                  </p>
                )}
                {info?.releaseUrl ? (
                  <a href={info.releaseUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[12px] font-extrabold uppercase tracking-[0.14em] text-neutral-500 underline-offset-4 hover:text-[#151515] hover:underline">
                    Official release page →
                  </a>
                ) : null}
                <p className="mt-2 text-[12.5px] font-medium leading-relaxed text-neutral-500">
                  Stockly is not Play Protect-certified. Install only from this page or the app’s built-in updater, and
                  only accept updates carrying Stockly’s official release signature.
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="mt-12">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">Version history</p>
            {history === null ? (
              <p className="mt-3 text-[14px] font-medium text-neutral-500">Couldn’t load the release history.</p>
            ) : prior.length === 0 ? (
              <p className="mt-3 text-[14px] font-medium text-neutral-500">
                {info ? 'This is the first published release.' : 'No releases published yet.'}
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[#EAEAE4] rounded-[24px] border border-[#D9D9D0] bg-white">
                {prior.slice(0, 10).map((h) => (
                  <li key={h.tag} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
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
                      ) : null}
                      <a href={h.releaseUrl} target="_blank" rel="noreferrer" className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-neutral-500 underline-offset-4 hover:text-[#151515] hover:underline">
                        Notes
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>

        <footer className="mt-16 flex flex-col gap-4 border-t border-[#D9D9D0] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2.5">
            <Logo />
            <span className="text-[15px] font-extrabold tracking-tight">Stockly · v{APP_VERSION}</span>
          </span>
          <a href="index.html" className="text-[12px] font-bold uppercase tracking-[0.14em] text-neutral-500 transition-colors hover:text-[#151515]">
            ← Back to home
          </a>
          <p className="text-[12px] font-medium text-neutral-500">Made for small businesses.</p>
        </footer>
      </main>
    </div>
  );
}

createRoot(document.getElementById('store-root')!).render(
  <StrictMode>
    <StoreApp />
  </StrictMode>,
);
