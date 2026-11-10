import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Home,
  Move,
  Pause,
  Play,
  Smartphone,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  RatonSnakeGame,
  type SnakeHudState,
  type SnakeRunResult,
} from "../game/snakeEngine";
import type { MouseDir } from "../game/draw";
import CheeseIcon from "./CheeseIcon";
import SettingsPanel from "./SettingsPanel";
import type { SoundEngine } from "../game/audio";
import type { GameSettings } from "../game/settings";
import { peekTilt, probeTilt } from "../game/tilt";

interface Props {
  sound: SoundEngine;
  settings: GameSettings;
  snakeBest: number;
  onSettings: (patch: Partial<GameSettings>) => void;
  onGameOver: (r: SnakeRunResult) => void;
  onQuit: () => void;
}

const SNAKE_HINTS: Record<GameSettings["control"], string> = {
  swipe: "Desliza ↑↓←→ · cruza las paredes",
  zones: "Cruceta ↑↓←→ · cruza las paredes",
  tilt: "Inclina el cel · cruza las paredes",
};

export default function SnakeScreen({
  sound,
  settings,
  snakeBest,
  onSettings,
  onGameOver,
  onQuit,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<RatonSnakeGame | null>(null);
  const cheeseRef = useRef<HTMLSpanElement>(null);
  const rowRef = useRef<HTMLSpanElement>(null);
  const shieldsRef = useRef<HTMLSpanElement>(null);
  const lastHud = useRef({ c: -1, f: -1, s: -1 });
  const [paused, setPaused] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [engineError, setEngineError] = useState(false);
  const [tiltReady, setTiltReady] = useState(false);
  const [tiltDenied, setTiltDenied] = useState(false);
  const [tiltUnsupported, setTiltUnsupported] = useState(false);
  const hintRef = useRef(false);

  const modeRef = useRef(settings.control);
  useEffect(() => {
    modeRef.current = settings.control;
  }, [settings.control]);

  useEffect(() => {
    if (gameRef.current) gameRef.current.vibrateEnabled = settings.vibrate;
  }, [settings.vibrate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      void document.fonts?.load('900 24px "Zen Maru Gothic"');
    } catch {
      /* noop */
    }

    let game: RatonSnakeGame;
    try {
      game = new RatonSnakeGame(canvas, {
        sound,
        onGameOver,
        onPauseChange: setPaused,
        onFatal: () => setEngineError(true),
        onHud: (h: SnakeHudState) => {
          const L = lastHud.current;
          if (h.cheese !== L.c && cheeseRef.current) {
            cheeseRef.current.textContent = String(h.cheese);
            L.c = h.cheese;
          }
          if (h.followers !== L.f && rowRef.current) {
            rowRef.current.textContent = String(h.followers);
            L.f = h.followers;
          }
          if (h.shields !== L.s && shieldsRef.current) {
            shieldsRef.current.textContent = `🩹${h.shields}/3`;
            L.s = h.shields;
          }
          sound.setMusicIntensity(Math.min(1, h.speed01 * 0.85 + 0.15));
        },
      });
      game.vibrateEnabled = settings.vibrate;
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

    // ------- gestos táctiles en 4 direcciones -------
    const area = canvas.parentElement!;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let activeId = -1;
    let swipeUsed = false;
    const STEP = 26;

    const hideHint = () => {
      if (hintRef.current) return;
      hintRef.current = true;
      setShowHint(false);
    };

    const down = (e: PointerEvent) => {
      sound.unlock();
      hideHint();
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("button")) return;

      if (modeRef.current === "swipe") {
        if (tracking) return;
        tracking = true;
        activeId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        swipeUsed = false;
        try {
          area.setPointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
      } else if (modeRef.current === "zones") {
        // En Zonas también permitimos tocar un borde del tablero como apoyo rápido
        const rect = area.getBoundingClientRect();
        const rx = (e.clientX - rect.left) / rect.width - 0.5;
        const ry = (e.clientY - rect.top) / rect.height - 0.5;
        if (Math.abs(rx) > Math.abs(ry)) {
          game.turn(rx < 0 ? "left" : "right");
        } else {
          game.turn(ry < 0 ? "up" : "down");
        }
      }
    };

    const moveEv = (e: PointerEvent) => {
      if (modeRef.current !== "swipe") return;
      if (!tracking || e.pointerId !== activeId || swipeUsed) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) < STEP && Math.abs(dy) < STEP) return;

      let dir: MouseDir;
      if (Math.abs(dx) >= Math.abs(dy)) {
        dir = dx > 0 ? "right" : "left";
      } else {
        dir = dy > 0 ? "down" : "up";
      }
      game.turn(dir);
      swipeUsed = true;
    };

    const up = (e: PointerEvent) => {
      if (modeRef.current !== "swipe") return;
      if (!tracking || e.pointerId !== activeId) return;
      tracking = false;
      activeId = -1;
      swipeUsed = false;
    };

    const ctxMenu = (e: Event) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "w",
          "a",
          "s",
          "d",
          "W",
          "A",
          "S",
          "D",
        ].includes(e.key)
      ) {
        hideHint();
      }
    };

    area.addEventListener("pointerdown", down);
    area.addEventListener("pointermove", moveEv);
    area.addEventListener("pointerup", up);
    area.addEventListener("pointercancel", up);
    area.addEventListener("contextmenu", ctxMenu);
    window.addEventListener("keydown", onKey);

    const hintTimer = window.setTimeout(hideHint, 5500);

    return () => {
      window.clearTimeout(hintTimer);
      window.removeEventListener("keydown", onKey);
      area.removeEventListener("pointerdown", down);
      area.removeEventListener("pointermove", moveEv);
      area.removeEventListener("pointerup", up);
      area.removeEventListener("pointercancel", up);
      area.removeEventListener("contextmenu", ctxMenu);
      game.stopTilt();
      game.destroy();
      gameRef.current = null;
      sound.setMusicIntensity(0);
      sound.setGamePaused(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sound.setGamePaused(paused);
  }, [paused, sound]);

  useEffect(() => {
    if (settings.control !== "tilt") return;
    let alive = true;
    void peekTilt().then((s) => {
      if (!alive) return;
      if (s === "granted") {
        gameRef.current?.startTilt();
        setTiltReady(true);
        setTiltUnsupported(false);
      } else {
        setTiltUnsupported(s === "unsupported");
      }
    });
    return () => {
      alive = false;
    };
  }, [settings.control]);

  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    if (paused) g.stopTilt();
    else if (settings.control === "tilt" && tiltReady) g.startTilt();
  }, [paused, settings.control, tiltReady]);

  const activateTilt = async () => {
    sound.unlock();
    const s = await probeTilt();
    if (s === "granted") {
      gameRef.current?.startTilt();
      setTiltReady(true);
      setTiltUnsupported(false);
      setTiltDenied(false);
      setShowHint(false);
    } else if (s === "unsupported") {
      setTiltUnsupported(true);
    } else {
      setTiltDenied(true);
    }
  };

  const turnDir = (d: MouseDir) => {
    sound.unlock();
    hintRef.current = true;
    setShowHint(false);
    gameRef.current?.turn(d);
  };

  const togglePause = () => gameRef.current?.setPaused(!paused);

  return (
    <div className="absolute inset-0 flex touch-none flex-col justify-between overflow-hidden bg-[#faf4e4] no-select">
      {/* ------- HUD SUPERIOR ------- */}
      <div className="z-20 flex shrink-0 items-start justify-between gap-1.5 px-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-3">
        <div className="flex items-center gap-1 rounded-full border-2 border-[#2e2a26]/10 bg-[#fffdf4]/90 px-2.5 py-1.5 shadow-[0_2px_0_rgba(46,42,38,0.15)]">
          <CheeseIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span ref={cheeseRef} className="tabular text-sm font-black text-[#2e2a26]">
            0
          </span>
        </div>

        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-1 rounded-2xl border-2 border-[#2e2a26]/10 bg-[#fffdf4]/90 px-3.5 py-1 shadow-[0_2px_0_rgba(46,42,38,0.15)]">
            <span className="text-xs font-black text-[#e4572e]">🐭</span>
            <span
              ref={rowRef}
              className="tabular text-xl font-black leading-none text-[#2e2a26] sm:text-2xl"
            >
              0
            </span>
            <span className="text-[10px] font-bold text-[#2e2a26]/50">
              / máx {snakeBest}
            </span>
          </div>
          <span className="mt-0.5 text-[10px] font-bold tracking-[0.22em] text-[#2e2a26]/45">
            行列 · FILA
          </span>
        </div>

        <div
          aria-label="Escudos"
          className="flex items-center gap-1 rounded-full border-2 border-[#2e8b6b]/30 bg-[#eef8f2] px-2.5 py-1.5 shadow-[0_2px_0_rgba(46,42,38,0.15)]"
        >
          <span
            ref={shieldsRef}
            className="tabular text-sm font-black text-[#2e8b6b]"
          >
            🩹0/3
          </span>
        </div>
      </div>

      {/* ------- ESCENARIO CUADRADO CENTRAL ------- */}
      <div className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="block h-full w-full" />

        {engineError && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[#faf4e4] px-8 text-center text-[#2e2a26]">
            <strong className="text-2xl font-black">No se pudo abrir el tablero</strong>
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

        {/* activar giroscopio en iOS */}
        <AnimatePresence>
          {settings.control === "tilt" && !tiltReady && !paused && !engineError && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-0 bottom-3 z-20 flex flex-col items-center gap-2 px-6"
            >
              {tiltUnsupported ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-[#faf4e4]/95 px-5 py-3 shadow-[0_4px_0_rgba(46,42,38,0.18)]">
                  <span className="text-[11px] font-bold text-[#2e2a26]/70">
                    Este dispositivo no tiene sensor de movimiento
                  </span>
                  <button
                    onClick={() => onSettings({ control: "swipe" })}
                    className="rounded-full bg-[#2e2a26] px-5 py-2 text-xs font-black text-[#faf4e4]"
                  >
                    Cambiar a Deslizar
                  </button>
                </div>
              ) : (
                <>
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    onClick={() => void activateTilt()}
                    className="flex items-center gap-2 rounded-full bg-[#e4572e] px-6 py-3 text-sm font-black text-[#fffdf4] shadow-[0_4px_0_#a63a1a]"
                  >
                    <Smartphone className="h-4 w-4" />
                    Activar giroscopio
                  </motion.button>
                  <span className="max-w-[260px] text-center text-[11px] font-bold leading-snug text-[#2e2a26]/60">
                    {tiltDenied
                      ? "Permiso denegado. Ajustes → Safari → Movimiento y acceso al sensor → ACTIVADO."
                      : "Toca para permitir el movimiento del dispositivo"}
                  </span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* pista de control que desaparece al primer toque */}
        <AnimatePresence>
          {showHint && !paused && !engineError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center"
            >
              <div className="flex items-center gap-2 rounded-full bg-[#2e2a26]/65 px-3.5 py-1.5 text-[#faf4e4]">
                <Move className="h-3.5 w-3.5" />
                <span className="text-xs font-bold">
                  {SNAKE_HINTS[settings.control]}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ------- ZONA INFERIOR: cruceta (en Zonas) + Mute / Pausa ------- */}
      <div className="z-20 flex shrink-0 flex-col items-center gap-2 px-4 pb-[max(0.7rem,env(safe-area-inset-bottom))] pt-1">
        {settings.control === "zones" && !paused && !engineError && (
          <div
            className="grid grid-cols-3 gap-1.5"
            aria-label="Cruceta de dirección"
          >
            <div />
            <PadBtn onPress={() => turnDir("up")} label="Arriba">
              <ArrowUp className="h-6 w-6" strokeWidth={2.8} />
            </PadBtn>
            <div />
            <PadBtn onPress={() => turnDir("left")} label="Izquierda">
              <ArrowLeft className="h-6 w-6" strokeWidth={2.8} />
            </PadBtn>
            <PadBtn onPress={() => turnDir("down")} label="Abajo">
              <ArrowDown className="h-6 w-6" strokeWidth={2.8} />
            </PadBtn>
            <PadBtn onPress={() => turnDir("right")} label="Derecha">
              <ArrowRight className="h-6 w-6" strokeWidth={2.8} />
            </PadBtn>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <HudButton
            onClick={() => onSettings({ muted: !settings.muted })}
            label={settings.muted ? "Activar sonido" : "Silenciar efectos"}
          >
            {settings.muted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </HudButton>
          <span className="text-[10px] font-bold text-[#2e2a26]/45">
            {settings.control === "swipe"
              ? "desliza en el tablero"
              : settings.control === "tilt"
                ? "inclina el cel"
                : "toca dirección"}
          </span>
          <HudButton onClick={togglePause} label="Pausa">
            <Pause className="h-4 w-4" />
          </HudButton>
        </div>
      </div>

      {/* ------- OVERLAY PAUSA + OPCIONES ------- */}
      <AnimatePresence>
        {paused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#211d19]/72 px-4 py-5 backdrop-blur-[3px]"
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

function PadBtn({
  children,
  onPress,
  label,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      aria-label={label}
      className="flex h-12 w-14 items-center justify-center rounded-xl border-2 border-[#2e2a26]/15 bg-[#fffdf4]/95 text-[#2e2a26] shadow-[0_3px_0_rgba(46,42,38,0.16)] active:translate-y-0.5 active:bg-[#f2e7cc] active:shadow-none sm:h-13 sm:w-16"
    >
      {children}
    </button>
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
      className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#2e2a26]/10 bg-[#fffdf4]/85 text-[#2e2a26] shadow-[0_2px_0_rgba(46,42,38,0.15)]"
    >
      {children}
    </motion.button>
  );
}
