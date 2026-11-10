/**
 * RATÓN — sprites.ts
 * Rendimiento: lo que no cambia se dibuja UNA vez en un canvas fuera de
 * pantalla y luego solo se copia con drawImage. Copiar píxeles es muchísimo
 * más barato que repetir decenas de curvas, sombras y degradados por frame.
 *
 * Si el navegador no puede crear canvas auxiliares, se vuelve a dibujar en
 * vectorial como antes: el juego nunca se rompe por esto.
 */

import {
  drawBabyMouse,
  drawCheese,
  drawMouse,
  drawTrap,
  type MouseDir,
} from "./draw";

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** media anchura / media altura en px CSS (el origen queda en el centro) */
  hw: number;
  hh: number;
}

/** Crea un canvas auxiliar, o null si el entorno no lo permite. */
export function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
  try {
    if (
      typeof document === "undefined" ||
      typeof document.createElement !== "function"
    ) {
      return null;
    }
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  } catch {
    return null;
  }
}

/** Tope de seguridad de memoria: unos pocos MB como mucho */
const CACHE_LIMIT = 160;

export class SpriteCache {
  private map = new Map<string, Sprite>();
  private broken = false;

  /** Devuelve el sprite pedido (lo pinta solo la primera vez). */
  get(
    key: string,
    hw: number,
    hh: number,
    dpr: number,
    paint: (g: CanvasRenderingContext2D) => void
  ): Sprite | null {
    const k = `${key}@${dpr}`;
    const hit = this.map.get(k);
    if (hit) return hit;
    if (this.broken) return null;

    const pw = Math.max(1, Math.ceil(hw * 2 * dpr));
    const ph = Math.max(1, Math.ceil(hh * 2 * dpr));
    const canvas = makeCanvas(pw, ph);
    const g = canvas ? canvas.getContext("2d") : null;
    if (!canvas || !g) {
      this.broken = true; // sin canvas auxiliar: modo vectorial para siempre
      return null;
    }
    const sw = pw / (2 * dpr);
    const sh = ph / (2 * dpr);
    g.setTransform(dpr, 0, 0, dpr, sw * dpr, sh * dpr);
    paint(g);

    if (this.map.size >= CACHE_LIMIT) this.map.clear();
    const sprite: Sprite = { canvas, hw: sw, hh: sh };
    this.map.set(k, sprite);
    return sprite;
  }

  clear() {
    this.map.clear();
  }
}

/** Copia un sprite centrado en el origen actual del contexto. */
export function blit(ctx: CanvasRenderingContext2D, sp: Sprite) {
  ctx.drawImage(sp.canvas, -sp.hw, -sp.hh, sp.hw * 2, sp.hh * 2);
}

/**
 * Filtra un array EN SU SITIO. Evita crear arrays nuevos cada frame, que en
 * móviles provoca pausas del recolector de basura (tirones).
 */
export function compact<T>(arr: T[], keep: (v: T) => boolean): void {
  let j = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (keep(v)) arr[j++] = v;
  }
  arr.length = j;
}

const k3 = (n: number) => Math.round(n * 1000) / 1000;

function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
}

/** Queso cacheado: el cuerpo es un sprite; bote, giro y destellos siguen vivos. */
export function drawCheeseFast(
  ctx: CanvasRenderingContext2D,
  cache: SpriteCache,
  t: number,
  s: number,
  dpr: number
) {
  const sp = cache.get(`cheese:${k3(s)}`, 36 * s, 36 * s, dpr, (g) =>
    drawCheese(g, 0, s, true, false)
  );
  if (!sp) {
    drawCheese(ctx, t, s);
    return;
  }
  ctx.save();
  ctx.translate(0, Math.sin(t * 0.004) * 2);
  ctx.rotate(Math.sin(t * 0.0023) * 0.08);
  blit(ctx, sp);
  // destellos titilantes: un solo trazo, baratísimo
  const tw = (Math.sin(t * 0.006) + 1) / 2;
  ctx.globalAlpha *= 0.4 + tw * 0.5;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.8 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  starPath(ctx, -20 * s, -14 * s, 4 * s);
  starPath(ctx, 21 * s, -8 * s, 3 * s);
  ctx.stroke();
  ctx.restore();
}

/** Trampa abierta cacheada (la animación de cierre sigue siendo vectorial). */
export function drawTrapFast(
  ctx: CanvasRenderingContext2D,
  cache: SpriteCache,
  s: number,
  tremble: number,
  dpr: number
) {
  const sp = cache.get(`trap:${k3(s)}`, 40 * s, 40 * s, dpr, (g) =>
    drawTrap(g, s, 0, 0)
  );
  if (!sp) {
    drawTrap(ctx, s, 0, tremble);
    return;
  }
  if (tremble > 0) {
    ctx.save();
    ctx.translate(
      (Math.random() - 0.5) * tremble,
      (Math.random() - 0.5) * tremble
    );
    blit(ctx, sp);
    ctx.restore();
  } else {
    blit(ctx, sp);
  }
}

/** 8 fotogramas por zancada bastan para una carrera fluida a este tamaño */
const BABY_FRAMES = 8;
/** misma duración de zancada que drawMouse corriendo (fase = t · 0.02) */
const RUN_PERIOD = (Math.PI * 2) / 0.02;

/** Cría de la fila cacheada: 4 direcciones × 8 fotogramas en bucle perfecto. */
export function drawBabyMouseFast(
  ctx: CanvasRenderingContext2D,
  cache: SpriteCache,
  dir: MouseDir,
  t: number,
  s: number,
  dpr: number
) {
  const bs = s * 0.74;
  const u = (((t % RUN_PERIOD) + RUN_PERIOD) % RUN_PERIOD) / RUN_PERIOD;
  const frame = Math.min(BABY_FRAMES - 1, Math.floor(u * BABY_FRAMES));
  const sp = cache.get(`baby:${dir}:${frame}:${k3(bs)}`, 50 * bs, 46 * bs, dpr, (g) =>
    drawMouse(g, {
      t: 0,
      s: bs,
      lean: 0,
      running: true,
      auraLevel: 0,
      dead: false,
      dir,
      cycle: frame / BABY_FRAMES,
    })
  );
  if (!sp) {
    drawBabyMouse(ctx, { t, s, lean: 0, running: true, dir });
    return;
  }
  blit(ctx, sp);
}
