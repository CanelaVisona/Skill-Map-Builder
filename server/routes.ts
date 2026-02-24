import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAreaSchema, insertSkillSchema, insertProjectSchema, insertJournalCharacterSchema, insertJournalPlaceSchema, insertJournalShadowSchema, insertProfileValueSchema, insertProfileLikeSchema, insertJournalLearningSchema, insertJournalToolSchema, insertJournalThoughtSchema, insertProfileMissionSchema, insertProfileAboutEntrySchema, insertProfileExperienceSchema, insertProfileContributionSchema, insertUserSkillsProgressSchema, insertSourceDescriptionSchema, insertSourceGrowthSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import cookieParser from "cookie-parser";
import crypto from "crypto";

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
      const { username, password } = req.body;
      
      if (!username || typeof username !== "string" || username.trim().length === 0) {
        res.status(400).json({ message: "Nombre de usuario requerido" });
        return;
      }
      
      if (!password || typeof password !== "string" || password.length === 0) {
        res.status(400).json({ message: "Contraseña requerida" });
        return;
      }
      
      const trimmedUsername = username.trim().toLowerCase();
      
      let user = await storage.getUserByUsername(trimmedUsername);
      if (!user) {
        // New user - create with password
        user = await storage.createUser(trimmedUsername, password);
      } else {
        // Existing user - check if they have password
        if (!user.password) {
          // User exists but has no password - set one now
          const updatedUser = await storage.setUserPassword(user.id, password);
          if (!updatedUser) {
            res.status(500).json({ message: "Error al actualizar contraseña" });
            return;
          }
          user = updatedUser;
        } else {
          // Verify password
          const verifiedUser = await storage.verifyUserPassword(trimmedUsername, password);
          if (!verifiedUser) {
            res.status(401).json({ message: "Contraseña incorrecta" });
            return;
          }
          user = verifiedUser;
        }
      }

      if (!user) {
        res.status(500).json({ message: "Error al crear usuario" });
        return;
      }
      
      // Create example area for users with no areas/projects
      const userAreas = await storage.getAreas(user.id);
      const userProjects = await storage.getProjects(user.id);
      if (userAreas.length === 0 && userProjects.length === 0) {
          // Create example area
          const exampleArea = await storage.createArea({
            id: crypto.randomUUID(),
            name: "Ejemplo: Guitarra",
            icon: "Music",
            color: "#3B82F6",
            description: "Esta es un área de ejemplo. Mantén presionado para ver opciones.",
            userId: user.id,
          });
          
          // Generate the first level with 5 skills
          await storage.generateLevelWithSkills(exampleArea.id, 1, 100);
          
          // Update the first few skills with example content
          const exampleSkills = await storage.getSkills(exampleArea.id);
          const sortedSkills = exampleSkills.sort((a, b) => a.y - b.y);
          
          // First skill is already "inicio" and mastered
          // Update second skill to be available with example content
          if (sortedSkills[1]) {
            await storage.updateSkill(sortedSkills[1].id, {
              title: "Acordes Básicos",
              description: "Aprende C, D, E, G, A. ¡Haz clic en el título para ver subtareas!",
              status: "available",
            });
            
            // Create subtasks for "Acordes Básicos"
            const gSub1 = await storage.createSkill({ parentSkillId: sortedSkills[1].id, title: "inicio", description: "", status: "mastered", x: 50, y: 100, dependencies: [], level: 1, levelPosition: 1 });
            const gSub2 = await storage.createSkill({ parentSkillId: sortedSkills[1].id, title: "Acorde C", description: "Practica el acorde de Do mayor", status: "available", x: 50, y: 250, dependencies: [gSub1.id], level: 1, levelPosition: 2 });
            const gSub3 = await storage.createSkill({ parentSkillId: sortedSkills[1].id, title: "Acorde G", description: "Practica el acorde de Sol mayor", status: "locked", x: 50, y: 400, dependencies: [gSub2.id], level: 1, levelPosition: 3 });
            await storage.createSkill({ parentSkillId: sortedSkills[1].id, title: "Acorde D", description: "Practica el acorde de Re mayor", status: "locked", x: 50, y: 550, dependencies: [gSub3.id], level: 1, levelPosition: 4 });
          }
          
          // Update third skill with example content
          if (sortedSkills[2]) {
            await storage.updateSkill(sortedSkills[2].id, {
              title: "Ritmo 4/4",
              description: "Rasgueo básico. Se desbloquea al completar el anterior.",
            });
          }
          
          // Update fourth skill
          if (sortedSkills[3]) {
            await storage.updateSkill(sortedSkills[3].id, {
              title: "Cambios de Acordes",
              description: "Practica transiciones fluidas entre acordes.",
            });
          }
          
          // Update fifth skill
          if (sortedSkills[4]) {
            await storage.updateSkill(sortedSkills[4].id, {
              title: "Primera Canción",
              description: "Toca tu primera canción completa.",
            });
          }
          
          // Create example project (trip)
          const exampleProject = await storage.createProject({
            id: crypto.randomUUID(),
            name: "Ejemplo: Viaje a Barcelona",
            icon: "Camera",
            description: "Un proyecto tiene fecha de fin. ¡Planifica tu próximo viaje!",
            userId: user.id,
          });
          
          // Generate the first level with skills
          await storage.generateProjectLevelWithSkills(exampleProject.id, 1, 100);
          
          // Update project skills with travel content
          const projectSkills = await storage.getProjectSkills(exampleProject.id);
          const sortedProjectSkills = projectSkills.sort((a, b) => a.y - b.y);
          
          if (sortedProjectSkills[1]) {
            await storage.updateSkill(sortedProjectSkills[1].id, {
              title: "Elegir fechas",
              description: "Define cuándo quieres viajar y cuántos días.",
              status: "available",
            });
          }
          
          if (sortedProjectSkills[2]) {
            await storage.updateSkill(sortedProjectSkills[2].id, {
              title: "Reservar vuelo",
              description: "Busca y compara precios. ¡Haz clic en el título para ver subtareas!",
            });
            
            // Create subtasks for "Reservar vuelo"
            const tSub1 = await storage.createSkill({ parentSkillId: sortedProjectSkills[2].id, title: "inicio", description: "", status: "mastered", x: 50, y: 100, dependencies: [], level: 1, levelPosition: 1 });
            const tSub2 = await storage.createSkill({ parentSkillId: sortedProjectSkills[2].id, title: "Comparar precios", description: "Usa Skyscanner, Google Flights, etc.", status: "available", x: 50, y: 250, dependencies: [tSub1.id], level: 1, levelPosition: 2 });
            const tSub3 = await storage.createSkill({ parentSkillId: sortedProjectSkills[2].id, title: "Elegir horarios", description: "Decide el mejor horario de vuelo", status: "locked", x: 50, y: 400, dependencies: [tSub2.id], level: 1, levelPosition: 3 });
            await storage.createSkill({ parentSkillId: sortedProjectSkills[2].id, title: "Completar reserva", description: "Finaliza la compra del vuelo", status: "locked", x: 50, y: 550, dependencies: [tSub3.id], level: 1, levelPosition: 4 });
          }
          
          if (sortedProjectSkills[3]) {
            await storage.updateSkill(sortedProjectSkills[3].id, {
              title: "Reservar hotel",
              description: "Encuentra alojamiento en la zona que prefieras.",
            });
          }
          
          if (sortedProjectSkills[4]) {
            await storage.updateSkill(sortedProjectSkills[4].id, {
              title: "Armar itinerario",
              description: "Planifica qué lugares visitar cada día.",
            });
          }
          
          // Create example journal entries (gamified but realistic)
          await storage.createJournalCharacter({
            userId: user.id,
            name: "MAMÁ",
            action: "",
            description: "NPC aliado. Siempre tiene items de curación disponibles. Misión secundaria: llamarla una vez por semana."
          });
          
          await storage.createJournalPlace({
            userId: user.id,
            name: "CAFÉ DE LA ESQUINA",
            action: "",
            description: "Zona segura. Ideal para farmear concentración. El café con leche otorga +20 energía por 2 horas."
          });
          
          await storage.createJournalShadow({
            userId: user.id,
            name: "PROCRASTINACIÓN",
            action: "",
            description: "Boss recurrente. Aparece cuando hay deadlines cerca. Debilidad: dividir tareas en pasos pequeños. Drop rate de culpa: 80%."
          });
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
    
    res.json({ 
      user: { 
        id: user.id, 
        username: user.username,
        profileMission: user.profileMission || "",
        profileValues: user.profileValues || "",
        profileLikes: user.profileLikes || "",
        profileAbout: user.profileAbout || ""
      } 
    });
  });

  app.put("/api/profile", requireAuth, async (req, res) => {
    try {
      const { profileMission, profileValues, profileLikes, profileAbout } = req.body;
      const updatedUser = await storage.updateUserProfile(req.userId!, {
        profileMission,
        profileValues,
        profileLikes,
        profileAbout
      });
      if (!updatedUser) {
        res.status(404).json({ message: "Usuario no encontrado" });
        return;
      }
      res.json({ 
        user: { 
          id: updatedUser.id, 
          username: updatedUser.username,
          profileMission: updatedUser.profileMission || "",
          profileValues: updatedUser.profileValues || "",
          profileLikes: updatedUser.profileLikes || "",
          profileAbout: updatedUser.profileAbout || ""
        } 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
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
      // Exception: fromSubtaskCompletion bypasses this check (when subtasks are completed)
      if (req.body.status === "available" && existingSkill.status === "locked" && !req.body.fromSubtaskCompletion) {
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

  app.delete("/api/skills/:id/subskills", requireAuth, async (req, res) => {
    try {
      const parentSkillId = req.params.id;
      
      const isOwner = await verifySkillOwnership(parentSkillId, req.userId!);
      if (!isOwner) {
        res.status(403).json({ message: "No tienes permiso para borrar estas sub-skills" });
        return;
      }
      
      await storage.deleteSubSkills(parentSkillId);
      res.status(200).json({ message: "Sub-skills deleted successfully" });
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

  // Journal - Characters
  app.get("/api/journal/characters", requireAuth, async (req, res) => {
    try {
      const characters = await storage.getJournalCharacters(req.userId!);
      res.json(characters);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/journal/characters", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, userId: req.userId };
      const validated = insertJournalCharacterSchema.parse(data);
      const character = await storage.createJournalCharacter(validated);
      res.status(201).json(character);
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/journal/characters/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getJournalCharacter(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "Character not found" });
        return;
      }
      if (existing.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para modificar este personaje" });
        return;
      }
      const updated = await storage.updateJournalCharacter(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/journal/characters/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getJournalCharacter(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "Character not found" });
        return;
      }
      if (existing.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para eliminar este personaje" });
        return;
      }
      await storage.deleteJournalCharacter(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Journal - Places
  app.get("/api/journal/places", requireAuth, async (req, res) => {
    try {
      const places = await storage.getJournalPlaces(req.userId!);
      res.json(places);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/journal/places", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, userId: req.userId };
      const validated = insertJournalPlaceSchema.parse(data);
      const place = await storage.createJournalPlace(validated);
      res.status(201).json(place);
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/journal/places/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getJournalPlace(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "Place not found" });
        return;
      }
      if (existing.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para modificar este lugar" });
        return;
      }
      const updated = await storage.updateJournalPlace(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/journal/places/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getJournalPlace(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "Place not found" });
        return;
      }
      if (existing.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para eliminar este lugar" });
        return;
      }
      await storage.deleteJournalPlace(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Journal - Shadows
  app.get("/api/journal/shadows", requireAuth, async (req, res) => {
    try {
      const shadows = await storage.getJournalShadows(req.userId!);
      res.json(shadows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/journal/shadows", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, userId: req.userId };
      const validated = insertJournalShadowSchema.parse(data);
      const shadow = await storage.createJournalShadow(validated);
      res.status(201).json(shadow);
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/journal/shadows/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getJournalShadow(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "Shadow not found" });
        return;
      }
      if (existing.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para modificar esta sombra" });
        return;
      }
      const updated = await storage.updateJournalShadow(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/journal/shadows/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getJournalShadow(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "Shadow not found" });
        return;
      }
      if (existing.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para eliminar esta sombra" });
        return;
      }
      await storage.deleteJournalShadow(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Journal - Learnings
  app.get("/api/journal/learnings", requireAuth, async (req, res) => {
    try {
      const skillId = req.query.skillId as string | undefined;
      console.log("[GET /api/journal/learnings]", { userId: req.userId, skillId });
      
      const learnings = await storage.getJournalLearnings(req.userId!);
      console.log("[GET /api/journal/learnings] Total learnings:", learnings.length);
      
      const filtered = skillId ? learnings.filter(l => l.skillId === skillId) : learnings;
      console.log("[GET /api/journal/learnings] Filtered learnings:", filtered.length, "for skillId:", skillId);
      
      res.json(filtered);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/journal/learnings", requireAuth, async (req, res) => {
    try {
      console.log("[POST /api/journal/learnings]", {
        userId: req.userId,
        body: req.body,
      });
      
      const data = { ...req.body, userId: req.userId };
      console.log("[POST /api/journal/learnings] Data to validate:", data);
      
      const validated = insertJournalLearningSchema.parse(data);
      console.log("[POST /api/journal/learnings] Validated:", validated);
      
      const learning = await storage.createJournalLearning(validated);
      console.log("[POST /api/journal/learnings] Created:", learning);
      
      res.status(201).json(learning);
    } catch (error: any) {
      console.error("[POST /api/journal/learnings] Error:", error.message);
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.delete("/api/journal/learnings/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteJournalLearning(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/journal/learnings/:id", requireAuth, async (req, res) => {
    try {
      console.log('[routes] PATCH /api/journal/learnings/:id called');
      console.log('[routes] req.params.id:', req.params.id);
      console.log('[routes] req.body:', req.body);
      
      const { title, sentence } = req.body;
      const data: any = {};
      if (title !== undefined) data.title = title;
      if (sentence !== undefined) data.sentence = sentence;
      
      console.log('[routes] Updating with data:', data);
      const learning = await storage.updateJournalLearning(req.params.id, data);
      console.log('[routes] Update result:', learning);
      
      if (!learning) {
        res.status(404).json({ message: "Pensamiento no encontrado" });
        return;
      }
      res.json(learning);
    } catch (error: any) {
      console.error('[routes] PATCH error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Journal - Tools
  app.get("/api/journal/tools", requireAuth, async (req, res) => {
    try {
      const skillId = req.query.skillId as string | undefined;
      console.log("[GET /api/journal/tools]", { userId: req.userId, skillId });
      
      const tools = await storage.getJournalTools(req.userId!);
      console.log("[GET /api/journal/tools] Total tools:", tools.length);
      
      const filtered = skillId ? tools.filter(t => t.skillId === skillId) : tools;
      console.log("[GET /api/journal/tools] Filtered tools:", filtered.length, "for skillId:", skillId);
      
      res.json(filtered);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/journal/tools", requireAuth, async (req, res) => {
    try {
      console.log("[POST /api/journal/tools]", {
        userId: req.userId,
        body: req.body,
      });
      
      const data = { ...req.body, userId: req.userId };
      console.log("[POST /api/journal/tools] Data to validate:", data);
      
      const validated = insertJournalToolSchema.parse(data);
      console.log("[POST /api/journal/tools] Validated:", validated);
      
      const tool = await storage.createJournalTool(validated);
      console.log("[POST /api/journal/tools] Created:", tool);
      
      res.status(201).json(tool);
    } catch (error: any) {
      console.error("[POST /api/journal/tools] Error:", error.message);
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.delete("/api/journal/tools/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteJournalTool(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/journal/tools/:id", requireAuth, async (req, res) => {
    try {
      console.log('[routes] PATCH /api/journal/tools/:id called');
      console.log('[routes] req.params.id:', req.params.id);
      console.log('[routes] req.body:', req.body);
      
      const { title, sentence } = req.body;
      const data: any = {};
      if (title !== undefined) data.title = title;
      if (sentence !== undefined) data.sentence = sentence;
      
      console.log('[routes] Updating with data:', data);
      const tool = await storage.updateJournalTool(req.params.id, data);
      console.log('[routes] Update result:', tool);
      
      if (!tool) {
        res.status(404).json({ message: "Herramienta no encontrada" });
        return;
      }
      res.json(tool);
    } catch (error: any) {
      console.error('[routes] PATCH error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Journal - Thoughts
  app.get("/api/journal/thoughts", requireAuth, async (req, res) => {
    try {
      const skillId = req.query.skillId as string | undefined;
      console.log("[GET /api/journal/thoughts]", { userId: req.userId, skillId });
      
      const thoughts = await storage.getJournalThoughts(req.userId!);
      console.log("[GET /api/journal/thoughts] Total thoughts:", thoughts.length);
      
      const filtered = skillId ? thoughts.filter(t => {
        const match = t.skillId === skillId;
        if (!match) {
          console.log(`[GET /api/journal/thoughts] Filtering: thought.skillId=${t.skillId} vs ${skillId} = ${match}`);
        }
        return match;
      }) : thoughts;
      
      console.log("[GET /api/journal/thoughts] Filtered thoughts:", filtered.length);
      res.json(filtered);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/journal/thoughts", requireAuth, async (req, res) => {
    try {
      console.log("[POST /api/journal/thoughts]", {
        userId: req.userId,
        body: req.body,
      });
      
      const data = { ...req.body, userId: req.userId };
      console.log("[POST /api/journal/thoughts] Data to validate:", data);
      
      const validated = insertJournalThoughtSchema.parse(data);
      console.log("[POST /api/journal/thoughts] Validated:", validated);
      
      const thought = await storage.createJournalThought(validated);
      console.log("[POST /api/journal/thoughts] Created:", thought);
      
      res.status(201).json(thought);
    } catch (error: any) {
      console.error("[POST /api/journal/thoughts] Error:", error.message);
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.delete("/api/journal/thoughts/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteJournalThought(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/journal/thoughts/:id", requireAuth, async (req, res) => {
    try {
      const { title, sentence } = req.body;
      const data: any = {};
      if (title !== undefined) data.title = title;
      if (sentence !== undefined) data.sentence = sentence;
      
      const thought = await storage.updateJournalThought(req.params.id, data);
      
      if (!thought) {
        res.status(404).json({ message: "Pensamiento no encontrado" });
        return;
      }
      res.json(thought);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Profile - Values
  app.get("/api/profile/values", requireAuth, async (req, res) => {
    try {
      const values = await storage.getProfileValues(req.userId!);
      res.json(values);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/profile/values", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, userId: req.userId };
      const validated = insertProfileValueSchema.parse(data);
      const value = await storage.createProfileValue(validated);
      res.status(201).json(value);
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/profile/values/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getProfileValue(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "Value not found" });
        return;
      }
      if (existing.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para modificar este valor" });
        return;
      }
      const updated = await storage.updateProfileValue(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/profile/values/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getProfileValue(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "Value not found" });
        return;
      }
      if (existing.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para eliminar este valor" });
        return;
      }
      await storage.deleteProfileValue(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Profile - Likes
  app.get("/api/profile/likes", requireAuth, async (req, res) => {
    try {
      const likes = await storage.getProfileLikes(req.userId!);
      res.json(likes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/profile/likes", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, userId: req.userId };
      const validated = insertProfileLikeSchema.parse(data);
      const like = await storage.createProfileLike(validated);
      res.status(201).json(like);
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/profile/likes/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getProfileLike(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "Like not found" });
        return;
      }
      if (existing.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para modificar este gusto" });
        return;
      }
      const updated = await storage.updateProfileLike(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/profile/likes/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getProfileLike(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "Like not found" });
        return;
      }
      if (existing.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para eliminar este gusto" });
        return;
      }
      await storage.deleteProfileLike(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Profile - Missions
  app.get("/api/profile/missions", requireAuth, async (req, res) => {
    try {
      const missions = await storage.getProfileMissions(req.userId!);
      res.json(missions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/profile/missions", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, userId: req.userId };
      const validated = insertProfileMissionSchema.parse(data);
      const mission = await storage.createProfileMission(validated);
      res.status(201).json(mission);
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/profile/missions/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getProfileMissionEntry(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "Mission not found" });
        return;
      }
      if (existing.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para modificar esta misión" });
        return;
      }
      const updated = await storage.updateProfileMission(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/profile/missions/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getProfileMissionEntry(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "Mission not found" });
        return;
      }
      if (existing.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para eliminar esta misión" });
        return;
      }
      await storage.deleteProfileMission(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Profile - About
  app.get("/api/profile/about", requireAuth, async (req, res) => {
    try {
      const entries = await storage.getProfileAboutEntries(req.userId!);
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/profile/about", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, userId: req.userId };
      const validated = insertProfileAboutEntrySchema.parse(data);
      const entry = await storage.createProfileAboutEntry(validated);
      res.status(201).json(entry);
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/profile/about/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getProfileAboutEntry(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "About entry not found" });
        return;
      }
      if (existing.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para modificar esta entrada" });
        return;
      }
      const updated = await storage.updateProfileAboutEntry(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/profile/about/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getProfileAboutEntry(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "About entry not found" });
        return;
      }
      if (existing.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para eliminar esta entrada" });
        return;
      }
      await storage.deleteProfileAboutEntry(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Profile - Experiences
  app.get("/api/profile/experiences", requireAuth, async (req, res) => {
    try {
      const experiences = await storage.getProfileExperiences(req.userId!);
      res.json(experiences);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/profile/experiences", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, userId: req.userId };
      const validated = insertProfileExperienceSchema.parse(data);
      const experience = await storage.createProfileExperience(validated);
      res.status(201).json(experience);
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/profile/experiences/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getProfileExperience(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "Experience not found" });
        return;
      }
      if (existing.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para modificar esta experiencia" });
        return;
      }
      const updated = await storage.updateProfileExperience(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/profile/experiences/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getProfileExperience(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "Experience not found" });
        return;
      }
      if (existing.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para eliminar esta experiencia" });
        return;
      }
      await storage.deleteProfileExperience(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Profile - Contributions
  app.get("/api/profile/contributions", requireAuth, async (req, res) => {
    try {
      const contributions = await storage.getProfileContributions(req.userId!);
      res.json(contributions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/profile/contributions", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, userId: req.userId };
      const validated = insertProfileContributionSchema.parse(data);
      const contribution = await storage.createProfileContribution(validated);
      res.status(201).json(contribution);
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/profile/contributions/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getProfileContribution(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "Contribution not found" });
        return;
      }
      if (existing.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para modificar esta contribución" });
        return;
      }
      const updated = await storage.updateProfileContribution(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/profile/contributions/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getProfileContribution(req.params.id);
      if (!existing) {
        res.status(404).json({ message: "Contribution not found" });
        return;
      }
      if (existing.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para eliminar esta contribución" });
        return;
      }
      await storage.deleteProfileContribution(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get experiences filtered by source (area or project)
  app.get("/api/profile/experiences/by-source/:type/:sourceId", requireAuth, async (req, res) => {
    try {
      const { type, sourceId } = req.params;
      if (type !== "area" && type !== "project") {
        res.status(400).json({ message: "Invalid type. Must be 'area' or 'project'" });
        return;
      }
      const experiences = await storage.getProfileExperiencesBySource(req.userId!, type, sourceId);
      res.json(experiences);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get contributions filtered by source (area or project)
  app.get("/api/profile/contributions/by-source/:type/:sourceId", requireAuth, async (req, res) => {
    try {
      const { type, sourceId } = req.params;
      if (type !== "area" && type !== "project") {
        res.status(400).json({ message: "Invalid type. Must be 'area' or 'project'" });
        return;
      }
      const contributions = await storage.getProfileContributionsBySource(req.userId!, type, sourceId);
      res.json(contributions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Source Descriptions CRUD
  app.get("/api/source-descriptions/:type/:sourceId", requireAuth, async (req, res) => {
    try {
      const { type, sourceId } = req.params;
      if (type !== "area" && type !== "project") {
        res.status(400).json({ message: "Invalid type. Must be 'area' or 'project'" });
        return;
      }
      const descriptions = await storage.getSourceDescriptions(req.userId!, type, sourceId);
      res.json(descriptions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/source-descriptions", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, userId: req.userId };
      const validated = insertSourceDescriptionSchema.parse(data);
      const description = await storage.createSourceDescription(validated);
      res.status(201).json(description);
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/source-descriptions/:id", requireAuth, async (req, res) => {
    try {
      const updated = await storage.updateSourceDescription(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ message: "Source description not found" });
        return;
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/source-descriptions/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteSourceDescription(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Source Growth CRUD
  app.get("/api/source-growth/:type/:sourceId", requireAuth, async (req, res) => {
    try {
      const { type, sourceId } = req.params;
      if (type !== "area" && type !== "project") {
        res.status(400).json({ message: "Invalid type. Must be 'area' or 'project'" });
        return;
      }
      const growth = await storage.getSourceGrowth(req.userId!, type, sourceId);
      res.json(growth);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/source-growth", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, userId: req.userId };
      const validated = insertSourceGrowthSchema.parse(data);
      const growth = await storage.createSourceGrowth(validated);
      res.status(201).json(growth);
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/source-growth/:id", requireAuth, async (req, res) => {
    try {
      const updated = await storage.updateSourceGrowth(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ message: "Source growth not found" });
        return;
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/source-growth/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteSourceGrowth(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Skills Progress
  app.get("/api/skills-progress", requireAuth, async (req, res) => {
    try {
      const progress = await storage.getUserSkillsProgress(req.userId!);
      res.json(progress);
    } catch (error: any) {
      // If table doesn't exist, return empty array
      if (error.message?.includes('relation "user_skills_progress" does not exist') || 
          error.message?.includes('does not exist')) {
        console.warn('user_skills_progress table does not exist yet, returning empty array');
        res.json([]);
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.post("/api/skills-progress", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, userId: req.userId };
      const validated = insertUserSkillsProgressSchema.parse(data);
      const progress = await storage.upsertUserSkillsProgress(validated, req.userId!);
      res.json(progress);
    } catch (error: any) {
      // If table doesn't exist, we still try to provide useful feedback
      if (error.message?.includes('relation "user_skills_progress" does not exist') || 
          error.message?.includes('does not exist')) {
        console.error('user_skills_progress table does not exist. The server will attempt to create it on restart.');
        res.status(500).json({ message: 'Database table is being initialized. Please try again in a moment.' });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  return httpServer;
}
