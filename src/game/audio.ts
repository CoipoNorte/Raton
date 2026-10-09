/**
 * RATÓN — audio.ts
 * Sonido 100% procedural con Web Audio API (sin assets).
 * Escala pentatónica japonesa (Miyako-bushi amable) para dar sabor.
 */

const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

/** Escala Miyako-bushi sobre Re: melancolía japonesa amable */
const MIYAKO = [293.66, 311.13, 392.0, 440.0, 466.16, 587.33, 622.25, 698.46, 880.0, 932.33];

/** Motivos melódicos (índices en MIYAKO): pregunta y respuesta */
const MOTIF_CALM = [7, -1, 5, -1, 3, 2, -1, 1, 2, -1, 1, -1, 0, -1, -1, -1];
const MOTIF_RUN_A = [4, -1, 5, 4, -1, 2, -1, 3, 2, -1, 0, -1, 2, -1, -1, -1];
const MOTIF_RUN_B = [7, -1, 8, 7, -1, 5, -1, 4, 5, -1, 7, -1, 9, 8, -1, -1];

export class SoundEngine {
  private ctx: AudioContext | null = null;
  // Buses independientes: la música NO pasa por master. Así modificar el
  // volumen de efectos (o silenciar efectos) NO afecta a la música, y al revés.
  private fxBus: GainNode | null = null; // efectos → destino
  private musicBus: GainNode | null = null; // música → destino (vía LP)
  private sfxMuted = false; // solo afecta a los efectos
  private sfxVol = 0.8;

  /* ---------- música de fondo (secuenciador propio, sin assets) ---------- */
  private musicOn = true;
  private musicVol = 0.55;
  private musicMode: "menu" | "game" = "menu";
  private musicIntensity = 0; // 0..1 (sigue la velocidad del juego)
  private gamePaused = false;
  private hiddenPaused = false;
  private musicTimer = 0;
  private nextNoteTime = 0;
  private step = 0;
  private phrase = 0;
  private rng = 20240712;

  private get musicAudible() {
    return this.musicOn && !this.gamePaused && !this.hiddenPaused;
  }

  /** Volumen de EFECTOS 0..1 (independiente de la música) */
  setVolume(v: number) {
    this.sfxVol = Math.max(0, Math.min(1, v));
    this.applyFxGain();
  }

  /** Silenciar solo los efectos (la música sigue) */
  setMuted(m: boolean) {
    this.sfxMuted = m;
    this.applyFxGain();
  }

