import { useQueryClient } from "@tanstack/react-query";
import type { Habit } from "@shared/schema";
import { useSkillTree } from "@/lib/skill-context";
import { useBodyProgress } from "@/lib/body-progress-context";
import { useBodyGainPopup } from "@/lib/body-gain-popup-context";
import { useXpPopup } from "@/lib/xp-popup-context";
import { beginPopupChain, endPopupChain, runPopupQueue } from "@/lib/popup-coordinator";
import {
  getNextIntervalIndex,
  INTERVALS_L1,
  INTERVALS_L2,
  type SpaceRepetitionPractice,
} from "@/components/SpaceRepetitionModal";
import type { BodyLink } from "@/components/BodyLinkPicker";

// Confirmar un hábito o una práctica de repetición espaciada desde "Tareas de hoy" tiene que
// otorgar exactamente las mismas recompensas (XP a los skills linkeados, crecimiento de
// componentes corporales linkeados, pop-ups) que confirmarlos desde su pantalla de origen
// (HabitStreakModal / SpaceRepetitionModal). Esta lógica vivía duplicada ahí adentro (como
// closures locales, no exportadas); acá se reimplementa una sola vez para que "Tareas de hoy"
// pueda otorgar lo mismo sin depender de montar esos modales.

export function useConfirmHabit() {
  const queryClient = useQueryClient();
  const { globalSkills, areas, refetchGlobalSkills } = useSkillTree();
  const { showXpPopup, hideXpPopup } = useXpPopup();
  const { addBodyBlock } = useBodyProgress();
  const { showBodyGainPopup, hideBodyGainPopup } = useBodyGainPopup();

  const buildBodyGrowthTasks = (links: BodyLink[]): Array<() => void> =>
    links.map((link) => () => {
      const { before, after } = addBodyBlock(link.zone, link.dimension);
      hideXpPopup();
      showBodyGainPopup({ zone: link.zone, dimension: link.dimension, before, after });
    });

  const awardHabitXp = async (habitId: string, skillIds: string[]): Promise<Array<() => void>> => {
    if (skillIds.length === 0) return [];
    try {
      const res = await fetch(`/api/habits/${habitId}/award-xp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return [];
      const xpData = await res.json();
      const awards: Array<{ skillId: string; skillName: string; newXp: number; newLevel: number; xpAwarded: number }> =
        Array.isArray(xpData?.xpAwards) ? xpData.xpAwards : [];
      if (awards.length === 0) return [];

      const tasks = awards.map((award) => () => {
        const linkedSkill = globalSkills.find((s) => s.id === award.skillId);
        const area = areas.find((a) => a.id === linkedSkill?.areaId);
        hideBodyGainPopup();
        showXpPopup({
          skillName: award.skillName,
          areaColor: area?.color || "#c85a2a",
          xpBefore: linkedSkill ? linkedSkill.currentXp : Math.max(0, award.newXp - award.xpAwarded),
          xpAfter: award.newXp,
          xpMax: linkedSkill?.goalXp || null,
          level: award.newLevel,
          celebrateLevelUp: true,
        });
      });

      await refetchGlobalSkills();
      await queryClient.refetchQueries({ queryKey: ["skills"] });
      return tasks;
    } catch (error) {
      console.error("Error awarding XP:", error);
      return [];
    }
  };

  const confirmHabit = async (habit: Habit, date: string) => {
    const res = await fetch(`/api/habit-records/${habit.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, completed: 1 }),
    });
    if (!res.ok) throw new Error("Failed to confirm habit");
    queryClient.invalidateQueries({ queryKey: ["habit-records"] });

    const skillIds = habit.skillIds?.length ? habit.skillIds : habit.skillId ? [habit.skillId] : [];
    beginPopupChain();
    const xpTasks = await awardHabitXp(habit.id, skillIds);
    const bodyTasks = buildBodyGrowthTasks((habit.bodyLinks as BodyLink[] | null) ?? []);
    runPopupQueue([...xpTasks, ...bodyTasks], endPopupChain);
  };

  const unconfirmHabit = async (habit: Habit, date: string) => {
    const res = await fetch(`/api/habit-records/${habit.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, completed: 0 }),
    });
    if (!res.ok) throw new Error("Failed to unconfirm habit");
    queryClient.invalidateQueries({ queryKey: ["habit-records"] });
    ((habit.bodyLinks as BodyLink[] | null) ?? []).forEach((link) => addBodyBlock(link.zone, link.dimension, -1));
  };

  return { confirmHabit, unconfirmHabit };
}

export function useConfirmPractice() {
  const queryClient = useQueryClient();
  const { areas } = useSkillTree();
  const { showXpPopup, hideXpPopup } = useXpPopup();
  const { addBodyBlock } = useBodyProgress();
  const { showBodyGainPopup, hideBodyGainPopup } = useBodyGainPopup();

  const buildBodyGrowthTasks = (links: BodyLink[]): Array<() => void> =>
    links.map((link) => () => {
      const { before, after } = addBodyBlock(link.zone, link.dimension);
      hideXpPopup();
      showBodyGainPopup({ zone: link.zone, dimension: link.dimension, before, after });
    });

  const awardSkillXP = async (skillId: string) => {
    const xpAmount = 5;
    try {
      const skillRes = await fetch(`/api/global-skills/${skillId}`);
      const linkedSkill = skillRes.ok ? await skillRes.json() : null;
      const area = areas.find((a) => a.id === linkedSkill?.areaId);
      const xpBefore = linkedSkill?.currentXp || 0;

      const res = await fetch(`/api/global-skills/${skillId}/add-xp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xpAmount }),
      });
      if (!res.ok) return null;
      const updatedSkill = await res.json();

      return {
        skillName: linkedSkill?.name || "Skill",
        areaColor: area?.color || "#c85a2a",
        xpBefore,
        xpAfter: updatedSkill.currentXp,
        xpMax: updatedSkill.goalXp || null,
        level: updatedSkill.level,
        celebrateLevelUp: true as const,
      };
    } catch (error) {
      console.error("Error awarding skill XP:", error);
      return null;
    }
  };

  const awardLinkedSkillsXP = async (skillIds: string[]): Promise<Array<() => void>> => {
    if (skillIds.length === 0) return [];
    const snapshots = (await Promise.all(skillIds.map((id) => awardSkillXP(id)))).filter(
      (snapshot): snapshot is NonNullable<typeof snapshot> => !!snapshot
    );
    return snapshots.map((snapshot) => () => {
      hideXpPopup();
      showXpPopup(snapshot);
    });
  };

  const awardXpAndGrowBody = async (practice: SpaceRepetitionPractice) => {
    beginPopupChain();
    const xpTasks = await awardLinkedSkillsXP(practice.skillIds || []);
    const bodyTasks = buildBodyGrowthTasks(Array.isArray(practice.bodyLinks) ? practice.bodyLinks : []);
    runPopupQueue([...xpTasks, ...bodyTasks], endPopupChain);
  };

  // Confirma el próximo intervalo pendiente de la práctica -- mismo comportamiento que tocar
  // "Registrar" en SpaceRepetitionModal (incluye transición a Nivel 2 y archivado al completar
  // Nivel 2). No hace nada si no hay ningún intervalo pendiente para confirmar.
  const confirmPractice = async (practice: SpaceRepetitionPractice) => {
    const nextIdx = getNextIntervalIndex(practice);
    if (nextIdx === -1) return;

    const level = practice.level || 1;

    try {
      if (level === 2) {
        const intervalsL2 = new Set(practice.completedIntervalsL2 || []);
        intervalsL2.add(nextIdx);
        const newCompletedL2 = Array.from(intervalsL2).sort((a, b) => a - b);

        if (newCompletedL2.length === INTERVALS_L2.length) {
          const res = await fetch(`/api/space-repetition/${practice.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              completedIntervalsL2: newCompletedL2,
              archived: 1,
              endDate: new Date().toISOString().slice(0, 10),
              lostIntervals: [],
              lastConfirmedAt: new Date().toISOString(),
            }),
          });
          if (!res.ok) throw new Error("Failed to confirm practice");
          await awardXpAndGrowBody(practice);
          return;
        }

        const res = await fetch(`/api/space-repetition/${practice.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            completedIntervalsL2: newCompletedL2,
            lostIntervals: [],
            lastConfirmedAt: new Date().toISOString(),
          }),
        });
        if (!res.ok) throw new Error("Failed to confirm practice");
        await awardXpAndGrowBody(practice);
        return;
      }

      const intervals = new Set(practice.completedIntervals);
      intervals.add(nextIdx);
      const newCompleted = Array.from(intervals).sort((a, b) => a - b);

      if (newCompleted.length === INTERVALS_L1.length) {
        const res = await fetch(`/api/space-repetition/${practice.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            completedIntervals: newCompleted,
            level: 2,
            level1CompletedDate: new Date().toISOString().slice(0, 10),
            completedIntervalsL2: [],
            lostIntervals: [],
            lastConfirmedAt: new Date().toISOString(),
          }),
        });
        if (!res.ok) throw new Error("Failed to confirm practice");
        await awardXpAndGrowBody(practice);
        return;
      }

      const res = await fetch(`/api/space-repetition/${practice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completedIntervals: newCompleted,
          lostIntervals: [],
          lastConfirmedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed to confirm practice");
      await awardXpAndGrowBody(practice);
    } finally {
      queryClient.invalidateQueries({ queryKey: ["space-repetition"] });
    }
  };

  return { confirmPractice };
}
