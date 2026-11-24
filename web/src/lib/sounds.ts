let ctx: AudioContext | null = null;
let ringTimer: number | undefined;

function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freqs: number[], start: number, duration: number, volume = 0.05) {
  const c = audio();
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.02);
  gain.gain.setValueAtTime(volume, start + duration - 0.04);
  gain.gain.linearRampToValueAtTime(0, start + duration);
  gain.connect(c.destination);
  for (const f of freqs) {
    const osc = c.createOscillator();
    osc.frequency.value = f;
    osc.connect(gain);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}

export function startRing() {
  stopRing();
  const ring = () => {
    const t = audio().currentTime;
    tone([440, 480], t, 0.4);
    tone([440, 480], t + 0.6, 0.4);
  };
  ring();
  ringTimer = window.setInterval(ring, 2400);
}

export function stopRing() {
  if (ringTimer !== undefined) window.clearInterval(ringTimer);
  ringTimer = undefined;
}

export function playConnect() {
  const t = audio().currentTime;
  tone([880], t, 0.08, 0.04);
  tone([1320], t + 0.1, 0.12, 0.04);
}

export function playEnd() {
  const t = audio().currentTime;
  [620, 480, 360].forEach((f, i) => tone([f], t + i * 0.16, 0.13, 0.05));
}
