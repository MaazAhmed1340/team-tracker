// server/src/index.ts
import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import cors from "cors";
import path from "path";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import jwt from "jsonwebtoken";

const app = express();
const httpServer = createServer(app);

// ---------------- CORS ----------------
const corsOptions = {
  origin: (origin: any, callback: any) => {
    const allowedOrigins =
      process.env.NODE_ENV === "production"
        ? [process.env.REPLIT_DEPLOYMENT_URL, process.env.REPLIT_DEV_DOMAIN].filter(Boolean).map(url => url?.startsWith('http') ? url : `https://${url}`)
        : true;

    if (!origin || allowedOrigins === true || (Array.isArray(allowedOrigins) && allowedOrigins.some(allowed => origin === allowed || origin?.endsWith('.replit.dev') || origin?.endsWith('.replit.app')))) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400, // 24 hours
};
app.use(cors(corsOptions));

// ---------------- Middlewares ----------------
app.use(
  express.json({
    limit: "10mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// JWT Middleware
app.use((req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
      (req as any).user = decoded;
    } catch (error) {
      console.error("Token verification error:", error);
    }
  }

  next();
});

// Trust proxy for proper IP detection
app.set("trust proxy", 1);

// ---------------- Logger ----------------
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

// ---------------- API Routes ----------------
(async () => {
  await registerRoutes(httpServer, app);

  // ---------------- Error Handler ----------------
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  // ---------------- Static / Vite ----------------
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ---------------- SPA Fallback ----------------
  app.get("*", (_req, res) => {
    if (process.env.NODE_ENV === "production") {
      res.sendFile(path.resolve(process.cwd(), "dist/public", "index.html"));
    } else {
      res.sendFile(path.resolve(process.cwd(), "client", "index.html"));
    }
  });

  // ---------------- Start Server ----------------
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`Server running on port ${port}`);
    }
  );
})();
