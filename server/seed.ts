import { db } from "./db";
import { areas, skills } from "@shared/schema";

const INITIAL_AREAS = [
  {
    id: "guitar",
    name: "Guitarra",
    icon: "Music",
    color: "text-zinc-800 dark:text-zinc-200",
    description: "Dominio del instrumento y teoría musical.",
  },
  {
    id: "football",
    name: "Fútbol",
    icon: "Trophy",
    color: "text-zinc-800 dark:text-zinc-200",
    description: "Técnica, físico y táctica.",
  },
  {
    id: "literature",
    name: "Literatura",
    icon: "BookOpen",
    color: "text-zinc-800 dark:text-zinc-200",
    description: "Lectura crítica y escritura creativa.",
  },
  {
    id: "house",
    name: "Casa",
    icon: "Home",
    color: "text-zinc-800 dark:text-zinc-200",
    description: "Mantenimiento, cocina y organización.",
  },
];

const INITIAL_SKILLS = [
  { id: "g1", areaId: "guitar", title: "Acordes Básicos", description: "Aprender C, D, E, G, A", status: "mastered", x: 50, y: 100, dependencies: [], manualLock: 0 },
  { id: "g2", areaId: "guitar", title: "Ritmo 4/4", description: "Rasgueo básico abajo-arriba", status: "mastered", x: 50, y: 250, dependencies: ["g1"], manualLock: 0 },
  { id: "g3", areaId: "guitar", title: "Escala Pentatónica", description: "Posición 1 en Am", status: "available", x: 50, y: 400, dependencies: ["g2"], manualLock: 0 },
  { id: "g4", areaId: "guitar", title: "Acordes con Cejilla", description: "Dominar F y Bm", status: "locked", x: 50, y: 550, dependencies: ["g3"], manualLock: 0 },
  { id: "g5", areaId: "guitar", title: "Improvisación", description: "Solos básicos sobre Blues", status: "locked", x: 50, y: 700, dependencies: ["g4"], manualLock: 0 },
  
  { id: "f1", areaId: "football", title: "Control de Balón", description: "Dominadas y recepción", status: "mastered", x: 50, y: 100, dependencies: [], manualLock: 0 },
  { id: "f2", areaId: "football", title: "Pase Corto", description: "Precisión a 5 metros", status: "available", x: 50, y: 250, dependencies: ["f1"], manualLock: 0 },
  { id: "f3", areaId: "football", title: "Resistencia", description: "Correr 30 mins sin parar", status: "locked", x: 50, y: 400, dependencies: ["f2"], manualLock: 0 },
  { id: "f4", areaId: "football", title: "Tiro a Puerta", description: "Potencia y colocación", status: "locked", x: 50, y: 550, dependencies: ["f3"], manualLock: 0 },
  
  { id: "l1", areaId: "literature", title: "Hábito de Lectura", description: "Leer 15 mins al día", status: "mastered", x: 50, y: 100, dependencies: [], manualLock: 0 },
  { id: "l2", areaId: "literature", title: "Clásicos Rusos", description: "Leer Dostoievski", status: "available", x: 50, y: 250, dependencies: ["l1"], manualLock: 0 },
  { id: "l3", areaId: "literature", title: "Realismo Mágico", description: "Leer García Márquez", status: "locked", x: 50, y: 400, dependencies: ["l2"], manualLock: 0 },
  { id: "l4", areaId: "literature", title: "Escritura de Cuento", description: "Escribir un cuento corto", status: "locked", x: 50, y: 550, dependencies: ["l3"], manualLock: 0 },
  
  { id: "h1", areaId: "house", title: "Limpieza Básica", description: "Rutina semanal", status: "mastered", x: 50, y: 100, dependencies: [], manualLock: 0 },
  { id: "h2", areaId: "house", title: "Cocina: Arroz", description: "Hacer arroz perfecto", status: "available", x: 50, y: 250, dependencies: ["h1"], manualLock: 0 },
  { id: "h3", areaId: "house", title: "Reparaciones", description: "Cambiar un foco/enchufe", status: "locked", x: 50, y: 400, dependencies: ["h2"], manualLock: 0 },
];

async function seed() {
  console.log("Seeding database...");
  
  // Check if data already exists
  const existingAreas = await db.select().from(areas);
  if (existingAreas.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  // Insert areas
  await db.insert(areas).values(INITIAL_AREAS);
  console.log("Areas seeded");

  // Insert skills
  await db.insert(skills).values(INITIAL_SKILLS);
  console.log("Skills seeded");

  console.log("Database seeding complete!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Error seeding database:", error);
  process.exit(1);
});
