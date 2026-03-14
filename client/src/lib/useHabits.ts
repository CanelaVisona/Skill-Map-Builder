import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Habit, HabitRecord } from "@shared/schema";

export function useHabits() {
  return useQuery({
    queryKey: ["habits"],
    queryFn: async () => {
      const res = await fetch("/api/habits");
      if (!res.ok) throw new Error("Failed to fetch habits");
      return res.json() as Promise<Habit[]>;
    },
  });
}

export function useHabitRecords(habitId: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["habit-records", habitId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/habit-records/${habitId}?startDate=${startDate}&endDate=${endDate}`
      );
      if (!res.ok) throw new Error("Failed to fetch habit records");
      return res.json() as Promise<HabitRecord[]>;
    },
  });
}

export function useCreateHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      emoji: string;
      name: string;
      description: string;
    }) => {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create habit");
      return res.json() as Promise<Habit>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

export function useUpdateHabitRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      habitId,
      date,
      completed,
    }: {
      habitId: string;
      date: string;
      completed: 0 | 1;
    }) => {
      const res = await fetch(`/api/habit-records/${habitId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, completed }),
      });
      if (!res.ok) throw new Error("Failed to update habit record");
      return res.json() as Promise<HabitRecord>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habit-records"] });
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (habitId: string) => {
      const res = await fetch(`/api/habits/${habitId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete habit");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}
