import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ArrowLeft, Plus, Check, RotateCcw, Trash2, Coffee, UtensilsCrossed, Cookie, Moon, Beef, Carrot, Wheat, Apple, GlassWater, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MealTrackerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type MealKind = "main" | "light";

interface DishComponent {
  categoryKey: string;
  item: string;
}
interface Dish {
  id: string;
  mealKind: MealKind;
  name: string;
  components: DishComponent[];
}
// Categorías que un plato puede combinar. Se intersecan con las categorías reales de cada
// comida: en las principales da proteína/vegetales/carbo, en las livianas proteína/carbo.
const DISH_CAT_KEYS = ["proteina", "vegetales", "carbos"];

interface CatDef {
  key: string;
  label: string;
  icon: typeof Beef;
  color: string;
  optional?: boolean;
  items: string[];
}

interface MealDef {
  id: string;
  label: string;
  kind: MealKind;
  icon: typeof Coffee;
  startHour: number;
  startLabel: string;
  cats: CatDef[];
}

const CATS_MAIN: CatDef[] = [
  { key: "proteina", label: "Proteína", icon: Beef, color: "#D9663F", items: ["Carne", "Pollo", "Pescado", "Huevo", "Atún", "Legumbres", "Queso"] },
  { key: "vegetales", label: "Vegetales", icon: Carrot, color: "#4CA862", items: ["Ensalada", "Verduras cocidas", "Verduras salteadas", "Sopa"] },
  { key: "carbos", label: "Carbohidrato", icon: Wheat, color: "#E8A93C", items: ["Arroz", "Fideos", "Papa", "Batata", "Polenta", "Pan"] },
  { key: "fruta", label: "Fruta", icon: Apple, color: "#E4572E", optional: true, items: ["Manzana", "Banana", "Naranja", "Pera"] },
  { key: "agua", label: "Agua", icon: GlassWater, color: "#4FA3D1", optional: true, items: ["Vaso de agua"] },
];
const CATS_LIGHT: CatDef[] = [
  { key: "bebida", label: "Bebida", icon: Coffee, color: "#8B6B4A", items: ["Mate", "Mate cocido", "Café", "Capuccino"] },
  { key: "proteina", label: "Proteína", icon: Beef, color: "#D9A441", items: ["Yogur", "Leche", "Queso", "Huevo"] },
  { key: "carbos", label: "Carbohidrato", icon: Wheat, color: "#E8A93C", items: ["Pan", "Avena", "Granola", "Tostadas", "Cereales"] },
  { key: "fruta", label: "Fruta", icon: Apple, color: "#E4572E", optional: true, items: ["Banana", "Manzana", "Naranja", "Pera"] },
  { key: "extra", label: "Extra", icon: Plus, color: "#A9743F", optional: true, items: ["Frutos secos", "Semillas", "Pasta de maní"] },
  { key: "agua", label: "Agua", icon: GlassWater, color: "#4FA3D1", optional: true, items: ["Vaso de agua"] },
];
const MEALS: MealDef[] = [
  { id: "desayuno", label: "Desayuno", kind: "light", icon: Coffee, startHour: 6, startLabel: "06:00", cats: CATS_LIGHT },
  { id: "almuerzo", label: "Almuerzo", kind: "main", icon: UtensilsCrossed, startHour: 11, startLabel: "11:00", cats: CATS_MAIN },
  { id: "merienda", label: "Merienda", kind: "light", icon: Cookie, startHour: 15, startLabel: "15:00", cats: CATS_LIGHT },
  { id: "cena", label: "Cena", kind: "main", icon: Moon, startHour: 20, startLabel: "20:00", cats: CATS_MAIN },
];
const NEEDS = [
  { key: "proteina", label: "Proteína", icon: Beef },
  { key: "vegetales", label: "Vegetales", icon: Carrot },
  { key: "carbos", label: "Carbohidrato", icon: Wheat },
  { key: "fruta", label: "Fruta", icon: Apple },
];

type MealsState = Record<string, Record<string, Record<string, boolean>>>;

interface DayData {
  date: string;
  meals: MealsState;
  regCelebrated: Record<string, boolean>;
  celebrated: boolean;
  streak: number;
}

function getLocalDateString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function currentMealIndex(): number {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return 0;
  if (h >= 11 && h < 15) return 1;
  if (h >= 15 && h < 20) return 2;
  return 3;
}

function catOn(meals: MealsState, mealId: string, catKey: string): boolean {
  const cat = meals?.[mealId]?.[catKey];
  return cat ? Object.values(cat).some(Boolean) : false;
}

function mealRegistered(meals: MealsState, meal: MealDef): boolean {
  return meal.cats.some((c) => catOn(meals, meal.id, c.key));
}

function mealDone(meals: MealsState, meal: MealDef): boolean {
  return meal.cats.filter((c) => !c.optional).every((c) => catOn(meals, meal.id, c.key));
}

function dayNutrients(meals: MealsState) {
  return {
    proteina: MEALS.some((m) => catOn(meals, m.id, "proteina")),
    vegetales: catOn(meals, "almuerzo", "vegetales") || catOn(meals, "cena", "vegetales"),
    carbos: MEALS.some((m) => catOn(meals, m.id, "carbos")),
    fruta: MEALS.some((m) => catOn(meals, m.id, "fruta")),
  };
}

function coreComplete(meals: MealsState): boolean {
  const n = dayNutrients(meals);
  return n.proteina && n.vegetales && n.carbos && n.fruta;
}

// ── Calendario de comidas ──────────────────────────────────────────────────
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DAY_LBLS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
// Un color por comida, para los puntitos de cada día del calendario.
const MEAL_DOT_COLORS: Record<string, string> = {
  desayuno: "#8B6B4A",
  almuerzo: "#D9663F",
  merienda: "#E8A93C",
  cena: "#185FA5",
};

