/**
 * RATÓN — draw.ts
 * Todo el arte del juego es procedural (canvas 2D), estilo
 * "arte japonés moderno": tinta suave, papel washi, bermellón y dorado.
 */

export const PALETTE = {
  ink: "#4c453d",
  inkSoft: "rgba(76,69,61,0.5)",
  sky1: "#fbf5e6",
  sky2: "#f4ead2",
  road: "#f2e7cc",
  roadEdge: "rgba(76,69,61,0.35)",
  grass: "#aebd92",
  grassDeep: "#93a877",
  sun: "#e4572e",
  sunGlow: "rgba(228,87,46,0.16)",
  cloud: "#fffdf4",
  fur: "#a7b2bd",
  furDeep: "#5d6873",
  belly: "#e3e8ec",
  pink: "#f2a6ae",
  tail: "#e79aa2",
  wood: "#c89c6a",
  woodDeep: "#8a6338",
  metal: "#c7cdd4",
  metalDeep: "#7d8892",
  cheese: "#ffc94a",
  cheeseDeep: "#e09a1c",
  cheeseHole: "#d98f1f",
  gold: "#f2b13d",
  petal: "#f6c3c8",
};

export function roundRect(
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

/* ---------------- NUBE ukiyo-e ---------------- */
export function drawCloud(ctx: CanvasRenderingContext2D, s: number) {
  ctx.save();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-52, 10);
  ctx.arc(-34, 2, 16, Math.PI * 0.9, Math.PI * 1.9);
  ctx.arc(-8, -10, 18, Math.PI, Math.PI * 1.95);
  ctx.arc(20, -4, 15, Math.PI * 1.1, Math.PI * 2.05);
  ctx.arc(38, 4, 12, Math.PI * 1.3, Math.PI * 0.5);
  ctx.lineTo(52, 10);
  ctx.closePath();
  ctx.fillStyle = PALETTE.cloud;
  ctx.strokeStyle = PALETTE.inkSoft;
  ctx.lineWidth = 2.4;
  ctx.fill();
  ctx.stroke();
  // líneas de viento interiores
  ctx.beginPath();
  ctx.moveTo(-30, 10);
  ctx.quadraticCurveTo(-18, 4, -6, 9);
  ctx.moveTo(4, 10);
  ctx.quadraticCurveTo(16, 4, 28, 9);
  ctx.strokeStyle = "rgba(76,69,61,0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/* ---------------- TORII ---------------- */
export function drawTorii(ctx: CanvasRenderingContext2D, s: number) {
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = "rgba(46,42,38,0.12)";
  ctx.beginPath();
  ctx.ellipse(0, 30, 34, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  const red = PALETTE.sun;
  const dark = "#b8411f";
  // pilares
  ctx.fillStyle = red;
  roundRect(ctx, -24, -14, 9, 44, 3);
  ctx.fill();
  roundRect(ctx, 15, -14, 9, 44, 3);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.fillRect(-24, 22, 9, 8);
  ctx.fillRect(15, 22, 9, 8);
  // nuki (viga inferior)
  ctx.fillStyle = red;
  roundRect(ctx, -30, -4, 60, 7, 3);
  ctx.fill();
  // kasama (viga superior curva)
  ctx.beginPath();
  ctx.moveTo(-36, -18);
  ctx.quadraticCurveTo(0, -26, 36, -18);
  ctx.lineTo(36, -10);
  ctx.quadraticCurveTo(0, -17, -36, -10);
  ctx.closePath();
  ctx.fillStyle = red;
  ctx.fill();
  ctx.strokeStyle = "rgba(76,69,61,0.35)";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // puntas negras de la kasama
  ctx.fillStyle = "#3b3630";
  ctx.fillRect(-37, -19, 5, 7);
  ctx.fillRect(32, -19, 5, 7);
  ctx.restore();
}

/* ---------------- HIERBA / PIEDRA ---------------- */
export function drawTuft(ctx: CanvasRenderingContext2D, s: number) {
  ctx.save();
  ctx.scale(s, s);
  ctx.strokeStyle = PALETTE.grassDeep;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-6, 6);
  ctx.quadraticCurveTo(-8, -4, -12, -8);
  ctx.moveTo(0, 6);
  ctx.quadraticCurveTo(0, -6, 2, -10);
  ctx.moveTo(6, 6);
  ctx.quadraticCurveTo(8, -2, 12, -6);
  ctx.stroke();
  ctx.restore();
}

export function drawStone(ctx: CanvasRenderingContext2D, s: number) {
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = "#d8cdb2";
  ctx.strokeStyle = "rgba(76,69,61,0.3)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 5.5, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/* ---------------- PÉTALO ---------------- */
export function drawPetal(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(0, -6 * s);
  ctx.bezierCurveTo(5 * s, -4 * s, 5 * s, 3 * s, 0, 6 * s);
  ctx.bezierCurveTo(-5 * s, 3 * s, -5 * s, -4 * s, 0, -6 * s);
  ctx.closePath();
  ctx.fillStyle = PALETTE.petal;
  ctx.fill();
}

/* ---------------- QUESO ---------------- */
export function drawCheese(
  ctx: CanvasRenderingContext2D,
  t: number,
  s: number,
  glow = true,
  stars = true
) {
  const bob = Math.sin(t * 0.004) * 2;
  ctx.save();
  ctx.translate(0, bob);
  ctx.rotate(Math.sin(t * 0.0023) * 0.08);
  ctx.scale(s, s);
  if (glow) {
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 34);
    g.addColorStop(0, "rgba(255,201,74,0.5)");
    g.addColorStop(1, "rgba(255,201,74,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
  }
  // cara lateral (grosor)
  ctx.beginPath();
  ctx.moveTo(-17, 6);
  ctx.lineTo(17, 6);
  ctx.lineTo(15, 13);
  ctx.lineTo(-15, 13);
  ctx.closePath();
  ctx.fillStyle = PALETTE.cheeseDeep;
  ctx.fill();
  // cuña principal
  ctx.beginPath();
  ctx.moveTo(-17, 6);
  ctx.quadraticCurveTo(0, -26, 17, 6);
  ctx.closePath();
  ctx.fillStyle = PALETTE.cheese;
  ctx.strokeStyle = "#b8761b";
  ctx.lineWidth = 2.2;
  ctx.fill();
  ctx.stroke();
  // agujeros
  ctx.fillStyle = PALETTE.cheeseHole;
  const holes: [number, number, number][] = [
    [-6, -4, 3.4],
    [6, -1, 2.6],
    [0, 4, 2.2],
  ];
  for (const [hx, hy, hr] of holes) {
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fill();
  }
  // brillo
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-9, -7);
  ctx.quadraticCurveTo(-4, -13, 2, -14);
  ctx.stroke();
  // destellos (la versión cacheada los dibuja aparte para que sigan titilando)
  if (stars) {
    const tw = (Math.sin(t * 0.006) + 1) / 2;
    ctx.globalAlpha = 0.4 + tw * 0.5;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.8;
    const star = (sx: number, sy: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(sx - r, sy);
      ctx.lineTo(sx + r, sy);
      ctx.moveTo(sx, sy - r);
      ctx.lineTo(sx, sy + r);
      ctx.stroke();
    };
    star(-20, -14, 4);
    star(21, -8, 3);
  }
  ctx.restore();
}

/* ---------------- TRAMPA ---------------- */
export function drawTrap(
  ctx: CanvasRenderingContext2D,
  s: number,
  snapT: number,
  tremble: number
) {
  ctx.save();
  if (tremble > 0) {
    ctx.translate(
      (Math.random() - 0.5) * tremble,
      (Math.random() - 0.5) * tremble
    );
  }
  ctx.scale(s, s);
  // sombra
  ctx.fillStyle = "rgba(46,42,38,0.14)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 36, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  // base de madera
  roundRect(ctx, -30, -18, 60, 38, 6);
  ctx.fillStyle = PALETTE.wood;
  ctx.strokeStyle = PALETTE.woodDeep;
  ctx.lineWidth = 2.4;
  ctx.fill();
  ctx.stroke();
  // vetas
  ctx.strokeStyle = "rgba(138,99,56,0.4)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-24, -8);
  ctx.quadraticCurveTo(0, -12, 24, -9);
  ctx.moveTo(-24, 8);
  ctx.quadraticCurveTo(0, 5, 24, 7);
  ctx.stroke();
  // pedal dorado
  ctx.fillStyle = "#e8b23a";
  ctx.strokeStyle = "#a97c1c";
  ctx.lineWidth = 1.6;
  roundRect(ctx, -7, 4, 14, 10, 2);
  ctx.fill();
  ctx.stroke();
  // resorte (zigzag)
  ctx.strokeStyle = PALETTE.metalDeep;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, -8);
  ctx.lineTo(-4, -4);
  ctx.lineTo(0, -8);
  ctx.lineTo(4, -4);
  ctx.lineTo(8, -8);
  ctx.stroke();
  // barra metálica (U) — gira al cerrarse
  const ease = snapT < 0.5 ? 2 * snapT * snapT : 1 - Math.pow(-2 * snapT + 2, 2) / 2;
  const ang = -1.25 + ease * 2.5; // abierta -> cerrada
  ctx.save();
  ctx.translate(0, -6);
  ctx.rotate(ang);
  ctx.strokeStyle = PALETTE.metal;
  ctx.lineWidth = 4.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-22, 0);
  ctx.lineTo(-22, -26);
  ctx.quadraticCurveTo(0, -34, 22, -26);
  ctx.lineTo(22, 0);
  ctx.stroke();
  ctx.strokeStyle = PALETTE.metalDeep;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/* ---------------- FRESA (power-up ×20s de queso) ---------------- */
