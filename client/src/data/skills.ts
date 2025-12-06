import { LucideIcon, Music, Trophy, BookOpen, Home } from "lucide-react";

export type SkillStatus = "locked" | "available" | "mastered";

export interface Skill {
  id: string;
  title: string;
  description: string;
  status: SkillStatus;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  dependencies: string[];
}

export interface Area {
  id: string;
  name: string;
  icon: any; // LucideIcon
  color: string; // Tailwind class or hex
  description: string;
  skills: Skill[];
}

export const INITIAL_AREAS: Area[] = [
  {
    id: "guitar",
    name: "Guitarra",
    icon: Music,
    color: "text-cyan-400",
    description: "Dominio del instrumento y teoría musical.",
    skills: [
      { id: "g1", title: "Acordes Básicos", description: "Aprender C, D, E, G, A", status: "mastered", x: 50, y: 80, dependencies: [] },
      { id: "g2", title: "Ritmo 4/4", description: "Rasgueo básico abajo-arriba", status: "mastered", x: 30, y: 60, dependencies: ["g1"] },
      { id: "g3", title: "Escala Pentatónica", description: "Posición 1 en Am", status: "available", x: 70, y: 60, dependencies: ["g1"] },
      { id: "g4", title: "Acordes con Cejilla", description: "Dominar F y Bm", status: "locked", x: 50, y: 40, dependencies: ["g2", "g3"] },
      { id: "g5", title: "Improvisación", description: "Solos básicos sobre Blues", status: "locked", x: 50, y: 20, dependencies: ["g4"] },
    ]
  },
  {
    id: "football",
    name: "Fútbol",
    icon: Trophy,
    color: "text-green-400",
    description: "Técnica, físico y táctica.",
    skills: [
      { id: "f1", title: "Control de Balón", description: "Dominadas y recepción", status: "mastered", x: 50, y: 85, dependencies: [] },
      { id: "f2", title: "Pase Corto", description: "Precisión a 5 metros", status: "available", x: 40, y: 65, dependencies: ["f1"] },
      { id: "f3", title: "Resistencia", description: "Correr 30 mins sin parar", status: "available", x: 60, y: 65, dependencies: ["f1"] },
      { id: "f4", title: "Tiro a Puerta", description: "Potencia y colocación", status: "locked", x: 50, y: 45, dependencies: ["f2", "f3"] },
    ]
  },
  {
    id: "literature",
    name: "Literatura",
    icon: BookOpen,
    color: "text-purple-400",
    description: "Lectura crítica y escritura creativa.",
    skills: [
      { id: "l1", title: "Hábito de Lectura", description: "Leer 15 mins al día", status: "mastered", x: 50, y: 80, dependencies: [] },
      { id: "l2", title: "Clásicos Rusos", description: "Leer Dostoievski", status: "available", x: 30, y: 50, dependencies: ["l1"] },
      { id: "l3", title: "Realismo Mágico", description: "Leer García Márquez", status: "available", x: 70, y: 50, dependencies: ["l1"] },
      { id: "l4", title: "Escritura de Cuento", description: "Escribir un cuento corto", status: "locked", x: 50, y: 20, dependencies: ["l2", "l3"] },
    ]
  },
  {
    id: "house",
    name: "Casa",
    icon: Home,
    color: "text-amber-400",
    description: "Mantenimiento, cocina y organización.",
    skills: [
      { id: "h1", title: "Limpieza Básica", description: "Rutina semanal", status: "mastered", x: 50, y: 80, dependencies: [] },
      { id: "h2", title: "Cocina: Arroz", description: "Hacer arroz perfecto", status: "available", x: 40, y: 60, dependencies: ["h1"] },
      { id: "h3", title: "Reparaciones", description: "Cambiar un foco/enchufe", status: "locked", x: 60, y: 60, dependencies: ["h1"] },
    ]
  }
];
