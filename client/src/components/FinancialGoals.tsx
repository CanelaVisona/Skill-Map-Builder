import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  ArrowLeft,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type {
  FinancialGoal,
  FinancialGoalHolding as Holding,
  FinancialGoalHistoryEntry as HistoryEntry,
  FinancialGoalFlow as Flow,
} from "@shared/schema";

const PALETTE = ["#158a63", "#2f9e8f", "#c8952b", "#d1654f", "#7c6cd1", "#3d8bd4", "#c65f9a", "#6aa33a"];
const EMOJIS = ["🎯", "🏠", "🚗", "✈️", "🎓", "💍", "🏖️", "🐷", "🛡️", "📈", "💻", "📱", "👶", "🏥", "💼", "⌚", "🚀", "🌱", "🎁", "⛵", "🏔️", "🎸", "🏦", "🐶"];
const INSTRUMENTS = ["Plazo fijo", "Caja de ahorro", "Cuenta remunerada", "Fondo común de inversión", "Acciones", "CEDEARs", "Bonos", "Obligaciones negociables", "Dólar MEP", "Dólar billete", "Criptomonedas", "Efectivo"];
const DEFAULT_FLOW: Flow = { amount: 0, unit: "mes", every: 1, rangeTo: 25, anchor: null };
const GOLD = "#b5822a";

// ---------- helpers ----------

const moneyFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
function money(n: number): string {
  return "$" + moneyFormatter.format(Math.round(n || 0));
}
function parseMoney(v: string): number {
  if (!v) return 0;
  const cleaned = v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.max(0, n);
}
function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function goalSaved(g: FinancialGoal): number {
  return (g.holdings || []).reduce((a, h) => a + (Number(h.amount) || 0), 0);
}
function addDays(ts: number, n: number): number {
  return ts + n * 86400000;
}
function addMonths(ts: number, n: number): number {
  const d = new Date(ts);
  d.setMonth(d.getMonth() + n);
  return d.getTime();
}
function dmy(ts: number): string {
  return new Date(ts).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
}
function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
function flowExpire(flow: Flow): number {
  const anchor = flow.anchor ?? Date.now();
  const every = flow.every || 1;
  if (flow.unit === "mes") return addMonths(anchor, 1);
  if (flow.unit === "semana") return addDays(anchor, every * 7);
  if (flow.unit === "dia") return addDays(anchor, every);
  return addDays(anchor, Math.max(flow.rangeTo || every, every));
}
function flowEnable(flow: Flow): number {
  return addDays(flowExpire(flow), -2);
}
function flowCycleLabel(flow: Flow): string {
  const every = flow.every || 1;
  if (flow.unit === "mes") return "/ mes";
  if (flow.unit === "semana") return every > 1 ? `/ ${every} sem` : "/ semana";
  if (flow.unit === "dia") return `/ ${every} d`;
  return `/ ${every}-${flow.rangeTo || every} d`;
}
function flowFreqPhrase(flow: Flow): string {
  const every = flow.every || 1;
  if (flow.unit === "mes") return "una vez al mes";
  if (flow.unit === "semana") return every > 1 ? `cada ${every} semanas` : "cada semana";
  if (flow.unit === "dia") return `cada ${every} días`;
  return `entre ${every} y ${flow.rangeTo || every} días`;
}
function tint(color: string, pct = 18): string {
  return `color-mix(in srgb, ${color} ${pct}%, hsl(var(--muted)))`;
}

// ---------- long press (tap vs. hold) ----------

function useLongPress(onLongPress: () => void, onTap?: () => void, duration = 480) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const firedRef = useRef(false);
  const movedRef = useRef(false);

  const clear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      firedRef.current = false;
      movedRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      clear();
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        try {
          navigator.vibrate?.(12);
        } catch {
          // ignore
        }
        onLongPress();
      }, duration);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (Math.abs(e.clientX - startRef.current.x) > 10 || Math.abs(e.clientY - startRef.current.y) > 10) {
        movedRef.current = true;
        clear();
      }
    },
    onPointerUp: () => {
      clear();
      if (!firedRef.current && !movedRef.current) onTap?.();
    },
    onPointerLeave: () => clear(),
    onPointerCancel: () => clear(),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

// ---------- small shared bits ----------

function HoldingChips({ holdings }: { holdings: Holding[] }) {
  if (!holdings.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {holdings.map((h) => (
        <span key={h.id} className="text-[11px] text-muted-foreground bg-muted/60 border border-border px-2 py-0.5 rounded-full">
          <b className="text-foreground font-semibold">{h.instrument}</b>
          {h.broker ? ` · ${h.broker}` : ""}
        </span>
      ))}
    </div>
  );
}

