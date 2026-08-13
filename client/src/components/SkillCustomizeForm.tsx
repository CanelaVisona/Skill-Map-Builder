import { cn } from "@/lib/utils";
import { SkillDiamond } from "./SkillDiamond";
import { SkillIconPicker } from "./SkillIconPicker";
import { SHAPE_KEYS, SHAPE_LABELS, getShapeGeometry, type ShapeKey, type ShapeGeometry } from "@/lib/skill-shapes";
import { MATERIAL_KEYS, MATERIAL_LABELS, AVAILABLE_ACCENT_COLORS, getMaterialTokens, type MaterialKey } from "@/lib/skill-materials";
import { RARITY_KEYS, RARITY_LABELS, getRarityTokens, type RarityKey } from "@/lib/skill-rarity";

export type GlowMode = "auto" | "on" | "off";
export type NodeSizeKey = "small" | "normal" | "large";

export interface SkillCustomizationValue {
  icon: string | null;
  shape: ShapeKey;
  material: MaterialKey;
  rarity: RarityKey;
  accentColor: string | null;
  glowMode: GlowMode;
  nodeSize: NodeSizeKey;
}

export const DEFAULT_SKILL_CUSTOMIZATION: SkillCustomizationValue = {
  icon: null,
  shape: "diamond_classic",
  material: "iron",
  rarity: "common",
  accentColor: null,
  glowMode: "auto",
  nodeSize: "normal",
};

interface SkillCustomizeFormProps {
  /** Skill name — used for the icon auto-match preview and the live medallion label. */
  name: string;
  value: SkillCustomizationValue;
  onChange: (patch: Partial<SkillCustomizationValue>) => void;
  areaColor: string;
}

function ShapeMiniPreview({ shape, selected }: { shape: ShapeKey; selected: boolean }) {
  const geom: ShapeGeometry = getShapeGeometry(shape, 22);
  return (
    <svg viewBox="0 0 22 22" width={22} height={22} overflow="visible">
      {geom.kind === "circle" ? (
        <circle cx={geom.cx} cy={geom.cy} r={geom.r} fill="#4a463d" stroke={selected ? "#ffe8a0" : "#8a6a2a"} strokeWidth={1.5} />
      ) : (
        <polygon points={geom.points} fill="#4a463d" stroke={selected ? "#ffe8a0" : "#8a6a2a"} strokeWidth={1.5} />
      )}
    </svg>
  );
}

const SWATCH_BUTTON_BASE = "flex items-center justify-center rounded transition-colors";

