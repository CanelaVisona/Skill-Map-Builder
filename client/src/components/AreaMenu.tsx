import { useSkillTree, iconMap, type Project, type Area } from "@/lib/skill-context";
import { useAuth } from "@/lib/auth-context";
import { useMenu } from "@/lib/menu-context";
import { ProgressBar } from "@/components/ProgressBar";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Music, Trophy, BookOpen, Home, Dumbbell, Briefcase, Heart, Utensils, Palette, Code, Gamepad2, Camera, FolderKanban, Trash2, LogOut, Archive, ArchiveRestore, Pencil, Zap, ChevronDown, ChevronRight, Mountain, Compass, Scroll, Eye, Swords, Lock, LockOpen } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "./ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { Popover, PopoverContent, PopoverAnchor, PopoverTrigger } from "./ui/popover";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { ScrollArea } from "./ui/scroll-area";
import { useState, useEffect, useRef, type TouchEvent, type PointerEvent, type CSSProperties, type ReactElement } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type DialogStep = "choose" | "new-area" | "new-project" | "new-sidequest" | "new-emergent" | "new-experience";

const iconKeywords: Record<string, string[]> = {
  Music: ["música", "musica", "guitarra", "guitar", "piano", "canto", "instrumento", "song", "canción"],
  Trophy: ["deporte", "fútbol", "futbol", "football", "soccer", "basket", "tenis", "competencia", "ganador", "winner"],
  BookOpen: ["libro", "lectura", "literatura", "leer", "estudio", "study", "book", "reading"],
  Home: ["casa", "hogar", "home", "limpieza", "organización"],
  Dumbbell: ["gym", "gimnasio", "ejercicio", "fitness", "workout", "peso", "músculo"],
  Briefcase: ["trabajo", "work", "negocio", "business", "empleo", "carrera", "profesional"],
  Heart: ["salud", "health", "bienestar", "meditación", "yoga", "mental"],
  Utensils: ["cocina", "cooking", "recetas", "chef", "comida", "food"],
  Palette: ["arte", "art", "pintura", "dibujo", "diseño", "design", "creatividad"],
  Code: ["programación", "código", "code", "software", "web", "desarrollo", "developer"],
  Gamepad2: ["juegos", "gaming", "videojuegos", "game"],
  Camera: ["foto", "fotografía", "photography", "video", "film"]
};

const availableIcons = [
  { name: "Music", icon: Music },
  { name: "Trophy", icon: Trophy },
  { name: "BookOpen", icon: BookOpen },
  { name: "Home", icon: Home },
  { name: "Dumbbell", icon: Dumbbell },
  { name: "Briefcase", icon: Briefcase },
  { name: "Heart", icon: Heart },
  { name: "Utensils", icon: Utensils },
  { name: "Palette", icon: Palette },
  { name: "Code", icon: Code },
  { name: "Gamepad2", icon: Gamepad2 },
  { name: "Camera", icon: Camera },
  { name: "FolderKanban", icon: FolderKanban },
];

function getIconForTitle(title: string): string {
  const lowerTitle = title.toLowerCase();
  for (const [iconName, keywords] of Object.entries(iconKeywords)) {
    if (keywords.some(keyword => lowerTitle.includes(keyword))) {
      return iconName;
    }
  }
  return "Home";
}

const extendedIconMap: Record<string, any> = {
  ...iconMap,
  Dumbbell,
  Briefcase,
  Heart,
  Utensils,
  Palette,
  Code,
  Gamepad2,
  Camera,
  FolderKanban
};

// Types for source view dialog

interface SourceEntry {
  id: string;
  name: string;
  description: string;
}

interface SourcePower extends SourceEntry {
  isUnlocked: 0 | 1 | 2;
}

interface SourceBugRecord {
  id: string;
  bugId: string;
  fecha: string;
  situacion: string;
  senal: string;
  estrategia: string;
  resultado: "victoria" | "empate" | "derrota";
}

interface SourceBug {
  id: string;
  nombre: string;
  status: "identificado" | "debugueando" | "debugueado";
  victoryCount: number;
  desc: string;
  aparece: string[];
  disparadores: string[];
  estrategias: string[];
  registros: SourceBugRecord[];
}

function FlameIcon({ animated }: { animated: boolean }) {
  const base: CSSProperties = {
    position: "absolute",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    transformOrigin: "bottom center",
    borderRadius: "50% 50% 30% 30% / 60% 60% 40% 40%",
  };

  return (
    <div style={{ position: "relative", width: 18, height: 22, flexShrink: 0, marginTop: 1 }}>
      <div
        className="flame-outer"
        style={{
          ...base,
          width: 12,
          height: 18,
          background: "#EF9F27",
          animation: animated ? "flicker1 0.9s ease-in-out infinite" : "none",
        }}
      />
      <div
        className="flame-inner"
        style={{
          ...base,
          width: 7,
          height: 11,
          background: "#FAC775",
          bottom: 2,
          animation: animated ? "flicker2 0.7s ease-in-out infinite" : "none",
        }}
      />
      <div
        className="flame-core"
        style={{
          ...base,
          width: 3,
          height: 6,
          background: "#fff",
          bottom: 3,
          opacity: 0.9,
          animation: animated ? "glow-pulse 0.8s ease-in-out infinite" : "none",
        }}
      />
    </div>
  );
}

type PowerRenderState = {
  cardClass: string;
  icon: ReactElement;
  descriptionClass: string;
  showGlow: boolean;
};

interface ViewSourceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sourceName: string;
  sourceType: "area" | "project";
  sourceId: string;
}