  private applyFxGain() {
    if (!this.fxBus || !this.ctx) return;
    this.fxBus.gain.setTargetAtTime(
      this.sfxMuted ? 0 : this.sfxVol * 0.5,
      this.ctx.currentTime,
      0.03
    );
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
        // bus de efectos → destino
        this.fxBus = this.ctx.createGain();
        this.fxBus.gain.value = this.sfxMuted ? 0 : this.sfxVol * 0.5;
        this.fxBus.connect(this.ctx.destination);
        // bus de música → lowpass cálido → destino (SIN pasar por fxBus)
        const lp = this.ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 3200;
        lp.Q.value = 0.5;
        lp.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0;
        this.musicBus.connect(lp);
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx?.state === "suspended") void this.ctx.resume();
    // si la música está activada, el primer gesto la enciende (menú incluido)
    if (this.musicOn && this.ctx) {
      this.nextNoteTime = this.ctx.currentTime + 0.15;
      this.startMusicTimer();
    }
  }

  /* ================= MÚSICA DE FONDO ================= */

  private rnd() {
    // LCG determinista: variación musical sin coste de GC
    this.rng = (this.rng * 1664525 + 1013904223) % 4294967296;
    return this.rng / 4294967296;
  }

  /** Crea el bus de música si no existe. Ya se crea en unlock(); este método
   * existe por si se necesita recrear tras reset. */
  private ensureMusicBus() {
    if (!this.ctx || this.musicBus) return;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;
    lp.Q.value = 0.5;
    lp.connect(this.ctx.destination);
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.connect(lp);
    this.musicBus = g;
  }

  private applyMusicGain() {
    if (!this.ctx || !this.musicBus) return;
    const target = this.musicAudible ? this.musicVol : 0;
    this.musicBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.3);
  }

  /** Interruptor de música (NO crea el contexto antes de un gesto) */
  setMusicEnabled(on: boolean) {
    this.musicOn = on;
    if (!on || !this.ctx) {
      this.applyMusicGain();
      return;
    }
    this.nextNoteTime = this.ctx.currentTime + 0.15;
    this.startMusicTimer();
  }

  setMusicVolume(v: number) {
    this.musicVol = Math.max(0, Math.min(1, v));
    this.applyMusicGain();
  }

  /** "menu" = calma sparse · "game" = tempo y densidad por velocidad */
  setMusicMode(m: "menu" | "game") {
    this.musicMode = m;
  }

  /** La velocidad del juego dirige tempo, densidad y percusión */
  setMusicIntensity(x: number) {
    this.musicIntensity = Math.max(0, Math.min(1, x));
  }

  /** El juego se pausó / reanudó (la música se serena, no se corta de golpe) */
  setGamePaused(p: boolean) {
    if (this.gamePaused === p) return;
    this.gamePaused = p;
    if (!p && this.ctx) this.nextNoteTime = this.ctx.currentTime + 0.15;
    this.applyMusicGain();
  }

  /** La pestaña pasó a segundo plano / volvió al frente */
  setHidden(h: boolean) {
    if (this.hiddenPaused === h) {
      if (!h && this.ctx?.state === "suspended") void this.ctx.resume();
      return;
    }
    this.hiddenPaused = h;
    if (h) {
      // corte inmediato: suspende el contexto (nada suena en 2º/3er plano)
      this.applyMusicGain();
      if (this.ctx?.state === "running") void this.ctx.suspend();
    } else {
      if (this.ctx?.state === "suspended") void this.ctx.resume();
      if (this.ctx) this.nextNoteTime = this.ctx.currentTime + 0.2;
      this.applyMusicGain();
    }
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
    if (!ctx || !this.musicAudible) return;
    if (ctx.state !== "running") return;
    if (this.nextNoteTime < ctx.currentTime)
      this.nextNoteTime = ctx.currentTime + 0.08;
    const ahead = ctx.currentTime + 0.7;
    const menu = this.musicMode === "menu";
    // corchea: menú lento y parejo · juego 0.34 s → 0.19 s con la velocidad
    const eighth = menu ? 0.42 : Math.max(0.19, 0.34 - this.musicIntensity * 0.15);
    let guard = 0;
    while (this.nextNoteTime < ahead && guard++ < 24) {
      this.emitStep(this.step, this.nextNoteTime);
      this.nextNoteTime += eighth;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.phrase++;
    }
  }

  private emitStep(s: number, t: number) {
    const menu = this.musicMode === "menu";
    const d = menu ? 0.12 : this.musicIntensity;
    // bajo: raíz en el 0, dominante alterna en el 8
    if (s === 0) this.musicBass(MIYAKO[0] / 2, t, 1.8);
    if (s === 8)
      this.musicBass(this.phrase % 2 === 0 ? MIYAKO[3] / 2 : MIYAKO[4] / 2, t, 1.4);
    // drone suave una vez cada dos frases
    if (s === 4 && this.phrase % 2 === 1)
      this.koto(MIYAKO[5], t, 2.0, 0.16);
    // melodía por motivo (pregunta/respuesta cada 2 frases)
    const motif =
      menu || this.phrase % 4 < 2
        ? menu
          ? MOTIF_CALM
          : MOTIF_RUN_A
        : MOTIF_RUN_B;
    const idx = motif[s];
    if (idx >= 0 && this.rnd() < (menu ? 0.8 : 0.55 + d * 0.4)) {
      this.koto(MIYAKO[idx], t, 0.6, menu ? 0.42 : 0.5);
      if (!menu && this.rnd() < 0.22)
        this.koto(MIYAKO[idx] * 2, t + 0.05, 0.35, 0.14);
    }
    // rellenos de 16avos solo a alta velocidad
    if (!menu && d > 0.45 && (s === 7 || s === 15) && this.rnd() < d * 0.5) {
      const f = MIYAKO[3 + Math.floor(this.rnd() * 4)];
      this.koto(f, t + 0.09, 0.3, 0.3);
    }
    // taiko suave cuando la cosa se acelera
    if (!menu && d > 0.5 && (s === 4 || s === 12)) this.musicThump(t);
    // filo de flauta al cerrar frase en modo rápido
    if (!menu && s === 15 && d > 0.8) this.koto(MIYAKO[8], t, 0.45, 0.2);
  }

  /** Koto: triangle + octava + brillo, ataque de púa y caída natural */
  private koto(freq: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const partials: [OscillatorType, number, number][] = [
      ["triangle", 1, vol],
      ["sine", 2, vol * 0.35],
      ["sine", 3, vol * 0.12],
    ];
    for (const [type, mult, v] of partials) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq * mult, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(this.musicBus);
      osc.start(t);
      osc.stop(t + dur + 0.06);
    }
  }

  private musicBass(freq: number, t: number, dur: number) {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.06);
  }

  private musicThump(t: number) {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(96, t);
    osc.frequency.exponentialRampToValueAtTime(52, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(g).connect(this.musicBus);
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
    if (!this.ctx || !this.fxBus || this.sfxMuted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.fxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq = 1200, delay = 0) {
    if (!this.ctx || !this.fxBus || this.sfxMuted) return;
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
    src.connect(filt).connect(g).connect(this.fxBus);
    src.start(t0);
  }

  /** Queso recogido — pluck pentatónico que sube con el combo */
  cheese(combo: number) {
    const idx = Math.min(combo - 1, PENTA.length - 1);
    this.env(PENTA[idx], 0.24, "triangle", 0.5);
    this.env(PENTA[idx] * 2, 0.14, "sine", 0.18);
  }

  /** Premio único de fresa: un acorde, no 20 plucks */
  jackpot() {
    [0, 2, 4].forEach((n, i) =>
      this.env(PENTA[n], 0.32, "triangle", 0.28, undefined, i * 0.04)
    );
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
