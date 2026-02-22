import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist (but not for API routes)
  app.use("*", (req, res, next) => {
    // Don't handle API routes - let Express find them
    if (req.originalUrl.startsWith("/api") || req.path.startsWith("/api")) {
      console.log('[static] Skipping API route:', req.path, req.originalUrl);
      return next();
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
