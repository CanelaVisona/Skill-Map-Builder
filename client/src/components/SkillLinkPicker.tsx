import { useState } from "react";

interface SkillLinkOption {
  id: string;
  name: string;
}

interface AreaOption {
  id: string;
  name: string;
}

interface SkillLinkPickerProps {
  skills: SkillLinkOption[];
  value: string[];
  onChange: (skillIds: string[]) => void;
  disabled?: boolean;
  emptyLabel?: string;
  /** All areas the user can browse into via "Otra área" to link skills from other areas. */
  areas?: AreaOption[];
  /** The area already shown in `skills`, excluded from the "Otra área" list to avoid duplicates. */
  currentAreaId?: string | null;
}

interface ExtraAreaSkills {
  id: string;
  name: string;
  skills: SkillLinkOption[];
}

export function SkillLinkPicker({
  skills,
  value,
  onChange,
  disabled,
  emptyLabel = "No hay skills disponibles",
  areas = [],
  currentAreaId,
}: SkillLinkPickerProps) {
  const isSelected = (id: string) => value.includes(id);

  const toggle = (id: string) => {
    onChange(isSelected(id) ? value.filter((skillId) => skillId !== id) : [...value, id]);
  };

  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingAreaId, setLoadingAreaId] = useState<string | null>(null);
  const [extraAreas, setExtraAreas] = useState<ExtraAreaSkills[]>([]);

  const otherAreas = areas.filter(
    (area) => area.id !== currentAreaId && !extraAreas.some((extra) => extra.id === area.id)
  );

  const handlePickArea = async (area: AreaOption) => {
    setLoadingAreaId(area.id);
    try {
      const res = await fetch(`/api/global-skills/area/${area.id}`);
      const areaSkills: SkillLinkOption[] = res.ok ? await res.json() : [];
      setExtraAreas((prev) => [...prev, { id: area.id, name: area.name, skills: areaSkills }]);
      setPickerOpen(false);
    } catch (error) {
      console.error("Error loading skills for area:", error);
    } finally {
      setLoadingAreaId(null);
    }
  };

  const removeExtraArea = (areaId: string) => {
    const removed = extraAreas.find((extra) => extra.id === areaId);
    setExtraAreas((prev) => prev.filter((extra) => extra.id !== areaId));
    if (removed) {
      onChange(value.filter((skillId) => !removed.skills.some((skill) => skill.id === skillId)));
    }
  };

  const renderGrid = (options: SkillLinkOption[]) => (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map((skill) => {
        const selected = isSelected(skill.id);
        return (
          <button
            key={skill.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(skill.id)}
            className={`text-left px-2 py-1.5 rounded border text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed truncate ${
              selected
                ? "border-purple-500 bg-purple-500/10 text-foreground"
                : "border-border/50 bg-background text-muted-foreground hover:border-border"
            }`}
            data-testid={`button-skill-link-${skill.id}`}
            title={skill.name}
          >
            {selected ? "✓ " : ""}
            {skill.name}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {skills.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        renderGrid(skills)
      )}

      {extraAreas.map((extra) => (
        <div key={extra.id} className="border-t border-border/30 pt-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Skills de {extra.name}
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeExtraArea(extra.id)}
              className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
              data-testid={`button-remove-area-${extra.id}`}
            >
              Quitar
            </button>
          </div>
          {extra.skills.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin skills disponibles</p>
          ) : (
            renderGrid(extra.skills)
          )}
        </div>
      ))}

      {areas.length > 0 && (
        <div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setPickerOpen((open) => !open)}
            className="text-left px-2 py-1.5 rounded border border-dashed border-border/50 bg-background text-xs text-muted-foreground hover:border-purple-400 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-skill-link-other-area"
          >
            {pickerOpen ? "✕ Cerrar" : "+ Otra área"}
          </button>

          {pickerOpen && (
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {otherAreas.length === 0 ? (
                <p className="col-span-2 text-xs text-muted-foreground">No hay otras áreas disponibles</p>
              ) : (
                otherAreas.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    disabled={disabled || loadingAreaId === area.id}
                    onClick={() => handlePickArea(area)}
                    className="text-left px-2 py-1.5 rounded border border-border/50 bg-background text-xs text-muted-foreground hover:border-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed truncate"
                    data-testid={`button-skill-link-area-${area.id}`}
                    title={area.name}
                  >
                    {loadingAreaId === area.id ? "Cargando…" : area.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
