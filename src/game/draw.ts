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
  glow = true
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
  // destellos
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

/* ---------------- RATÓN (vista trasera corriendo) ---------------- */
export interface MousePose {
  t: number; // tiempo global ms
  s: number; // escala (1 ≈ tamaño carril)
  lean: number; // inclinación al cambiar de carril
  running: boolean;
  auraLevel: number; // 0..1 intensidad del aura dorada
  dead: boolean;
}

export function drawMouse(ctx: CanvasRenderingContext2D, p: MousePose) {
  const { s, lean, running, auraLevel, dead } = p;
  const phase = p.t * (running ? 0.02 : 0.004);
  const bob = running ? Math.abs(Math.sin(phase)) * 2.6 : Math.sin(phase) * 1.2;
  ctx.save();
  ctx.scale(s, s);

  // AURA dorada
  if (auraLevel > 0 && !dead) {
    const pulse = 0.75 + Math.sin(p.t * 0.008) * 0.25;
    const r = 44 + auraLevel * 16;
    const g = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
    g.addColorStop(0, `rgba(242,177,61,${0.34 * auraLevel * pulse})`);
    g.addColorStop(0.7, `rgba(242,177,61,${0.16 * auraLevel * pulse})`);
    g.addColorStop(1, "rgba(242,177,61,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -4, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // sombra
  ctx.fillStyle = "rgba(46,42,38,0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 26, 24, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // cola (serpentea)
  const sway = Math.sin(phase * 0.7) * 5;
  ctx.strokeStyle = PALETTE.tail;
  ctx.lineWidth = 3.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.bezierCurveTo(sway, 30, 14 + sway, 34, 20 + sway * 1.4, 28);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(20 + sway * 1.4, 28, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.tail;
  ctx.fill();

  ctx.translate(0, -bob);
  ctx.rotate(lean);

  if (dead) ctx.rotate(Math.PI * 0.9);

  // patitas traseras alternas
  const step = running ? Math.sin(phase) * 3.2 : 0;
  ctx.fillStyle = PALETTE.furDeep;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(-12, 22 + step, 5.4, 7.5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(12, 22 - step, 5.4, 7.5, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // cuerpo (huevo)
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.bezierCurveTo(20, -26, 25, -6, 23, 8);
  ctx.bezierCurveTo(21, 22, 12, 26, 0, 26);
  ctx.bezierCurveTo(-12, 26, -21, 22, -23, 8);
  ctx.bezierCurveTo(-25, -6, -20, -26, 0, -26);
  ctx.closePath();
  ctx.fillStyle = PALETTE.fur;
  ctx.strokeStyle = PALETTE.furDeep;
  ctx.lineWidth = 2.6;
  ctx.fill();
  ctx.stroke();

  // lomo más claro
  ctx.beginPath();
  ctx.ellipse(0, 10, 13, 13, 0, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.belly;
  ctx.globalAlpha = 0.65;
  ctx.fill();
  ctx.globalAlpha = 1;

  // orejas grandes
  const earWig = Math.sin(phase * 0.5) * 1.6;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 15, -24 + earWig);
    ctx.rotate(side * 0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, 11.5, 13, 0, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.fur;
    ctx.strokeStyle = PALETTE.furDeep;
    ctx.lineWidth = 2.4;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 1.5, 6, 7.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.pink;
    ctx.fill();
    ctx.restore();
  }

  // mechón de cabeza
  ctx.strokeStyle = PALETTE.furDeep;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-3, -27);
  ctx.quadraticCurveTo(0, -31, 3, -27);
  ctx.stroke();

  ctx.restore();
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
