import type { Skill } from "@/lib/skill-context";

// Títulos con los que el server crea los pasos todavía sin nombrar de un nivel de sub-árbol.
const SUB_SKILL_PLACEHOLDER_TITLES = new Set(["", "?", "Asigná un paso"]);

export function isSubSkillPlaceholder(s: Skill): boolean {
  return (s.levelPosition || 0) > 1 && s.status !== "mastered" && SUB_SKILL_PLACEHOLDER_TITLES.has((s.title || "").trim());
}

const byOrder = (a: Skill, b: Skill) => (a.level - b.level) || ((a.levelPosition || 0) - (b.levelPosition || 0));

export async function fetchSubSkills(parentSkillId: string): Promise<Skill[]> {
  const res = await fetch(`/api/skills/${parentSkillId}/subskills`);
  const data = res.ok ? await res.json() : [];
  return Array.isArray(data) ? data : [];
}

async function patchSkill(id: string, body: Record<string, unknown>) {
  return fetch(`/api/skills/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// En un sub-árbol, el nodo final del nivel es siempre el último de los sub-nodos creados: los
// pasos sin nombrar que el nivel generado traía de relleno ("Asigná un paso", sin confirmar) y
// que quedan después del último nodo creado/nombrado se borran, y el flag de nodo final pasa a
// ese último nodo. Los nodos ya nombrados que estén después del creado se respetan (el final
// pasa a ser el último de ellos).
export async function makeLastCreatedSubSkillFinal(parentSkillId: string, level: number, createdSkillId: string) {
  const levelNodes = (await fetchSubSkills(parentSkillId)).filter(s => s.level === level).sort(byOrder);
  const createdIdx = levelNodes.findIndex(s => s.id === createdSkillId);
  if (createdIdx === -1) return;

  let lastRealIdx = createdIdx;
  levelNodes.forEach((s, i) => {
    if (i > lastRealIdx && !isSubSkillPlaceholder(s)) lastRealIdx = i;
  });

  // De atrás para adelante: el server renumera el nivel después de cada borrado.
  const toDelete = levelNodes.slice(lastRealIdx + 1).filter(isSubSkillPlaceholder).reverse();
  for (const s of toDelete) {
    await fetch(`/api/skills/${s.id}`, { method: "DELETE" });
  }

  const finalId = levelNodes[lastRealIdx].id;
  for (const s of levelNodes.slice(0, lastRealIdx + 1)) {
    const expected = s.id === finalId ? 1 : 0;
    if ((s.isFinalNode || 0) !== expected) await patchSkill(s.id, { isFinalNode: expected });
  }
}

// "Agregar sub-nodo" desde Tareas de hoy: si el nodo no tiene sub-árbol se genera, y el sub-nodo
// nuevo entra al final de los sub-nodos ya creados del primer nivel (pasa a ser el nodo final).
// Queda desbloqueado si todos los anteriores están confirmados.
export async function addSubSkillFromToday(parentSkillId: string, title: string): Promise<Skill | null> {
  let subSkills = await fetchSubSkills(parentSkillId);
  if (subSkills.length === 0) {
    await fetch(`/api/skills/${parentSkillId}/subskills/generate-level`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: 1 }),
    });
    subSkills = await fetchSubSkills(parentSkillId);
  }
  const levelNodes = subSkills.filter(s => s.level === 1).sort(byOrder);
  const lastReal = [...levelNodes].reverse().find(s => !isSubSkillPlaceholder(s));
  if (!lastReal) return null;

  const res = await fetch("/api/skills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parentSkillId,
      title,
      description: "",
      x: lastReal.x,
      y: lastReal.y + 150,
      status: lastReal.status === "mastered" ? "available" : "locked",
      dependencies: [lastReal.id],
      level: 1,
      levelPosition: (lastReal.levelPosition || 0) + 1,
      isFinalNode: 0,
      manualLock: 0,
    }),
  });
  if (!res.ok) return null;
  const created: Skill = await res.json();
  await makeLastCreatedSubSkillFinal(parentSkillId, 1, created.id);
  return created;
}

// Confirma/desconfirma un sub-nodo desde Tareas de hoy. El server encadena el desbloqueo del
// siguiente sub-nodo (y lo vuelve a bloquear al desconfirmar). Cuando ya no queda ningún
// sub-nodo sin confirmar, se desbloquea el nodo padre (mismo efecto que completar el sub-árbol
// desde el árbol).
export async function toggleSubSkillFromToday(parentSkillId: string, sub: Skill) {
  const confirming = sub.status !== "mastered";
  const res = await patchSkill(sub.id, { status: confirming ? "mastered" : "available" });
  if (!res.ok || !confirming) return;

  const remaining = (await fetchSubSkills(parentSkillId)).filter(s => s.status !== "mastered" && !isSubSkillPlaceholder(s));
  if (remaining.length === 0) {
    await patchSkill(parentSkillId, { status: "available", fromSubtaskCompletion: true });
  }
}

// Al confirmar el nodo padre se confirma todo su sub-árbol: cualquier sub-nodo que haya quedado
// sin confirmar (pasos de relleno, otros niveles) se marca como confirmado, en orden.
export async function masterWholeSubSkillTree(parentSkillId: string) {
  const pending = (await fetchSubSkills(parentSkillId)).filter(s => s.status !== "mastered").sort(byOrder);
  for (const s of pending) {
    await patchSkill(s.id, { status: "mastered", fromLevelReset: true });
  }
}

// El nodo final de un nivel de sub-árbol es siempre el último por posición (ver
// makeLastCreatedSubSkillFinal): se re-asigna después de borrar un sub-nodo.
async function ensureLastSubSkillIsFinal(parentSkillId: string, level: number) {
  const levelNodes = (await fetchSubSkills(parentSkillId)).filter(s => s.level === level).sort(byOrder);
  if (levelNodes.length < 2) return;
  const last = levelNodes[levelNodes.length - 1];
  for (const s of levelNodes) {
    const expected = s.id === last.id ? 1 : 0;
    if ((s.isFinalNode || 0) !== expected) await patchSkill(s.id, { isFinalNode: expected });
  }
}

// Sube/baja un sub-nodo desde Tareas de hoy: intercambia su lugar con el sub-nodo vecino que se
// ve ahí (`neighbor`). Igual que mover en el árbol (moveSubSkill): intercambian posición e y, y el
// estado y el flag de nodo final se quedan con la posición (el que pasa adelante hereda el estado
// del de adelante), así la progresión del nivel sigue siendo válida. Nunca con el "inicio".
export async function moveSubSkillFromToday(sub: Skill, neighbor: Skill) {
  if (sub.level !== neighbor.level || (neighbor.levelPosition || 0) <= 1 || (sub.levelPosition || 0) <= 1) return;
  await Promise.all([
    patchSkill(sub.id, {
      y: neighbor.y,
      levelPosition: neighbor.levelPosition,
      status: neighbor.status,
      isFinalNode: neighbor.isFinalNode || 0,
      fromReorder: true,
    }),
    patchSkill(neighbor.id, {
      y: sub.y,
      levelPosition: sub.levelPosition,
      status: sub.status,
      isFinalNode: sub.isFinalNode || 0,
      fromReorder: true,
    }),
  ]);
}

export async function renameSubSkill(subSkillId: string, title: string) {
  await patchSkill(subSkillId, { title });
}

// Borra un sub-nodo desde Tareas de hoy. El server renumera el nivel y, si era el desbloqueado,
// desbloquea el siguiente; acá solo se re-asigna el nodo final al último que quede.
export async function deleteSubSkillFromToday(parentSkillId: string, sub: Skill) {
  // Sus propios sub-nodos (los que en Tareas de hoy se ven anidados adentro de él) se van con él.
  if ((await fetchSubSkills(sub.id)).length > 0) {
    await fetch(`/api/skills/${sub.id}/subskills`, { method: "DELETE" });
  }
  const res = await fetch(`/api/skills/${sub.id}`, { method: "DELETE" });
  if (!res.ok) return;
  await ensureLastSubSkillIsFinal(parentSkillId, sub.level);
}

