/**
 * RATÓN — audio.ts
 * Sonido 100% procedural con Web Audio API (sin assets).
 * Escala pentatónica japonesa (Miyako-bushi amable) para dar sabor.
 */

const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

/** Escala Miyako-bushi sobre Re menor: melancolía japonesa amable */
const MIYAKO = [293.66, 311.13, 392.0, 440.0, 466.16, 587.33, 622.25, 698.46, 880.0, 932.33];

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;
  private volume = 0.8;

  /* ---------- música de fondo (secuenciador propio, sin assets) ---------- */
  private musicGain: GainNode | null = null;
  private musicOn = true;
  private musicPaused = false;
  private musicVol = 0.55;
  private musicIntensity = 0; // 0..1 (sigue la velocidad del juego)
  private musicTimer = 0;
  private nextNoteTime = 0;
  private step = 0;
  private phrase = 0;
  private rng = 20240712;

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
    if (this.musicOn) this.startMusicTimer();
  }

  /* ================= MÚSICA DE FONDO ================= */

  private rnd() {
    // LCG determinista: variación musical sin coste de GC
    this.rng = (this.rng * 1664525 + 1013904223) % 4294967296;
    return this.rng / 4294967296;
  }

  private ensureMusicBus() {
    if (!this.ctx || this.musicGain) return;
    // música → filtro cálido → bus de música → máster (respeta volumen y silencio)
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    lp.Q.value = 0.6;
    lp.connect(this.master ?? this.ctx.destination);
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.connect(lp);
    this.musicGain = g;
  }

  private applyMusicGain() {
    if (!this.ctx || !this.musicGain) return;
    const target = this.musicOn && !this.musicPaused ? this.musicVol * 0.42 : 0;
    this.musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.25);
  }

  setMusicEnabled(on: boolean) {
    this.musicOn = on;
    if (!on) {
      this.applyMusicGain();
      return;
    }
    this.unlock();
    this.startMusicTimer();
  }

  setMusicVolume(v: number) {
    this.musicVol = Math.max(0, Math.min(1, v));
    this.applyMusicGain();
  }

  /** La velocidad del juego dirige tempo, densidad y percusión */
  setMusicIntensity(x: number) {
    this.musicIntensity = Math.max(0, Math.min(1, x));
  }

  pauseMusic() {
    if (this.musicPaused) return;
    this.musicPaused = true;
    this.applyMusicGain();
  }

  resumeMusic() {
    if (!this.musicPaused) return;
    this.musicPaused = false;
    if (this.ctx) this.nextNoteTime = this.ctx.currentTime + 0.12;
    this.applyMusicGain();
  }

  private startMusicTimer() {
    this.ensureMusicBus();
    this.applyMusicGain();
    if (this.musicTimer || !this.ctx) return;
    this.nextNoteTime = this.ctx.currentTime + 0.2;
    // lookahead: programa ~0.7 s por delante, 4 revisiones por segundo
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 250);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = 0;
    }
  }

  private scheduleMusic() {
    const ctx = this.ctx;
    if (!ctx || !this.musicOn || this.musicPaused || this.muted) return;
    if (this.nextNoteTime < ctx.currentTime) this.nextNoteTime = ctx.currentTime + 0.08;
    const ahead = ctx.currentTime + 0.7;
    // corchea: 0.34 s en reposo → 0.19 s a velocidad máxima
    const eighth = Math.max(0.19, 0.34 - this.musicIntensity * 0.15);
    let guard = 0;
    while (this.nextNoteTime < ahead && guard++ < 24) {
      this.emitStep(this.step, this.nextNoteTime);
      this.nextNoteTime += eighth;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.phrase++;
    }
  }

  private emitStep(s: number, t: number) {
    const d = this.musicIntensity;
    // bajo: raíz y dominante, respiran entre frases
    if (s === 0) this.musicNote(MIYAKO[0] / 2, t, 1.5, 0.5, "sine");
    if (s === 8) this.musicNote(MIYAKO[3] / 2, t, 1.2, 0.42, "sine");
    // drone suave una vez cada dos frases
    if (s === 4 && this.phrase % 2 === 1)
      this.musicNote(MIYAKO[5], t, 1.9, 0.1, "triangle");
    // arpegio de koto: denso pero con silencios (eso es lo japonés)
    const on = s === 0 || s === 2 || s === 3 || s === 5 || s === 6 || s === 8 || s === 10 || s === 11 || s === 13 || s === 14;
    const extra = d > 0.45 && (s === 1 || s === 7 || s === 9 || s === 15);
    if ((on || extra) && this.rnd() < 0.5 + d * 0.42) {
      const span = 3 + Math.floor(d * 4);
      const idx = Math.min(MIYAKO.length - 1, 1 + Math.floor(this.rnd() * span) + (d > 0.6 ? 2 : 0));
      this.musicNote(MIYAKO[idx], t, 0.55, 0.3, "triangle");
      if (this.rnd() < 0.25) this.musicNote(MIYAKO[idx] * 2, t + 0.04, 0.3, 0.08, "sine");
    }
    // taiko suave cuando la cosa se acelera
    if (d > 0.5 && (s === 4 || s === 12)) this.musicThump(t);
    // filo de flauta al cerrar frase en modo rápido
    if (s === 15 && d > 0.8) this.musicNote(MIYAKO[8], t, 0.4, 0.14, "sine");
  }

  private musicNote(freq: number, t: number, dur: number, vol: number, type: OscillatorType) {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.06);
  }

  private musicThump(t: number) {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(96, t);
    osc.frequency.exponentialRampToValueAtTime(52, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(g).connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 0.3);
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

/** Vibración segura (no-op si no existe o está desactivada) */
export function buzz(pattern: number | number[], enabled = true) {
  try {
    if (enabled && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* noop */
  }
}
