import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { SKILL_ICON_REGISTRY, SKILL_ICON_LABELS, SKILL_ICON_KEYS, getAutoIconKey } from "@/lib/skill-icons";

interface SkillIconPickerProps {
  value: string | null;
  onChange: (iconKey: string | null) => void;
  /** Skill name, used to preview/label what "Automático" would resolve to. */
  fallbackLabel: string;
}

export function SkillIconPicker({ value, onChange, fallbackLabel }: SkillIconPickerProps) {
  const [open, setOpen] = useState(false);

  const autoKey = getAutoIconKey(fallbackLabel || "");
  const TriggerIcon = value ? SKILL_ICON_REGISTRY[value] : SKILL_ICON_REGISTRY[autoKey];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-2 rounded text-xs transition-colors w-full"
          style={{ backgroundColor: "#130f09", border: "1px solid #3a2a14", color: "#c8a96e" }}
        >
          {TriggerIcon && <TriggerIcon className="w-4 h-4 shrink-0" />}
          <span className="truncate">
            {value ? SKILL_ICON_LABELS[value] : `Automático (${SKILL_ICON_LABELS[autoKey]})`}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0 overflow-hidden"
        style={{ backgroundColor: "#0e0c0a", border: "1px solid #3a2a14" }}
        align="start"
      >
        <Command style={{ backgroundColor: "transparent" }} className="bg-transparent">
          <CommandInput
            placeholder="Buscar ícono..."
            className="text-xs"
            style={{ color: "#c8a96e" }}
          />
          <CommandList className="max-h-56">
            <CommandEmpty className="text-xs py-4 text-center" style={{ color: "#8a6a2a" }}>
              Sin resultados
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="Automático"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="text-xs gap-2 cursor-pointer"
                style={{ color: value === null ? "#ffe8a0" : "#c8a96e" }}
              >
                <Wand2 className="w-4 h-4" />
                <span>Automático ({SKILL_ICON_LABELS[autoKey]})</span>
              </CommandItem>
              {SKILL_ICON_KEYS.map((key) => {
                const IconComp = SKILL_ICON_REGISTRY[key];
                return (
                  <CommandItem
                    key={key}
                    value={SKILL_ICON_LABELS[key]}
                    onSelect={() => {
                      onChange(key);
                      setOpen(false);
                    }}
                    className="text-xs gap-2 cursor-pointer"
                    style={{ color: value === key ? "#ffe8a0" : "#c8a96e" }}
                  >
                    <IconComp className="w-4 h-4" />
                    <span>{SKILL_ICON_LABELS[key]}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
