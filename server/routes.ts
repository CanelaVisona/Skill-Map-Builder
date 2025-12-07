import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAreaSchema, insertSkillSchema, insertProjectSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Areas
  app.get("/api/areas", async (req, res) => {
    try {
      const areas = await storage.getAreas();
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

  app.post("/api/areas", async (req, res) => {
    try {
      const validatedArea = insertAreaSchema.parse(req.body);
      const area = await storage.createArea(validatedArea);
      res.status(201).json({ ...area, skills: [] });
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/areas/:id", async (req, res) => {
    try {
      const area = await storage.updateArea(req.params.id, req.body);
      if (!area) {
        res.status(404).json({ message: "Area not found" });
        return;
      }
      res.json(area);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/areas/:id", async (req, res) => {
    try {
      await storage.deleteArea(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Skills
  app.post("/api/skills", async (req, res) => {
    try {
      const validatedSkill = insertSkillSchema.parse(req.body);
      const skillLevel = validatedSkill.level ?? 1;
      
      if (!validatedSkill.areaId) {
        res.status(400).json({ message: "areaId is required" });
        return;
      }
      
      const currentCount = await storage.countSkillsInLevel(validatedSkill.areaId, skillLevel);
      
      if (currentCount >= 5) {
        res.status(400).json({ message: "Este nivel ya tiene 5 nodos. Completa el nodo final para desbloquear el siguiente nivel." });
        return;
      }
      
      const levelPosition = currentCount + 1;
      const isFinalNode = levelPosition === 5 ? 1 : 0;
      
      // Enforce: positions 2-5 must start as locked (they depend on previous node being mastered)
      // Position 1 can use client-provided status (or default to available)
      const enforcedStatus = levelPosition > 1 ? "locked" : validatedSkill.status;
      const enforcedManualLock = levelPosition > 1 ? 0 : (validatedSkill.manualLock || 0);
      
      const skillWithPosition = {
        ...validatedSkill,
        level: skillLevel,
        levelPosition,
        isFinalNode: isFinalNode as 0 | 1,
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

  app.patch("/api/skills/:id", async (req, res) => {
    try {
      const existingSkill = await storage.getSkill(req.params.id);
      if (!existingSkill) {
        res.status(404).json({ message: "Skill not found" });
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

  app.delete("/api/skills/:id", async (req, res) => {
    try {
      await storage.deleteSkill(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Generate 5 placeholder nodes for a new level (transactional, idempotent)
  app.post("/api/areas/:id/generate-level", async (req, res) => {
    try {
      const { level } = req.body;
      const areaId = req.params.id;
      
      if (!level || typeof level !== "number") {
        res.status(400).json({ message: "Level is required and must be a number" });
        return;
      }
      
      // Check if level already has nodes - if so, just update area and return existing nodes
      const allSkills = await storage.getSkills(areaId);
      const existingLevelSkills = allSkills.filter(s => s.level === level);
      
      if (existingLevelSkills.length > 0) {
        // Level already has nodes - update area's unlockedLevel and return existing data
        const updatedArea = await storage.updateArea(areaId, { 
          unlockedLevel: level, 
          nextLevelToAssign: level 
        });
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

  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projectsList = await storage.getProjects();
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

  app.post("/api/projects", async (req, res) => {
    try {
      const validatedProject = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(validatedProject);
      res.status(201).json({ ...project, skills: [] });
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      await storage.deleteProject(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/generate-level", async (req, res) => {
    try {
      const { level } = req.body;
      const projectId = req.params.id;
      
      if (!level || typeof level !== "number") {
        res.status(400).json({ message: "Level is required and must be a number" });
        return;
      }
      
      const allSkills = await storage.getProjectSkills(projectId);
      const existingLevelSkills = allSkills.filter(s => s.level === level);
      
      if (existingLevelSkills.length > 0) {
        const updatedProject = await storage.updateProject(projectId, { 
          unlockedLevel: level, 
          nextLevelToAssign: level 
        });
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

  // Skills for projects
  app.post("/api/projects/:id/skills", async (req, res) => {
    try {
      const projectId = req.params.id;
      const validatedSkill = insertSkillSchema.parse({ ...req.body, projectId });
      const skillLevel = validatedSkill.level ?? 1;
      
      const currentCount = await storage.countProjectSkillsInLevel(projectId, skillLevel);
      
      if (currentCount >= 5) {
        res.status(400).json({ message: "Este nivel ya tiene 5 nodos. Completa el nodo final para desbloquear el siguiente nivel." });
        return;
      }
      
      const levelPosition = currentCount + 1;
      const isFinalNode = levelPosition === 5 ? 1 : 0;
      const enforcedStatus = levelPosition > 1 ? "locked" : validatedSkill.status;
      const enforcedManualLock = levelPosition > 1 ? 0 : (validatedSkill.manualLock || 0);
      
      const skillWithPosition = {
        ...validatedSkill,
        projectId,
        level: skillLevel,
        levelPosition,
        isFinalNode: isFinalNode as 0 | 1,
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
