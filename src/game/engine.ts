/**
 * RATÓN — engine.ts
 * Motor del juego: endless runner vertical de 3 carriles.
 * - Desliza / flechas para moverte entre carriles.
 * - Trampas = muerte. Queso = +100 × combo. Near-miss = +AURA (multiplica distancia).
 */

import {
  PALETTE,
  drawCheese,
  drawCloud,
  drawMouse,
  drawPetal,
  drawSpark,
  drawStone,
  drawTorii,
  drawTrap,
  drawTuft,
  drawStrawberry,
  drawBandaid,
} from "./draw";
import type { SoundEngine } from "./audio";
import { buzz } from "./audio";

export interface HudState {
  distance: number;
  cheese: number;
  aura: number;
  auraMult: number;
  speed01: number;
  lives: number;
  strawberry: boolean;
}

export interface RunResult {
  distance: number;
  cheese: number;
  auraMax: number;
}

interface EngineCallbacks {
  sound: SoundEngine;
  onHud: (h: HudState) => void;
  onGameOver: (r: RunResult) => void;
  onPauseChange?: (paused: boolean) => void;
  onFatal?: () => void;
}

type EntType = "trap" | "cheese" | "strawberry" | "bandaid";
interface Ent {
  type: EntType;
  lane: number;
  y: number;
  xOff: number; // imán del queso
  seed: number;
  counted: boolean; // near-miss ya contado
  snapping: boolean;
  snapT: number;
  taken: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: "spark" | "dust" | "petal" | "flame" | "ring";
  scale: number;
  color: string;
  rot: number;
  vr: number;
  w: number; // cuanto se desplaza con el mundo (0 = pantalla, 1 = carretera)
}

interface FloatText {
  x: number;
  y: number;
  vy: number;
  life: number;
  max: number;
  text: string;
  color: string;
  size: number;
  stroke?: string;
}

interface Decor {
  kind: "tuft" | "stone" | "torii";
  x: number;
  y: number;
  s: number;
  rot: number;
}
interface Cloud {
  x: number;
  y: number;
  s: number;
  v: number;
}

const START_SPEED = 260;
const MAX_SPEED = 680;
const RAMP_T = 110; // segundos hasta velocidad máxima (rampa larga y gradual)
const PX_PER_M = 52;
const LANES = 3;

/* --- topes de recursos: nunca saturar el dispositivo ---
 * Pocos elementos en pantalla = dibujo barato y CPU libre para el input.
 * Al pasarse, se descarta lo más antiguo (FIFO), así el límite es real. */
const MAX_ENTITIES = 3; // trampas + quesos + power-ups simultáneos
const MAX_PARTICLES = 30; // partículas activas en total
const PETAL_RESERVE = 10; // partidas reservadas para efectos (que siempre se vean)
const MAX_FLOATS = 4; // textos flotantes
const MAX_DECOR = 10; // matas/piedras/torii de los márgenes


