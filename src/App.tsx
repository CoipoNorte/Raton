import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import Menu from "./components/Menu";
import GameScreen from "./components/GameScreen";
import GameOver, { type OverData } from "./components/GameOver";
import { SoundEngine } from "./game/audio";
import { loadSave, applyRun, type SaveData } from "./game/db";
import { loadSettings, saveSettings, type GameSettings } from "./game/settings";
import type { RunResult } from "./game/engine";

type Screen = "menu" | "game";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [runKey, setRunKey] = useState(0);
  const [save, setSave] = useState<SaveData | null>(null);
  const [result, setResult] = useState<OverData | null>(null);

  const sound = useMemo(() => new SoundEngine(), []);

  // ------- ajustes (sonido + controles) -------
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const applySettings = useCallback(
    (patch: Partial<GameSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        saveSettings(next);
        return next;
      });
    },
    []
  );
  // sincroniza el motor de audio con los ajustes
  useEffect(() => {
    sound.setVolume(settings.volume);
    sound.setMuted(settings.muted);
  }, [sound, settings.volume, settings.muted]);

  const saveRef = useRef<SaveData | null>(null);

  useEffect(() => {
    loadSave().then((s) => {
      saveRef.current = s;
      setSave(s);
    });
  }, []);

  const startGame = useCallback(() => {
    sound.unlock();
    setResult(null);
    setRunKey((k) => k + 1);
    setScreen("game");
  }, [sound]);

  const quitToMenu = useCallback(() => {
    setResult(null);
    setScreen("menu");
  }, []);

  const handleGameOver = useCallback(
    (r: RunResult) => {
      const base = saveRef.current ?? {
        best: 0,
        runs: 0,
        cheeseTotal: 0,
        auraBest: 0,
      };
      const { next, isRecord } = applyRun(base, r);
      saveRef.current = next;
      setSave(next);
      setResult({ ...r, distance: Math.floor(r.distance), best: next.best, isRecord });
      if (isRecord && r.distance > 50) {
        window.setTimeout(() => sound.record(), 550);
      }
    },
    [sound]
  );

  // atajos de teclado: Enter/Espacio = jugar/reintentar · Esc = menú
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        if (screen === "menu" || result) {
          e.preventDefault();
          startGame();
        }
      }
      if (e.key === "Escape" && screen === "game") quitToMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, result, startGame, quitToMenu]);

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
              onPlay={startGame}
            />
          )}
        </AnimatePresence>

        {screen === "game" && (
          <GameScreen
            key={runKey}
            sound={sound}
            settings={settings}
            onSettings={applySettings}
            onGameOver={handleGameOver}
            onQuit={quitToMenu}
          />
        )}

        <AnimatePresence>
          {result && screen === "game" && (
            <GameOver data={result} onRetry={startGame} onMenu={quitToMenu} />
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
          <br />v 1.1 — hecho con washi y tinta
        </div>
      )}
    </div>
  );
}
