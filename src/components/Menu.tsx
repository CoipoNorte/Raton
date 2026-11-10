import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  MoveHorizontal,
  Zap,
  TriangleAlert,
  Trophy,
  Settings,
  X,
  Grid2X2,
} from "lucide-react";
import { drawCheese, drawCloud, drawMouse, drawTrap, drawPetal } from "../game/draw";
import CheeseIcon from "./CheeseIcon";
import SettingsPanel from "./SettingsPanel";
import type { SaveData } from "../game/db";
import type { GameSettings } from "../game/settings";

interface Props {
  save: SaveData | null;
  settings: GameSettings;
  onSettings: (patch: Partial<GameSettings>) => void;
  onPlay: () => void;
  onPlaySnake: () => void;
}

export default function Menu({
  save,
  settings,
  onSettings,
  onPlay,
  onPlaySnake,
}: Props) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#faf4e4] washi-grain no-select">
      {/* botón de opciones */}
      <motion.button
        whileTap={{ scale: 0.88, rotate: 30 }}
        onClick={() => setShowSettings(true)}
        aria-label="Opciones"
        className="absolute right-4 top-[max(0.85rem,env(safe-area-inset-top))] z-30 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#2e2a26]/10 bg-[#fffdf4]/85 text-[#2e2a26] shadow-[0_2px_0_rgba(46,42,38,0.15)]"
      >
        <Settings className="h-5 w-5" />
      </motion.button>

      {/* overlay de opciones */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-[#211d19]/70 px-4 backdrop-blur-[3px]"
          >
            <SettingsPanel settings={settings} onChange={onSettings} />
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowSettings(false)}
              className="flex items-center gap-2 rounded-full border-2 border-[#faf4e4]/30 px-6 py-3 font-black text-[#faf4e4]"
            >
              <X className="h-5 w-5" /> Cerrar
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* sol bermellón */}
      <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#e4572e] opacity-90" />
      <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full ring-8 ring-[#e4572e]/15" />

      {/* texto vertical decorativo */}
      <div className="vertical-jp absolute left-3 top-8 select-none text-[12px] font-bold text-[#2e2a26]/35">
        チーズを求めて三千メートル
      </div>
      <div className="vertical-jp absolute bottom-8 right-3 select-none text-[12px] font-bold text-[#2e2a26]/35">
        ネズミ快跑
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-col items-center justify-between gap-2 px-6 py-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* cabecera */}
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="text-[11px] font-black tracking-[0.5em] text-[#e4572e]">
            ラトン
          </div>
          <h1 className="mt-0.5 text-[46px] font-black leading-none tracking-tight text-[#2e2a26] sm:text-[52px]">
            RATÓN
          </h1>
          <p className="mt-1 text-xs font-bold text-[#2e2a26]/55 sm:text-sm">
            el juego del queso · チーズ大作戦
          </p>
        </motion.div>

        {/* ilustración viva: ratón de frente */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="shrink-0"
        >
          <MenuScene paused={showSettings} />
        </motion.div>

        {/* récord de ambos modos */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
          className="w-full max-w-[320px]"
        >
          <div className="flex items-center justify-between rounded-2xl border-2 border-[#2e2a26]/10 bg-[#fffdf4]/90 px-3.5 py-2.5 shadow-[0_3px_0_rgba(46,42,38,0.12)]">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f2a83b]/20">
                <Trophy className="h-4 w-4 text-[#c77d12]" />
              </span>
              <div>
                <div className="text-[9px] font-black tracking-[0.2em] text-[#2e2a26]/45">
                  最高記録 · RÉCORDS
                </div>
                <div className="tabular text-base font-black leading-tight text-[#2e2a26]">
                  {save?.best ?? 0}
                  <span className="ml-0.5 text-[11px] font-bold text-[#2e2a26]/50">m</span>
                  <span className="mx-1.5 text-[#2e2a26]/20">·</span>
                  <span>{save?.snakeBest ?? 0}</span>
                  <span className="ml-0.5 text-xs">🐭</span>
                </div>
              </div>
            </div>
            <div className="text-right text-[10px] font-bold leading-tight text-[#2e2a26]/50">
              <div>{(save?.runs ?? 0) + (save?.snakeRuns ?? 0)} partidas</div>
              <div>{(save?.cheeseTotal ?? 0) + (save?.snakeCheeseTotal ?? 0)} quesos</div>
            </div>
          </div>
        </motion.div>

        {/* botones de los dos modos + consejos compactos */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.45 }}
          className="flex w-full max-w-[320px] flex-col items-center gap-2.5"
        >
          <motion.button
            whileTap={{ scale: 0.94, y: 3 }}
            whileHover={{ scale: 1.02 }}
            onClick={onPlay}
            className="flex w-full items-center justify-center gap-2.5 rounded-full bg-[#e4572e] py-3.5 text-xl font-black text-[#fffdf4] shadow-[0_5px_0_#a63a1a,0_8px_20px_rgba(228,87,46,0.32)]"
          >
            <Play className="h-5 w-5 fill-current" />
            JUGAR · 3 Carriles
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95, y: 2 }}
            whileHover={{ scale: 1.02 }}
            onClick={onPlaySnake}
            className="flex w-full items-center justify-center gap-2.5 rounded-full border-2 border-[#2e2a26]/15 bg-[#fffdf4] py-3 text-lg font-black text-[#2e2a26] shadow-[0_4px_0_rgba(46,42,38,0.14)]"
          >
            <Grid2X2 className="h-5 w-5 text-[#c77d12]" />
            FILA DE RATONES
          </motion.button>

          {/* cómo jugar */}
          <div className="grid w-full grid-cols-3 gap-1.5 text-center">
            <Tip
              icon={<MoveHorizontal className="h-3.5 w-3.5" />}
              jp="走る"
              text="Desliza y gira"
            />
            <Tip
              icon={<CheeseIcon className="h-3.5 w-3.5" />}
              jp="チーズ"
              text="Come y haz fila"
            />
            <Tip
              icon={<Zap className="h-3.5 w-3.5" />}
              jp="オーラ"
              text="Esquiva trampas"
            />
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#2e2a26]/45">
            <TriangleAlert className="h-3 w-3" />
            Empiezas con 3 vidas en carrera · 🩹 escudos en fila.
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Tip({
  icon,
  jp,
  text,
}: {
  icon: React.ReactNode;
  jp: string;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl border border-[#2e2a26]/10 bg-[#fffdf4]/70 px-1 py-1.5">
      <span className="text-[#e4572e]">{icon}</span>
      <span className="text-[9px] font-black text-[#2e2a26]/60">{jp}</span>
      <span className="text-[9px] font-semibold leading-tight text-[#2e2a26]/55">
        {text}
      </span>
    </div>
  );
}

/** Escena viva del menú: ratón corriendo de frente entre nubes, queso y trampa */
function MenuScene({ paused }: { paused: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // con Opciones abierto la escena queda tapada: se congela (no gasta batería
  // ni obliga a recalcular el desenfoque del panel en cada frame)
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 260;
    const H = 152;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    const petals = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random() * W,
      y: Math.random() * H,
      s: 0.5 + Math.random() * 0.65,
      r: Math.random() * Math.PI,
      v: 14 + i * 3,
    }));

    const loop = (t: number) => {
      if (pausedRef.current) {
        raf = requestAnimationFrame(loop);
        return;
      }
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.save();
      ctx.translate(54, 34);
      drawCloud(ctx, 0.72);
      ctx.restore();
      ctx.save();
      ctx.translate(232, 24);
      drawCloud(ctx, 0.54);
      ctx.restore();
      ctx.restore();

      for (const p of petals) {
        p.y += p.v * 0.016;
        p.x += Math.sin(t * 0.001 + p.r) * 0.35;
        if (p.y > H + 10) p.y = -10;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r + t * 0.001);
        drawPetal(ctx, p.s);
        ctx.restore();
      }

      // queso flotando
      ctx.save();
      ctx.translate(58, 108 + Math.sin(t * 0.003) * 4);
      drawCheese(ctx, t, 0.85);
      ctx.restore();
      // trampa quieta
      ctx.save();
      ctx.translate(214, 120);
      drawTrap(ctx, 0.76, 0, 0);
      ctx.restore();
      // ratón de frente saludando en el menú
      ctx.save();
      ctx.translate(W / 2, 112);
      drawMouse(ctx, {
        t,
        s: 1.24,
        lean: Math.sin(t * 0.0018) * 0.05,
        running: true,
        auraLevel: 0.55,
        dead: false,
        dir: "down",
      });
      ctx.restore();

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} style={{ width: 260, height: 152 }} aria-hidden />;
}
