/**
 * RATÓN — snakeEngine.ts
 * Modo "Fila de Ratones" (escenario cuadrado 11×11):
 * - Cada queso suma 1 ratoncito a tu fila.
 * - Las paredes son PORTALES: si sales por la derecha apareces por la
 *   izquierda a la misma altura (igual arriba/abajo). Nunca hacen daño.
 * - Chocar con tu propia fila o con una trampa quita la MITAD de la fila.
 * - Sin ratoncitos y sin escudo, un golpe termina la partida.
 * - Las curitas dan escudos contra pérdidas (máximo 3).
 *
 * Rendimiento: el escenario estático (fondo, marco y tatami) se dibuja una
 * sola vez; crías y trampas son sprites cacheados; en pausa o tras el final
 * no se redibuja; y la resolución interna baja sola si el móvil no da abasto.
 */

import {
  PALETTE,
  drawBandaid,
  drawCheese,
  drawMouse,
  drawPetal,
  drawSpark,
  drawTrap,
  type MouseDir,
} from "./draw";
import type { SoundEngine } from "./audio";
import { buzz } from "./audio";
import {
  SpriteCache,
  compact,
  drawBabyMouseFast,
  drawTrapFast,
  makeCanvas,
} from "./sprites";

export const SNAKE_GRID = 11;
const MAX_SHIELDS = 3;
const MAX_PARTICLES = 36;
const MAX_FLOATS = 6;
const BASE_STEP = 0.235; // segundos por casilla al iniciar
const MIN_STEP = 0.132; // velocidad máxima
/** Resolución interna según rendimiento (alta → media → baja) */
const QUALITY_DPR = [2, 1.5, 1];

export interface SnakeHudState {
  cheese: number;
  followers: number;
  maxChain: number;
  shields: number;
  speed01: number;
}

export interface SnakeRunResult {
  cheese: number;
  maxChain: number;
  shieldsMax: number;
}

interface SnakeCallbacks {
  sound: SoundEngine;
  onHud: (h: SnakeHudState) => void;
  onGameOver: (r: SnakeRunResult) => void;
  onPauseChange?: (paused: boolean) => void;
  onFatal?: () => void;
}

interface Cell {
  x: number;
  y: number;
}

interface Follower extends Cell {
  prevX: number;
  prevY: number;
  dir: MouseDir;
}

