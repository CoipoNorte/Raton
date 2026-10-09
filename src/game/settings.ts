/**
 * RATÓN — settings.ts
 * Ajustes del jugador: volumen, silencio y modo de control táctil.
 * Persistidos en localStorage (los mismos para el menú y la pausa).
 */

export type ControlMode = "swipe" | "zones" | "buttons";

export interface GameSettings {
  /** Volumen maestro 0..1 */
  volume: number;
  muted: boolean;
  /**
   * swipe   → táctil: arrastra el dedo en cualquier dirección
   * zones   → botones invisibles: toca la mitad izquierda/derecha
   * buttons → igual que zonas, pero con botones < > visibles en pantalla
   */
  control: ControlMode;
}

const KEY = "raton-settings";

export const DEFAULT_SETTINGS: GameSettings = {
  volume: 0.8,
  muted: false,
  control: "swipe",
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<GameSettings>;
      const control: ControlMode =
        p.control === "zones" || p.control === "buttons" ? p.control : "swipe";
      return {
        volume: clamp01(typeof p.volume === "number" ? p.volume : 0.8),
        muted: Boolean(p.muted),
        control,
      };
    }
  } catch {
    /* noop */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: GameSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}
