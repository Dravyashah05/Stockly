/**
 * Ultra-low latency synthesized sound effects using Web Audio API
 * Zero asset loading, instant playback, customizable volume & mute support.
 */

let audioCtx = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isAudioMuted() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("stockly_sound_enabled") === "false";
  } catch {
    return false;
  }
}

export function setAudioMuted(muted) {
  try {
    localStorage.setItem("stockly_sound_enabled", muted ? "false" : "true");
  } catch {}
}

export function playSoundTone(freq, type = "sine", duration = 0.1, gainVal = 0.15) {
  if (isAudioMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio contexts may fail silently without user interaction
  }
}

/**
 * 1. Barcode scanner beep (Crisp, high-pitched 1750Hz pulse)
 */
export function playScanSound() {
  if (isAudioMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1760, ctx.currentTime); // High A6

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch {}
}

/**
 * 2. Stock IN sound (Upward pleasant melodic arpeggio)
 */
export function playStockInSound() {
  if (isAudioMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.15);
    });
  } catch {}
}

/**
 * 3. Stock OUT sound (Crisp dispatch chime)
 */
export function playStockOutSound() {
  if (isAudioMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [783.99, 659.25, 523.25]; // G5, E5, C5
    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.16);
    });
  } catch {}
}

/**
 * 4. Success confirmation chime
 */
export function playSuccessSound() {
  if (isAudioMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const start = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, start); // D5
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(880.0, start + 0.07); // A5

    gain.gain.setValueAtTime(0.2, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(start);
    osc1.stop(start + 0.25);
    osc2.start(start + 0.07);
    osc2.stop(start + 0.25);
  } catch {}
}

/**
 * 5. Error warning tone
 */
export function playErrorSound() {
  if (isAudioMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(160, ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch {}
}

/**
 * 6. Subtle tactile click
 */
export function playClickSound() {
  if (isAudioMuted()) return;
  try {
    playSoundTone(800, "sine", 0.02, 0.06);
  } catch {}
}