interface TrapEnt extends Cell {
  seed: number;
  snapping: boolean;
  snapT: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: "spark" | "petal";
  scale: number;
  color: string;
  rot: number;
  vr: number;
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
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** coordenada envuelta: el tablero no tiene bordes, solo portales */
const wrap = (v: number) => ((v % SNAKE_GRID) + SNAKE_GRID) % SNAKE_GRID;
/** distancia más corta en un eje contando el cruce de paredes */
const torDist = (a: number, b: number) => {
  const d = Math.abs(a - b);
  return Math.min(d, SNAKE_GRID - d);
};
/** paso real (-1, 0, +1) entre casillas vecinas aunque se cruce una pared */
const stepDelta = (from: number, to: number) => {
  let d = to - from;
  if (d > 1) d -= SNAKE_GRID;
  else if (d < -1) d += SNAKE_GRID;
  return d;
};

const DIR_DELTA: Record<MouseDir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const NEIGHBORS: Cell[] = [DIR_DELTA.up, DIR_DELTA.down, DIR_DELTA.left, DIR_DELTA.right];

const OPPOSITE: Record<MouseDir, MouseDir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

/** Hacia dónde mira un segmento según su paso real (portales incluidos) */
function dirBetween(
  fx: number,
  fy: number,
  tx: number,
  ty: number,
  fallback: MouseDir
): MouseDir {
  const dx = stepDelta(fx, tx);
  const dy = stepDelta(fy, ty);
  if (dx > 0) return "right";
  if (dx < 0) return "left";
  if (dy > 0) return "down";
  if (dy < 0) return "up";
  return fallback;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export class RatonSnakeGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: SnakeCallbacks;
  private sound: SoundEngine;

  private raf = 0;
  private alive = true;
  private last = 0;
  private W = 360;
  private H = 360;
  private dpr = 1;
  private boardX = 0;
  private boardY = 0;
  boardSize = 320;
  cellSize = 28;
  private ro: ResizeObserver | null = null;
  private onWindowResize = () => this.resize();

  // --- rendimiento ---
  private sprites = new SpriteCache();
  private bg: HTMLCanvasElement | null = null;
  private bgDirty = true;
  private needsRender = true;
  private settleT = 0.6;
  private quality = 0;
  private dtAvg = 1 / 60;
  private slowT = 0;
  private wallT = 0;
  /** posiciones a dibujar de un segmento (2 si está cruzando un portal) */
  private segPos = [0, 0, 0, 0];

  state: "playing" | "dying" | "dead" = "playing";
  paused = false;
  vibrateEnabled = true;

  // Jugador y fila
  head: Cell = { x: 5, y: 6 };
  prevHead: Cell = { x: 5, y: 6 };
  dir: MouseDir = "up";
  turnQueue: MouseDir[] = [];
  followers: Follower[] = [];

  // Objetos en tablero
  cheese: Cell = { x: 5, y: 3 };
  private cheeseSeed = Math.random() * 1000;
  traps: TrapEnt[] = [];
  bandaid: Cell | null = null;
  private bandaidTimer = 0;
  private nextBandaidIn = 10;

  // Progreso y estado
  cheeseCount = 0;
  maxChain = 0;
  shields = 0;
  shieldsMax = 0;
  readonly maxShields = MAX_SHIELDS;
  private elapsed = 0;
  private tickAccum = 0;
  private stepDur = BASE_STEP;
  invulnT = 0;
  private deathT = 0;
  private shake = 0;
  private flash = 0;
  private flashColor = "rgba(194,62,28,";

  // Feedback visual limitado
  parts: Particle[] = [];
  floats: FloatText[] = [];

  // Giroscopio en 4 direcciones
  tiltActive = false;
  private tiltHandler?: (e: DeviceOrientationEvent) => void;
  private tiltBaseX: number | null = null;
  private tiltBaseY: number | null = null;
  private tiltSmoothX = 0;
  private tiltSmoothY = 0;
  private tiltCalib: { x: number; y: number }[] = [];
  private tiltArmed = true;
  private tiltLastAt = 0;

  private keyHandler = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
      e.preventDefault();
      this.turn("up");
    } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      e.preventDefault();
      this.turn("down");
    } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      e.preventDefault();
      this.turn("left");
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      e.preventDefault();
      this.turn("right");
    }
  };

  private visHandler = () => {
    if (document.hidden && this.state === "playing" && !this.paused) {
      this.setPaused(true);
    }
  };

  constructor(canvas: HTMLCanvasElement, cb: SnakeCallbacks) {
    this.canvas = canvas;
    this.cb = cb;
    this.sound = cb.sound;
    // el escenario siempre es opaco: sin canal alfa el navegador compone más rápido
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.ctx = ctx;

    this.resize();
    this.initBoard();

    window.addEventListener("keydown", this.keyHandler);
    document.addEventListener("visibilitychange", this.visHandler);

    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas.parentElement ?? canvas);
    } else {
      window.addEventListener("resize", this.onWindowResize);
    }

    this.pushFloat(
      this.boardX + this.boardSize / 2,
      this.boardY + this.boardSize * 0.42,
      "¡A COMER!",
      PALETTE.sun,
      30
    );
    this.emitHud();
  }

  private initBoard() {
    const mid = Math.floor(SNAKE_GRID / 2);
    this.head = { x: mid, y: mid + 1 };
    this.prevHead = { ...this.head };
    this.dir = "up";
    this.turnQueue = [];
    this.followers = [];
    this.cheese = { x: mid, y: mid - 2 };
    this.traps = [];
    this.spawnTrap(true);
    this.spawnTrap(true);
  }

  private resize() {
    const parent = this.canvas.parentElement;
    const bounds = parent?.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(bounds?.width || window.innerWidth || 360));
    const cssH = Math.max(1, Math.round(bounds?.height || window.innerHeight || 420));
    const dpr = Math.min(window.devicePixelRatio || 1, QUALITY_DPR[this.quality]);
    this.W = cssW;
    this.H = cssH;
    this.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // escenario estrictamente cuadrado y centrado
    const pad = 12;
    this.boardSize = Math.max(180, Math.min(cssW - pad * 2, cssH - pad * 2));
    this.cellSize = this.boardSize / SNAKE_GRID;
    this.boardX = (cssW - this.boardSize) / 2;
    this.boardY = (cssH - this.boardSize) / 2;

    // todo lo cacheado depende del tamaño y la resolución
    this.bgDirty = true;
    this.sprites.clear();
    this.needsRender = true;
  }

  setPaused(p: boolean) {
    if (this.paused === p) return;
    this.paused = p;
    this.needsRender = true;
    this.cb.onPauseChange?.(p);
  }

  private vib(pattern: number | number[]) {
    buzz(pattern, this.vibrateEnabled);
  }

  /* ---------------- Giroscopio en 4 direcciones ---------------- */

  startTilt() {
    if (this.tiltHandler || typeof window.addEventListener !== "function") return;
    this.tiltBaseX = null;
    this.tiltBaseY = null;
    this.tiltCalib = [];
    this.tiltArmed = true;
    this.tiltLastAt = 0;
    const handler = (e: DeviceOrientationEvent) => {
      if (this.state !== "playing" || this.paused) return;
      const gx = typeof e.gamma === "number" ? e.gamma : null;
      const by = typeof e.beta === "number" ? e.beta : null;
      if (gx === null || by === null) return;

      if (this.tiltBaseX === null || this.tiltBaseY === null) {
        this.tiltCalib.push({ x: gx, y: by });
        if (this.tiltCalib.length >= 8) {
          this.tiltBaseX =
            this.tiltCalib.reduce((s, v) => s + v.x, 0) / this.tiltCalib.length;
          this.tiltBaseY =
            this.tiltCalib.reduce((s, v) => s + v.y, 0) / this.tiltCalib.length;
          this.tiltSmoothX = this.tiltBaseX;
          this.tiltSmoothY = this.tiltBaseY;
          this.tiltCalib = [];
        }
        return;
      }

      this.tiltSmoothX += (gx - this.tiltSmoothX) * 0.35;
      this.tiltSmoothY += (by - this.tiltSmoothY) * 0.35;
      const rx = this.tiltSmoothX - this.tiltBaseX;
      const ry = this.tiltSmoothY - this.tiltBaseY;
      const now = performance.now();

      if (Math.abs(rx) < 7 && Math.abs(ry) < 7) {
        this.tiltArmed = true;
        return;
      }
      if (!this.tiltArmed || now - this.tiltLastAt < 200) return;

      let chosen: MouseDir | null = null;
      if (Math.abs(rx) >= Math.abs(ry)) {
        if (rx <= -13) chosen = "left";
        else if (rx >= 13) chosen = "right";
      } else {
        if (ry <= -13) chosen = "up";
        else if (ry >= 13) chosen = "down";
      }
      if (chosen) {
        this.turn(chosen, true);
        this.tiltArmed = false;
        this.tiltLastAt = now;
      }
    };
    this.tiltHandler = handler;
    window.addEventListener("deviceorientation", handler);
    this.tiltActive = true;
  }

  stopTilt() {
    this.tiltActive = false;
    this.tiltBaseX = null;
    this.tiltBaseY = null;
    this.tiltCalib = [];
    if (this.tiltHandler) {
      window.removeEventListener("deviceorientation", this.tiltHandler);
      this.tiltHandler = undefined;
    }
  }

  /* ---------------- Entrada de dirección ---------------- */

  turn(nextDir: MouseDir, silent = false) {
    if (this.state !== "playing" || this.paused) return;
    const refDir =
      this.turnQueue.length > 0
        ? this.turnQueue[this.turnQueue.length - 1]
        : this.dir;
    if (nextDir === refDir || nextDir === OPPOSITE[refDir]) return;
    if (this.turnQueue.length >= 2) return;
    this.turnQueue.push(nextDir);
    if (!silent) {
      this.sound.swipe();
      this.vib(6);
    }
  }

  /* ---------------- Ciclo principal ---------------- */

  start() {
    this.sound.unlock();
    this.sound.start();
    this.last = performance.now();
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
        if (!this.paused) this.update(rawDt);

        // En pausa o tras el final la escena queda tapada: se dibuja un
        // momento más para que asienten los efectos y luego se deja de
        // redibujar (batería, y el desenfoque del panel no se recalcula).
        const idle = this.paused || this.state === "dead";
        if (idle) {
          this.settleT = Math.max(0, this.settleT - rawDt);
        } else {
          this.settleT = 0.6;
          this.tuneQuality(rawDt);
        }
        if (!idle || this.settleT > 0 || this.needsRender) {
          this.needsRender = false;
          this.render(t);
        }
        this.raf = requestAnimationFrame(loop);
      } catch {
        this.fail();
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Si el móvil no sostiene ~40 fps, baja la resolución interna (sin volver a subir). */
  private tuneQuality(rawDt: number) {
    this.wallT += rawDt;
    this.dtAvg += (rawDt - this.dtAvg) * 0.06;
    if (this.wallT < 2.5 || this.quality >= QUALITY_DPR.length - 1) return;
    if (this.dtAvg > 0.027) {
      this.slowT += rawDt;
      if (this.slowT > 1.5) {
        this.quality++;
        this.slowT = 0;
        this.wallT = 0;
        this.dtAvg = 1 / 60;
        this.resize();
      }
    } else {
      this.slowT = Math.max(0, this.slowT - rawDt);
    }
  }

  private fail() {
    if (!this.alive) return;
    this.destroy();
    this.cb.onFatal?.();
  }

  destroy() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.stopTilt();
    window.removeEventListener("keydown", this.keyHandler);
    document.removeEventListener("visibilitychange", this.visHandler);
    this.ro?.disconnect();
    window.removeEventListener("resize", this.onWindowResize);
    this.sprites.clear();
    this.bg = null;
  }

  /* ---------------- Lógica de actualización ---------------- */

  update(rawDt: number) {
    if (this.state === "dying") {
      this.deathT += rawDt;
      if (this.deathT > 0.85) {
        this.state = "dead";
        this.cb.onGameOver({
          cheese: this.cheeseCount,
          maxChain: this.maxChain,
          shieldsMax: this.shieldsMax,
        });
      }
    }

    if (this.state === "playing") {
      this.elapsed += rawDt;
      if (this.invulnT > 0) this.invulnT = Math.max(0, this.invulnT - rawDt);

      // la velocidad sube suave con los quesos comidos
      this.stepDur = Math.max(
        MIN_STEP,
        BASE_STEP - Math.min(this.cheeseCount, 35) * 0.0029
      );

      this.tickAccum += rawDt;
      while (this.tickAccum >= this.stepDur && this.state === "playing") {
        this.tickAccum -= this.stepDur;
        this.stepTick();
      }

      // curitas (escudos) cuando hay menos de 3
      if (this.bandaid) {
        this.bandaidTimer -= rawDt;
        if (this.bandaidTimer <= 0) {
          this.bandaid = null;
          this.nextBandaidIn = rand(9, 15);
        }
      } else if (this.shields < MAX_SHIELDS) {
        this.nextBandaidIn -= rawDt;
        if (this.nextBandaidIn <= 0) {
          this.spawnBandaid();
          this.nextBandaidIn = rand(11, 17);
        }
      }
    }

    // trampas que se cierran al golpearlas
    for (const tr of this.traps) {
      if (tr.snapping) tr.snapT = Math.min(1, tr.snapT + rawDt / 0.14);
    }
    compact(this.traps, (tr) => !(tr.snapping && tr.snapT >= 1));

    // partículas y textos (filtrados en su sitio: sin basura por frame)
    for (const p of this.parts) {
      p.life -= rawDt;
      p.x += p.vx * rawDt;
      p.y += p.vy * rawDt;
      p.rot += p.vr * rawDt;
    }
    compact(this.parts, (p) => p.life > 0);
    if (this.parts.length > MAX_PARTICLES) {
      this.parts.splice(0, this.parts.length - MAX_PARTICLES);
    }

    for (const f of this.floats) {
      f.life -= rawDt;
      f.y += f.vy * rawDt;
    }
    compact(this.floats, (f) => f.life > 0);
    if (this.floats.length > MAX_FLOATS) {
      this.floats.splice(0, this.floats.length - MAX_FLOATS);
    }

    // pétalos suaves (desactivados en calidad baja)
    if (
      this.quality < 2 &&
      this.parts.length < MAX_PARTICLES - 12 &&
      Math.random() < rawDt * 0.9
    ) {
      this.parts.push({
        x: rand(0, this.W),
        y: -14,
        vx: rand(-14, 4),
        vy: rand(18, 36),
        life: rand(1.4, 2.2),
        max: 2.2,
        kind: "petal",
        scale: rand(0.45, 0.8),
        color: PALETTE.petal,
        rot: rand(0, Math.PI * 2),
        vr: rand(-1.5, 1.5),
      });
    }

    this.shake *= Math.pow(0.001, rawDt);
    if (this.shake < 0.2) this.shake = 0;
    this.flash = Math.max(0, this.flash - rawDt * 2.1);

    this.emitHud();
  }

  private emitHud() {
    const speed01 = clamp(
      (BASE_STEP - this.stepDur) / (BASE_STEP - MIN_STEP),
      0,
      1
    );
    this.cb.onHud({
      cheese: this.cheeseCount,
      followers: this.followers.length,
      maxChain: this.maxChain,
      shields: this.shields,
      speed01,
    });
  }

  /** Avanza un paso discreto en el tablero (las paredes son portales) */
  stepTick() {
    if (this.turnQueue.length > 0) {
      const candidate = this.turnQueue.shift()!;
      if (candidate !== OPPOSITE[this.dir]) this.dir = candidate;
    }

    const d = DIR_DELTA[this.dir];
    // sale por un lado → entra por el contrario a la misma altura
    const nx = wrap(this.head.x + d.x);
    const ny = wrap(this.head.y + d.y);
    const crossed = nx !== this.head.x + d.x || ny !== this.head.y + d.y;

    const oldHead = { x: this.head.x, y: this.head.y };
    const oldFollowers = this.followers.map((f) => ({ x: f.x, y: f.y, dir: f.dir }));
    const tail =
      oldFollowers.length > 0
        ? oldFollowers[oldFollowers.length - 1]
        : { x: oldHead.x, y: oldHead.y, dir: this.dir };

    const eatingCheese = nx === this.cheese.x && ny === this.cheese.y;

    // mover cabeza y fila (cada cría mira hacia donde realmente avanza)
    this.prevHead = oldHead;
    this.head = { x: nx, y: ny };
    for (let i = 0; i < this.followers.length; i++) {
      const f = this.followers[i];
      const target = i === 0 ? oldHead : oldFollowers[i - 1];
      f.prevX = oldFollowers[i].x;
      f.prevY = oldFollowers[i].y;
      f.x = target.x;
      f.y = target.y;
      f.dir = dirBetween(f.prevX, f.prevY, f.x, f.y, f.dir);
    }

    if (crossed) this.portalPuff(oldHead, this.head, d);

    // 1. choque con la propia fila (si no crece, la última celda ya se liberó)
    const checkCount = eatingCheese
      ? oldFollowers.length
      : Math.max(0, oldFollowers.length - 1);
    let hitSelf = false;
    for (let i = 0; i < checkCount; i++) {
      if (oldFollowers[i].x === nx && oldFollowers[i].y === ny) {
        hitSelf = true;
        break;
      }
    }
    if (hitSelf && this.invulnT <= 0) {
      if (!this.handleImpact("self", this.head)) return;
    }

    // 2. choque con una trampa
    const trap = this.traps.find((tr) => !tr.snapping && tr.x === nx && tr.y === ny);
    if (trap && this.invulnT <= 0) {
      trap.snapping = true;
      if (!this.handleImpact("trap", this.head)) return;
    }

    // 3. curita → escudo (máx 3)
    if (this.bandaid && this.bandaid.x === nx && this.bandaid.y === ny) {
      this.collectBandaid();
    }

    // 4. queso → se une un ratoncito al final de la fila
    if (eatingCheese) {
      this.followers.push({
        x: tail.x,
        y: tail.y,
        prevX: tail.x,
        prevY: tail.y,
        dir: tail.dir,
      });
      this.collectCheese();
    }

    // reponer trampas según el progreso
    const targetTraps = Math.min(11, 2 + Math.floor(this.cheeseCount / 3));
    let active = 0;
    for (const t of this.traps) if (!t.snapping) active++;
    if (active < targetTraps && Math.random() < 0.45) this.spawnTrap(false);
  }

  /**
   * Choque con la fila o una trampa:
   * - con escudo: gasta 1 y conserva toda la fila;
   * - sin escudo y con crías: pierde LA MITAD;
   * - sin escudo ni crías: fin de la partida.
   * Devuelve true si sigue vivo.
   */
  private handleImpact(kind: "self" | "trap", cell: Cell): boolean {
    const cx = this.cellCenterX(cell.x);
    const cy = this.cellCenterY(cell.y);

    if (this.shields > 0) {
      this.shields--;
      this.invulnT = 1.35;
      this.shake = 7;
      this.flash = 0.35;
      this.flashColor = "rgba(155,209,176,";
      this.sound.shieldSave();
      this.vib([20, 20]);
      this.pushFloat(cx, cy - 16, "¡Escudo!", "#2e8b6b", 22);
      this.burst(cx, cy, "#9bd1b0", 8);
      return true;
    }

    if (this.followers.length > 0) {
      const before = this.followers.length;
      const lost = Math.max(1, Math.ceil(before / 2));
      const dropped = this.followers.splice(before - lost, lost);
      this.invulnT = 1.35;
      this.shake = 12;
      this.flash = 0.48;
      this.flashColor = "rgba(194,62,28,";
      this.sound.split();
      this.vib([40, 30, 60]);
      this.pushFloat(
        cx,
        cy - 18,
        kind === "self" ? `¡Enredo! -${lost}` : `¡Trampa! -${lost}`,
        "#c23e1c",
        22
      );
      for (let i = 0; i < Math.min(6, dropped.length); i++) {
        const dm = dropped[i];
        this.burst(this.cellCenterX(dm.x), this.cellCenterY(dm.y), "#a7b2bd", 3);
      }
      return true;
    }

    // sin escudos ni crías → fin
    this.state = "dying";
    this.deathT = 0;
    this.shake = 16;
    this.flash = 0.6;
    this.flashColor = "rgba(194,62,28,";
    this.stopTilt();
    this.sound.death();
    this.vib([50, 40, 90]);
    this.burst(cx, cy, "rgba(110,95,70,0.65)", 10);
    return false;
  }

  /** Chispas bermellón donde la fila sale y donde vuelve a entrar */
  private portalPuff(from: Cell, to: Cell, d: Cell) {
    if (this.parts.length > MAX_PARTICLES - 6) return;
    const half = this.cellSize * 0.5;
    this.burst(
      this.cellCenterX(from.x) + d.x * half,
      this.cellCenterY(from.y) + d.y * half,
      PALETTE.sun,
      3
    );
    this.burst(
      this.cellCenterX(to.x) - d.x * half,
      this.cellCenterY(to.y) - d.y * half,
      PALETTE.sun,
      3
    );
  }

  private collectCheese() {
    this.cheeseCount++;
    this.maxChain = Math.max(this.maxChain, this.followers.length);
    this.sound.cheese(Math.min(8, 1 + (this.followers.length % 8)));
    this.vib(12);
    const cx = this.cellCenterX(this.head.x);
    const cy = this.cellCenterY(this.head.y);
    this.pushFloat(cx, cy - 16, "+1", PALETTE.cheeseDeep, 22);
    this.burst(cx, cy, PALETTE.cheese, 6);
    this.spawnCheese();
  }

  private collectBandaid() {
    if (!this.bandaid) return;
    const cx = this.cellCenterX(this.bandaid.x);
    const cy = this.cellCenterY(this.bandaid.y);
    this.bandaid = null;
    if (this.shields < MAX_SHIELDS) {
      this.shields++;
      this.shieldsMax = Math.max(this.shieldsMax, this.shields);
      this.sound.shieldGet();
      this.vib(14);
      this.pushFloat(cx, cy - 16, `Escudo ${this.shields}/3`, "#2e8b6b", 20);
      this.burst(cx, cy, "#9bd1b0", 7);
    }
  }

  /* ---------------- Generación segura (tablero sin bordes) ---------------- */

  private hasTrap(x: number, y: number): boolean {
    for (const t of this.traps) if (!t.snapping && t.x === x && t.y === y) return true;
    return false;
  }

  private isOccupied(x: number, y: number): boolean {
    if (this.head.x === x && this.head.y === y) return true;
    for (const f of this.followers) if (f.x === x && f.y === y) return true;
    if (this.cheese.x === x && this.cheese.y === y) return true;
    if (this.bandaid && this.bandaid.x === x && this.bandaid.y === y) return true;
    return this.hasTrap(x, y);
  }

  private freeNeighbors(x: number, y: number): number {
    let n = 0;
    for (const d of NEIGHBORS) {
      if (!this.hasTrap(wrap(x + d.x), wrap(y + d.y))) n++;
    }
    return n;
  }

  /** BFS sobre 11×11 contando portales: qué casillas se alcanzan sin trampas */
  private reachableSet(blockX = -1, blockY = -1): Set<number> {
    const start = this.head.y * SNAKE_GRID + this.head.x;
    const visited = new Set<number>([start]);
    const queue: number[] = [start];
    let qi = 0;
    while (qi < queue.length) {
      const key = queue[qi++];
      const cx = key % SNAKE_GRID;
      const cy = (key - cx) / SNAKE_GRID;
      for (const d of NEIGHBORS) {
        const nx = wrap(cx + d.x);
        const ny = wrap(cy + d.y);
        const nk = ny * SNAKE_GRID + nx;
        if (visited.has(nk)) continue;
        if (nx === blockX && ny === blockY) continue;
        if (this.hasTrap(nx, ny)) continue;
        visited.add(nk);
        queue.push(nk);
      }
    }
    return visited;
  }

  private spawnCheese() {
    const reach = this.reachableSet();
    const preferred: Cell[] = [];
    const fallback: Cell[] = [];
    for (let y = 0; y < SNAKE_GRID; y++) {
      for (let x = 0; x < SNAKE_GRID; x++) {
        if (this.isOccupied(x, y)) continue;
        if (!reach.has(y * SNAKE_GRID + x)) continue;
        if (this.freeNeighbors(x, y) >= 2) preferred.push({ x, y });
        else fallback.push({ x, y });
      }
    }
    const pool = preferred.length > 0 ? preferred : fallback;
    if (pool.length > 0) {
      this.cheese = pool[Math.floor(Math.random() * pool.length)];
      this.cheeseSeed = Math.random() * 1000;
    }
  }

  private spawnTrap(initial: boolean) {
    const candidates: Cell[] = [];
    const hd = DIR_DELTA[this.dir];
    for (let y = 0; y < SNAKE_GRID; y++) {
      for (let x = 0; x < SNAKE_GRID; x++) {
        if (this.isOccupied(x, y)) continue;
        // lejos de la cabeza, contando el atajo por los portales
        const dist = torDist(x, this.head.x) + torDist(y, this.head.y);
        if (dist < (initial ? 4 : 3)) continue;
        // nunca en las 3 casillas de delante (también al otro lado del portal)
        let ahead = false;
        for (let k = 1; k <= 3; k++) {
          if (wrap(this.head.x + hd.x * k) === x && wrap(this.head.y + hd.y * k) === y) {
            ahead = true;
            break;
          }
        }
        if (ahead) continue;
        // despejar el camino directo inicial hasta el primer queso
        if (initial && x === this.head.x && y <= this.head.y && y >= this.cheese.y) continue;
        candidates.push({ x, y });
      }
    }
    // el queso debe seguir alcanzable y con al menos 2 salidas
    for (let tries = 0; tries < 18 && candidates.length > 0; tries++) {
      const cand = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
      const reach = this.reachableSet(cand.x, cand.y);
      if (!reach.has(this.cheese.y * SNAKE_GRID + this.cheese.x)) continue;
      let exits = 0;
      for (const d of NEIGHBORS) {
        const ex = wrap(this.cheese.x + d.x);
        const ey = wrap(this.cheese.y + d.y);
        if (!(ex === cand.x && ey === cand.y) && !this.hasTrap(ex, ey)) exits++;
      }
      if (exits < 2) continue;
      this.traps.push({ x: cand.x, y: cand.y, seed: Math.random() * 1000, snapping: false, snapT: 0 });
      return;
    }
  }

  private spawnBandaid() {
    const reach = this.reachableSet();
    const pool: Cell[] = [];
    for (let y = 0; y < SNAKE_GRID; y++) {
      for (let x = 0; x < SNAKE_GRID; x++) {
        if (this.isOccupied(x, y)) continue;
        if (reach.has(y * SNAKE_GRID + x)) pool.push({ x, y });
      }
    }
    if (pool.length > 0) {
      this.bandaid = pool[Math.floor(Math.random() * pool.length)];
      this.bandaidTimer = 11;
    }
  }

  private pushFloat(x: number, y: number, text: string, color: string, size = 20) {
    this.floats.push({ x, y, vy: -28, life: 1, max: 1, text, color, size });
  }

  private burst(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand(0, 0.4);
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * rand(35, 95),
        vy: Math.sin(a) * rand(35, 95),
        life: rand(0.3, 0.55),
        max: 0.55,
        kind: "spark",
        scale: rand(0.55, 0.9),
        color,
        rot: 0,
        vr: 0,
      });
    }
  }

  private cellCenterX(cx: number) {
    return this.boardX + (cx + 0.5) * this.cellSize;
  }

  private cellCenterY(cy: number) {
    return this.boardY + (cy + 0.5) * this.cellSize;
  }

  /**
   * Dónde dibujar un segmento en este instante. Al cruzar un portal se
   * dibuja dos veces: saliendo por un borde y asomando por el contrario.
   * El recorte del tablero oculta lo que queda fuera → transición continua.
   */
  private segmentPositions(x: number, y: number, px: number, py: number, p: number): number {
    const dx = stepDelta(px, x);
    const dy = stepDelta(py, y);
    const pos = this.segPos;
    pos[0] = px + dx * p;
    pos[1] = py + dy * p;
    if (Math.abs(x - px) <= 1 && Math.abs(y - py) <= 1) return 1;
    pos[2] = x - dx * (1 - p);
    pos[3] = y - dy * (1 - p);
    return 2;
  }

  /* ---------------- Renderizado ---------------- */

  /** Fondo washi + marco de madera + tatami: estático, se pinta una vez */
  private paintBackground(ctx: CanvasRenderingContext2D) {
    const { W, H } = this;
    const bx = this.boardX;
    const by = this.boardY;
    const bs = this.boardSize;
    const cs = this.cellSize;

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, PALETTE.sky1);
    g.addColorStop(1, PALETTE.sky2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(46,42,38,0.16)";
    roundRect(ctx, bx + 2, by + 5, bs, bs, 14);
    ctx.fill();

    ctx.fillStyle = PALETTE.wood;
    ctx.strokeStyle = PALETTE.woodDeep;
    ctx.lineWidth = 3;
    roundRect(ctx, bx - 5, by - 5, bs + 10, bs + 10, 16);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    roundRect(ctx, bx, by, bs, bs, 11);
    ctx.clip();
    ctx.fillStyle = "#efe2c3";
    ctx.fillRect(bx, by, bs, bs);
    ctx.fillStyle = "#f6ebd1";
    for (let y = 0; y < SNAKE_GRID; y++) {
      for (let x = 0; x < SNAKE_GRID; x++) {
        if ((x + y) % 2 === 0) ctx.fillRect(bx + x * cs, by + y * cs, cs + 0.5, cs + 0.5);
      }
    }
    ctx.restore();

    // borde discontinuo bermellón: las paredes se cruzan (portales)
    ctx.save();
    ctx.strokeStyle = "rgba(228,87,46,0.5)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([cs * 0.42, cs * 0.58]);
    ctx.lineDashOffset = -cs * 0.29;
    ctx.strokeRect(bx + 1.6, by + 1.6, bs - 3.2, bs - 3.2);
    ctx.restore();
  }

  private buildBackground() {
    this.bgDirty = false;
    const c = makeCanvas(Math.round(this.W * this.dpr), Math.round(this.H * this.dpr));
    const g = c ? c.getContext("2d") : null;
    if (!c || !g) {
      this.bg = null; // sin canvas auxiliar: se pinta en vivo
      return;
    }
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.paintBackground(g);
    this.bg = c;
  }

  private render(t: number) {
    const ctx = this.ctx;
    const { W, H } = this;

    // base opaca (el canvas no tiene canal alfa)
    ctx.fillStyle = PALETTE.sky2;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (this.shake > 0) {
      ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    }

    // escenario estático: una sola copia de píxeles por frame
    if (this.bgDirty) this.buildBackground();
    if (this.bg) ctx.drawImage(this.bg, 0, 0, W, H);
    else this.paintBackground(ctx);

    const bx = this.boardX;
    const by = this.boardY;
    const bs = this.boardSize;
    const cs = this.cellSize;
    const dpr = this.dpr;

    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, bs, bs);
    ctx.clip();

    const p = this.state === "playing" ? clamp(this.tickAccum / this.stepDur, 0, 1) : 1;
    const objScale = cs / 58;

    // trampas (sprite cacheado; la que se cierra, en vectorial)
    for (const tr of this.traps) {
      ctx.save();
      ctx.translate(this.cellCenterX(tr.x), this.cellCenterY(tr.y));
      if (tr.snapping) drawTrap(ctx, objScale * 0.85, tr.snapT, 0);
      else drawTrapFast(ctx, this.sprites, objScale * 0.85, 0, dpr);
      ctx.restore();
    }

    // queso
    ctx.save();
    ctx.translate(this.cellCenterX(this.cheese.x), this.cellCenterY(this.cheese.y));
    drawCheese(ctx, t + this.cheeseSeed, objScale * 1.05);
    ctx.restore();

    // curita (parpadea cuando está por desaparecer)
    if (this.bandaid) {
      ctx.save();
      if (this.bandaidTimer < 2.5 && Math.floor(t / 120) % 2 === 0) ctx.globalAlpha = 0.35;
      ctx.translate(this.cellCenterX(this.bandaid.x), this.cellCenterY(this.bandaid.y));
      drawBandaid(ctx, t, objScale * 1.15);
      ctx.restore();
    }

    // crías: sprites cacheados, de la cola hacia delante
    const mouseScale = cs / 56;
    const blinkOff = this.invulnT > 0 && Math.floor(t / 90) % 2 === 0;
    const seg = this.segPos;
    for (let i = this.followers.length - 1; i >= 0; i--) {
      const f = this.followers[i];
      const n = this.segmentPositions(f.x, f.y, f.prevX, f.prevY, p);
      for (let k = 0; k < n; k++) {
        ctx.save();
        ctx.translate(bx + (seg[k * 2] + 0.5) * cs, by + (seg[k * 2 + 1] + 0.5) * cs);
        if (blinkOff) ctx.globalAlpha = 0.45;
        drawBabyMouseFast(ctx, this.sprites, f.dir, t + i * 110, mouseScale, dpr);
        ctx.restore();
      }
    }

    // ratón líder (vectorial: parpadea, aura y ojos en X al perder)
    const running = this.state === "playing" && !this.paused;
    const hn = this.segmentPositions(this.head.x, this.head.y, this.prevHead.x, this.prevHead.y, p);
    for (let k = 0; k < hn; k++) {
      ctx.save();
      ctx.translate(bx + (seg[k * 2] + 0.5) * cs, by + (seg[k * 2 + 1] + 0.5) * cs);
      if (this.shields > 0 && this.state === "playing") {
        const r = cs * 0.72;
        const halo = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
        halo.addColorStop(0, "rgba(155,209,176,0.34)");
        halo.addColorStop(1, "rgba(155,209,176,0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (blinkOff) ctx.globalAlpha = 0.38;
      drawMouse(ctx, {
        t,
        s: mouseScale,
        lean: 0,
        running,
        auraLevel: clamp(this.followers.length / 10, 0, 1),
        dead: this.state !== "playing",
        dir: this.dir,
      });
      ctx.restore();
    }

    ctx.restore(); // fin del recorte del tablero

    // pétalos y chispas
    for (const pt of this.parts) {
      ctx.save();
      ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rot);
      if (pt.kind === "spark") drawSpark(ctx, pt.scale, pt.color);
      else drawPetal(ctx, pt.scale);
      ctx.restore();
    }

    // textos flotantes (sin emojis: más rápidos y se ven igual en todo móvil)
    if (this.floats.length > 0) {
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#faf4e4";
      for (const f of this.floats) {
        ctx.globalAlpha = Math.min(1, clamp(f.life / f.max, 0, 1) * 2);
        ctx.font = `900 ${f.size}px 'Zen Maru Gothic', sans-serif`;
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore(); // fin del temblor

    if (this.flash > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, `${this.flashColor}0)`);
      g.addColorStop(1, `${this.flashColor}${this.flash * 0.65})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
