/**
 * RATÓN — tilt.ts
 * Estado real del giroscopio: no basta con que exista el permiso, hay que
 * comprobar que el dispositivo tiene sensor y que realmente envía datos.
 *
 * Estados:
 *  - "granted"     → hay sensor y podemos leerlo
 *  - "denied"      → el usuario denegó el permiso (Safari iOS)
 *  - "unsupported" → no hay sensor (escritorio) o no hay API
 */

export type TiltState = "granted" | "denied" | "unsupported";

/** ¿Este navegador pide permiso con un toque? (Safari iOS 13+) */
export function tiltNeedsPermission(): boolean {
  try {
    const DOE = window.DeviceOrientationEvent as unknown as
      | { requestPermission?: unknown }
      | undefined;
    return !!DOE && typeof DOE.requestPermission === "function";
  } catch {
    return false;
  }
}

function hasSensorData(e: DeviceOrientationEvent): boolean {
  // Algunos navegadores disparan el evento con todo null: eso no es un sensor.
  return (
    e.gamma !== null ||
    e.beta !== null ||
    e.alpha !== null
  );
}

/**
 * Pregunta por el estado del giroscopio. Si hace falta permiso, lo pide
 * (DEBE llamarse dentro de un toque/click, si no Safari lo rechaza).
 */
export function probeTilt(): Promise<TiltState> {
  return new Promise<TiltState>((resolve) => {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      resolve("unsupported");
      return;
    }
    const DOE = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };

    // Safari iOS: pedir permiso (requiere gesto)
    if (typeof DOE.requestPermission === "function") {
      DOE.requestPermission()
        .then((res) => {
          if (res !== "granted") {
            resolve("denied");
            return;
          }
          // permiso concedido → confirmar que de verdad llegan datos
          waitForRealEvent(1200, resolve, "granted");
        })
        .catch(() => resolve("denied"));
      return;
    }

    // Chrome / Android: sin permiso, pero puede no haber sensor (escritorio)
    waitForRealEvent(700, resolve, "granted");
  });
}

/** Escucha un evento con datos reales; si no llega nada, no hay sensor. */
function waitForRealEvent(
  ms: number,
  resolve: (s: TiltState) => void,
  okState: TiltState
) {
  let settled = false;
  const finish = (s: TiltState) => {
    if (settled) return;
    settled = true;
    window.removeEventListener("deviceorientation", handler);
    resolve(s);
  };
  const handler = (e: Event) => {
    if (hasSensorData(e as DeviceOrientationEvent)) finish(okState);
  };
  window.addEventListener("deviceorientation", handler);
  window.setTimeout(() => finish("unsupported"), ms);
}

/** Versión sin interacción: no pide permiso, solo mira si ya se puede leer. */
export function peekTilt(): Promise<TiltState> {
  return new Promise<TiltState>((resolve) => {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      resolve("unsupported");
      return;
    }
    const DOE = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    // Si hace falta permiso, no lo pedimos aquí: no sería un gesto válido.
    if (typeof DOE.requestPermission === "function") {
      // en Safari podemos averiguarlo sin preguntar probando a leer
      waitForRealEvent(600, resolve, "granted");
      return;
    }
    waitForRealEvent(600, resolve, "granted");
  });
}
