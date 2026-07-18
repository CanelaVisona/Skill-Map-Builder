import { BODY_LINK_OPTIONS, type BodyDimension, type BodyZone } from "@/lib/body-progress-context";

export interface BodyLink {
  zone: BodyZone;
  dimension: BodyDimension;
}

interface BodyLinkPickerProps {
  value: BodyLink[];
  onChange: (links: BodyLink[]) => void;
  disabled?: boolean;
}

export function BodyLinkPicker({ value, onChange, disabled }: BodyLinkPickerProps) {
  const isSelected = (zone: BodyZone, dimension: BodyDimension) =>
    value.some((link) => link.zone === zone && link.dimension === dimension);

  const toggle = (zone: BodyZone, dimension: BodyDimension) => {
    onChange(
      isSelected(zone, dimension)
        ? value.filter((link) => !(link.zone === zone && link.dimension === dimension))
        : [...value, { zone, dimension }]
    );
  };

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {BODY_LINK_OPTIONS.map((option) => {
        const selected = isSelected(option.zone, option.dimension);
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => toggle(option.zone, option.dimension)}
            className={`text-left px-2 py-1.5 rounded border text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              selected
                ? "border-purple-500 bg-purple-500/10 text-foreground"
                : "border-border/50 bg-background text-muted-foreground hover:border-border"
            }`}
            data-testid={`button-body-link-${option.value.replace(":", "-")}`}
          >
            {selected ? "✓ " : ""}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
