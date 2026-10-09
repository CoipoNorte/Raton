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
} from "./draw";
import type { SoundEngine } from "./audio";
import { buzz } from "./audio";

export interface HudState {
  distance: number;
  cheese: number;
  aura: number;
  auraMult: number;
  speed01: number;
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

type EntType = "trap" | "cheese";
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

const START_SPEED = 300;
const MAX_SPEED = 840;
const RAMP_T = 80; // segundos hasta velocidad máxima
const PX_PER_M = 52;
const LANES = 3;
const TRAP_CHEESE_GAP = 128;

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

  setPaused(p: boolean) {
    if (this.paused === p) return;
    this.paused = p;
    this.cb.onPauseChange?.(p);
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

  move(dir: -1 | 1) {
    if (this.state !== "playing" || this.paused) return;
    const next = clamp(this.player.lane + dir, 0, LANES - 1);
    if (next === this.player.lane) {
      // tope contra el borde: micro-choque con feedback
      this.sound.thud();
      this.shake = Math.max(this.shake, 2.5);
      return;
    }
    this.player.lane = next;
    this.sound.swipe();
    buzz(8);
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

  private spawnEnt(type: EntType, lane: number, yOff: number) {
    // Nunca permitimos que queso y trampa queden visualmente superpuestos.
    // Si un patrón nuevo alcanza uno anterior, aparece más arriba.
    let safeY = yOff;
    for (let pass = 0; pass < 8; pass++) {
      const conflict = this.ents.find(
        (e) =>
          e.type !== type &&
          !e.taken &&
          Math.abs(e.y - safeY) < TRAP_CHEESE_GAP
      );
      if (!conflict) break;
      safeY = conflict.y - TRAP_CHEESE_GAP;
    }
    this.ents.push({
      type,
      lane,
      y: safeY,
      xOff: 0,
      seed: Math.random() * 1000,
      counted: false,
      snapping: false,
      snapT: 0,
      taken: false,
    });
  }

  /** Genera una fila de patrón (selección ponderada). Devuelve multiplicador de hueco. */
  private spawnRow(): number {
    const t01 = clamp(this.elapsed / RAMP_T, 0, 1);
    const patterns: { w: number; run: () => number }[] = [
      {
        // trampa simple
        w: Math.max(0.8, 2.6 - t01 * 0.9),
        run: () => {
          this.spawnEnt("trap", Math.floor(rand(0, 3)), -70);
          return 1;
        },
      },
      {
        // doble trampa: un carril libre (+ queso de premio)
        w: 0.35 + t01 * 2.3,
        run: () => {
          const free = Math.floor(rand(0, 3));
          for (let l = 0; l < 3; l++) if (l !== free) this.spawnEnt("trap", l, -70);
          if (Math.random() < 0.55) this.spawnEnt("cheese", free, -70 - 150);
          return 1.45;
        },
      },
      {
        // dos trampas escalonadas
        w: t01 * 1.4,
        run: () => {
          const a = Math.floor(rand(0, 3));
          this.spawnEnt("trap", a, -70);
          this.spawnEnt("trap", clamp(a + pick([-1, 1, 2]), 0, 2), -70 - 300);
          return 1.5;
        },
      },
      {
        // trampa + queso cebo delante de ella (riesgo/recompensa)
        w: 1.6,
        run: () => {
          const lane = Math.floor(rand(0, 3));
          this.spawnEnt("trap", lane, -70);
          // En los extremos no usamos clamp: podría devolver el mismo carril.
          const side = lane === 0 ? 1 : lane === 2 ? 1 : pick([0, 2]);
          // 140px mas alto = ~0.28 s para reaccionar al cebo
          this.spawnEnt("cheese", side, -70 - 140);
          return 1.15;
        },
      },
      {
        // fila de quesos en un carril
        w: 1.6,
        run: () => {
          const lane = Math.floor(rand(0, 3));
          const n = Math.floor(rand(3, 6));
          for (let i = 0; i < n; i++) this.spawnEnt("cheese", lane, -70 - i * 130);
          return 1 + n * 0.22;
        },
      },
      {
        // fila horizontal de queso (los 3 carriles)
        w: 1,
        run: () => {
          for (let l = 0; l < 3; l++) this.spawnEnt("cheese", l, -70);
          return 1;
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
          return 1.2;
        },
      },
    ];
    const total = patterns.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * total;
    for (const p of patterns) {
      r -= p.w;
      if (r <= 0) return p.run();
    }
    return 1;
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
      const t01 = clamp(this.elapsed / RAMP_T, 0, 1);
      const ease = t01 * t01 * (3 - 2 * t01);
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
        for (let i = 0; i < 16; i++) {
          this.parts.push({
            x: this.W / 2 + rand(-70, 70),
            y: this.H * 0.3 + rand(-20, 20),
            vx: rand(-60, 60),
            vy: rand(-40, 90),
        life: rand(0.8, 1.6),
        max: 1.6,
        kind: "petal",
        scale: rand(0.7, 1.3),
        color: PALETTE.petal,
        rot: rand(0, Math.PI * 2),
        vr: rand(-4, 4),
        w: 0.35,
      });
        }
        this.milestoneNext += 500;
      }
    }

    // scroll del mundo
    this.scroll += this.speed * dt;

    // generación de patrones
    if (this.state === "playing" && this.graceT <= 0 && this.scroll >= this.nextRowAt) {
      const mul = this.spawnRow();
      const gap = clamp(this.speed * 0.55, 200, 560) * mul * rand(0.92, 1.14);
      this.nextRowAt = this.scroll + gap;
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
          if (hitX < this.laneW() * 0.38 && Math.abs(dy) < 40) {
            this.die(e);
          } else if (!e.counted && dy > 52) {
            e.counted = true;
            if (hitX < this.laneW() * 1.18) this.nearMiss();
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

    // pétalos ambientales
    if (Math.random() < rawDt * 3.2) {
      this.parts.push({
        x: rand(0, this.W),
        y: -20,
        vx: rand(-28, 4),
        vy: rand(24, 60),
        life: rand(2.5, 4.5),
        max: 4.5,
        kind: "petal",
        scale: rand(0.6, 1.1),
        color: PALETTE.petal,
        rot: rand(0, Math.PI * 2),
        vr: rand(-2, 2),
        w: 0.35,
      });
    }

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
    });
  }

