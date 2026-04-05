import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { insertAreaSchema, insertSkillSchema, insertProjectSchema, insertJournalCharacterSchema, insertJournalPlaceSchema, insertJournalShadowSchema, insertProfileValueSchema, insertProfileLikeSchema, insertJournalLearningSchema, insertJournalToolSchema, insertJournalThoughtSchema, insertProfileMissionSchema, insertProfileAboutEntrySchema, insertProfileExperienceSchema, insertProfileContributionSchema, insertUserSkillsProgressSchema, insertSourceDescriptionSchema, insertSourceGrowthSchema, insertGlobalSkillSchema, insertHabitSchema, insertHabitRecordSchema, insertSpaceRepetitionPracticeSchema, skills } from "@shared/schema";
import { fromError } from "zod-validation-error";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import Busboy from "busboy";

const __dirname = process.cwd();

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
      // Prevent HTTP caching to ensure fresh data
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
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
      
      // Automatically create levels 1-4 for new areas
      console.log(`[POST /api/areas] Creating levels 1-4 for new area: ${area.id}`);
      let startY = 100;
      let lastCreatedArea = area;
      
      for (let level = 1; level <= 4; level++) {
        try {
          const { updatedArea, createdSkills } = await storage.generateLevelWithSkills(area.id, level, startY);
          lastCreatedArea = updatedArea;
          console.log(`[POST /api/areas] ✓ Created level ${level} with ${createdSkills.length} skills`);
          
          // Calculate next startY position
          if (createdSkills.length > 0) {
            const lastSkill = createdSkills.reduce((max, s) => s.y > max.y ? s : max, createdSkills[0]);
            startY = lastSkill.y + 150;
          }
        } catch (levelError) {
          console.error(`[POST /api/areas] Error creating level ${level}:`, levelError);
          // Continue to next level even if one fails
        }
      }
      
      // Update area: unlockedLevel=1 (visible), nextLevelToAssign=5 (next to create)
      const finalArea = await storage.updateArea(area.id, {
        unlockedLevel: 1,
        nextLevelToAssign: 5
      });
      
      // Get all skills for the response
      const allSkills = await storage.getSkills(area.id);
      console.log(`[POST /api/areas] ✓ Area created with ${allSkills.length} total skills (4 levels × 5 nodes)`);
      res.status(201).json({ ...finalArea, skills: allSkills });
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/areas/:id", requireAuth, async (req, res) => {
    try {
      console.log('[PATCH areas] received body:', req.body);
      const existingArea = await storage.getArea(req.params.id);
      if (!existingArea) {
        res.status(404).json({ message: "Area not found" });
        return;
      }
      if (existingArea.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para modificar esta área" });
        return;
      }

      const areaId = req.params.id;
      const { endOfAreaLevel } = req.body;
      const isChangingEndOfAreaLevel = endOfAreaLevel !== undefined && endOfAreaLevel !== existingArea.endOfAreaLevel;

      // Handle level generation when endOfAreaLevel changes
      if (isChangingEndOfAreaLevel) {
        if (endOfAreaLevel === null) {
          // Deactivate: Generate 3 new levels
          console.log('[PATCH /api/areas] Deactivating end-of-area, generating 3 new levels');
          const currentUnlockedLevel = existingArea.unlockedLevel;
          
          let startY = 100;
          const allSkills = await storage.getSkills(areaId);
          if (allSkills.length > 0) {
            const lastSkill = allSkills.reduce((max, s) => s.y > max.y ? s : max, allSkills[0]);
            startY = lastSkill.y + 150;
          }
          
          for (let i = 1; i <= 3; i++) {
            const newLevel = currentUnlockedLevel + i;
            try {
              await storage.generateLevelWithSkills(areaId, newLevel, startY);
              const updatedSkills = await storage.getSkills(areaId);
              const newLevelSkills = updatedSkills.filter(s => s.level === newLevel);
              if (newLevelSkills.length > 0) {
                const lastSkill = newLevelSkills.reduce((max, s) => s.y > max.y ? s : max, newLevelSkills[0]);
                startY = lastSkill.y + 150;
              }
            } catch (levelError) {
              console.error(`Error generating level ${newLevel}:`, levelError);
            }
          }
        } else {
          // Activate: Delete staged levels (skills with level > unlockedLevel)
          console.log('[PATCH /api/areas] Activating end-of-area, deleting staged levels');
          const unlockedLevel = existingArea.unlockedLevel;
          const scheduledForDeletion = await storage.getSkills(areaId);
          const skillsToDelete = scheduledForDeletion.filter(s => s.level > unlockedLevel);
          
          for (const skill of skillsToDelete) {
            await storage.deleteSkill(skill.id);
          }
        }
      }

      const area = await storage.updateArea(areaId, req.body);
      console.log('[PATCH /api/areas] ✓ Area updated:', area?.id, 'endOfAreaLevel:', area?.endOfAreaLevel);
      const areaWithSkills = await storage.getSkills(areaId);
      res.json({ ...area, skills: areaWithSkills });
    } catch (error: any) {
      console.error('[PATCH /api/areas] ❌ ERROR:', error);
      console.error('[PATCH /api/areas] Stack:', error.stack);
      res.status(500).json({ message: error.message, stack: error.stack });
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

  app.patch("/api/areas/:id/toggle-end-of-area", requireAuth, async (req, res) => {
    try {
      const { isActive } = req.body; // true to activate (end area), false to deactivate
      const areaId = req.params.id;

      const existingArea = await storage.getArea(areaId);
      if (!existingArea) {
        res.status(404).json({ message: "Area not found" });
        return;
      }
      if (existingArea.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para modificar esta área" });
        return;
      }

      if (isActive) {
        // Activate: set endOfAreaLevel = unlockedLevel, delete staged levels
        const unlockedLevel = existingArea.unlockedLevel;
        
        // Delete all skills in levels > unlockedLevel
        const scheduledForDeletion = await storage.getSkills(areaId);
        const skillsToDelete = scheduledForDeletion.filter(s => s.level > unlockedLevel);
        
        for (const skill of skillsToDelete) {
          await storage.deleteSkill(skill.id);
        }
        
        // Update area: set endOfAreaLevel
        const updatedArea = await storage.updateArea(areaId, { endOfAreaLevel: unlockedLevel });
        res.json(updatedArea);
      } else {
        // Deactivate: set endOfAreaLevel = null, generate 3 new levels
        const currentUnlockedLevel = existingArea.unlockedLevel;
        
        // Generate 3 new levels (currentUnlockedLevel+1, +2, +3)
        let startY = 100;
        const allSkills = await storage.getSkills(areaId);
        if (allSkills.length > 0) {
          const lastSkill = allSkills.reduce((max, s) => s.y > max.y ? s : max, allSkills[0]);
          startY = lastSkill.y + 150;
        }
        
        for (let i = 1; i <= 3; i++) {
          const newLevel = currentUnlockedLevel + i;
          try {
            await storage.generateLevelWithSkills(areaId, newLevel, startY);
            // Update startY for next level
            const updatedSkills = await storage.getSkills(areaId);
            const newLevelSkills = updatedSkills.filter(s => s.level === newLevel);
            if (newLevelSkills.length > 0) {
              const lastSkill = newLevelSkills.reduce((max, s) => s.y > max.y ? s : max, newLevelSkills[0]);
              startY = lastSkill.y + 150;
            }
          } catch (levelError) {
            console.error(`Error generating level ${newLevel}:`, levelError);
          }
        }
        
        // Update area: clear endOfAreaLevel
        const updatedArea = await storage.updateArea(areaId, { endOfAreaLevel: null });
        const areaWithSkills = await storage.getSkills(areaId);
        res.json({ ...updatedArea, skills: areaWithSkills });
      }
    } catch (error: any) {
      console.error("Error toggling end-of-area:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Recalculate final nodes for a specific level (called after duplication)
  app.post("/api/areas/:id/recalculate-level-final-nodes", requireAuth, async (req, res) => {
    try {
      const { level } = req.body;
      const areaId = req.params.id;
      
      if (!level || typeof level !== "number") {
        res.status(400).json({ message: "level is required and must be a number" });
        return;
      }

      const area = await storage.getArea(areaId);
      if (!area) {
        res.status(404).json({ message: "Area not found" });
        return;
      }
      if (area.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para modificar esta área" });
        return;
      }

      await storage.recalculateFinalNodes(level, { areaId });
      
      const updatedSkills = await storage.getSkills(areaId);
      res.json({ message: "Final nodes recalculated", skills: updatedSkills });
    } catch (error: any) {
      console.error("Error recalculating final nodes:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/recalculate-level-final-nodes", requireAuth, async (req, res) => {
    try {
      const { level } = req.body;
      const projectId = req.params.id;
      
      if (!level || typeof level !== "number") {
        res.status(400).json({ message: "level is required and must be a number" });
        return;
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        res.status(404).json({ message: "Project not found" });
        return;
      }
      if (project.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para modificar este proyecto" });
        return;
      }

      await storage.recalculateFinalNodes(level, { projectId });
      
      const updatedSkills = await storage.getProjectSkills(projectId);
      res.json({ message: "Final nodes recalculated", skills: updatedSkills });
    } catch (error: any) {
      console.error("Error recalculating final nodes:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sub-skills/:id/recalculate-level-final-nodes", requireAuth, async (req, res) => {
    try {
      const { level } = req.body;
      const parentSkillId = req.params.id;
      
      if (!level || typeof level !== "number") {
        res.status(400).json({ message: "level is required and must be a number" });
        return;
      }

      const parentSkill = await storage.getSkill(parentSkillId);
      if (!parentSkill) {
        res.status(404).json({ message: "Parent skill not found" });
        return;
      }

      // Verify ownership
      const isOwner = await verifySkillOwnership(parentSkill, req.userId!);
      if (!isOwner) {
        res.status(403).json({ message: "No tienes permiso para modificar estos sub-skills" });
        return;
      }

      await storage.recalculateFinalNodes(level, { parentSkillId });
      
      const updatedSkills = await storage.getSubSkills(parentSkillId);
      res.json({ message: "Final nodes recalculated", skills: updatedSkills });
    } catch (error: any) {
      console.error("Error recalculating final nodes:", error);
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
        
        // First node of level is always mastered with empty title
        let enforcedStatus: string;
        let enforcedTitle: string;
        
        if (levelPosition === 1) {
          enforcedStatus = "mastered";
          enforcedTitle = "";
        } else {
          enforcedStatus = "locked";
          enforcedTitle = validatedSkill.title;
        }
        
        const enforcedManualLock = levelPosition > 1 ? 0 : (validatedSkill.manualLock || 0);
        
        const skillWithPosition = {
          ...validatedSkill,
          level: skillLevel,
          levelPosition,
          isFinalNode: 0 as 0 | 1,
          status: enforcedStatus,
          title: enforcedTitle,
          manualLock: enforcedManualLock as 0 | 1,
        };
        
        const skill = await storage.createSkill(skillWithPosition);
        
        // Recalculate Y coordinates for all nodes in the area/project/parent
        await storage.recalculateYCoordinates({
          areaId: validatedSkill.areaId || undefined,
          projectId: validatedSkill.projectId || undefined,
          parentSkillId: validatedSkill.parentSkillId || undefined,
        });
        
        res.status(201).json(skill);
      } else {
        // Manual insertion - use client-provided values but enforce first node rules
        let finalTitle = validatedSkill.title;
        let finalStatus = validatedSkill.status;
        
        // If this is the first node in the level AND not a locked node, make it mastered with empty title
        // Locked nodes should preserve their status and title from user input
        if (validatedSkill.levelPosition === 1 && validatedSkill.status !== "locked") {
          finalStatus = "mastered";
          finalTitle = "";
        } else if (validatedSkill.levelPosition && validatedSkill.levelPosition > 1 && validatedSkill.status === "locked") {
          // Check if there's already an available node in this level
          // If not, the first non-mastered node should be available
          let existingSkills: typeof validatedSkill[] = [];
          if (validatedSkill.areaId) {
            existingSkills = await storage.getSkills(validatedSkill.areaId);
          } else if (validatedSkill.projectId) {
            existingSkills = await storage.getProjectSkills(validatedSkill.projectId);
          } else if (validatedSkill.parentSkillId) {
            existingSkills = await storage.getSubSkills(validatedSkill.parentSkillId);
          }
          
          const skillsInLevel = existingSkills.filter(s => s.level === skillLevel);
          const hasAvailableNode = skillsInLevel.some(s => s.status === "available");
          
          // If no available node exists, make this one available
          if (!hasAvailableNode) {
            finalStatus = "available";
          }
        }
        
        const skillWithLevel = {
          ...validatedSkill,
          level: skillLevel,
          title: finalTitle,
          status: finalStatus,
        };
        
        const skill = await storage.createSkill(skillWithLevel);
        
        // Recalculate Y coordinates for all nodes in the area/project/parent
        await storage.recalculateYCoordinates({
          areaId: validatedSkill.areaId || undefined,
          projectId: validatedSkill.projectId || undefined,
          parentSkillId: validatedSkill.parentSkillId || undefined,
        });
        
        res.status(201).json(skill);
      }
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/skills/:id", requireAuth, async (req, res) => {
    try {
      console.log('[PATCH /api/skills] body:', req.body, 'skillId:', req.params.id);
      
      const existingSkill = await storage.getSkill(req.params.id);
      console.log('[PATCH /api/skills] existingSkill status:', existingSkill?.status, 'title:', existingSkill?.title);
      
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

      // Handle XP propagation: if updating experiencePoints on a subskill, also update parent
      if (req.body.experiencePoints !== undefined && existingSkill.parentSkillId) {
        const currentXp = existingSkill.experiencePoints || 0;
        const newXp = req.body.experiencePoints;
        const xpDifference = newXp - currentXp;
        
        if (xpDifference !== 0) {
          // Get parent skill and update its XP
          const parentSkill = await storage.getSkill(existingSkill.parentSkillId);
          if (parentSkill) {
            const parentCurrentXp = parentSkill.experiencePoints || 0;
            await storage.updateSkill(existingSkill.parentSkillId, {
              experiencePoints: parentCurrentXp + xpDifference
            });
          }
        }
      }

      // Handle level generation when endOfAreaLevel changes on a skill with subskills
      // NOTE: Skills (including parent skills) don't have endOfAreaLevel column
      // Only areas and projects have endOfAreaLevel
      // Skip subskill level generation if endOfAreaLevel is in the request
      if (req.body.endOfAreaLevel !== undefined) {
        delete req.body.endOfAreaLevel;
      }

      const skill = await storage.updateSkill(req.params.id, req.body);
      
      // Auto-unlock logic: when a node is mastered, unlock the next node in the same level
      if (req.body.status === "mastered" && existingSkill.level && existingSkill.levelPosition) {
        let allSkills: typeof existingSkill[] = [];
        if (existingSkill.areaId) {
          allSkills = await storage.getSkills(existingSkill.areaId);
        } else if (existingSkill.projectId) {
          allSkills = await storage.getProjectSkills(existingSkill.projectId);
        }
        
        // Find the next node (levelPosition + 1) in the same level
        const nextNode = allSkills.find(s => 
          s.level === existingSkill.level && 
          s.levelPosition === existingSkill.levelPosition + 1
        );
        
        // If next node exists and is locked, unlock it
        if (nextNode && nextNode.status === "locked") {
          await storage.updateSkill(nextNode.id, { status: "available" });
        }
      }

      // Re-lock logic: when a node is unconfirmed (mastered → available), re-lock the next node
      if (req.body.status === "available" && existingSkill.status === "mastered" && existingSkill.level && existingSkill.levelPosition) {
        let allSkills: typeof existingSkill[] = [];
        if (existingSkill.areaId) {
          allSkills = await storage.getSkills(existingSkill.areaId);
        } else if (existingSkill.projectId) {
          allSkills = await storage.getProjectSkills(existingSkill.projectId);
        }
        
        // Find the next node (levelPosition + 1) in the same level
        const nextNode = allSkills.find(s => 
          s.level === existingSkill.level && 
          s.levelPosition === existingSkill.levelPosition + 1
        );
        
        // If next node exists and is available (not yet confirmed), re-lock it
        if (nextNode && nextNode.status === "available") {
          await storage.updateSkill(nextNode.id, { status: "locked" });
        }

        // NEW RULE: If this is a final node (isFinalNode === 1) being unconfirmed,
        // reset the next level to its initial staged state
        if (existingSkill.isFinalNode === 1) {
          const nextLevelSkills = allSkills.filter(s => s.level === existingSkill.level + 1);
          for (const nextLevelSkill of nextLevelSkills) {
            let resetStatus: "locked" | "available" | "mastered" = "locked";
            if (nextLevelSkill.levelPosition === 1) {
              resetStatus = "mastered";
            } else if (nextLevelSkill.levelPosition === 2) {
              resetStatus = "available";
            }
            await storage.updateSkill(nextLevelSkill.id, { status: resetStatus });
          }

          // Also update the area's unlockedLevel to revert back to current level
          if (existingSkill.areaId) {
            await storage.updateArea(existingSkill.areaId, { unlockedLevel: existingSkill.level });
          } else if (existingSkill.projectId) {
            await storage.updateProject(existingSkill.projectId, { unlockedLevel: existingSkill.level });
          }
        }
      }
      
      // Return all skills from this level so client gets the updates (e.g., next node unlocked)
      let updatedLevelSkills: typeof skill[] = [];
      if (existingSkill.level && existingSkill.areaId) {
        const allSkills = await storage.getSkills(existingSkill.areaId);
        updatedLevelSkills = allSkills.filter(s => s.level === existingSkill.level);
      } else if (existingSkill.level && existingSkill.projectId) {
        const allSkills = await storage.getProjectSkills(existingSkill.projectId);
        updatedLevelSkills = allSkills.filter(s => s.level === existingSkill.level);
      }
      
      res.json(updatedLevelSkills.length > 0 ? updatedLevelSkills : skill);
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

      // Get level info and all skills in the same level BEFORE deletion
      const deletedLevel = existingSkill.level;
      const deletedStatus = existingSkill.status;
      const deletedLevelPosition = existingSkill.levelPosition;
      
      const parentInfo = {
        areaId: existingSkill.areaId || undefined,
        projectId: existingSkill.projectId || undefined,
        parentSkillId: existingSkill.parentSkillId || undefined
      };

      // Get all skills in the same level before deletion to find next/previous nodes
      let siblingSkilsBeforeDeletion: typeof existingSkill[] = [];
      if (existingSkill.areaId && !existingSkill.projectId && !existingSkill.parentSkillId) {
        siblingSkilsBeforeDeletion = await storage.getSkills(existingSkill.areaId);
      } else if (existingSkill.projectId && !existingSkill.parentSkillId) {
        siblingSkilsBeforeDeletion = await storage.getProjectSkills(existingSkill.projectId);
      } else if (existingSkill.parentSkillId) {
        siblingSkilsBeforeDeletion = await storage.getSubSkills(existingSkill.parentSkillId);
      }

      const sameLevelSiblings = siblingSkilsBeforeDeletion.filter(s => 
        s.level === deletedLevel && s.id !== req.params.id
      );

      // Delete the skill
      await storage.deleteSkill(req.params.id);
      
      // Recalculate Y coordinates for all remaining nodes in the area/project/parent
      await storage.recalculateYCoordinates(parentInfo);
      
      // Cascading unlock logic: if deleted skill was 'available', unlock next node
      if (deletedStatus === "available") {
        // Find next node (levelPosition + 1 in same level)
        const nextNode = sameLevelSiblings.find(s => s.levelPosition === deletedLevelPosition + 1);
        
        if (nextNode && nextNode.status === "locked") {
          // Unlock the next node
          await storage.updateSkill(nextNode.id, { status: "available" });
        } else if (!nextNode) {
          // No next node, find previous node (levelPosition - 1)
          const previousNode = sameLevelSiblings.find(s => s.levelPosition === deletedLevelPosition - 1);
          
          if (previousNode && previousNode.status === "mastered") {
            // Set previous node back to available
            await storage.updateSkill(previousNode.id, { status: "available" });
          }
        }
      }
      
      // Recalculate final nodes in the affected level after deletion
      await storage.recalculateFinalNodes(deletedLevel, parentInfo);
      
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Move skill to another level (with replacement node)
  app.patch("/api/skills/:id/move", requireAuth, async (req, res) => {
    try {
      const { targetLevel, parentType, parentId } = req.body;
      
      if (!targetLevel || typeof targetLevel !== "number") {
        res.status(400).json({ message: "targetLevel is required and must be a number" });
        return;
      }
      
      if (!parentType || !["area", "project"].includes(parentType)) {
        res.status(400).json({ message: "parentType must be 'area' or 'project'" });
        return;
      }
      
      if (!parentId) {
        res.status(400).json({ message: "parentId is required" });
        return;
      }

      const existingSkill = await storage.getSkill(req.params.id);
      if (!existingSkill) {
        res.status(404).json({ message: "Skill not found" });
        return;
      }

      // Verify ownership
      const isOwner = await verifySkillOwnership(existingSkill, req.userId!);
      if (!isOwner) {
        res.status(403).json({ message: "No tienes permiso para mover este skill" });
        return;
      }

      const currentLevel = existingSkill.level;
      if (targetLevel <= currentLevel) {
        res.status(400).json({ message: "Target level must be greater than current level" });
        return;
      }

      // Get all skills in the parent
      let allSkills = [];
      if (parentType === "area") {
        allSkills = await storage.getSkills(parentId);
      } else {
        allSkills = await storage.getProjectSkills(parentId);
      }

      // Calculate max level to validate target
      const maxLevel = Math.max(...allSkills.map(s => s.level), 0);
      if (targetLevel > maxLevel + 3) {
        res.status(400).json({ message: "Target level exceeds unlocked levels" });
        return;
      }

      const startY = 100;
      const endY = 600;

      // Get skills in target level
      let targetLevelSkills = allSkills.filter(s => s.level === targetLevel);
      
      // Check if target level is locked (no skills exist yet)
      if (targetLevelSkills.length === 0) {
        // Auto-generate 5 placeholders for the new level
        let createdPlaceholders: any[] = [];
        let previousSkillId: string | null = null;

        // Generate placeholder skills for the new level
        for (let position = 1; position <= 5; position++) {
          const id = crypto.randomUUID();
          const deps: string[] = previousSkillId ? [previousSkillId] : [];
          const skillData: typeof skills.$inferInsert = {
            id,
            areaId: parentType === "area" ? parentId : null,
            projectId: parentType === "project" ? parentId : null,
            title: position === 1 ? "" : "Nodo " + position,
            description: "",
            x: 50,
            y: startY + (position - 1) * 150,
            status: position === 1 ? "mastered" : "locked",
            dependencies: deps,
            level: targetLevel,
            levelPosition: position,
            isAutoComplete: position === 1 ? 1 : 0,
            isFinalNode: position === 5 ? 1 : 0,
            manualLock: 0 as 0 | 1,
          };

          const result = await db.insert(skills).values(skillData).returning();
          createdPlaceholders.push(result[0]);
          previousSkillId = id;
        }

        targetLevelSkills = createdPlaceholders;
        // Refresh allSkills
        if (parentType === "area") {
          allSkills = await storage.getSkills(parentId);
        } else {
          allSkills = await storage.getProjectSkills(parentId);
        }

        // Update area/project's unlockedLevel
        if (parentType === "area") {
          await storage.updateArea(parentId, { 
            unlockedLevel: targetLevel, 
            nextLevelToAssign: targetLevel 
          });
        } else {
          await storage.updateProject(parentId, { 
            unlockedLevel: targetLevel, 
            nextLevelToAssign: targetLevel 
          });
        }
      }

      // Move the skill to target level (don't delete any placeholders - append instead)
      // This keeps all 5 placeholders + adds the moved skill = 6 total nodes
      const movedSkill = await storage.updateSkill(req.params.id, {
        level: targetLevel,
        status: "locked"
      });

      // Reposition remaining skills in ORIGINAL level with proportional spacing
      const originalLevelSkills = allSkills.filter(s => s.level === currentLevel);
      const remainingOriginalSkills = originalLevelSkills
        .filter(s => s.id !== req.params.id)
        .sort((a, b) => a.y - b.y);

      const repositionedSourceSkills: any[] = [];
      if (remainingOriginalSkills.length > 0) {
        const sourceSpacing = remainingOriginalSkills.length > 1 
          ? (endY - startY) / (remainingOriginalSkills.length - 1)
          : 150;

        for (let i = 0; i < remainingOriginalSkills.length; i++) {
          const skill = remainingOriginalSkills[i];
          const newPosition = i + 1;
          const newYPosition = Math.round(startY + (i * sourceSpacing));

          try {
            const updated = await storage.updateSkill(skill.id, {
              y: newYPosition,
              levelPosition: newPosition
            });
            if (updated) {
              repositionedSourceSkills.push(updated);
            }
          } catch (updateError: any) {
            console.error(`Error updating source skill ${skill.id}:`, updateError.message);
          }
        }
      }

      // Reposition ALL skills in TARGET level (including moved skill + all placeholders)
      const refreshedAllSkills = parentType === "area" 
        ? await storage.getSkills(parentId)
        : await storage.getProjectSkills(parentId);
      
      const allTargetLevelSkills = refreshedAllSkills
        .filter(s => s.level === targetLevel)
        .sort((a, b) => a.y - b.y);

      const updatedSkillIds = new Set<string>();
      if (allTargetLevelSkills.length > 0) {
        const targetSpacingFinal = allTargetLevelSkills.length > 1 
          ? (endY - startY) / (allTargetLevelSkills.length - 1)
          : 150;

        for (let i = 0; i < allTargetLevelSkills.length; i++) {
          const skill = allTargetLevelSkills[i];
          if (!skill || !skill.id) {
            console.error("Invalid skill in allTargetLevelSkills:", skill);
            continue;
          }
          
          const newPosition = i + 1;
          const newYPosition = Math.round(startY + (i * targetSpacingFinal));

          try {
            const updated = await storage.updateSkill(skill.id, {
              y: newYPosition,
              levelPosition: newPosition
            });
            if (updated) {
              updatedSkillIds.add(updated.id);
            }
          } catch (updateError: any) {
            console.error(`Error updating skill ${skill.id}:`, updateError.message);
          }
        }
      }

      // Fetch final state of target level to return ALL skills (moved skill + all placeholders)
      const finalRefreshedSkills = parentType === "area" 
        ? await storage.getSkills(parentId)
        : await storage.getProjectSkills(parentId);
      
      const repositionedTargetSkills = finalRefreshedSkills
        .filter(s => s.level === targetLevel)
        .sort((a, b) => a.levelPosition - b.levelPosition);

      // Recalculate final nodes and node statuses for both levels (since positions changed)
      const parentInfo = {
        areaId: parentType === "area" ? parentId : undefined,
        projectId: parentType === "project" ? parentId : undefined
      };
      
      await storage.recalculateFinalNodes(currentLevel, parentInfo);
      await storage.recalculateFinalNodes(targetLevel, parentInfo);
      await storage.recalculateNodeStatuses(currentLevel, parentInfo);
      await storage.recalculateNodeStatuses(targetLevel, parentInfo);

      // Fetch final updated state of both levels to include correct statuses
      const finalAllSkills = parentType === "area" 
        ? await storage.getSkills(parentId)
        : await storage.getProjectSkills(parentId);

      const finalSourceSkills = finalAllSkills
        .filter(s => s.level === currentLevel)
        .sort((a, b) => a.levelPosition - b.levelPosition);

      const finalTargetSkills = finalAllSkills
        .filter(s => s.level === targetLevel)
        .sort((a, b) => a.levelPosition - b.levelPosition);

      // Return the final repositioned moved skill
      const finalMovedSkill = finalTargetSkills.find(s => s.id === req.params.id);

      res.json({ 
        movedSkill: finalMovedSkill || movedSkill, 
        sourceLevel: { skills: finalSourceSkills },
        targetLevel: { skills: finalTargetSkills }
      });
    } catch (error: any) {
      console.error("Error in move skill endpoint:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Reorder skill within same level (swap with adjacent)
  app.patch("/api/skills/:id/reorder", requireAuth, async (req, res) => {
    try {
      const { direction, parentType, parentId, currentLevel } = req.body;
      
      if (!direction || !["up", "down"].includes(direction)) {
        res.status(400).json({ message: "direction must be 'up' or 'down'" });
        return;
      }
      
      if (!parentType || !["area", "project"].includes(parentType)) {
        res.status(400).json({ message: "parentType must be 'area' or 'project'" });
        return;
      }
      
      if (!parentId) {
        res.status(400).json({ message: "parentId is required" });
        return;
      }

      const existingSkill = await storage.getSkill(req.params.id);
      if (!existingSkill) {
        res.status(404).json({ message: "Skill not found" });
        return;
      }

      // Verify ownership
      const isOwner = await verifySkillOwnership(existingSkill, req.userId!);
      if (!isOwner) {
        res.status(403).json({ message: "No tienes permiso para reordenar este skill" });
        return;
      }

      // Get all skills in the parent
      let allSkills = [];
      if (parentType === "area") {
        allSkills = await storage.getSkills(parentId);
      } else {
        allSkills = await storage.getProjectSkills(parentId);
      }

      // Get skills in same level sorted by Y position
      const sameLevelSkills = allSkills
        .filter(s => s.level === currentLevel)
        .sort((a, b) => a.y - b.y);

      const currentIndex = sameLevelSkills.findIndex(s => s.id === req.params.id);
      if (currentIndex === -1) {
        res.status(404).json({ message: "Skill not found in this level" });
        return;
      }

      const neighborIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      
      if (neighborIndex < 0 || neighborIndex >= sameLevelSkills.length) {
        res.status(400).json({ message: `Cannot move ${direction} - already at edge of level` });
        return;
      }

      const neighbor = sameLevelSkills[neighborIndex];
      
      // Swap Y coordinates and levelPosition
      const tempY = existingSkill.y;
      const neighborY = neighbor.y;
      const tempLevelPosition = existingSkill.levelPosition;
      const neighborLevelPosition = neighbor.levelPosition;

      // Update both skills with swapped coordinates and positions
      const updatedSkill = await storage.updateSkill(req.params.id, { 
        y: neighborY,
        levelPosition: neighborLevelPosition
      });
      const updatedNeighbor = await storage.updateSkill(neighbor.id, { 
        y: tempY,
        levelPosition: tempLevelPosition
      });

      // Recalculate final node for this level only
      // Note: Node statuses stay with the node and are not affected by reordering
      const parentInfo = {
        areaId: parentType === "area" ? parentId : undefined,
        projectId: parentType === "project" ? parentId : undefined
      };
      
      await storage.recalculateFinalNodes(currentLevel, parentInfo);

      // Fetch all updated skills of the level to return to client
      const updatedAllSkills = parentType === "area" 
        ? await storage.getSkills(parentId)
        : await storage.getProjectSkills(parentId);
      
      const levelSkillsUpdated = updatedAllSkills
        .filter(s => s.level === currentLevel)
        .sort((a, b) => a.levelPosition - b.levelPosition);

      res.json({ levelSkills: levelSkillsUpdated, updatedSkill, updatedNeighbor });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Generate 5 placeholder nodes for a new level (transactional, idempotent)
  app.post("/api/areas/:id/generate-level", requireAuth, async (req, res) => {
    try {
      const { level } = req.body;
      const areaId = req.params.id;
      
      console.log(`[generate-level] Starting for areaId="${areaId}", level=${level}, userId="${req.userId}"`);
      
      if (!level || typeof level !== "number") {
        console.error(`[generate-level] Invalid level: ${level}`);
        res.status(400).json({ message: "Level is required and must be a number" });
        return;
      }
      
      const existingArea = await storage.getArea(areaId);
      console.log(`[generate-level] Existing area:`, existingArea);
      
      if (!existingArea) {
        console.error(`[generate-level] Area not found: ${areaId}`);
        res.status(404).json({ message: "Area not found" });
        return;
      }
      if (existingArea.userId !== req.userId) {
        console.error(`[generate-level] User mismatch: area.userId="${existingArea.userId}" vs req.userId="${req.userId}"`);
        res.status(403).json({ message: "No tienes permiso para modificar esta área" });
        return;
      }
      
      // Validate: level must not exceed nextLevelToAssign + 2 (only +3 levels ahead)
      const maxAllowedLevel = existingArea.nextLevelToAssign + 2;
      if (level > maxAllowedLevel) {
        console.error(`[generate-level] Level exceeds max allowed: ${level} > ${maxAllowedLevel}`);
        res.status(400).json({ message: `No puedes crear un nivel más allá de ${maxAllowedLevel}. Máximo +3 niveles adelante del completado.` });
        return;
      }
      
      // Check if level already has nodes - if so, just update area and return existing nodes
      const allSkills = await storage.getSkills(areaId);
      console.log(`[generate-level] All skills for area:`, allSkills.length);
      const existingLevelSkills = allSkills.filter(s => s.level === level);
      console.log(`[generate-level] Existing skills for level ${level}:`, existingLevelSkills.length);
      
      if (existingLevelSkills.length > 0) {
        console.log(`[generate-level] Level already has nodes, returning existing`);
        // Level already has nodes - update area's unlockedLevel
        // Keep nextLevelToAssign at least 3 levels ahead to allow future level generation
        const updatedArea = await storage.updateArea(areaId, { 
          unlockedLevel: level, 
          nextLevelToAssign: level + 3
        });
        
        // Ensure proper node states when opening an existing level
        const sortedSkills = [...existingLevelSkills].sort((a, b) => a.y - b.y);
        
        // Node 1 must be mastered with empty title
        const firstNode = sortedSkills[0];
        if (firstNode && (firstNode.status !== "mastered" || firstNode.title !== "")) {
          console.log(`[generate-level] Updating node 1 to mastered`);
          await storage.updateSkill(firstNode.id, { status: "mastered", title: "" });
        }
        
        // Since node 1 is mastered, node 2 should be available to unlock
        const secondNode = sortedSkills[1];
        if (secondNode && secondNode.status === "locked") {
          console.log(`[generate-level] Unlocking node 2 to available`);
          await storage.updateSkill(secondNode.id, { status: "available" });
        }
        
        // Fetch all skills again to get the updated states
        const allUpdatedSkills = await storage.getSkills(areaId);
        const finalSkills = allUpdatedSkills.filter(s => s.level === level).sort((a, b) => a.y - b.y);
        
        console.log(`[generate-level] ✓ Returning level skills with updated states:`, finalSkills.length);
        res.status(200).json({ updatedArea, createdSkills: finalSkills });
        return;
      }
      
      // Get last skill to calculate starting Y position
      let startY = 100;
      if (allSkills.length > 0) {
        const lastSkill = allSkills.reduce((max, s) => s.y > max.y ? s : max, allSkills[0]);
        startY = lastSkill.y + 150;
      }
      
      console.log(`[generate-level] Creating new level with startY=${startY}`);
      // Use transactional method that updates area and creates all skills atomically
      const { updatedArea, createdSkills } = await storage.generateLevelWithSkills(areaId, level, startY);
      
      console.log(`[generate-level] ✓ Created level with ${createdSkills.length} skills`);
      res.status(201).json({ updatedArea, createdSkills });
    } catch (error: any) {
      console.error(`[generate-level] ERROR:`, error);
      res.status(500).json({ message: error.message });
    }
  });

  // Projects (protected)
  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      // Prevent HTTP caching to ensure fresh data
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const projectsList = await storage.getProjects(req.userId!);
      const projectsWithSkills = await Promise.all(
        projectsList.map(async (project) => {
          const skills = await storage.getProjectSkills(project.id);
          return { ...project, skills };
        })
      );
      res.json(projectsWithSkills);
    } catch (error: any) {
      console.error('[GET /api/projects] Full error:', error);
      console.error('[GET /api/projects] Error stack:', error.stack);
      console.error('[GET /api/projects] Error name:', error.name);
      console.error('[GET /api/projects] Error code:', error.code);
      res.status(500).json({ message: error.message, code: error.code });
    }
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
    try {
      const projectData = { ...req.body, userId: req.userId };
      const validatedProject = insertProjectSchema.parse(projectData);
      const project = await storage.createProject(validatedProject);
      
      // Automatically create levels 1-4 for new projects
      console.log(`[POST /api/projects] Creating levels 1-4 for new project: ${project.id}`);
      let startY = 100;
      let lastCreatedProject = project;
      
      for (let level = 1; level <= 4; level++) {
        try {
          const { updatedProject, createdSkills } = await storage.generateProjectLevelWithSkills(project.id, level, startY);
          lastCreatedProject = updatedProject;
          console.log(`[POST /api/projects] ✓ Created level ${level} with ${createdSkills.length} skills`);
          
          // Calculate next startY position
          if (createdSkills.length > 0) {
            const lastSkill = createdSkills.reduce((max, s) => s.y > max.y ? s : max, createdSkills[0]);
            startY = lastSkill.y + 150;
          }
        } catch (levelError) {
          console.error(`[POST /api/projects] Error creating level ${level}:`, levelError);
          // Continue to next level even if one fails
        }
      }
      
      // Update project: unlockedLevel=1 (visible), nextLevelToAssign=5 (next to create)
      const finalProject = await storage.updateProject(project.id, {
        unlockedLevel: 1,
        nextLevelToAssign: 5
      });
      
      // Get all skills for the response
      const allSkills = await storage.getProjectSkills(project.id);
      console.log(`[POST /api/projects] ✓ Project created with ${allSkills.length} total skills (4 levels × 5 nodes)`);
      res.status(201).json({ ...finalProject, skills: allSkills });
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const existingProject = await storage.getProject(req.params.id);
      if (!existingProject) {
        res.status(404).json({ message: "Project not found" });
        return;
      }
      if (existingProject.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para modificar este proyecto" });
        return;
      }

      const projectId = req.params.id;
      const { endOfAreaLevel } = req.body;
      const isChangingEndOfAreaLevel = endOfAreaLevel !== undefined && endOfAreaLevel !== existingProject.endOfAreaLevel;

      // Handle level generation when endOfAreaLevel changes
      if (isChangingEndOfAreaLevel) {
        if (endOfAreaLevel === null) {
          // Deactivate: Generate 3 new levels
          console.log('[PATCH /api/projects] Deactivating end-of-area, generating 3 new levels');
          const currentUnlockedLevel = existingProject.unlockedLevel;
          
          let startY = 100;
          const allSkills = await storage.getProjectSkills(projectId);
          if (allSkills.length > 0) {
            const lastSkill = allSkills.reduce((max, s) => s.y > max.y ? s : max, allSkills[0]);
            startY = lastSkill.y + 150;
          }
          
          for (let i = 1; i <= 3; i++) {
            const newLevel = currentUnlockedLevel + i;
            try {
              await storage.generateProjectLevelWithSkills(projectId, newLevel, startY);
              const updatedSkills = await storage.getProjectSkills(projectId);
              const newLevelSkills = updatedSkills.filter(s => s.level === newLevel);
              if (newLevelSkills.length > 0) {
                const lastSkill = newLevelSkills.reduce((max, s) => s.y > max.y ? s : max, newLevelSkills[0]);
                startY = lastSkill.y + 150;
              }
            } catch (levelError) {
              console.error(`Error generating project level ${newLevel}:`, levelError);
            }
          }
        } else {
          // Activate: Delete staged levels (skills with level > unlockedLevel)
          console.log('[PATCH /api/projects] Activating end-of-area, deleting staged levels');
          const unlockedLevel = existingProject.unlockedLevel;
          const scheduledForDeletion = await storage.getProjectSkills(projectId);
          const skillsToDelete = scheduledForDeletion.filter(s => s.level > unlockedLevel);
          
          for (const skill of skillsToDelete) {
            await storage.deleteSkill(skill.id);
          }
        }
      }

      const project = await storage.updateProject(projectId, req.body);
      const projectWithSkills = await storage.getProjectSkills(projectId);
      res.json({ ...project, skills: projectWithSkills });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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
      
      console.log(`[generate-level-project] Starting for projectId="${projectId}", level=${level}, userId="${req.userId}"`);
      
      if (!level || typeof level !== "number") {
        console.error(`[generate-level-project] Invalid level: ${level}`);
        res.status(400).json({ message: "Level is required and must be a number" });
        return;
      }
      
      const existingProject = await storage.getProject(projectId);
      console.log(`[generate-level-project] Existing project:`, existingProject ? { id: existingProject.id, name: existingProject.name } : "NOT FOUND");
      
      if (!existingProject) {
        console.error(`[generate-level-project] Project not found: ${projectId}`);
        res.status(404).json({ message: "Project not found" });
        return;
      }
      if (existingProject.userId !== req.userId) {
        console.error(`[generate-level-project] User mismatch: project.userId="${existingProject.userId}" vs req.userId="${req.userId}"`);
        res.status(403).json({ message: "No tienes permiso para modificar este proyecto" });
        return;
      }
      
      // Validate: level must not exceed nextLevelToAssign + 2 (only +3 levels ahead)
      const maxAllowedLevel = existingProject.nextLevelToAssign + 2;
      if (level > maxAllowedLevel) {
        console.error(`[generate-level-project] Level exceeds max allowed: ${level} > ${maxAllowedLevel}`);
        res.status(400).json({ message: `No puedes crear un nivel más allá de ${maxAllowedLevel}. Máximo +3 niveles adelante del completado.` });
        return;
      }
      
      const allSkills = await storage.getProjectSkills(projectId);
      console.log(`[generate-level-project] All skills for project:`, allSkills.length);
      const existingLevelSkills = allSkills.filter(s => s.level === level);
      console.log(`[generate-level-project] Existing skills for level ${level}:`, existingLevelSkills.length);
      
      if (existingLevelSkills.length > 0) {
        console.log(`[generate-level-project] Level already has nodes, returning existing`);
        const updatedProject = await storage.updateProject(projectId, { 
          unlockedLevel: level, 
          nextLevelToAssign: level 
        });
        
        // Ensure proper node states when opening an existing level
        const sortedSkills = [...existingLevelSkills].sort((a, b) => a.y - b.y);
        
        // Node 1 must be mastered with empty title
        const firstNode = sortedSkills[0];
        if (firstNode && (firstNode.status !== "mastered" || firstNode.title !== "")) {
          console.log(`[generate-level-project] Updating node 1 to mastered`);
          await storage.updateSkill(firstNode.id, { status: "mastered", title: "" });
        }
        
        // Since node 1 is mastered, node 2 should be available to unlock
        const secondNode = sortedSkills[1];
        if (secondNode && secondNode.status === "locked") {
          console.log(`[generate-level-project] Unlocking node 2 to available`);
          await storage.updateSkill(secondNode.id, { status: "available" });
        }
        
        // Fetch all skills again to get the updated states
        const allUpdatedSkills = await storage.getProjectSkills(projectId);
        const finalSkills = allUpdatedSkills.filter(s => s.level === level).sort((a, b) => a.y - b.y);
        
        console.log(`[generate-level-project] ✓ Returning level skills with updated states:`, finalSkills.length);
        res.status(200).json({ updatedProject, createdSkills: finalSkills });
        return;
      }
      
      let startY = 100;
      if (allSkills.length > 0) {
        const lastSkill = allSkills.reduce((max, s) => s.y > max.y ? s : max, allSkills[0]);
        startY = lastSkill.y + 150;
      }
      
      console.log(`[generate-level-project] Creating new level with startY=${startY}`);
      const { updatedProject, createdSkills } = await storage.generateProjectLevelWithSkills(projectId, level, startY);
      
      console.log(`[generate-level-project] ✓ Created level with ${createdSkills.length} skills`);
      res.status(201).json({ updatedProject, createdSkills });
    } catch (error: any) {
      console.error(`[generate-level-project] ERROR:`, error);
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
      
      // First node of level is always mastered with empty title
      let enforcedStatus: string;
      let enforcedTitle: string;
      
      if (levelPosition === 1) {
        enforcedStatus = "mastered";
        enforcedTitle = "";
      } else {
        enforcedStatus = "locked";
        enforcedTitle = validatedSkill.title;
      }
      
      const enforcedManualLock = levelPosition > 1 ? 0 : (validatedSkill.manualLock || 0);
      
      const skillWithPosition = {
        ...validatedSkill,
        projectId,
        level: skillLevel,
        levelPosition,
        isFinalNode: 0 as 0 | 1,
        status: enforcedStatus,
        title: enforcedTitle,
        manualLock: enforcedManualLock as 0 | 1,
      };
      
      const skill = await storage.createSkill(skillWithPosition);
      
      // Recalculate Y coordinates for all nodes in the project
      await storage.recalculateYCoordinates({
        projectId: validatedSkill.projectId || undefined,
      });
      
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
        // For all levels, ensure first node is mastered with empty title
        let finalSkills = existingLevelSkills;
        const sortedSkills = [...existingLevelSkills].sort((a, b) => a.y - b.y);
        const firstNode = sortedSkills[0];
        if (firstNode && (firstNode.status !== "mastered" || firstNode.title !== "")) {
          await storage.updateSkill(firstNode.id, { status: "mastered", title: "" });
          // Fetch the updated skill to ensure we have the latest version
          const updatedFirstNode = await storage.getSkill(firstNode.id);
          if (updatedFirstNode) {
            finalSkills = existingLevelSkills.map(s => 
              s.id === firstNode.id ? updatedFirstNode : s
            );
          }
        }
        
        const parentSkill = await storage.getSkill(parentSkillId);
        res.status(200).json({ parentSkill, createdSkills: finalSkills });
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
      
      // First node of level is always mastered with empty title
      let enforcedStatus: string;
      let enforcedTitle: string;
      
      if (levelPosition === 1) {
        enforcedStatus = "mastered";
        enforcedTitle = "";
      } else {
        enforcedStatus = "locked";
        enforcedTitle = validatedSkill.title;
      }
      
      const enforcedManualLock = levelPosition > 1 ? 0 : (validatedSkill.manualLock || 0);
      
      const skillWithPosition = {
        ...validatedSkill,
        parentSkillId,
        level: skillLevel,
        levelPosition,
        isFinalNode: 0 as 0 | 1,
        status: enforcedStatus,
        title: enforcedTitle,
        manualLock: enforcedManualLock as 0 | 1,
      };
      
      const skill = await storage.createSkill(skillWithPosition);
      
      // Recalculate Y coordinates for all sub-skills under the parent
      await storage.recalculateYCoordinates({
        parentSkillId: validatedSkill.parentSkillId || undefined,
      });
      
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

  // Upload image for bestiary (must be before generic POST shadows route)
  app.post("/api/journal/shadows/upload", requireAuth, async (req, res) => {
    try {
      const bb = Busboy({ headers: req.headers });
      let uploadedFile: { filename: string; mimetype: string; size: number } | null = null;
      let fileBuffer: Buffer | null = null;

      bb.on("file", async (fieldname: string, file: any, info: any) => {
        const { filename, encoding, mimeType } = info;
        
        // Validate image type
        const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowedMimes.includes(mimeType)) {
          res.status(400).json({ message: "Solo se permiten imágenes (JPEG, PNG, GIF, WebP)" });
          return;
        }

        // Read file into buffer
        const chunks: Buffer[] = [];
        file.on("data", (chunk: any) => chunks.push(chunk));
        file.on("end", async () => {
          fileBuffer = Buffer.concat(chunks);
          
          // Limit file size to 2MB (will be ~2.6MB as Base64)
          if (fileBuffer.length > 2 * 1024 * 1024) {
            res.status(400).json({ message: "La imagen no puede ser mayor a 2MB" });
            return;
          }
          
          uploadedFile = { filename, mimetype: mimeType, size: fileBuffer.length };
        });
      });

      bb.on("close", async () => {
        if (!fileBuffer || !uploadedFile) {
          res.status(400).json({ message: "No se recibió ningún archivo" });
          return;
        }

        try {
          // Convert buffer to Base64 data URL (stored in Neon, never lost)
          const base64 = fileBuffer.toString("base64");
          const imageUrl = `data:${uploadedFile.mimetype};base64,${base64}`;
          
          // Log size for debugging
          console.log(`[upload] Image size: ${fileBuffer.length}B, Base64 size: ${imageUrl.length}B`);
          
          res.json({ imageUrl });
        } catch (error: any) {
          res.status(500).json({ message: "Error al procesar la imagen: " + error.message });
        }
      });

      bb.on("error", (error: any) => {
        res.status(400).json({ message: "Error al procesar el archivo: " + error.message });
      });

      req.pipe(bb);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/journal/shadows", requireAuth, async (req, res) => {
    try {
      console.log("[POST /api/journal/shadows] Creating shadow for user:", req.userId);
      console.log("[POST /api/journal/shadows] Data:", {
        name: req.body.name,
        description: req.body.description?.substring(0, 50) + "...",
        hasImage: !!req.body.imageUrl,
        imageSize: req.body.imageUrl?.length || 0,
      });
      
      const data = { ...req.body, userId: req.userId };
      const validated = insertJournalShadowSchema.parse(data);
      const shadow = await storage.createJournalShadow(validated);
      
      console.log("[POST /api/journal/shadows] Created shadow:", shadow.id);
      res.status(201).json(shadow);
    } catch (error: any) {
      console.error("[POST /api/journal/shadows] Error:", error);
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

  // Get skills progress filtered by area
  app.get("/api/skills-progress/by-area/:areaId", requireAuth, async (req, res) => {
    try {
      const { areaId } = req.params;
      const progress = await storage.getUserSkillsProgress(req.userId!);
      const filtered = progress.filter((skill) => skill.areaId === areaId);
      res.json(filtered);
    } catch (error: any) {
      if (error.message?.includes('relation "user_skills_progress" does not exist') || 
          error.message?.includes('does not exist')) {
        console.warn('user_skills_progress table does not exist yet, returning empty array');
        res.json([]);
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  // Global Skills (for XP tracking with areas/projects/subskills)
  // Specific routes MUST come before generic routes
  app.get("/api/global-skills/area/:areaId", requireAuth, async (req, res) => {
    try {
      const skills = await storage.getGlobalSkillsByArea(req.userId!, req.params.areaId);
      res.json(skills);
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        res.json([]);
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.get("/api/global-skills/project/:projectId", requireAuth, async (req, res) => {
    try {
      const skills = await storage.getGlobalSkillsByProject(req.userId!, req.params.projectId);
      res.json(skills);
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        res.json([]);
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  // Generic routes come after specific routes
  app.get("/api/global-skills", requireAuth, async (req, res) => {
    try {
      // Prevent HTTP caching to ensure fresh data
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const skills = await storage.getGlobalSkills(req.userId!);
      res.json(skills);
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        res.json([]);
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.get("/api/global-skills/:id", requireAuth, async (req, res) => {
    try {
      const skill = await storage.getGlobalSkill(req.params.id);
      if (!skill) {
        return res.status(404).json({ message: "Global skill not found" });
      }
      res.json(skill);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/global-skills", requireAuth, async (req, res) => {
    try {
      console.log('[global-skills POST] req.body:', req.body, 'userId:', req.userId);
      const data = { ...req.body, userId: req.userId };
      console.log('[global-skills POST] data before validation:', data);
      const validated = insertGlobalSkillSchema.parse(data);
      console.log('[global-skills POST] validated:', validated);
      const skill = await storage.createGlobalSkill(validated);
      console.log('[global-skills POST] created skill:', skill);
      res.status(201).json(skill);
    } catch (error: any) {
      console.error('[global-skills POST] ERROR:', error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: fromError(error).toString() });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/global-skills/:id", requireAuth, async (req, res) => {
    try {
      const skill = await storage.updateGlobalSkill(req.params.id, req.body);
      if (!skill) {
        return res.status(404).json({ message: "Global skill not found" });
      }
      res.json(skill);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/global-skills/:id/add-xp", requireAuth, async (req, res) => {
    try {
      const { xpAmount } = req.body;
      if (typeof xpAmount !== 'number' || xpAmount <= 0) {
        return res.status(400).json({ message: "xpAmount must be a positive number" });
      }
      const skill = await storage.addXpToGlobalSkill(req.params.id, xpAmount);
      if (!skill) {
        return res.status(404).json({ message: "Global skill not found" });
      }
      res.json(skill);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/global-skills/:id", requireAuth, async (req, res) => {
    try {
      const existingSkill = await storage.getGlobalSkill(req.params.id);
      if (!existingSkill) {
        res.status(404).json({ message: "Global skill not found" });
        return;
      }

      // Verify ownership - only the user who created the skill can delete it
      if (existingSkill.userId !== req.userId) {
        res.status(403).json({ message: "No tienes permiso para eliminar este global skill" });
        return;
      }

      await storage.deleteGlobalSkill(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/global-skills/:id/goal-xp", requireAuth, async (req, res) => {
    try {
      const { goalXp } = req.body;
      if (typeof goalXp !== 'number' || goalXp < 0) {
        return res.status(400).json({ message: "goalXp must be a non-negative number" });
      }
      
      const skill = await storage.setGoalXpGlobalSkill(req.params.id, goalXp);
      if (!skill) {
        return res.status(404).json({ message: "Global skill not found" });
      }
      
      res.json(skill);
    } catch (error: any) {
      console.error('[goal-xp PATCH] ERROR:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/global-skills/:id/complete", requireAuth, async (req, res) => {
    try {
      const skill = await storage.completeGlobalSkill(req.params.id);
      if (!skill) {
        return res.status(404).json({ message: "Global skill not found" });
      }
      res.json(skill);
    } catch (error: any) {
      console.error('[complete PATCH] ERROR:', error);
      if (error.code === "PENDING_SUBSKILLS") {
        return res.status(400).json({ 
          error: error.message,
          pendingSubskills: error.pendingSubskills 
        });
      }
      if (error.message.includes("subskills")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/global-skills/:id/uncomplete", requireAuth, async (req, res) => {
    try {
      const skill = await storage.uncompleteGlobalSkill(req.params.id);
      if (!skill) {
        return res.status(404).json({ message: "Global skill not found" });
      }
      res.json(skill);
    } catch (error: any) {
      console.error('[uncomplete PATCH] ERROR:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Cleanup endpoint: remove duplicate skills without areaId or projectId
  app.post("/api/cleanup-duplicates", requireAuth, async (req, res) => {
    try {
      const allSkills = await storage.getGlobalSkills(req.userId!);
      
      // Find all skills without areaId and projectId
      const duplicates = allSkills.filter(skill => !skill.areaId && !skill.projectId);
      
      let deleted = 0;
      for (const skill of duplicates) {
        await storage.deleteGlobalSkill(skill.id);
        deleted++;
      }
      
      res.json({ 
        success: true, 
        message: `Eliminados ${deleted} skill(s) sin área/quest`,
        deletedCount: deleted 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Habits routes
  app.get("/api/habits", requireAuth, async (req, res) => {
    try {
      console.log("[GET /api/habits] Starting request for userId:", req.userId);
      const habits = await storage.getHabits(req.userId!);
      console.log("[GET /api/habits] Retrieved", habits.length, "habits from storage");
      console.log("[GET /api/habits] Habits data:", JSON.stringify(habits.slice(0, 2), null, 2));
      res.json(habits);
    } catch (error: any) {
      console.error("[GET /api/habits] ERROR:", error);
      console.error("[GET /api/habits] Error message:", error.message);
      console.error("[GET /api/habits] Error stack:", error.stack);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  app.post("/api/habits", requireAuth, async (req, res) => {
    try {
      console.log("📝 Creating habit. Body:", req.body, "UserId:", req.userId);
      const data = { ...req.body, userId: req.userId };
      console.log("📝 Data to validate:", data);
      const validated = insertHabitSchema.parse(data);
      console.log("✅ Validated data:", validated);
      const habit = await storage.createHabit(validated);
      console.log("✅ Habit created:", habit);
      res.status(201).json(habit);
    } catch (error: any) {
      console.error("❌ Habit creation error:", error);
      if (error.name === "ZodError") {
        console.error("❌ Validation error:", error.errors);
        return res.status(400).json({ message: fromError(error).toString() });
      }
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  app.patch("/api/habits/:id", requireAuth, async (req, res) => {
    try {
      // Verify ownership
      const habit = await storage.getHabit(req.params.id);
      if (!habit || habit.userId !== req.userId) {
        return res.status(403).json({ message: "No tienes permiso para editar este hábito" });
      }

      const updated = await storage.updateHabit(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Hábito no encontrado" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/habits/:id", requireAuth, async (req, res) => {
    try {
      // Verify ownership
      const habit = await storage.getHabit(req.params.id);
      if (!habit || habit.userId !== req.userId) {
        return res.status(403).json({ message: "No tienes permiso para eliminar este hábito" });
      }

      await storage.deleteHabit(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Award XP to linked skill when habit is completed
  app.post("/api/habits/:habitId/award-xp", requireAuth, async (req, res) => {
    try {
      // Verify habit ownership
      const habit = await storage.getHabit(req.params.habitId);
      if (!habit || habit.userId !== req.userId) {
        return res.status(403).json({ message: "No tienes permiso para este hábito" });
      }

      // If no linked skill, just return success
      if (!habit.skillId) {
        return res.json({ xpAwarded: 0, message: "Hábito sin skill linkeado" });
      }

      const xpToAward = 5;

      // Award XP to global skill if linked
      const skill = await storage.getGlobalSkill(habit.skillId);
      
      if (!skill) {
        return res.status(404).json({ message: "Skill linkeado al hábito no encontrado" });
      }

      const currentXp = skill.currentXp || 0;
      const newXp = currentXp + xpToAward;

      // Update global skill with new XP and calculate new level
      let newLevel = skill.level || 1;
      const xpPerLevel = 100;
      if (newXp >= (newLevel * xpPerLevel)) {
        newLevel = Math.floor(newXp / xpPerLevel) + 1;
      }

      await storage.updateGlobalSkill(habit.skillId, { currentXp: newXp, level: newLevel });

      return res.json({
        xpAwarded: xpToAward,
        skillId: habit.skillId,
        skillName: skill.name,
        newXp: newXp,
        newLevel: newLevel
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Habit Records routes
  app.get("/api/habit-records/:habitId", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate y endDate son requeridos" });
      }

      const records = await storage.getHabitRecords(
        req.params.habitId,
        startDate as string,
        endDate as string
      );
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/habit-records/:habitId", requireAuth, async (req, res) => {
    try {
      const { date, completed } = req.body;
      if (!date) {
        return res.status(400).json({ message: "date es requerido (formato YYYY-MM-DD)" });
      }
      if (typeof completed !== "number" || (completed !== 0 && completed !== 1)) {
        return res.status(400).json({ message: "completed debe ser 0 o 1" });
      }

      // Verify habit ownership
      const habit = await storage.getHabit(req.params.habitId);
      if (!habit || habit.userId !== req.userId) {
        return res.status(403).json({ message: "No tienes permiso para registrar en este hábito" });
      }

      const record = await storage.upsertHabitRecord(
        req.params.habitId,
        req.userId!,
        date,
        completed as 0 | 1
      );
      res.status(201).json(record);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Space-Repetition Practices
  app.get("/api/space-repetition", requireAuth, async (req, res) => {
    try {
      const practices = await storage.getSpaceRepetitionPractices(req.userId!);
      res.json(practices);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/space-repetition", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, userId: req.userId };
      const validated = insertSpaceRepetitionPracticeSchema.parse(data);
      const practice = await storage.createSpaceRepetitionPractice(validated as InsertSpaceRepetitionPractice & { userId: string });
      res.status(201).json(practice);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: fromError(error).toString() });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/space-repetition/:id", requireAuth, async (req, res) => {
    try {
      // Verify ownership
      const practice = await storage.getSpaceRepetitionPractice(req.params.id);
      if (!practice || practice.userId !== req.userId) {
        return res.status(403).json({ message: "No tienes permiso para editar esta práctica" });
      }

      const updated = await storage.updateSpaceRepetitionPractice(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Práctica no encontrada" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/space-repetition/:id", requireAuth, async (req, res) => {
    try {
      // Verify ownership
      const practice = await storage.getSpaceRepetitionPractice(req.params.id);
      if (!practice || practice.userId !== req.userId) {
        return res.status(403).json({ message: "No tienes permiso para eliminar esta práctica" });
      }

      await storage.deleteSpaceRepetitionPractice(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Fix all node statuses consistent with unlockedLevel
  app.post("/api/admin/fix-statuses", async (req, res) => {
    try {
      const { areas: areasTable, projects: projectsTable } = (await import("@shared/schema")).default;
      
      // Get all areas and recalculate
      const allAreas = await db.select().from(areas);
      let fixedCount = 0;
      const fixes: string[] = [];

      for (const area of allAreas) {
        const unlockedLevel = area.unlockedLevel || 1;
        const allSkills = await db.select().from(skills).where(eq(skills.areaId, area.id));
        
        if (allSkills.length === 0) continue;

        // Group by level
        const skillsByLevel = new Map<number, typeof allSkills>();
        for (const skill of allSkills) {
          const lv = skill.level || 1;
          if (!skillsByLevel.has(lv)) skillsByLevel.set(lv, []);
          skillsByLevel.get(lv)!.push(skill);
        }

        // Process each level
        for (const [lvl, lvlSkills] of skillsByLevel) {
          const sortedByPosition = [...lvlSkills].sort((a, b) => (a.levelPosition || 0) - (b.levelPosition || 0));
          let foundFirstAvailable = false;

          for (const skill of sortedByPosition) {
            let newStatus: "mastered" | "available" | "locked";

            if (lvl < unlockedLevel) {
              newStatus = "mastered";
            } else if (lvl === unlockedLevel) {
              if (skill.levelPosition === 1) {
                newStatus = "mastered";
              } else if (!foundFirstAvailable && skill.status !== "mastered") {
                newStatus = "available";
                foundFirstAvailable = true;
              } else {
                newStatus = "locked";
              }
            } else {
              newStatus = "locked";
            }

            if (skill.status !== newStatus) {
              await db.update(skills).set({ status: newStatus }).where(eq(skills.id, skill.id));
              fixedCount++;
              fixes.push(`${area.name} L${lvl}: ${skill.title || "(empty)"} ${skill.status}→${newStatus}`);
            }
          }
        }
      }

      // Get all projects and recalculate
      const allProjects = await db.select().from(projects);
      for (const project of allProjects) {
        const unlockedLevel = project.unlockedLevel || 1;
        const allSkills = await db.select().from(skills).where(eq(skills.projectId, project.id));
        
        if (allSkills.length === 0) continue;

        // Group by level
        const skillsByLevel = new Map<number, typeof allSkills>();
        for (const skill of allSkills) {
          const lv = skill.level || 1;
          if (!skillsByLevel.has(lv)) skillsByLevel.set(lv, []);
          skillsByLevel.get(lv)!.push(skill);
        }

        // Process each level
        for (const [lvl, lvlSkills] of skillsByLevel) {
          const sortedByPosition = [...lvlSkills].sort((a, b) => (a.levelPosition || 0) - (b.levelPosition || 0));
          let foundFirstAvailable = false;

          for (const skill of sortedByPosition) {
            let newStatus: "mastered" | "available" | "locked";

            if (lvl < unlockedLevel) {
              newStatus = "mastered";
            } else if (lvl === unlockedLevel) {
              if (skill.levelPosition === 1) {
                newStatus = "mastered";
              } else if (!foundFirstAvailable && skill.status !== "mastered") {
                newStatus = "available";
                foundFirstAvailable = true;
              } else {
                newStatus = "locked";
              }
            } else {
              newStatus = "locked";
            }

            if (skill.status !== newStatus) {
              await db.update(skills).set({ status: newStatus }).where(eq(skills.id, skill.id));
              fixedCount++;
              fixes.push(`${project.name} L${lvl}: ${skill.title || "(empty)"} ${skill.status}→${newStatus}`);
            }
          }
        }
      }

      res.json({ 
        message: `✅ Recalculación completada. ${fixedCount} nodos corregidos.`,
        fixedCount,
        fixes: fixes.slice(0, 50) // Return first 50 fixes
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
