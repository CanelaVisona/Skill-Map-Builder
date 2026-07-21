interface SkillLinkOption {
  id: string;
  name: string;
}

interface SkillLinkPickerProps {
  skills: SkillLinkOption[];
  value: string[];
  onChange: (skillIds: string[]) => void;
  disabled?: boolean;
  emptyLabel?: string;
}

export function SkillLinkPicker({ skills, value, onChange, disabled, emptyLabel = "No hay skills disponibles" }: SkillLinkPickerProps) {
  const isSelected = (id: string) => value.includes(id);

  const toggle = (id: string) => {
    onChange(isSelected(id) ? value.filter((skillId) => skillId !== id) : [...value, id]);
  };

  if (skills.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {skills.map((skill) => {
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
}
