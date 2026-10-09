import { MoveHorizontal, Hand, ChevronsLeftRight, Volume2, VolumeX } from "lucide-react";
import type { ControlMode, GameSettings } from "../game/settings";

interface Props {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
}

const OPTIONS: { id: ControlMode; name: string; desc: string; Icon: typeof MoveHorizontal }[] = [
  { id: "swipe", name: "Deslizar", desc: "arrastra el dedo", Icon: MoveHorizontal },
  { id: "zones", name: "Zonas", desc: "toca izq / der", Icon: Hand },
  { id: "buttons", name: "Botones", desc: "botones < >", Icon: ChevronsLeftRight },
];

/** Panel de opciones (sonido + controles) compartido por menú y pausa */
export default function SettingsPanel({ settings, onChange }: Props) {
  return (
    <div className="w-full max-w-[340px] rounded-2xl border-2 border-[#2e2a26]/10 bg-[#faf4e4] p-4 shadow-[0_6px_0_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black tracking-wide text-[#2e2a26]">
          設定 · Opciones
        </h3>
        <span className="text-[10px] font-bold text-[#2e2a26]/40">
          se guardan solo
        </span>
      </div>

      {/* ---------- SONIDO ---------- */}
      <div className="mt-4">
        <span className="text-[11px] font-black uppercase tracking-wider text-[#2e2a26]/55">
          Sonido
        </span>
        <div className="mt-2 flex items-center gap-2.5">
          <SBtn
            onClick={() => onChange({ muted: !settings.muted })}
            label={settings.muted ? "Activar sonido" : "Silenciar"}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
              settings.muted
                ? "border-[#c23e1c]/30 bg-[#c23e1c]/10 text-[#c23e1c]"
                : "border-[#2e2a26]/10 bg-[#fffdf4] text-[#2e2a26]"
            }`}
          >
            {settings.muted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </SBtn>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.volume * 100)}
            onChange={(e) =>
              onChange({ volume: Number(e.target.value) / 100, muted: false })
            }
            aria-label="Volumen"
            className="vol flex-1"
          />
          <span className="tabular w-8 text-right text-xs font-black text-[#2e2a26]/70">
            {Math.round(settings.volume * 100)}
          </span>
        </div>
      </div>

      {/* ---------- CONTROLES ---------- */}
      <div className="mt-4">
        <span className="text-[11px] font-black uppercase tracking-wider text-[#2e2a26]/55">
          Controles táctiles
        </span>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {OPTIONS.map(({ id, name, desc, Icon }) => {
            const active = settings.control === id;
            return (
              <SBtn
                key={id}
                onClick={() => onChange({ control: id })}
                label={`Control: ${name}`}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-2.5 ${
                  active
                    ? "border-[#e4572e] bg-[#e4572e]/10 text-[#c23e1c]"
                    : "border-[#2e2a26]/10 bg-[#fffdf4] text-[#2e2a26]"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={2.4} />
                <span className="text-[11px] font-black leading-none">{name}</span>
                <span
                  className={`text-[9px] font-bold leading-tight ${
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
    </div>
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
