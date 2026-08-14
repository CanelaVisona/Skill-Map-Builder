import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { BodyDimension, BodyZone } from "@/lib/body-progress-context";

// Step 3 of the title-long-press edit dialog (xp/fuerza/poderes) only *stages* a choice for
// an unconfirmed node -- it's applied for real once the node itself gets confirmed (see
// applyPendingRewards in SkillNode.tsx). That staged choice used to live in useState inside
// SkillNode, which meant it was wiped the moment the component unmounted -- which happens on
// every "page" change (switching area/quest, opening Journal, etc., all of which swap out the
// mounted skill nodes). Keeping it here instead, keyed by skillId and held above the views that
// come and go, makes the selection survive navigation; localStorage makes it survive a reload too.

export type PendingRewardsTab = "experience" | "body" | "powers";

export interface PendingRewardSelection {
  rewardsTab: PendingRewardsTab;
  xpSkillId: string | null;
  bodyDimension: BodyDimension;
  bodyZones: BodyZone[];
  powerId: string | null;
}

function defaultSelection(): PendingRewardSelection {
  return { rewardsTab: "experience", xpSkillId: null, bodyDimension: "fuerza", bodyZones: [], powerId: null };
}

type PendingRewardsState = Record<string, PendingRewardSelection>;

const STORAGE_KEY = "skill-map-pending-rewards-v1";

function loadState(): PendingRewardsState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

// An entry with nothing staged is worth dropping entirely instead of storing the default --
// keeps the persisted map from growing forever with empty/cleared-out entries.
function isEmptySelection(entry: PendingRewardSelection): boolean {
  return !entry.xpSkillId && entry.bodyZones.length === 0 && !entry.powerId;
}

interface PendingRewardsContextValue {
  getPendingRewards: (skillId: string) => PendingRewardSelection;
  setPendingRewardsTab: (skillId: string, tab: PendingRewardsTab) => void;
  setPendingXpSkillId: (skillId: string, xpSkillId: string | null) => void;
  setPendingBodyDimension: (skillId: string, dimension: BodyDimension) => void;
  setPendingBodyZones: (skillId: string, update: BodyZone[] | ((prev: BodyZone[]) => BodyZone[])) => void;
  setPendingPowerId: (skillId: string, powerId: string | null) => void;
  clearPendingRewards: (skillId: string) => void;
}

const PendingRewardsContext = createContext<PendingRewardsContextValue | undefined>(undefined);

export function PendingRewardsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PendingRewardsState>(() => loadState());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Every setter funnels through the functional form of setState so rapid-fire updates (e.g.
  // toggling body zones) always build on the latest value instead of a stale closure over `state`.
  const updateEntry = (
    skillId: string,
    patch: Partial<PendingRewardSelection> | ((current: PendingRewardSelection) => Partial<PendingRewardSelection>)
  ) => {
    setState((prev) => {
      const current = prev[skillId] ?? defaultSelection();
      const resolvedPatch = typeof patch === "function" ? patch(current) : patch;
      const next = { ...current, ...resolvedPatch };
      const nextState = { ...prev };
      if (isEmptySelection(next)) {
        delete nextState[skillId];
      } else {
        nextState[skillId] = next;
      }
      return nextState;
    });
  };

  const getPendingRewards = (skillId: string) => state[skillId] ?? defaultSelection();

  const value: PendingRewardsContextValue = {
    getPendingRewards,
    setPendingRewardsTab: (skillId, tab) => updateEntry(skillId, { rewardsTab: tab }),
    setPendingXpSkillId: (skillId, xpSkillId) => updateEntry(skillId, { xpSkillId }),
    setPendingBodyDimension: (skillId, bodyDimension) => updateEntry(skillId, { bodyDimension }),
    setPendingBodyZones: (skillId, update) => {
      updateEntry(skillId, (current) => ({
        bodyZones: typeof update === "function" ? update(current.bodyZones) : update,
      }));
    },
    setPendingPowerId: (skillId, powerId) => updateEntry(skillId, { powerId }),
    clearPendingRewards: (skillId) => {
      setState((prev) => {
        if (!(skillId in prev)) return prev;
        const nextState = { ...prev };
        delete nextState[skillId];
        return nextState;
      });
    },
  };

  return <PendingRewardsContext.Provider value={value}>{children}</PendingRewardsContext.Provider>;
}

export function usePendingRewards() {
  const context = useContext(PendingRewardsContext);
  if (!context) {
    throw new Error("usePendingRewards must be used within a PendingRewardsProvider");
  }
  return context;
}
