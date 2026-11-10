import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, ChevronLeft, Plus, Trash2, Network, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSkillTree, type Skill } from "@/lib/skill-context";
import { getNodeTitleWordLimit, clampToWordLimit } from "@/lib/node-title-settings";
import {
  fetchSubSkills,
  isSubSkillPlaceholder,
  addSubSkillFromToday,
  moveSubSkillFromToday,
  deleteSubSkillFromToday,
} from "@/lib/subskill-tree";

const PLACEHOLDER_TITLE = "Asigná un paso";

// Comparte la clave ["node-subskills", id] con SkillNode / Tareas de hoy, así lo que se edita acá
// se refleja en el árbol (bloqueo del padre, marca de sub-árbol) sin recargar.
const subSkillsQueryKey = (parentSkillId: string) => ["node-subskills", parentSkillId, "designer"];

function useSubSkills(parentSkillId: string | null) {
  return useQuery({
    queryKey: parentSkillId ? subSkillsQueryKey(parentSkillId) : ["node-subskills", "none"],
    queryFn: () => fetchSubSkills(parentSkillId!),
    enabled: !!parentSkillId,
    staleTime: 0,
  });
}

// Botón de la fila de un nodo en el Skill Designer: abre el editor de su sub-árbol. Se resalta
// cuando el nodo ya tiene sub-nodos creados.
export function SubSkillTreeButton({ skill, onOpen }: { skill: { id: string; title: string }; onOpen: () => void }) {
  const { data } = useSubSkills(skill.id);
  const realCount = (data ?? []).filter((s) => (s.levelPosition || 0) > 1 && !isSubSkillPlaceholder(s)).length;
  const hasTree = (data ?? []).length > 0;
  return (
    <Button
      size="sm"
      variant="ghost"
      className={cn("h-8 px-1.5 gap-0.5", hasTree && "text-sky-600 dark:text-sky-400")}
      onClick={onOpen}
      title={hasTree ? `Editar sub-árbol (${realCount} sub-nodos)` : "Agregar sub-árbol"}
    >
      <Network className="w-4 h-4" />
      {realCount > 0 && <span className="text-[10px] font-semibold">{realCount}</span>}
    </Button>
  );
}

interface SubSkillTreeEditorProps {
  // Nodo raíz cuyo sub-árbol se edita (null = cerrado).
  rootSkill: { id: string; title: string; status?: string } | null;
  onClose: () => void;
}

