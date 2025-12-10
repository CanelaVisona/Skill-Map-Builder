import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  username: text("username").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  profileMission: text("profile_mission").default(""),
  profileValues: text("profile_values").default(""),
  profileLikes: text("profile_likes").default(""),
  profileAbout: text("profile_about").default(""),
});

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
});

export const areas = pgTable("areas", {
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  description: text("description").notNull(),
  unlockedLevel: integer("unlocked_level").notNull().default(1),
  nextLevelToAssign: integer("next_level_to_assign").notNull().default(1),
  levelSubtitles: jsonb("level_subtitles").notNull().$type<Record<string, string>>().default({}),
  archived: integer("archived").$type<0 | 1>().default(0),
});

export const skills = pgTable("skills", {
  id: varchar("id").primaryKey(),
  areaId: varchar("area_id").references(() => areas.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }),
  parentSkillId: varchar("parent_skill_id"),
  title: text("title").notNull(),
  action: text("action").notNull().default(""),
  description: text("description").notNull(),
  feedback: text("feedback").default(""),
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
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  description: text("description").notNull(),
  unlockedLevel: integer("unlocked_level").notNull().default(1),
  nextLevelToAssign: integer("next_level_to_assign").notNull().default(1),
  levelSubtitles: jsonb("level_subtitles").notNull().$type<Record<string, string>>().default({}),
  archived: integer("archived").$type<0 | 1>().default(0),
  questType: text("quest_type").$type<"main" | "side" | "popup">().default("main"),
});

export const journalCharacters = pgTable("journal_characters", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  action: text("action").notNull().default(""),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url"),
});

export const journalPlaces = pgTable("journal_places", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  action: text("action").notNull().default(""),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url"),
});

export const journalShadows = pgTable("journal_shadows", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  action: text("action").notNull().default(""),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url"),
  defeated: integer("defeated").$type<0 | 1>().default(0),
});

export const profileValues = pgTable("profile_values", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
});

export const profileLikes = pgTable("profile_likes", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true });
export const insertAreaSchema = createInsertSchema(areas);
export const insertSkillSchema = createInsertSchema(skills).omit({ id: true });
export const insertProjectSchema = createInsertSchema(projects);
export const insertJournalCharacterSchema = createInsertSchema(journalCharacters).omit({ id: true });
export const insertJournalPlaceSchema = createInsertSchema(journalPlaces).omit({ id: true });
export const insertJournalShadowSchema = createInsertSchema(journalShadows).omit({ id: true });
export const insertProfileValueSchema = createInsertSchema(profileValues).omit({ id: true });
export const insertProfileLikeSchema = createInsertSchema(profileLikes).omit({ id: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertArea = z.infer<typeof insertAreaSchema>;
export type Area = typeof areas.$inferSelect;
export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type Skill = typeof skills.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertJournalCharacter = z.infer<typeof insertJournalCharacterSchema>;
export type JournalCharacter = typeof journalCharacters.$inferSelect;
export type InsertJournalPlace = z.infer<typeof insertJournalPlaceSchema>;
export type JournalPlace = typeof journalPlaces.$inferSelect;
export type InsertJournalShadow = z.infer<typeof insertJournalShadowSchema>;
export type JournalShadow = typeof journalShadows.$inferSelect;
export type InsertProfileValue = z.infer<typeof insertProfileValueSchema>;
export type ProfileValue = typeof profileValues.$inferSelect;
export type InsertProfileLike = z.infer<typeof insertProfileLikeSchema>;
export type ProfileLike = typeof profileLikes.$inferSelect;