// ---------- preview card (grid view) ----------

function GoalPreviewCard({ goal, onTap, onLongPress }: { goal: FinancialGoal; onTap: () => void; onLongPress: () => void }) {
  const longPress = useLongPress(onLongPress, onTap);
  const saved = goalSaved(goal);
  const has = (goal.target || 0) > 0;
  const pct = has ? Math.round((saved / goal.target) * 100) : 0;
  const ringPct = Math.min(100, pct);
  const done = has && saved >= goal.target;
  const ringBg = has ? `conic-gradient(${goal.color} ${ringPct}%, hsl(var(--muted)) 0)` : "hsl(var(--muted))";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-4 cursor-pointer select-none hover:border-foreground/20 transition-colors"
      {...longPress}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="h-[58px] w-[58px] rounded-full flex items-center justify-center shrink-0" style={{ background: ringBg }}>
          <div className="h-11 w-11 rounded-full bg-card flex items-center justify-center text-xl">{goal.emoji}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display font-semibold text-base truncate">{goal.name}</div>
          <div className="text-xs font-semibold mt-0.5" style={{ color: has ? goal.color : "hsl(var(--muted-foreground))" }}>
            {has ? `${pct}%${done ? " · completada" : ""}` : "Sin meta fija"}
          </div>
        </div>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-display text-xl font-medium tabular-nums">{money(saved)}</span>
        {has && <span className="text-sm text-muted-foreground tabular-nums">/ {money(goal.target)}</span>}
      </div>
      {has ? (
        <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
          <div className="h-full rounded-full transition-all" style={{ width: `${ringPct}%`, background: goal.color }} />
        </div>
      ) : (
        <div className="mb-3" />
      )}
      <HoldingChips holdings={goal.holdings} />
      {goal.flow.amount > 0 && (
        <div className="mt-2.5 text-xs font-medium" style={{ color: GOLD }}>
          💵 {money(goal.flow.amount)} {flowCycleLabel(goal.flow)}
        </div>
      )}
    </motion.div>
  );
}

// ---------- dashboard row (list view) ----------