// Lunes = 0 … Domingo = 6, para el offset del primer día del mes en la grilla.
function getFirstDayOfMonth(date: Date) {
  const firstDow = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  return firstDow === 0 ? 6 : firstDow - 1;
}

// Ítems tildados de una comida en un día (para el detalle del calendario).
function mealCheckedItems(meals: MealsState, meal: MealDef): string[] {
  const items: string[] = [];
  meal.cats.forEach((c) => {
    const catObj = meals?.[meal.id]?.[c.key] || {};
    Object.entries(catObj).forEach(([item, on]) => {
      if (on) items.push(item);
    });
  });
  return items;
}

interface RangeDay {
  date: string;
  meals: MealsState;
  celebrated: boolean;
}

// Colores base "sin marcar", theme-aware vía tokens de la app; las cuñas/objetos toman su
// color de categoría (fijo, igual en claro/oscuro) apenas se tilda algo, igual que el plato del
// mi-dia.html original.
const PLATE_OFF = "hsl(var(--muted-foreground) / 0.28)";
const PLATE_SEP = "hsl(var(--background))";
const PLATE_RIM = "hsl(var(--border))";

function plateWedges(cx: number, cy: number, r: number, half?: string, q1?: string, q2?: string) {
  return (
    <>
      <path d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} Z`} fill={half || PLATE_OFF} stroke={PLATE_SEP} strokeWidth={1.8} />
      <path d={`M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx + r} ${cy} Z`} fill={q1 || PLATE_OFF} stroke={PLATE_SEP} strokeWidth={1.8} />
      <path d={`M ${cx} ${cy} L ${cx + r} ${cy} A ${r} ${r} 0 0 1 ${cx} ${cy + r} Z`} fill={q2 || PLATE_OFF} stroke={PLATE_SEP} strokeWidth={1.8} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={PLATE_RIM} strokeWidth={2.5} />
    </>
  );
}

function plateCup(cx: number, cy: number, on: boolean, color?: string) {
  const c = on ? color : PLATE_OFF;
  const x = cx - 10, y = cy - 9;
  return (
    <g>
      <path d={`M${x} ${y} h20 v11 a7 7 0 0 1 -7 7 h-6 a7 7 0 0 1 -7 -7 Z`} fill={c} />
      <path d={`M${x + 20} ${y + 2} h5 a6 6 0 0 1 0 11 h-5`} fill="none" stroke={c} strokeWidth={3.4} />
      <ellipse cx={x + 10} cy={y} rx={10} ry={2.7} fill={on ? "#6E5238" : PLATE_RIM} />
    </g>
  );
}

function plateFruit(cx: number, cy: number, on: boolean, color?: string, r = 11) {
  return (
    <g opacity={on ? 1 : 0.6}>
      <circle cx={cx} cy={cy} r={r} fill={on ? color : PLATE_OFF} />
      <path d={`M${cx} ${cy - r} q3.4 -5 7.6 -3.7 q-2.6 3.9 -7.6 3.7Z`} fill={on ? "#4CA862" : PLATE_RIM} />
    </g>
  );
}

function plateWater(cx: number, cy: number, on: boolean) {
  const h = 14, topW = 9, botW = 7;
  const x1 = cx - topW, x2 = cx + topW, x3 = cx + botW, x4 = cx - botW, yT = cy - h, yB = cy + h;
  const wyT = cy - h * 0.4, t = (wyT - yT) / (yB - yT);
  const wxL = (x1 + (x4 - x1) * t).toFixed(1), wxR = (x2 + (x3 - x2) * t).toFixed(1);
  const glass = on ? "#BFE3F5" : PLATE_OFF, rim = on ? "#6FB8DE" : PLATE_RIM, water = on ? "#5EA8D6" : PLATE_OFF;
  return (
    <g opacity={on ? 1 : 0.6}>
      <path d={`M${x1} ${yT} L${x2} ${yT} L${x3} ${yB} L${x4} ${yB} Z`} fill={glass} stroke={rim} strokeWidth={1.7} />
      <path d={`M${wxL} ${wyT.toFixed(1)} L${wxR} ${wyT.toFixed(1)} L${x3} ${yB} L${x4} ${yB} Z`} fill={water} />
    </g>
  );
}

// Plato visual de la comida: las cuñas y los objetos (agua/fruta/mate) se pintan de su color de
// categoría apenas hay algo tildado ahí, así el círculo funciona como indicador de progreso.
function MealPlateIcon({ meal, meals, locked }: { meal: MealDef; meals: MealsState; locked: boolean }) {
  const on = (catKey: string) => catOn(meals, meal.id, catKey);
  const colorFor = (catKey: string) => meal.cats.find((c) => c.key === catKey)?.color;

  return (
    <svg viewBox="0 0 100 100" className={`w-full h-full transition-opacity ${locked ? "opacity-40" : ""}`} role="img" aria-label={meal.label}>
      {meal.kind === "main" ? (
        <>
          {plateWedges(50, 42, 30, on("vegetales") ? colorFor("vegetales") : undefined, on("proteina") ? colorFor("proteina") : undefined, on("carbos") ? colorFor("carbos") : undefined)}
          {plateWater(40, 85, on("agua"))}
          {plateFruit(62, 84, on("fruta"), colorFor("fruta"))}
        </>
      ) : (
        <>
          {plateWedges(50, 40, 28, on("carbos") ? colorFor("carbos") : undefined, on("proteina") ? colorFor("proteina") : undefined, on("extra") ? colorFor("extra") : undefined)}
          {plateCup(24, 82, on("bebida"), colorFor("bebida"))}
          {plateWater(50, 84, on("agua"))}
          {plateFruit(76, 83, on("fruta"), colorFor("fruta"))}
        </>
      )}
    </svg>
  );
}

async function fetchJson(url: string, opts?: RequestInit) {
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export function MealTrackerModal({ open, onOpenChange }: MealTrackerModalProps) {
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<"day" | "meal" | "add" | "add-dish" | "summary" | "calendar">("day");
  const [activeMealId, setActiveMealId] = useState<string | null>(null);
  const [addCatKey, setAddCatKey] = useState<string | null>(null);
  const [addValue, setAddValue] = useState("");
  const [notification, setNotification] = useState<string | null>(null);
  const today = useMemo(() => getLocalDateString(), []);

  const { data: day } = useQuery<DayData>({
    queryKey: ["/api/meal-tracker/today", today],
    queryFn: () => fetchJson(`/api/meal-tracker/today?date=${today}`),
    enabled: open,
  });

  const { data: customOptions = {} } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/meal-tracker/custom-options"],
    queryFn: () => fetchJson("/api/meal-tracker/custom-options"),
    enabled: open,
  });

  const { data: dishes = [] } = useQuery<Dish[]>({
    queryKey: ["/api/meal-tracker/dishes"],
    queryFn: () => fetchJson("/api/meal-tracker/dishes"),
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setPanel("day");
      setActiveMealId(null);
      setAddCatKey(null);
      setAddValue("");
    }
  }, [open]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 2200);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const meals: MealsState = day?.meals || {};
  const activeMeal = MEALS.find((m) => m.id === activeMealId) || null;
  const curIdx = currentMealIndex();

  const toggleItem = async (meal: MealDef, catKey: string, item: string) => {
    const updated = await fetchJson("/api/meal-tracker/toggle", {
      method: "POST",
      body: JSON.stringify({ date: today, mealId: meal.id, categoryKey: catKey, item }),
    });
    queryClient.setQueryData(["/api/meal-tracker/today", today], (prev: DayData | undefined) => ({
      ...(prev as DayData),
      meals: updated.meals,
    }));
  };

  const submitAdd = async () => {
    const name = addValue.trim();
    if (!name || !activeMeal || !addCatKey) return;
    const result = await fetchJson("/api/meal-tracker/custom-option", {
      method: "POST",
      body: JSON.stringify({ date: today, mealId: activeMeal.id, mealKind: activeMeal.kind, categoryKey: addCatKey, name }),
    });
    queryClient.setQueryData(["/api/meal-tracker/today", today], (prev: DayData | undefined) => ({
      ...(prev as DayData),
      meals: result.day.meals,
    }));
    queryClient.setQueryData(["/api/meal-tracker/custom-options"], result.customOptions);
    setAddValue("");
    setPanel("meal");
    setNotification(`Agregado: ${name}`);
  };

  // Confirmar/des-confirmar un plato: tilda o destilda de una todos sus componentes linkeados.
  const applyDish = async (meal: MealDef, dish: Dish, active: boolean) => {
    const updated = await fetchJson("/api/meal-tracker/apply-dish", {
      method: "POST",
      body: JSON.stringify({ date: today, mealId: meal.id, components: dish.components, active }),
    });
    queryClient.setQueryData(["/api/meal-tracker/today", today], (prev: DayData | undefined) => ({
      ...(prev as DayData),
      meals: updated.meals,
    }));
  };

  const submitDish = async (name: string, components: DishComponent[]) => {
    if (!activeMeal) return;
    const result = await fetchJson("/api/meal-tracker/dish", {
      method: "POST",
      body: JSON.stringify({ mealKind: activeMeal.kind, name, components }),
    });
    queryClient.setQueryData(["/api/meal-tracker/dishes"], result.dishes);
    setPanel("meal");
    setNotification(`Plato agregado: ${name}`);
  };

  const deleteDish = async (dish: Dish) => {
    const result = await fetchJson("/api/meal-tracker/dish", {
      method: "DELETE",
      body: JSON.stringify({ id: dish.id }),
    });
    queryClient.setQueryData(["/api/meal-tracker/dishes"], result.dishes);
    setNotification(`Plato eliminado: ${dish.name}`);
  };

  const closeMealPanel = async () => {
    if (!activeMeal || !day) {
      setPanel("day");
      return;
    }
    const nowRegistered = mealRegistered(meals, activeMeal);
    if (nowRegistered && !day.regCelebrated?.[activeMeal.id]) {
      await fetchJson("/api/meal-tracker/mark-registered", {
        method: "POST",
        body: JSON.stringify({ date: today, mealId: activeMeal.id }),
      });
      setNotification(`¡Registraste tu ${activeMeal.label.toLowerCase()}! 🌱`);
    }
    if (coreComplete(meals) && !day.celebrated) {
      const result = await fetchJson("/api/meal-tracker/complete-day", {
        method: "POST",
        body: JSON.stringify({ date: today }),
      });
      if (result.celebrated) {
        setNotification(`¡Día completo! 🎉 Racha: ${result.streak} días`);
        queryClient.setQueryData(["/api/meal-tracker/today", today], (prev: DayData | undefined) => ({
          ...(prev as DayData),
          celebrated: true,
          streak: result.streak,
        }));
      }
    }
    setPanel("day");
    setActiveMealId(null);
  };

  const deleteCustomOption = async (catKey: string, item: string) => {
    if (!activeMeal) return;
    const result = await fetchJson("/api/meal-tracker/custom-option", {
      method: "DELETE",
      body: JSON.stringify({ date: today, mealKind: activeMeal.kind, categoryKey: catKey, name: item }),
    });
    queryClient.setQueryData(["/api/meal-tracker/today", today], (prev: DayData | undefined) => ({
      ...(prev as DayData),
      meals: result.day ? result.day.meals : (prev as DayData)?.meals,
    }));
    queryClient.setQueryData(["/api/meal-tracker/custom-options"], result.customOptions);
    setNotification(`Eliminado: ${item}`);
  };

  const resetDay = async () => {
    if (!confirm("¿Reiniciar el día? Se destildan todas las comidas de hoy. Tus opciones agregadas se conservan.")) return;
    const updated = await fetchJson("/api/meal-tracker/reset-day", { method: "POST", body: JSON.stringify({ date: today }) });
    queryClient.setQueryData(["/api/meal-tracker/today", today], (prev: DayData | undefined) => ({
      ...(prev as DayData),
      meals: updated.meals,
      regCelebrated: updated.regCelebrated,
      celebrated: updated.celebrated,
    }));
    setNotification("Día reiniciado 🌱");
  };

  const needs = dayNutrients(meals);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 border-0 bg-background max-h-[85vh] overflow-y-auto minimal-scrollbar">
        <VisuallyHidden>
          <DialogTitle>Comida</DialogTitle>
          <DialogDescription>Registrá tus comidas del día</DialogDescription>
        </VisuallyHidden>
        <div className="overflow-hidden rounded-3xl border border-border/50">
          <AnimatePresence>
            {notification && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-green-500/20 border-b border-green-500/30 px-4 py-2 text-sm text-green-700 dark:text-green-400 text-center"
              >
                {notification}
              </motion.div>
            )}
          </AnimatePresence>

          {panel === "day" && (
            <DayPanel
              day={day}
              meals={meals}
              needs={needs}
              curIdx={curIdx}
              onOpenMeal={(id) => {
                setActiveMealId(id);
                setPanel("meal");
              }}
              onSummary={() => setPanel("summary")}
              onCalendar={() => setPanel("calendar")}
              onReset={resetDay}
            />
          )}

          {panel === "calendar" && (
            <CalendarPanel today={today} onBack={() => setPanel("day")} />
          )}

          {panel === "meal" && activeMeal && (
            <MealPanel
              meal={activeMeal}
              meals={meals}
              customOptions={customOptions}
              dishes={dishes}
              onToggle={toggleItem}
              onDeleteItem={deleteCustomOption}
              onAdd={(catKey) => {
                setAddCatKey(catKey);
                setAddValue("");
                setPanel("add");
              }}
              onApplyDish={applyDish}
              onDeleteDish={deleteDish}
              onNewDish={() => setPanel("add-dish")}
              onBack={closeMealPanel}
            />
          )}

          {panel === "add" && activeMeal && addCatKey && (
            <AddPanel
              catLabel={activeMeal.cats.find((c) => c.key === addCatKey)?.label || ""}
              value={addValue}
              onChange={setAddValue}
              onSubmit={submitAdd}
              onBack={() => setPanel("meal")}
            />
          )}

          {panel === "add-dish" && activeMeal && (
            <AddDishPanel
              meal={activeMeal}
              customOptions={customOptions}
              onSubmit={submitDish}
              onBack={() => setPanel("meal")}
            />
          )}

          {panel === "summary" && (
            <SummaryPanel day={day} needs={needs} meals={meals} onBack={() => setPanel("day")} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DayPanel({
  day,
  meals,
  needs,
  curIdx,
  onOpenMeal,
  onSummary,
  onCalendar,
  onReset,
}: {
  day: DayData | undefined;
  meals: MealsState;
  needs: Record<string, boolean>;
  curIdx: number;
  onOpenMeal: (id: string) => void;
  onSummary: () => void;
  onCalendar: () => void;
  onReset: () => void;
}) {
  const todayStr = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="w-full">
      <div className="border-b border-border/30 px-6 py-5 flex items-start justify-between">
        <div>
          <h2 className="font-black text-xl text-foreground">Comida</h2>
          <p className="mt-1 text-sm text-muted-foreground capitalize">{todayStr}</p>
        </div>
        <div className="flex items-center gap-2">
          {(day?.streak ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400">
              🔥 {day?.streak} días
            </span>
          )}
          <button
            onClick={onCalendar}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border/30 bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors"
            title="Ver calendario de comidas"
          >
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="relative flex items-start justify-between">
          {/* Línea que conecta los 4 platos, detrás de los círculos */}
          <div className="absolute top-[34px] left-[13%] right-[13%] h-[3px] bg-border rounded-full z-0" />
          {MEALS.map((meal, i) => {
            const locked = i > curIdx;
            const done = mealDone(meals, meal);
            const isNow = i === curIdx;
            return (
              <button
                key={meal.id}
                disabled={locked}
                onClick={() => onOpenMeal(meal.id)}
                className={`relative z-10 flex flex-1 flex-col items-center gap-1.5 bg-transparent ${locked ? "cursor-default" : "cursor-pointer"}`}
              >
                <div className="w-[68px] h-[68px] transition-transform hover:-translate-y-0.5">
                  <MealPlateIcon meal={meal} meals={meals} locked={locked} />
                </div>
                <span className={`text-xs font-semibold ${done ? "text-green-600 dark:text-green-400" : "text-foreground"}`}>
                  {meal.label}
                </span>
                <span className="text-[9px] font-bold leading-none h-[15px] flex items-center">
                  {locked ? (
                    <span className="text-muted-foreground">🔒 {meal.startLabel}</span>
                  ) : isNow ? (
                    <span className="text-green-600 dark:text-green-400 bg-green-500/15 px-1.5 py-0.5 rounded-full">ahora</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-4 leading-relaxed px-2">
          Tocá la comida del momento y marcá lo que comiste. El objetivo del día es juntar los cuatro grupos.
        </p>

        <div className="flex flex-wrap gap-2 justify-center mt-4">
          {NEEDS.map((n) => {
            const on = needs[n.key];
            const Icon = n.icon;
            return (
              <span
                key={n.key}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  on
                    ? "bg-green-500/15 border-green-500/40 text-green-700 dark:text-green-400"
                    : "bg-muted/40 border-border/30 text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {n.label}
                {on && <Check className="h-3 w-3" />}
              </span>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border/30 px-5 py-3 flex items-center justify-between gap-2">
        <button
          onClick={onReset}
          className="text-muted-foreground/60 hover:text-foreground transition-colors p-2 rounded-lg"
          title="Reiniciar el día"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <Button variant="outline" className="flex-1" onClick={onSummary}>
          Ver mi resumen del día
        </Button>
      </div>
    </div>
  );
}

// Duración del mantener-apretado, compartida por el fondo de categoría / sección (agregar) y
// los chips (eliminar), para que todos los gestos se sientan iguales: 1,5 s.
const LONG_PRESS_MS = 1500;
// El resaltado del mantener-apretado (rojo para eliminar, gris para agregar) recién aparece
// pasado este tiempo, así un toque simple nunca se ve ni actúa como un borrado.
const ARM_AFTER_MS = 450;

function MealPanel({
  meal,
  meals,
  customOptions,
  dishes,
  onToggle,
  onDeleteItem,
  onAdd,
  onApplyDish,
  onDeleteDish,
  onNewDish,
  onBack,
}: {
  meal: MealDef;
  meals: MealsState;
  customOptions: Record<string, string[]>;
  dishes: Dish[];
  onToggle: (meal: MealDef, catKey: string, item: string) => void;
  onDeleteItem: (catKey: string, item: string) => void;
  onAdd: (catKey: string) => void;
  onApplyDish: (meal: MealDef, dish: Dish, active: boolean) => void;
  onDeleteDish: (dish: Dish) => void;
  onNewDish: () => void;
  onBack: () => void;
}) {
  return (
    <div className="w-full">
      <div className="border-b border-border/30 px-4 py-4 flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <meal.icon className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-black text-lg text-foreground">{meal.label}</h2>
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <div className="w-32 h-32">
          <MealPlateIcon meal={meal} meals={meals} locked={false} />
        </div>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        <p className="text-xs text-muted-foreground -mt-1">
          {meal.kind === "main"
            ? "El plato saludable: mitad vegetales, un cuarto proteína y un cuarto carbohidrato. Sumale fruta y agua."
            : "Una bebida y un plato, con su fruta y un vaso de agua. Marcá lo que tuviste."}
          {" "}Mantené apretado el fondo de una categoría (o de Comidas) para sumar tu opción, o un ítem agregado por vos para eliminarlo.
        </p>

        <DishSection
          meal={meal}
          meals={meals}
          dishes={dishes.filter((d) => d.mealKind === meal.kind)}
          onApplyDish={onApplyDish}
          onDeleteDish={onDeleteDish}
          onNewDish={onNewDish}
        />

        {meal.cats.map((cat) => {
          const customList = customOptions[`${meal.kind}:${cat.key}`] || [];
          const items = [...cat.items, ...customList];
          const customSet = new Set(customList);
          return (
            <CategoryBlock
              key={cat.key}
              cat={cat}
              items={items}
              customSet={customSet}
              checkedItems={meals?.[meal.id]?.[cat.key] || {}}
              onToggle={(item) => onToggle(meal, cat.key, item)}
              onDeleteItem={(item) => onDeleteItem(cat.key, item)}
              onAdd={() => onAdd(cat.key)}
            />
          );
        })}
      </div>

      <div className="border-t border-border/30 px-5 py-3">
        <Button className="w-full" onClick={onBack}>
          Listo
        </Button>
      </div>
    </div>
  );
}

// Un plato está "confirmado" cuando todos sus componentes linkeados están tildados en esta
// comida. Tocarlo confirma (tilda todo) o des-confirma (destilda todo) de una.
function dishActive(meals: MealsState, mealId: string, dish: Dish): boolean {
  if (dish.components.length === 0) return false;
  return dish.components.every((c) => !!meals?.[mealId]?.[c.categoryKey]?.[c.item]);
}

// Sección "Comidas" — arriba de las categorías en las cuatro comidas. Lista los platos
// combinados del usuario; confirmar uno activa sus componentes (proteína, vegetales, carbo)
// de una. Mantener apretado el fondo de la sección arma un plato nuevo, igual que las
// categorías con sus opciones.
function DishSection({
  meal,
  meals,
  dishes,
  onApplyDish,
  onDeleteDish,
  onNewDish,
}: {
  meal: MealDef;
  meals: MealsState;
  dishes: Dish[];
  onApplyDish: (meal: MealDef, dish: Dish, active: boolean) => void;
  onDeleteDish: (dish: Dish) => void;
  onNewDish: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const [holding, setHolding] = useState(false);

  const cancel = () => {
    setHolding(false);
    startPos.current = null;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (armRef.current) { clearTimeout(armRef.current); armRef.current = null; }
  };

  const start = (e: React.PointerEvent) => {
    // El mantener-apretado de un chip lo maneja el propio chip (eliminar plato), no el fondo.
    if ((e.target as HTMLElement).closest("button")) return;
    startPos.current = { x: e.clientX, y: e.clientY };
    armRef.current = setTimeout(() => setHolding(true), ARM_AFTER_MS);
    timerRef.current = setTimeout(() => {
      setHolding(false);
      onNewDish();
    }, LONG_PRESS_MS);
  };

  const move = (e: React.PointerEvent) => {
    if (!startPos.current) return;
    if (Math.abs(e.clientX - startPos.current.x) > 10 || Math.abs(e.clientY - startPos.current.y) > 10) cancel();
  };

  return (
    <div
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className={`-mx-2 rounded-2xl px-2 py-1.5 transition-colors touch-pan-y ${holding ? "bg-muted/50" : ""}`}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wide text-foreground">Comidas</span>
        <span className="text-[10px] font-medium text-muted-foreground">(mantené apretado para armar un plato)</span>
      </div>
      {dishes.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Todavía no tenés platos. Mantené apretado acá para armar uno: al confirmarlo se tildan sus componentes de una.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {dishes.map((dish) => (
            <DishChip
              key={dish.id}
              dish={dish}
              active={dishActive(meals, meal.id, dish)}
              onToggle={() => onApplyDish(meal, dish, !dishActive(meals, meal.id, dish))}
              onDelete={() => onDeleteDish(dish)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DishChip({
  dish,
  active,
  onToggle,
  onDelete,
}: {
  dish: Dish;
  active: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const [holding, setHolding] = useState(false);

  const cancel = () => {
    setHolding(false);
    startPos.current = null;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (armRef.current) { clearTimeout(armRef.current); armRef.current = null; }
  };

  const start = (e: React.PointerEvent) => {
    startPos.current = { x: e.clientX, y: e.clientY };
    firedRef.current = false;
    // El rojo de "eliminar" recién aparece pasado ARM_AFTER_MS: un toque simple confirma el
    // plato y nunca se ve como un borrado.
    armRef.current = setTimeout(() => setHolding(true), ARM_AFTER_MS);
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      setHolding(false);
      if (confirm(`¿Eliminar el plato "${dish.name}"?`)) onDelete();
    }, LONG_PRESS_MS);
  };

  const move = (e: React.PointerEvent) => {
    if (!startPos.current) return;
    if (Math.abs(e.clientX - startPos.current.x) > 10 || Math.abs(e.clientY - startPos.current.y) > 10) cancel();
  };

  const handleClick = () => {
    if (firedRef.current) {
      firedRef.current = false;
      return;
    }
    onToggle();
  };

  return (
    <button
      onClick={handleClick}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className={`inline-flex flex-col items-start gap-0.5 text-sm font-medium px-3 py-2 rounded-xl border transition-colors touch-pan-y ${
        holding
          ? "bg-red-500/15 border-red-500/50 text-red-600 dark:text-red-400"
          : active
            ? "bg-green-500/15 border-green-500/50 text-green-700 dark:text-green-400"
            : "bg-muted/30 border-border/40 text-foreground hover:bg-muted/50"
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        {holding ? <Trash2 className="h-3.5 w-3.5" /> : active && <Check className="h-3.5 w-3.5" />}
        {dish.name}
      </span>
      {dish.components.length > 0 && (
        <span className="text-[10px] font-normal text-muted-foreground">
          {dish.components.map((c) => c.item).join(" · ")}
        </span>
      )}
    </button>
  );
}

