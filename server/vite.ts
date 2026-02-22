import { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // Protect API routes from Vite completely
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      console.log('[api-protect] API route, skipping Vite:', req.method, req.path);
      return next();
    }
    // For non-API routes, continue to Vite
    vite.middlewares(req, res, next);
  });

  app.use("*", async (req, res, next) => {
    // Don't handle API routes - let Express find them
    if (req.originalUrl.startsWith("/api") || req.path.startsWith("/api")) {
      console.log('[vite] Skipping API route:', req.path, req.originalUrl);
      return next();
    }

    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  // Handle 404 for API routes that weren't found
  app.use("/api", (req, res) => {
    console.log('[vite-404] API route not found:', req.method, req.path);
    res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
  });
}
