import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  MoveHorizontal,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { RatonGame, type HudState, type RunResult } from "../game/engine";
import CheeseIcon from "./CheeseIcon";
import SettingsPanel from "./SettingsPanel";
import type { SoundEngine } from "../game/audio";
import type { GameSettings } from "../game/settings";

interface Props {
  sound: SoundEngine;
  settings: GameSettings;
  onSettings: (patch: Partial<GameSettings>) => void;
  onGameOver: (r: RunResult) => void;
  onQuit: () => void;
}

const HINTS: Record<GameSettings["control"], string> = {
  swipe: "Desliza o toca izq/der",
  zones: "Toca la mitad izq o der",
  buttons: "Toca < o > para moverte",
};

export default function GameScreen({
  sound,
  settings,
  onSettings,
  onGameOver,
  onQuit,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<RatonGame | null>(null);
  const distRef = useRef<HTMLSpanElement>(null);
  const cheeseRef = useRef<HTMLSpanElement>(null);
  const auraRef = useRef<HTMLSpanElement>(null);
  const multRef = useRef<HTMLSpanElement>(null);
  const lastHud = useRef({ d: -1, c: -1, a: -1 });
  const [paused, setPaused] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [engineError, setEngineError] = useState(false);

  // el modo de control puede cambiar en pausa → los handlers leen vía ref
  const modeRef = useRef(settings.control);
  useEffect(() => {
    modeRef.current = settings.control;
  }, [settings.control]);

  // ------- estado del juego -------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      void document.fonts?.load('900 24px "Zen Maru Gothic"');
    } catch {
      /* noop */
    }

    let game: RatonGame;
    try {
      game = new RatonGame(canvas, {
        sound,
        onGameOver,
        onPauseChange: setPaused,
        onFatal: () => setEngineError(true),
        onHud: (h: HudState) => {
          const L = lastHud.current;
          if (h.distance !== L.d && distRef.current) {
            distRef.current.textContent = String(h.distance);
            L.d = h.distance;
          }
          if (h.cheese !== L.c && cheeseRef.current) {
            cheeseRef.current.textContent = String(h.cheese);
            L.c = h.cheese;
          }
          if (h.aura !== L.a && auraRef.current && multRef.current) {
            auraRef.current.textContent = `${h.aura}`;
            multRef.current.textContent = `×${h.auraMult.toFixed(2)}`;
            L.a = h.aura;
          }
        },
      });
    } catch {
      setEngineError(true);
      return;
    }
    gameRef.current = game;
    try {
      game.start();
    } catch {
      game.destroy();
      gameRef.current = null;
      setEngineError(true);
      return;
    }

    // ------- gestos táctiles (según el modo elegido) -------
    const parent = canvas.parentElement!;
    let startX = 0;
    let startT = 0;
    let moved = 0;
    let tracking = false;
    let activeId = -1;
    const STEP = 42;

    const tapLane = (clientX: number) => {
      const rect = parent.getBoundingClientRect();
      game.move(clientX - rect.left < rect.width / 2 ? -1 : 1);
      setShowHint(false);
    };

    const down = (e: PointerEvent) => {
      sound.unlock();
      // ignorar toques en botones de UI (pausa, mute, opciones…)
      const target = e.target as HTMLElement | null;
      const btn = target?.closest?.("button");
      if (btn && !btn.hasAttribute("data-lane-btn")) return;

      if (modeRef.current === "swipe") {
        if (tracking) return; // un solo dedo manda
        tracking = true;
        activeId = e.pointerId;
        startX = e.clientX;
        startT = performance.now();
        moved = 0;
        try {
          parent.setPointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
      } else {
        // zonas / botones: respuesta instantánea al toque
        tapLane(e.clientX);
      }
    };
    const moveEv = (e: PointerEvent) => {
      if (modeRef.current !== "swipe") return;
      if (!tracking || e.pointerId !== activeId) return;
      let dx = e.clientX - startX;
      while (Math.abs(dx) >= STEP) {
        const dir = dx > 0 ? 1 : -1;
        game.move(dir as 1 | -1);
        setShowHint(false);
        moved += STEP * dir;
        startX += STEP * dir;
        dx -= STEP * dir;
      }
    };
    const up = (e: PointerEvent) => {
      if (modeRef.current !== "swipe") return;
      if (!tracking || e.pointerId !== activeId) return;
      tracking = false;
      activeId = -1;
      const dt = performance.now() - startT;
      const total = Math.abs(e.clientX - (startX - moved));
      // toque rápido sin arrastre = un paso
      if (dt < 260 && total < 14) tapLane(e.clientX);
    };
    const ctxMenu = (e: Event) => e.preventDefault();

    parent.addEventListener("pointerdown", down);
    parent.addEventListener("pointermove", moveEv);
    parent.addEventListener("pointerup", up);
    parent.addEventListener("pointercancel", up);
    parent.addEventListener("contextmenu", ctxMenu);

    const hintTimer = window.setTimeout(() => setShowHint(false), 6000);

    return () => {
      window.clearTimeout(hintTimer);
      parent.removeEventListener("pointerdown", down);
      parent.removeEventListener("pointermove", moveEv);
      parent.removeEventListener("pointerup", up);
      parent.removeEventListener("pointercancel", up);
      parent.removeEventListener("contextmenu", ctxMenu);
      game.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePause = () => gameRef.current?.setPaused(!paused);

  return (
    <div className="absolute inset-0 touch-none overflow-hidden bg-[#faf4e4] no-select">
      <canvas ref={canvasRef} className="absolute inset-0 z-0 block h-full w-full" />

      {/* error de motor (nunca una pantalla gris muda) */}
      {engineError && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[#faf4e4] px-8 text-center text-[#2e2a26]">
          <strong className="text-2xl font-black">No se pudo abrir la pista</strong>
          <p className="text-sm font-bold text-[#2e2a26]/65">
            El navegador bloqueó el lienzo del juego. Vuelve al menú e inténtalo
            de nuevo.
          </p>
          <button
            onClick={onQuit}
            className="rounded-full bg-[#e4572e] px-6 py-3 font-black text-[#fffdf4]"
          >
            Volver al menú
          </button>
        </div>
      )}

      {/* ------- HUD ------- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-1.5 px-2 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-3">
        <div className="flex items-center gap-1 rounded-full border-2 border-[#2e2a26]/10 bg-[#fffdf4]/85 px-2.5 py-1.5 shadow-[0_2px_0_rgba(46,42,38,0.15)] backdrop-blur-sm sm:px-3">
          <CheeseIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span ref={cheeseRef} className="tabular text-sm font-black text-[#2e2a26]">
            0
          </span>
        </div>

        <div className="flex flex-col items-center">
          <div className="rounded-2xl border-2 border-[#2e2a26]/10 bg-[#fffdf4]/85 px-3 py-1 shadow-[0_2px_0_rgba(46,42,38,0.15)] backdrop-blur-sm sm:px-4">
            <span ref={distRef} className="tabular text-xl font-black leading-none text-[#2e2a26] sm:text-2xl">
              0
            </span>
            <span className="ml-1 text-xs font-bold text-[#2e2a26]/60">m</span>
          </div>
          <span className="mt-1 text-[10px] font-bold tracking-[0.25em] text-[#2e2a26]/45">
            距離
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-full border-2 border-[#f2b13d]/40 bg-[#fff8e6]/90 px-2.5 py-1.5 shadow-[0_2px_0_rgba(46,42,38,0.15)] backdrop-blur-sm sm:px-3">
          <span className="hidden text-[11px] font-black tracking-wider text-[#c77d12] min-[400px]:inline">
            AURA
          </span>
          <span ref={auraRef} className="tabular text-sm font-black text-[#c77d12]">
            0
          </span>
          <span ref={multRef} className="tabular hidden text-[10px] font-bold text-[#c77d12]/70 sm:inline">
            ×1.00
          </span>
        </div>
      </div>

      {/* botones pause / mute */}
      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-bottom))] z-20 flex gap-2">
        <HudButton
          onClick={() => onSettings({ muted: !settings.muted })}
          label={settings.muted ? "Activar sonido" : "Silenciar"}
        >
          {settings.muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </HudButton>
        <HudButton onClick={togglePause} label="Pausa">
          <Pause className="h-4 w-4" />
        </HudButton>
      </div>

      {/* ------- botones < > visibles (modo Botones) ------- */}
      <AnimatePresence>
        {settings.control === "buttons" && !paused && !engineError && (
          <>
            <motion.button
              key="l"
              data-lane-btn
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              whileTap={{ scale: 0.85 }}
              aria-label="Carril izquierda"
              className="absolute left-3 top-1/2 z-10 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#2e2a26]/20 bg-[#fffdf4]/55 text-[#2e2a26]/75 shadow-[0_3px_0_rgba(46,42,38,0.15)] backdrop-blur-[2px]"
            >
              <ChevronLeft className="h-9 w-9" strokeWidth={3} />
            </motion.button>
            <motion.button
              key="r"
              data-lane-btn
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              whileTap={{ scale: 0.85 }}
              aria-label="Carril derecha"
              className="absolute right-3 top-1/2 z-10 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#2e2a26]/20 bg-[#fffdf4]/55 text-[#2e2a26]/75 shadow-[0_3px_0_rgba(46,42,38,0.15)] backdrop-blur-[2px]"
            >
              <ChevronRight className="h-9 w-9" strokeWidth={3} />
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {/* pista del modo de control */}
      <AnimatePresence>
        {showHint && !paused && !engineError && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] z-20 flex justify-center"
          >
            <div className="flex items-center gap-2 rounded-full bg-[#2e2a26]/85 px-4 py-2 text-[#faf4e4]">
              <MoveHorizontal className="h-5 w-5 animate-pulse" />
              <span className="text-sm font-bold">{HINTS[settings.control]}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------- overlay PAUSA + OPCIONES ------- */}
      <AnimatePresence>
        {paused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-[#211d19]/72 px-4 py-5 backdrop-blur-[3px]"
          >
            <div className="font-brush text-4xl text-[#faf4e4] sm:text-5xl">
              一時停止
            </div>
            <div className="text-xs font-bold tracking-[0.4em] text-[#faf4e4]/60">
              PAUSA
            </div>

            <SettingsPanel settings={settings} onChange={onSettings} />

            <div className="flex w-full max-w-[340px] gap-3">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={togglePause}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#e4572e] px-6 py-3.5 text-lg font-black text-[#fffdf4] shadow-[0_4px_0_#a63a1a]"
              >
                <Play className="h-5 w-5" /> Seguir
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onQuit}
                className="flex items-center justify-center gap-2 rounded-full border-2 border-[#faf4e4]/30 px-5 py-3.5 font-black text-[#faf4e4]"
              >
                <Home className="h-5 w-5" /> Menú
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HudButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      aria-label={label}
      className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#2e2a26]/10 bg-[#fffdf4]/85 text-[#2e2a26] shadow-[0_2px_0_rgba(46,42,38,0.15)] backdrop-blur-sm"
    >
      {children}
    </motion.button>
  );
}