function ViewSourceDialog({ isOpen, onClose, sourceName, sourceType, sourceId }: ViewSourceDialogProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("description");
  const [isAdding, setIsAdding] = useState(false);
  const [editingEntry, setEditingEntry] = useState<SourceEntry | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [powerContextMenuId, setPowerContextMenuId] = useState<string | null>(null);
  const powerLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const powerLongPressCompleted = useRef(false);
  const backgroundLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedBugId, setSelectedBugId] = useState<string | null>(null);
  const [bugMoreOpen, setBugMoreOpen] = useState(false);
  const [bugContextMenuId, setBugContextMenuId] = useState<string | null>(null);
  const bugLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bugAddLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bugRecordLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bugRecordItemLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bugLongPressCompleted = useRef(false);
  const [isBugFormOpen, setIsBugFormOpen] = useState(false);
  const [editingBug, setEditingBug] = useState<SourceBug | null>(null);
  const [bugNombre, setBugNombre] = useState("");
  const [bugStatus, setBugStatus] = useState<"identificado" | "debugueando" | "debugueado">("identificado");
  const [bugDesc, setBugDesc] = useState("");
  const [bugAparece, setBugAparece] = useState("");
  const [bugDisparadores, setBugDisparadores] = useState("");
  const [bugEstrategias, setBugEstrategias] = useState("");
  const [isBugRecordFormOpen, setIsBugRecordFormOpen] = useState(false);
  const [recordFecha, setRecordFecha] = useState(new Date().toISOString().slice(0, 10));
  const [recordSituacion, setRecordSituacion] = useState("");
  const [recordSenal, setRecordSenal] = useState("");
  const [recordEstrategia, setRecordEstrategia] = useState("");
  const [recordResultado, setRecordResultado] = useState<"victoria" | "empate" | "derrota">("victoria");
  const [editingBugRecord, setEditingBugRecord] = useState<SourceBugRecord | null>(null);
  const [recordContextMenuId, setRecordContextMenuId] = useState<string | null>(null);
  const [isBugStatusMenuOpen, setIsBugStatusMenuOpen] = useState(false);

  const bugStatusLabel: Record<SourceBug["status"], string> = {
    identificado: "Identificado",
    debugueando: "Debugueando",
    debugueado: "Debugueado",
  };

  const bugStatusColor: Record<SourceBug["status"], string> = {
    identificado: "bg-red-400",
    debugueando: "bg-amber-400",
    debugueado: "bg-emerald-400",
  };

  const bugStatusButtonClass: Record<SourceBug["status"], string> = {
    identificado: "bg-red-400 border-red-500 text-black",
    debugueando: "bg-amber-400 border-amber-500 text-black",
    debugueado: "bg-emerald-400 border-emerald-500 text-black",
  };

  const bugResultLabel: Record<SourceBugRecord["resultado"], string> = {
    victoria: "Victoria",
    empate: "Empate",
    derrota: "Derrota",
  };

  const bugResultColor: Record<SourceBugRecord["resultado"], string> = {
    victoria: "text-emerald-400",
    empate: "text-amber-400",
    derrota: "text-red-400",
  };

  // Pointer-based background long-press handlers
  const handleBackgroundPointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("[data-entry-card]") || target?.closest(".power-card")) return;
    backgroundLongPressTimer.current = setTimeout(() => {
      setIsAdding(true);
    }, 1000);
  };

  const handleBackgroundPointerUp = () => {
    if (backgroundLongPressTimer.current) {
      clearTimeout(backgroundLongPressTimer.current);
      backgroundLongPressTimer.current = null;
    }
  };

  // Fetch source descriptions
  const { data: descriptions = [] } = useQuery<SourceEntry[]>({
    queryKey: [`/api/source-descriptions/${sourceType}/${sourceId}`],
    queryFn: async () => {
      const res = await fetch(`/api/source-descriptions/${sourceType}/${sourceId}`);
      return res.json();
    },
    enabled: isOpen,
  });

  // Fetch experiences for this source
  const { data: experiences = [] } = useQuery<SourceEntry[]>({
    queryKey: [`/api/profile/experiences/by-source/${sourceType}/${sourceId}`],
    queryFn: async () => {
      const res = await fetch(`/api/profile/experiences/by-source/${sourceType}/${sourceId}`);
      return res.json();
    },
    enabled: isOpen,
  });

  // Fetch source growth
  const { data: growth = [] } = useQuery<SourceEntry[]>({
    queryKey: [`/api/source-growth/${sourceType}/${sourceId}`],
    queryFn: async () => {
      const res = await fetch(`/api/source-growth/${sourceType}/${sourceId}`);
      return res.json();
    },
    enabled: isOpen,
  });

  // Fetch contributions for this source
  const { data: contributions = [] } = useQuery<SourceEntry[]>({
    queryKey: [`/api/profile/contributions/by-source/${sourceType}/${sourceId}`],
    queryFn: async () => {
      const res = await fetch(`/api/profile/contributions/by-source/${sourceType}/${sourceId}`);
      return res.json();
    },
    enabled: isOpen,
  });

  // Fetch source powers
  const { data: powers = [], isError: powersError } = useQuery<SourcePower[]>({
    queryKey: [`/api/source-powers/${sourceType}/${sourceId}`],
    queryFn: async () => {
      const res = await fetch(`/api/source-powers/${sourceType}/${sourceId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch powers: ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: isOpen,
  });

  const { data: bugs = [] } = useQuery<SourceBug[]>({
    queryKey: [`/api/source-bugs/${sourceType}/${sourceId}`],
    queryFn: async () => {
      const res = await fetch(`/api/source-bugs/${sourceType}/${sourceId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch bugs: ${res.status}`);
      }
      return res.json();
    },
    enabled: isOpen,
  });

  // Create mutations
  const createDescription = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const body = sourceType === "area" 
        ? { ...data, areaId: sourceId } 
        : { ...data, projectId: sourceId };
      const res = await fetch("/api/source-descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/source-descriptions/${sourceType}/${sourceId}`] });
      setIsAdding(false);
      setName("");
      setDescription("");
    },
  });

  const createGrowth = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const body = sourceType === "area" 
        ? { ...data, areaId: sourceId } 
        : { ...data, projectId: sourceId };
      const res = await fetch("/api/source-growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/source-growth/${sourceType}/${sourceId}`] });
      setIsAdding(false);
      setName("");
      setDescription("");
    },
  });

  const deleteDescription = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/source-descriptions/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/source-descriptions/${sourceType}/${sourceId}`] });
    },
  });

  const deleteGrowth = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/source-growth/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/source-growth/${sourceType}/${sourceId}`] });
    },
  });

  const updateDescription = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; description: string } }) => {
      const res = await fetch(`/api/source-descriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/source-descriptions/${sourceType}/${sourceId}`] });
      setEditingEntry(null);
      setName("");
      setDescription("");
    },
  });

  const updateGrowth = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; description: string } }) => {
      const res = await fetch(`/api/source-growth/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/source-growth/${sourceType}/${sourceId}`] });
      setEditingEntry(null);
      setName("");
      setDescription("");
    },
  });

  // Experiences mutations (for entries tied to this source)
  const createExperience = useMutation({
    mutationFn: async (data: { name: string; description: string; areaId?: string | null; projectId?: string | null }) => {
      const res = await fetch("/api/profile/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Error al crear experiencia" }));
        throw new Error(error.message || "Error al crear experiencia");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/profile/experiences`] });
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith?.("/api/profile/experiences/by-source") });
      setIsAdding(false);
      setName("");
      setDescription("");
    },
  });

  const updateExperience = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; areaId?: string | null; projectId?: string | null } }) => {
      const res = await fetch(`/api/profile/experiences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/profile/experiences`] });
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith?.("/api/profile/experiences/by-source") });
      setEditingEntry(null);
      setName("");
      setDescription("");
    },
  });

  const deleteExperience = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/profile/experiences/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/profile/experiences`] });
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith?.("/api/profile/experiences/by-source") });
    },
  });

  // Contributions mutations
  const createContribution = useMutation({
    mutationFn: async (data: { name: string; description: string; areaId?: string | null; projectId?: string | null }) => {
      const res = await fetch("/api/profile/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/profile/contributions`] });
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith?.("/api/profile/contributions/by-source") });
      setIsAdding(false);
      setName("");
      setDescription("");
    },
  });

  const updateContribution = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; areaId?: string | null; projectId?: string | null } }) => {
      const res = await fetch(`/api/profile/contributions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/profile/contributions`] });
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith?.("/api/profile/contributions/by-source") });
      setEditingEntry(null);
      setName("");
      setDescription("");
    },
  });

  const deleteContribution = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/profile/contributions/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/profile/contributions`] });
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith?.("/api/profile/contributions/by-source") });
    },
  });

  // Source Powers mutations
  const createPower = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const body = sourceType === "area" 
        ? { ...data, areaId: sourceId } 
        : { ...data, projectId: sourceId };
      const res = await fetch("/api/source-powers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/source-powers/${sourceType}/${sourceId}`] });
      setIsAdding(false);
      setName("");
      setDescription("");
    },
  });

  const updatePower = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SourcePower> }) => {
      const res = await fetch(`/api/source-powers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/source-powers/${sourceType}/${sourceId}`] });
      setEditingEntry(null);
      setName("");
      setDescription("");
    },
  });

  const deletePower = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/source-powers/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/source-powers/${sourceType}/${sourceId}`] });
    },
  });

  const createBug = useMutation({
    mutationFn: async (data: {
      nombre: string;
      status: "identificado" | "debugueando" | "debugueado";
      desc: string;
      aparece: string[];
      disparadores: string[];
      estrategias: string[];
      areaId?: string | null;
      projectId?: string | null;
    }) => {
      const res = await fetch("/api/source-bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new Error("No se pudo crear el bug");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/source-bugs/${sourceType}/${sourceId}`] });
      setIsBugFormOpen(false);
      setEditingBug(null);
      setBugNombre("");
      setBugStatus("identificado");
      setBugDesc("");
      setBugAparece("");
      setBugDisparadores("");
      setBugEstrategias("");
    },
  });

  const updateBug = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        nombre?: string;
        status?: "identificado" | "debugueando" | "debugueado";
        victoryCount?: number;
        desc?: string;
        aparece?: string[];
        disparadores?: string[];
        estrategias?: string[];
      };
    }) => {
      const res = await fetch(`/api/source-bugs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new Error("No se pudo actualizar el bug");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/source-bugs/${sourceType}/${sourceId}`] });
      setIsBugFormOpen(false);
      setEditingBug(null);
    },
  });

  const deleteBug = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/source-bugs/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("No se pudo eliminar el bug");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/source-bugs/${sourceType}/${sourceId}`] });
      setBugContextMenuId(null);
    },
  });

  const createBugRecord = useMutation({
    mutationFn: async ({
      bugId,
      data,
    }: {
      bugId: string;
      data: {
        fecha: string;
        situacion: string;
        senal: string;
        estrategia: string;
        resultado: "victoria" | "empate" | "derrota";
      };
    }) => {
      const res = await fetch(`/api/source-bugs/${bugId}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new Error("No se pudo crear el registro");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/source-bugs/${sourceType}/${sourceId}`] });
      setIsBugRecordFormOpen(false);
      setEditingBugRecord(null);
      setRecordContextMenuId(null);
      setRecordFecha(new Date().toISOString().slice(0, 10));
      setRecordSituacion("");
      setRecordSenal("");
      setRecordEstrategia("");
      setRecordResultado("victoria");
    },
  });

  const updateBugRecord = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        fecha?: string;
        situacion?: string;
        senal?: string;
        estrategia?: string;
        resultado?: "victoria" | "empate" | "derrota";
      };
    }) => {
      const res = await fetch(`/api/source-bug-records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new Error("No se pudo actualizar el registro");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/source-bugs/${sourceType}/${sourceId}`] });
      setIsBugRecordFormOpen(false);
      setEditingBugRecord(null);
      setRecordContextMenuId(null);
      setRecordFecha(new Date().toISOString().slice(0, 10));
      setRecordSituacion("");
      setRecordSenal("");
      setRecordEstrategia("");
      setRecordResultado("victoria");
    },
  });

  const deleteBugRecord = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/source-bug-records/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("No se pudo eliminar el registro");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/source-bugs/${sourceType}/${sourceId}`] });
      setRecordContextMenuId(null);
    },
  });

  const handleAdd = () => {
    if (!name.trim()) return;
    let finalName = name.trim();
    if (activeTab === "powers" && !finalName.startsWith("Puedo")) {
      finalName = `Puedo ${finalName}`;
    }
    if (activeTab === "description") {
      createDescription.mutate({ name: finalName, description: description.trim() });
    } else if (activeTab === "growth") {
      createGrowth.mutate({ name: finalName, description: description.trim() });
    } else if (activeTab === "experiences") {
      createExperience.mutate({
        name: finalName,
        description: description.trim(),
        areaId: sourceType === "area" ? sourceId : null,
        projectId: sourceType === "project" ? sourceId : null,
      });
    } else if (activeTab === "contributions") {
      createContribution.mutate({
        name: finalName,
        description: description.trim(),
        areaId: sourceType === "area" ? sourceId : null,
        projectId: sourceType === "project" ? sourceId : null,
      });
    } else if (activeTab === "powers") {
      createPower.mutate({ name: finalName, description: description.trim() });
    }
  };

  const handleSaveEdit = () => {
    if (!editingEntry || !name.trim()) return;
    let finalName = name.trim();
    if (activeTab === "powers" && !finalName.startsWith("Puedo")) {
      finalName = `Puedo ${finalName}`;
    }
    if (activeTab === "description") {
      updateDescription.mutate({ id: editingEntry.id, data: { name: finalName, description: description.trim() } });
    } else if (activeTab === "growth") {
      updateGrowth.mutate({ id: editingEntry.id, data: { name: finalName, description: description.trim() } });
    } else if (activeTab === "experiences") {
      updateExperience.mutate({ id: editingEntry.id, data: { name: finalName, description: description.trim(), areaId: sourceType === "area" ? sourceId : null, projectId: sourceType === "project" ? sourceId : null } });
    } else if (activeTab === "contributions") {
      updateContribution.mutate({ id: editingEntry.id, data: { name: finalName, description: description.trim(), areaId: sourceType === "area" ? sourceId : null, projectId: sourceType === "project" ? sourceId : null } });
    } else if (activeTab === "powers") {
      updatePower.mutate({ id: editingEntry.id, data: { name: finalName, description: description.trim() } });
    }
  };

  const handleStartEdit = (entry: SourceEntry) => {
    setEditingEntry(entry);
    setName(entry.name);
    setDescription(entry.description);
    setIsAdding(false);
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    setName("");
    setDescription("");
  };

  const parseBugList = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const openNewBugForm = () => {
    setEditingBug(null);
    setBugNombre("");
    setBugStatus("identificado");
    setBugDesc("");
    setBugAparece("");
    setBugDisparadores("");
    setBugEstrategias("");
    setIsBugFormOpen(true);
    setBugContextMenuId(null);
  };

  const openEditBugForm = (bug: SourceBug) => {
    setEditingBug(bug);
    setBugNombre(bug.nombre);
    setBugStatus(bug.status);
    setBugDesc(bug.desc);
    setBugAparece(bug.aparece.join(", "));
    setBugDisparadores(bug.disparadores.join(", "));
    setBugEstrategias(bug.estrategias.join(", "));
    setIsBugFormOpen(true);
    setBugContextMenuId(null);
  };

  const handleSaveBug = () => {
    const nombre = bugNombre.trim();
    if (!nombre) return;

    const payload = {
      nombre,
      status: bugStatus,
      desc: bugDesc.trim(),
      aparece: parseBugList(bugAparece),
      disparadores: parseBugList(bugDisparadores),
      estrategias: parseBugList(bugEstrategias),
      areaId: sourceType === "area" ? sourceId : null,
      projectId: sourceType === "project" ? sourceId : null,
    };

    if (editingBug) {
      updateBug.mutate({
        id: editingBug.id,
        data: {
          nombre: payload.nombre,
          status: payload.status,
          desc: payload.desc,
          aparece: payload.aparece,
          disparadores: payload.disparadores,
          estrategias: payload.estrategias,
        },
      });
      return;
    }

    createBug.mutate(payload);
  };

  const handleSaveBugRecord = () => {
    if (!selectedBugId) return;
    if (!recordSituacion.trim() || !recordSenal.trim() || !recordEstrategia.trim()) return;

    if (editingBugRecord) {
      updateBugRecord.mutate({
        id: editingBugRecord.id,
        data: {
          fecha: recordFecha,
          situacion: recordSituacion.trim(),
          senal: recordSenal.trim(),
          estrategia: recordEstrategia.trim(),
          resultado: recordResultado,
        },
      });
      return;
    }

    createBugRecord.mutate({
      bugId: selectedBugId,
      data: {
        fecha: recordFecha,
        situacion: recordSituacion.trim(),
        senal: recordSenal.trim(),
        estrategia: recordEstrategia.trim(),
        resultado: recordResultado,
      },
    });
  };

  const handleChangeBugStatus = (status: "identificado" | "debugueando" | "debugueado") => {
    if (!selectedBug) return;
    updateBug.mutate({
      id: selectedBug.id,
      data: { status, victoryCount: status === "debugueado" ? 5 : 0 },
    });
    setIsBugStatusMenuOpen(false);
  };

  const startBugLongPress = (bugId: string) => {
    bugLongPressCompleted.current = false;
    if (bugLongPressTimer.current) {
      clearTimeout(bugLongPressTimer.current);
    }
    bugLongPressTimer.current = setTimeout(() => {
      setBugContextMenuId((prev) => (prev === bugId ? null : bugId));
      bugLongPressCompleted.current = true;
    }, 900);
  };

  const endBugLongPress = () => {
    if (bugLongPressTimer.current) {
      clearTimeout(bugLongPressTimer.current);
      bugLongPressTimer.current = null;
    }
  };

  const startBugAddLongPress = () => {
    if (bugAddLongPressTimer.current) {
      clearTimeout(bugAddLongPressTimer.current);
    }
    bugAddLongPressTimer.current = setTimeout(() => {
      openNewBugForm();
    }, 900);
  };

  const endBugAddLongPress = () => {
    if (bugAddLongPressTimer.current) {
      clearTimeout(bugAddLongPressTimer.current);
      bugAddLongPressTimer.current = null;
    }
  };

  const startBugRecordLongPress = () => {
    if (!selectedBugId) return;
    if (bugRecordLongPressTimer.current) {
      clearTimeout(bugRecordLongPressTimer.current);
    }
    bugRecordLongPressTimer.current = setTimeout(() => {
      setEditingBugRecord(null);
      setRecordFecha(new Date().toISOString().slice(0, 10));
      setRecordSituacion("");
      setRecordSenal("");
      setRecordEstrategia("");
      setRecordResultado("victoria");
      setIsBugRecordFormOpen(true);
    }, 900);
  };

  const endBugRecordLongPress = () => {
    if (bugRecordLongPressTimer.current) {
      clearTimeout(bugRecordLongPressTimer.current);
      bugRecordLongPressTimer.current = null;
    }
  };

  const startBugRecordItemLongPress = (recordId: string) => {
    if (bugRecordItemLongPressTimer.current) {
      clearTimeout(bugRecordItemLongPressTimer.current);
    }
    bugRecordItemLongPressTimer.current = setTimeout(() => {
      setRecordContextMenuId((prev) => (prev === recordId ? null : recordId));
    }, 900);
  };

  const endBugRecordItemLongPress = () => {
    if (bugRecordItemLongPressTimer.current) {
      clearTimeout(bugRecordItemLongPressTimer.current);
      bugRecordItemLongPressTimer.current = null;
    }
  };

  const openEditBugRecordForm = (record: SourceBugRecord) => {
    setEditingBugRecord(record);
    setRecordFecha(record.fecha);
    setRecordSituacion(record.situacion);
    setRecordSenal(record.senal);
    setRecordEstrategia(record.estrategia);
    setRecordResultado(record.resultado);
    setIsBugRecordFormOpen(true);
    setRecordContextMenuId(null);
  };

  useEffect(() => {
    if (bugs.length === 0) {
      setSelectedBugId(null);
      setBugMoreOpen(false);
      setBugContextMenuId(null);
      setRecordContextMenuId(null);
      setIsBugStatusMenuOpen(false);
      return;
    }

    if (selectedBugId && !bugs.some((bug) => bug.id === selectedBugId)) {
      setSelectedBugId(null);
      setBugMoreOpen(false);
      setBugContextMenuId(null);
      setRecordContextMenuId(null);
      setIsBugStatusMenuOpen(false);
    }
  }, [bugs, selectedBugId]);

  // Long-press handlers for powers
  const handlePowerPointerDown = (e: PointerEvent, powerId: string) => {
    e.stopPropagation();
    powerLongPressCompleted.current = false;
    if (powerContextMenuId === powerId) {
      setPowerContextMenuId(null);
      return;
    }
    setPowerContextMenuId(null);
    powerLongPressTimer.current = setTimeout(() => {
      setPowerContextMenuId(powerId);
      powerLongPressCompleted.current = true;
    }, 1000);
  };

  const handlePowerMouseUp = () => {
    if (powerLongPressTimer.current) {
      clearTimeout(powerLongPressTimer.current);
      powerLongPressTimer.current = null;
    }
  };

  // keep touch handler as fallback but delegate to pointer
  const handlePowerTouchStart = (e: TouchEvent, powerId: string) => {
    e.stopPropagation();
    powerLongPressCompleted.current = false;
    if (powerContextMenuId === powerId) {
      setPowerContextMenuId(null);
      return;
    }
    setPowerContextMenuId(null);
    powerLongPressTimer.current = setTimeout(() => {
      setPowerContextMenuId(powerId);
      powerLongPressCompleted.current = true;
    }, 1000);
  };

  const handlePowerTouchEnd = () => {
    if (powerLongPressTimer.current) {
      clearTimeout(powerLongPressTimer.current);
      powerLongPressTimer.current = null;
    }
  };

  const renderPowerState = (power: SourcePower): PowerRenderState => {
    if (power.isUnlocked === 0) {
      return {
        cardClass: "border-white/7 text-[#444]",
        icon: <Lock className="h-4 w-4 flex-shrink-0 mt-0.5 text-gray-500" />,
        descriptionClass: "font-normal text-[11px] mt-0.5 opacity-50 text-[#333]",
        showGlow: false,
      };
    }

    const active = power.isUnlocked === 2;

    return {
      cardClass: power.isUnlocked === 1 ? "border-white/13 text-[#b0997a]" : "border-[#EF9F27] text-[#FAC775]",
      icon: power.isUnlocked === 1 ? <LockOpen className="h-4 w-4 flex-shrink-0 mt-0.5 text-[#8a7a60]" /> : <FlameIcon animated={active} />,
      descriptionClass: power.isUnlocked === 1 ? "font-normal text-[11px] mt-0.5 text-[#6a5a40]" : "font-normal text-[11px] mt-0.5 text-[#EF9F27]",
      showGlow: active,
    };
  };

  const renderEntryList = (entries: SourceEntry[], canEdit: boolean, onDelete?: (id: string) => void, onEdit?: (entry: SourceEntry) => void) => (
    <div className="space-y-2">
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay items aún</p>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className="p-3 bg-muted/30 rounded-lg group" data-entry-card>
            <div className="flex items-start justify-between">
              <div className="flex-1 cursor-pointer" onClick={() => canEdit && onEdit && onEdit(entry)}>
                <h4 className="font-medium text-sm">{entry.name}</h4>
                {entry.description && (
                  <p className="text-xs text-muted-foreground mt-1">{entry.description}</p>
                )}
              </div>
              <div className="flex gap-1">
                {canEdit && onEdit && (
                  <button
                    onClick={() => onEdit(entry)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all"
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
                {canEdit && onDelete && (
                  <button
                    onClick={() => onDelete(entry.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-all"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const selectedBug = bugs.find((bug) => bug.id === selectedBugId) || null;
  const bugProgressCount = selectedBug?.status === "debugueado"
    ? 5
    : Math.min(selectedBug?.victoryCount || 0, 5);
  const bugProgressPercent = (bugProgressCount / 5) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex w-[calc(100vw-1rem)] max-w-[42rem] max-h-[calc(100dvh-1rem)] flex-col overflow-hidden p-3 sm:w-[min(92vw,42rem)] sm:max-h-[min(90dvh,52rem)] sm:p-5">
        <DialogHeader>
          <DialogTitle>{sourceName}</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2 flex min-h-0 flex-1 flex-col">
          <TabsList className="flex w-full flex-nowrap justify-start gap-1 overflow-x-auto overflow-y-hidden">
            <TabsTrigger value="description" className="shrink-0 text-xs">Background</TabsTrigger>
            <TabsTrigger value="bugs" className="shrink-0 text-xs">Bugs</TabsTrigger>
            <TabsTrigger value="powers" className="shrink-0 text-xs">Poderes</TabsTrigger>
            <TabsTrigger value="experiences" className="shrink-0 text-xs">Experiencias</TabsTrigger>
            <TabsTrigger value="growth" className="shrink-0 text-xs">Crecimiento</TabsTrigger>
            <TabsTrigger value="contributions" className="shrink-0 text-xs">Contribución</TabsTrigger>
          </TabsList>

          <TabsContent value="description" className="mt-4 min-h-0">
            <ScrollArea
              className="h-[min(52dvh,320px)] pr-4"
              onPointerDown={handleBackgroundPointerDown}
              onPointerUp={handleBackgroundPointerUp}
              onPointerCancel={handleBackgroundPointerUp}
            >
              {renderEntryList(descriptions, true, (id) => deleteDescription.mutate(id), handleStartEdit)}
            </ScrollArea>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-3 w-full" 
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </TabsContent>

          <TabsContent value="experiences" className="mt-4 min-h-0">
            <ScrollArea
              className="h-[min(52dvh,320px)] pr-4"
              onPointerDown={handleBackgroundPointerDown}
              onPointerUp={handleBackgroundPointerUp}
              onPointerCancel={handleBackgroundPointerUp}
            >
              {renderEntryList(experiences, true, (id) => deleteExperience.mutate(id), handleStartEdit)}
            </ScrollArea>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-3 w-full" 
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </TabsContent>

          <TabsContent value="growth" className="mt-4 min-h-0">
            <ScrollArea
              className="h-[min(52dvh,320px)] pr-4"
              onPointerDown={handleBackgroundPointerDown}
              onPointerUp={handleBackgroundPointerUp}
              onPointerCancel={handleBackgroundPointerUp}
            >
              {renderEntryList(growth, true, (id) => deleteGrowth.mutate(id), handleStartEdit)}
            </ScrollArea>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-3 w-full" 
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </TabsContent>

          <TabsContent value="contributions" className="mt-4 min-h-0">
            <ScrollArea
              className="h-[min(52dvh,320px)] pr-4"
              onPointerDown={handleBackgroundPointerDown}
              onPointerUp={handleBackgroundPointerUp}
              onPointerCancel={handleBackgroundPointerUp}
            >
              {renderEntryList(contributions, true, (id) => deleteContribution.mutate(id), handleStartEdit)}
            </ScrollArea>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-3 w-full" 
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </TabsContent>

          <TabsContent value="powers" className="mt-4 min-h-0">
            <ScrollArea
              className="h-[min(52dvh,320px)] pr-4"
              onPointerDown={handleBackgroundPointerDown}
              onPointerUp={handleBackgroundPointerUp}
              onPointerCancel={handleBackgroundPointerUp}
            >
              <div>
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Poderes · Nivel {Math.floor((powers || []).filter(p => p.isUnlocked === 2).length / 5) + 1}</span>
                    <span className="text-xs text-muted-foreground">{((powers || []).filter(p => p.isUnlocked === 2).length % 5)} / 5 para subir</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${(((powers || []).filter(p => p.isUnlocked === 2).length % 5) / 5) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(!powers || powers.length === 0) ? (
                    <p className="text-sm text-muted-foreground col-span-2">No hay poderes aún (mantener presionado para agregar)</p>
                  ) : (
                    powers.map((power) => {
                      const showContextMenu = powerContextMenuId === power.id;
                      const state = renderPowerState(power);
                      return (
                        <div
                          key={power.id}
                          className="relative power-card"
                          onPointerDown={(e) => handlePowerPointerDown(e as PointerEvent, power.id)}
                          onPointerUp={handlePowerMouseUp}
                          onPointerCancel={handlePowerMouseUp}
                          onMouseLeave={handlePowerMouseUp}
                          onTouchStart={(e) => handlePowerTouchStart(e, power.id)}
                          onTouchEnd={handlePowerTouchEnd}
                        >
                          <button
                            onClick={() => {
                              if (!powerLongPressCompleted.current) {
                                const next = ((power.isUnlocked + 1) % 3) as 0 | 1 | 2;
                                updatePower.mutate({ id: power.id, data: { isUnlocked: next } });
                              }
                              setTimeout(() => {
                                powerLongPressCompleted.current = false;
                              }, 50);
                            }}
                            className={`w-full p-2 rounded-lg text-xs font-medium transition-all text-left flex items-start gap-2 border relative overflow-hidden ${state.cardClass}`}
                            style={{
                              background: power.isUnlocked === 0 ? "#0f0b07" : power.isUnlocked === 1 ? "#221a10" : "#2a1a00",
                            }}
                          >
                            {state.icon}
                            <div className="flex-1 min-w-0">
                              <p className="truncate">{power.name}</p>
                              {/* status label removed per user request */}
                              {power.description && (
                                <p className={state.descriptionClass}>{power.description}</p>
                              )}
                            </div>
                            {state.showGlow && (
                              <div
                                style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(239,159,39,0.2) 0%,rgba(186,117,23,0.06) 100%)", pointerEvents: "none", animation: "glow-pulse 2.5s ease-in-out infinite", borderRadius: 10 }}
                              />
                            )}
                          </button>

                          {/* Context Menu on Long Press */}
                          {showContextMenu && (
                            <div
                              className="absolute right-1 top-1 z-50 flex gap-1 bg-background border rounded-lg p-1 shadow-lg"
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit({ id: power.id, name: power.name, description: power.description });
                                  setPowerContextMenuId(null);
                                }}
                                className="p-1 hover:bg-muted rounded"
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deletePower.mutate(power.id);
                                  setPowerContextMenuId(null);
                                }}
                                className="p-1 hover:bg-destructive/20 rounded"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="bugs" className="mt-4 min-h-0">
            <div className="h-[min(52dvh,320px)] min-h-[260px] pr-1">
              <div className={`grid h-full gap-3 ${selectedBug ? "grid-cols-1 md:grid-cols-[200px_1fr]" : "grid-cols-1"}`}>
                <div className="h-full overflow-y-auto border rounded-lg bg-muted/20">
                {bugs.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground">Sin bugs todavía</div>
                ) : (
                  bugs.map((bug) => (
                    <div
                      key={bug.id}
                      className={`relative p-3 border-b last:border-b-0 cursor-pointer transition-colors ${selectedBugId === bug.id ? "bg-muted" : "hover:bg-muted/40"}`}
                      onMouseDown={() => startBugLongPress(bug.id)}
                      onMouseUp={endBugLongPress}
                      onMouseLeave={endBugLongPress}
                      onTouchStart={() => startBugLongPress(bug.id)}
                      onTouchEnd={endBugLongPress}
                      onClick={() => {
                        if (bugLongPressCompleted.current) {
                          bugLongPressCompleted.current = false;
                          return;
                        }
                        const nextSelectedId = selectedBugId === bug.id ? null : bug.id;
                        setSelectedBugId(nextSelectedId);
                        setBugMoreOpen(false);
                        setBugContextMenuId(null);
                        setIsBugStatusMenuOpen(false);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium uppercase tracking-wide truncate">{bug.nombre}</p>
                        <span className={`h-2 w-2 rounded-full ${bugStatusColor[bug.status]}`} />
                      </div>

                      {bugContextMenuId === bug.id && (
                        <div
                          className="absolute right-2 top-2 z-20 flex items-center gap-1 border rounded-md bg-background p-1 shadow"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => openEditBugForm(bug)}
                            className="p-1 hover:bg-muted rounded"
                            title="Editar"
                          >
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => deleteBug.mutate(bug.id)}
                            className="p-1 hover:bg-destructive/20 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}

                <div
                  className="flex items-center justify-center p-3 border-t cursor-pointer"
                  onMouseDown={startBugAddLongPress}
                  onMouseUp={endBugAddLongPress}
                  onMouseLeave={endBugAddLongPress}
                  onTouchStart={startBugAddLongPress}
                  onTouchEnd={endBugAddLongPress}
                >
                  <Plus className="h-4 w-4 text-muted-foreground/70" />
                </div>
              </div>

              {selectedBug && (
                <div
                  className="h-full overflow-y-auto border rounded-lg p-3 bg-muted/20"
                  onMouseDown={startBugRecordLongPress}
                  onMouseUp={endBugRecordLongPress}
                  onMouseLeave={endBugRecordLongPress}
                  onTouchStart={startBugRecordLongPress}
                  onTouchEnd={endBugRecordLongPress}
                >
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-base font-medium uppercase tracking-wide">{selectedBug.nombre}</h4>
                      <div className="relative inline-block mt-2">
                        <button
                          type="button"
                          className={`text-[11px] px-2 py-1 rounded border uppercase tracking-wide ${bugStatusButtonClass[selectedBug.status]}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsBugStatusMenuOpen((prev) => !prev);
                          }}
                        >
                          {bugStatusLabel[selectedBug.status]}
                        </button>

                        {isBugStatusMenuOpen && (
                          <div
                            className="absolute left-0 top-full mt-1 z-30 min-w-[140px] rounded-md border bg-background shadow"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className={`block w-full px-3 py-2 text-left text-xs ${bugStatusButtonClass["identificado"]}`}
                              onClick={() => handleChangeBugStatus("identificado")}
                            >
                              Identificado
                            </button>
                            <button
                              type="button"
                              className={`block w-full px-3 py-2 text-left text-xs ${bugStatusButtonClass["debugueando"]}`}
                              onClick={() => handleChangeBugStatus("debugueando")}
                            >
                              Debugueando
                            </button>
                            <button
                              type="button"
                              className={`block w-full px-3 py-2 text-left text-xs ${bugStatusButtonClass["debugueado"]}`}
                              onClick={() => handleChangeBugStatus("debugueado")}
                            >
                              Debugueado
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">{selectedBug.desc || "Sin descripción"}</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-end mb-1">
                        <p className="text-[11px] text-muted-foreground">{bugProgressCount} / 5</p>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${bugProgressPercent}%` }}
                        />
                      </div>
                    </div>

                    {selectedBug.estrategias.length > 0 && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Estrategias</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedBug.estrategias.map((item, idx) => (
                            <span key={`${selectedBug.id}-es-top-${idx}`} className="text-xs px-2 py-0.5 rounded border bg-background">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBugMoreOpen((prev) => !prev);
                      }}
                    >
                      {bugMoreOpen ? "− menos" : "+ más"}
                    </button>

                    {bugMoreOpen && (
                      <div className="space-y-2">
                        {selectedBug.aparece.length > 0 && (
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Cuándo aparece</p>
                            <div className="flex flex-wrap gap-1">
                              {selectedBug.aparece.map((item, idx) => (
                                <span key={`${selectedBug.id}-ap-${idx}`} className="text-xs px-2 py-0.5 rounded border bg-background">{item}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedBug.disparadores.length > 0 && (
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Disparadores</p>
                            <div className="flex flex-wrap gap-1">
                              {selectedBug.disparadores.map((item, idx) => (
                                <span key={`${selectedBug.id}-di-${idx}`} className="text-xs px-2 py-0.5 rounded border bg-background">{item}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="border-t pt-3">
                      <div
                        className="mb-2 inline-flex"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          startBugRecordLongPress();
                        }}
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          endBugRecordLongPress();
                        }}
                        onMouseLeave={endBugRecordLongPress}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          startBugRecordLongPress();
                        }}
                        onTouchEnd={(e) => {
                          e.stopPropagation();
                          endBugRecordLongPress();
                        }}
                      >
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Registros</p>
                      </div>
                      <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
                        {selectedBug.registros.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sin registros todavía</p>
                        ) : (
                          selectedBug.registros.map((registro) => (
                            <div
                              key={registro.id}
                              className="relative p-2 rounded border bg-background"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                startBugRecordItemLongPress(registro.id);
                              }}
                              onMouseUp={(e) => {
                                e.stopPropagation();
                                endBugRecordItemLongPress();
                              }}
                              onMouseLeave={endBugRecordItemLongPress}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                startBugRecordItemLongPress(registro.id);
                              }}
                              onTouchEnd={(e) => {
                                e.stopPropagation();
                                endBugRecordItemLongPress();
                              }}
                            >
                              {recordContextMenuId === registro.id && (
                                <div
                                  className="absolute right-2 top-2 z-20 flex items-center gap-1 border rounded-md bg-background p-1 shadow"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => openEditBugRecordForm(registro)}
                                    className="p-1 hover:bg-muted rounded"
                                    title="Editar"
                                  >
                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                  <button
                                    onClick={() => deleteBugRecord.mutate(registro.id)}
                                    className="p-1 hover:bg-destructive/20 rounded"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </button>
                                </div>
                              )}

                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                {registro.fecha} · <span className={bugResultColor[registro.resultado]}>{bugResultLabel[registro.resultado]}</span>
                              </p>
                              <p className="text-xs mt-1"><span className="text-muted-foreground">Situación:</span> {registro.situacion}</p>
                              <p className="text-xs"><span className="text-muted-foreground">Señal:</span> {registro.senal}</p>
                              <p className="text-xs"><span className="text-muted-foreground">Estrategia:</span> {registro.estrategia}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Add/Edit Modal Dialog */}
      <Dialog open={isAdding || !!editingEntry} onOpenChange={(open) => {
        if (!open) {
          setIsAdding(false);
          handleCancelEdit();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Editar entrada" : "Agregar nueva entrada"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="entry-name" className="text-sm font-medium mb-2 block">
                Título
              </Label>
              <Input
                id="entry-name"
                placeholder="Título"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="entry-desc" className="text-sm font-medium mb-2 block">
                Descripción (opcional)
              </Label>
              <Textarea
                id="entry-desc"
                placeholder="Descripción"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsAdding(false);
                  handleCancelEdit();
                }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={editingEntry ? handleSaveEdit : handleAdd}
                disabled={!name.trim()}
              >
                {editingEntry ? "Actualizar" : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBugFormOpen} onOpenChange={setIsBugFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBug ? "Editar bug" : "Nuevo bug"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="bug-nombre" className="text-sm font-medium mb-2 block">Nombre</Label>
              <Input
                id="bug-nombre"
                value={bugNombre}
                onChange={(e) => setBugNombre(e.target.value)}
                placeholder="Nombre del bug"
              />
            </div>

            <div>
              <Label htmlFor="bug-status" className="text-sm font-medium mb-2 block">Estado</Label>
              <select
                id="bug-status"
                value={bugStatus}
                  onChange={(e) => setBugStatus(e.target.value as "identificado" | "debugueando" | "debugueado")}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                  <option value="identificado">Identificado</option>
                  <option value="debugueando">Debugueando</option>
                  <option value="debugueado">Debugueado</option>
              </select>
            </div>

            <div>
              <Label htmlFor="bug-desc" className="text-sm font-medium mb-2 block">Descripción</Label>
              <Textarea
                id="bug-desc"
                value={bugDesc}
                onChange={(e) => setBugDesc(e.target.value)}
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="bug-aparece" className="text-sm font-medium mb-2 block">Cuándo aparece (comas)</Label>
              <Input
                id="bug-aparece"
                value={bugAparece}
                onChange={(e) => setBugAparece(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="bug-disparadores" className="text-sm font-medium mb-2 block">Disparadores (comas)</Label>
              <Input
                id="bug-disparadores"
                value={bugDisparadores}
                onChange={(e) => setBugDisparadores(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="bug-estrategias" className="text-sm font-medium mb-2 block">Estrategias (comas)</Label>
              <Input
                id="bug-estrategias"
                value={bugEstrategias}
                onChange={(e) => setBugEstrategias(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setIsBugFormOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveBug} disabled={!bugNombre.trim()}>{editingBug ? "Guardar cambios" : "Crear bug"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBugRecordFormOpen}
        onOpenChange={(open) => {
          setIsBugRecordFormOpen(open);
          if (!open) {
            setEditingBugRecord(null);
            setRecordFecha(new Date().toISOString().slice(0, 10));
            setRecordSituacion("");
            setRecordSenal("");
            setRecordEstrategia("");
            setRecordResultado("victoria");
          }
        }}
      >
        <DialogContent className="top-[42%] z-[80] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBugRecord ? "Editar registro" : "Nuevo registro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="bug-record-fecha" className="text-sm font-medium mb-2 block">Fecha</Label>
              <Input
                id="bug-record-fecha"
                type="date"
                value={recordFecha}
                onChange={(e) => setRecordFecha(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="bug-record-situacion" className="text-sm font-medium mb-2 block">Situación</Label>
              <Textarea
                id="bug-record-situacion"
                value={recordSituacion}
                onChange={(e) => setRecordSituacion(e.target.value)}
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="bug-record-senal" className="text-sm font-medium mb-2 block">Señal</Label>
              <Input
                id="bug-record-senal"
                value={recordSenal}
                onChange={(e) => setRecordSenal(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="bug-record-estrategia" className="text-sm font-medium mb-2 block">Estrategia usada</Label>
              <Input
                id="bug-record-estrategia"
                value={recordEstrategia}
                onChange={(e) => setRecordEstrategia(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="bug-record-resultado" className="text-sm font-medium mb-2 block">Resultado</Label>
              <select
                id="bug-record-resultado"
                value={recordResultado}
                onChange={(e) => setRecordResultado(e.target.value as "victoria" | "empate" | "derrota")}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="victoria">Victoria</option>
                <option value="empate">Empate</option>
                <option value="derrota">Derrota</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setIsBugRecordFormOpen(false)}>Cancelar</Button>
              <Button
                onClick={handleSaveBugRecord}
                disabled={!recordSituacion.trim() || !recordSenal.trim() || !recordEstrategia.trim()}
              >
                {editingBugRecord ? "Guardar cambios" : "Guardar registro"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

interface AreaItemProps {
  area: Area;
  isActive: boolean;
  isMenuOpen: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onRename: (newName: string) => void;
}

function AreaItem({ area, isActive, isMenuOpen, onSelect, onDelete, onArchive, onRename }: AreaItemProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [newName, setNewName] = useState(area.name);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const Icon = extendedIconMap[area.icon] || extendedIconMap.Home;

  const handleTouchStart = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsPopoverOpen(true);
    }, 1500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleMouseDown = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsPopoverOpen(true);
    }, 1500);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPress.current = false;
      return;
    }
    onSelect();
  };

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverAnchor asChild>
        <button
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={cn(
            "w-full flex flex-col gap-1 px-3 py-2 rounded-md transition-all duration-200 group relative overflow-hidden touch-pan-y select-none",
            isActive 
              ? "bg-primary/10 text-primary" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            !isMenuOpen && "justify-center px-2"
          )}
        >
          {isActive && isMenuOpen && (
            <motion.div
              layoutId="activeIndicator"
              className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary"
            />
          )}
          
          {/* Icon and name row */}
          <div className="flex items-center gap-3">
            <Icon size={18} className={cn("shrink-0", isActive ? "text-primary" : "group-hover:text-foreground")} />
            
            {isMenuOpen && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-medium text-sm truncate"
              >
                {area.name}
              </motion.span>
            )}
          </div>

          {/* Progress bar - only when menu is open and area is active */}
          {isMenuOpen && isActive && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="pl-7"
            >
              <ProgressBar skills={area.skills || []} size="sm" areaOrProjectId={area.id} currentXp={area.currentXp} />
            </motion.div>
          )}
        </button>
      </PopoverAnchor>
      <PopoverContent 
        side="right" 
        align="start"
        className="w-44 p-1.5 rounded-xl border border-border/50 bg-popover/95 backdrop-blur-lg shadow-xl"
      >
        <div className="flex flex-col">
          <button
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors"
            onClick={() => {
              setIsViewDialogOpen(true);
              setIsPopoverOpen(false);
            }}
            data-testid={`button-view-area-${area.id}`}
          >
            <Eye className="h-4 w-4 text-muted-foreground" />
            Ver
          </button>
          <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
            <DialogTrigger asChild>
              <button
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors"
                data-testid={`button-rename-area-${area.id}`}
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
                Renombrar
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Renombrar área</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Input 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nuevo nombre"
                  data-testid="input-rename-area"
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => {
                      if (newName.trim()) {
                        onRename(newName.trim());
                        setIsRenameDialogOpen(false);
                        setIsPopoverOpen(false);
                      }
                    }} 
                    disabled={!newName.trim()}
                    className="flex-1"
                    data-testid="button-save-rename-area"
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <button
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors"
            onClick={() => {
              onArchive();
              setIsPopoverOpen(false);
            }}
            data-testid={`button-archive-area-${area.id}`}
          >
            <Archive className="h-4 w-4 text-muted-foreground" />
            Archivar
          </button>
          <div className="my-1 border-t border-border/30" />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors"
                data-testid={`button-delete-area-${area.id}`}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar "{area.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminará permanentemente esta área y todas sus habilidades.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsPopoverOpen(false)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    onDelete();
                    setIsPopoverOpen(false);
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </PopoverContent>
      <ViewSourceDialog
        isOpen={isViewDialogOpen}
        onClose={() => setIsViewDialogOpen(false)}
        sourceName={area.name}
        sourceType="area"
        sourceId={area.id}
      />
    </Popover>
  );
}

interface ProjectItemProps {
  project: Project;
  isActive: boolean;
  isMenuOpen: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onRename: (newName: string) => void;
}

function ProjectItem({ project, isActive, isMenuOpen, onSelect, onDelete, onArchive, onRename }: ProjectItemProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [newName, setNewName] = useState(project.name);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const Icon = extendedIconMap[project.icon] || FolderKanban;

  const handleTouchStart = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsPopoverOpen(true);
    }, 1500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleMouseDown = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsPopoverOpen(true);
    }, 1500);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = () => {
    if (!isLongPress.current) {
      onSelect();
    }
  };

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverAnchor asChild>
        <button
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={cn(
            "w-full flex flex-col gap-1 px-3 py-2 rounded-md transition-all duration-200 group relative overflow-hidden touch-pan-y select-none",
            isActive 
              ? "bg-primary/10 text-foreground" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            !isMenuOpen && "justify-center px-2"
          )}
          data-testid={`project-item-${project.id}`}
        >
          {isActive && isMenuOpen && (
            <motion.div
              layoutId="activeProjectIndicator"
              className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary"
            />
          )}

          {/* Icon and name row */}
          <div className="flex items-center gap-3">
            <Icon size={18} className={cn("shrink-0", isActive ? "text-primary" : "group-hover:text-foreground")} />
            
            {isMenuOpen && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-medium text-sm truncate"
              >
                {project.name}
              </motion.span>
            )}
          </div>

          {/* Progress bar - only when menu is open and project is active */}
          {isMenuOpen && isActive && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="pl-7"
            >
              <ProgressBar skills={project.skills || []} size="sm" areaOrProjectId={project.id} currentXp={project.currentXp} />
            </motion.div>
          )}
        </button>
      </PopoverAnchor>
      <PopoverContent 
        side="right" 
        align="start"
        className="w-44 p-1.5 rounded-xl border border-border/50 bg-popover/95 backdrop-blur-lg shadow-xl"
      >
        <div className="flex flex-col">
          <button
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors"
            onClick={() => {
              setIsViewDialogOpen(true);
              setIsPopoverOpen(false);
            }}
            data-testid={`button-view-project-${project.id}`}
          >
            <Eye className="h-4 w-4 text-muted-foreground" />
            Ver
          </button>
          <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
            <DialogTrigger asChild>
              <button
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors"
                data-testid={`button-rename-project-${project.id}`}
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
                Renombrar
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Renombrar Main Quest</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Input 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nuevo nombre"
                  data-testid="input-rename-project"
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => {
                      if (newName.trim()) {
                        onRename(newName.trim());
                        setIsRenameDialogOpen(false);
                        setIsPopoverOpen(false);
                      }
                    }} 
                    disabled={!newName.trim()}
                    className="flex-1"
                    data-testid="button-save-rename-project"
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <button
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors"
            onClick={() => {
              onArchive();
              setIsPopoverOpen(false);
            }}
            data-testid={`button-archive-project-${project.id}`}
          >
            <Archive className="h-4 w-4 text-muted-foreground" />
            Archivar
          </button>
          <div className="my-1 border-t border-border/30" />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors"
                data-testid={`button-delete-project-${project.id}`}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar "{project.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminará permanentemente este main quest y todas sus habilidades.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsPopoverOpen(false)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    onDelete();
                    setIsPopoverOpen(false);
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </PopoverContent>
      <ViewSourceDialog
        isOpen={isViewDialogOpen}
        onClose={() => setIsViewDialogOpen(false)}
        sourceName={project.name}
        sourceType="project"
        sourceId={project.id}
      />
    </Popover>
  );
}

export function AreaMenu() {
  const { 
    areas, activeAreaId, setActiveAreaId, createArea, deleteArea, archiveArea, unarchiveArea, archivedAreas, loadArchivedAreas,
    mainQuests, sideQuests, emergentQuests, experienceQuests, activeProjectId, setActiveProjectId, createProject, createSideQuest, createEmergentQuest, createExperienceQuest, deleteProject, archiveProject, unarchiveProject, archivedMainQuests, archivedSideQuests, archivedEmergentQuests, archivedExperienceQuests, loadArchivedProjects,
    renameArea, renameProject
  } = useSkillTree();
  const { user, logout } = useAuth();
  const { isMenuOpen: isOpen, setIsMenuOpen: setIsOpen } = useMenu();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<DialogStep>("choose");
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("Home");
  const [manualIconSelected, setManualIconSelected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchivedDialogOpen, setIsArchivedDialogOpen] = useState(false);
  const [viewingArchivedArea, setViewingArchivedArea] = useState<string | null>(null);
  const [viewingArchivedProject, setViewingArchivedProject] = useState<string | null>(null);
  const [emergentExpanded, setEmergentExpanded] = useState(true);
  const [experienceExpanded, setExperienceExpanded] = useState(true);
  
  // Emergent Quest multi-step form state
  const [emergentStep, setEmergentStep] = useState(1);
  const [emergentWhatHappened, setEmergentWhatHappened] = useState("");
  const [emergentConsequences, setEmergentConsequences] = useState("");
  const [emergentWhyMatters, setEmergentWhyMatters] = useState("");
  const [emergentObjective, setEmergentObjective] = useState("");
  const [emergentAction, setEmergentAction] = useState("");
  const [emergentNodeTitle, setEmergentNodeTitle] = useState("");

  useEffect(() => {
    if (isArchivedDialogOpen) {
      loadArchivedAreas();
      loadArchivedProjects();
    }
  }, [isArchivedDialogOpen]);

  useEffect(() => {
    if (itemName && !manualIconSelected) {
      const detected = getIconForTitle(itemName);
      setSelectedIcon(detected);
    }
  }, [itemName, manualIconSelected]);

  const handleDialogClose = (open: boolean) => {
    setIsAddOpen(open);
    if (!open) {
      setDialogStep("choose");
      setItemName("");
      setItemDescription("");
      setSelectedIcon("Home");
      setManualIconSelected(false);
      // Reset emergent form state
      setEmergentStep(1);
      setEmergentWhatHappened("");
      setEmergentConsequences("");
      setEmergentWhyMatters("");
      setEmergentObjective("");
      setEmergentAction("");
      setEmergentNodeTitle("");
    }
  };

  const handleCreateArea = async () => {
    if (!itemName.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await createArea(itemName.trim(), itemDescription.trim(), selectedIcon);
      
      setIsAddOpen(false);
      setDialogStep("choose");
      setItemName("");
      setItemDescription("");
      setSelectedIcon("Home");
      setManualIconSelected(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProject = async () => {
    if (!itemName.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await createProject(itemName.trim(), itemDescription.trim(), selectedIcon);
      
      setIsAddOpen(false);
      setDialogStep("choose");
      setItemName("");
      setItemDescription("");
      setSelectedIcon("Home");
      setManualIconSelected(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSideQuest = async () => {
    if (!itemName.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await createSideQuest(itemName.trim(), itemDescription.trim(), selectedIcon);
      
      setIsAddOpen(false);
      setDialogStep("choose");
      setItemName("");
      setItemDescription("");
      setSelectedIcon("Home");
      setManualIconSelected(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateExperienceQuest = async () => {
    if (!itemName.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await createExperienceQuest(itemName.trim(), itemDescription.trim(), selectedIcon);
      
      setIsAddOpen(false);
      setDialogStep("choose");
      setItemName("");
      setItemDescription("");
      setSelectedIcon("Home");
      setManualIconSelected(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateEmergentQuest = async () => {
    if (!emergentObjective.trim() || !emergentNodeTitle.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const description = `${emergentWhatHappened}\n\n${emergentConsequences}\n\n${emergentWhyMatters}`;
      await createEmergentQuest(
        emergentObjective.trim(), 
        description.trim(), 
        "Zap", 
        emergentNodeTitle.trim(), 
        emergentAction.trim()
      );
      
      setIsAddOpen(false);
      setDialogStep("choose");
      setEmergentStep(1);
      setEmergentWhatHappened("");
      setEmergentConsequences("");
      setEmergentWhyMatters("");
      setEmergentObjective("");
      setEmergentAction("");
      setEmergentNodeTitle("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderForm = (type: "area" | "project" | "sidequest" | "experience") => (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Icono</Label>
        <div className="grid grid-cols-7 gap-2">
          {availableIcons.map(({ name, icon: IconComp }) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setSelectedIcon(name);
                setManualIconSelected(true);
              }}
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                selectedIcon === name 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              )}
              data-testid={`icon-${name.toLowerCase()}`}
            >
              <IconComp size={18} />
            </button>
          ))}
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="item-name">Título</Label>
        <Input 
          id="item-name" 
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder={type === "area" ? "ej: Guitarra, Cocina..." : type === "project" ? "ej: Lanzar mi app, Renovar casa..." : type === "experience" ? "ej: Aprender React, Dominar Git..." : "ej: Organizar garage, Leer libro..."}
          data-testid="input-item-name"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="item-description">Descripción</Label>
        <Textarea 
          id="item-description" 
          value={itemDescription}
          onChange={(e) => setItemDescription(e.target.value)}
          placeholder={type === "area" ? "Describe esta área de desarrollo" : type === "project" ? "Describe este main quest" : type === "experience" ? "Describe este experience quest" : "Describe este side quest"}
          rows={3}
          data-testid="input-item-description"
        />
      </div>
      
      <div className="flex gap-2 pt-2">
        <Button 
          variant="outline" 
          onClick={() => {
            setDialogStep("choose");
            setItemName("");
            setItemDescription("");
            setSelectedIcon("Home");
          }}
          className="flex-1"
          disabled={isSubmitting}
        >
          Atrás
        </Button>
        <Button 
          onClick={type === "area" ? handleCreateArea : type === "project" ? handleCreateProject : type === "experience" ? handleCreateExperienceQuest : handleCreateSideQuest}
          disabled={!itemName.trim() || isSubmitting}
          className="flex-1"
          data-testid={`button-create-${type}`}
        >
          {isSubmitting ? "Creando..." : "Hecho"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {isOpen ? (
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: 256 }}
          exit={{ width: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="h-full border-r border-border bg-card/50 backdrop-blur-xl flex flex-col z-30 relative overflow-hidden"
        >
          <div className="p-4 flex items-center justify-between border-b border-border h-[60px]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="overflow-hidden"
            >
              <h1 className="text-lg font-bold tracking-tight whitespace-nowrap">
                LIFEGAME {user && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button 
                        className="font-normal text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        data-testid="button-username"
                      >
                        | {user.username}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="start" className="w-40 p-2 border-0 shadow-2xl">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                        onClick={logout}
                        data-testid="button-logout"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Cerrar sesión
                      </Button>
                    </PopoverContent>
                  </Popover>
                )}
              </h1>
            </motion.div>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="ml-auto h-7 w-7 rounded-full bg-transparent flex items-center justify-center"
              title="Cerrar menú"
              aria-label="Cerrar menú"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 transition-colors hover:bg-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-1 px-2 scrollbar-hide overscroll-contain">
            <div className="px-3 py-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Áreas
              </span>
            </div>

            {areas.length === 0 ? (
              <div className="text-xs text-muted-foreground px-3 py-2 italic">
                Sin áreas aún
              </div>
            ) : (
              areas.map((area) => (
                <AreaItem
                  key={area.id}
                  area={area}
                  isActive={area.id === activeAreaId}
                  isMenuOpen={isOpen}
                  onSelect={() => setActiveAreaId(area.id)}
                  onDelete={() => deleteArea(area.id)}
                  onArchive={() => archiveArea(area.id)}
                  onRename={(name) => renameArea(area.id, name)}
                />
              ))
            )}

        <div className="my-3 border-t border-border" />

        {isOpen && (
          <div className="px-3 py-1" data-onboarding="main-quests">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Main Quest
            </span>
          </div>
        )}

        {mainQuests.length === 0 ? (
          <div className="text-xs text-muted-foreground px-3 py-2 italic" data-onboarding="main-quests">
            {isOpen ? "Sin main quests aún" : "—"}
          </div>
        ) : (
          mainQuests.map((project, index) => (
            <ProjectItem
              key={project.id}
              project={project}
              isActive={project.id === activeProjectId}
              isMenuOpen={isOpen}
              onSelect={() => setActiveProjectId(project.id)}
              onDelete={() => deleteProject(project.id)}
              onArchive={() => archiveProject(project.id)}
              onRename={(name) => renameProject(project.id, name)}
            />
          ))
        )}

        <div className="my-3 border-t border-border" />

        {isOpen && (
          <div className="px-3 py-1" data-onboarding="side-quests">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Side Quest
            </span>
          </div>
        )}

        {sideQuests.length === 0 ? (
          <div className="text-xs text-muted-foreground px-3 py-2 italic" data-onboarding="side-quests">
            {isOpen ? "Sin side quests aún" : "—"}
          </div>
        ) : (
          sideQuests.map((project, index) => (
            <ProjectItem
              key={project.id}
              project={project}
              isActive={project.id === activeProjectId}
              isMenuOpen={isOpen}
              onSelect={() => setActiveProjectId(project.id)}
              onDelete={() => deleteProject(project.id)}
              onArchive={() => archiveProject(project.id)}
              onRename={(name) => renameProject(project.id, name)}
            />
          ))
        )}

        {emergentQuests.length > 0 && (
          <div className="mt-2 ml-2">
            {isOpen && (
              <button
                onClick={() => setEmergentExpanded(!emergentExpanded)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-amber-500/80 hover:text-amber-400 transition-colors"
                data-testid="button-toggle-emergent"
              >
                {emergentExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Zap size={12} />
                <span className="font-medium">Emergent</span>
                <span className="text-muted-foreground">({emergentQuests.length})</span>
              </button>
            )}
            {emergentExpanded && emergentQuests.map((project) => (
              <ProjectItem
                key={project.id}
                project={project}
                isActive={project.id === activeProjectId}
                isMenuOpen={isOpen}
                onSelect={() => setActiveProjectId(project.id)}
                onDelete={() => deleteProject(project.id)}
                onArchive={() => archiveProject(project.id)}
                onRename={(name) => renameProject(project.id, name)}
              />
            ))}
          </div>
        )}

        {experienceQuests.length > 0 && (
          <div className="mt-2 ml-2">
            {isOpen && (
              <button
                onClick={() => setExperienceExpanded(!experienceExpanded)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-500/80 hover:text-emerald-400 transition-colors"
                data-testid="button-toggle-experience"
              >
                {experienceExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Mountain size={12} />
                <span className="font-medium">Experience</span>
                <span className="text-muted-foreground">({experienceQuests.length})</span>
              </button>
            )}
            {experienceExpanded && experienceQuests.map((project) => (
              <ProjectItem
                key={project.id}
                project={project}
                isActive={project.id === activeProjectId}
                isMenuOpen={isOpen}
                onSelect={() => setActiveProjectId(project.id)}
                onDelete={() => deleteProject(project.id)}
                onArchive={() => archiveProject(project.id)}
                onRename={(name) => renameProject(project.id, name)}
              />
            ))}
          </div>
        )}
          </div>

        <div className={cn("p-2 flex flex-col gap-1", isOpen ? "items-start" : "items-center")}>
          <Dialog open={isAddOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <button
                className="group flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground transition-all duration-200 rounded-md hover:bg-muted/50"
                data-testid="button-add"
                data-onboarding="add-button"
              >
                <Plus size={18} className="shrink-0" />
                <span className={cn(
                  "text-sm font-medium overflow-hidden transition-all duration-200",
                  isOpen ? "max-w-[100px] opacity-100" : "max-w-0 opacity-0 group-hover:max-w-[100px] group-hover:opacity-100"
                )}>
                  Agregar
                    </span>
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  {dialogStep === "choose" && (
                    <>
                      <DialogHeader>
                        <DialogTitle>Agregar Nuevo</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline" 
                      className="h-24 flex flex-col gap-2"
                      onClick={() => setDialogStep("new-area")}
                      data-testid="button-new-area"
                    >
                      <Plus className="h-6 w-6" />
                      <span>Nueva Área</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-24 flex flex-col gap-2"
                      onClick={() => setDialogStep("new-project")}
                      data-testid="button-new-project"
                    >
                      <Compass className="h-6 w-6" />
                      <span>Main Quest</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-24 flex flex-col gap-2"
                      onClick={() => setDialogStep("new-sidequest")}
                      data-testid="button-new-sidequest"
                    >
                      <Scroll className="h-6 w-6" />
                      <span>Side Quest</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-24 flex flex-col gap-2 border-amber-500/50 hover:border-amber-500 hover:bg-amber-500/10"
                      onClick={() => setDialogStep("new-emergent")}
                      data-testid="button-new-emergent"
                    >
                      <Zap className="h-6 w-6 text-amber-500" />
                      <span>Emergent Quest</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-24 flex flex-col gap-2 border-emerald-500/50 hover:border-emerald-500 hover:bg-emerald-500/10"
                      onClick={() => setDialogStep("new-experience")}
                      data-testid="button-new-experience"
                    >
                      <Mountain className="h-6 w-6 text-emerald-500" />
                      <span>Experience Quest</span>
                    </Button>
                  </div>
                </div>
              </>
            )}

            {dialogStep === "new-area" && (
              <>
                <DialogHeader>
                  <DialogTitle>Nueva Área</DialogTitle>
                </DialogHeader>
                {renderForm("area")}
              </>
            )}

            {dialogStep === "new-project" && (
              <>
                <DialogHeader>
                  <DialogTitle>Nuevo Main Quest</DialogTitle>
                </DialogHeader>
                {renderForm("project")}
              </>
            )}

            {dialogStep === "new-sidequest" && (
              <>
                <DialogHeader>
                  <DialogTitle>Nuevo Side Quest</DialogTitle>
                </DialogHeader>
                {renderForm("sidequest")}
              </>
            )}

            {dialogStep === "new-experience" && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-emerald-400 flex items-center gap-2">
                    <Mountain className="h-5 w-5" />
                    Nuevo Experience Quest
                  </DialogTitle>
                </DialogHeader>
                {renderForm("experience")}
              </>
            )}

            {dialogStep === "new-emergent" && (
              <div className="bg-zinc-900 -m-6 p-6 rounded-lg">
                <DialogHeader>
                  <DialogTitle className="text-amber-400 flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Nuevo Emergent Quest
                  </DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Paso {emergentStep} de 6
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-6 space-y-4">
                  {emergentStep === 1 && (
                    <div className="space-y-3">
                      <Label className="text-zinc-200 text-lg">¿Qué pasó?</Label>
                      <Textarea 
                        value={emergentWhatHappened}
                        onChange={(e) => setEmergentWhatHappened(e.target.value)}
                        placeholder="Describe el evento o situación que surgió..."
                        rows={4}
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                        data-testid="input-emergent-what-happened"
                      />
                    </div>
                  )}
                  {emergentStep === 2 && (
                    <div className="space-y-3">
                      <Label className="text-zinc-200 text-lg">¿Qué consecuencias trae?</Label>
                      <Textarea 
                        value={emergentConsequences}
                        onChange={(e) => setEmergentConsequences(e.target.value)}
                        placeholder="¿Qué impacto tiene esto en tu vida?"
                        rows={4}
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                        data-testid="input-emergent-consequences"
                      />
                    </div>
                  )}
                  {emergentStep === 3 && (
                    <div className="space-y-3">
                      <Label className="text-zinc-200 text-lg">¿Por qué te importa?</Label>
                      <Textarea 
                        value={emergentWhyMatters}
                        onChange={(e) => setEmergentWhyMatters(e.target.value)}
                        placeholder="¿Por qué es importante para vos resolver esto?"
                        rows={4}
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                        data-testid="input-emergent-why-matters"
                      />
                    </div>
                  )}
                  {emergentStep === 4 && (
                    <div className="space-y-3">
                      <Label className="text-zinc-200 text-lg">¿Cuál es tu objetivo?</Label>
                      <Input 
                        value={emergentObjective}
                        onChange={(e) => setEmergentObjective(e.target.value)}
                        placeholder="Define el objetivo de esta quest..."
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                        data-testid="input-emergent-objective"
                      />
                      <p className="text-xs text-zinc-500">Este será el nombre de tu quest</p>
                    </div>
                  )}
                  {emergentStep === 5 && (
                    <div className="space-y-3">
                      <Label className="text-zinc-200 text-lg">¿Qué podés hacer al respecto?</Label>
                      <Textarea 
                        value={emergentAction}
                        onChange={(e) => setEmergentAction(e.target.value)}
                        placeholder="Describe la primera acción concreta que podés tomar..."
                        rows={4}
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                        data-testid="input-emergent-action"
                      />
                    </div>
                  )}
                  {emergentStep === 6 && (
                    <div className="space-y-3">
                      <Label className="text-zinc-200 text-lg">¿Lo podés abreviar en tres palabras?</Label>
                      <Input 
                        value={emergentNodeTitle}
                        onChange={(e) => setEmergentNodeTitle(e.target.value)}
                        placeholder="ej: Llamar al mecánico"
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                        data-testid="input-emergent-node-title"
                      />
                      <p className="text-xs text-zinc-500">Este será el título de tu primer nodo</p>
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        if (emergentStep === 1) {
                          setDialogStep("choose");
                          setEmergentStep(1);
                          setEmergentWhatHappened("");
                          setEmergentConsequences("");
                          setEmergentWhyMatters("");
                          setEmergentObjective("");
                          setEmergentAction("");
                          setEmergentNodeTitle("");
                        } else {
                          setEmergentStep(s => s - 1);
                        }
                      }}
                      className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                      disabled={isSubmitting}
                    >
                      {emergentStep === 1 ? "Cancelar" : "Atrás"}
                    </Button>
                    {emergentStep < 6 ? (
                      <Button 
                        onClick={() => setEmergentStep(s => s + 1)}
                        className="flex-1 bg-amber-600 hover:bg-amber-500 text-white"
                        disabled={
                          (emergentStep === 1 && !emergentWhatHappened.trim()) ||
                          (emergentStep === 2 && !emergentConsequences.trim()) ||
                          (emergentStep === 3 && !emergentWhyMatters.trim()) ||
                          (emergentStep === 4 && !emergentObjective.trim()) ||
                          (emergentStep === 5 && !emergentAction.trim())
                        }
                      >
                        Siguiente
                      </Button>
                    ) : (
                      <Button 
                        onClick={handleCreateEmergentQuest}
                        disabled={!emergentNodeTitle.trim() || isSubmitting}
                        className="flex-1 bg-amber-600 hover:bg-amber-500 text-white"
                        data-testid="button-create-emergent"
                      >
                        {isSubmitting ? "Creando..." : "Crear Quest"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={isArchivedDialogOpen} onOpenChange={setIsArchivedDialogOpen}>
          <DialogTrigger asChild>
            <button
              className="group flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground transition-all duration-200 rounded-md hover:bg-muted/50"
              data-testid="button-open-archived"
            >
              <Swords size={18} className="shrink-0" />
              <span className={cn(
                "text-sm font-medium overflow-hidden transition-all duration-200",
                isOpen ? "max-w-[100px] opacity-100" : "max-w-0 opacity-0 group-hover:max-w-[100px] group-hover:opacity-100"
              )}>
                Conquistados
              </span>
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] border-yellow-500/30 bg-gradient-to-b from-yellow-50/50 to-white dark:from-yellow-950/30 dark:to-background">
            <DialogHeader className="border-b border-yellow-500/20 pb-4 bg-gradient-to-r from-yellow-500/10 to-amber-500/5">
              <DialogTitle className="flex items-center gap-2 text-yellow-900 dark:text-yellow-100">
                <Swords size={18} className="text-yellow-600 dark:text-yellow-400" />
                🏆 Quests Conquistados
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {archivedAreas.length === 0 && archivedMainQuests.length === 0 && archivedSideQuests.length === 0 && archivedEmergentQuests.length === 0 ? (
                <div className="text-center text-yellow-600/60 dark:text-yellow-400/60 py-8">
                  <Swords className="mx-auto h-12 w-12 mb-3 opacity-40 text-yellow-500" />
                  <p className="font-medium">No hay quests conquistados</p>
                </div>
              ) : (
                <>
                  {archivedAreas.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-black text-yellow-700 dark:text-yellow-300 uppercase tracking-wider px-1 flex items-center gap-1">📍 Áreas</h3>
                      {archivedAreas.map((area) => {
                        const Icon = extendedIconMap[area.icon] || extendedIconMap.Home;
                        const isViewing = viewingArchivedArea === area.id;
                        return (
                          <div 
                            key={area.id} 
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                              isViewing ? "bg-gradient-to-br from-yellow-400/40 to-amber-400/30 border-yellow-400 shadow-md shadow-yellow-500/20" : "bg-gradient-to-br from-yellow-500/15 to-amber-500/10 border-yellow-400/50 hover:border-yellow-400 hover:from-yellow-500/25 hover:to-amber-500/15"
                            )}
                            onClick={() => {
                              setViewingArchivedArea(isViewing ? null : area.id);
                              setViewingArchivedProject(null);
                              if (!isViewing) {
                                setActiveAreaId(area.id);
                                setIsArchivedDialogOpen(false);
                              }
                            }}
                            data-testid={`archived-area-${area.id}`}
                          >
                            <Icon size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold truncate text-yellow-900 dark:text-yellow-100">{area.name}</p>
                              {area.description && (
                                <p className="text-sm text-yellow-700/70 dark:text-yellow-300/70 truncate">{area.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  unarchiveArea(area.id);
                                }}
                                title="Restaurar"
                                className="hover:text-yellow-600 dark:hover:text-yellow-400"
                                data-testid={`button-unarchive-area-${area.id}`}
                              >
                                <ArchiveRestore size={16} />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-destructive hover:text-destructive"
                                    title="Eliminar"
                                    data-testid={`button-delete-archived-area-${area.id}`}
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar "{area.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Se eliminará permanentemente esta área y todas sus habilidades.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteArea(area.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {archivedMainQuests.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-black text-yellow-700 dark:text-yellow-300 uppercase tracking-wider px-1 flex items-center gap-1">⚔️ Main Quest</h3>
                      {archivedMainQuests.map((project) => {
                        const Icon = extendedIconMap[project.icon] || FolderKanban;
                        const isViewing = viewingArchivedProject === project.id;
                        return (
                          <div 
                            key={project.id} 
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                              isViewing ? "bg-gradient-to-br from-yellow-400/40 to-amber-400/30 border-yellow-400 shadow-md shadow-yellow-500/20" : "bg-gradient-to-br from-yellow-500/15 to-amber-500/10 border-yellow-400/50 hover:border-yellow-400 hover:from-yellow-500/25 hover:to-amber-500/15"
                            )}
                            onClick={() => {
                              setViewingArchivedProject(isViewing ? null : project.id);
                              setViewingArchivedArea(null);
                              if (!isViewing) {
                                setActiveProjectId(project.id);
                                setIsArchivedDialogOpen(false);
                              }
                            }}
                            data-testid={`archived-project-${project.id}`}
                          >
                            <Icon size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold truncate text-yellow-900 dark:text-yellow-100">{project.name}</p>
                              {project.description && (
                                <p className="text-sm text-yellow-700/70 dark:text-yellow-300/70 truncate">{project.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  unarchiveProject(project.id);
                                }}
                                title="Restaurar"
                                className="hover:text-yellow-600 dark:hover:text-yellow-400"
                                data-testid={`button-unarchive-project-${project.id}`}
                              >
                                <ArchiveRestore size={16} />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-destructive hover:text-destructive"
                                    title="Eliminar"
                                    data-testid={`button-delete-archived-project-${project.id}`}
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar "{project.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Se eliminará permanentemente este main quest y todas sus habilidades.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteProject(project.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {archivedSideQuests.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-black text-yellow-700 dark:text-yellow-300 uppercase tracking-wider px-1 flex items-center gap-1">🗺️ Side Quest</h3>
                      {archivedSideQuests.map((project) => {
                        const Icon = extendedIconMap[project.icon] || FolderKanban;
                        const isViewing = viewingArchivedProject === project.id;
                        return (
                          <div 
                            key={project.id} 
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                              isViewing ? "bg-gradient-to-br from-yellow-400/40 to-amber-400/30 border-yellow-400 shadow-md shadow-yellow-500/20" : "bg-gradient-to-br from-yellow-500/15 to-amber-500/10 border-yellow-400/50 hover:border-yellow-400 hover:from-yellow-500/25 hover:to-amber-500/15"
                            )}
                            onClick={() => {
                              setViewingArchivedProject(isViewing ? null : project.id);
                              setViewingArchivedArea(null);
                              if (!isViewing) {
                                setActiveProjectId(project.id);
                                setIsArchivedDialogOpen(false);
                              }
                            }}
                            data-testid={`archived-sidequest-${project.id}`}
                          >
                            <Icon size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold truncate text-yellow-900 dark:text-yellow-100">{project.name}</p>
                              {project.description && (
                                <p className="text-sm text-yellow-700/70 dark:text-yellow-300/70 truncate">{project.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  unarchiveProject(project.id);
                                }}
                                title="Restaurar"
                                className="hover:text-yellow-600 dark:hover:text-yellow-400"
                                data-testid={`button-unarchive-sidequest-${project.id}`}
                              >
                                <ArchiveRestore size={16} />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-destructive hover:text-destructive"
                                    title="Eliminar"
                                    data-testid={`button-delete-archived-sidequest-${project.id}`}
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar "{project.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Se eliminará permanentemente este side quest y todas sus habilidades.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteProject(project.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {archivedEmergentQuests.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-black text-yellow-700 dark:text-yellow-300 uppercase tracking-wider px-1 flex items-center gap-1">
                        ⚡ Emergent Quest
                      </h3>
                      {archivedEmergentQuests.map((project) => {
                        const isViewing = viewingArchivedProject === project.id;
                        return (
                          <div 
                            key={project.id} 
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                              isViewing ? "bg-gradient-to-br from-yellow-400/40 to-amber-400/30 border-yellow-400 shadow-md shadow-yellow-500/20" : "bg-gradient-to-br from-yellow-500/15 to-amber-500/10 border-yellow-400/50 hover:border-yellow-400 hover:from-yellow-500/25 hover:to-amber-500/15"
                            )}
                            onClick={() => {
                              setViewingArchivedProject(isViewing ? null : project.id);
                              setViewingArchivedArea(null);
                              if (!isViewing) {
                                setActiveProjectId(project.id);
                                setIsArchivedDialogOpen(false);
                              }
                            }}
                            data-testid={`archived-emergent-${project.id}`}
                          >
                            <Zap size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold truncate text-yellow-900 dark:text-yellow-100">{project.name}</p>
                              {project.description && (
                                <p className="text-sm text-yellow-700/70 dark:text-yellow-300/70 truncate">{project.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  unarchiveProject(project.id);
                                }}
                                title="Restaurar"
                                className="hover:text-yellow-600 dark:hover:text-yellow-400"
                                data-testid={`button-unarchive-emergent-${project.id}`}
                              >
                                <ArchiveRestore size={16} />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-destructive hover:text-destructive"
                                    title="Eliminar"
                                    data-testid={`button-delete-archived-emergent-${project.id}`}
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar "{project.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Se eliminará permanentemente este emergent quest y todas sus habilidades.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteProject(project.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {archivedExperienceQuests.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-black text-yellow-700 dark:text-yellow-300 uppercase tracking-wider px-1 flex items-center gap-1">
                        🏔️ Experience Quest
                      </h3>
                      {archivedExperienceQuests.map((project) => {
                        const isViewing = viewingArchivedProject === project.id;
                        return (
                          <div 
                            key={project.id} 
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                              isViewing ? "bg-gradient-to-br from-yellow-400/40 to-amber-400/30 border-yellow-400 shadow-md shadow-yellow-500/20" : "bg-gradient-to-br from-yellow-500/15 to-amber-500/10 border-yellow-400/50 hover:border-yellow-400 hover:from-yellow-500/25 hover:to-amber-500/15"
                            )}
                            onClick={() => {
                              setViewingArchivedProject(isViewing ? null : project.id);
                              setViewingArchivedArea(null);
                              if (!isViewing) {
                                setActiveProjectId(project.id);
                                setIsArchivedDialogOpen(false);
                              }
                            }}
                            data-testid={`archived-experience-${project.id}`}
                          >
                            <Mountain size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold truncate text-yellow-900 dark:text-yellow-100">{project.name}</p>
                              {project.description && (
                                <p className="text-sm text-yellow-700/70 dark:text-yellow-300/70 truncate">{project.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  unarchiveProject(project.id);
                                }}
                                title="Restaurar"
                                className="hover:text-yellow-600 dark:hover:text-yellow-400"
                                data-testid={`button-unarchive-experience-${project.id}`}
                              >
                                <ArchiveRestore size={16} />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-destructive hover:text-destructive"
                                    title="Eliminar"
                                    data-testid={`button-delete-archived-experience-${project.id}`}
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar "{project.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Se eliminará permanentemente este experience quest y todas sus habilidades.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteProject(project.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
        </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="fixed left-4 top-4 z-30"
        >
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="h-7 w-7 rounded-full bg-transparent flex items-center justify-center"
            title="Abrir menú"
            aria-label="Abrir menú"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 transition-colors hover:bg-foreground" />
          </button>
        </motion.div>
      )}
    </>
  );
}
