import { useState } from "react";
import {
  BODY_BLOCKS,
  BODY_ZONES,
  BODY_ZONE_LABELS,
  useBodyProgress,
  type BodyDimension,
  type BodyZone,
} from "@/lib/body-progress-context";

const MODE_COLORS: Record<BodyDimension, string> = {
  fuerza: "#37D17A",
  flex: "#3B9BFF",
};

const MODE_LABELS: Record<BodyDimension, string> = {
  fuerza: "Fuerza",
  flex: "Flexibilidad",
};

const BODY_FILL = "#1D2A40";
const BODY_STROKE = "#3A5074";

const ZONE_SLOT_CLASS: Record<BodyZone, string> = {
  brazos: "bsp-slot-brazos",
  abdomen: "bsp-slot-abdomen",
  piernas: "bsp-slot-piernas",
  mente: "bsp-slot-mente",
};

function tintStyle(accent: string, progress: number) {
  const fillMix = Math.round(8 + progress * 80);
  const strokeMix = Math.round(15 + progress * 85);
  return {
    fill: `color-mix(in srgb, ${accent} ${fillMix}%, ${BODY_FILL})`,
    stroke: `color-mix(in srgb, ${accent} ${strokeMix}%, ${BODY_STROKE})`,
  };
}

export function BodyStrengthPanel() {
  const { getZoneProgress } = useBodyProgress();
  const [mode, setMode] = useState<BodyDimension>("fuerza");
  const accent = MODE_COLORS[mode];
  const staticStyle = { fill: BODY_FILL, stroke: BODY_STROKE };

  const effectiveProgress = (zone: BodyZone) => {
    const { lvl, val } = getZoneProgress(zone, mode);
    return 1 - Math.pow(0.9, lvl - 1 + val / BODY_BLOCKS);
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto custom-scrollbar">
      <style>{`
        @keyframes bsp-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes bsp-nerve { to { stroke-dashoffset: -56; } }
        .bsp-chip { animation: bsp-float 7s ease-in-out infinite; }
        .bsp-chip:nth-child(2) { animation-delay: -2.4s; }
        .bsp-chip:nth-child(3) { animation-delay: -4.8s; }
        .bsp-chip:nth-child(4) { animation-delay: -1.2s; }
        .bsp-blk[data-full="true"] { box-shadow: 0 0 6px -1px var(--bsp-accent); }
        .bsp-nerves { animation: bsp-nerve 6s linear infinite; }
        .bsp-slot-brazos { top: 20%; left: 1%; }
        .bsp-slot-abdomen { top: 43%; right: 1%; }
        .bsp-slot-piernas { top: 66%; left: 1%; }
        .bsp-slot-mente { bottom: 2%; left: 50%; transform: translateX(-50%); width: clamp(140px,22vw,180px); }
        @media (max-width: 480px) {
          .bsp-slot-brazos, .bsp-slot-piernas { left: 0; }
          .bsp-slot-abdomen { right: 0; }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Cuerpo</h3>
          <p className="text-xs text-muted-foreground">
            Las barras suben desde la tab de fuerza del pop-up de un nodo del skill tree.
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-border bg-muted/40 p-1">
          {(Object.keys(MODE_LABELS) as BodyDimension[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all"
              style={{
                backgroundColor: mode === m ? MODE_COLORS[m] : "transparent",
                color: mode === m ? "#08121C" : "var(--muted-foreground)",
              }}
              data-testid={`button-body-mode-${m}`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-muted/20">
        <span
          className="shrink-0 pt-3 text-center text-[9px] uppercase tracking-[0.26em]"
          style={{ color: accent, opacity: 0.85 }}
        >
          Modo {MODE_LABELS[mode].toLowerCase()}
        </span>

        <div className="relative min-h-0 flex-1">
          <svg
            viewBox="0 0 240 520"
            className="absolute left-1/2 top-0 h-full w-auto -translate-x-1/2"
            aria-label="Figura humana con progreso corporal"
          >
            <g style={staticStyle} strokeWidth={1.4}>
              <path d="M78,106 C90,96 150,96 162,106 C160,130 156,148 150,164 L90,164 C84,148 80,130 78,106 Z" />
            </g>

            <g
              className="bsp-nerves"
              fill="none"
              stroke={accent}
              strokeWidth={1.1}
              strokeLinecap="round"
              strokeDasharray="5 9"
              style={{ opacity: 0.14 + effectiveProgress("mente") * 0.86 }}
            >
              <path d="M120,74 C122,120 118,170 120,232" />
              <path d="M120,108 C104,106 88,116 78,140 C70,166 64,200 57,248" />
              <path d="M120,108 C136,106 152,116 162,140 C170,166 176,200 183,248" />
              <path d="M120,140 C110,146 102,152 96,162" />
              <path d="M120,140 C130,146 138,152 144,162" />
              <path d="M120,232 C112,244 106,254 102,266 C96,318 102,378 104,440 C104,466 103,482 102,492" />
              <path d="M120,232 C128,244 134,254 138,266 C144,318 138,378 136,440 C136,466 137,482 138,492" />
            </g>

            <g style={tintStyle(accent, effectiveProgress("mente"))} strokeWidth={1.4}>
              <ellipse cx="120" cy="52" rx="25" ry="31" />
              <path d="M110,80 h20 v18 h-20 z" />
            </g>

            <g style={tintStyle(accent, effectiveProgress("brazos"))} strokeWidth={1.4}>
              <path d="M80,104 C64,116 58,150 52,196 C48,228 46,246 45,256 C50,262 60,262 64,256 C66,232 70,206 74,180 C78,150 82,126 86,110 Z" />
              <path d="M160,104 C176,116 182,150 188,196 C192,228 194,246 195,256 C190,262 180,262 176,256 C174,232 170,206 166,180 C162,150 158,126 154,110 Z" />
              <ellipse cx="54" cy="268" rx="10" ry="13" />
              <ellipse cx="186" cy="268" rx="10" ry="13" />
            </g>

            <g style={tintStyle(accent, effectiveProgress("abdomen"))} strokeWidth={1.4}>
              <path d="M90,164 L150,164 C147,190 145,208 144,226 L96,226 C95,208 93,190 90,164 Z" />
              <path d="M96,226 L144,226 C147,240 149,250 150,258 C130,270 110,270 90,258 C91,250 93,240 96,226 Z" />
            </g>

            <g style={tintStyle(accent, effectiveProgress("piernas"))} strokeWidth={1.4}>
              <path d="M94,258 C92,300 96,340 100,376 C102,410 102,440 101,466 C100,478 100,486 100,492 C107,496 116,496 121,492 C121,460 122,420 122,380 C122,340 120,300 118,260 C110,266 102,266 94,258 Z" />
              <path d="M146,258 C148,300 144,340 140,376 C138,410 138,440 139,466 C140,478 140,486 140,492 C133,496 124,496 119,492 C119,460 118,420 118,380 C118,340 120,300 122,260 C130,266 138,266 146,258 Z" />
              <path d="M97,494 C97,506 92,508 92,512 L122,512 C122,504 121,498 121,494 Z" />
              <path d="M143,494 C143,506 148,508 148,512 L118,512 C118,504 119,498 119,494 Z" />
            </g>
          </svg>

          {BODY_ZONES.map((zone) => {
            const p = getZoneProgress(zone, mode);
            return (
              <div
                key={zone}
                className={`bsp-chip absolute w-[clamp(120px,15vw,152px)] rounded-[11px] border px-[10px] py-[9px] shadow-[0_8px_26px_-14px_#000] ${ZONE_SLOT_CLASS[zone]}`}
                style={{
                  background: "linear-gradient(180deg, rgba(24,36,58,.95), rgba(15,24,40,.95))",
                  borderColor: "#26374f",
                  ["--bsp-accent" as string]: accent,
                }}
                data-testid={`chip-body-${zone}-${mode}`}
              >
                <div className="text-[8px] uppercase tracking-[0.18em]" style={{ color: "#8296B4" }}>
                  {BODY_ZONE_LABELS[zone]}
                </div>
                <div className="flex items-baseline justify-between gap-1.5">
                  <span className="text-[12px] font-semibold" style={{ color: accent }}>
                    {MODE_LABELS[mode]}
                  </span>
                  <span className="text-[8.5px]" style={{ color: accent }}>
                    N{p.lvl}
                  </span>
                </div>
                <div className="my-[6px] flex gap-[2px]">
                  {Array.from({ length: BODY_BLOCKS }).map((_, i) => (
                    <span
                      key={i}
                      data-full={i < p.val}
                      className="bsp-blk h-[9px] flex-1 rounded-[2px] border"
                      style={{
                        borderColor: "#26374f",
                        background: i < p.val ? accent : "#1B2740",
                      }}
                    />
                  ))}
                </div>
                <div className="text-[8px] uppercase tracking-[0.18em]" style={{ color: "#8296B4" }}>
                  {p.val}/{BODY_BLOCKS}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
