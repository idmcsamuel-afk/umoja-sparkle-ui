// Procedural game sounds + global mute toggle
const KEY = "umoja_muted";

export const isMuted = () => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
};
export const setMuted = (m: boolean) => {
  try { localStorage.setItem(KEY, m ? "1" : "0"); } catch {}
  window.dispatchEvent(new Event("umoja:mute-change"));
};
export const toggleMuted = () => { setMuted(!isMuted()); return isMuted(); };

let _ctx: AudioContext | null = null;
const ctx = () => {
  if (isMuted()) return null;
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    _ctx = new AC();
  }
  if (_ctx?.state === "suspended") _ctx.resume().catch(() => {});
  return _ctx;
};

const tone = (freq: number, start: number, dur = 0.18, type: OscillatorType = "sine", gain = 0.18) => {
  const c = ctx(); if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.02);
};

export const playWin = () => {
  [523, 659, 784, 988, 1175].forEach((f, i) => tone(f, i * 0.09, 0.22, "triangle", 0.2));
};
export const playLose = () => {
  [440, 370, 311, 247].forEach((f, i) => tone(f, i * 0.13, 0.28, "sawtooth", 0.14));
};
export const playChime = () => {
  [784, 1047, 1319].forEach((f, i) => tone(f, i * 0.07, 0.2, "sine", 0.18));
};
