import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Lightbulb, Split, HelpCircle, Wrench, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInsightsCounterPopup } from "@/lib/insights-counter-popup-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// "Nueva entrada" del Journal: se abre manteniendo apretado el fondo de sus tabs (ver QuestDiary
// en SkillTree.tsx). Carga un pensamiento, aprendizaje, herramienta, estrategia o pregunta suelto (sin
// nodo), con los mismos pasos que los cubos del modal de feedback post-confirmación:
// descripción primero, título después.

export type JournalQuickAddKind = "thought" | "learning" | "tool" | "strategy" | "question";

const KINDS: Array<{ id: JournalQuickAddKind; label: string; endpoint: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "thought", label: "Pensamiento", endpoint: "thoughts", icon: BookOpen },
  { id: "learning", label: "Aprendizaje", endpoint: "learnings", icon: Lightbulb },
  { id: "tool", label: "Herramienta", endpoint: "tools", icon: Wrench },
  { id: "strategy", label: "Estrategia", endpoint: "strategies", icon: Split },
  { id: "question", label: "Pregunta", endpoint: "questions", icon: HelpCircle },
];

const inputClass = "border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted";
const fieldLabel = "text-[11px] text-muted-foreground uppercase tracking-wide block";

export function JournalQuickAddDialog({
  open,
  onOpenChange,
  initialKind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialKind: JournalQuickAddKind;
}) {
  const queryClient = useQueryClient();
  const { showInsightsCounterPopup } = useInsightsCounterPopup();
  const [kind, setKind] = useState<JournalQuickAddKind>(initialKind);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [sentence, setSentence] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setKind(initialKind);
      setStep(0);
      setTitle("");
      setSentence("");
      setSaving(false);
    }
  }, [open, initialKind]);

  const meta = KINDS.find((k) => k.id === kind)!;

  const save = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const url = `/api/journal/${meta.endpoint}`;
      const before = await queryClient.fetchQuery<Array<unknown>>({ queryKey: [url], staleTime: 0 });
      const countBefore = before?.length ?? 0;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), sentence: sentence.trim() }),
      });
      if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
      queryClient.invalidateQueries({ queryKey: [url] });
      onOpenChange(false);
      showInsightsCounterPopup({ type: kind, countBefore, countAfter: countBefore + 1 });
    } catch (error) {
      console.error("[JournalQuickAddDialog] Failed to save:", error);
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 0) setStep(1);
    else void save();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] border-0 shadow-2xl max-h-[90dvh] flex flex-col gap-3 overflow-hidden">
        <DialogTitle className="text-lg font-medium shrink-0">Nueva entrada</DialogTitle>
        <DialogDescription className="sr-only">Agregá un pensamiento, aprendizaje, herramienta, estrategia o pregunta al Journal</DialogDescription>

        <div className="grid grid-cols-5 gap-1.5 shrink-0">
          {KINDS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] font-medium transition-colors",
                kind === id ? "border-primary/50 bg-primary/10" : "border-border/60 bg-muted/40 hover:bg-muted/60"
              )}
              data-testid={`journal-quick-add-kind-${id}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto minimal-scrollbar -mx-1 px-1 space-y-4">
          <p className="text-[11px] text-muted-foreground">Paso {step + 1} de 2</p>
          {step === 0 ? (
            <div className="space-y-1.5">
              <Label className={fieldLabel}>Descripción</Label>
              <Textarea
                placeholder={kind === "thought" ? "Descripción, notas o reflexión..." : "Descripción"}
                value={sentence}
                onChange={(e) => setSentence(e.target.value)}
                rows={3}
                className={cn(inputClass, "resize-none")}
                data-testid="journal-quick-add-description"
                autoFocus
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className={fieldLabel}>Título</Label>
              <Input
                placeholder="TÍTULO"
                value={title}
                onChange={(e) => setTitle(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); next(); } }}
                className={cn("uppercase", inputClass)}
                data-testid="journal-quick-add-title"
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (step === 0 ? onOpenChange(false) : setStep(0))}
            className="bg-muted/50 hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {step === 0 ? "Cancelar" : "Atrás"}
          </Button>
          <Button size="sm" onClick={next} disabled={step === 1 && (!title.trim() || saving)} data-testid="journal-quick-add-next">
            {step === 0 ? "Siguiente" : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
