import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { supabase } from "./supabaseClient";

// Catch unexpected promise rejections to avoid crashing dev server
process.on("unhandledRejection", (reason) => {
  console.error("[server] unhandledRejection", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[server] uncaughtException", err);
});

const app = express();
const trustProxy = (process.env.TRUST_PROXY || "").toLowerCase();
if (trustProxy === "true" || trustProxy === "1") {
  app.set("trust proxy", 1);
}
app.disable("x-powered-by");

const allowedOrigins = new Set<string>();
const configuredSiteUrl = (process.env.PUBLIC_SITE_URL || "").trim();
if (configuredSiteUrl) {
  try {
    allowedOrigins.add(new URL(configuredSiteUrl).origin);
  } catch {
    // ignore malformed PUBLIC_SITE_URL
  }
}
if (app.get("env") === "development") {
  allowedOrigins.add("http://localhost:3000");
  allowedOrigins.add("http://localhost:4173");
  allowedOrigins.add("http://localhost:5000");
  allowedOrigins.add("http://127.0.0.1:3000");
  allowedOrigins.add("http://127.0.0.1:4173");
  allowedOrigins.add("http://127.0.0.1:5000");
}

app.use((req, res, next) => {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
  const originAllowed = origin ? allowedOrigins.has(origin) : false;

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  const forwardedProto = typeof req.headers["x-forwarded-proto"] === "string" ? req.headers["x-forwarded-proto"] : "";
  if (req.secure || forwardedProto === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  if (originAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  }

  if (req.method === "OPTIONS") {
    if (!origin || originAllowed) {
      return res.status(204).end();
    }
    return res.status(403).json({ message: "Origin not allowed" });
  }

  next();
});

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Surface the error but avoid crashing the dev server with an unhandled rejection
    console.error("[server] error handler caught", err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Respect platform-provided PORT (e.g., Render); default to 5000 locally
  const port = Number(process.env.PORT) || 5000;
  server.listen(port, () => {
    log(`serving on port ${port}`);
  });
})();
