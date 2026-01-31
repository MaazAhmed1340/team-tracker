// server/src/index.ts
import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import cors from "cors";
import path from "path";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import jwt from "jsonwebtoken";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripe/stripeClient";
import { WebhookHandlers } from "./stripe/webhookHandlers";

const app = express();
const httpServer = createServer(app);

// ---------------- Stripe Initialization ----------------
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("DATABASE_URL not set, skipping Stripe initialization");
    return;
  }

  try {
    console.log("Initializing Stripe schema...");
    await runMigrations({ databaseUrl, schema: "stripe" });
    console.log("Stripe schema ready");

    const stripeSync = await getStripeSync();

    // Setup webhook if we have a domain
    const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0];
    if (replitDomain) {
      console.log("Setting up managed webhook...");
      try {
        const webhookBaseUrl = `https://${replitDomain}`;
        const result = await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
        if (result?.webhook?.url) {
          console.log(`Webhook configured: ${result.webhook.url}`);
        } else {
          console.log("Webhook setup returned no URL, will be configured on first use");
        }
      } catch (webhookError) {
        console.warn("Webhook setup skipped:", webhookError);
      }
    }

    console.log("Syncing Stripe data...");
    stripeSync
      .syncBackfill()
      .then(() => console.log("Stripe data synced"))
      .catch((err: Error) => console.error("Error syncing Stripe data:", err));
  } catch (error) {
    console.error("Failed to initialize Stripe:", error);
  }
}

// Initialize Stripe on startup
initStripe();

// ---------------- CORS ----------------
const corsOptions = {
  origin: (origin: any, callback: any) => {
    if (process.env.NODE_ENV !== "production") {
      callback(null, true);
      return;
    }

    if (!origin) {
      callback(null, true);
      return;
    }

    const isAllowed =
      origin.endsWith(".replit.dev") ||
      origin.endsWith(".replit.app") ||
      origin === process.env.REPLIT_DEPLOYMENT_URL ||
      origin === `https://${process.env.REPLIT_DEV_DOMAIN}`;

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400, // 24 hours
};
app.use(
  cors({
    origin: true, // adjust whitelist if needed
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

app.get("/api/debug/token", (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];
  console.log("[agent] tokenPreview=", token ? `${token.slice(0,8)}...${token.slice(-8)}` : "none");

  if (!token) return res.status(401).json({ error: "no token provided" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "");
    return res.json({ ok: true, decoded });
  } catch (err: any) {
    return res.status(401).json({ error: err.message });
  }
});

// ---------------- Stripe Webhook (BEFORE express.json) ----------------
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).json({ error: "Missing stripe-signature" });
  }

  try {
    const sig = Array.isArray(signature) ? signature[0] : signature;
    await WebhookHandlers.processWebhook(req.body as Buffer, sig);
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("Webhook error:", error.message);
    res.status(400).json({ error: "Webhook processing error" });
  }
});

// ---------------- Middlewares ----------------
app.use(
  express.json({
    limit: "10mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false, limit: "10mb"  }));
app.use(cookieParser());

// JWT Middleware
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];

  if (!authHeader) return next();

  console.log("[auth] Authorization header present. tokenLen=", token?.length ?? 0);

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || ""); // ensure JWT_SECRET present
      (req as any).user = decoded;
    } catch (err: any) {
      console.error("[auth] Token verification failed:", err.message);
      (req as any).tokenVerifyError = err.message; // keep for debugging
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
    },
  );
})();
