import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import * as bcrypt from "bcryptjs";
import { db } from "./db";
import { type Area, type Skill, type InsertArea, type InsertSkill, type Project, type InsertProject, type User, type Session, type JournalCharacter, type InsertJournalCharacter, type JournalPlace, type InsertJournalPlace, type JournalShadow, type InsertJournalShadow, type ProfileValue, type InsertProfileValue, type ProfileLike, type InsertProfileLike, type ProfileMission, type InsertProfileMission, type ProfileAboutEntry, type InsertProfileAboutEntry, type JournalLearning, type InsertJournalLearning, type JournalTool, type InsertJournalTool, areas, skills, projects, users, sessions, journalCharacters, journalPlaces, journalShadows, profileValues, profileLikes, profileMissions, profileAboutEntries, journalLearnings, journalTools } from "@shared/schema";

export interface IStorage {
  // Users
  createUser(username: string, password: string): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  verifyUserPassword(username: string, password: string): Promise<User | undefined>;
  updateUserProfile(userId: string, profile: { profileMission?: string; profileValues?: string; profileLikes?: string; profileAbout?: string }): Promise<User | undefined>;

  // Sessions
  createSession(userId: string, expiresAt: Date): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  deleteSession(id: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;

  // Areas
  getAreas(userId: string): Promise<Area[]>;
  getArchivedAreas(userId: string): Promise<Area[]>;
  getArea(id: string): Promise<Area | undefined>;
  createArea(area: InsertArea): Promise<Area>;
  updateArea(id: string, area: Partial<InsertArea>): Promise<Area | undefined>;
  deleteArea(id: string): Promise<void>;
  archiveArea(id: string): Promise<Area | undefined>;
  unarchiveArea(id: string): Promise<Area | undefined>;

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
  getArchivedProjects(userId: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<void>;
  archiveProject(id: string): Promise<Project | undefined>;
  unarchiveProject(id: string): Promise<Project | undefined>;

  // Journal - Characters
  getJournalCharacters(userId: string): Promise<JournalCharacter[]>;
  getJournalCharacter(id: string): Promise<JournalCharacter | undefined>;
  createJournalCharacter(character: InsertJournalCharacter): Promise<JournalCharacter>;
  updateJournalCharacter(id: string, character: Partial<InsertJournalCharacter>): Promise<JournalCharacter | undefined>;
  deleteJournalCharacter(id: string): Promise<void>;

  // Journal - Places
  getJournalPlaces(userId: string): Promise<JournalPlace[]>;
  getJournalPlace(id: string): Promise<JournalPlace | undefined>;
  createJournalPlace(place: InsertJournalPlace): Promise<JournalPlace>;
  updateJournalPlace(id: string, place: Partial<InsertJournalPlace>): Promise<JournalPlace | undefined>;
  deleteJournalPlace(id: string): Promise<void>;

  // Journal - Shadows
  getJournalShadows(userId: string): Promise<JournalShadow[]>;
  getJournalShadow(id: string): Promise<JournalShadow | undefined>;
  createJournalShadow(shadow: InsertJournalShadow): Promise<JournalShadow>;
  updateJournalShadow(id: string, shadow: Partial<InsertJournalShadow>): Promise<JournalShadow | undefined>;
  deleteJournalShadow(id: string): Promise<void>;

  // Profile - Values
  getProfileValues(userId: string): Promise<ProfileValue[]>;
  getProfileValue(id: string): Promise<ProfileValue | undefined>;
  createProfileValue(value: InsertProfileValue): Promise<ProfileValue>;
  updateProfileValue(id: string, value: Partial<InsertProfileValue>): Promise<ProfileValue | undefined>;
  deleteProfileValue(id: string): Promise<void>;

  // Profile - Likes
  getProfileLikes(userId: string): Promise<ProfileLike[]>;
  getProfileLike(id: string): Promise<ProfileLike | undefined>;
  createProfileLike(like: InsertProfileLike): Promise<ProfileLike>;
  updateProfileLike(id: string, like: Partial<InsertProfileLike>): Promise<ProfileLike | undefined>;
  deleteProfileLike(id: string): Promise<void>;

  // Profile - Missions
  getProfileMissions(userId: string): Promise<ProfileMission[]>;
  getProfileMissionEntry(id: string): Promise<ProfileMission | undefined>;
  createProfileMission(mission: InsertProfileMission): Promise<ProfileMission>;
  updateProfileMission(id: string, mission: Partial<InsertProfileMission>): Promise<ProfileMission | undefined>;
  deleteProfileMission(id: string): Promise<void>;

  // Profile - About Entries
  getProfileAboutEntries(userId: string): Promise<ProfileAboutEntry[]>;
  getProfileAboutEntry(id: string): Promise<ProfileAboutEntry | undefined>;
  createProfileAboutEntry(entry: InsertProfileAboutEntry): Promise<ProfileAboutEntry>;
  updateProfileAboutEntry(id: string, entry: Partial<InsertProfileAboutEntry>): Promise<ProfileAboutEntry | undefined>;
  deleteProfileAboutEntry(id: string): Promise<void>;

  // Journal - Learnings
  getJournalLearnings(userId: string): Promise<JournalLearning[]>;
  createJournalLearning(learning: InsertJournalLearning): Promise<JournalLearning>;
  deleteJournalLearning(id: string): Promise<void>;

  // Journal - Tools
  getJournalTools(userId: string): Promise<JournalTool[]>;
  createJournalTool(tool: InsertJournalTool): Promise<JournalTool>;
  deleteJournalTool(id: string): Promise<void>;
}

export class DbStorage implements IStorage {
  // Users
  async createUser(username: string, password: string): Promise<User> {
    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.insert(users).values({ id, username, password: hashedPassword }).returning();
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async verifyUserPassword(username: string, password: string): Promise<User | undefined> {
    const user = await this.getUserByUsername(username);
    if (!user) return undefined;
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    return isPasswordValid ? user : undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async updateUserProfile(userId: string, profile: { profileMission?: string; profileValues?: string; profileLikes?: string; profileAbout?: string }): Promise<User | undefined> {
    const result = await db.update(users).set(profile).where(eq(users.id, userId)).returning();
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
    return await db.select().from(areas).where(
      and(eq(areas.userId, userId), eq(areas.archived, 0))
    );
  }

  async getArchivedAreas(userId: string): Promise<Area[]> {
    return await db.select().from(areas).where(
      and(eq(areas.userId, userId), eq(areas.archived, 1))
    );
  }

  async getArea(id: string): Promise<Area | undefined> {
    const result = await db.select().from(areas).where(eq(areas.id, id));
    return result[0];
  }

  async createArea(area: InsertArea): Promise<Area> {
    const insertData: typeof areas.$inferInsert = {
      id: area.id,
      userId: area.userId,
      name: area.name,
      icon: area.icon,
      color: area.color,
      description: area.description,
      unlockedLevel: area.unlockedLevel,
      nextLevelToAssign: area.nextLevelToAssign,
      levelSubtitles: area.levelSubtitles as Record<string, string>,
      archived: (area.archived ?? 0) as 0 | 1,
    };
    const result = await db.insert(areas).values(insertData).returning();
    return result[0];
  }

  async updateArea(id: string, area: Partial<InsertArea>): Promise<Area | undefined> {
    const updateData: Record<string, unknown> = {};
    if (area.name !== undefined) updateData.name = area.name;
    if (area.icon !== undefined) updateData.icon = area.icon;
    if (area.color !== undefined) updateData.color = area.color;
    if (area.description !== undefined) updateData.description = area.description;
    if (area.unlockedLevel !== undefined) updateData.unlockedLevel = area.unlockedLevel;
    if (area.nextLevelToAssign !== undefined) updateData.nextLevelToAssign = area.nextLevelToAssign;
    if (area.levelSubtitles !== undefined) updateData.levelSubtitles = area.levelSubtitles as Record<string, string>;
    if (area.archived !== undefined) updateData.archived = area.archived as 0 | 1;
    
    const result = await db.update(areas).set(updateData).where(eq(areas.id, id)).returning();
    return result[0];
  }

  async deleteArea(id: string): Promise<void> {
    await db.delete(areas).where(eq(areas.id, id));
  }

  async archiveArea(id: string): Promise<Area | undefined> {
    const result = await db.update(areas).set({ archived: 1 as 0 | 1 }).where(eq(areas.id, id)).returning();
    return result[0];
  }

  async unarchiveArea(id: string): Promise<Area | undefined> {
    const result = await db.update(areas).set({ archived: 0 as 0 | 1 }).where(eq(areas.id, id)).returning();
    return result[0];
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
    if (skill.action !== undefined) updateData.action = skill.action;
    if (skill.description !== undefined) updateData.description = skill.description;
    if (skill.feedback !== undefined) updateData.feedback = skill.feedback;
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
        const isFirstNode = position === 1;
        const isLevel1FirstNode = level === 1 && position === 1;
        let nodeTitle = "Objective quest";
        let nodeStatus: "locked" | "available" | "mastered" = "locked";
        if (isLevel1FirstNode) {
          nodeTitle = "inicio";
          nodeStatus = "mastered";
        } else if (isFirstNode && level >= 2) {
          nodeTitle = "";
          nodeStatus = "mastered";
        }
        const skillData: typeof skills.$inferInsert = {
          id,
          areaId,
          title: nodeTitle,
          description: "",
          x: 50,
          y: startY + (position - 1) * 150,
          status: nodeStatus,
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
        const isFirstNode = position === 1;
        const isLevel1FirstNode = level === 1 && position === 1;
        let nodeTitle = "Next objetive quest";
        let nodeStatus: "locked" | "available" | "mastered" = "locked";
        if (isLevel1FirstNode) {
          nodeTitle = "inicio";
          nodeStatus = "mastered";
        } else if (isFirstNode && level >= 2) {
          nodeTitle = "";
          nodeStatus = "mastered";
        }
        const skillData: typeof skills.$inferInsert = {
          id,
          projectId,
          title: nodeTitle,
          description: "",
          x: 50,
          y: startY + (position - 1) * 150,
          status: nodeStatus,
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
    return await db.select().from(projects).where(
      and(eq(projects.userId, userId), eq(projects.archived, 0))
    );
  }

  async getArchivedProjects(userId: string): Promise<Project[]> {
    return await db.select().from(projects).where(
      and(eq(projects.userId, userId), eq(projects.archived, 1))
    );
  }

  async getProject(id: string): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id));
    return result[0];
  }

  async createProject(project: InsertProject): Promise<Project> {
    const insertData: typeof projects.$inferInsert = {
      id: project.id,
      userId: project.userId,
      name: project.name,
      icon: project.icon,
      description: project.description,
      unlockedLevel: project.unlockedLevel,
      nextLevelToAssign: project.nextLevelToAssign,
      levelSubtitles: project.levelSubtitles as Record<string, string>,
      archived: (project.archived ?? 0) as 0 | 1,
      questType: (project.questType ?? "main") as "main" | "side" | "emergent",
    };
    const result = await db.insert(projects).values(insertData).returning();
    return result[0];
  }

  async updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined> {
    const updateData: Record<string, unknown> = {};
    if (project.name !== undefined) updateData.name = project.name;
    if (project.icon !== undefined) updateData.icon = project.icon;
    if (project.description !== undefined) updateData.description = project.description;
    if (project.unlockedLevel !== undefined) updateData.unlockedLevel = project.unlockedLevel;
    if (project.nextLevelToAssign !== undefined) updateData.nextLevelToAssign = project.nextLevelToAssign;
    if (project.levelSubtitles !== undefined) updateData.levelSubtitles = project.levelSubtitles as Record<string, string>;
    if (project.archived !== undefined) updateData.archived = project.archived as 0 | 1;
    
    const result = await db.update(projects).set(updateData).where(eq(projects.id, id)).returning();
    return result[0];
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async archiveProject(id: string): Promise<Project | undefined> {
    const result = await db.update(projects).set({ archived: 1 as 0 | 1 }).where(eq(projects.id, id)).returning();
    return result[0];
  }

  async unarchiveProject(id: string): Promise<Project | undefined> {
    const result = await db.update(projects).set({ archived: 0 as 0 | 1 }).where(eq(projects.id, id)).returning();
    return result[0];
  }

  // Sub-skills
  async getSubSkills(parentSkillId: string): Promise<Skill[]> {
    return await db.select().from(skills).where(eq(skills.parentSkillId, parentSkillId));
  }

  async deleteSubSkills(parentSkillId: string): Promise<void> {
    await db.delete(skills).where(eq(skills.parentSkillId, parentSkillId));
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
        const isFirstNode = position === 1;
        const isLevel1FirstNode = level === 1 && position === 1;
        const isLastNode = position === 5;
        let nodeTitle = "Next objetive quest";
        let nodeStatus: "locked" | "available" | "mastered" = "locked";
        if (isLevel1FirstNode) {
          nodeTitle = "inicio";
          nodeStatus = "mastered";
        } else if (isFirstNode && level >= 2) {
          nodeTitle = "";
          nodeStatus = "mastered";
        }
        const skillData: typeof skills.$inferInsert = {
          id,
          parentSkillId,
          title: nodeTitle,
          description: "",
          x: 50,
          y: startY + (position - 1) * 150,
          status: nodeStatus,
          dependencies: deps,
          level,
          levelPosition: position,
          isFinalNode: isLastNode ? 1 as 0 | 1 : 0 as 0 | 1,
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

  // Journal - Characters
  async getJournalCharacters(userId: string): Promise<JournalCharacter[]> {
    return await db.select().from(journalCharacters).where(eq(journalCharacters.userId, userId));
  }

  async getJournalCharacter(id: string): Promise<JournalCharacter | undefined> {
    const result = await db.select().from(journalCharacters).where(eq(journalCharacters.id, id));
    return result[0];
  }

  async createJournalCharacter(character: InsertJournalCharacter): Promise<JournalCharacter> {
    const id = randomUUID();
    const result = await db.insert(journalCharacters).values({ id, ...character }).returning();
    return result[0];
  }

  async updateJournalCharacter(id: string, character: Partial<InsertJournalCharacter>): Promise<JournalCharacter | undefined> {
    const result = await db.update(journalCharacters).set(character).where(eq(journalCharacters.id, id)).returning();
    return result[0];
  }

  async deleteJournalCharacter(id: string): Promise<void> {
    await db.delete(journalCharacters).where(eq(journalCharacters.id, id));
  }

  // Journal - Places
  async getJournalPlaces(userId: string): Promise<JournalPlace[]> {
    return await db.select().from(journalPlaces).where(eq(journalPlaces.userId, userId));
  }

  async getJournalPlace(id: string): Promise<JournalPlace | undefined> {
    const result = await db.select().from(journalPlaces).where(eq(journalPlaces.id, id));
    return result[0];
  }

  async createJournalPlace(place: InsertJournalPlace): Promise<JournalPlace> {
    const id = randomUUID();
    const result = await db.insert(journalPlaces).values({ id, ...place }).returning();
    return result[0];
  }

  async updateJournalPlace(id: string, place: Partial<InsertJournalPlace>): Promise<JournalPlace | undefined> {
    const result = await db.update(journalPlaces).set(place).where(eq(journalPlaces.id, id)).returning();
    return result[0];
  }

  async deleteJournalPlace(id: string): Promise<void> {
    await db.delete(journalPlaces).where(eq(journalPlaces.id, id));
  }

  // Journal - Shadows
  async getJournalShadows(userId: string): Promise<JournalShadow[]> {
    return await db.select().from(journalShadows).where(eq(journalShadows.userId, userId));
  }

  async getJournalShadow(id: string): Promise<JournalShadow | undefined> {
    const result = await db.select().from(journalShadows).where(eq(journalShadows.id, id));
    return result[0];
  }

  async createJournalShadow(shadow: InsertJournalShadow): Promise<JournalShadow> {
    const id = randomUUID();
    const result = await db.insert(journalShadows).values({ id, ...shadow }).returning();
    return result[0];
  }

  async updateJournalShadow(id: string, shadow: Partial<InsertJournalShadow>): Promise<JournalShadow | undefined> {
    const result = await db.update(journalShadows).set(shadow).where(eq(journalShadows.id, id)).returning();
    return result[0];
  }

  async deleteJournalShadow(id: string): Promise<void> {
    await db.delete(journalShadows).where(eq(journalShadows.id, id));
  }

  // Profile - Values
  async getProfileValues(userId: string): Promise<ProfileValue[]> {
    return await db.select().from(profileValues).where(eq(profileValues.userId, userId));
  }

  async getProfileValue(id: string): Promise<ProfileValue | undefined> {
    const result = await db.select().from(profileValues).where(eq(profileValues.id, id));
    return result[0];
  }

  async createProfileValue(value: InsertProfileValue): Promise<ProfileValue> {
    const id = randomUUID();
    const result = await db.insert(profileValues).values({ id, ...value }).returning();
    return result[0];
  }

  async updateProfileValue(id: string, value: Partial<InsertProfileValue>): Promise<ProfileValue | undefined> {
    const result = await db.update(profileValues).set(value).where(eq(profileValues.id, id)).returning();
    return result[0];
  }

  async deleteProfileValue(id: string): Promise<void> {
    await db.delete(profileValues).where(eq(profileValues.id, id));
  }

  // Profile - Likes
  async getProfileLikes(userId: string): Promise<ProfileLike[]> {
    return await db.select().from(profileLikes).where(eq(profileLikes.userId, userId));
  }

  async getProfileLike(id: string): Promise<ProfileLike | undefined> {
    const result = await db.select().from(profileLikes).where(eq(profileLikes.id, id));
    return result[0];
  }

  async createProfileLike(like: InsertProfileLike): Promise<ProfileLike> {
    const id = randomUUID();
    const result = await db.insert(profileLikes).values({ id, ...like }).returning();
    return result[0];
  }

  async updateProfileLike(id: string, like: Partial<InsertProfileLike>): Promise<ProfileLike | undefined> {
    const result = await db.update(profileLikes).set(like).where(eq(profileLikes.id, id)).returning();
    return result[0];
  }

  async deleteProfileLike(id: string): Promise<void> {
    await db.delete(profileLikes).where(eq(profileLikes.id, id));
  }

  // Profile - Missions
  async getProfileMissions(userId: string): Promise<ProfileMission[]> {
    return await db.select().from(profileMissions).where(eq(profileMissions.userId, userId));
  }

  async getProfileMissionEntry(id: string): Promise<ProfileMission | undefined> {
    const result = await db.select().from(profileMissions).where(eq(profileMissions.id, id));
    return result[0];
  }

  async createProfileMission(mission: InsertProfileMission): Promise<ProfileMission> {
    const id = randomUUID();
    const result = await db.insert(profileMissions).values({ id, ...mission }).returning();
    return result[0];
  }

  async updateProfileMission(id: string, mission: Partial<InsertProfileMission>): Promise<ProfileMission | undefined> {
    const result = await db.update(profileMissions).set(mission).where(eq(profileMissions.id, id)).returning();
    return result[0];
  }

  async deleteProfileMission(id: string): Promise<void> {
    await db.delete(profileMissions).where(eq(profileMissions.id, id));
  }

  // Profile - About Entries
  async getProfileAboutEntries(userId: string): Promise<ProfileAboutEntry[]> {
    return await db.select().from(profileAboutEntries).where(eq(profileAboutEntries.userId, userId));
  }

  async getProfileAboutEntry(id: string): Promise<ProfileAboutEntry | undefined> {
    const result = await db.select().from(profileAboutEntries).where(eq(profileAboutEntries.id, id));
    return result[0];
  }

  async createProfileAboutEntry(entry: InsertProfileAboutEntry): Promise<ProfileAboutEntry> {
    const id = randomUUID();
    const result = await db.insert(profileAboutEntries).values({ id, ...entry }).returning();
    return result[0];
  }

  async updateProfileAboutEntry(id: string, entry: Partial<InsertProfileAboutEntry>): Promise<ProfileAboutEntry | undefined> {
    const result = await db.update(profileAboutEntries).set(entry).where(eq(profileAboutEntries.id, id)).returning();
    return result[0];
  }

  async deleteProfileAboutEntry(id: string): Promise<void> {
    await db.delete(profileAboutEntries).where(eq(profileAboutEntries.id, id));
  }

  // Journal - Learnings
  async getJournalLearnings(userId: string): Promise<JournalLearning[]> {
    return await db.select().from(journalLearnings).where(eq(journalLearnings.userId, userId));
  }

  async createJournalLearning(learning: InsertJournalLearning): Promise<JournalLearning> {
    const id = randomUUID();
    const result = await db.insert(journalLearnings).values({ id, ...learning }).returning();
    return result[0];
  }

  async deleteJournalLearning(id: string): Promise<void> {
    await db.delete(journalLearnings).where(eq(journalLearnings.id, id));
  }

  // Journal - Tools
  async getJournalTools(userId: string): Promise<JournalTool[]> {
    return await db.select().from(journalTools).where(eq(journalTools.userId, userId));
  }

  async createJournalTool(tool: InsertJournalTool): Promise<JournalTool> {
    const id = randomUUID();
    const result = await db.insert(journalTools).values({ id, ...tool }).returning();
    return result[0];
  }

  async deleteJournalTool(id: string): Promise<void> {
    await db.delete(journalTools).where(eq(journalTools.id, id));
  }
}

export const storage = new DbStorage();