export function SubSkillTreeEditor({ rootSkill, onClose }: SubSkillTreeEditorProps) {
  // Pila de nodos abiertos: se puede entrar al sub-árbol de un sub-nodo y volver.
  const [stack, setStack] = useState<{ id: string; title: string; status?: string }[]>([]);
  const current = stack.length > 0 ? stack[stack.length - 1] : rootSkill;
  const open = rootSkill !== null;

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setStack([]);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        {current && (
          <SubSkillTreeLevelEditor
            key={current.id}
            parent={current}
            breadcrumb={[rootSkill!, ...stack].map((s) => s.title || PLACEHOLDER_TITLE)}
            onBack={stack.length > 0 ? () => setStack((prev) => prev.slice(0, -1)) : undefined}
            onEnterChild={(child) => setStack((prev) => [...prev, child])}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SubSkillTreeLevelEditor({
  parent,
  breadcrumb,
  onBack,
  onEnterChild,
}: {
  parent: { id: string; title: string; status?: string };
  breadcrumb: string[];
  onBack?: () => void;
  onEnterChild: (child: { id: string; title: string; status?: string }) => void;
}) {
  const queryClient = useQueryClient();
  const { activeParentSkillId, refreshSubSkills } = useSkillTree();
  const { data: subSkills = [], isLoading } = useSubSkills(parent.id);
  const [busy, setBusy] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Skill | null>(null);
  const [confirmDeleteTree, setConfirmDeleteTree] = useState(false);
  const wordLimit = getNodeTitleWordLimit();

  // Un padre ya confirmado no recibe sub-nodos nuevos ni cambios de estructura (solo renombrar).
  const parentConfirmed = parent.status === "mastered";
  const hasTree = subSkills.length > 0;

  const run = async (op: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await op();
    } catch (err) {
      console.error("Error editando el sub-árbol:", err);
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["node-subskills"] });
      // Si el árbol está mostrando justo este sub-árbol, se refresca también.
      if (activeParentSkillId === parent.id) await refreshSubSkills();
      setBusy(false);
    }
  };

  const createTree = () =>
    run(() =>
      fetch(`/api/skills/${parent.id}/subskills/generate-level`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: 1 }),
      })
    );

  const addNode = () => {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    // Genera el sub-árbol si hace falta; el sub-nodo nuevo entra al final y pasa a ser el nodo final.
    void run(() => addSubSkillFromToday(parent.id, title));
  };

  const startEdit = (s: Skill) => {
    setEditingId(s.id);
    setEditTitle(isSubSkillPlaceholder(s) ? "" : s.title || "");
    setEditDescription(s.description || "");
  };

  const saveEdit = () => {
    if (!editingId) return;
    const id = editingId;
    const title = editTitle.trim();
    setEditingId(null);
    void run(() =>
      fetch(`/api/skills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || PLACEHOLDER_TITLE, description: editDescription }),
      })
    );
  };

  // Se ocultan los "inicio" de cada nivel (levelPosition 1), igual que en el resto del designer.
  const levels = Array.from(new Set(subSkills.map((s) => s.level))).sort((a, b) => a - b);
  const nodesOfLevel = (level: number) =>
    subSkills
      .filter((s) => s.level === level && (s.levelPosition || 0) > 1)
      .sort((a, b) => (a.levelPosition || 0) - (b.levelPosition || 0));

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {onBack && (
            <Button size="sm" variant="ghost" className="h-7 w-7 -ml-1" onClick={onBack} title="Volver">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
          <Network className="w-4 h-4 text-sky-500 shrink-0" />
          <span className="truncate">Sub-árbol: {parent.title || PLACEHOLDER_TITLE}</span>
          {busy && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
        </DialogTitle>
        <DialogDescription className={cn(breadcrumb.length <= 1 && "sr-only")}>
          {breadcrumb.join(" › ")}
        </DialogDescription>
      </DialogHeader>

      {isLoading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !hasTree ? (
        <div className="py-4 space-y-3 text-center">
          <p className="text-sm text-muted-foreground">Este nodo todavía no tiene sub-árbol.</p>
          <Button onClick={createTree} disabled={busy || parentConfirmed}>
            <Plus className="w-4 h-4 mr-1" /> Crear sub-árbol
          </Button>
          {parentConfirmed && <p className="text-xs text-muted-foreground">El nodo ya está confirmado.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {levels.map((level) => {
            const nodes = nodesOfLevel(level);
            return (
              <div key={level} className="space-y-2">
                {levels.length > 1 && <div className="text-xs font-semibold text-muted-foreground">Nivel {level}</div>}
                {nodes.length === 0 && <div className="text-xs text-muted-foreground pl-1">Sin sub-nodos.</div>}
                {nodes.map((s, i) => {
                  const placeholder = isSubSkillPlaceholder(s);
                  const prev = nodes[i - 1];
                  const next = nodes[i + 1];
                  if (editingId === s.id) {
                    return (
                      <div key={s.id} className="p-2 rounded border border-primary/50 bg-card space-y-2">
                        <Input
                          autoFocus
                          value={editTitle}
                          placeholder={PLACEHOLDER_TITLE}
                          onChange={(e) => setEditTitle(clampToWordLimit(e.target.value, wordLimit))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <Textarea
                          value={editDescription}
                          placeholder="Descripción (opcional)"
                          rows={2}
                          onChange={(e) => setEditDescription(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                          <Button size="sm" onClick={saveEdit}>Guardar</Button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "p-2 rounded border border-border bg-card/50 hover:bg-card transition-colors flex items-center gap-2",
                        s.status === "locked" && "opacity-70"
                      )}
                    >
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => startEdit(s)} title="Editar sub-nodo">
                        <div
                          className={cn(
                            "text-sm font-medium truncate",
                            placeholder && "text-muted-foreground italic",
                            s.status === "available" && "text-amber-400"
                          )}
                        >
                          {placeholder ? PLACEHOLDER_TITLE : s.title}
                          {s.status === "available" && <span className="ml-1 font-bold">!</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.status === "mastered" ? "✓ Completado" : s.status === "locked" ? "Bloqueado" : "Desbloqueado"}
                          {s.description ? ` · ${s.description}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={busy || parentConfirmed || !prev}
                          onClick={() => run(() => moveSubSkillFromToday(s, prev))}
                          title="Subir"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={busy || parentConfirmed || !next}
                          onClick={() => run(() => moveSubSkillFromToday(s, next))}
                          title="Bajar"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                        {!placeholder && (
                          <SubSkillTreeButton skill={s} onOpen={() => onEnterChild({ id: s.id, title: s.title, status: s.status })} />
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={busy || parentConfirmed}
                          onClick={() => setPendingDelete(s)}
                          title="Eliminar sub-nodo"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {!parentConfirmed && (hasTree || !isLoading) && (
        <div className="flex gap-2 pt-2 border-t border-border">
          <Input
            value={newTitle}
            placeholder="Nuevo sub-nodo…"
            onChange={(e) => setNewTitle(clampToWordLimit(e.target.value, wordLimit))}
            onKeyDown={(e) => e.key === "Enter" && addNode()}
            disabled={busy}
          />
          <Button onClick={addNode} disabled={busy || !newTitle.trim()}>
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        </div>
      )}

      {hasTree && !parentConfirmed && (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => setConfirmDeleteTree(true)}>
            <Trash2 className="w-4 h-4 mr-1" /> Eliminar sub-árbol
          </Button>
        </div>
      )}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar sub-nodo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{pendingDelete && (isSubSkillPlaceholder(pendingDelete) ? PLACEHOLDER_TITLE : pendingDelete.title)}" junto con sus propios sub-nodos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const s = pendingDelete;
                setPendingDelete(null);
                if (s) void run(() => deleteSubSkillFromToday(parent.id, s));
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteTree} onOpenChange={setConfirmDeleteTree}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar todo el sub-árbol?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran todos los sub-nodos de "{parent.title || PLACEHOLDER_TITLE}". No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDeleteTree(false);
                void run(() => fetch(`/api/skills/${parent.id}/subskills`, { method: "DELETE" }));
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