const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class RatonGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: EngineCallbacks;
  private sound: SoundEngine;

  private raf = 0;
  private alive = true;
  private last = 0;
  private W = 360;
  private H = 640;
  private ro: ResizeObserver | null = null;
  private onWindowResize = () => this.resize();

  state: "playing" | "dying" | "dead" = "playing";
  paused = false;

  // --- sistema de vidas (Band-Aid) ---
  lives = 3;
  maxLives = 9;
  // --- fresa: multiplicador de queso por tiempo ---
  strawberryUntil = 0;
  nextPowerupAt = 900;
  // --- giroscopio ---
  tiltActive = false;
  private tiltHandler?: (e: DeviceOrientationEvent) => void;
  vibrateEnabled = true;

  private elapsed = 0;
  private scroll = 0;
  private speed = START_SPEED;
  private distance = 0;
  private cheeseN = 0;
  private combo = 0;
  private comboTimer = 0;
  private aura = 0;
  private auraMax = 0;
  private milestoneNext = 500;
  private shake = 0;
  private flash = 0;
  private timeScale = 1;
  private deathT = 0;
  private graceT = 0.9;
  /** Invulnerabilidad tras perder una vida (segundos) */
  private invulnT = 0;
  /** Carriles con ruta garantizada tras el último patrón */
  private pathLanes: number[] = [0, 1, 2];

  private player = { lane: 1, x: 0, lean: 0 };
  private ents: Ent[] = [];
  private parts: Particle[] = [];
  private floats: FloatText[] = [];
  private decor: Decor[] = [];
  private clouds: Cloud[] = [];

  private nextRowAt = 620;
  private nextDecorAt = 100;
  private nextToriiAt = 700;
  private toriiSide = 0;

  private keyHandler = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") this.move(-1);
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") this.move(1);
  };

  private visHandler = () => {
    if (document.hidden && this.state === "playing" && !this.paused) {
      this.setPaused(true);
    }
  };

  constructor(
    canvas: HTMLCanvasElement,
    cb: EngineCallbacks
  ) {
    this.canvas = canvas;
    this.cb = cb;
    this.sound = cb.sound;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.ctx = ctx;

    this.resize();
    this.player.x = this.laneX(1);

    // El primer segundo siempre muestra juego real, no una pista vacía.
    this.spawnEnt("cheese", 1, this.H * 0.22);
    this.spawnEnt("trap", 0, this.H * 0.04);
    this.pathLanes = [1, 2];

    // nubes iniciales (solo en la banda del cielo)
    for (let i = 0; i < 5; i++) {
      this.clouds.push({
        x: Math.random(),
        y: rand(0.02, 0.26),
        s: rand(0.5, 1.1),
        v: rand(6, 16),
      });
    }

    window.addEventListener("keydown", this.keyHandler);
    document.addEventListener("visibilitychange", this.visHandler);

    // ResizeObserver no existe en algunos navegadores móviles antiguos.
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas.parentElement ?? canvas);
    } else {
      window.addEventListener("resize", this.onWindowResize);
    }

    this.floats.push({
      x: this.W / 2,
      y: this.H * 0.44,
      vy: -14,
      life: 1,
      max: 1,
      text: "¡GO!",
      color: PALETTE.sun,
      size: 44,
      stroke: "#faf4e4",
    });
  }

  /* ---------------- estructura ---------------- */

  private resize() {
    const parent = this.canvas.parentElement;
    const bounds = parent?.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(bounds?.width || window.innerWidth || 360));
    const cssH = Math.max(1, Math.round(bounds?.height || window.innerHeight || 640));
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.W = cssW;
    this.H = cssH;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.player.x) this.player.x = this.laneX(this.player.lane);
  }

  private margin() {
    return Math.max(30, this.W * 0.125);
  }
  private laneW() {
    return (this.W - this.margin() * 2) / LANES;
  }
  private laneX(lane: number) {
    return this.margin() + this.laneW() * (lane + 0.5);
  }
  private playerY() {
    return this.H * 0.76;
  }
  auraMult() {
    return 1 + Math.min(this.aura, 12) * 0.08;
  }

  /** Fracción de velocidad 0..1 (para escalar espaciado de trampas) */
  speedFrac() {
    return clamp(
      (this.speed - START_SPEED) / (MAX_SPEED - START_SPEED),
      0,
      1
    );
  }

  setPaused(p: boolean) {
    if (this.paused === p) return;
    this.paused = p;
    this.cb.onPauseChange?.(p);
  }

  /** Activa el giroscopio (modo tilt). Devuelve false si el navegador no deja. */
  async requestTilt(): Promise<boolean> {
    const DOE = (
      window as unknown as {
        DeviceOrientationEvent?: {
          requestPermission?: () => Promise<"granted" | "denied">;
        };
      }
    ).DeviceOrientationEvent;
    try {
      if (DOE && typeof DOE.requestPermission === "function") {
        const res = await DOE.requestPermission();
        if (res !== "granted") return false;
      }
    } catch {
      /* noop */
    }
    if (typeof window.addEventListener !== "function") return false;
    this.tiltActive = true;
    const handler = (e: DeviceOrientationEvent) => {
      if (this.state !== "playing" || this.paused) return;
      const g = typeof e.gamma === "number" ? e.gamma : 0; // -90..90 (izq/der)
      if (g < -10) this.move(-1, true);
      else if (g > 10) this.move(1, true);
    };
    this.tiltHandler = handler;
    window.addEventListener("deviceorientation", handler);
    return true;
  }

  stopTilt() {
    this.tiltActive = false;
    if (this.tiltHandler) {
      window.removeEventListener("deviceorientation", this.tiltHandler);
      this.tiltHandler = undefined;
    }
  }

  /** Vibración respetando el ajuste del jugador */
  private vib(pattern: number | number[]) {
    buzz(pattern, this.vibrateEnabled);
  }

  start() {
    this.sound.unlock();
    this.sound.start();
    this.last = performance.now();
    // Dibuja ya, sin esperar al primer requestAnimationFrame.
    try {
      this.render(this.last);
    } catch {
      this.fail();
      return;
    }
    const loop = (t: number) => {
      if (!this.alive) return;
      try {
        const rawDt = clamp((t - this.last) / 1000, 0, 0.05);
        this.last = t;
        if (!this.paused) {
          this.update(rawDt);
        }
        this.render(t);
        this.raf = requestAnimationFrame(loop);
      } catch {
        this.fail();
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  private fail() {
    if (!this.alive) return;
    this.destroy();
    this.cb.onFatal?.();
  }

  destroy() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.keyHandler);
    document.removeEventListener("visibilitychange", this.visHandler);
    this.ro?.disconnect();
    window.removeEventListener("resize", this.onWindowResize);
  }

  /* ---------------- input ---------------- */

  move(dir: -1 | 1, silent = false) {
    if (this.state !== "playing" || this.paused) return;
    const next = clamp(this.player.lane + dir, 0, LANES - 1);
    if (next === this.player.lane) {
      // tope contra el borde: micro-choque con feedback
      this.sound.thud();
      this.shake = Math.max(this.shake, 2.5);
      return;
    }
    this.player.lane = next;
    if (!silent) {
      this.sound.swipe();
      this.vib(8);
    }
    // polvo al cambiar de carril
    for (let i = 0; i < 6; i++) {
      this.parts.push({
        x: this.player.x - dir * 14 + rand(-8, 8),
        y: this.playerY() + 20 + rand(-4, 4),
        vx: -dir * rand(20, 60),
        vy: rand(-10, 25),
        life: rand(0.25, 0.45),
        max: 0.45,
        kind: "dust",
        scale: rand(0.7, 1.4),
        color: "rgba(120,105,80,0.35)",
        rot: 0,
        vr: 0,
        w: 1,
      });
    }
  }

  /* ---------------- spawning ---------------- */

  /**
   * Las entidades se colocan EXACTAMENTE donde el patrón indica. La separación
   * entre filas la garantiza el cursor de filas (altura del patrón + hueco),
   * así que nunca hace falta "empujar" nada hacia arriba (eso era lo que
   * acababa alineando trampas de filas distintas en un muro).
   */
  private spawnEnt(type: EntType, lane: number, yOff: number) {
    // Tope estricto de entidades simultáneas (3). Si ya está lleno,
    // retiramos la más antigua que YA pasó al ratón: desaparece fuera de la
    // zona crítica, así nunca hay un "pop" a mitad del camino. Si todas están
    // por delante, simplemente no se genera la nueva (nace fuera de pantalla).
    if (this.ents.length >= MAX_ENTITIES) {
      const limit = this.playerY() + 30;
      let idx = -1;
      let bestY = -Infinity;
      for (let i = 0; i < this.ents.length; i++) {
        const e = this.ents[i];
        if (e.taken) continue;
        if (e.y > limit && e.y > bestY) {
          bestY = e.y;
          idx = i;
        }
      }
      if (idx < 0) return;
      this.ents.splice(idx, 1);
    }
    this.ents.push({
      type,
      lane,
      y: yOff,
      xOff: 0,
      seed: Math.random() * 1000,
      counted: false,
      snapping: false,
      snapT: 0,
      taken: false,
    });
  }

  /**
   * SEGURO FINAL contra muros: si dentro de una ventana vertical (lo que tarda
   * el ratón en cambiar de carril) hay trampas en LOS 3 carriles, se elimina
   * la trampa más reciente (la más alta). Se ejecuta tras cada fila nueva.
   */
  private enforcePassable() {
    const win = Math.max(170, this.speed * 0.6);
    const traps = this.ents
      .filter((e) => e.type === "trap" && !e.taken)
      .sort((a, b) => a.y - b.y); // las más altas (nuevas) primero
    for (const t of traps) {
      if (t.taken) continue;
      const lanes = new Set<number>();
      for (const o of traps) {
        if (!o.taken && Math.abs(o.y - t.y) < win) lanes.add(o.lane);
      }
      if (lanes.size >= LANES) t.taken = true;
    }
    // también: nunca dos trampas en el mismo carril demasiado pegadas
    for (let i = 0; i < traps.length; i++) {
      const a = traps[i];
      if (a.taken) continue;
      for (let j = i + 1; j < traps.length; j++) {
        const b = traps[j];
        if (!b.taken && b.lane === a.lane && Math.abs(a.y - b.y) < 110) {
          a.taken = true;
          break;
        }
      }
    }
    this.ents = this.ents.filter((e) => !e.taken);
  }

  /** Amplía la ruta: con un hueco de fila puedes derivar 1 carril a cada lado */
  private widenLanes(lanes: number[]): number[] {
    const s = new Set<number>();
    for (const l of lanes)
      for (const d of [-1, 0, 1]) {
        const x = l + d;
        if (x >= 0 && x < LANES) s.add(x);
      }
    return [...s];
  }

  /**
   * GARANTÍA DE CAMINO: valida que el nivel de trampas deje un carril seguro
   * ALCANZABLE desde la ruta actual (máx. 1 carril por hueco). Si no lo deja,
   * reubica trampas; en último caso elimina una. Siempre existe un camino.
   */
  private fixTrapLevel(trapLanes: number[]): number[] {
    let traps = [...trapLanes];
    const safeOf = () => [0, 1, 2].filter((l) => !traps.includes(l));
    const reachable = () =>
      this.widenLanes(this.pathLanes).filter((l) => safeOf().includes(l));
    let attempts = 0;
    while (reachable().length === 0 && attempts < 10) {
      attempts++;
      const i = Math.floor(rand(0, traps.length));
      const alt = [0, 1, 2].filter((l) => l !== traps[i] && !traps.includes(l));
      if (alt.length === 0) break;
      traps[i] = alt[Math.floor(rand(0, alt.length))];
    }
    if (reachable().length === 0 && traps.length > 1) traps.pop();
    this.pathLanes = reachable();
    return traps;
  }

  /**
   * Genera una fila de patrón (selección ponderada).
   * Devuelve { h, mul }: h = altura del patrón por encima de la línea base
   * (px), mul = multiplicador del hueco posterior. El cursor de filas coloca
   * la siguiente fila SIEMPRE por encima de h + hueco → nunca hay solapes.
   */
  private spawnRow(): { h: number; mul: number } {
    const t01 = clamp(this.elapsed / RAMP_T, 0, 1);

    // --- fila de power-up (muy rara): fresa o band-aid en un carril alcanzable ---
    if (this.scroll >= this.nextPowerupAt) {
      const options = this.widenLanes(this.pathLanes);
      const lane = options[Math.floor(rand(0, options.length))] ?? 1;
      // Fresa ahora es súper exclusiva (25% del ya de por sí raro powerup, 75% bandaid si le faltan vidas, o bandaid por defecto)
      const wantBandaid = this.lives < this.maxLives ? Math.random() < 0.75 : true;
      this.spawnEnt(wantBandaid ? "bandaid" : "strawberry", lane, -70);
      this.pathLanes = options;
      // Intervalo mucho más largo para reducir drásticamente su aparición
      this.nextPowerupAt = this.scroll + rand(4500, 8000);
      return { h: 0, mul: 0.95 };
    }

    const patterns: { w: number; run: () => { h: number; mul: number } }[] = [
      {
        // trampa simple
        w: Math.max(0.8, 2.6 - t01 * 0.9),
        run: () => {
          const traps = this.fixTrapLevel([Math.floor(rand(0, 3))]);
          this.spawnEnt("trap", traps[0], -70);
          return { h: 0, mul: 1 };
        },
      },
      {
        // doble trampa: SIEMPRE deja un carril libre alcanzable (+ queso de premio)
        w: 0.35 + t01 * 2.3,
        run: () => {
          const shuffled = [0, 1, 2].sort(() => Math.random() - 0.5);
          const traps = this.fixTrapLevel([shuffled[0], shuffled[1]]);
          for (const l of traps) this.spawnEnt("trap", l, -70);
          const free = [0, 1, 2].find((l) => !traps.includes(l));
          let h = 0;
          if (free !== undefined && Math.random() < 0.55) {
            this.spawnEnt("cheese", free, -70 - 150);
            h = 150;
          }
          return { h, mul: 1.35 };
        },
      },
      {
        // dos trampas escalonadas (cada nivel se valida contra la ruta)
        w: t01 * 1.4,
        run: () => {
          const a = this.fixTrapLevel([Math.floor(rand(0, 3))])[0];
          const b = this.fixTrapLevel([clamp(a + pick([-1, 1, 2]), 0, 2)])[0];
          this.spawnEnt("trap", a, -70);
          this.spawnEnt("trap", b, -70 - 320);
          return { h: 320, mul: 1.2 };
        },
      },
      {
        // trampa + queso cebo delante de ella (riesgo/recompensa)
        w: 1.6,
        run: () => {
          const t = this.fixTrapLevel([Math.floor(rand(0, 3))])[0];
          const side = t === 1 ? pick([0, 2]) : 1;
          this.spawnEnt("trap", t, -70);
          // 140px más alto = tiempo para reaccionar al cebo
          this.spawnEnt("cheese", side, -70 - 140);
          return { h: 140, mul: 1.05 };
        },
      },
      {
        // fila de quesos en un carril
        w: 1.6,
        run: () => {
          const lane = Math.floor(rand(0, 3));
          const n = Math.floor(rand(3, 6));
          for (let i = 0; i < n; i++) this.spawnEnt("cheese", lane, -70 - i * 130);
          this.pathLanes = this.widenLanes(this.pathLanes);
          return { h: (n - 1) * 130, mul: 0.9 };
        },
      },
      {
        // fila horizontal de queso (los 3 carriles)
        w: 1,
        run: () => {
          for (let l = 0; l < 3; l++) this.spawnEnt("cheese", l, -70);
          this.pathLanes = this.widenLanes(this.pathLanes);
          return { h: 0, mul: 0.9 };
        },
      },
      {
        // zig-zag de queso
        w: 1.1,
        run: () => {
          let lane = Math.floor(rand(0, 3));
          for (let i = 0; i < 4; i++) {
            this.spawnEnt("cheese", lane, -70 - i * 150);
            lane = clamp(lane + pick([-1, 1]), 0, 2);
          }
          this.pathLanes = this.widenLanes(this.pathLanes);
          return { h: 450, mul: 0.9 };
        },
      },
    ];
    const total = patterns.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * total;
    let result = { h: 0, mul: 1 };
    for (const p of patterns) {
      r -= p.w;
      if (r <= 0) {
        result = p.run();
        break;
      }
    }
    // seguro final: jamás un muro de 3 trampas ni trampas pegadas en un carril
    this.enforcePassable();
    return result;
  }

  /* ---------------- update ---------------- */

  private update(rawDt: number) {
    // slow-motion al morir
    if (this.state === "dying") {
      this.deathT += rawDt;
      this.timeScale = Math.max(0.14, 1 - this.deathT * 2.6);
      if (this.deathT > 1.05) {
        this.state = "dead";
        this.cb.onGameOver({
          distance: Math.floor(this.distance),
          cheese: this.cheeseN,
          auraMax: this.auraMax,
        });
      }
    }
    const dt = rawDt * (this.state === "dead" ? 0 : this.timeScale);

    if (this.state === "playing") {
      this.elapsed += rawDt;
      if (this.graceT > 0) this.graceT -= rawDt;
      if (this.invulnT > 0) this.invulnT -= rawDt;
      const t01 = clamp(this.elapsed / RAMP_T, 0, 1);
      const ease = t01 * t01; // curva gradual: lento al inicio, sube al final
      this.speed = START_SPEED + (MAX_SPEED - START_SPEED) * ease;
      this.distance += (this.speed * dt * this.auraMult()) / PX_PER_M;

      // combo
      if (this.comboTimer > 0) {
        this.comboTimer -= rawDt;
        if (this.comboTimer <= 0) this.combo = 0;
      }

      // hitos de distancia
      if (this.distance >= this.milestoneNext) {
        this.sound.milestone();
        this.floats.push({
          x: this.W / 2,
          y: this.H * 0.34,
          vy: -14,
          life: 1.8,
          max: 1.8,
          text: `${this.milestoneNext}m おめでとう!`,
          color: PALETTE.sun,
          size: 30,
          stroke: "#faf4e4",
        });
        // Cantidad de pétalos del hito reducida de 16 a 6 para optimizar rendimiento
        if (this.parts.length < MAX_PARTICLES) {
          for (let i = 0; i < 6; i++) {
            this.parts.push({
              x: this.W / 2 + rand(-50, 50),
              y: this.H * 0.3 + rand(-15, 15),
              vx: rand(-40, 40),
              vy: rand(-20, 60),
              life: rand(0.6, 1.2),
              max: 1.2,
              kind: "petal",
              scale: rand(0.6, 1.1),
              color: PALETTE.petal,
              rot: rand(0, Math.PI * 2),
              vr: rand(-2, 2),
              w: 0.35,
            });
          }
        }
        this.milestoneNext += 500;
      }
    }

    // scroll del mundo
    this.scroll += this.speed * dt;

    // generación de patrones (cursor de filas)
    if (this.state === "playing" && this.graceT <= 0 && this.scroll >= this.nextRowAt) {
      const { h, mul } = this.spawnRow();
      // El hueco entre filas se mide en TIEMPO de reacción (0.75 s → 1.25 s),
      // así que en píxeles CRECE con la velocidad. La siguiente fila nace
      // siempre por encima de la altura total del patrón + hueco.
      const baseGap = this.speed * (0.75 + this.speedFrac() * 0.5);
      const gap = clamp(baseGap, 230, 1000) * mul * rand(0.97, 1.1);
      this.nextRowAt = this.scroll + h + gap;
    }

    // fresa expira
    if (this.strawberryUntil && this.elapsed > this.strawberryUntil) {
      this.strawberryUntil = 0;
    }

    // decoración de los márgenes
    if (this.scroll >= this.nextDecorAt) {
      const side = Math.random() < 0.5 ? 0 : 1;
      const x =
        side === 0
          ? rand(8, this.margin() - 10)
          : this.W - rand(8, this.margin() - 10);
      this.decor.push({
        kind: Math.random() < 0.6 ? "tuft" : "stone",
        x,
        y: -40,
        s: rand(0.7, 1.3),
        rot: rand(-0.3, 0.3),
      });
      this.nextDecorAt = this.scroll + rand(80, 220);
    }
    if (this.scroll >= this.nextToriiAt) {
      this.toriiSide = 1 - this.toriiSide;
      const x =
        this.toriiSide === 0 ? this.margin() * 0.45 : this.W - this.margin() * 0.45;
      this.decor.push({ kind: "torii", x, y: -60, s: 0.42, rot: 0 });
      this.nextToriiAt = this.scroll + rand(1100, 2100);
    }
    for (const d of this.decor) d.y += this.speed * dt;
    this.decor = this.decor.filter((d) => d.y < this.H + 80);
    if (this.decor.length > MAX_DECOR)
      this.decor.splice(0, this.decor.length - MAX_DECOR);

    // nubes (deriva de viento sobre el cielo, con parallax de velocidad)
    for (const c of this.clouds) {
      c.x += ((this.speed * 0.045 + c.v) * dt) / this.W;
      if (c.x > 1.2) {
        c.x = -0.3;
        c.y = rand(0.02, 0.26);
        c.s = rand(0.5, 1.15);
        c.v = rand(6, 16);
      }
    }

    // jugador: movimiento suave entre carriles
    const targetX = this.laneX(this.player.lane);
    const dx = targetX - this.player.x;
    this.player.x += dx * Math.min(1, rawDt * 16);
    this.player.lean = clamp(dx / this.laneW(), -1, 1) * 0.3;

    // entidades
    const py = this.playerY();
    for (const e of this.ents) {
      e.y += this.speed * dt;
      if (e.snapping) e.snapT = Math.min(1, e.snapT + rawDt / 0.12);
      const ex = this.laneX(e.lane) + e.xOff;
      const hitX = Math.abs(ex - this.player.x);
      const dy = e.y - py;

      if (this.state === "playing") {
        if (e.type === "cheese" && !e.taken) {
          // imán: SOLO en el carril del jugador y sin cruzar de carril
          // (así el queso nunca se superpone sobre trampas vecinas)
          if (e.lane === this.player.lane && Math.abs(dy) < 130) {
            e.xOff += (this.player.x - ex) * dt * 8;
            const maxOff = this.laneW() * 0.42;
            if (e.xOff > maxOff) e.xOff = maxOff;
            if (e.xOff < -maxOff) e.xOff = -maxOff;
          }
          if (hitX < this.laneW() * 0.44 && Math.abs(dy) < 46) {
            e.taken = true;
            this.collectCheese(ex, e.y);
          }
        }
        if (e.type === "trap") {
          const overlapping = hitX < this.laneW() * 0.38 && Math.abs(dy) < 40;
          // Una trampa ya cerrada (snapping) no vuelve a golpear, y durante la
          // invulnerabilidad el ratón atraviesa las trampas sin perder vidas.
          if (overlapping && !e.snapping && this.invulnT <= 0) {
            this.die(e);
          } else if (!e.counted && dy > 52) {
            e.counted = true;
            if (this.invulnT <= 0 && hitX < this.laneW() * 1.18) this.nearMiss();
          }
        }
        if ((e.type === "strawberry" || e.type === "bandaid") && !e.taken) {
          if (hitX < this.laneW() * 0.5 && Math.abs(dy) < 40) {
            e.taken = true;
            if (e.type === "strawberry") this.collectStrawberry(ex, e.y);
            else this.collectBandaid(ex, e.y);
          }
        }
      }
    }
    this.ents = this.ents.filter(
      (e) => e.y < this.H + 140 && !e.taken
    );

    // aura alta = partículas de fuego dorado
    if (this.state === "playing" && this.aura >= 3 && Math.random() < 0.5) {
      this.parts.push({
        x: this.player.x + rand(-16, 16),
        y: py + rand(-18, 14),
        vx: rand(-12, 12),
        vy: rand(30, 80),
        life: rand(0.3, 0.7),
        max: 0.7,
        kind: "flame",
        scale: rand(0.5, 1.1) * Math.min(1, this.aura / 8),
        color: "rgba(242,177,61,0.85)",
        rot: 0,
        vr: 0,
        w: 0.9,
      });
    }

    // partículas (w = cuánto viajan con el mundo/carretera)
    for (const p of this.parts) {
      p.life -= rawDt;
      p.x += p.vx * rawDt;
      p.y += p.vy * rawDt + this.speed * p.w * rawDt;
      p.rot += p.vr * rawDt;
      if (p.kind === "petal") p.x += Math.sin(p.life * 5 + p.rot) * 0.6;
    }
    this.parts = this.parts.filter((p) => p.life > 0);

    // textos flotantes
    for (const f of this.floats) {
      f.life -= rawDt;
      f.y += f.vy * rawDt;
    }
    this.floats = this.floats.filter((f) => f.life > 0);

    // pétalos ambientales: nacen poco a poco, viven lo justo para cruzar la
    // pantalla y dejan siempre un margen de partículas reservado a los efectos.
    if (
      this.parts.length < MAX_PARTICLES - PETAL_RESERVE &&
      Math.random() < rawDt * 1.1
    ) {
      this.parts.push({
        x: rand(0, this.W),
        y: -20,
        vx: rand(-20, 2),
        vy: rand(20, 48),
        life: rand(1.4, 2.2),
        max: 2.2,
        kind: "petal",
        scale: rand(0.5, 0.9),
        color: PALETTE.petal,
        rot: rand(0, Math.PI * 2),
        vr: rand(-1.5, 1.5),
        w: 0.35,
      });
    }

    // recorte FIFO de listas: tope duro de partículas y textos flotantes
    if (this.parts.length > MAX_PARTICLES)
      this.parts.splice(0, this.parts.length - MAX_PARTICLES);
    if (this.floats.length > MAX_FLOATS)
      this.floats.splice(0, this.floats.length - MAX_FLOATS);

    this.shake *= Math.pow(0.001, rawDt);
    if (this.shake < 0.2) this.shake = 0;
    this.flash = Math.max(0, this.flash - rawDt * 1.6);

    // HUD
    this.cb.onHud({
      distance: Math.floor(this.distance),
      cheese: this.cheeseN,
      aura: this.aura,
      auraMult: this.auraMult(),
      speed01: clamp((this.speed - START_SPEED) / (MAX_SPEED - START_SPEED), 0, 1),
      lives: this.lives,
      strawberry: this.strawberryUntil > this.elapsed,
    });
  }

  private collectCheese(x: number, y: number) {
    this.cheeseN++;
    this.combo++;
    this.comboTimer = 1.9;
    const berry = this.strawberryUntil > this.elapsed;
    // fresa: multiplicador ×20 de la distancia por queso (20 segundos)
    const amount = 100 * this.combo * (berry ? 20 : 1);
    this.distance += amount;
    this.sound.cheese(this.combo);
    this.vib(12);
    const label = berry
      ? `+${amount} ¡×20!`
      : this.combo > 1
        ? `+${amount} ×${this.combo}`
        : `+${amount}`;
    this.floats.push({
      x,
      y: y - 26,
      vy: -46,
      life: 0.9,
      max: 0.9,
      text: label,
      color: PALETTE.cheeseDeep,
      size: this.combo > 1 ? 24 : 20,
      stroke: "#faf4e4",
    });
    // Cantidad de chispas de queso reducida de 8 a 4 para optimización extrema
    if (this.parts.length < MAX_PARTICLES) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + rand(0, 0.5);
        this.parts.push({
          x,
          y,
          vx: Math.cos(a) * rand(35, 80),
          vy: Math.sin(a) * rand(35, 80),
          life: rand(0.25, 0.45),
          max: 0.45,
          kind: "spark",
          scale: rand(0.5, 0.8),
          color: PALETTE.cheese,
          rot: 0,
          vr: 0,
          w: 0.25,
        });
      }
    }
  }

  private nearMiss() {
    this.aura++;
    this.auraMax = Math.max(this.auraMax, this.aura);
    this.sound.aura();
    this.vib(8);
    this.floats.push({
      x: this.player.x,
      y: this.playerY() - 70,
      vy: -34,
      life: 1,
      max: 1,
      text: "+AURA",
      color: "#d18f1f",
      size: 19,
      stroke: "#faf4e4",
    });
    const py = this.playerY();
    // Cantidad de chispas de aura reducida de 6 a 3 para fluidez perfecta
    if (this.parts.length < MAX_PARTICLES) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + rand(0, 0.3);
        this.parts.push({
          x: this.player.x + Math.cos(a) * 18,
          y: py + Math.sin(a) * 18,
          vx: Math.cos(a) * 55,
          vy: Math.sin(a) * 55,
          life: 0.35,
          max: 0.35,
          kind: "spark",
          scale: 0.7,
          color: "#f2b13d",
          rot: 0,
          vr: 0,
          w: 0.25,
        });
      }
    }
  }

  private die(trap: Ent) {
    if (this.state !== "playing") return;
    this.lives--;
    trap.snapping = true;
    trap.counted = true;
    this.shake = 16;
    this.flash = 0.55;
    this.sound.death();
    this.vib([50, 40, 90]);
    const tx = this.laneX(trap.lane);
    // Cantidad de polvo reducida de 14 a 6 para fluidez extrema
    if (this.parts.length < MAX_PARTICLES) {
      for (let i = 0; i < 6; i++) {
        this.parts.push({
          x: tx + rand(-15, 15),
          y: trap.y + rand(-10, 10),
          vx: rand(-60, 60),
          vy: rand(-80, 20),
          life: rand(0.3, 0.6),
          max: 0.6,
          kind: "dust",
          scale: rand(0.8, 1.5),
          color: "rgba(110,95,70,0.35)",
          rot: 0,
          vr: 0,
          w: 1,
        });
      }
    }

    if (this.lives <= 0) {
      // sin vidas: fin de la partida (slow-motion y panel)
      this.state = "dying";
      this.deathT = 0;
      this.stopTilt();
    } else {
      // perdió UNA vida: invulnerable 1.6 s (parpadea) y sigue corriendo
      this.invulnT = 1.6;
      this.aura = 0; // pierde el aura al fallar
      this.combo = 0;
      this.floats.push({
        x: this.W / 2,
        y: this.H * 0.4,
        vy: -26,
        life: 1.3,
        max: 1.3,
        text: `-1 VIDA · quedan ${this.lives}`,
        color: "#c23e1c",
        size: 26,
        stroke: "#faf4e4",
      });
    }
  }

  private collectStrawberry(x: number, y: number) {
    // Fresa ahora da un multiplicador por 10s (solamente 10 segundos)
    this.strawberryUntil = this.elapsed + 10;
    this.sound.cheese(3);
    this.vib(14);
    this.floats.push({
      x: this.W / 2,
      y: this.H * 0.38,
      vy: -30,
      life: 1.2,
      max: 1.2,
      text: "¡FRESA! queso ×20 por 10 s",
      color: "#c23e1c",
      size: 24,
      stroke: "#faf4e4",
    });
    // Cantidad de chispas de fresa reducida de 14 a 6 para optimizar rendimiento
    if (this.parts.length < MAX_PARTICLES) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        this.parts.push({
          x,
          y,
          vx: Math.cos(a) * rand(40, 80),
          vy: Math.sin(a) * rand(40, 80),
          life: rand(0.3, 0.5),
          max: 0.5,
          kind: "spark",
          scale: rand(0.6, 0.9),
          color: "#e4572e",
          rot: 0,
          vr: 0,
          w: 0.3,
        });
      }
    }
  }

  private collectBandaid(x: number, y: number) {
    if (this.lives < this.maxLives) this.lives++;
    this.sound.cheese(2);
    this.vib(14);
    this.floats.push({
      x: this.W / 2,
      y: this.H * 0.38,
      vy: -30,
      life: 1.2,
      max: 1.2,
      text: this.lives >= this.maxLives ? "Máximo!" : "+1 vida",
      color: "#2e8b6b",
      size: 28,
      stroke: "#faf4e4",
    });
    // Cantidad de chispas de curita reducida de 12 a 5 para óptimo rendimiento
    if (this.parts.length < MAX_PARTICLES) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        this.parts.push({
          x,
          y,
          vx: Math.cos(a) * rand(35, 75),
          vy: Math.sin(a) * rand(35, 75),
          life: rand(0.3, 0.5),
          max: 0.5,
          kind: "spark",
          scale: rand(0.5, 0.8),
          color: "#9bd1b0",
          rot: 0,
          vr: 0,
          w: 0.3,
        });
      }
    }
  }

  /* ---------------- render ---------------- */

  private render(t: number) {
    const ctx = this.ctx;
    const { W, H } = this;
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (this.shake > 0) {
      ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    }

    this.drawSky(ctx, t);
    this.drawRoad(ctx);
    this.drawDecor(ctx);

    // entidades ordenadas por Y (las de abajo delante)
    const sorted = [...this.ents].sort((a, b) => a.y - b.y);
    const py = this.playerY();
    for (const e of sorted) {
      if (e.taken) continue;
      const ex = this.laneX(e.lane) + e.xOff;
      ctx.save();
      ctx.translate(ex, e.y);
      if (e.type === "cheese") {
        drawCheese(ctx, t + e.seed * 10, 0.86);
      } else if (e.type === "strawberry") {
        drawStrawberry(ctx, t + e.seed * 10, 0.8);
      } else if (e.type === "bandaid") {
        drawBandaid(ctx, t + e.seed * 10, 0.8);
      } else {
        const near =
          this.state === "playing" && e.lane === this.player.lane
            ? clamp(1 - Math.abs(e.y - py - 90) / 260, 0, 1)
            : 0;
        drawTrap(ctx, 0.95, e.snapT, near * 2);
      }
      ctx.restore();
    }

    // jugador (parpadea mientras es invulnerable tras perder una vida)
    ctx.save();
    ctx.translate(this.player.x, py);
    if (this.invulnT > 0 && Math.floor(t / 90) % 2 === 0) ctx.globalAlpha = 0.35;
    drawMouse(ctx, {
      t,
      s: (this.laneW() / 118) * 1.06,
      lean: this.player.lean,
      running: this.state === "playing" && !this.paused,
      auraLevel: Math.min(1, this.aura / 9),
      dead: this.state !== "playing",
    });
    ctx.restore();

    this.drawParticles(ctx);
    this.drawFloats(ctx);

    // líneas de velocidad
    const s01 = clamp((this.speed - START_SPEED) / (MAX_SPEED - START_SPEED), 0, 1);
    if (s01 > 0.5 && this.state === "playing") {
      ctx.strokeStyle = `rgba(76,69,61,${(s01 - 0.5) * 0.35})`;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      const seed = Math.floor(t / 90);
      for (let i = 0; i < 4; i++) {
        const rx = ((seed * 373 + i * 761) % 1000) / 1000;
        const ry = ((seed * 911 + i * 613) % 1000) / 1000;
        const x = rx * W;
        const y = ry * H;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 34 + s01 * 40);
        ctx.stroke();
      }
    }

    ctx.restore();

    // flash rojo al morir
    if (this.flash > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, "rgba(194,62,28,0)");
      g.addColorStop(1, `rgba(194,62,28,${this.flash * 0.7})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawSky(ctx: CanvasRenderingContext2D, t: number) {
    const { W, H } = this;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, PALETTE.sky1);
    g.addColorStop(1, PALETTE.sky2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // sol bermellón
    const sunX = W * 0.76;
    const sunY = H * 0.16;
    ctx.fillStyle = PALETTE.sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 84, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 52, 0, Math.PI * 2);
    ctx.fill();
    // anillo de tinta
    ctx.strokeStyle = "rgba(76,69,61,0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 60, 0.2, Math.PI * 1.4);
    ctx.stroke();

    // montañas lejanas (dos bandas)
    const ridge = (yBase: number, amp: number, phase: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-4, H);
      for (let x = -4; x <= W + 4; x += 10) {
        const u = x / W;
        const y =
          yBase -
          Math.abs(Math.sin(u * Math.PI * 2.2 + phase)) * amp -
          Math.sin(u * Math.PI * 6.7 + phase * 2) * (amp * 0.18);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W + 4, H);
      ctx.closePath();
      ctx.fill();
    };
    // horizonte fijo: la cámara corre hacia adelante, no de lado
    ridge(H * 0.36, 56, 0.6, "rgba(213,199,164,0.55)");
    ridge(H * 0.45, 42, 2.1, "rgba(196,180,142,0.5)");

    // nubes
    for (const c of this.clouds) {
      ctx.save();
      ctx.translate(c.x * W, c.y * H);
      ctx.globalAlpha = 0.95;
      drawCloud(ctx, c.s * (W / 420));
      ctx.restore();
    }
    void t;
  }

  private drawRoad(ctx: CanvasRenderingContext2D) {
    const { W, H } = this;
    const m = this.margin();

    // márgenes de hierba
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, m, H);
    ctx.fillRect(W - m, 0, m, H);
    ctx.fillStyle = "rgba(147,168,119,0.6)";
    const gOff = this.scroll % 46;
    for (let y = -46 + gOff; y < H + 46; y += 46) {
      ctx.fillRect(m - 3, y, 3, 22);
      ctx.fillRect(W - m, y + 20, 3, 22);
    }

    // camino
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(m, 0, W - m * 2, H);
    // bandas sutiles para sensación de velocidad
    ctx.fillStyle = "rgba(120,100,70,0.045)";
    const bOff = this.scroll % 130;
    for (let y = -130 + bOff; y < H + 130; y += 130) {
      ctx.fillRect(m, y, W - m * 2, 26);
    }
    // bordes de tinta
    ctx.strokeStyle = PALETTE.roadEdge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(m, 0);
    ctx.lineTo(m, H);
    ctx.moveTo(W - m, 0);
    ctx.lineTo(W - m, H);
    ctx.stroke();

    // separadores de carril (discontinuos, se desplazan)
    ctx.strokeStyle = "rgba(76,69,61,0.16)";
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 36]);
    ctx.lineDashOffset = -(this.scroll % 62);
    for (let i = 1; i < LANES; i++) {
      const x = m + this.laneW() * i;
      ctx.beginPath();
      ctx.moveTo(x, -62);
      ctx.lineTo(x, H + 62);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  private drawDecor(ctx: CanvasRenderingContext2D) {
    for (const d of this.decor) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      if (d.kind === "tuft") drawTuft(ctx, d.s);
      else if (d.kind === "stone") drawStone(ctx, d.s);
      else drawTorii(ctx, d.s);
      ctx.restore();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.kind === "spark") {
        drawSpark(ctx, p.scale, p.color);
      } else if (p.kind === "petal") {
        drawPetal(ctx, p.scale);
      } else if (p.kind === "flame") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -7 * p.scale);
        ctx.quadraticCurveTo(5 * p.scale, 0, 0, 5 * p.scale);
        ctx.quadraticCurveTo(-5 * p.scale, 0, 0, -7 * p.scale);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, 5 * p.scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawFloats(ctx: CanvasRenderingContext2D) {
    for (const f of this.floats) {
      const a = clamp(f.life / f.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = Math.min(1, a * 2);
      ctx.font = `900 ${f.size}px 'Zen Maru Gothic', sans-serif`;
      ctx.textAlign = "center";
      if (f.stroke) {
        ctx.lineWidth = 5;
        ctx.strokeStyle = f.stroke;
        ctx.strokeText(f.text, f.x, f.y);
      }
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

}
