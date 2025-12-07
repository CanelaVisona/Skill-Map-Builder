import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { type Area, type Skill, type InsertArea, type InsertSkill, type Project, type InsertProject, areas, skills, projects } from "@shared/schema";

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
  countSkillsInLevel(areaId: string, level: number): Promise<number>;
  generateLevelWithSkills(areaId: string, level: number, startY: number): Promise<{ updatedArea: Area; createdSkills: Skill[] }>;

  // Projects
  getProjects(): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  deleteProject(id: string): Promise<void>;
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
    const insertData: typeof skills.$inferInsert = {
      id,
      areaId: skill.areaId,
      title: skill.title,
      description: skill.description,
      status: skill.status,
      x: skill.x,
      y: skill.y,
      dependencies: skill.dependencies as string[],
      manualLock: (skill.manualLock ?? 0) as 0 | 1,
      isFinalNode: (skill.isFinalNode ?? 0) as 0 | 1,
      level: skill.level,
      levelPosition: skill.levelPosition,
    };
    const result = await db.insert(skills).values(insertData).returning();
    return result[0];
  }

  async updateSkill(id: string, skill: Partial<InsertSkill>): Promise<Skill | undefined> {
    const updateData: Record<string, unknown> = {};
    if (skill.areaId !== undefined) updateData.areaId = skill.areaId;
    if (skill.title !== undefined) updateData.title = skill.title;
    if (skill.description !== undefined) updateData.description = skill.description;
    if (skill.status !== undefined) updateData.status = skill.status;
    if (skill.x !== undefined) updateData.x = skill.x;
    if (skill.y !== undefined) updateData.y = skill.y;
    if (skill.dependencies !== undefined) updateData.dependencies = skill.dependencies as string[];
    if (skill.manualLock !== undefined) updateData.manualLock = skill.manualLock as 0 | 1;
    if (skill.isFinalNode !== undefined) updateData.isFinalNode = skill.isFinalNode as 0 | 1;
    if (skill.level !== undefined) updateData.level = skill.level;
    if (skill.levelPosition !== undefined) updateData.levelPosition = skill.levelPosition;
    
    const result = await db.update(skills).set(updateData).where(eq(skills.id, id)).returning();
    return result[0];
  }

  async deleteSkill(id: string): Promise<void> {
    await db.delete(skills).where(eq(skills.id, id));
  }

  async countSkillsInLevel(areaId: string, level: number): Promise<number> {
    const result = await db.select().from(skills).where(
      and(eq(skills.areaId, areaId), eq(skills.level, level))
    );
    return result.length;
  }

  async generateLevelWithSkills(areaId: string, level: number, startY: number): Promise<{ updatedArea: Area; createdSkills: Skill[] }> {
    const createdSkills: Skill[] = [];
    let previousSkillId: string | null = null;

    // Use a transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Update area's unlocked level first
      await tx.update(areas)
        .set({ unlockedLevel: level, nextLevelToAssign: level })
        .where(eq(areas.id, areaId));

      // Create 5 skills for the new level
      for (let position = 1; position <= 5; position++) {
        const id = Math.random().toString(36).substr(2, 9);
        const deps: string[] = previousSkillId ? [previousSkillId] : [];
        const skillData: typeof skills.$inferInsert = {
          id,
          areaId,
          title: "?",
          description: "",
          x: 50,
          y: startY + (position - 1) * 150,
          status: position === 1 ? "available" : "locked",
          dependencies: deps,
          level,
          levelPosition: position,
          isFinalNode: (position === 5 ? 1 : 0) as 0 | 1,
          manualLock: 0 as 0 | 1,
        };

        const result = await tx.insert(skills).values(skillData).returning();
        createdSkills.push(result[0]);
        previousSkillId = id;
      }
    });

    // Fetch the updated area
    const updatedAreaResult = await db.select().from(areas).where(eq(areas.id, areaId));
    const updatedArea = updatedAreaResult[0];

    return { updatedArea, createdSkills };
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }

  async createProject(project: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values(project).returning();
    return result[0];
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }
}

export const storage = new DbStorage();