export function drawStrawberry(
  ctx: CanvasRenderingContext2D,
  t: number,
  s: number
) {
  const bob = Math.sin(t * 0.004) * 2;
  ctx.save();
  ctx.translate(0, bob);
  ctx.rotate(Math.sin(t * 0.0023) * 0.06);
  ctx.scale(s, s);

  // halo de fresa
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
  g.addColorStop(0, "rgba(228,87,46,0.45)");
  g.addColorStop(1, "rgba(228,87,46,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();

  // cuerpo de la fresa
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.bezierCurveTo(12, -10, 15, 4, 9, 13);
  ctx.bezierCurveTo(4, 18, -4, 18, -9, 13);
  ctx.bezierCurveTo(-15, 4, -12, -10, 0, -13);
  ctx.closePath();
  ctx.fillStyle = "#e63a3a";
  ctx.strokeStyle = "#a8241f";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  // brillo
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.ellipse(-4, -2, 3, 5, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // hojitas verdes
  ctx.fillStyle = "#3fae6b";
  ctx.strokeStyle = "#2e8b53";
  ctx.lineWidth = 1.4;
  for (const a of [-0.5, 0, 0.5]) {
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(-5, -20);
    ctx.lineTo(0, -16);
    ctx.lineTo(5, -20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/* ---------------- BAND-AID (vida extra) ---------------- */
export function drawBandaid(
  ctx: CanvasRenderingContext2D,
  t: number,
  s: number
) {
  const bob = Math.sin(t * 0.004) * 2;
  ctx.save();
  ctx.translate(0, bob);
  ctx.rotate(-0.5 + Math.sin(t * 0.002) * 0.05);
  ctx.scale(s, s);

  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
  g.addColorStop(0, "rgba(155,209,176,0.5)");
  g.addColorStop(1, "rgba(155,209,176,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();

  // parche en diagonal
  ctx.save();
  ctx.translate(0, 0);
  roundRect(ctx, -9, -17, 18, 34, 7);
  ctx.fillStyle = "#fbf3df";
  ctx.strokeStyle = "#caa86f";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  // vendas laterales
  ctx.fillStyle = "#e8d8b4";
  ctx.beginPath();
  ctx.arc(0, -17, 9, 0, Math.PI * 2);
  ctx.arc(0, 17, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // cruce de hilo
  ctx.strokeStyle = "#caa86f";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-4, -3);
  ctx.lineTo(4, 3);
  ctx.moveTo(4, -3);
  ctx.lineTo(-4, 3);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/* ---------------- RATÓN (4 direcciones + vista trasera y frontal) ---------------- */
export type MouseDir = "up" | "down" | "left" | "right";

export interface MousePose {
  t: number; // tiempo global ms
  s: number; // escala (1 ≈ tamaño carril)
  lean: number; // inclinación al girar o cambiar de carril
  running: boolean;
  auraLevel: number; // 0..1 intensidad del aura dorada
  dead: boolean;
  /** Dirección hacia la que mira el ratón:
   *  - "up"    → de espaldas corriendo hacia adelante (runner y snake arriba)
   *  - "down"  → de frente mirando al jugador (menú principal y snake abajo)
   *  - "left"  → de perfil corriendo a la izquierda (snake)
   *  - "right" → de perfil corriendo a la derecha (snake)
   */
  dir?: MouseDir;
  /** 0..1: fotograma fijo de un ciclo de carrera que encaja en bucle perfecto
   *  (lo usa la caché de sprites de las crías). Sin él, se anima con `t`. */
  cycle?: number;
}

export function drawMouse(ctx: CanvasRenderingContext2D, p: MousePose) {
  const { s, lean, running, auraLevel, dead } = p;
  const dir: MouseDir = p.dir ?? "up";
  const loop = typeof p.cycle === "number";
  const phase = loop
    ? (p.cycle as number) * Math.PI * 2
    : p.t * (running ? 0.02 : 0.004);
  const bob = running ? Math.abs(Math.sin(phase)) * 2.6 : Math.sin(phase) * 1.2;
  // parpadeo natural breve cada ~3.4 s (no en fotogramas cacheados)
  const blinkCycle = (p.t % 3400) / 3400;
  const blinking = !dead && !loop && blinkCycle > 0.955;

  ctx.save();
  ctx.scale(s, s);

  // AURA dorada
  if (auraLevel > 0 && !dead) {
    const pulse = 0.75 + Math.sin(p.t * 0.008) * 0.25;
    const r = 44 + auraLevel * 16;
    const g = ctx.createRadialGradient(0, -2, r * 0.3, 0, -2, r);
    g.addColorStop(0, `rgba(242,177,61,${0.34 * auraLevel * pulse})`);
    g.addColorStop(0.7, `rgba(242,177,61,${0.16 * auraLevel * pulse})`);
    g.addColorStop(1, "rgba(242,177,61,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -2, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // sombra bajo el cuerpo
  const horiz = dir === "left" || dir === "right";
  ctx.fillStyle = "rgba(46,42,38,0.18)";
  ctx.beginPath();
  ctx.ellipse(0, horiz ? 20 : 26, horiz ? 26 : 23, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -bob);
  ctx.rotate(lean);
  if (dead) ctx.rotate(Math.PI * 0.9);

  if (dir === "up") {
    drawMouseBack(ctx, phase, running, loop);
  } else if (dir === "down") {
    drawMouseFront(ctx, phase, running, blinking, dead, loop);
  } else {
    if (dir === "left") ctx.scale(-1, 1);
    drawMouseSide(ctx, phase, running, blinking, dead, loop);
  }

  ctx.restore();
}

/** Versión cría/seguidor para el modo Snake (uno por cada queso comido) */
export function drawBabyMouse(
  ctx: CanvasRenderingContext2D,
  p: Omit<MousePose, "auraLevel" | "dead"> & { auraLevel?: number; dead?: boolean }
) {
  drawMouse(ctx, {
    ...p,
    s: p.s * 0.74,
    auraLevel: p.auraLevel ?? 0,
    dead: p.dead ?? false,
  });
}

/** Vista TRASERA ("up"): corriendo hacia arriba — lomo gris sin pancita, dorso de orejas */
function drawMouseBack(
  ctx: CanvasRenderingContext2D,
  phase: number,
  running: boolean,
  loop = false
) {
  // en bucle (sprites) cola y orejas usan la misma frecuencia → sin saltos
  const sway = Math.sin(loop ? phase + 1.1 : phase * 0.7) * 5;
  const step = running ? Math.sin(phase) * 3.4 : 0;
  const earWig = Math.sin(loop ? phase + 2.3 : phase * 0.5) * 1.6;

  // cola serpenteando atrás
  ctx.strokeStyle = PALETTE.tail;
  ctx.lineWidth = 3.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 21);
  ctx.bezierCurveTo(sway, 31, 13 + sway, 35, 19 + sway * 1.35, 29);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(19 + sway * 1.35, 29, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.tail;
  ctx.fill();

  // patitas traseras alternas
  ctx.fillStyle = PALETTE.furDeep;
  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  ctx.ellipse(-11.5, 22 + step, 5.2, 7.2, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(11.5, 22 - step, 5.2, 7.2, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // puntas de los bigotes asomando por los costados de la cabeza
  ctx.strokeStyle = "rgba(76,69,61,0.55)";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 15, -16);
    ctx.quadraticCurveTo(side * 22, -18, side * 26, -15);
    ctx.moveTo(side * 16, -13);
    ctx.quadraticCurveTo(side * 23, -13, side * 27, -10);
    ctx.stroke();
  }

  // cuerpo dorsal (gota más estrecha en la cabeza, redondeada atrás)
  ctx.beginPath();
  ctx.moveTo(0, -27);
  ctx.bezierCurveTo(18, -27, 23, -8, 22, 9);
  ctx.bezierCurveTo(21, 22, 12, 26, 0, 26);
  ctx.bezierCurveTo(-12, 26, -21, 22, -22, 9);
  ctx.bezierCurveTo(-23, -8, -18, -27, 0, -27);
  ctx.closePath();
  ctx.fillStyle = PALETTE.fur;
  ctx.strokeStyle = PALETTE.furDeep;
  ctx.lineWidth = 2.6;
  ctx.fill();
  ctx.stroke();

  // volumen dorsal (sombra suave en la parte baja del lomo y línea de columna sutil, SIN pancita)
  ctx.beginPath();
  ctx.ellipse(0, 15, 14, 8.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.furDeep;
  ctx.globalAlpha = 0.14;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.quadraticCurveTo(0, 2, 0, 12);
  ctx.strokeStyle = PALETTE.furDeep;
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // orejas vistas DESDE ATRÁS: dorso gris peludo (el rosa mira hacia adelante, no hacia nosotros)
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 14.5, -22 + earWig);
    ctx.rotate(side * 0.42);
    // pabellón posterior
    ctx.beginPath();
    ctx.ellipse(0, 0, 10.5, 12.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.fur;
    ctx.strokeStyle = PALETTE.furDeep;
    ctx.lineWidth = 2.4;
    ctx.fill();
    ctx.stroke();
    // pliegue/sombra dorsal en la base donde la oreja nace del cráneo
    ctx.beginPath();
    ctx.ellipse(-side * 1.2, 3, 5.8, 6.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.furDeep;
    ctx.globalAlpha = 0.28;
    ctx.fill();
    ctx.globalAlpha = 1;
    // filo rosado muy sutil arriba por la luz traslúcida
    ctx.beginPath();
    ctx.ellipse(0, -1.2, 8.8, 10.2, 0, Math.PI * 1.18, Math.PI * 1.82);
    ctx.strokeStyle = PALETTE.pink;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // mechón de coronilla
  ctx.strokeStyle = PALETTE.furDeep;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-3, -27);
  ctx.quadraticCurveTo(0, -31, 3, -27);
  ctx.stroke();
}

/** Vista FRONTAL ("down"): mirando al jugador (Menú principal y Snake bajando) */
function drawMouseFront(
  ctx: CanvasRenderingContext2D,
  phase: number,
  running: boolean,
  blinking: boolean,
  dead: boolean,
  loop = false
) {
  const sway = Math.sin(loop ? phase + 1.1 : phase * 0.7) * 4;
  const step = running ? Math.sin(phase) * 2.6 : 0;
  const earWig = Math.sin(loop ? phase + 2.3 : phase * 0.5) * 1.5;

  // cola asomando por detrás a la derecha
  ctx.strokeStyle = PALETTE.tail;
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(12, 18);
  ctx.bezierCurveTo(24, 22 + sway * 0.4, 30, 12 + sway, 26, 4 + sway);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(26, 4 + sway, 2.3, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.tail;
  ctx.fill();

  // orejas grandes DETRÁS del cráneo, mirando al frente con su interior rosado visible
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 16, -21 + earWig);
    ctx.rotate(side * 0.36);
    ctx.beginPath();
    ctx.ellipse(0, 0, 11.5, 13, 0, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.fur;
    ctx.strokeStyle = PALETTE.furDeep;
    ctx.lineWidth = 2.4;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 1, 6.6, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.pink;
    ctx.fill();
    ctx.restore();
  }

  // patitas traseras abajo
  ctx.fillStyle = PALETTE.pink;
  ctx.strokeStyle = PALETTE.furDeep;
  ctx.lineWidth = 1.6;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 11, 24 + (side < 0 ? step : -step) * 0.6, 5.5, 4.2, side * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // cuerpo redondeado
  ctx.beginPath();
  ctx.moveTo(0, -25);
  ctx.bezierCurveTo(19, -25, 24, -5, 22, 10);
  ctx.bezierCurveTo(20, 22, 11, 25, 0, 25);
  ctx.bezierCurveTo(-11, 25, -20, 22, -22, 10);
  ctx.bezierCurveTo(-24, -5, -19, -25, 0, -25);
  ctx.closePath();
  ctx.fillStyle = PALETTE.fur;
  ctx.strokeStyle = PALETTE.furDeep;
  ctx.lineWidth = 2.6;
  ctx.fill();
  ctx.stroke();

  // PANCITA crema (vista frontal: aquí sí va la pancita)
  ctx.beginPath();
  ctx.ellipse(0, 11, 13, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.belly;
  ctx.fill();

  // manitas delanteras sobre la pancita
  ctx.fillStyle = PALETTE.pink;
  ctx.strokeStyle = PALETTE.furDeep;
  ctx.lineWidth = 1.6;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(
      side * 12,
      8 + (side < 0 ? -step : step) * 0.7,
      4.2,
      3.4,
      side * 0.35,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();
  }

  // mechón de frente
  ctx.strokeStyle = PALETTE.furDeep;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-3, -25);
  ctx.quadraticCurveTo(0, -30, 3, -25);
  ctx.stroke();

  // mejillas rosadas suaves
  ctx.fillStyle = PALETTE.pink;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(-12, -5, 4.2, 2.6, 0, 0, Math.PI * 2);
  ctx.ellipse(12, -5, 4.2, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // ojos
  for (const side of [-1, 1]) {
    const ex = side * 7.8;
    const ey = -11;
    if (dead) {
      // ojos en X
      ctx.strokeStyle = "#2e2a26";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(ex - 2.6, ey - 2.6);
      ctx.lineTo(ex + 2.6, ey + 2.6);
      ctx.moveTo(ex + 2.6, ey - 2.6);
      ctx.lineTo(ex - 2.6, ey + 2.6);
      ctx.stroke();
    } else if (blinking) {
      ctx.strokeStyle = "#2e2a26";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(ex, ey + 0.8, 3.2, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#2e2a26";
      ctx.beginPath();
      ctx.ellipse(ex, ey, 3.1, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fffdf4";
      ctx.beginPath();
      ctx.arc(ex + 1, ey - 1.2, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // boquita w sutil
  ctx.strokeStyle = PALETTE.furDeep;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-4, -1.5);
  ctx.quadraticCurveTo(-2, 1, 0, -1.5);
  ctx.quadraticCurveTo(2, 1, 4, -1.5);
  ctx.stroke();

  // nariz rosada con brillo
  ctx.fillStyle = "#e87c8a";
  ctx.beginPath();
  ctx.ellipse(0, -4.5, 3.6, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.arc(-1, -5.3, 0.9, 0, Math.PI * 2);
  ctx.fill();

  // bigotes
  ctx.strokeStyle = "rgba(76,69,61,0.55)";
  ctx.lineWidth = 1.3;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 6, -5);
    ctx.quadraticCurveTo(side * 16, -8, side * 24, -6);
    ctx.moveTo(side * 6, -3);
    ctx.quadraticCurveTo(side * 17, -3, side * 25, 0);
    ctx.stroke();
  }
}

/** Vista DE PERFIL ("right", reflejada para "left"): para modo Snake horizontal */
function drawMouseSide(
  ctx: CanvasRenderingContext2D,
  phase: number,
  running: boolean,
  blinking: boolean,
  dead: boolean,
  loop = false
) {
  const sway = Math.sin(loop ? phase + 1.1 : phase * 0.7) * 4.5;
  const stride = running ? Math.sin(phase) * 5.5 : 0;
  const earWig = Math.sin(loop ? phase + 2.3 : phase * 0.5) * 1.2;

  // cola ondulando hacia atrás (izquierda)
  ctx.strokeStyle = PALETTE.tail;
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-21, 5);
  ctx.bezierCurveTo(-30, 8 + sway * 0.5, -36, -2 + sway, -43, 2 + sway);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-43, 2 + sway, 2.3, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.tail;
  ctx.fill();

  // patitas del fondo (más oscuras)
  ctx.fillStyle = PALETTE.furDeep;
  ctx.beginPath();
  ctx.ellipse(-12 - stride * 0.7, 17, 5.5, 3.6, -0.15, 0, Math.PI * 2);
  ctx.ellipse(9 + stride * 0.7, 17, 4.8, 3.2, 0.15, 0, Math.PI * 2);
  ctx.fill();

  // oreja trasera (atrás/arriba, más oscura)
  ctx.save();
  ctx.translate(4, -20 + earWig * 0.6);
  ctx.rotate(-0.2);
  ctx.beginPath();
  ctx.ellipse(0, 0, 8.5, 10.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.furDeep;
  ctx.fill();
  ctx.restore();

  // cuerpo + cabeza en perfil hacia la derecha
  ctx.beginPath();
  ctx.moveTo(-22, 6);
  ctx.bezierCurveTo(-24, -10, -8, -19, 6, -17);
  ctx.bezierCurveTo(17, -16, 26, -7, 27, -1); // hocico
  ctx.bezierCurveTo(26, 6, 17, 13, 6, 15);
  ctx.bezierCurveTo(-8, 17, -20, 15, -22, 6);
  ctx.closePath();
  ctx.fillStyle = PALETTE.fur;
  ctx.strokeStyle = PALETTE.furDeep;
  ctx.lineWidth = 2.6;
  ctx.fill();
  ctx.stroke();

  // pancita crema en la parte inferior del perfil
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(0, 14, 21, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.belly;
  ctx.fill();
  ctx.restore();
  // repasar contorno tras clip
  ctx.beginPath();
  ctx.moveTo(-22, 6);
  ctx.bezierCurveTo(-24, -10, -8, -19, 6, -17);
  ctx.bezierCurveTo(17, -16, 26, -7, 27, -1);
  ctx.bezierCurveTo(26, 6, 17, 13, 6, 15);
  ctx.bezierCurveTo(-8, 17, -20, 15, -22, 6);
  ctx.closePath();
  ctx.strokeStyle = PALETTE.furDeep;
  ctx.lineWidth = 2.6;
  ctx.stroke();

  // patitas delanteras visibles (ciclo opuesto al fondo)
  ctx.fillStyle = PALETTE.pink;
  ctx.strokeStyle = PALETTE.furDeep;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(-9 + stride, 17, 5.8, 3.8, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(11 - stride, 16.5, 5, 3.4, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // oreja delantera (interior rosado mirando hacia el frente-derecha)
  ctx.save();
  ctx.translate(1, -17 + earWig);
  ctx.rotate(-0.18);
  ctx.beginPath();
  ctx.ellipse(0, 0, 9.5, 11.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.fur;
  ctx.strokeStyle = PALETTE.furDeep;
  ctx.lineWidth = 2.3;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(1.4, 0.6, 5.2, 6.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.pink;
  ctx.fill();
  ctx.restore();

  // mejilla rosada
  ctx.fillStyle = PALETTE.pink;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.ellipse(13, -1, 3.6, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // ojo de perfil
  if (dead) {
    ctx.strokeStyle = "#2e2a26";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, -9.5);
    ctx.lineTo(17, -4.5);
    ctx.moveTo(17, -9.5);
    ctx.lineTo(12, -4.5);
    ctx.stroke();
  } else if (blinking) {
    ctx.strokeStyle = "#2e2a26";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(14.5, -6.5, 3, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#2e2a26";
    ctx.beginPath();
    ctx.ellipse(14.5, -7, 2.8, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fffdf4";
    ctx.beginPath();
    ctx.arc(15.4, -8, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // nariz en la punta del hocico
  ctx.fillStyle = "#e87c8a";
  ctx.beginPath();
  ctx.ellipse(26.5, -1.5, 3.2, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // bigotes
  ctx.strokeStyle = "rgba(76,69,61,0.55)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(23, -1);
  ctx.quadraticCurveTo(30, -5, 35, -4);
  ctx.moveTo(23, 1);
  ctx.quadraticCurveTo(30, 1, 35, 4);
  ctx.stroke();
}

/* ---------------- destello de estrella (partículas) ---------------- */
export function drawSpark(
  ctx: CanvasRenderingContext2D,
  s: number,
  color: string
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4 * s;
  ctx.lineCap = "round";
  const r = 6 * s;
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.moveTo(0, -r);
  ctx.lineTo(0, r);
  ctx.moveTo(-r * 0.6, -r * 0.6);
  ctx.lineTo(r * 0.6, r * 0.6);
  ctx.moveTo(r * 0.6, -r * 0.6);
  ctx.lineTo(-r * 0.6, r * 0.6);
  ctx.stroke();
}
