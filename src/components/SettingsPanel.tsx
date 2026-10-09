import {
  MoveHorizontal,
  Hand,
  ChevronsLeftRight,
  Smartphone,
  Volume2,
  VolumeX,
  Music,
  Vibrate,
} from "lucide-react";
import type { ControlMode, GameSettings } from "../game/settings";

interface Props {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
}

const OPTIONS: { id: ControlMode; name: string; desc: string; Icon: typeof MoveHorizontal }[] = [
  { id: "swipe", name: "Deslizar", desc: "arrastra el dedo", Icon: MoveHorizontal },
  { id: "zones", name: "Zonas", desc: "toca izq / der", Icon: Hand },
  { id: "buttons", name: "Botones", desc: "botones < >", Icon: ChevronsLeftRight },
  { id: "tilt", name: "Giroscopio", desc: "inclina el cel", Icon: Smartphone },
];

/** Panel de opciones compartido por menú y pausa: sonido, música, controles y vibración */
export default function SettingsPanel({ settings, onChange }: Props) {
  return (
    <div className="w-full max-w-[340px] rounded-2xl border-2 border-[#2e2a26]/10 bg-[#faf4e4] p-4 shadow-[0_6px_0_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black tracking-wide text-[#2e2a26]">
          設定 · Opciones
        </h3>
        <span className="text-[10px] font-bold text-[#2e2a26]/40">se guardan solas</span>
      </div>

      {/* ---------- EFECTOS ---------- */}
      <div className="mt-4">
        <SectionLabel>Efectos</SectionLabel>
        <div className="mt-2 flex items-center gap-2.5">
          <SBtn
            onClick={() => onChange({ muted: !settings.muted })}
            label={settings.muted ? "Activar sonido" : "Silenciar todo"}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
              settings.muted
                ? "border-[#c23e1c]/30 bg-[#c23e1c]/10 text-[#c23e1c]"
                : "border-[#2e2a26]/10 bg-[#fffdf4] text-[#2e2a26]"
            }`}
          >
            {settings.muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </SBtn>
          <Slider
            value={settings.volume}
            disabled={settings.muted}
            label="Volumen de efectos"
            onChange={(v) => onChange({ volume: v, muted: false })}
          />
          <Readout value={settings.volume} muted={settings.muted} />
        </div>
      </div>

      {/* ---------- MÚSICA ---------- */}
      <div className="mt-3.5">
        <SectionLabel>
          <span className="flex items-center gap-1.5">
            <Music className="h-3.5 w-3.5 text-[#c77d12]" />
            Música de fondo
          </span>
        </SectionLabel>
        <div className="mt-2 flex items-center gap-2.5">
          <SBtn
            onClick={() => onChange({ music: !settings.music })}
            label={settings.music ? "Parar música" : "Iniciar música"}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
              settings.music
                ? "border-[#f2b13d]/50 bg-[#f2b13d]/15 text-[#c77d12]"
                : "border-[#2e2a26]/10 bg-[#fffdf4] text-[#2e2a26]/40"
            }`}
          >
            <Music className="h-5 w-5" />
          </SBtn>
          <Slider
            value={settings.musicVol}
            disabled={!settings.music}
            label="Volumen de música"
            onChange={(v) => onChange({ musicVol: v, music: true })}
          />
          <Readout value={settings.musicVol} muted={!settings.music} />
        </div>
        <p className="mt-1.5 text-[10px] font-bold leading-snug text-[#2e2a26]/45">
          Koto y taiko generados en vivo: suben de tempo cuando el ratón corre más.
        </p>
      </div>

      {/* ---------- CONTROLES ---------- */}
      <div className="mt-3.5">
        <SectionLabel>Controles táctiles</SectionLabel>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {OPTIONS.map(({ id, name, desc, Icon }) => {
            const active = settings.control === id;
            return (
              <SBtn
                key={id}
                onClick={() => onChange({ control: id })}
                label={`Control: ${name}`}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 px-0.5 py-2 ${
                  active
                    ? "border-[#e4572e] bg-[#e4572e]/10 text-[#c23e1c]"
                    : "border-[#2e2a26]/10 bg-[#fffdf4] text-[#2e2a26]"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={2.4} />
                <span className="text-[10px] font-black leading-none">{name}</span>
                <span
                  className={`text-[8px] font-bold leading-tight ${
                    active ? "text-[#c23e1c]/70" : "text-[#2e2a26]/45"
                  }`}
                >
                  {desc}
                </span>
              </SBtn>
            );
          })}
        </div>
      </div>

      {/* ---------- VIBRAR ---------- */}
      <div className="mt-3.5">
        <SectionLabel>Vibración háptica</SectionLabel>
        <div
          className={`mt-2 flex items-center justify-between rounded-xl border-2 px-3 py-2 ${
            settings.vibrate
              ? "border-[#e4572e]/40 bg-[#e4572e]/5"
              : "border-[#2e2a26]/10 bg-[#fffdf4]"
          }`}
        >
          <span className="flex items-center gap-2 text-xs font-black text-[#2e2a26]">
            <Vibrate className="h-4 w-4 text-[#c77d12]" />
            {settings.vibrate ? "Activa" : "Apagada"}
          </span>
          <SBtn
            onClick={() => onChange({ vibrate: !settings.vibrate })}
            label={settings.vibrate ? "Desactivar vibración" : "Activar vibración"}
            className={`relative h-7 w-12 rounded-full border-2 transition-colors ${
              settings.vibrate
                ? "border-[#e4572e] bg-[#e4572e]"
                : "border-[#2e2a26]/20 bg-[#e3d7b8]"
            }`}
          >
            <span
              className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[#fffdf4] shadow transition-all ${
                settings.vibrate ? "left-[calc(100%-1.6rem)]" : "left-0.5"
              }`}
            />
          </SBtn>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-black uppercase tracking-wider text-[#2e2a26]/55">
      {children}
    </span>
  );
}

function Readout({ value, muted }: { value: number; muted: boolean }) {
  return (
    <span
      className={`tabular w-8 text-right text-xs font-black ${
        muted ? "text-[#2e2a26]/25 line-through" : "text-[#2e2a26]/70"
      }`}
    >
      {Math.round(value * 100)}
    </span>
  );
}

function Slider({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <input
      type="range"
      min={0}
      max={100}
      value={Math.round(value * 100)}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value) / 100)}
      className="vol flex-1 disabled:opacity-40"
    />
  );
}

/** botón del panel con feedback de toque */
function SBtn({
  children,
  onClick,
  label,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`${className} transition-transform active:scale-95 active:brightness-95`}
    >
      {children}
    </button>
  );
}
