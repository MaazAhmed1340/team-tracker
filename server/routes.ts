import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertTeamMemberSchema, insertScreenshotSchema, insertActivityLogSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  function broadcast(data: object) {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  app.get("/api/dashboard/stats", async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get dashboard stats" });
    }
  });

  app.get("/api/dashboard/timeline", async (_req, res) => {
    try {
      const timeline = await storage.getTimeline();
      res.json(timeline);
    } catch (error) {
      res.status(500).json({ error: "Failed to get timeline" });
    }
  });

  app.get("/api/team-members", async (_req, res) => {
    try {
      const members = await storage.getAllTeamMembers();
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: "Failed to get team members" });
    }
  });

  app.get("/api/team-members/with-stats", async (_req, res) => {
    try {
      const members = await storage.getTeamMembersWithStats();
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: "Failed to get team members with stats" });
    }
  });

  app.get("/api/team-members/:id", async (req, res) => {
    try {
      const member = await storage.getTeamMember(req.params.id);
      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }
      res.json(member);
    } catch (error) {
      res.status(500).json({ error: "Failed to get team member" });
    }
  });

  app.get("/api/team-members/:id/stats", async (req, res) => {
    try {
      const stats = await storage.getMemberStats(req.params.id);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get member stats" });
    }
  });

  app.get("/api/team-members/:id/timeline", async (req, res) => {
    try {
      const timeline = await storage.getTimeline(req.params.id);
      res.json(timeline);
    } catch (error) {
      res.status(500).json({ error: "Failed to get member timeline" });
    }
  });

  app.post("/api/team-members", async (req, res) => {
    try {
      const data = insertTeamMemberSchema.parse(req.body);
      const existing = await storage.getTeamMemberByEmail(data.email);
      if (existing) {
        return res.status(400).json({ error: "Email already exists" });
      }
      const member = await storage.createTeamMember(data);
      broadcast({ type: "MEMBER_ADDED", member });
      res.status(201).json(member);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create team member" });
    }
  });

  const updateTeamMemberSchema = insertTeamMemberSchema.partial();

  app.patch("/api/team-members/:id", async (req, res) => {
    try {
      const data = updateTeamMemberSchema.parse(req.body);
      const member = await storage.updateTeamMember(req.params.id, data);
      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }
      broadcast({ type: "MEMBER_UPDATED", member });
      res.json(member);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update team member" });
    }
  });

  app.delete("/api/team-members/:id", async (req, res) => {
    try {
      const success = await storage.deleteTeamMember(req.params.id);
      broadcast({ type: "MEMBER_DELETED", id: req.params.id });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete team member" });
    }
  });

  app.get("/api/screenshots", async (req, res) => {
    try {
      const memberId = req.query.memberId as string | undefined;
      const screenshots = memberId
        ? await storage.getScreenshotsByMember(memberId)
        : await storage.getAllScreenshots();
      res.json(screenshots);
    } catch (error) {
      res.status(500).json({ error: "Failed to get screenshots" });
    }
  });

  app.get("/api/screenshots/recent", async (_req, res) => {
    try {
      const screenshots = await storage.getRecentScreenshots(8);
      res.json(screenshots);
    } catch (error) {
      res.status(500).json({ error: "Failed to get recent screenshots" });
    }
  });

  app.get("/api/screenshots/:id", async (req, res) => {
    try {
      const screenshot = await storage.getScreenshot(req.params.id);
      if (!screenshot) {
        return res.status(404).json({ error: "Screenshot not found" });
      }
      res.json(screenshot);
    } catch (error) {
      res.status(500).json({ error: "Failed to get screenshot" });
    }
  });

  app.post("/api/screenshots", async (req, res) => {
    try {
      const data = insertScreenshotSchema.parse(req.body);
      const screenshot = await storage.createScreenshot(data);
      
      await storage.updateTeamMember(data.teamMemberId, {
        status: "online",
      });
      
      broadcast({ type: "SCREENSHOT_ADDED", screenshot });
      res.status(201).json(screenshot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create screenshot" });
    }
  });

  app.delete("/api/screenshots/:id", async (req, res) => {
    try {
      await storage.deleteScreenshot(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete screenshot" });
    }
  });

  app.get("/api/activity-logs/:memberId", async (req, res) => {
    try {
      const logs = await storage.getActivityLogs(req.params.memberId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get activity logs" });
    }
  });

  app.post("/api/activity-logs", async (req, res) => {
    try {
      const data = insertActivityLogSchema.parse(req.body);
      const log = await storage.createActivityLog(data);
      
      await storage.updateTeamMember(data.teamMemberId, {
        status: "online",
      });
      
      broadcast({ type: "ACTIVITY_LOGGED", log });
      res.status(201).json(log);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create activity log" });
    }
  });

  const heartbeatSchema = z.object({
    teamMemberId: z.string().min(1),
    status: z.enum(["online", "idle", "offline"]).optional(),
  });

  app.post("/api/heartbeat", async (req, res) => {
    try {
      const data = heartbeatSchema.parse(req.body);
      
      const member = await storage.updateTeamMember(data.teamMemberId, {
        status: data.status || "online",
      });
      
      if (member) {
        broadcast({ type: "STATUS_CHANGED", member });
      }
      
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update heartbeat" });
    }
  });

  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get settings" });
    }
  });

  const settingsSchema = z.object({
    screenshotInterval: z.number().min(1).max(60).optional(),
    enableActivityTracking: z.boolean().optional(),
    enableMouseTracking: z.boolean().optional(),
    enableKeyboardTracking: z.boolean().optional(),
    enableNotifications: z.boolean().optional(),
    idleThreshold: z.number().min(1).max(30).optional(),
    blurSensitiveContent: z.boolean().optional(),
    autoStartMonitoring: z.boolean().optional(),
  });

  app.put("/api/settings", async (req, res) => {
    try {
      const data = settingsSchema.parse(req.body);
      const settings = await storage.updateSettings(data);
      broadcast({ type: "SETTINGS_UPDATED", settings });
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  return httpServer;
}
