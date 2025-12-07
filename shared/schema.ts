import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const areas = pgTable("areas", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  description: text("description").notNull(),
  unlockedLevel: integer("unlocked_level").notNull().default(1),
  nextLevelToAssign: integer("next_level_to_assign").notNull().default(1),
});

export const skills = pgTable("skills", {
  id: varchar("id").primaryKey(),
  areaId: varchar("area_id").references(() => areas.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  dependencies: jsonb("dependencies").notNull().$type<string[]>(),
  manualLock: integer("manual_lock").$type<0 | 1>().default(0),
  isFinalNode: integer("is_final_node").$type<0 | 1>().default(0),
  level: integer("level").notNull().default(1),
  levelPosition: integer("level_position").notNull().default(1),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  description: text("description").notNull(),
  unlockedLevel: integer("unlocked_level").notNull().default(1),
  nextLevelToAssign: integer("next_level_to_assign").notNull().default(1),
});

export const insertAreaSchema = createInsertSchema(areas);
export const insertSkillSchema = createInsertSchema(skills).omit({ id: true });
export const insertProjectSchema = createInsertSchema(projects);

export type InsertArea = z.infer<typeof insertAreaSchema>;
export type Area = typeof areas.$inferSelect;
export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type Skill = typeof skills.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
