/**
 * RATÓN — audio.ts
 * Sonido 100% procedural con Web Audio API (sin assets).
 * Escala pentatónica japonesa (Miyako-bushi amable) para dar sabor.
 */

const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;
  private volume = 0.8;

  /** Volumen maestro 0..1 (lo gestiona el panel de opciones) */
  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyGain();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyGain();
  }

  private applyGain() {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : this.volume * 0.5,
        this.ctx.currentTime,
        0.03
      );
    }
  }

  /** Debe llamarse dentro de un gesto del usuario */
  unlock() {
    if (!this.ctx) {
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume * 0.5;
      this.master.connect(this.ctx.destination);
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  private env(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slideTo?: number,
    delay = 0
  ) {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq = 1200, delay = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = freq;
    filt.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t0);
  }

  /** Queso recogido — pluck pentatónico que sube con el combo */
  cheese(combo: number) {
    const idx = Math.min(combo - 1, PENTA.length - 1);
    this.env(PENTA[idx], 0.24, "triangle", 0.5);
    this.env(PENTA[idx] * 2, 0.14, "sine", 0.18);
  }

  /** Cambio de carril — whoosh suave */
  swipe() {
    this.noise(0.12, 0.14, 900);
  }

  /** Tope contra el borde del carril — golpe seco corto */
  thud() {
    this.noise(0.06, 0.16, 380);
    this.env(140, 0.09, "sine", 0.14, 90);
  }

  /** Tic del countdown — bloque de madera */
  tick() {
    this.env(1318.5, 0.09, "triangle", 0.3, 900);
    this.noise(0.04, 0.1, 2600);
  }

  /** ¡GO! final del countdown — nota ascendente */
  go() {
    this.env(1046.5, 0.28, "triangle", 0.34, 1567.98);
    this.env(1567.98, 0.34, "sine", 0.2, undefined, 0.1);
  }

  /** Near-miss / +aura — swoosh tenso con ping */
  aura() {
    this.noise(0.22, 0.2, 2200);
    this.env(1567.98, 0.3, "sine", 0.22, 2093);
  }

  /** Hito de distancia — acorde de koto */
  milestone() {
    [0, 2, 4].forEach((n, i) =>
      this.env(PENTA[n % PENTA.length], 0.4, "triangle", 0.3, undefined, i * 0.07)
    );
  }

  /** Inicio de partida — jingle de 3 notas */
  start() {
    [2, 3, 4].forEach((n, i) =>
      this.env(PENTA[n], 0.22, "triangle", 0.32, undefined, i * 0.09)
    );
  }

  /** Muerte — chasquido de trampa + golpe grave */
  death() {
    this.noise(0.08, 0.5, 3200);
    this.noise(0.3, 0.4, 300, 0.03);
    this.env(220, 0.5, "sawtooth", 0.25, 55);
    this.env(110, 0.6, "sine", 0.4, 40, 0.05);
  }

  /** Nuevo récord — arpegio de celebración */
  record() {
    [4, 5, 6, 7].forEach((n, i) =>
      this.env(PENTA[n], 0.32, "triangle", 0.3, undefined, i * 0.08)
    );
  }
}

/** Vibración segura (no-op si no existe) */
export function buzz(pattern: number | number[]) {
  try {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* noop */
  }
}