function GoalDashboardRow({ goal, onTap, onLongPress }: { goal: FinancialGoal; onTap: () => void; onLongPress: () => void }) {
  const longPress = useLongPress(onLongPress, onTap);
  const saved = goalSaved(goal);
  const has = (goal.target || 0) > 0;
  const pct = has ? Math.round((saved / goal.target) * 100) : 0;
  const done = has && saved >= goal.target;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border bg-card p-4 cursor-pointer select-none transition-colors ${done ? "border-foreground/30" : "border-border hover:border-foreground/20"}`}
      {...longPress}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: tint(goal.color) }}>
          {goal.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display font-semibold text-sm truncate">{goal.name}</div>
          <div className="mt-1.5">
            <HoldingChips holdings={goal.holdings} />
          </div>
        </div>
      </div>
      <div className="flex items-baseline gap-2 mt-3">
        <span className="font-display text-lg font-medium tabular-nums">{money(saved)}</span>
        {has && <span className="text-sm text-muted-foreground tabular-nums">/ {money(goal.target)}</span>}
        {has ? (
          done ? (
            <span className="ml-auto text-xs font-semibold" style={{ color: goal.color }}>
              ✓ Completada
            </span>
          ) : (
            <span className="ml-auto text-sm font-semibold tabular-nums" style={{ color: goal.color }}>
              {pct}%
            </span>
          )
        ) : (
          <span className="ml-auto text-xs text-muted-foreground">sin objetivo</span>
        )}
      </div>
      {has && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: goal.color }} />
        </div>
      )}
    </motion.div>
  );
}

// ---------- dashboard side: distribution ----------

function DistributionCard({ goals }: { goals: FinancialGoal[] }) {
  const byInst = new Map<string, number>();
  goals.forEach((g) => g.holdings.forEach((h) => {
    if (h.amount > 0) byInst.set(h.instrument, (byInst.get(h.instrument) || 0) + h.amount);
  }));
  const data = Array.from(byInst.entries()).map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }));
  const total = data.reduce((a, d) => a + d.value, 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="font-display font-semibold text-sm">Distribución por instrumento</div>
      <div className="text-xs text-muted-foreground mt-0.5 mb-3">Adónde está puesto tu dinero ahorrado</div>
      {data.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Cuando cargues ahorros vas a ver acá cómo se reparten.</div>
      ) : (
        <>
          <div className="relative h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="100%" paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={3}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="font-display text-base font-medium tabular-nums">{money(total)}</div>
              <div className="text-[11px] text-muted-foreground">invertido</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-3">
            {data.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
                <span className="flex-1 min-w-0 truncate text-muted-foreground">{d.name}</span>
                <span className="font-semibold tabular-nums">{money(d.value)}</span>
                <span className="text-xs text-muted-foreground w-9 text-right">{Math.round((d.value / (total || 1)) * 100)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- dashboard side: recent movements ----------

function MovementsCard({ goals }: { goals: FinancialGoal[] }) {
  const all = goals
    .flatMap((g) => (g.history || []).map((h) => ({ ...h, goalName: g.name, emoji: g.emoji, color: g.color })))
    .sort((a, b) => b.date - a.date)
    .slice(0, 40);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="font-display font-semibold text-sm">Ingresos recientes</div>
      <div className="text-xs text-muted-foreground mt-0.5 mb-3">Últimos aportes que registraste</div>
      {all.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4">Sin ingresos todavía.</div>
      ) : (
        <div className="flex flex-col gap-1 max-h-[280px] overflow-y-auto minimal-scrollbar -mx-1 px-1">
          {all.map((m) => {
            const sub = [m.inst, m.note].filter(Boolean).join(" · ");
            return (
              <div key={m.id} className="flex items-center gap-2.5 py-2 px-1 rounded-lg hover:bg-muted/50">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: tint(m.color) }}>
                  {m.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{m.goalName}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {sub ? sub + " · " : ""}
                    {fmtDateTime(m.date)}
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums" style={{ color: m.color }}>
                  +{money(m.amount)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- create / edit dialog ----------

interface HoldingDraft {
  id: string;
  instrument: string;
  broker: string;
  amountText: string;
  custom: boolean;
}

function newHoldingDraft(): HoldingDraft {
  return { id: genId(), instrument: INSTRUMENTS[0], broker: "", amountText: "", custom: false };
}

function GoalFormDialog({
  open,
  onOpenChange,
  goal,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: FinancialGoal | null;
  onSubmit: (data: { name: string; emoji: string; color: string; target: number; holdings: Holding[]; flow: Flow }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState("");
  const [targetText, setTargetText] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [color, setColor] = useState(PALETTE[0]);
  const [holdings, setHoldings] = useState<HoldingDraft[]>([]);
  const [flow, setFlow] = useState<Flow>(DEFAULT_FLOW);
  const [flowAmountText, setFlowAmountText] = useState("");
  const [nameErr, setNameErr] = useState(false);
  const [instErr, setInstErr] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (goal) {
      setName(goal.name);
      setTargetText(goal.target ? moneyFormatter.format(goal.target) : "");
      setEmoji(goal.emoji);
      setColor(goal.color);
      setHoldings(
        goal.holdings.length
          ? goal.holdings.map((h) => ({
              id: h.id,
              instrument: h.instrument,
              broker: h.broker,
              amountText: h.amount ? moneyFormatter.format(h.amount) : "",
              custom: !INSTRUMENTS.includes(h.instrument),
            }))
          : [newHoldingDraft()]
      );
      setFlow(goal.flow);
      setFlowAmountText(goal.flow.amount ? moneyFormatter.format(goal.flow.amount) : "");
    } else {
      setName("");
      setTargetText("");
      setEmoji(EMOJIS[Math.floor(Math.random() * 8)]);
      setColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
      setHoldings([newHoldingDraft()]);
      setFlow(DEFAULT_FLOW);
      setFlowAmountText("");
    }
    setNameErr(false);
    setInstErr(false);
  }, [open, goal]);

  const addHoldingRow = () => setHoldings((h) => [...h, newHoldingDraft()]);
  const removeHoldingRow = (id: string) =>
    setHoldings((h) => {
      const next = h.filter((x) => x.id !== id);
      return next.length ? next : [newHoldingDraft()];
    });
  const updateHoldingRow = (id: string, patch: Partial<HoldingDraft>) =>
    setHoldings((h) => h.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const handleSave = () => {
    const trimmedName = name.trim();
    const finalHoldings: Holding[] = holdings
      .map((h) => ({ id: h.id, instrument: h.instrument.trim(), broker: h.broker.trim(), amount: parseMoney(h.amountText) }))
      .filter((h) => h.instrument);

    let ok = true;
    if (!trimmedName) {
      setNameErr(true);
      ok = false;
    } else setNameErr(false);
    if (!finalHoldings.length) {
      setInstErr(true);
      ok = false;
    } else setInstErr(false);
    if (!ok) return;

    const flowAmount = parseMoney(flowAmountText);
    const hadFlow = (goal?.flow.amount ?? 0) > 0 && !!goal?.flow.anchor;
    const finalFlow: Flow = {
      amount: flowAmount,
      unit: flow.unit,
      every: flow.every || 1,
      rangeTo: flow.rangeTo || 25,
      anchor: flowAmount > 0 ? (hadFlow ? goal!.flow.anchor : Date.now()) : null,
    };

    onSubmit({ name: trimmedName, emoji, color, target: parseMoney(targetText), holdings: finalHoldings, flow: finalFlow });
  };

  const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{goal ? "Editar meta" : "Nueva meta"}</DialogTitle>
          <DialogDescription>Definí con qué la estás juntando. El monto objetivo es opcional.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Ícono de la meta</label>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-muted border border-border flex items-center justify-center text-2xl shrink-0">{emoji}</div>
              <div className="flex flex-wrap gap-1 flex-1 max-h-24 overflow-y-auto minimal-scrollbar">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={`h-8 w-8 rounded-lg text-base flex items-center justify-center transition-colors ${emoji === e ? "bg-primary/15 scale-105" : "hover:bg-muted"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block" htmlFor="fg-name">
              Nombre del objetivo
            </label>
            <Input id="fg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Fondo de emergencia, Viaje a Japón" maxLength={60} />
            {nameErr && <p className="text-xs text-destructive mt-1">Poné un nombre para la meta.</p>}
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block" htmlFor="fg-target">
              Monto necesario <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input id="fg-target" className="pl-6" inputMode="decimal" value={targetText} onChange={(e) => setTargetText(e.target.value)} placeholder="Sin objetivo fijo" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Instrumentos <span className="text-muted-foreground font-normal">— podés cargar varios, con su broker y lo que ya tenés en cada uno</span>
            </label>
            <div className="space-y-2">
              {holdings.map((h) => (
                <div key={h.id} className="grid grid-cols-[1.1fr_1fr_84px_32px] gap-1.5 items-center">
                  {h.custom ? (
                    <Input value={h.instrument} onChange={(e) => updateHoldingRow(h.id, { instrument: e.target.value })} placeholder="Instrumento" maxLength={40} className="h-9 text-xs" />
                  ) : (
                    <select
                      value={h.instrument}
                      onChange={(e) => {
                        if (e.target.value === "__custom") updateHoldingRow(h.id, { custom: true, instrument: "" });
                        else updateHoldingRow(h.id, { instrument: e.target.value });
                      }}
                      className={selectClass}
                    >
                      {INSTRUMENTS.map((i) => (
                        <option key={i} value={i}>
                          {i}
                        </option>
                      ))}
                      <option value="__custom">Otro…</option>
                    </select>
                  )}
                  <Input value={h.broker} onChange={(e) => updateHoldingRow(h.id, { broker: e.target.value })} placeholder="Broker (ej: IOL)" maxLength={40} className="h-9 text-xs" />
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                    <Input
                      value={h.amountText}
                      onChange={(e) => updateHoldingRow(h.id, { amountText: e.target.value })}
                      placeholder="0"
                      inputMode="decimal"
                      className="h-9 text-xs pl-4"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeHoldingRow(h.id)}
                    aria-label="Quitar instrumento"
                    className="h-8 w-8 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive flex items-center justify-center text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addHoldingRow} className="mt-2 text-sm font-medium text-primary flex items-center gap-1.5 hover:underline">
              <Plus className="h-3.5 w-3.5" /> Agregar instrumento
            </button>
            {instErr && <p className="text-xs text-destructive mt-1">Cargá al menos un instrumento con nombre.</p>}
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Flujo <span className="text-muted-foreground font-normal">— aporte periódico y cuándo se habilita (opcional)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-muted-foreground mb-1 block">Monto</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input className="pl-6" inputMode="decimal" value={flowAmountText} onChange={(e) => setFlowAmountText(e.target.value)} placeholder="0" />
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground mb-1 block">Frecuencia</span>
                <select
                  value={flow.unit}
                  onChange={(e) => {
                    const unit = e.target.value as Flow["unit"];
                    setFlow((f) => ({
                      ...f,
                      unit,
                      every: unit === "rango" ? f.every || 20 : f.every || 1,
                      rangeTo: unit === "rango" ? Math.max(f.rangeTo || 25, f.every || 20) : f.rangeTo,
                    }));
                  }}
                  className={selectClass + " text-sm h-9"}
                >
                  <option value="mes">Mensual</option>
                  <option value="semana">Semanal</option>
                  <option value="dia">Cada X días</option>
                  <option value="rango">Entre X y Y días</option>
                </select>
              </div>
            </div>
            <div className="mt-2">
              {flow.unit === "mes" && <p className="text-xs text-muted-foreground">Se habilita una vez al mes desde el último aporte.</p>}
              {flow.unit === "semana" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  Cada
                  <Input
                    type="number"
                    min={1}
                    value={flow.every || 1}
                    onChange={(e) => setFlow((f) => ({ ...f, every: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-16 h-8 text-center"
                  />
                  semana(s)
                </div>
              )}
              {flow.unit === "dia" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  Cada
                  <Input
                    type="number"
                    min={1}
                    value={flow.every || 1}
                    onChange={(e) => setFlow((f) => ({ ...f, every: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-16 h-8 text-center"
                  />
                  día(s)
                </div>
              )}
              {flow.unit === "rango" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                  Desbloquear entre
                  <Input
                    type="number"
                    min={1}
                    value={flow.every || 20}
                    onChange={(e) =>
                      setFlow((f) => {
                        const every = Math.max(1, parseInt(e.target.value) || 1);
                        return { ...f, every, rangeTo: Math.max(f.rangeTo || every, every) };
                      })
                    }
                    className="w-16 h-8 text-center"
                  />
                  y
                  <Input
                    type="number"
                    min={1}
                    value={flow.rangeTo || 25}
                    onChange={(e) => setFlow((f) => ({ ...f, rangeTo: Math.max(f.every || 1, parseInt(e.target.value) || 1) }))}
                    className="w-16 h-8 text-center"
                  />
                  días
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Color de la meta</label>
            <div className="flex gap-2 flex-wrap">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className="h-6 w-6 rounded-lg border-2 transition-transform"
                  style={{ background: c, borderColor: c === color ? "hsl(var(--foreground))" : "transparent", transform: c === color ? "scale(1.1)" : undefined }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          {goal && (
            <Button type="button" variant="destructive" onClick={onDelete} className="mr-auto">
              <Trash2 className="h-4 w-4" /> Borrar
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave}>
            Guardar meta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- detail dialog ----------

function GoalDetailDialog({
  goal,
  open,
  onOpenChange,
  onEdit,
  onAddFlow,
  onOpenCalendar,
}: {
  goal: FinancialGoal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onAddFlow: (holdingId: string) => void;
  onOpenCalendar: () => void;
}) {
  const [flowHoldingId, setFlowHoldingId] = useState<string>("");

  useEffect(() => {
    if (goal && goal.holdings.length) setFlowHoldingId(goal.holdings[0].id);
  }, [goal?.id]);

  if (!goal) return null;

  const saved = goalSaved(goal);
  const has = (goal.target || 0) > 0;
  const target = goal.target || 0;
  const miss = Math.max(0, target - saved);
  const pct = has ? Math.round((saved / target) * 100) : 0;

  const slices = goal.holdings
    .filter((h) => h.amount > 0)
    .map((h, i) => ({ name: h.instrument + (h.broker ? ` · ${h.broker}` : ""), value: h.amount, color: PALETTE[i % PALETTE.length] }));
  if (has && miss > 0) slices.push({ name: "Falta", value: miss, color: "hsl(var(--muted-foreground) / 0.35)" });
  const sliceTotal = slices.reduce((a, s) => a + s.value, 0) || 1;

  const now = Date.now();
  const mf = goal.flow.amount || 0;
  const enable = mf > 0 ? flowEnable(goal.flow) : 0;
  const flowReady = mf > 0 && now >= enable;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <span className="text-xl">{goal.emoji}</span>
                <span className="truncate">{goal.name}</span>
              </DialogTitle>
              <DialogDescription>{has ? `${money(saved)} de ${money(target)} · ${pct}% alcanzado` : `${money(saved)} · sin objetivo definido`}</DialogDescription>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={onOpenCalendar} title="Ver calendario de aportes" className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground flex items-center justify-center">
                <CalendarDays className="h-4 w-4" />
              </button>
              <button onClick={onEdit} title="Editar meta" className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground flex items-center justify-center">
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-muted/50 border border-border p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: goal.color }} />
              Tenés
            </div>
            <div className="font-display text-xl font-medium mt-1 tabular-nums">{money(saved)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{has ? `${Math.min(100, pct)}% del objetivo` : "ahorro acumulado"}</div>
          </div>
          <div className="rounded-xl bg-muted/50 border border-border p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-muted-foreground/30" />
              Falta
            </div>
            <div className="font-display text-xl font-medium mt-1 tabular-nums">{has ? money(miss) : "—"}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{has ? `${Math.max(0, 100 - Math.min(100, pct))}% del objetivo` : "sin meta fija"}</div>
          </div>
        </div>

        {slices.length > 0 ? (
          <>
            <div className="relative h-[170px] mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="value" innerRadius="64%" outerRadius="100%" paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={3}>
                    {slices.map((s, i) => (
                      <Cell key={i} fill={s.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="font-display text-lg font-medium">{has ? `${pct}%` : "—"}</div>
                <div className="text-[11px] text-muted-foreground">{has ? "alcanzado" : "sin meta"}</div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 mt-2">
              {slices.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                  <span className="flex-1 min-w-0 truncate text-muted-foreground">{s.name}</span>
                  <span className="font-semibold tabular-nums">{money(s.value)}</span>
                  <span className="text-xs text-muted-foreground w-9 text-right">{Math.round((s.value / sliceTotal) * 100)}%</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-6">Todavía no cargaste dinero en esta meta.</div>
        )}

        <div className="border-t border-border pt-3 mt-1">
          <div className="font-display font-semibold text-sm">💵 Flujo</div>
          {mf <= 0 ? (
            <p className="text-sm text-muted-foreground mt-1.5">Sin flujo configurado · editá la meta para agregarlo.</p>
          ) : (
            <>
              <div className="text-sm mt-1.5 flex items-center gap-2 flex-wrap">
                <span className="font-display text-base font-medium">{money(mf)}</span>
                <span className="text-xs bg-muted border border-border rounded-full px-2 py-0.5 text-muted-foreground">{flowFreqPhrase(goal.flow)}</span>
              </div>
              {goal.holdings.length > 1 && (
                <select
                  value={flowHoldingId}
                  onChange={(e) => setFlowHoldingId(e.target.value)}
                  className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {goal.holdings.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.instrument}
                      {h.broker ? ` · ${h.broker}` : ""}
                    </option>
                  ))}
                </select>
              )}
              <div className={`mt-2.5 rounded-xl border overflow-hidden ${flowReady ? "" : "border-border"}`} style={flowReady ? { borderColor: `${GOLD}99` } : undefined}>
                <div className="flex items-center gap-1.5 text-xs px-3 py-2" style={flowReady ? { color: GOLD, background: `${GOLD}1a` } : { color: "hsl(var(--muted-foreground))", background: "hsl(var(--muted) / 0.5)" }}>
                  {flowReady ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  {flowReady ? "Habilitado" : `Se habilita el ${dmy(enable)}`}
                </div>
                <button
                  onClick={() => onAddFlow(flowHoldingId || goal.holdings[0]?.id)}
                  disabled={!flowReady}
                  className="w-full py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ background: flowReady ? GOLD : "transparent", color: flowReady ? "#fff" : "hsl(var(--muted-foreground))" }}
                >
                  Agregar {money(mf)}
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- calendar dialog ----------

function GoalCalendarDialog({
  goal,
  open,
  onOpenChange,
  onBack,
}: {
  goal: FinancialGoal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBack: () => void;
}) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [selDay, setSelDay] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      const d = new Date();
      setYear(d.getFullYear());
      setMonth(d.getMonth());
      setSelDay(null);
    }
  }, [open, goal?.id]);

  if (!goal) return null;

  const byDay = new Map<string, number>();
  (goal.history || []).forEach((h) => {
    const d = new Date(h.date);
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    byDay.set(k, (byDay.get(k) || 0) + h.amount);
  });

  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const dim = new Date(year, month + 1, 0).getDate();
  const dows = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
  const today = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month;

  let monthTotal = 0;
  let daysWith = 0;
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < offset; i++) cells.push(<div key={`b${i}`} />);
  for (let d = 1; d <= dim; d++) {
    const k = `${year}-${month}-${d}`;
    const amt = byDay.get(k) || 0;
    const has = amt > 0;
    if (has) {
      monthTotal += amt;
      daysWith++;
    }
    const isToday = isThisMonth && today.getDate() === d;
    cells.push(
      <button
        key={d}
        onClick={() => setSelDay(d)}
        className="aspect-square rounded-lg flex items-center justify-center text-sm relative border-[1.5px]"
        style={{
          background: has ? tint(goal.color, 22) : "hsl(var(--muted) / 0.5)",
          borderColor: has ? goal.color : "transparent",
          fontWeight: has ? 700 : 400,
          outline: isToday ? `2px solid ${goal.color}` : selDay === d ? "2px solid hsl(var(--foreground))" : undefined,
          outlineOffset: isToday || selDay === d ? "-2px" : undefined,
        }}
        title={has ? money(amt) : undefined}
      >
        {d}
        {has && <span className="absolute bottom-1 h-1 w-1 rounded-full" style={{ background: goal.color }} />}
      </button>
    );
  }

  const dayItems = selDay
    ? (goal.history || [])
        .filter((h) => {
          const d = new Date(h.date);
          return d.getFullYear() === year && d.getMonth() === month && d.getDate() === selDay;
        })
        .sort((a, b) => b.date - a.date)
    : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onBack();
      }}
    >
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <span className="text-xl">{goal.emoji}</span>
                <span className="truncate">{goal.name}</span>
              </DialogTitle>
              <DialogDescription>Días en que agregaste dinero</DialogDescription>
            </div>
            <button onClick={onBack} title="Volver" className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="flex items-center justify-between mb-1">
          <button
            onClick={() => {
              if (month === 0) {
                setMonth(11);
                setYear((y) => y - 1);
              } else setMonth((m) => m - 1);
              setSelDay(null);
            }}
            className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground flex items-center justify-center"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-display font-medium text-sm capitalize">{new Date(year, month, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</span>
          <button
            onClick={() => {
              if (month === 11) {
                setMonth(0);
                setYear((y) => y + 1);
              } else setMonth((m) => m + 1);
              setSelDay(null);
            }}
            className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground flex items-center justify-center"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {dows.map((d) => (
            <div key={d} className="text-center text-[11px] text-muted-foreground font-semibold pb-1">
              {d}
            </div>
          ))}
          {cells}
        </div>

        <div className="text-sm text-muted-foreground text-center bg-muted/50 border border-border rounded-lg p-2.5 mt-3">
          {daysWith ? (
            <>
              Aportaste <b className="text-foreground font-semibold">{money(monthTotal)}</b> en {daysWith} {daysWith === 1 ? "día" : "días"} este mes.
            </>
          ) : (
            "Sin aportes en este mes."
          )}
        </div>

        {selDay && (
          <div className="mt-3">
            <div className="text-sm font-semibold mb-1.5 capitalize">
              {selDay} de {new Date(year, month, 1).toLocaleDateString("es-AR", { month: "long" })}
            </div>
            {dayItems.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sin movimientos ese día.</div>
            ) : (
              <div className="flex flex-col gap-1">
                {dayItems.map((h) => (
                  <div key={h.id} className="flex items-center gap-2.5 py-1.5">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: tint(goal.color) }}>
                      {goal.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{[h.inst, h.note].filter(Boolean).join(" · ") || "Aporte"}</div>
                      <div className="text-xs text-muted-foreground">{new Date(h.date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums" style={{ color: goal.color }}>
                      +{money(h.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- main ----------

export default function FinancialGoals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"preview" | "dashboard">("preview");
  const [formOpen, setFormOpen] = useState(false);
  const [formGoal, setFormGoal] = useState<FinancialGoal | null>(null);
  const [detailGoalId, setDetailGoalId] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { data: goals = [], isLoading } = useQuery<FinancialGoal[]>({
    queryKey: ["/api/financial-goals"],
    queryFn: async () => {
      const res = await fetch("/api/financial-goals");
      if (!res.ok) throw new Error("Failed to fetch financial goals");
      return res.json();
    },
  });

  const createGoal = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/financial-goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed to create goal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial-goals"] });
      setFormOpen(false);
    },
  });

  const updateGoal = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/financial-goals/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed to update goal");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/financial-goals"] }),
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/financial-goals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete goal");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial-goals"] });
      setFormOpen(false);
      setDetailGoalId(null);
    },
  });

  const detailGoal = goals.find((g) => g.id === detailGoalId) || null;
  const totalSaved = goals.reduce((a, g) => a + goalSaved(g), 0);
  const totalTarget = goals.reduce((a, g) => a + (g.target || 0), 0);
  const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  const openCreate = () => {
    setFormGoal(null);
    setFormOpen(true);
  };
  const openEdit = (g: FinancialGoal) => {
    setFormGoal(g);
    setFormOpen(true);
  };

  const handleFormSubmit = (data: { name: string; emoji: string; color: string; target: number; holdings: Holding[]; flow: Flow }) => {
    if (formGoal) {
      updateGoal.mutate({ id: formGoal.id, data });
    } else {
      const history: HistoryEntry[] = [];
      data.holdings.forEach((h) => {
        if (h.amount > 0) history.push({ id: genId(), amount: h.amount, date: Date.now(), note: "Saldo inicial", inst: h.instrument, holdingId: h.id });
      });
      createGoal.mutate({ ...data, history });
    }
  };

  const handleDelete = () => {
    if (!formGoal) return;
    if (window.confirm(`¿Borrar la meta "${formGoal.name}"? No se puede deshacer.`)) {
      deleteGoal.mutate(formGoal.id);
    }
  };

  const handleAddFlow = (holdingId: string) => {
    if (!detailGoal) return;
    const mf = detailGoal.flow.amount || 0;
    if (mf <= 0) {
      toast({ title: "Definí un monto de flujo primero" });
      return;
    }
    const enable = flowEnable(detailGoal.flow);
    if (Date.now() < enable) {
      toast({ title: `El flujo se habilita el ${dmy(enable)}` });
      return;
    }
    const holding = detailGoal.holdings.find((h) => h.id === holdingId) || detailGoal.holdings[0];
    if (!holding) {
      toast({ title: "Agregá un instrumento a la meta" });
      return;
    }
    const holdings = detailGoal.holdings.map((h) => (h.id === holding.id ? { ...h, amount: (h.amount || 0) + mf } : h));
    const history = [...(detailGoal.history || []), { id: genId(), amount: mf, date: Date.now(), note: "Flujo", inst: holding.instrument, holdingId: holding.id }];
    const flow = { ...detailGoal.flow, anchor: Date.now() };
    updateGoal.mutate({ id: detailGoal.id, data: { holdings, history, flow } });
    toast({ title: `+${money(mf)} en ${holding.instrument}` });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-border/60">
        <div>
          <h2 className="font-display font-semibold text-lg">Metas financieras</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Tocá una meta para ver el detalle · mantené presionada para editar</p>
        </div>
        <Button size="icon" className="rounded-full shrink-0" onClick={openCreate} title="Nueva meta" data-testid="button-new-financial-goal">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-5 pt-3">
        <div className="inline-flex bg-muted rounded-xl p-1 gap-1">
          <button onClick={() => setView("preview")} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === "preview" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
            Objetivos
          </button>
          <button onClick={() => setView("dashboard")} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === "dashboard" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
            Panel
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto minimal-scrollbar px-5 py-4">
        {isLoading ? (
          <div className="text-center text-sm text-muted-foreground py-10">Cargando metas...</div>
        ) : goals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <div className="font-display font-medium mb-1">Sin objetivos todavía</div>
            <p className="text-sm text-muted-foreground mb-4">Creá tu primera meta financiera para empezar a trackear tus ahorros.</p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Crear meta
            </Button>
          </div>
        ) : view === "preview" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {goals.map((g) => (
              <GoalPreviewCard key={g.id} goal={g} onTap={() => setDetailGoalId(g.id)} onLongPress={() => openEdit(g)} />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Total ahorrado</div>
              <div className="font-display text-3xl font-medium tabular-nums mt-1">{money(totalSaved)}</div>
              <div className="text-sm text-muted-foreground mt-1">de {money(totalTarget)} en objetivos</div>
              <div className="h-2 rounded-full bg-muted overflow-hidden mt-3">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, overallPct)}%` }} />
              </div>
              <div className="flex justify-between mt-3 text-sm">
                <span>
                  <span className="font-display font-medium">{totalTarget > 0 ? `${overallPct}%` : "—"}</span> <span className="text-muted-foreground">progreso general</span>
                </span>
                <span>
                  <span className="font-display font-medium">{goals.length}</span> <span className="text-muted-foreground">{goals.length === 1 ? "meta activa" : "metas activas"}</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
              <div className="space-y-3">
                {goals.map((g) => (
                  <GoalDashboardRow key={g.id} goal={g} onTap={() => setDetailGoalId(g.id)} onLongPress={() => openEdit(g)} />
                ))}
              </div>
              <div className="space-y-4">
                <DistributionCard goals={goals} />
                <MovementsCard goals={goals} />
              </div>
            </div>
          </div>
        )}
      </div>

      <GoalFormDialog open={formOpen} onOpenChange={setFormOpen} goal={formGoal} onSubmit={handleFormSubmit} onDelete={handleDelete} />
      <GoalDetailDialog
        goal={detailGoal}
        open={!!detailGoal && !calendarOpen}
        onOpenChange={(v) => {
          if (!v) setDetailGoalId(null);
        }}
        onEdit={() => {
          if (detailGoal) {
            setDetailGoalId(null);
            openEdit(detailGoal);
          }
        }}
        onAddFlow={handleAddFlow}
        onOpenCalendar={() => setCalendarOpen(true)}
      />
      <GoalCalendarDialog
        goal={detailGoal}
        open={!!detailGoal && calendarOpen}
        onOpenChange={(v) => {
          if (!v) setCalendarOpen(false);
        }}
        onBack={() => setCalendarOpen(false)}
      />
    </div>
  );
}
