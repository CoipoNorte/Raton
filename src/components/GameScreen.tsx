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
import { peekTilt, probeTilt } from "../game/tilt";

interface Props {
  sound: SoundEngine;
  settings: GameSettings;
  onSettings: (patch: Partial<GameSettings>) => void;
  onGameOver: (r: RunResult) => void;
  onQuit: () => void;
}

const HINTS: Record<GameSettings["control"], string> = {
  swipe: "Desliza: 1 gesto = 1 carril",
  zones: "Toca la mitad izq o der",
  tilt: "Inclina el celular a los lados",
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
  const livesRef = useRef<HTMLDivElement>(null);
  const [berry, setBerry] = useState(false);
  const lastHud = useRef({ d: -1, c: -1, a: -1, l: -1, b: false });
  const [paused, setPaused] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [engineError, setEngineError] = useState(false);
  const [tiltReady, setTiltReady] = useState(false);
  const [tiltDenied, setTiltDenied] = useState(false);
  const [tiltUnsupported, setTiltUnsupported] = useState(false);
  /** la pista de control se oculta al primer toque y no vuelve a salir */
  const hintRef = useRef(false);

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
          if (h.lives !== L.l && livesRef.current) {
            // formato pedido: [emoji][número]x → 🩹3x
            livesRef.current.textContent = `🩹${h.lives}x`;
            L.l = h.lives;
          }
          if (h.strawberry !== L.b) {
            L.b = h.strawberry;
            setBerry(h.strawberry);
          }
          // la música sigue la velocidad del juego (tempo + percusión)
          sound.setMusicIntensity(h.speed01);
        },
      });
      game.vibrateEnabled = settings.vibrate;
      // el giroscopio lo activa su propio efecto (necesita un toque en iOS)
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
    let tracking = false;
    let activeId = -1;
    let swipeUsed = false; // DESLIZAR: un gesto mueve UN carril, nunca dos
    const STEP = 40;

    // La pista de control desaparece al PRIMER toque: en cuanto el jugador
    // toca la pantalla ya sabe qué hacer y no necesita el texto encima.
    const hideHint = () => {
      if (hintRef.current) return;
      hintRef.current = true;
      setShowHint(false);
    };

    // ZONAS: tocar la mitad izquierda/derecha mueve un carril
    const tapLane = (clientX: number) => {
      const rect = parent.getBoundingClientRect();
      game.move(clientX - rect.left < rect.width / 2 ? -1 : 1);
      hideHint();
    };

    const down = (e: PointerEvent) => {
      sound.unlock();
      hideHint();
      const target = e.target as HTMLElement | null;
      // ignorar toques en botones de UI (pausa, mute, opciones…)
      if (target?.closest?.("button")) return;

      if (modeRef.current === "swipe") {
        // DESLIZAR: el toque solo empieza a rastrear, NO mueve.
        // Moverse con un tap es cosa del modo Zonas.
        if (tracking) return; // un solo dedo manda
        tracking = true;
        activeId = e.pointerId;
        startX = e.clientX;
        swipeUsed = false;
        try {
          parent.setPointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
      } else if (modeRef.current === "zones") {
        // ZONAS: respuesta instantánea al toque
        tapLane(e.clientX);
      }
      // tilt: tocar no mueve (mueve la inclinación); solo desbloquea audio
    };
    const moveEv = (e: PointerEvent) => {
      if (modeRef.current !== "swipe") return;
      if (!tracking || e.pointerId !== activeId || swipeUsed) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) >= STEP) {
        game.move(dx > 0 ? 1 : -1);
        hideHint();
        swipeUsed = true; // hasta soltar no hay segundo carril: precisión
      }
    };
    const up = (e: PointerEvent) => {
      if (modeRef.current !== "swipe") return;
      if (!tracking || e.pointerId !== activeId) return;
      tracking = false;
      activeId = -1;
      // Sin "tap = paso": en Deslizar solo el deslizamiento mueve.
      swipeUsed = false;
    };
    const ctxMenu = (e: Event) => e.preventDefault();

    // el teclado también despide la pista
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "a" ||
        e.key === "d" ||
        e.key === "A" ||
        e.key === "D"
      ) {
        hideHint();
      }
    };

    parent.addEventListener("pointerdown", down);
    parent.addEventListener("pointermove", moveEv);
    parent.addEventListener("pointerup", up);
    parent.addEventListener("pointercancel", up);
    parent.addEventListener("contextmenu", ctxMenu);
    window.addEventListener("keydown", onKey);

    // red de seguridad: si el jugador no toca nada, la pista se va sola
    const hintTimer = window.setTimeout(hideHint, 6000);

    return () => {
      window.clearTimeout(hintTimer);
      window.removeEventListener("keydown", onKey);
      parent.removeEventListener("pointerdown", down);
      parent.removeEventListener("pointermove", moveEv);
      parent.removeEventListener("pointerup", up);
      parent.removeEventListener("pointercancel", up);
      parent.removeEventListener("contextmenu", ctxMenu);
      game.stopTilt();
      game.destroy();
      gameRef.current = null;
      // al salir de la pista la música vuelve a su calma de menú
      sound.setMusicIntensity(0);
      sound.setGamePaused(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pausar la partida también serena la música (no se queda sonando en sordina)
  useEffect(() => {
    sound.setGamePaused(paused);
  }, [paused, sound]);

  // ------- giroscopio: comprobar al entrar (sin pedir permiso) -------
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
        // Safari aún sin permiso (aparece el botón) o sin sensor
        setTiltUnsupported(s === "unsupported");
      }
    });
    return () => {
      alive = false;
    };
  }, [settings.control]);

  // pausar detiene la escucha del sensor (no gasta batería en pausa)
  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    if (paused) g.stopTilt();
    else if (settings.control === "tilt" && tiltReady) g.startTilt();
  }, [paused, settings.control, tiltReady]);

  /** Toque del botón: AQUÍ Safari sí permite pedir el permiso. */
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
        <div className="flex items-center gap-1 rounded-full border-2 border-[#2e2a26]/10 bg-[#fffdf4]/85 px-2.5 py-1.5 shadow-[0_2px_0_rgba(46,42,38,0.15)] sm:px-3">
          <CheeseIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span ref={cheeseRef} className="tabular text-sm font-black text-[#2e2a26]">
            0
          </span>
        </div>

        <div className="flex flex-col items-center">
          <div className="rounded-2xl border-2 border-[#2e2a26]/10 bg-[#fffdf4]/85 px-3 py-1 shadow-[0_2px_0_rgba(46,42,38,0.15)] sm:px-4">
            <span ref={distRef} className="tabular text-xl font-black leading-none text-[#2e2a26] sm:text-2xl">
              0
            </span>
            <span className="ml-1 text-xs font-bold text-[#2e2a26]/60">m</span>
          </div>
          <span className="mt-1 text-[10px] font-bold tracking-[0.25em] text-[#2e2a26]/45">
            距離
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-full border-2 border-[#f2b13d]/40 bg-[#fff8e6]/90 px-2.5 py-1.5 shadow-[0_2px_0_rgba(46,42,38,0.15)] sm:px-3">
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

      {/* barra inferior central: [mute] [🩹3x vidas] [pausa] + aviso de fresa */}
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
        <div className="flex items-center gap-2">
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
          <div
            ref={livesRef}
            aria-label="Vidas"
            className="tabular flex h-10 min-w-[4.25rem] items-center justify-center rounded-full border-2 border-[#2e2a26]/10 bg-[#fffdf4]/90 px-3 text-base font-black text-[#2e2a26] shadow-[0_2px_0_rgba(46,42,38,0.15)]"
          >
            🩹3x
          </div>
          <HudButton onClick={togglePause} label="Pausa">
            <Pause className="h-4 w-4" />
          </HudButton>
        </div>
      </div>

      {/* ------- activar giroscopio (Safari exige un toque) ------- */}
      <AnimatePresence>
        {settings.control === "tilt" && !tiltReady && !paused && !engineError && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="absolute inset-x-0 bottom-[max(7.5rem,calc(env(safe-area-inset-bottom)+7rem))] z-20 flex flex-col items-center gap-2 px-6"
          >
            {tiltUnsupported ? (
              /* no hay sensor: ni botón, directo a cambiar de control */
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
                  className="flex items-center gap-2 rounded-full bg-[#e4572e] px-6 py-3.5 text-base font-black text-[#fffdf4] shadow-[0_4px_0_#a63a1a]"
                >
                  <Smartphone className="h-5 w-5" />
                  Activar giroscopio
                </motion.button>
                <span className="max-w-[260px] text-center text-[11px] font-bold leading-snug text-[#2e2a26]/60">
                  {tiltDenied ? (
                    <>
                      Permiso denegado. Ajustes → Safari → <b>Movimiento y acceso
                      al sensor</b> → ACTIVADO, y vuelve a tocar.
                    </>
                  ) : (
                    "Toca para permitir el movimiento del dispositivo"
                  )}
                </span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* pista del modo de control: se va al primer toque, sinmolestar */}
      <AnimatePresence>
        {showHint && !paused && !engineError && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute inset-x-0 bottom-[max(7rem,calc(env(safe-area-inset-bottom)+6.5rem))] z-20 flex justify-center"
          >
            <div className="flex items-center gap-2 rounded-full bg-[#2e2a26]/60 px-3.5 py-1.5 text-[#faf4e4]/90">
              <MoveHorizontal className="h-4 w-4" />
              <span className="text-xs font-bold">{HINTS[settings.control]}</span>
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
      className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#2e2a26]/10 bg-[#fffdf4]/85 text-[#2e2a26] shadow-[0_2px_0_rgba(46,42,38,0.15)]"
    >
      {children}
    </motion.button>
  );
}
