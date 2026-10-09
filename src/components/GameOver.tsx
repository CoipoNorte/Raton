import { motion } from "framer-motion";
import { RotateCcw, Home, Footprints, Zap, Crown } from "lucide-react";
import CheeseIcon from "./CheeseIcon";

export interface OverData {
  distance: number;
  cheese: number;
  auraMax: number;
  best: number;
  isRecord: boolean;
}

interface Props {
  data: OverData;
  onRetry: () => void;
  onMenu: () => void;
}

export default function GameOver({ data, onRetry, onMenu }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex items-center justify-center bg-[#211d19]/70 p-5 backdrop-blur-[3px]"
    >
      <motion.div
        initial={{ y: 40, scale: 0.92, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.08 }}
        className="washi-grain relative max-h-[94dvh] w-full max-w-[330px] overflow-y-auto rounded-3xl border-2 border-[#2e2a26]/10 bg-[#faf4e4] px-6 pb-6 pt-7 shadow-[0_8px_0_rgba(0,0,0,0.25)]"
      >
        {/* sello hanko de nuevo récord */}
        {data.isRecord && (
          <motion.div
            initial={{ scale: 2.6, opacity: 0, rotate: 8 }}
            animate={{ scale: 1, opacity: 1, rotate: -14 }}
            transition={{ type: "spring", stiffness: 320, damping: 15, delay: 0.55 }}
            className="hanko absolute -right-3 -top-7 z-10 flex h-24 w-24 flex-col items-center justify-center rounded-full bg-[#c23e1c] text-[#fff4e3] shadow-lg"
          >
            <span className="font-brush text-2xl leading-none">新</span>
            <span className="font-brush text-2xl leading-none">記録</span>
            <span className="mt-1 text-[8px] font-black tracking-[0.3em]">RECORD</span>
          </motion.div>
        )}

        <div className="text-center">
          <div className="font-brush text-4xl text-[#c23e1c]">捕まった!</div>
          <div className="mt-1 text-[11px] font-black tracking-[0.45em] text-[#2e2a26]/45">
            ATRAPADO
          </div>
        </div>

        {/* distancia principal */}
        <div className="mt-4 text-center">
          <div className="tabular text-6xl font-black leading-none tracking-tight text-[#2e2a26]">
            {data.distance}
            <span className="ml-1 text-xl font-bold text-[#2e2a26]/45">m</span>
          </div>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-bold text-[#2e2a26]/55">
            <Crown className="h-3.5 w-3.5 text-[#c77d12]" />
            mejor: <span className="tabular">{data.best}m</span>
          </div>
        </div>

        {/* stats */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat
            icon={<Footprints className="h-4 w-4" />}
            value={`${data.distance}m`}
            label="distancia"
          />
          <Stat
            icon={<CheeseIcon className="h-4 w-4" />}
            value={`${data.cheese}`}
            label="quesos"
          />
          <Stat
            icon={<Zap className="h-4 w-4" />}
            value={`${data.auraMax}`}
            label="aura máx"
          />
        </div>

        {/* acciones */}
        <div className="mt-6 flex flex-col gap-2.5">
          <motion.button
            whileTap={{ scale: 0.95, y: 2 }}
            onClick={onRetry}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#e4572e] py-3.5 text-lg font-black text-[#fffdf4] shadow-[0_5px_0_#a63a1a]"
          >
            <RotateCcw className="h-5 w-5" />
            Otra vez
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onMenu}
            className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#2e2a26]/15 bg-[#fffdf4] py-3 font-black text-[#2e2a26]"
          >
            <Home className="h-5 w-5" />
            Menú
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl border border-[#2e2a26]/10 bg-[#fffdf4]/80 py-2.5">
      <span className="text-[#e4572e]">{icon}</span>
      <span className="tabular text-sm font-black text-[#2e2a26]">{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-wider text-[#2e2a26]/45">
        {label}
      </span>
    </div>
  );
}
