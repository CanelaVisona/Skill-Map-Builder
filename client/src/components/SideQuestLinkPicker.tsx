import { useSkillTree } from "@/lib/skill-context";

export interface SideQuestLink {
  sideQuestAreaId: string | null;
  sideQuestProjectId: string | null;
}

// Une un libro / práctica a un área o a un quest (uno u otro): cada avance crea ahí un nodo
// SideQuest ya confirmado (lo hace el server al registrar el avance).
export function SideQuestLinkPicker({
  value,
  onChange,
  className,
}: {
  value: SideQuestLink;
  onChange: (link: SideQuestLink) => void;
  className?: string;
}) {
  const { areas, projects } = useSkillTree();
  const selected = value.sideQuestAreaId
    ? `area:${value.sideQuestAreaId}`
    : value.sideQuestProjectId
      ? `project:${value.sideQuestProjectId}`
      : "";

  return (
    <select
      value={selected}
      onChange={(e) => {
        const [kind, id] = e.target.value.split(":");
        onChange({
          sideQuestAreaId: kind === "area" ? id : null,
          sideQuestProjectId: kind === "project" ? id : null,
        });
      }}
      className={className ?? "w-full px-3 py-2 border border-border/50 rounded-md bg-background text-sm cursor-pointer"}
    >
      <option value="">Sin unir</option>
      {areas.length > 0 && (
        <optgroup label="Áreas">
          {areas.map((area) => (
            <option key={area.id} value={`area:${area.id}`}>{area.name}</option>
          ))}
        </optgroup>
      )}
      {projects.length > 0 && (
        <optgroup label="Quests">
          {projects.map((project) => (
            <option key={project.id} value={`project:${project.id}`}>{project.name}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
