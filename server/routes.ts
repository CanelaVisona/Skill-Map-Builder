import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAreaSchema, insertSkillSchema, insertProjectSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import cookieParser from "cookie-parser";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const SESSION_COOKIE_NAME = "session_id";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function sessionMiddleware(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
  
  if (sessionId) {
    const session = await storage.getSession(sessionId);
    if (session && new Date(session.expiresAt) > new Date()) {
      req.userId = session.userId;
    }
  }
  
  next();
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ message: "No autenticado" });
    return;
  }
  next();
}

async function verifySkillOwnership(skillOrId: string | { areaId: string | null; projectId: string | null; parentSkillId: string | null }, userId: string, maxDepth = 10): Promise<boolean> {
  const skill = typeof skillOrId === "string" 
    ? await storage.getSkill(skillOrId) 
    : skillOrId;
  
  if (!skill) return false;
  if (maxDepth <= 0) return false;
  
  if (skill.areaId) {
    const area = await storage.getArea(skill.areaId);
    return area !== undefined && area.userId === userId;
  }
  
  if (skill.projectId) {
    const project = await storage.getProject(skill.projectId);
    return project !== undefined && project.userId === userId;
  }
  
  if (skill.parentSkillId) {
    return verifySkillOwnership(skill.parentSkillId, userId, maxDepth - 1);
  }
  
  return false;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.use(cookieParser());
  app.use(sessionMiddleware);
  
  // Auth routes
  app.post("/api/login", async (req, res) => {
    try {
      const { username } = req.body;
      
      if (!username || typeof username !== "string" || username.trim().length === 0) {
        res.status(400).json({ message: "Nombre de usuario requerido" });
        return;
      }
      
      const trimmedUsername = username.trim().toLowerCase();
      
      let user = await storage.getUserByUsername(trimmedUsername);
      if (!user) {
        user = await storage.createUser(trimmedUsername);
      }
      
      const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
      const session = await storage.createSession(user.id, expiresAt);
      
      res.cookie(SESSION_COOKIE_NAME, session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_DURATION_MS,
      });
      
      res.json({ user: { id: user.id, username: user.username } });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/logout", async (req, res) => {
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
    if (sessionId) {
      await storage.deleteSession(sessionId);
    }
    res.clearCookie(SESSION_COOKIE_NAME);
    res.json({ message: "Sesión cerrada" });
  });
  
  app.get("/api/me", async (req, res) => {
    if (!req.userId) {
      res.json({ user: null });
      return;
    }
    
    const user = await storage.getUserById(req.userId);
    if (!user) {
      res.json({ user: null });
      return;
    }
    
    res.json({ user: { id: user.id, username: user.username } });
  });
  
  // Areas (protected)
  app.get("/api/areas", requireAuth, async (req, res) => {
    try {
      const areas = await storage.getAreas(req.userId!);
      const areasWithSkills = await Promise.all(
        areas.map(async (area) => {
          const skills = await storage.getSkills(area.id);
          return { ...area, skills };
        })
      );
      res.json(areasWithSkills);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/areas", requireAuth, async (req, res) => {
    try {
      const areaData = { ...req.body, userId: req.userId };
      const validatedArea = insertAreaSchema.parse(areaData);
      const area = await storage.createArea(validatedArea);
      res.status(201).json({ ...area, skills: [] });
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/areas/:id", requireAuth, async (req, res) => {
    try {
      const existingArea = await storage.getArea(req.params.id);
      if (!existingArea) {
        res.status(404).json({ message: "Area not found" });
        return;
      }
      if (existingArea.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para modificar esta área" });
        return;
      }
      const area = await storage.updateArea(req.params.id, req.body);
      res.json(area);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/areas/:id", requireAuth, async (req, res) => {
    try {
      const existingArea = await storage.getArea(req.params.id);
      if (!existingArea) {
        res.status(404).json({ message: "Area not found" });
        return;
      }
      if (existingArea.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para eliminar esta área" });
        return;
      }
      await storage.deleteArea(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/areas/archived", requireAuth, async (req, res) => {
    try {
      const archivedAreas = await storage.getArchivedAreas(req.userId!);
      const areasWithSkills = await Promise.all(
        archivedAreas.map(async (area) => {
          const skills = await storage.getSkills(area.id);
          return { ...area, skills };
        })
      );
      res.json(areasWithSkills);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/areas/:id/archive", requireAuth, async (req, res) => {
    try {
      const existingArea = await storage.getArea(req.params.id);
      if (!existingArea) {
        res.status(404).json({ message: "Area not found" });
        return;
      }
      if (existingArea.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para archivar esta área" });
        return;
      }
      const area = await storage.archiveArea(req.params.id);
      res.json(area);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/areas/:id/unarchive", requireAuth, async (req, res) => {
    try {
      const existingArea = await storage.getArea(req.params.id);
      if (!existingArea) {
        res.status(404).json({ message: "Area not found" });
        return;
      }
      if (existingArea.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para desarchivar esta área" });
        return;
      }
      const area = await storage.unarchiveArea(req.params.id);
      res.json(area);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Skills (protected)
  app.post("/api/skills", requireAuth, async (req, res) => {
    try {
      const validatedSkill = insertSkillSchema.parse(req.body);
      const skillLevel = validatedSkill.level ?? 1;
      
      // Check if this is an "add below" operation (client provides levelPosition)
      const isManualInsertion = validatedSkill.levelPosition !== undefined;
      
      if (!validatedSkill.areaId && !validatedSkill.projectId && !validatedSkill.parentSkillId) {
        res.status(400).json({ message: "areaId, projectId, or parentSkillId is required" });
        return;
      }
      
      // Verify ownership of parent resource using recursive check
      const isOwner = await verifySkillOwnership({
        areaId: validatedSkill.areaId || null,
        projectId: validatedSkill.projectId || null,
        parentSkillId: validatedSkill.parentSkillId || null
      }, req.userId!);
      
      if (!isOwner) {
        res.status(403).json({ message: "No tienes permiso para agregar skills a este recurso" });
        return;
      }
      
      // Only enforce 5-node limit for automatic additions, not manual insertions
      if (!isManualInsertion) {
        let currentCount = 0;
        if (validatedSkill.areaId) {
          currentCount = await storage.countSkillsInLevel(validatedSkill.areaId, skillLevel);
        } else if (validatedSkill.projectId) {
          currentCount = await storage.countProjectSkillsInLevel(validatedSkill.projectId, skillLevel);
        } else if (validatedSkill.parentSkillId) {
          currentCount = await storage.countSubSkillsInLevel(validatedSkill.parentSkillId, skillLevel);
        }
        
        if (currentCount >= 5) {
          res.status(400).json({ message: "Este nivel ya tiene 5 nodos. Completa el nodo final para desbloquear el siguiente nivel." });
          return;
        }
        
        const levelPosition = currentCount + 1;
        
        const enforcedStatus = levelPosition > 1 ? "locked" : validatedSkill.status;
        const enforcedManualLock = levelPosition > 1 ? 0 : (validatedSkill.manualLock || 0);
        
        const skillWithPosition = {
          ...validatedSkill,
          level: skillLevel,
          levelPosition,
          isFinalNode: 0 as 0 | 1,
          status: enforcedStatus,
          manualLock: enforcedManualLock as 0 | 1,
        };
        
        const skill = await storage.createSkill(skillWithPosition);
        res.status(201).json(skill);
      } else {
        // Manual insertion - use client-provided values
        const skillWithLevel = {
          ...validatedSkill,
          level: skillLevel,
        };
        
        const skill = await storage.createSkill(skillWithLevel);
        res.status(201).json(skill);
      }
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/skills/:id", requireAuth, async (req, res) => {
    try {
      const existingSkill = await storage.getSkill(req.params.id);
      if (!existingSkill) {
        res.status(404).json({ message: "Skill not found" });
        return;
      }

      // Verify ownership using recursive check through parent chain
      const isOwner = await verifySkillOwnership(existingSkill, req.userId!);
      if (!isOwner) {
        res.status(403).json({ message: "No tienes permiso para modificar este skill" });
        return;
      }

      // Prevent bypassing lock system for positions 2-5
      // Only the auto-unlock system or mastering should change status of locked nodes
      if (req.body.status === "available" && existingSkill.status === "locked") {
        // Verify dependencies are mastered before allowing unlock
        let allSkills: typeof existingSkill[] = [];
        if (existingSkill.areaId) {
          allSkills = await storage.getSkills(existingSkill.areaId);
        } else if (existingSkill.projectId) {
          allSkills = await storage.getProjectSkills(existingSkill.projectId);
        }
        const dependencies = (existingSkill.dependencies as string[]) || [];
        
        if (dependencies.length > 0) {
          const depsMastered = dependencies.every(depId => {
            const dep = allSkills.find(s => s.id === depId);
            return dep && dep.status === "mastered";
          });
          
          if (!depsMastered) {
            res.status(400).json({ message: "No puedes desbloquear este nodo. Primero domina los nodos anteriores." });
            return;
          }
        }
      }

      const skill = await storage.updateSkill(req.params.id, req.body);
      res.json(skill);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/skills/:id", requireAuth, async (req, res) => {
    try {
      const existingSkill = await storage.getSkill(req.params.id);
      if (!existingSkill) {
        res.status(404).json({ message: "Skill not found" });
        return;
      }

      // Verify ownership using recursive check through parent chain
      const isOwner = await verifySkillOwnership(existingSkill, req.userId!);
      if (!isOwner) {
        res.status(403).json({ message: "No tienes permiso para eliminar este skill" });
        return;
      }

      await storage.deleteSkill(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Generate 5 placeholder nodes for a new level (transactional, idempotent)
  app.post("/api/areas/:id/generate-level", requireAuth, async (req, res) => {
    try {
      const { level } = req.body;
      const areaId = req.params.id;
      
      if (!level || typeof level !== "number") {
        res.status(400).json({ message: "Level is required and must be a number" });
        return;
      }
      
      const existingArea = await storage.getArea(areaId);
      if (!existingArea) {
        res.status(404).json({ message: "Area not found" });
        return;
      }
      if (existingArea.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para modificar esta área" });
        return;
      }
      
      // Check if level already has nodes - if so, just update area and return existing nodes
      const allSkills = await storage.getSkills(areaId);
      const existingLevelSkills = allSkills.filter(s => s.level === level);
      
      if (existingLevelSkills.length > 0) {
        // Level already has nodes - update area's unlockedLevel
        const updatedArea = await storage.updateArea(areaId, { 
          unlockedLevel: level, 
          nextLevelToAssign: level 
        });
        
        // For level 2+, ensure first node is mastered with empty title
        if (level >= 2) {
          const sortedSkills = [...existingLevelSkills].sort((a, b) => a.y - b.y);
          const firstNode = sortedSkills[0];
          if (firstNode && (firstNode.status !== "mastered" || firstNode.title !== "")) {
            await storage.updateSkill(firstNode.id, { status: "mastered", title: "" });
            firstNode.status = "mastered";
            firstNode.title = "";
          }
        }
        
        res.status(200).json({ updatedArea, createdSkills: existingLevelSkills });
        return;
      }
      
      // Get last skill to calculate starting Y position
      let startY = 100;
      if (allSkills.length > 0) {
        const lastSkill = allSkills.reduce((max, s) => s.y > max.y ? s : max, allSkills[0]);
        startY = lastSkill.y + 150;
      }
      
      // Use transactional method that updates area and creates all skills atomically
      const { updatedArea, createdSkills } = await storage.generateLevelWithSkills(areaId, level, startY);
      
      res.status(201).json({ updatedArea, createdSkills });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Projects (protected)
  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const projectsList = await storage.getProjects(req.userId!);
      const projectsWithSkills = await Promise.all(
        projectsList.map(async (project) => {
          const skills = await storage.getProjectSkills(project.id);
          return { ...project, skills };
        })
      );
      res.json(projectsWithSkills);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
    try {
      const projectData = { ...req.body, userId: req.userId };
      const validatedProject = insertProjectSchema.parse(projectData);
      const project = await storage.createProject(validatedProject);
      res.status(201).json({ ...project, skills: [] });
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const existingProject = await storage.getProject(req.params.id);
      if (!existingProject) {
        res.status(404).json({ message: "Project not found" });
        return;
      }
      if (existingProject.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para eliminar este proyecto" });
        return;
      }
      await storage.deleteProject(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/archived", requireAuth, async (req, res) => {
    try {
      const archivedProjects = await storage.getArchivedProjects(req.userId!);
      const projectsWithSkills = await Promise.all(
        archivedProjects.map(async (project) => {
          const skills = await storage.getProjectSkills(project.id);
          return { ...project, skills };
        })
      );
      res.json(projectsWithSkills);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/projects/:id/archive", requireAuth, async (req, res) => {
    try {
      const existingProject = await storage.getProject(req.params.id);
      if (!existingProject) {
        res.status(404).json({ message: "Project not found" });
        return;
      }
      if (existingProject.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para archivar este proyecto" });
        return;
      }
      const project = await storage.archiveProject(req.params.id);
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/projects/:id/unarchive", requireAuth, async (req, res) => {
    try {
      const existingProject = await storage.getProject(req.params.id);
      if (!existingProject) {
        res.status(404).json({ message: "Project not found" });
        return;
      }
      if (existingProject.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para desarchivar este proyecto" });
        return;
      }
      const project = await storage.unarchiveProject(req.params.id);
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/generate-level", requireAuth, async (req, res) => {
    try {
      const { level } = req.body;
      const projectId = req.params.id;
      
      if (!level || typeof level !== "number") {
        res.status(400).json({ message: "Level is required and must be a number" });
        return;
      }
      
      const existingProject = await storage.getProject(projectId);
      if (!existingProject) {
        res.status(404).json({ message: "Project not found" });
        return;
      }
      if (existingProject.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para modificar este proyecto" });
        return;
      }
      
      const allSkills = await storage.getProjectSkills(projectId);
      const existingLevelSkills = allSkills.filter(s => s.level === level);
      
      if (existingLevelSkills.length > 0) {
        const updatedProject = await storage.updateProject(projectId, { 
          unlockedLevel: level, 
          nextLevelToAssign: level 
        });
        
        // For level 2+, ensure first node is mastered with empty title
        if (level >= 2) {
          const sortedSkills = [...existingLevelSkills].sort((a, b) => a.y - b.y);
          const firstNode = sortedSkills[0];
          if (firstNode && (firstNode.status !== "mastered" || firstNode.title !== "")) {
            await storage.updateSkill(firstNode.id, { status: "mastered", title: "" });
            firstNode.status = "mastered";
            firstNode.title = "";
          }
        }
        
        res.status(200).json({ updatedProject, createdSkills: existingLevelSkills });
        return;
      }
      
      let startY = 100;
      if (allSkills.length > 0) {
        const lastSkill = allSkills.reduce((max, s) => s.y > max.y ? s : max, allSkills[0]);
        startY = lastSkill.y + 150;
      }
      
      const { updatedProject, createdSkills } = await storage.generateProjectLevelWithSkills(projectId, level, startY);
      
      res.status(201).json({ updatedProject, createdSkills });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Skills for projects (protected)
  app.post("/api/projects/:id/skills", requireAuth, async (req, res) => {
    try {
      const projectId = req.params.id;
      
      // Verify project ownership
      const existingProject = await storage.getProject(projectId);
      if (!existingProject) {
        res.status(404).json({ message: "Project not found" });
        return;
      }
      if (existingProject.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para agregar skills a este proyecto" });
        return;
      }
      
      const validatedSkill = insertSkillSchema.parse({ ...req.body, projectId });
      const skillLevel = validatedSkill.level ?? 1;
      
      const currentCount = await storage.countProjectSkillsInLevel(projectId, skillLevel);
      
      if (currentCount >= 5) {
        res.status(400).json({ message: "Este nivel ya tiene 5 nodos. Completa el nodo final para desbloquear el siguiente nivel." });
        return;
      }
      
      const levelPosition = currentCount + 1;
      const enforcedStatus = levelPosition > 1 ? "locked" : validatedSkill.status;
      const enforcedManualLock = levelPosition > 1 ? 0 : (validatedSkill.manualLock || 0);
      
      const skillWithPosition = {
        ...validatedSkill,
        projectId,
        level: skillLevel,
        levelPosition,
        isFinalNode: 0 as 0 | 1,
        status: enforcedStatus,
        manualLock: enforcedManualLock as 0 | 1,
      };
      
      const skill = await storage.createSkill(skillWithPosition);
      res.status(201).json(skill);
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  // Sub-skills (protected)
  app.get("/api/skills/:id/subskills", requireAuth, async (req, res) => {
    try {
      const parentSkillId = req.params.id;
      const subSkills = await storage.getSubSkills(parentSkillId);
      res.json(subSkills);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/skills/:id/subskills/generate-level", requireAuth, async (req, res) => {
    try {
      const { level } = req.body;
      const parentSkillId = req.params.id;
      
      if (!level || typeof level !== "number") {
        res.status(400).json({ message: "Level is required and must be a number" });
        return;
      }
      
      // Verify ownership of parent skill using recursive check
      const isOwner = await verifySkillOwnership(parentSkillId, req.userId!);
      if (!isOwner) {
        res.status(403).json({ message: "No tienes permiso para agregar sub-skills a este recurso" });
        return;
      }
      
      const allSubSkills = await storage.getSubSkills(parentSkillId);
      const existingLevelSkills = allSubSkills.filter(s => s.level === level);
      
      if (existingLevelSkills.length > 0) {
        // For level 2+, ensure first node is mastered with empty title
        if (level >= 2) {
          const sortedSkills = [...existingLevelSkills].sort((a, b) => a.y - b.y);
          const firstNode = sortedSkills[0];
          if (firstNode && (firstNode.status !== "mastered" || firstNode.title !== "")) {
            await storage.updateSkill(firstNode.id, { status: "mastered", title: "" });
            firstNode.status = "mastered";
            firstNode.title = "";
          }
        }
        
        const parentSkill = await storage.getSkill(parentSkillId);
        res.status(200).json({ parentSkill, createdSkills: existingLevelSkills });
        return;
      }
      
      let startY = 100;
      if (allSubSkills.length > 0) {
        const lastSkill = allSubSkills.reduce((max, s) => s.y > max.y ? s : max, allSubSkills[0]);
        startY = lastSkill.y + 150;
      }
      
      const { parentSkill, createdSkills } = await storage.generateSubSkillLevel(parentSkillId, level, startY);
      
      res.status(201).json({ parentSkill, createdSkills });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/skills/:id/subskills", requireAuth, async (req, res) => {
    try {
      const parentSkillId = req.params.id;
      
      // Verify ownership of parent skill using recursive check
      const isOwner = await verifySkillOwnership(parentSkillId, req.userId!);
      if (!isOwner) {
        res.status(403).json({ message: "No tienes permiso para agregar sub-skills a este recurso" });
        return;
      }
      
      const validatedSkill = insertSkillSchema.parse({ ...req.body, parentSkillId });
      const skillLevel = validatedSkill.level ?? 1;
      
      const currentCount = await storage.countSubSkillsInLevel(parentSkillId, skillLevel);
      
      if (currentCount >= 5) {
        res.status(400).json({ message: "Este nivel ya tiene 5 nodos. Completa el nodo final para desbloquear el siguiente nivel." });
        return;
      }
      
      const levelPosition = currentCount + 1;
      const enforcedStatus = levelPosition > 1 ? "locked" : validatedSkill.status;
      const enforcedManualLock = levelPosition > 1 ? 0 : (validatedSkill.manualLock || 0);
      
      const skillWithPosition = {
        ...validatedSkill,
        parentSkillId,
        level: skillLevel,
        levelPosition,
        isFinalNode: 0 as 0 | 1,
        status: enforcedStatus,
        manualLock: enforcedManualLock as 0 | 1,
      };
      
      const skill = await storage.createSkill(skillWithPosition);
      res.status(201).json(skill);
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  return httpServer;
}
