import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { db } from "./db";
import { sql } from "drizzle-orm";
import path from "path";
import * as fs from "fs/promises";
import { runOldDataMigration } from "./migrate-old-data";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "5mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ limit: "5mb", extended: false }));

// Serve static files EARLY, before any other middleware
const publicPath = path.join(process.cwd(), "dist/public");
console.log("[server] Serving static files from:", publicPath);
app.use(express.static(publicPath));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize database table if it doesn't exist
  try {
    console.log("Initializing database tables...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "user_skills_progress" (
        "id" varchar PRIMARY KEY NOT NULL,
        "user_id" varchar NOT NULL,
        "skill_name" text NOT NULL,
        "current_xp" integer DEFAULT 0 NOT NULL,
        "level" integer DEFAULT 1 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
      );
    `);
    console.log("✓ Database tables initialized");
  } catch (error: any) {
    if (error.message?.includes("already exists")) {
      console.log("✓ Database tables already exist");
    } else {
      console.error("⚠ Database initialization warning:", error.message);
      // Don't fail startup if table already exists
    }
  }

  // Run data migration for old areas and skills
  // TEMPORARILY DISABLED: This migration was causing startup to hang
  // TODO: Revisit this migration and optimize it
  try {
    // await runOldDataMigration();
  } catch (error: any) {
    console.error("⚠ Data migration error:", error.message);
    // Continue startup even if migration fails
  }

  // Ensure bestiary images directory exists
  try {
    const imagesDir = path.join(process.cwd(), "uploads/bestiary-images");
    await fs.mkdir(imagesDir, { recursive: true });
    console.log("✓ Bestiary images directory ready:", imagesDir);
  } catch (error: any) {
    console.error("⚠ Error creating images directory:", error.message);
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 3001 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "3001", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
