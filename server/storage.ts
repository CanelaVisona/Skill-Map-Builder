import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "./db";
import { type Area, type Skill, type InsertArea, type InsertSkill, type Project, type InsertProject, type User, type Session, areas, skills, projects, users, sessions } from "@shared/schema";

export interface IStorage {
  // Users
  createUser(username: string): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;

  // Sessions
  createSession(userId: string, expiresAt: Date): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  deleteSession(id: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;

  // Areas
  getAreas(userId: string): Promise<Area[]>;
  getArea(id: string): Promise<Area | undefined>;
  createArea(area: InsertArea): Promise<Area>;
  updateArea(id: string, area: Partial<InsertArea>): Promise<Area | undefined>;
  deleteArea(id: string): Promise<void>;

  // Skills
  getSkills(areaId: string): Promise<Skill[]>;
  getProjectSkills(projectId: string): Promise<Skill[]>;
  getSkill(id: string): Promise<Skill | undefined>;
  createSkill(skill: InsertSkill): Promise<Skill>;
  updateSkill(id: string, skill: Partial<InsertSkill>): Promise<Skill | undefined>;
  deleteSkill(id: string): Promise<void>;
  countSkillsInLevel(areaId: string, level: number): Promise<number>;
  countProjectSkillsInLevel(projectId: string, level: number): Promise<number>;
  generateLevelWithSkills(areaId: string, level: number, startY: number): Promise<{ updatedArea: Area; createdSkills: Skill[] }>;
  generateProjectLevelWithSkills(projectId: string, level: number, startY: number): Promise<{ updatedProject: Project; createdSkills: Skill[] }>;

  // Sub-skills
  getSubSkills(parentSkillId: string): Promise<Skill[]>;
  countSubSkillsInLevel(parentSkillId: string, level: number): Promise<number>;
  generateSubSkillLevel(parentSkillId: string, level: number, startY: number): Promise<{ parentSkill: Skill; createdSkills: Skill[] }>;

  // Projects
  getProjects(userId: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<void>;
}

export class DbStorage implements IStorage {
  // Users
  async createUser(username: string): Promise<User> {
    const id = randomUUID();
    const result = await db.insert(users).values({ id, username }).returning();
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserById(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  // Sessions
  async createSession(userId: string, expiresAt: Date): Promise<Session> {
    const id = randomUUID();
    const result = await db.insert(sessions).values({ id, userId, expiresAt }).returning();
    return result[0];
  }

  async getSession(id: string): Promise<Session | undefined> {
    const result = await db.select().from(sessions).where(eq(sessions.id, id));
    return result[0];
  }

  async deleteSession(id: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  async deleteExpiredSessions(): Promise<void> {
    const { lt } = await import("drizzle-orm");
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  }

  // Areas
  async getAreas(userId: string): Promise<Area[]> {
    return await db.select().from(areas).where(eq(areas.userId, userId));
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

  async getProjectSkills(projectId: string): Promise<Skill[]> {
    return await db.select().from(skills).where(eq(skills.projectId, projectId));
  }

  async getSkill(id: string): Promise<Skill | undefined> {
    const result = await db.select().from(skills).where(eq(skills.id, id));
    return result[0];
  }

  async createSkill(skill: InsertSkill): Promise<Skill> {
    const id = randomUUID();
    const insertData: typeof skills.$inferInsert = {
      id,
      areaId: skill.areaId,
      projectId: skill.projectId,
      parentSkillId: skill.parentSkillId,
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

  async countProjectSkillsInLevel(projectId: string, level: number): Promise<number> {
    const result = await db.select().from(skills).where(
      and(eq(skills.projectId, projectId), eq(skills.level, level))
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
        const id = randomUUID();
        const deps: string[] = previousSkillId ? [previousSkillId] : [];
        const isFirstNode = level === 1 && position === 1;
        const skillData: typeof skills.$inferInsert = {
          id,
          areaId,
          title: isFirstNode ? "inicio" : "?",
          description: "",
          x: 50,
          y: startY + (position - 1) * 150,
          status: position === 1 ? "available" : "locked",
          dependencies: deps,
          level,
          levelPosition: position,
          isFinalNode: 0 as 0 | 1,
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

  async generateProjectLevelWithSkills(projectId: string, level: number, startY: number): Promise<{ updatedProject: Project; createdSkills: Skill[] }> {
    const createdSkills: Skill[] = [];
    let previousSkillId: string | null = null;

    await db.transaction(async (tx) => {
      await tx.update(projects)
        .set({ unlockedLevel: level, nextLevelToAssign: level })
        .where(eq(projects.id, projectId));

      for (let position = 1; position <= 5; position++) {
        const id = randomUUID();
        const deps: string[] = previousSkillId ? [previousSkillId] : [];
        const isFirstNode = level === 1 && position === 1;
        const skillData: typeof skills.$inferInsert = {
          id,
          projectId,
          title: isFirstNode ? "inicio" : "?",
          description: "",
          x: 50,
          y: startY + (position - 1) * 150,
          status: position === 1 ? "available" : "locked",
          dependencies: deps,
          level,
          levelPosition: position,
          isFinalNode: 0 as 0 | 1,
          manualLock: 0 as 0 | 1,
        };

        const result = await tx.insert(skills).values(skillData).returning();
        createdSkills.push(result[0]);
        previousSkillId = id;
      }
    });

    const updatedProjectResult = await db.select().from(projects).where(eq(projects.id, projectId));
    const updatedProject = updatedProjectResult[0];

    return { updatedProject, createdSkills };
  }

  // Projects
  async getProjects(userId: string): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.userId, userId));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id));
    return result[0];
  }

  async createProject(project: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values(project).returning();
    return result[0];
  }

  async updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined> {
    const result = await db.update(projects).set(project).where(eq(projects.id, id)).returning();
    return result[0];
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  // Sub-skills
  async getSubSkills(parentSkillId: string): Promise<Skill[]> {
    return await db.select().from(skills).where(eq(skills.parentSkillId, parentSkillId));
  }

  async countSubSkillsInLevel(parentSkillId: string, level: number): Promise<number> {
    const result = await db.select().from(skills).where(
      and(eq(skills.parentSkillId, parentSkillId), eq(skills.level, level))
    );
    return result.length;
  }

  async generateSubSkillLevel(parentSkillId: string, level: number, startY: number): Promise<{ parentSkill: Skill; createdSkills: Skill[] }> {
    const createdSkills: Skill[] = [];
    let previousSkillId: string | null = null;

    await db.transaction(async (tx) => {
      for (let position = 1; position <= 5; position++) {
        const id = randomUUID();
        const deps: string[] = previousSkillId ? [previousSkillId] : [];
        const isFirstNode = level === 1 && position === 1;
        const skillData: typeof skills.$inferInsert = {
          id,
          parentSkillId,
          title: isFirstNode ? "inicio" : "?",
          description: "",
          x: 50,
          y: startY + (position - 1) * 150,
          status: position === 1 ? "available" : "locked",
          dependencies: deps,
          level,
          levelPosition: position,
          isFinalNode: 0 as 0 | 1,
          manualLock: 0 as 0 | 1,
        };

        const result = await tx.insert(skills).values(skillData).returning();
        createdSkills.push(result[0]);
        previousSkillId = id;
      }
    });

    const parentSkillResult = await db.select().from(skills).where(eq(skills.id, parentSkillId));
    const parentSkill = parentSkillResult[0];

    return { parentSkill, createdSkills };
  }
}

export const storage = new DbStorage();
