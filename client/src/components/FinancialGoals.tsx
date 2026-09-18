import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
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
  CalendarRange,
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
  BudgetQuarter,
  BudgetMonthEntry,
  BudgetCategory,
  BudgetCategoryMonthEntry,
  DollarRate,
} from "@shared/schema";

const PALETTE = ["#158a63", "#2f9e8f", "#c8952b", "#d1654f", "#7c6cd1", "#3d8bd4", "#c65f9a", "#6aa33a"];
const EMOJIS = ["🎯", "🏠", "🚗", "✈️", "🎓", "💍", "🏖️", "🐷", "🛡️", "📈", "💻", "📱", "👶", "🏥", "💼", "⌚", "🚀", "🌱", "🎁", "⛵", "🏔️", "🎸", "🏦", "🐶"];
const INSTRUMENTS = ["Plazo fijo", "Caja de ahorro", "Cuenta remunerada", "Fondo común de inversión", "Acciones", "CEDEARs", "Bonos", "Obligaciones negociables", "Dólar MEP", "Dólar billete", "Criptomonedas", "Efectivo"];
const DEFAULT_FLOW: Flow = { amount: 0, unit: "mes", every: 1, rangeTo: 25, anchor: null };
const GOLD = "#b5822a";

const BUDGET_CATEGORIES: { key: "fixed" | "variable" | "savings"; label: string; color: string }[] = [
  { key: "fixed", label: "Gastos fijos", color: "#3d8bd4" },
  { key: "variable", label: "Gastos variables", color: "#c8952b" },
  { key: "savings", label: "Ahorro", color: "#158a63" },
];
const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// ---------- helpers ----------

const moneyFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
function money(n: number): string {
  return "$" + moneyFormatter.format(Math.round(n || 0));
}
function moneyUsd(n: number): string {
  return "US$" + moneyFormatter.format(Math.round(n || 0));
}
// Cotización a usar para un monto: la del mes puntual si se pasa año/mes y existe, si no la
// última cargada (mayor año/mes registrado) como aproximación del valor actual.
function dollarRateFor(rates: DollarRate[], year?: number, month?: number): number | null {
  if (year !== undefined && month !== undefined) {
    const exact = rates.find((r) => r.year === year && r.month === month);
    if (exact) return exact.rate;
  }
  if (!rates.length) return null;
  const latest = rates.reduce((a, b) => (a.year * 12 + a.month > b.year * 12 + b.month ? a : b));
  return latest.rate;
}
// Todos los montos se anotan en dólares; este texto plano (para atributos title, toasts, etc.
// donde no se puede usar JSX apilado) muestra el dólar primero y el peso entre paréntesis.
function moneyPairText(usd: number, rates: DollarRate[], year?: number, month?: number): string {
  const rate = dollarRateFor(rates, year, month);
  if (!rate) return moneyUsd(usd);
  return `${moneyUsd(usd)} (${money(usd * rate)})`;
}

const DollarRatesContext = createContext<DollarRate[]>([]);
function useDollarRates(): DollarRate[] {
  return useContext(DollarRatesContext);
}