export function SkillCustomizeForm({ name, value, onChange, areaColor }: SkillCustomizeFormProps) {
  const previewGlow: 0 | 1 | null = value.glowMode === "auto" ? null : value.glowMode === "on" ? 1 : 0;

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Controls */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div>
          <label className="text-xs block mb-1.5" style={{ color: "#c8a96e" }}>Ícono</label>
          <SkillIconPicker value={value.icon} onChange={(icon) => onChange({ icon })} fallbackLabel={name} />
        </div>

        <div>
          <label className="text-xs block mb-1.5" style={{ color: "#c8a96e" }}>Forma</label>
          <div className="flex gap-2">
            {SHAPE_KEYS.map((shape) => (
              <button
                key={shape}
                type="button"
                title={SHAPE_LABELS[shape]}
                onClick={() => onChange({ shape })}
                className={cn(SWATCH_BUTTON_BASE, "w-9 h-9")}
                style={{
                  backgroundColor: "#130f09",
                  border: value.shape === shape ? "2px solid #ffe8a0" : "1px solid #3a2a14",
                }}
              >
                <ShapeMiniPreview shape={shape} selected={value.shape === shape} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs block mb-1.5" style={{ color: "#c8a96e" }}>Material</label>
          <div className="flex gap-2 flex-wrap">
            {MATERIAL_KEYS.map((material) => {
              const tokens = getMaterialTokens(material, material === "custom" ? (value.accentColor ?? undefined) : undefined);
              return (
                <button
                  key={material}
                  type="button"
                  title={MATERIAL_LABELS[material]}
                  onClick={() => onChange({ material, accentColor: material === "custom" ? (value.accentColor ?? areaColor) : value.accentColor })}
                  className={cn(SWATCH_BUTTON_BASE, "w-7 h-7")}
                  style={{
                    background: `linear-gradient(135deg, ${tokens.plateGradient[0]}, ${tokens.plateGradient[2]})`,
                    border: value.material === material ? "2px solid #ffe8a0" : "1px solid #3a2a14",
                  }}
                />
              );
            })}
          </div>
          {value.material === "custom" && (
            <div className="flex gap-2 flex-wrap mt-2">
              {AVAILABLE_ACCENT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onChange({ accentColor: color })}
                  className="w-6 h-6 rounded transition-all"
                  style={{
                    backgroundColor: color,
                    border: value.accentColor === color ? "2px solid #c8a96e" : "1px solid #3a2a14",
                    opacity: value.accentColor === color ? 1 : 0.6,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs block mb-1.5" style={{ color: "#c8a96e" }}>Rareza</label>
          <div className="flex gap-1.5 flex-wrap">
            {RARITY_KEYS.map((rarity) => {
              const tokens = getRarityTokens(rarity);
              const dotColor = tokens.ringColor ?? "#6b6559";
              const active = value.rarity === rarity;
              return (
                <button
                  key={rarity}
                  type="button"
                  onClick={() => onChange({ rarity })}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors"
                  style={{
                    backgroundColor: active ? "#130f09" : "transparent",
                    border: active ? `1px solid ${dotColor}` : "1px solid #3a2a14",
                    color: active ? "#ffe8a0" : "#8a6a2a",
                  }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                  {RARITY_LABELS[rarity]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="text-xs block mb-1.5" style={{ color: "#c8a96e" }}>Tamaño</label>
            <div className="flex gap-1">
              {(["small", "normal", "large"] as NodeSizeKey[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => onChange({ nodeSize: size })}
                  className="px-2.5 py-1.5 rounded text-[11px] transition-colors"
                  style={{
                    backgroundColor: value.nodeSize === size ? "#c85a2a" : "#130f09",
                    border: value.nodeSize === size ? "2px solid #c8a96e" : "1px solid #3a2a14",
                    color: value.nodeSize === size ? "#0e0c0a" : "#c8a96e",
                  }}
                >
                  {size === "small" ? "Chico" : size === "normal" ? "Normal" : "Grande"}
                </button>
              ))}
            </div>
          </div>

          <div>
            {/* glow is tri-state (null = auto per rarity) so a plain checkbox can't represent it */}
            <label className="text-xs block mb-1.5" style={{ color: "#c8a96e" }}>Brillo</label>
            <div className="flex gap-1">
              {([
                { key: "auto", label: "Auto" },
                { key: "on", label: "Sí" },
                { key: "off", label: "No" },
              ] as { key: GlowMode; label: string }[]).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onChange({ glowMode: opt.key })}
                  className="px-2.5 py-1.5 rounded text-[11px] transition-colors"
                  style={{
                    backgroundColor: value.glowMode === opt.key ? "#c85a2a" : "#130f09",
                    border: value.glowMode === opt.key ? "2px solid #c8a96e" : "1px solid #3a2a14",
                    color: value.glowMode === opt.key ? "#0e0c0a" : "#c8a96e",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="flex flex-col items-center justify-center gap-1 sm:w-28 shrink-0">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: "#5a4a2a" }}>Vista previa</span>
        <SkillDiamond
          skill={{
            id: "preview",
            title: name || "Nuevo skill",
            level: 3,
            status: "available",
            currentXp: 150,
            goalXp: 0,
            icon: value.icon,
            shape: value.shape,
            material: value.material,
            rarity: value.rarity,
            accentColor: value.accentColor,
            glow: previewGlow,
            nodeSize: value.nodeSize,
          }}
          areaColor={areaColor}
          size={64}
          hideMeta
        />
      </div>
    </div>
  );
}
