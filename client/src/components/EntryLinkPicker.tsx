interface EntryLinkOption {
  id: string;
  name: string;
}

interface EntryLinkPickerProps {
  label: string;
  options: EntryLinkOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  emptyLabel?: string;
}

/**
 * Multi-select de vínculos entre entradas del perfil (experiencia <-> contribución).
 * Grilla de botones toggle, mismo estilo que SkillLinkPicker.
 */
export function EntryLinkPicker({
  label,
  options,
  value,
  onChange,
  disabled,
  emptyLabel = "No hay opciones disponibles",
}: EntryLinkPickerProps) {
  const isSelected = (id: string) => value.includes(id);

  const toggle = (id: string) => {
    onChange(isSelected(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {options.map((option) => {
            const selected = isSelected(option.id);
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                onClick={() => toggle(option.id)}
                title={option.name}
                className={`text-left px-2 py-1.5 rounded border text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed truncate ${
                  selected
                    ? "border-purple-500 bg-purple-500/10 text-foreground"
                    : "border-border/50 bg-background text-muted-foreground hover:border-border"
                }`}
              >
                {selected ? "✓ " : ""}
                {option.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
