/**
 * RATÓN — gyro.ts
 * Permiso del giroscopio compartido entre el menú y el juego.
 *
 * La regla de oro de Safari (iOS 13+): `DeviceOrientationEvent.requestPermission()`
 * SOLO muestra el diálogo si se llama sincronizado dentro de un gesto del
 * usuario (un clic). Si se llama desde un efecto/montaje, la promesa RECHAZA
 * (no es un "no" del usuario: es "no hubo gesto"). Por eso distinguimos:
 *   - "granted"       → permiso OK (o el navegador no lo exige, p. ej. Android)
 *   - "denied"        → el usuario dijo que no (la promesa RESUELVE "denied")
 *   - "needs-gesture" → faltó el gesto: hay que pedirlo desde un botón
 *   - "unsupported"   → el navegador no expone DeviceOrientationEvent
 */

export type GyroSupport = "ready" | "needs-permission" | "unsupported";

/** Estado listo para pintar en la UI */
export type TiltUIState = "on" | "needs" | "denied" | "unsupported" | "off";

type DOEWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

function getDOE(): DOEWithPermission | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { DeviceOrientationEvent?: DOEWithPermission })
    .DeviceOrientationEvent;
}

/** ¿El navegador soporta orientación y exige permiso explícito? */
export function gyroSupport(): GyroSupport {
  const DOE = getDOE();
  if (!DOE || typeof window.addEventListener !== "function") return "unsupported";
  return typeof DOE.requestPermission === "function"
    ? "needs-permission"
    : "ready";
}

/** true si ya concedimos el permiso en esta sesión */
let grantedThisSession = false;
export function gyroGranted(): boolean {
  return grantedThisSession;
}

/**
 * Pide el permiso. DEBE llamarse desde un gesto (clic/toque) para que
 * Safari muestre el diálogo nativo.
 */
export async function requestGyroPermission(): Promise<
  "granted" | "denied" | "needs-gesture" | "unsupported"
> {
  const DOE = getDOE();
  if (!DOE || typeof window.addEventListener !== "function") return "unsupported";
  // Android/Chrome: no hay compuerta de permiso, los eventos simplemente fluyen
  if (typeof DOE.requestPermission !== "function") {
    grantedThisSession = true;
    return "granted";
  }
  if (grantedThisSession) return "granted";
  try {
    const res = await DOE.requestPermission();
    if (res === "granted") {
      grantedThisSession = true;
      return "granted";
    }
    return "denied";
  } catch {
    // Rechazó = no hubo gesto válido. NO marcamos denegado.
    return "needs-gesture";
  }
}

/** Estado inicial para la UI según el soporte del navegador */
export function tiltStateFromSupport(s: GyroSupport): TiltUIState {
  if (s === "unsupported") return "unsupported";
  if (s === "needs-permission") return "needs";
  return "on"; // "ready": sin compuerta, se activa al entrar al juego
}