  private collectCheese(x: number, y: number) {
    this.cheeseN++;
    this.combo++;
    this.comboTimer = 1.9;
    const amount = 100 * this.combo;
    this.distance += amount;
    this.sound.cheese(this.combo);
    buzz(12);
    const label =
      this.combo > 1 ? `+${amount} ×${this.combo}` : `+${amount}`;
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
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * rand(40, 110),
        vy: Math.sin(a) * rand(40, 110),
        life: rand(0.3, 0.55),
        max: 0.55,
        kind: "spark",
        scale: rand(0.6, 1),
        color: PALETTE.cheese,
        rot: 0,
        vr: 0,
        w: 0.25,
      });
    }
  }

  private nearMiss() {
    this.aura++;
    this.auraMax = Math.max(this.auraMax, this.aura);
    this.sound.aura();
    buzz(8);
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
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.parts.push({
        x: this.player.x + Math.cos(a) * 22,
        y: py + Math.sin(a) * 22,
        vx: Math.cos(a) * 70,
        vy: Math.sin(a) * 70,
        life: 0.45,
        max: 0.45,
        kind: "spark",
        scale: 0.8,
        color: "#f2b13d",
        rot: 0,
        vr: 0,
        w: 0.25,
      });
    }
  }

  private die(trap: Ent) {
    if (this.state !== "playing") return;
    this.state = "dying";
    trap.snapping = true;
    this.deathT = 0;
    this.shake = 16;
    this.flash = 0.55;
    this.sound.death();
    buzz([50, 40, 90]);
    const tx = this.laneX(trap.lane);
    for (let i = 0; i < 14; i++) {
      this.parts.push({
        x: tx + rand(-20, 20),
        y: trap.y + rand(-14, 14),
        vx: rand(-90, 90),
        vy: rand(-120, 40),
        life: rand(0.4, 0.8),
        max: 0.8,
        kind: "dust",
        scale: rand(1, 2),
        color: "rgba(110,95,70,0.4)",
        rot: 0,
        vr: 0,
        w: 1,
      });
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
      } else {
        const near =
          this.state === "playing" && e.lane === this.player.lane
            ? clamp(1 - Math.abs(e.y - py - 90) / 260, 0, 1)
            : 0;
        drawTrap(ctx, 0.95, e.snapT, near * 2);
      }
      ctx.restore();
    }

    // jugador
    ctx.save();
    ctx.translate(this.player.x, py);
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
