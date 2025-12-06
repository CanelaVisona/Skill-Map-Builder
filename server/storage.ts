import { eq } from "drizzle-orm";
import { db } from "./db";
import { type Area, type Skill, type InsertArea, type InsertSkill, areas, skills } from "@shared/schema";

export interface IStorage {
  // Areas
  getAreas(): Promise<Area[]>;
  getArea(id: string): Promise<Area | undefined>;
  createArea(area: InsertArea): Promise<Area>;
  updateArea(id: string, area: Partial<InsertArea>): Promise<Area | undefined>;
  deleteArea(id: string): Promise<void>;

  // Skills
  getSkills(areaId: string): Promise<Skill[]>;
  getSkill(id: string): Promise<Skill | undefined>;
  createSkill(skill: InsertSkill): Promise<Skill>;
  updateSkill(id: string, skill: Partial<InsertSkill>): Promise<Skill | undefined>;
  deleteSkill(id: string): Promise<void>;
}

export class DbStorage implements IStorage {
  // Areas
  async getAreas(): Promise<Area[]> {
    return await db.select().from(areas);
  }

  async getArea(id: string): Promise<Area | undefined> {
    const result = await db.select().from(areas).where(eq(areas.id, id));
    return result[0];
  }

  async createArea(area: InsertArea): Promise<Area> {
    const result = await db.insert(areas).values(area).returning();
    return result[0];
  }

  async updateArea(id: string, area: Partial<InsertArea>): Promise<Area | undefined> {
    const result = await db.update(areas).set(area).where(eq(areas.id, id)).returning();
    return result[0];
  }

  async deleteArea(id: string): Promise<void> {
    await db.delete(areas).where(eq(areas.id, id));
  }

  // Skills
  async getSkills(areaId: string): Promise<Skill[]> {
    return await db.select().from(skills).where(eq(skills.areaId, areaId));
  }

  async getSkill(id: string): Promise<Skill | undefined> {
    const result = await db.select().from(skills).where(eq(skills.id, id));
    return result[0];
  }

  async createSkill(skill: InsertSkill): Promise<Skill> {
    const id = Math.random().toString(36).substr(2, 9);
    const result = await db.insert(skills).values({ ...skill, id }).returning();
    return result[0];
  }

  async updateSkill(id: string, skill: Partial<InsertSkill>): Promise<Skill | undefined> {
    const result = await db.update(skills).set(skill).where(eq(skills.id, id)).returning();
    return result[0];
  }

  async deleteSkill(id: string): Promise<void> {
    await db.delete(skills).where(eq(skills.id, id));
  }
}

export const storage = new DbStorage();