// Muestra un monto en dólares (la unidad en la que se anota todo) con su equivalente en pesos
// chiquito debajo, según la cotización del mes indicado, o la última cargada si no se pasa mes.
// Si todavía no hay ninguna cotización cargada, muestra solo el monto en dólares.
function Money({ usd, year, month, className }: { usd: number; year?: number; month?: number; className?: string }) {
  const rates = useDollarRates();
  const rate = dollarRateFor(rates, year, month);
  return (
    <span className={`inline-flex flex-col items-start leading-tight align-middle ${className || ""}`}>
      <span className="tabular-nums">{moneyUsd(usd)}</span>
      {rate !== null && <span className="text-muted-foreground font-normal text-[0.72em] tabular-nums">{money(usd * rate)}</span>}
    </span>
  );
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
// Los últimos 3 meses CERRADOS, sin contar el mes en curso (todavía está en proceso). Se
// recalcula solo con el paso del tiempo: en septiembre da Jun/Jul/Ago, en octubre pasa a
// Jul/Ago/Sep, etc.
function lastThreeMonths(): { year: number; month: number; label: string }[] {
  const now = new Date();
  const out: { year: number; month: number; label: string }[] = [];
  for (let i = 3; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("es-AR", { month: "long" }) });
  }
  return out;
}
function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("es-AR", { month: "long" });
}
// Los 3 meses que terminan en (year, month) inclusive — usado para cargar/editar un mes pasado
// puntual desde un calendario: ese mes elegido es el último del grupo de 3.
function threeMonthsEnding(year: number, month: number): { year: number; month: number; label: string }[] {
  const out: { year: number; month: number; label: string }[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(year, month - i, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth(), label: monthLabel(d.getFullYear(), d.getMonth()) });
  }
  return out;
}
function budgetAvg(q: BudgetQuarter, key: "fixed" | "variable" | "savings"): number {
  if (!q.months.length) return 0;
  return q.months.reduce((s, m) => s + (Number(m[key]) || 0), 0) / q.months.length;
}
function latestBudgetQuarter(quarters: BudgetQuarter[]): BudgetQuarter | null {
  if (!quarters.length) return null;
  return quarters.reduce((a, b) => (new Date(a.createdAt).getTime() > new Date(b.createdAt).getTime() ? a : b));
}
function monthQuarterMap(quarters: BudgetQuarter[]): Map<string, BudgetQuarter> {
  const sorted = [...quarters].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const map = new Map<string, BudgetQuarter>();
  sorted.forEach((q) => q.months.forEach((m) => map.set(`${m.year}-${m.month}`, q)));
  return map;
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

function PieSliceTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-md text-xs max-w-[180px]">
      <div className="font-medium text-foreground truncate">{p.name}</div>
      <div className="text-muted-foreground"><Money usd={p.value} /></div>
    </div>
  );
}

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
      <div className="flex items-start gap-2 mb-2">
        <span className="font-display text-xl font-medium"><Money usd={saved} /></span>
        {has && <span className="text-sm text-muted-foreground">/ <Money usd={goal.target} /></span>}
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
          💵 <Money usd={goal.flow.amount} /> {flowCycleLabel(goal.flow)}
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
      <div className="flex items-start gap-2 mt-3">
        <span className="font-display text-lg font-medium"><Money usd={saved} /></span>
        {has && <span className="text-sm text-muted-foreground">/ <Money usd={goal.target} /></span>}
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
                <Tooltip content={<PieSliceTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="font-display text-base font-medium"><Money usd={total} /></div>
              <div className="text-[11px] text-muted-foreground">invertido</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-3">
            {data.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-sm flex-wrap">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
                <span className="flex-1 min-w-0 truncate text-muted-foreground">{d.name}</span>
                <span className="font-semibold"><Money usd={d.value} /></span>
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
                <div className="text-sm font-semibold text-right shrink-0" style={{ color: m.color }}>
                  +<Money usd={m.amount} year={new Date(m.date).getFullYear()} month={new Date(m.date).getMonth()} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- dashboard side: budget ----------

function quarterTotalAvg(q: BudgetQuarter): number {
  return budgetAvg(q, "fixed") + budgetAvg(q, "variable") + budgetAvg(q, "savings");
}
function categoryAvg(c: BudgetCategory): number {
  if (!c.months.length) return 0;
  return c.months.reduce((s, m) => s + (Number(m.amount) || 0), 0) / c.months.length;
}

function BudgetPieSlide({
  title,
  hint,
  data,
  total,
  totalLabel,
  emptyText,
  chartLongPress,
}: {
  title: string;
  hint: string;
  data: { name: string; value: number; color: string }[];
  total: number;
  totalLabel: string;
  emptyText: string;
  chartLongPress: ReturnType<typeof useLongPress>;
}) {
  return (
    <div className="w-full shrink-0">
      <div className="pr-9">
        <div className="font-display font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
      </div>

      {data.length === 0 ? (
        <div {...chartLongPress} className="text-sm text-muted-foreground py-8 px-3 text-center mt-3 rounded-xl border border-dashed border-border cursor-pointer select-none">
          {emptyText}
        </div>
      ) : (
        <>
          <div className="relative h-[190px] mt-1 cursor-pointer select-none" {...chartLongPress}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius="66%" outerRadius="100%" paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={3}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip content={<PieSliceTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="font-display text-base font-medium"><Money usd={total} /></div>
              <div className="text-[11px] text-muted-foreground">{totalLabel}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-3">
            {data.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
                <span className="flex-1 min-w-0 truncate text-muted-foreground">{d.name}</span>
                <span className="font-semibold"><Money usd={d.value} /></span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BudgetCard({
  quarters,
  categories,
  onLongPressQuarter,
  onOpenCategoriesDetail,
  onOpenQuarterCalendar,
  onOpenCategoriesCalendar,
}: {
  quarters: BudgetQuarter[];
  categories: BudgetCategory[];
  onLongPressQuarter: () => void;
  onOpenCategoriesDetail: () => void;
  onOpenQuarterCalendar: () => void;
  onOpenCategoriesCalendar: () => void;
}) {
  const [slide, setSlide] = useState<0 | 1>(0);
  const quarterChartPress = useLongPress(onLongPressQuarter, () => {});
  const categoryChartPress = useLongPress(onOpenCategoriesDetail, () => {});

  const latest = latestBudgetQuarter(quarters);
  const quarterData = latest
    ? BUDGET_CATEGORIES.map((cat) => ({ name: cat.label, value: budgetAvg(latest, cat.key), color: cat.color })).filter((d) => d.value > 0)
    : [];
  const quarterTotal = latest ? quarterTotalAvg(latest) : 0;

  const categoryData = categories
    .map((c, i) => ({ name: c.name, value: categoryAvg(c), color: PALETTE[i % PALETTE.length] }))
    .filter((d) => d.value > 0);
  const categoryTotal = categoryData.reduce((a, d) => a + d.value, 0);

  const showCalendarBtn = slide === 0 ? !!latest : categories.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 relative">
      {showCalendarBtn && (
        <button
          onClick={() => (slide === 0 ? onOpenQuarterCalendar() : onOpenCategoriesCalendar())}
          title="Calendario anual"
          className="absolute top-4 right-4 h-7 w-7 rounded-lg border border-border text-muted-foreground hover:text-foreground flex items-center justify-center z-10"
        >
          <CalendarRange className="h-3.5 w-3.5" />
        </button>
      )}

      <div className="overflow-hidden">
        <motion.div className="flex" animate={{ x: `-${slide * 100}%` }} transition={{ type: "tween", duration: 0.25 }}>
          <BudgetPieSlide
            title="Presupuesto"
            hint="Mantené presionado el gráfico para cargarlo"
            data={quarterData}
            total={quarterTotal}
            totalLabel="presupuesto total / mes"
            emptyText="Todavía no cargaste tu presupuesto. Mantené presionado acá para empezar."
            chartLongPress={quarterChartPress}
          />
          <BudgetPieSlide
            title="Presupuesto por categorías"
            hint="Mantené presionado el gráfico para ver el detalle"
            data={categoryData}
            total={categoryTotal}
            totalLabel="promedio / mes"
            emptyText="Todavía no agregaste categorías. Mantené presionado acá para ver el detalle."
            chartLongPress={categoryChartPress}
          />
        </motion.div>
      </div>

      <div className="flex justify-center gap-1.5 mt-3">
        {[0, 1].map((i) => (
          <button
            key={i}
            onClick={() => setSlide(i as 0 | 1)}
            aria-label={`Ver gráfico ${i + 1}`}
            className="h-1.5 rounded-full transition-all"
            style={{ width: slide === i ? "18px" : "6px", background: slide === i ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground) / 0.35)" }}
          />
        ))}
      </div>
    </div>
  );
}

function BudgetCategoryRow({ category, color, onRename }: { category: BudgetCategory; color: string; onRename: () => void }) {
  const [showActions, setShowActions] = useState(false);
  const rowLongPress = useLongPress(() => setShowActions((v) => !v), () => {});
  const avg = categoryAvg(category);

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 select-none">
      <div className="flex items-center gap-2 text-sm cursor-pointer" {...rowLongPress}>
        <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: color }} />
        <span className="flex-1 min-w-0 truncate text-muted-foreground">{category.name}</span>
        <span className="font-semibold"><Money usd={avg} /></span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 pl-[18px] text-[11px] text-muted-foreground">
        {category.months.map((m, i) => (
          <span key={i} className="capitalize">
            {monthLabel(m.year, m.month).slice(0, 3)}: <Money usd={m.amount} year={m.year} month={m.month} />
          </span>
        ))}
      </div>
      {showActions && (
        <div className="flex mt-2 pt-2 border-t border-border/60">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setShowActions(false);
              onRename();
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Editar nombre
          </Button>
        </div>
      )}
    </div>
  );
}

function BudgetCategoryRenameDialog({
  category,
  open,
  onOpenChange,
  onSubmit,
}: {
  category: BudgetCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (open) {
      setName(category?.name || "");
      setErr(false);
    }
  }, [open, category]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErr(true);
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar nombre</DialogTitle>
          <DialogDescription>Los montos cargados para esta categoría no se modifican.</DialogDescription>
        </DialogHeader>
        <div>
          <label className="text-sm font-medium mb-1.5 block" htmlFor="bcat-rename">
            Nombre de la categoría
          </label>
          <Input id="bcat-rename" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Comida, Transporte" maxLength={40} autoFocus />
          {err && <p className="text-xs text-destructive mt-1">Poné un nombre para la categoría.</p>}
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave}>
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BudgetCategoriesDetailDialog({
  categories,
  open,
  onOpenChange,
  onAddCategory,
  onRenameCategory,
}: {
  categories: BudgetCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCategory: () => void;
  onRenameCategory: (category: BudgetCategory) => void;
}) {
  const titleLongPress = useLongPress(onAddCategory, () => {});
  const total = categories.reduce((a, c) => a + categoryAvg(c), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="cursor-pointer select-none inline-block" {...titleLongPress}>
            Presupuesto por categorías
          </DialogTitle>
          <DialogDescription>Mantené presionado el título para agregar una categoría nueva · mantené presionada una categoría para editar su nombre</DialogDescription>
        </DialogHeader>

        {categories.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">Todavía no agregaste categorías.</div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm pb-2 border-b border-border">
              <span className="text-muted-foreground">Promedio total</span>
              <span className="font-semibold"><Money usd={total} /></span>
            </div>
            <div className="flex flex-col gap-2">
              {categories.map((c, i) => (
                <BudgetCategoryRow key={c.id} category={c} color={PALETTE[i % PALETTE.length]} onRename={() => onRenameCategory(c)} />
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BudgetFormDialog({
  open,
  onOpenChange,
  quarter,
  months: windowMonths,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quarter: BudgetQuarter | null;
  months: { year: number; month: number; label: string }[];
  onSubmit: (data: { months: BudgetMonthEntry[] }) => void;
}) {
  const months = quarter ? quarter.months.map((m) => ({ year: m.year, month: m.month, label: monthLabel(m.year, m.month) })) : windowMonths;
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (quarter) {
      const v: Record<string, string> = {};
      quarter.months.forEach((m, idx) => {
        v[`fixed-${idx}`] = m.fixed ? moneyFormatter.format(m.fixed) : "";
        v[`variable-${idx}`] = m.variable ? moneyFormatter.format(m.variable) : "";
        v[`savings-${idx}`] = m.savings ? moneyFormatter.format(m.savings) : "";
      });
      setValues(v);
    } else {
      setValues({});
    }
  }, [open, quarter]);

  const getVal = (cat: string, idx: number) => values[`${cat}-${idx}`] || "";
  const setVal = (cat: string, idx: number, v: string) => setValues((s) => ({ ...s, [`${cat}-${idx}`]: v }));

  const handleSave = () => {
    const monthEntries: BudgetMonthEntry[] = months.map((m, idx) => ({
      year: m.year,
      month: m.month,
      fixed: parseMoney(getVal("fixed", idx)),
      variable: parseMoney(getVal("variable", idx)),
      savings: parseMoney(getVal("savings", idx)),
    }));
    onSubmit({ months: monthEntries });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quarter ? "Editar presupuesto" : "Presupuesto"}</DialogTitle>
          <DialogDescription>Cargá cuánto gastaste en cada categoría en esos 3 meses. El presupuesto total se calcula solo, como el promedio de fijos + variables + ahorro.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {BUDGET_CATEGORIES.map((cat) => (
            <div key={cat.key}>
              <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: cat.color }} />
                {cat.label}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {months.map((m, idx) => (
                  <div key={idx}>
                    <span className="text-[11px] text-muted-foreground mb-1 block capitalize truncate">{m.label}</span>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">US$</span>
                      <Input value={getVal(cat.key, idx)} onChange={(e) => setVal(cat.key, idx, e.target.value)} placeholder="0" inputMode="decimal" className="h-9 text-xs pl-8" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave}>
            Guardar presupuesto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BudgetCategoryFormDialog({
  open,
  onOpenChange,
  category,
  months: windowMonths,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: BudgetCategory | null;
  months: { year: number; month: number; label: string }[];
  onSubmit: (data: { name: string; months: BudgetCategoryMonthEntry[] }) => void;
}) {
  const months = category ? category.months.map((m) => ({ year: m.year, month: m.month, label: monthLabel(m.year, m.month) })) : windowMonths;
  const [name, setName] = useState("");
  const [values, setValues] = useState<string[]>(["", "", ""]);
  const [nameErr, setNameErr] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (category) {
      setName(category.name);
      setValues(category.months.map((m) => (m.amount ? moneyFormatter.format(m.amount) : "")));
    } else {
      setName("");
      setValues(["", "", ""]);
    }
    setNameErr(false);
  }, [open, category]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameErr(true);
      return;
    }
    const monthEntries: BudgetCategoryMonthEntry[] = months.map((m, idx) => ({ year: m.year, month: m.month, amount: parseMoney(values[idx] || "") }));
    onSubmit({ name: trimmed, months: monthEntries });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          <DialogDescription>Cargá cuánto gastaste en esta categoría en esos 3 meses. El gráfico va a mostrar el promedio.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block" htmlFor="bcat-name">
              Nombre de la categoría
            </label>
            <Input id="bcat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Comida, Transporte" maxLength={40} />
            {nameErr && <p className="text-xs text-destructive mt-1">Poné un nombre para la categoría.</p>}
          </div>
          <div>
            <span className="text-sm font-medium mb-1.5 block">Gasto por mes</span>
            <div className="grid grid-cols-3 gap-2">
              {months.map((m, idx) => (
                <div key={idx}>
                  <span className="text-[11px] text-muted-foreground mb-1 block capitalize truncate">{m.label}</span>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">US$</span>
                    <Input
                      value={values[idx]}
                      onChange={(e) => setValues((v) => v.map((x, i) => (i === idx ? e.target.value : x)))}
                      placeholder="0"
                      inputMode="decimal"
                      className="h-9 text-xs pl-8"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave}>
            Guardar categoría
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BudgetCalendarDialog({
  quarters,
  open,
  onOpenChange,
  onEditQuarter,
  onCreateForMonth,
}: {
  quarters: BudgetQuarter[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditQuarter: (quarter: BudgetQuarter) => void;
  onCreateForMonth: (year: number, month: number) => void;
}) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [selMonth, setSelMonth] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setYear(new Date().getFullYear());
      setSelMonth(null);
    }
  }, [open]);

  const map = monthQuarterMap(quarters);
  const distinctIds = Array.from(new Set(quarters.map((q) => q.id)));
  const colorForQuarter = (id: string) => PALETTE[distinctIds.indexOf(id) % PALETTE.length];

  const selQuarter = selMonth !== null ? map.get(`${year}-${selMonth}`) : undefined;
  const selMonthEntry = selQuarter?.months.find((m) => m.year === year && m.month === selMonth);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calendario de presupuesto</DialogTitle>
          <DialogDescription>Los meses del mismo color comparten la misma carga de presupuesto · tocá cualquier mes para cargarlo o editarlo</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-1">
          <button
            onClick={() => {
              setYear((y) => y - 1);
              setSelMonth(null);
            }}
            className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground flex items-center justify-center"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-display font-medium text-sm">{year}</span>
          <button
            onClick={() => {
              setYear((y) => y + 1);
              setSelMonth(null);
            }}
            className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground flex items-center justify-center"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {MONTH_NAMES.map((name, m) => {
            const q = map.get(`${year}-${m}`);
            const has = !!q;
            const color = has ? colorForQuarter(q!.id) : undefined;
            const inSelectedGroup = !!selQuarter && q?.id === selQuarter.id;
            const isSel = selMonth === m;
            return (
              <button
                key={m}
                onClick={() => setSelMonth(m)}
                className="rounded-xl border-[1.5px] py-3 text-sm font-medium flex flex-col items-center gap-1"
                style={{
                  background: has ? tint(color!, inSelectedGroup ? 34 : 22) : "hsl(var(--muted) / 0.4)",
                  borderColor: has ? color : "transparent",
                  outline: inSelectedGroup ? `2px solid ${color}` : !has && isSel ? "2px solid hsl(var(--foreground))" : undefined,
                  outlineOffset: inSelectedGroup || (!has && isSel) ? "-2px" : undefined,
                }}
              >
                {name}
                {has ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} /> : <span className="text-[11px] text-muted-foreground">—</span>}
              </button>
            );
          })}
        </div>

        {selMonth !== null &&
          (selQuarter && selMonthEntry ? (
            <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3 space-y-2">
              <div className="text-sm font-semibold">Mismo presupuesto que: {selQuarter.months.map((m) => MONTH_NAMES[m.month]).join(", ")}</div>
              {BUDGET_CATEGORIES.map((cat) => (
                <div key={cat.key} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: cat.color }} />
                    {cat.label} ({MONTH_NAMES[selMonthEntry.month]})
                  </span>
                  <span className="font-semibold"><Money usd={selMonthEntry[cat.key]} year={selMonthEntry.year} month={selMonthEntry.month} /></span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                <span className="text-muted-foreground">Presupuesto total</span>
                <span className="font-semibold"><Money usd={quarterTotalAvg(selQuarter)} /></span>
              </div>
              <Button type="button" size="sm" variant="outline" className="w-full mt-1" onClick={() => onEditQuarter(selQuarter)}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-border p-3 text-center space-y-2">
              <div className="text-sm text-muted-foreground">
                Sin presupuesto cargado para {MONTH_NAMES[selMonth]}.
              </div>
              <Button type="button" size="sm" onClick={() => onCreateForMonth(year, selMonth)}>
                <Plus className="h-3.5 w-3.5" /> Cargar presupuesto
              </Button>
            </div>
          ))}
      </DialogContent>
    </Dialog>
  );
}

interface BudgetCategoryMonthHit {
  category: BudgetCategory;
  color: string;
  amount: number;
}

function BudgetCategoriesCalendarDialog({
  categories,
  open,
  onOpenChange,
  onEditCategory,
  onCreateForMonth,
}: {
  categories: BudgetCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditCategory: (category: BudgetCategory) => void;
  onCreateForMonth: (year: number, month: number) => void;
}) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [selMonth, setSelMonth] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setYear(new Date().getFullYear());
      setSelMonth(null);
    }
  }, [open]);

  const monthMap = new Map<string, BudgetCategoryMonthHit[]>();
  categories.forEach((c, i) => {
    const color = PALETTE[i % PALETTE.length];
    c.months.forEach((m) => {
      if (!m.amount) return;
      const key = `${m.year}-${m.month}`;
      const arr = monthMap.get(key) || [];
      arr.push({ category: c, color, amount: m.amount });
      monthMap.set(key, arr);
    });
  });

  const selEntries = selMonth !== null ? monthMap.get(`${year}-${selMonth}`) || [] : [];
  const selTotal = selEntries.reduce((a, e) => a + categoryAvg(e.category), 0);
  const selCategoryIds = new Set(selEntries.map((e) => e.category.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calendario de categorías</DialogTitle>
          <DialogDescription>Meses con gasto cargado por categoría · tocá cualquier mes para agregar o editar</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-1">
          <button
            onClick={() => {
              setYear((y) => y - 1);
              setSelMonth(null);
            }}
            className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground flex items-center justify-center"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-display font-medium text-sm">{year}</span>
          <button
            onClick={() => {
              setYear((y) => y + 1);
              setSelMonth(null);
            }}
            className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground flex items-center justify-center"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {MONTH_NAMES.map((name, m) => {
            const entries = monthMap.get(`${year}-${m}`) || [];
            const has = entries.length > 0;
            const singleColor = entries.length === 1 ? entries[0].color : undefined;
            const matching = entries.filter((e) => selCategoryIds.has(e.category.id));
            const inSelectedGroup = matching.length > 0;
            const highlightColor = matching.length === 1 ? matching[0].color : undefined;
            return (
              <button
                key={m}
                onClick={() => setSelMonth(m)}
                className="rounded-xl border-[1.5px] py-3 text-sm font-medium flex flex-col items-center gap-1.5"
                style={{
                  background: singleColor ? tint(singleColor, inSelectedGroup ? 34 : 22) : has ? "hsl(var(--muted) / 0.6)" : "hsl(var(--muted) / 0.4)",
                  borderColor: singleColor || "transparent",
                  outline: inSelectedGroup ? `2px solid ${highlightColor || "hsl(var(--foreground))"}` : !has && selMonth === m ? "2px solid hsl(var(--foreground))" : undefined,
                  outlineOffset: inSelectedGroup || (!has && selMonth === m) ? "-2px" : undefined,
                }}
              >
                {name}
                {has ? (
                  <span className="flex items-center gap-0.5">
                    {entries.slice(0, 4).map((e, i) => (
                      <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: e.color }} />
                    ))}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">—</span>
                )}
              </button>
            );
          })}
        </div>

        {selMonth !== null && (
          <div className="mt-3 space-y-2">
            {selEntries.map((e, i) => (
              <div key={i} className="rounded-xl border border-border bg-muted/40 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: e.color }} />
                  {e.category.name}
                </div>
                <div className="text-xs text-muted-foreground">Mismo presupuesto que: {e.category.months.map((m) => MONTH_NAMES[m.month]).join(", ")}</div>
                <div className="flex items-center justify-between text-sm pt-1 border-t border-border/60">
                  <span className="text-muted-foreground">Promedio de 3 meses</span>
                  <span className="font-semibold"><Money usd={categoryAvg(e.category)} /></span>
                </div>
                <Button type="button" size="sm" variant="outline" className="w-full mt-1" onClick={() => onEditCategory(e.category)}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
              </div>
            ))}
            {selEntries.length > 1 && (
              <div className="flex items-center justify-between text-sm px-1">
                <span className="text-muted-foreground">Total promedio</span>
                <span className="font-semibold"><Money usd={selTotal} /></span>
              </div>
            )}
            {selEntries.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-2">Sin categorías cargadas para {MONTH_NAMES[selMonth]}.</div>
            )}
            <Button type="button" size="sm" variant="ghost" className="w-full" onClick={() => onCreateForMonth(year, selMonth)}>
              <Plus className="h-3.5 w-3.5" /> Agregar categoría
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- dollar rate ----------

function latestDollarRate(rates: DollarRate[]): DollarRate | null {
  if (!rates.length) return null;
  return rates.reduce((a, b) => (a.year * 12 + a.month > b.year * 12 + b.month ? a : b));
}

function DollarSubtitle({ rates, onLongPress }: { rates: DollarRate[]; onLongPress: () => void }) {
  const longPress = useLongPress(onLongPress, () => {});
  const latest = latestDollarRate(rates);

  return (
    <p className="text-xs text-muted-foreground mt-0.5 cursor-pointer select-none inline-block" {...longPress}>
      {latest ? (
        <>
          Dólar: <span className="font-medium text-foreground">{money(latest.rate)}</span> · {monthLabel(latest.year, latest.month)} {latest.year}
        </>
      ) : (
        "Mantené presionado para cargar la cotización del dólar"
      )}
    </p>
  );
}

function DollarActionSheet({
  open,
  onOpenChange,
  onEdit,
  onOpenCalendar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onOpenCalendar: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[280px] p-2">
        <DialogTitle className="sr-only">Cotización del dólar</DialogTitle>
        <DialogDescription className="sr-only">Editar la cotización del dólar o abrir su calendario</DialogDescription>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => {
              onOpenChange(false);
              onEdit();
            }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-left"
          >
            <Pencil className="h-4 w-4" /> Editar cotización
          </button>
          <button
            onClick={() => {
              onOpenChange(false);
              onOpenCalendar();
            }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-left"
          >
            <CalendarRange className="h-4 w-4" /> Abrir calendario
          </button>
          <button onClick={() => onOpenChange(false)} className="px-3 py-2.5 rounded-lg text-sm text-muted-foreground text-center hover:bg-muted">
            Cancelar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DollarRateFormDialog({
  open,
  onOpenChange,
  target,
  rates,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: { year: number; month: number };
  rates: DollarRate[];
  onSubmit: (data: { year: number; month: number; rate: number }) => void;
}) {
  const [text, setText] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!open) return;
    const existing = rates.find((r) => r.year === target.year && r.month === target.month);
    setText(existing ? moneyFormatter.format(existing.rate) : "");
    setErr(false);
  }, [open, target.year, target.month]);

  const handleSave = () => {
    const n = parseMoney(text);
    if (n <= 0) {
      setErr(true);
      return;
    }
    onSubmit({ year: target.year, month: target.month, rate: n });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="capitalize">
            Dólar de {monthLabel(target.year, target.month)} {target.year}
          </DialogTitle>
          <DialogDescription>Se usa para mostrar el equivalente en pesos de los montos en dólares de ese mes.</DialogDescription>
        </DialogHeader>
        <div>
          <label className="text-sm font-medium mb-1.5 block" htmlFor="dr-rate">
            Precio del dólar (ARS)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input id="dr-rate" className="pl-6" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} placeholder="0" autoFocus />
          </div>
          {err && <p className="text-xs text-destructive mt-1">Ingresá un valor mayor a 0.</p>}
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave}>
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DollarCalendarDialog({
  rates,
  open,
  onOpenChange,
  onEditMonth,
}: {
  rates: DollarRate[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditMonth: (year: number, month: number) => void;
}) {
  const [year, setYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    if (open) setYear(new Date().getFullYear());
  }, [open]);

  const map = new Map<string, number>();
  rates.forEach((r) => map.set(`${r.year}-${r.month}`, r.rate));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calendario del dólar</DialogTitle>
          <DialogDescription>Tocá un mes para cargar o editar su cotización</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-1">
          <button onClick={() => setYear((y) => y - 1)} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground flex items-center justify-center">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-display font-medium text-sm">{year}</span>
          <button onClick={() => setYear((y) => y + 1)} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground flex items-center justify-center">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {MONTH_NAMES.map((name, m) => {
            const rate = map.get(`${year}-${m}`);
            return (
              <button
                key={m}
                onClick={() => onEditMonth(year, m)}
                className="rounded-xl border-[1.5px] py-3 text-sm font-medium flex flex-col items-center gap-1"
                style={{
                  background: rate ? tint(PALETTE[0], 22) : "hsl(var(--muted) / 0.4)",
                  borderColor: rate ? PALETTE[0] : "transparent",
                }}
              >
                {name}
                {rate ? <span className="text-[11px] font-semibold tabular-nums">{money(rate)}</span> : <span className="text-[11px] text-muted-foreground">—</span>}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
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
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">US$</span>
              <Input id="fg-target" className="pl-10" inputMode="decimal" value={targetText} onChange={(e) => setTargetText(e.target.value)} placeholder="Sin objetivo fijo" />
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
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">US$</span>
                    <Input
                      value={h.amountText}
                      onChange={(e) => updateHoldingRow(h.id, { amountText: e.target.value })}
                      placeholder="0"
                      inputMode="decimal"
                      className="h-9 text-xs pl-8"
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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">US$</span>
                  <Input className="pl-10" inputMode="decimal" value={flowAmountText} onChange={(e) => setFlowAmountText(e.target.value)} placeholder="0" />
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
              <DialogDescription>
                {has ? (
                  <>
                    <Money usd={saved} /> de <Money usd={target} /> · {pct}% alcanzado
                  </>
                ) : (
                  <>
                    <Money usd={saved} /> · sin objetivo definido
                  </>
                )}
              </DialogDescription>
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
            <div className="font-display text-xl font-medium mt-1"><Money usd={saved} /></div>
            <div className="text-xs text-muted-foreground mt-0.5">{has ? `${Math.min(100, pct)}% del objetivo` : "ahorro acumulado"}</div>
          </div>
          <div className="rounded-xl bg-muted/50 border border-border p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-muted-foreground/30" />
              Falta
            </div>
            <div className="font-display text-xl font-medium mt-1">{has ? <Money usd={miss} /> : "—"}</div>
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
                  <Tooltip content={<PieSliceTooltip />} />
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
                  <span className="font-semibold"><Money usd={s.value} /></span>
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
                <span className="font-display text-base font-medium"><Money usd={mf} /></span>
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
                  Agregar <Money usd={mf} />
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
  const rates = useDollarRates();

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
        title={has ? moneyPairText(amt, rates, year, month) : undefined}
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
              Aportaste <b className="text-foreground font-semibold"><Money usd={monthTotal} year={year} month={month} /></b> en {daysWith} {daysWith === 1 ? "día" : "días"} este mes.
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
                    <div className="text-sm font-semibold text-right shrink-0" style={{ color: goal.color }}>
                      +<Money usd={h.amount} year={new Date(h.date).getFullYear()} month={new Date(h.date).getMonth()} />
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
  const [budgetFormOpen, setBudgetFormOpen] = useState(false);
  const [budgetFormTarget, setBudgetFormTarget] = useState<BudgetQuarter | null>(null);
  const [budgetFormMonths, setBudgetFormMonths] = useState(() => lastThreeMonths());
  const [budgetCategoriesDetailOpen, setBudgetCategoriesDetailOpen] = useState(false);
  const [budgetCategoryFormOpen, setBudgetCategoryFormOpen] = useState(false);
  const [budgetCategoryFormTarget, setBudgetCategoryFormTarget] = useState<BudgetCategory | null>(null);
  const [budgetCategoryFormMonths, setBudgetCategoryFormMonths] = useState(() => lastThreeMonths());
  const [budgetRenameOpen, setBudgetRenameOpen] = useState(false);
  const [renamingBudgetCategory, setRenamingBudgetCategory] = useState<BudgetCategory | null>(null);
  const [budgetCalendarOpen, setBudgetCalendarOpen] = useState(false);
  const [budgetCategoriesCalendarOpen, setBudgetCategoriesCalendarOpen] = useState(false);
  const [dollarActionSheetOpen, setDollarActionSheetOpen] = useState(false);
  const [dollarFormOpen, setDollarFormOpen] = useState(false);
  const [dollarCalendarOpen, setDollarCalendarOpen] = useState(false);
  const [dollarTarget, setDollarTarget] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const { data: dollarRates = [] } = useQuery<DollarRate[]>({
    queryKey: ["/api/dollar-rates"],
    queryFn: async () => {
      const res = await fetch("/api/dollar-rates");
      if (!res.ok) throw new Error("Failed to fetch dollar rates");
      return res.json();
    },
  });

  const createDollarRate = useMutation({
    mutationFn: async (data: { year: number; month: number; rate: number }) => {
      const res = await fetch("/api/dollar-rates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed to create dollar rate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dollar-rates"] });
      setDollarFormOpen(false);
    },
  });

  const updateDollarRate = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { rate: number } }) => {
      const res = await fetch(`/api/dollar-rates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed to update dollar rate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dollar-rates"] });
      setDollarFormOpen(false);
    },
  });

  const openDollarEdit = (year: number, month: number) => {
    setDollarTarget({ year, month });
    setDollarCalendarOpen(false);
    setDollarFormOpen(true);
  };

  const handleDollarSubmit = (data: { year: number; month: number; rate: number }) => {
    const existing = dollarRates.find((r) => r.year === data.year && r.month === data.month);
    if (existing) {
      updateDollarRate.mutate({ id: existing.id, data: { rate: data.rate } });
    } else {
      createDollarRate.mutate(data);
    }
  };

  const { data: goals = [], isLoading } = useQuery<FinancialGoal[]>({
    queryKey: ["/api/financial-goals"],
    queryFn: async () => {
      const res = await fetch("/api/financial-goals");
      if (!res.ok) throw new Error("Failed to fetch financial goals");
      return res.json();
    },
  });

  const { data: budgetQuarters = [] } = useQuery<BudgetQuarter[]>({
    queryKey: ["/api/budget-quarters"],
    queryFn: async () => {
      const res = await fetch("/api/budget-quarters");
      if (!res.ok) throw new Error("Failed to fetch budget quarters");
      return res.json();
    },
  });

  const createBudgetQuarter = useMutation({
    mutationFn: async (data: { months: BudgetMonthEntry[] }) => {
      const res = await fetch("/api/budget-quarters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed to create budget quarter");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-quarters"] });
      setBudgetFormOpen(false);
    },
  });

  const updateBudgetQuarter = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { months: BudgetMonthEntry[] } }) => {
      const res = await fetch(`/api/budget-quarters/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed to update budget quarter");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-quarters"] });
      setBudgetFormOpen(false);
      setBudgetFormTarget(null);
    },
  });

  const openBudgetCreate = () => {
    setBudgetFormTarget(null);
    setBudgetFormMonths(lastThreeMonths());
    setBudgetFormOpen(true);
  };
  const openBudgetEditQuarter = (quarter: BudgetQuarter) => {
    setBudgetFormTarget(quarter);
    setBudgetCalendarOpen(false);
    setBudgetFormOpen(true);
  };
  const openBudgetCreateForMonth = (year: number, month: number) => {
    setBudgetFormTarget(null);
    setBudgetFormMonths(threeMonthsEnding(year, month));
    setBudgetCalendarOpen(false);
    setBudgetFormOpen(true);
  };
  const handleBudgetFormSubmit = (data: { months: BudgetMonthEntry[] }) => {
    if (budgetFormTarget) {
      updateBudgetQuarter.mutate({ id: budgetFormTarget.id, data });
    } else {
      createBudgetQuarter.mutate(data);
    }
  };

  const { data: budgetCategories = [] } = useQuery<BudgetCategory[]>({
    queryKey: ["/api/budget-categories"],
    queryFn: async () => {
      const res = await fetch("/api/budget-categories");
      if (!res.ok) throw new Error("Failed to fetch budget categories");
      return res.json();
    },
  });

  const createBudgetCategory = useMutation({
    mutationFn: async (data: { name: string; months: BudgetCategoryMonthEntry[] }) => {
      const res = await fetch("/api/budget-categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed to create budget category");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-categories"] });
      setBudgetCategoryFormOpen(false);
    },
  });

  const updateBudgetCategory = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; months?: BudgetCategoryMonthEntry[] } }) => {
      const res = await fetch(`/api/budget-categories/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed to update budget category");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-categories"] });
      setBudgetCategoryFormOpen(false);
      setBudgetCategoryFormTarget(null);
      setBudgetRenameOpen(false);
      setRenamingBudgetCategory(null);
    },
  });

  const openBudgetCategoryCreate = () => {
    setBudgetCategoryFormTarget(null);
    setBudgetCategoryFormMonths(lastThreeMonths());
    setBudgetCategoriesDetailOpen(false);
    setBudgetCategoryFormOpen(true);
  };
  const openBudgetCategoryRename = (category: BudgetCategory) => {
    setRenamingBudgetCategory(category);
    setBudgetCategoriesDetailOpen(false);
    setBudgetRenameOpen(true);
  };
  const openBudgetCategoryEditFull = (category: BudgetCategory) => {
    setBudgetCategoryFormTarget(category);
    setBudgetCategoriesCalendarOpen(false);
    setBudgetCategoryFormOpen(true);
  };
  const openBudgetCategoryCreateForMonth = (year: number, month: number) => {
    setBudgetCategoryFormTarget(null);
    setBudgetCategoryFormMonths(threeMonthsEnding(year, month));
    setBudgetCategoriesCalendarOpen(false);
    setBudgetCategoryFormOpen(true);
  };

  const handleBudgetCategorySubmit = (data: { name: string; months: BudgetCategoryMonthEntry[] }) => {
    if (budgetCategoryFormTarget) {
      updateBudgetCategory.mutate({ id: budgetCategoryFormTarget.id, data });
      return;
    }
    const existing = budgetCategories.find((c) => c.name.trim().toLowerCase() === data.name.trim().toLowerCase());
    if (existing) {
      updateBudgetCategory.mutate({ id: existing.id, data: { months: data.months } });
    } else {
      createBudgetCategory.mutate(data);
    }
  };

  const handleBudgetCategoryRename = (name: string) => {
    if (!renamingBudgetCategory) return;
    updateBudgetCategory.mutate({ id: renamingBudgetCategory.id, data: { name } });
  };

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
    toast({ title: `+${moneyPairText(mf, dollarRates)} en ${holding.instrument}` });
  };

  const titleLongPress = useLongPress(
    openCreate,
    () => toast({ title: "Mantené presionado el título para crear una meta" })
  );

  return (
    <DollarRatesContext.Provider value={dollarRates}>
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-5 pt-4 pb-3 border-b border-border/60">
        <h2 className="font-display font-semibold text-lg cursor-pointer select-none inline-block" {...titleLongPress}>
          Metas financieras
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Mantené presionado el título para crear una meta</p>
        <DollarSubtitle rates={dollarRates} onLongPress={() => setDollarActionSheetOpen(true)} />
      </div>

      <div className="px-5 pt-3 flex items-center justify-between gap-3">
        <div className="inline-flex bg-muted rounded-xl p-1 gap-1">
          <button onClick={() => setView("preview")} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === "preview" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
            Objetivos
          </button>
          <button onClick={() => setView("dashboard")} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === "dashboard" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
            Panel
          </button>
        </div>
        <p className="text-xs text-muted-foreground hidden sm:block">Tocá una meta para ver el detalle · mantené presionada para editar</p>
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
              <div className="font-display text-3xl font-medium mt-1"><Money usd={totalSaved} /></div>
              <div className="text-sm text-muted-foreground mt-1">de <Money usd={totalTarget} /> en objetivos</div>
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
                <BudgetCard
                  quarters={budgetQuarters}
                  categories={budgetCategories}
                  onLongPressQuarter={openBudgetCreate}
                  onOpenCategoriesDetail={() => setBudgetCategoriesDetailOpen(true)}
                  onOpenQuarterCalendar={() => setBudgetCalendarOpen(true)}
                  onOpenCategoriesCalendar={() => setBudgetCategoriesCalendarOpen(true)}
                />
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
      <BudgetFormDialog
        open={budgetFormOpen}
        onOpenChange={(v) => {
          setBudgetFormOpen(v);
          if (!v) setBudgetFormTarget(null);
        }}
        quarter={budgetFormTarget}
        months={budgetFormMonths}
        onSubmit={handleBudgetFormSubmit}
      />
      <BudgetCategoriesDetailDialog
        categories={budgetCategories}
        open={budgetCategoriesDetailOpen}
        onOpenChange={setBudgetCategoriesDetailOpen}
        onAddCategory={openBudgetCategoryCreate}
        onRenameCategory={openBudgetCategoryRename}
      />
      <BudgetCategoryFormDialog
        open={budgetCategoryFormOpen}
        onOpenChange={(v) => {
          setBudgetCategoryFormOpen(v);
          if (!v) setBudgetCategoryFormTarget(null);
        }}
        category={budgetCategoryFormTarget}
        months={budgetCategoryFormMonths}
        onSubmit={handleBudgetCategorySubmit}
      />
      <BudgetCategoryRenameDialog
        category={renamingBudgetCategory}
        open={budgetRenameOpen}
        onOpenChange={(v) => {
          setBudgetRenameOpen(v);
          if (!v) setRenamingBudgetCategory(null);
        }}
        onSubmit={handleBudgetCategoryRename}
      />
      <BudgetCalendarDialog
        quarters={budgetQuarters}
        open={budgetCalendarOpen}
        onOpenChange={setBudgetCalendarOpen}
        onEditQuarter={openBudgetEditQuarter}
        onCreateForMonth={openBudgetCreateForMonth}
      />
      <BudgetCategoriesCalendarDialog
        categories={budgetCategories}
        open={budgetCategoriesCalendarOpen}
        onOpenChange={setBudgetCategoriesCalendarOpen}
        onEditCategory={openBudgetCategoryEditFull}
        onCreateForMonth={openBudgetCategoryCreateForMonth}
      />
      <DollarActionSheet
        open={dollarActionSheetOpen}
        onOpenChange={setDollarActionSheetOpen}
        onEdit={() => {
          const d = new Date();
          setDollarTarget({ year: d.getFullYear(), month: d.getMonth() });
          setDollarFormOpen(true);
        }}
        onOpenCalendar={() => setDollarCalendarOpen(true)}
      />
      <DollarRateFormDialog open={dollarFormOpen} onOpenChange={setDollarFormOpen} target={dollarTarget} rates={dollarRates} onSubmit={handleDollarSubmit} />
      <DollarCalendarDialog rates={dollarRates} open={dollarCalendarOpen} onOpenChange={setDollarCalendarOpen} onEditMonth={openDollarEdit} />
    </div>
    </DollarRatesContext.Provider>
  );
}
