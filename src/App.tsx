import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import Menu from "./components/Menu";
import GameScreen from "./components/GameScreen";
import SnakeScreen from "./components/SnakeScreen";
import GameOver, { type OverData } from "./components/GameOver";
import { SoundEngine } from "./game/audio";
import {
  EMPTY_SAVE,
  loadSave,
  applyRun,
  applySnakeRun,
  type SaveData,
} from "./game/db";
import { loadSettings, saveSettings, type GameSettings } from "./game/settings";
import type { RunResult } from "./game/engine";
import type { SnakeRunResult } from "./game/snakeEngine";

type Screen = "menu" | "runner" | "snake";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [lastMode, setLastMode] = useState<"runner" | "snake">("runner");
  const [runKey, setRunKey] = useState(0);
  const [save, setSave] = useState<SaveData | null>(null);
  const [result, setResult] = useState<OverData | null>(null);

  const sound = useMemo(() => new SoundEngine(), []);

  // ------- ajustes (sonido + controles) -------
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const applySettings = useCallback((patch: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  // sincroniza el motor de audio con los ajustes
  useEffect(() => {
    sound.setVolume(settings.volume);
    sound.setMuted(settings.muted);
    sound.setMusicVolume(settings.musicVol);
    sound.setMusicEnabled(settings.music);
  }, [sound, settings.volume, settings.muted, settings.music, settings.musicVol]);

  // modo musical según pantalla: menú = calma · juego = tempo por velocidad
  useEffect(() => {
    sound.setMusicMode(screen === "menu" ? "menu" : "game");
    if (screen === "menu") {
      sound.setMusicIntensity(0);
      sound.setGamePaused(false);
    }
  }, [screen, sound]);

  // el primer gesto en cualquier parte desbloquea el audio (menú incluido)
  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [sound]);

  // segundo / tercer plano: nada suena fuera de la pestaña
  useEffect(() => {
    const onVis = () => sound.setHidden(document.hidden);
    const onHide = () => sound.setHidden(true);
    const onShow = () => {
      if (!document.hidden) sound.setHidden(false);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("blur", onHide);
    window.addEventListener("focus", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("blur", onHide);
      window.removeEventListener("focus", onShow);
    };
  }, [sound]);

  useEffect(() => () => sound.stopMusic(), [sound]);

  const saveRef = useRef<SaveData | null>(null);

  useEffect(() => {
    loadSave().then((s) => {
      saveRef.current = s;
      setSave(s);
    });
  }, []);

  const startMode = useCallback(
    (mode: "runner" | "snake") => {
      sound.unlock();
      setResult(null);
      setLastMode(mode);
      setRunKey((k) => k + 1);
      setScreen(mode);
    },
    [sound]
  );

  const startRunner = useCallback(() => startMode("runner"), [startMode]);
  const startSnake = useCallback(() => startMode("snake"), [startMode]);
  const retryCurrent = useCallback(
    () => startMode(lastMode),
    [startMode, lastMode]
  );

  const quitToMenu = useCallback(() => {
    setResult(null);
    setScreen("menu");
  }, []);

  const handleRunnerGameOver = useCallback(
    (r: RunResult) => {
      const base = saveRef.current ?? EMPTY_SAVE;
      const { next, isRecord } = applyRun(base, r);
      saveRef.current = next;
      setSave(next);
      setResult({
        mode: "runner",
        distance: Math.floor(r.distance),
        cheese: r.cheese,
        auraMax: r.auraMax,
        best: next.best,
        isRecord,
      });
      if (isRecord && r.distance > 50) {
        window.setTimeout(() => sound.record(), 550);
      }
    },
    [sound]
  );

  const handleSnakeGameOver = useCallback(
    (r: SnakeRunResult) => {
      const base = saveRef.current ?? EMPTY_SAVE;
      const { next, isRecord } = applySnakeRun(base, r);
      saveRef.current = next;
      setSave(next);
      setResult({
        mode: "snake",
        maxChain: r.maxChain,
        cheese: r.cheese,
        shieldsMax: r.shieldsMax,
        best: next.snakeBest,
        isRecord,
      });
      if (isRecord && r.maxChain >= 3) {
        window.setTimeout(() => sound.record(), 550);
      }
    },
    [sound]
  );

  // atajos de teclado: Enter/Espacio = jugar/reintentar · Esc = menú
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        if (screen === "menu") {
          e.preventDefault();
          startRunner();
        } else if (result) {
          e.preventDefault();
          retryCurrent();
        }
      }
      if (e.key === "Escape" && screen !== "menu") quitToMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, result, startRunner, retryCurrent, quitToMenu]);

  return (
    <div className="relative flex h-full w-full items-stretch justify-center overflow-hidden bg-[#211d19]">
      {/* decoración lateral en escritorio */}
      <SideDeco side="left" />
      <SideDeco side="right" />

      {/* columna del juego: nunca más ancha que 480px y conserva
          proporción vertical en pantallas bajas (máx ~62% de la altura) */}
      <div className="relative h-full w-full max-w-[min(480px,62dvh)] overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
        <AnimatePresence mode="wait">
          {screen === "menu" && (
            <Menu
              key="menu"
              save={save}
              settings={settings}
              onSettings={applySettings}
              onPlay={startRunner}
              onPlaySnake={startSnake}
            />
          )}
        </AnimatePresence>

        {screen === "runner" && (
          <GameScreen
            key={`r-${runKey}`}
            sound={sound}
            settings={settings}
            onSettings={applySettings}
            onGameOver={handleRunnerGameOver}
            onQuit={quitToMenu}
          />
        )}

        {screen === "snake" && (
          <SnakeScreen
            key={`s-${runKey}`}
            sound={sound}
            settings={settings}
            snakeBest={save?.snakeBest ?? 0}
            onSettings={applySettings}
            onGameOver={handleSnakeGameOver}
            onQuit={quitToMenu}
          />
        )}

        <AnimatePresence>
          {result && screen !== "menu" && (
            <GameOver
              data={result}
              onRetry={retryCurrent}
              onMenu={quitToMenu}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Marcos decorativos laterales para pantallas anchas */
function SideDeco({ side }: { side: "left" | "right" }) {
  return (
    <div
      className={`relative hidden flex-1 items-center justify-center overflow-hidden md:flex ${
        side === "left" ? "border-r" : "border-l"
      } border-[#faf4e4]/8`}
    >
      <div className="absolute inset-0 opacity-[0.06] washi-grain" />
      <div className="vertical-jp select-none text-[#faf4e4]/25">
        <span className="text-xl font-black">
          {side === "left" ? "ラトン・チーズ・ラン" : "罠を避けて、チーズを食べろ"}
        </span>
      </div>
      <div
        className={`absolute ${
          side === "left" ? "-left-10 top-10" : "-right-10 bottom-10"
        } h-28 w-28 rounded-full bg-[#e4572e]/20`}
      />
      {side === "right" && (
        <img
          src="./icon.png"
          alt=""
          className="absolute bottom-8 left-8 h-14 w-14 rotate-6 rounded-2xl opacity-70"
        />
      )}
      {side === "left" && (
        <div className="absolute bottom-8 right-8 text-right text-[11px] font-bold leading-relaxed text-[#faf4e4]/35">
          desliza · come · sobrevive
          <br />v 1.2 — carrera y fila
        </div>
      )}
    </div>
  );
}
