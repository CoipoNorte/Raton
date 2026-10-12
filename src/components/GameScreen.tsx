import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  MoveHorizontal,
  Pause,
  Play,
  Smartphone,
  Volume2,
  VolumeX,
} from "lucide-react";
import { RatonGame, type HudState, type RunResult } from "../game/engine";
import CheeseIcon from "./CheeseIcon";
import SettingsPanel from "./SettingsPanel";
import type { SoundEngine } from "../game/audio";
import type { GameSettings } from "../game/settings";
import type { TiltUIState } from "../game/gyro";

interface Props {
  sound: SoundEngine;
  settings: GameSettings;
  onSettings: (patch: Partial<GameSettings>) => void;
  onGameOver: (r: RunResult) => void;
  onQuit: () => void;
}

type TiltStatus = TiltUIState;

const HINTS: Record<GameSettings["control"], string> = {
  swipe: "Desliza para cambiar de carril",
  zones: "Toca la mitad izq o der",
  tilt: "Inclina el celular a los lados",
};

/* Deslizar = SOLO arrastrar (nada de toques por área: eso es de Zonas).
   Distancia para UN carril + cooldown: un latigazo rápido nunca salta dos. */
const STEP = 46;
const STEP_COOLDOWN = 110; // ms

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
  const livesRef = useRef<HTMLDivElement>(null);
  const gaugeRef = useRef<HTMLDivElement>(null);
  const [berry, setBerry] = useState(false);
  const [tilt, setTilt] = useState<TiltStatus>("off");
  const lastHud = useRef({ d: -1, c: -1, a: -1, l: -1, b: false, t: 0 });
  const [paused, setPaused] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [engineError, setEngineError] = useState(false);

  // el modo puede cambiarse en pausa → los handlers leen vía ref
  const modeRef = useRef(settings.control);

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
          if (h.lives !== L.l && livesRef.current) {
            livesRef.current.textContent = `🩹${h.lives}x`; // [emoji][número]x
            L.l = h.lives;
          }
          if (h.strawberry !== L.b) {
            L.b = h.strawberry;
            setBerry(h.strawberry);
          }
          // indicador de inclinación (solo se escribe cuando cambia)
          const tv = Math.round(h.tilt * 40) / 40;
          if (tv !== L.t && gaugeRef.current) {
            L.t = tv;
            gaugeRef.current.style.transform = `translateX(${(tv * 34).toFixed(1)}px)`;
          }
          sound.setMusicIntensity(h.speed01);
        },
      });
    } catch {
      setEngineError(true);
      return;
    }
    gameRef.current = game;
    game.vibrateEnabled = settings.vibrate;
    try {
      game.start();
    } catch {
      game.destroy();
      gameRef.current = null;
      setEngineError(true);
      return;
    }

    // ------- gestos -------
    const parent = canvas.parentElement!;
    let originX = 0;
    let originY = 0;
    let cursorX = 0;
    let lastStepAt = 0;
    let axis: "none" | "x" | "y" = "none";
    let tracking = false;
    let activeId = -1;

    const tapLane = (clientX: number) => {
      const rect = parent.getBoundingClientRect();
      game.move(clientX - rect.left < rect.width / 2 ? -1 : 1);
      setShowHint(false);
    };

    const down = (e: PointerEvent) => {
      sound.unlock();
      const target = e.target as HTMLElement | null;
      const btn = target?.closest?.("button");
      if (btn) return; // los botones de UI no mueven al ratón

      if (modeRef.current === "tilt") {
        // iOS: el permiso solo puede pedirse dentro de un gesto
        if (!game.tiltActive) void game.enableTilt().then(setTilt);
        return;
      }
      if (modeRef.current === "zones") {
        tapLane(e.clientX); // respuesta inmediata al toque
        return;
      }

      if (tracking) return; // un solo dedo manda
      tracking = true;
      activeId = e.pointerId;
      originX = e.clientX;
      originY = e.clientY;
      cursorX = e.clientX;
      axis = "none";
      try {
        parent.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    };

    const moveEv = (e: PointerEvent) => {
      if (modeRef.current !== "swipe") return;
      if (!tracking || e.pointerId !== activeId) return;
      const totalX = e.clientX - originX;
      const totalY = e.clientY - originY;

      // candado de eje: un gesto claramente vertical NO mueve al ratón
      if (axis === "none") {
        if (Math.abs(totalX) < 8 && Math.abs(totalY) < 8) return;
        if (Math.abs(totalY) > Math.abs(totalX)) {
          axis = "y";
          return;
        }
        axis = "x";
      }
      if (axis !== "x") return;

      const d = e.clientX - cursorX;
      if (Math.abs(d) < STEP) return;
      const now = performance.now();
      // rebaseamos SIEMPRE: el excedente del arrastre no se convierte en un
      // segundo salto de carril, así el control es exacto (1 carril / gesto)
      cursorX = e.clientX;
      if (now - lastStepAt < STEP_COOLDOWN) return;
      lastStepAt = now;
      game.move(d > 0 ? 1 : -1);
      setShowHint(false);
    };

    const up = (e: PointerEvent) => {
      // Deslizar SOLO desliza: soltar el dedo tras un toque NO mueve al ratón
      // (el toque por área pertenece al modo Zonas, no a este).
      if (modeRef.current !== "swipe") return;
      if (!tracking || e.pointerId !== activeId) return;
      tracking = false;
      activeId = -1;
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
      game.stopTilt();
      game.destroy();
      gameRef.current = null;
      sound.setMusicIntensity(0);
      sound.setGamePaused(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sincroniza el modo de control elegido (se puede cambiar desde la pausa)
  useEffect(() => {
    modeRef.current = settings.control;
    const game = gameRef.current;
    if (!game) return;
    if (settings.control === "tilt") {
      // si el permiso ya se concedió (p. ej. desde Opciones del menú),
      // enableTilt entra directo; si falta el gesto, queda en "needs"
      setTilt(game.tiltActive ? "on" : "needs");
      void game.enableTilt().then(setTilt);
    } else {
      game.stopTilt();
      setTilt("off");
    }
  }, [settings.control]);

  // pausar la partida también serena la música
  useEffect(() => {
    sound.setGamePaused(paused);
  }, [paused, sound]);

  const togglePause = () => gameRef.current?.setPaused(!paused);

  const enableTilt = () => {
    const game = gameRef.current;
    if (!game) return;
    void game.enableTilt().then(setTilt);
  };

  const tiltOn = settings.control === "tilt";

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

      {/* ------- HUD superior ------- */}
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

      {/* ------- barra inferior: [mute] [🩹3x] [pausa] + giro de precisión ------- */}
      <div className="absolute bottom-[max(0.625rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5">
        <AnimatePresence>
          {berry && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="rounded-full bg-[#e4572e] px-3 py-0.5 text-[11px] font-black text-[#fff4e3] shadow-[0_2px_0_#a63a1a]"
            >
              🍓 queso ×20
            </motion.div>
          )}
        </AnimatePresence>

        {/* indicador de inclinación: ayuda a calibrar el centro del celular */}
        {tiltOn && tilt === "on" && (
          <div className="relative h-4 w-[100px] rounded-full border border-[#2e2a26]/15 bg-[#fffdf4]/85 shadow-[0_1px_0_rgba(46,42,38,0.12)]">
            <span className="absolute left-1/2 top-1/2 h-2 w-px -translate-x-1/2 -translate-y-1/2 bg-[#2e2a26]/25" />
            <div
              ref={gaugeRef}
              className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e4572e]"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
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
          <div
            ref={livesRef}
            aria-label="Vidas"
            className="tabular flex h-10 min-w-[4.25rem] items-center justify-center rounded-full border-2 border-[#2e2a26]/10 bg-[#fffdf4]/90 px-3 text-base font-black text-[#2e2a26] shadow-[0_2px_0_rgba(46,42,38,0.15)] backdrop-blur-sm"
          >
            🩹3x
          </div>
          <HudButton onClick={togglePause} label="Pausa">
            <Pause className="h-4 w-4" />
          </HudButton>
        </div>
      </div>

      {/* ------- permiso / estado del giroscopio ------- */}
      <AnimatePresence>
        {tiltOn && !paused && !engineError && tilt !== "on" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute inset-x-0 bottom-[max(7rem,calc(env(safe-area-inset-bottom)+6rem))] z-20 flex justify-center px-4"
          >
            <button
              onClick={enableTilt}
              className="flex items-center gap-2 rounded-full bg-[#2e2a26]/90 px-4 py-2.5 text-sm font-black text-[#faf4e4] shadow-lg active:scale-95"
            >
              <Smartphone className="h-4 w-4" />
              {tilt === "unsupported"
                ? "Sin giroscopio · usa Zonas"
                : tilt === "denied"
                  ? "Permiso denegado · actívalo en Opciones"
                  : "Tocar para autorizar giroscopio"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* pista del modo de control */}
      <AnimatePresence>
        {showHint && !paused && !engineError && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 bottom-[max(7.5rem,calc(env(safe-area-inset-bottom)+7rem))] z-20 flex justify-center px-4"
          >
            <div className="flex items-center gap-2 rounded-full bg-[#2e2a26]/85 px-4 py-2 text-[#faf4e4]">
              {tiltOn ? (
                <Smartphone className="h-5 w-5 animate-pulse" />
              ) : (
                <MoveHorizontal className="h-5 w-5 animate-pulse" />
              )}
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
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#211d19]/72 px-4 py-5 backdrop-blur-[3px]"
          >
            <div className="font-brush text-4xl text-[#faf4e4] sm:text-5xl">一時停止</div>
            <div className="text-xs font-bold tracking-[0.4em] text-[#faf4e4]/60">
              PAUSA
            </div>

            <SettingsPanel
              settings={settings}
              onChange={onSettings}
              tiltState={tilt}
              onTiltActivate={enableTilt}
            />

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