// Armador de plato: nombre + selección de ítems ya existentes de proteína y carbohidrato.
// Para un ingrediente nuevo, primero se agrega por el flujo normal de la categoría.
function AddDishPanel({
  meal,
  customOptions,
  onSubmit,
  onBack,
}: {
  meal: MealDef;
  customOptions: Record<string, string[]>;
  onSubmit: (name: string, components: DishComponent[]) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<DishComponent[]>([]);

  const dishCats = meal.cats.filter((c) => DISH_CAT_KEYS.includes(c.key));

  const isSelected = (catKey: string, item: string) =>
    selected.some((c) => c.categoryKey === catKey && c.item === item);

  const toggle = (catKey: string, item: string) => {
    setSelected((prev) =>
      isSelected(catKey, item)
        ? prev.filter((c) => !(c.categoryKey === catKey && c.item === item))
        : [...prev, { categoryKey: catKey, item }],
    );
  };

  const canSubmit = name.trim().length > 0 && selected.length > 0;

  return (
    <div className="w-full">
      <div className="border-b border-border/30 px-4 py-4 flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-black text-lg text-foreground">Nuevo plato</h2>
      </div>
      <div className="px-5 py-4 flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          Poné un nombre y elegí sus componentes. Al confirmar el plato en{" "}
          {meal.label.toLowerCase()} se tildan esos ítems de una; al des-confirmarlo se destildan.
          Para un ingrediente nuevo, agregalo primero en su categoría.
        </p>
        <Input
          autoFocus
          maxLength={40}
          placeholder="Ej: Tostadas con huevo"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {dishCats.map((cat) => {
          const items = [...cat.items, ...(customOptions[`${meal.kind}:${cat.key}`] || [])];
          return (
            <div key={cat.key}>
              <div className="flex items-center gap-1.5 mb-2">
                <cat.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-wide text-foreground">{cat.label}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {items.map((item) => {
                  const on = isSelected(cat.key, item);
                  return (
                    <button
                      key={item}
                      onClick={() => toggle(cat.key, item)}
                      className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border transition-colors ${
                        on
                          ? "bg-green-500/15 border-green-500/50 text-green-700 dark:text-green-400"
                          : "bg-muted/30 border-border/40 text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {on && <Check className="h-3.5 w-3.5" />}
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex gap-2 mt-1">
          <Button className="flex-1" onClick={() => onSubmit(name.trim(), selected)} disabled={!canSubmit}>
            Guardar plato
          </Button>
          <Button variant="outline" onClick={onBack}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

function CategoryBlock({
  cat,
  items,
  customSet,
  checkedItems,
  onToggle,
  onDeleteItem,
  onAdd,
}: {
  cat: CatDef;
  items: string[];
  customSet: Set<string>;
  checkedItems: Record<string, boolean>;
  onToggle: (item: string) => void;
  onDeleteItem: (item: string) => void;
  onAdd: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const [holding, setHolding] = useState(false);

  const cancel = () => {
    setHolding(false);
    startPos.current = null;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (armRef.current) { clearTimeout(armRef.current); armRef.current = null; }
  };

  const start = (e: React.PointerEvent) => {
    // No interceptar el mantener-apretado si arrancó sobre un chip: ese gesto lo maneja el
    // propio chip (eliminar), no el fondo de la categoría (agregar).
    if ((e.target as HTMLElement).closest("button")) return;
    startPos.current = { x: e.clientX, y: e.clientY };
    armRef.current = setTimeout(() => setHolding(true), ARM_AFTER_MS);
    timerRef.current = setTimeout(() => {
      setHolding(false);
      onAdd();
    }, LONG_PRESS_MS);
  };

  // Si el dedo se mueve, es un scroll: cancelamos el mantener-apretado y dejamos que la lista
  // se desplace (touch-pan-y permite el scroll vertical sobre toda la superficie).
  const move = (e: React.PointerEvent) => {
    if (!startPos.current) return;
    if (Math.abs(e.clientX - startPos.current.x) > 10 || Math.abs(e.clientY - startPos.current.y) > 10) cancel();
  };

  return (
    <div
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className={`-mx-2 rounded-2xl px-2 py-1.5 transition-colors touch-pan-y ${holding ? "bg-muted/50" : ""}`}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <cat.icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wide text-foreground">{cat.label}</span>
        {cat.optional && <span className="text-[10px] font-medium text-muted-foreground">(opcional)</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <ItemChip
            key={item}
            item={item}
            on={!!checkedItems[item]}
            deletable={customSet.has(item)}
            onToggle={() => onToggle(item)}
            onDelete={() => onDeleteItem(item)}
          />
        ))}
      </div>
    </div>
  );
}

function ItemChip({
  item,
  on,
  deletable,
  onToggle,
  onDelete,
}: {
  item: string;
  on: boolean;
  deletable: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const [holding, setHolding] = useState(false);

  const cancel = () => {
    setHolding(false);
    startPos.current = null;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (armRef.current) { clearTimeout(armRef.current); armRef.current = null; }
  };

  const start = (e: React.PointerEvent) => {
    if (!deletable) return; // solo las opciones agregadas por el usuario se pueden eliminar
    startPos.current = { x: e.clientX, y: e.clientY };
    firedRef.current = false;
    // El rojo recién aparece pasado ARM_AFTER_MS: un toque simple tilda/destilda y nunca se
    // ve como un borrado.
    armRef.current = setTimeout(() => setHolding(true), ARM_AFTER_MS);
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      setHolding(false);
      if (confirm(`¿Eliminar "${item}" de tus opciones?`)) {
        onDelete();
      }
    }, LONG_PRESS_MS);
  };

  // Si el dedo se desplaza, es un scroll: cancelamos el mantener-apretado para no disparar
  // "eliminar" mientras la lista se desplaza.
  const move = (e: React.PointerEvent) => {
    if (!startPos.current) return;
    if (Math.abs(e.clientX - startPos.current.x) > 10 || Math.abs(e.clientY - startPos.current.y) > 10) cancel();
  };

  const handleClick = () => {
    if (firedRef.current) {
      firedRef.current = false;
      return;
    }
    onToggle();
  };

  return (
    <button
      onClick={handleClick}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border transition-colors touch-pan-y ${
        holding
          ? "bg-red-500/15 border-red-500/50 text-red-600 dark:text-red-400"
          : on
            ? "bg-green-500/15 border-green-500/50 text-green-700 dark:text-green-400"
            : "bg-muted/30 border-border/40 text-foreground hover:bg-muted/50"
      }`}
    >
      {holding ? <Trash2 className="h-3.5 w-3.5" /> : on && <Check className="h-3.5 w-3.5" />}
      {item}
    </button>
  );
}

function AddPanel({
  catLabel,
  value,
  onChange,
  onSubmit,
  onBack,
}: {
  catLabel: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <div className="w-full">
      <div className="border-b border-border/30 px-4 py-4 flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-black text-lg text-foreground">Agregar a {catLabel}</h2>
      </div>
      <div className="px-5 py-4">
        <p className="text-xs text-muted-foreground mb-3">Se guarda como tu opción en esta categoría y queda para siempre.</p>
        <Input
          autoFocus
          maxLength={28}
          placeholder="Ej: Tofu"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        />
        <div className="flex gap-2 mt-4">
          <Button className="flex-1" onClick={onSubmit} disabled={!value.trim()}>
            Agregar
          </Button>
          <Button variant="outline" onClick={onBack}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryPanel({
  day,
  needs,
  meals,
  onBack,
}: {
  day: DayData | undefined;
  needs: Record<string, boolean>;
  meals: MealsState;
  onBack: () => void;
}) {
  const complete = coreComplete(meals);
  const registeredCount = MEALS.filter((m) => mealRegistered(meals, m)).length;
  const waterCount = MEALS.filter((m) => catOn(meals, m.id, "agua")).length;

  return (
    <div className="w-full">
      <div className="border-b border-border/30 px-4 py-4 flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-black text-lg text-foreground">{complete ? "¡Día completo!" : "Cómo venís hoy"}</h2>
      </div>

      <div className="px-5 py-4">
        <p className="text-sm text-muted-foreground text-center mb-4">
          {complete
            ? "Tuviste proteína, vegetales, carbohidrato y fruta. Un día bien armado 🌱"
            : "Todavía te falta alguna. Si tenés otra comida por delante, aprovechá para sumarla."}
        </p>

        <div className="flex flex-col gap-2">
          {NEEDS.map((n) => {
            const ok = needs[n.key];
            const Icon = n.icon;
            return (
              <div
                key={n.key}
                className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 border ${
                  ok ? "border-green-500/40 bg-green-500/10" : "border-border/30"
                }`}
              >
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${ok ? "bg-green-500/20" : "bg-muted"}`}>
                  <Icon className="h-4 w-4 text-foreground" />
                </div>
                <span className="flex-1 font-semibold text-sm text-foreground">{n.label}</span>
                <div
                  className={`h-5 w-5 rounded-full flex items-center justify-center text-xs ${
                    ok ? "bg-green-500 text-white" : "border-2 border-border"
                  }`}
                >
                  {ok && <Check className="h-3 w-3" />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 justify-center flex-wrap mt-4">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${registeredCount === 4 ? "bg-green-500/20 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
            🍽️ {registeredCount}/4 comidas
          </span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${waterCount > 0 ? "bg-sky-500/20 text-sky-700 dark:text-sky-400" : "bg-muted text-muted-foreground"}`}>
            💧 {waterCount}/4 agua
          </span>
          {(day?.streak ?? 0) > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400">
              🔥 {day?.streak} días
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-border/30 px-5 py-3">
        <Button className="w-full" onClick={onBack}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}

// Calendario mensual de comidas — mismo patrón visual que el "Calendario de actividades" de
// Tareas del día: grilla de 7 columnas, un mes por vez, cada día con puntitos por comida
// registrada y ✓✓ si el día quedó completo (los 4 grupos). Tocar un día muestra el detalle.
function CalendarPanel({ today, onBack }: { today: string; onBack: () => void }) {
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const calDim = new Date(calYear, calMonth + 1, 0).getDate();
  const monthStart = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`;
  const monthEnd = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(calDim).padStart(2, "0")}`;

  const { data: rangeDays = [] } = useQuery<RangeDay[]>({
    queryKey: ["/api/meal-tracker/range", monthStart, monthEnd],
    queryFn: () => fetchJson(`/api/meal-tracker/range?start=${monthStart}&end=${monthEnd}`),
  });

  const dayByDate = new Map(rangeDays.map((d) => [d.date, d]));
  const offset = getFirstDayOfMonth(calendarDate);
  const todayObj = new Date(today + "T12:00:00");
  todayObj.setHours(0, 0, 0, 0);

  const changeMonth = (delta: number) => {
    setCalendarDate(new Date(calYear, calMonth + delta, 1));
    setSelectedDay(null);
  };

  const selectedMeals: MealsState = selectedDay ? dayByDate.get(selectedDay)?.meals || {} : {};
  const selectedRegistered = MEALS.filter((m) => mealRegistered(selectedMeals, m));

  return (
    <div className="w-full">
      <div className="border-b border-border/30 px-4 py-4 flex items-center gap-3">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-black text-lg text-foreground">Calendario de comidas</h2>
      </div>

      <div className="px-5 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => changeMonth(-1)}
            className="flex h-8 w-8 items-center justify-center rounded border border-border/30 bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <span className="font-bold text-sm text-foreground capitalize flex-1 text-center">
            {MONTHS[calMonth]} {calYear}
          </span>
          <button
            onClick={() => changeMonth(1)}
            className="flex h-8 w-8 items-center justify-center rounded border border-border/30 bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {DAY_LBLS.map((lbl) => (
            <div key={lbl} className="text-center text-xs font-medium text-muted-foreground uppercase mb-1">
              {lbl}
            </div>
          ))}

          {Array.from({ length: offset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {Array.from({ length: calDim }).map((_, d) => {
            const day = d + 1;
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dObj = new Date(dateStr + "T12:00:00");
            dObj.setHours(0, 0, 0, 0);
            const isFuture = dObj > todayObj;
            const isToday = dateStr === today;

            const dayMeals: MealsState = dayByDate.get(dateStr)?.meals || {};
            const registered = MEALS.filter((m) => mealRegistered(dayMeals, m));
            const allDone = coreComplete(dayMeals);

            return (
              <button
                key={day}
                onClick={() => setSelectedDay((prev) => (prev === dateStr ? null : dateStr))}
                className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                  allDone ? "bg-green-500/20" : isFuture ? "opacity-20" : "bg-muted/30"
                } ${isToday ? "ring-2 ring-green-500" : ""} ${
                  selectedDay === dateStr ? "ring-2 ring-foreground" : ""
                }`}
              >
                <div className={isToday ? "font-medium text-green-600 dark:text-green-400" : "font-medium"}>
                  {day}
                </div>
                {allDone && !isFuture && (
                  <div className="text-xs font-bold text-green-600 dark:text-green-400">✓✓</div>
                )}
                {registered.length > 0 && !allDone && !isFuture && (
                  <div className="flex gap-1 flex-wrap justify-center max-w-full">
                    {registered.map((m) => (
                      <div
                        key={m.id}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: MEAL_DOT_COLORS[m.id] }}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2.5 min-h-[3rem]">
          {!selectedDay ? (
            <p className="text-xs text-muted-foreground">Tocá un día para ver qué comiste.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {new Date(selectedDay + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              {selectedRegistered.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada registrado ese día.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedRegistered.map((m) => {
                    const items = mealCheckedItems(selectedMeals, m);
                    return (
                      <div key={m.id} className="flex items-start gap-2 text-sm">
                        <div
                          className="mt-1.5 h-2 w-2 rounded-full flex-shrink-0"
                          style={{ background: MEAL_DOT_COLORS[m.id] }}
                        />
                        <span>
                          <span className="font-semibold">{m.label}</span>
                          {items.length > 0 && (
                            <span className="text-muted-foreground"> · {items.join(", ")}</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                  {coreComplete(selectedMeals) && (
                    <p className="text-xs font-semibold text-green-600 dark:text-green-400 pt-0.5">
                      ✓ Día completo — los cuatro grupos
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
