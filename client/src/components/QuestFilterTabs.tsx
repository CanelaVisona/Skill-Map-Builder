// Menú de áreas/quests del Journal ("Todos" + una pastilla por área/quest con su cantidad), el
// mismo de Tools/Learnings. También lo usan Errores, Aciertos, Objetivos y Poderes.
export interface QuestTabGroup {
  key: string;
  name: string;
  color?: string;
  count: number;
}

export function QuestFilterTabs({
  groups,
  selectedKey,
  onSelect,
  totalCount,
}: {
  groups: QuestTabGroup[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  totalCount: number;
}) {
  if (groups.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 -mx-1 px-1 minimal-scrollbar">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap border ${
          selectedKey === null
            ? "bg-secondary text-foreground border-border shadow-sm"
            : "text-muted-foreground border-transparent hover:bg-secondary/50 hover:text-foreground/80"
        }`}
        data-testid="tab-quest-filter-all"
      >
        Todos <span className="opacity-60">({totalCount})</span>
      </button>
      {groups.map((group) => (
        <button
          key={group.key}
          onClick={() => onSelect(group.key)}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap border ${
            selectedKey === group.key
              ? "bg-secondary text-foreground border-border shadow-sm"
              : "text-muted-foreground border-transparent hover:bg-secondary/50 hover:text-foreground/80"
          }`}
          data-testid={`tab-quest-filter-${group.key}`}
        >
          {group.color && (
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
          )}
          <span className="truncate max-w-[9rem]">{group.name}</span>
          <span className="opacity-60">({group.count})</span>
        </button>
      ))}
    </div>
  );
}
