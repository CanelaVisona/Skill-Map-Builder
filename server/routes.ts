import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAreaSchema, insertSkillSchema } from "@shared/schema";
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
      const skill = await storage.createSkill(validatedSkill);
      res.status(201).json(skill);
    } catch (error: any) {
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/skills/:id", async (req, res) => {
    try {
      const skill = await storage.updateSkill(req.params.id, req.body);
      if (!skill) {
        res.status(404).json({ message: "Skill not found" });
        return;
      }
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

  return httpServer;
}
