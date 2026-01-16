import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertTeamMemberSchema, insertScreenshotSchema, insertActivityLogSchema, insertTimeEntrySchema } from "@shared/schema";
import { z } from "zod";
import { randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

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

  const agentRegisterSchema = z.object({
    teamMemberId: z.string().min(1),
    deviceName: z.string().min(1),
    platform: z.enum(["windows", "macos", "linux"]),
  });

  app.post("/api/agent/register", async (req, res) => {
    try {
      const data = agentRegisterSchema.parse(req.body);
      
      const member = await storage.getTeamMember(data.teamMemberId);
      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }

      const token = generateToken();
      const agentToken = await storage.createAgentToken({
        teamMemberId: data.teamMemberId,
        token,
        deviceName: data.deviceName,
        platform: data.platform,
        isActive: true,
      });

      res.status(201).json({
        token,
        agentId: agentToken.id,
        teamMember: {
          id: member.id,
          name: member.name,
          email: member.email,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to register agent" });
    }
  });

  app.get("/api/agent/verify", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing authorization token" });
      }

      const token = authHeader.slice(7);
      const agentToken = await storage.getAgentTokenByToken(token);

      if (!agentToken) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      await storage.updateAgentTokenLastSeen(agentToken.id);

      res.json({
        valid: true,
        teamMember: {
          id: agentToken.teamMember.id,
          name: agentToken.teamMember.name,
          email: agentToken.teamMember.email,
        },
        device: {
          id: agentToken.id,
          name: agentToken.deviceName,
          platform: agentToken.platform,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to verify token" });
    }
  });

  const agentScreenshotSchema = z.object({
    imageData: z.string().min(1),
    mouseClicks: z.number().int().min(0).default(0),
    keystrokes: z.number().int().min(0).default(0),
    activityScore: z.number().min(0).max(100).default(0),
  });

  app.post("/api/agent/screenshot", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing authorization token" });
      }

      const token = authHeader.slice(7);
      const agentToken = await storage.getAgentTokenByToken(token);

      if (!agentToken) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      const data = agentScreenshotSchema.parse(req.body);

      const uploadsDir = path.join(process.cwd(), "uploads", "screenshots");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const fileName = `${Date.now()}-${agentToken.teamMember.id}.png`;
      const filePath = path.join(uploadsDir, fileName);
      
      const base64Data = data.imageData.replace(/^data:image\/\w+;base64,/, "");
      fs.writeFileSync(filePath, base64Data, "base64");

      const imageUrl = `/uploads/screenshots/${fileName}`;

      const screenshot = await storage.createScreenshot({
        teamMemberId: agentToken.teamMember.id,
        imageUrl,
        mouseClicks: data.mouseClicks,
        keystrokes: data.keystrokes,
        activityScore: data.activityScore,
      });

      await storage.updateTeamMember(agentToken.teamMember.id, {
        status: "online",
      });

      await storage.updateAgentTokenLastSeen(agentToken.id);

      broadcast({ type: "SCREENSHOT_ADDED", screenshot });

      res.status(201).json({ success: true, screenshotId: screenshot.id });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to upload screenshot" });
    }
  });

  const agentHeartbeatSchema = z.object({
    status: z.enum(["online", "idle", "offline"]).optional(),
    mouseClicks: z.number().int().min(0).optional(),
    keystrokes: z.number().int().min(0).optional(),
  });

  app.post("/api/agent/heartbeat", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing authorization token" });
      }

      const token = authHeader.slice(7);
      const agentToken = await storage.getAgentTokenByToken(token);

      if (!agentToken) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      const data = agentHeartbeatSchema.parse(req.body);

      const member = await storage.updateTeamMember(agentToken.teamMember.id, {
        status: data.status || "online",
      });

      await storage.updateAgentTokenLastSeen(agentToken.id);

      if (member) {
        broadcast({ type: "STATUS_CHANGED", member });
      }

      const settings = await storage.getSettings();

      res.json({
        success: true,
        settings: {
          screenshotInterval: settings.screenshotInterval,
          enableActivityTracking: settings.enableActivityTracking,
          enableMouseTracking: settings.enableMouseTracking,
          enableKeyboardTracking: settings.enableKeyboardTracking,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to process heartbeat" });
    }
  });

  app.get("/api/agent/settings", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing authorization token" });
      }

      const token = authHeader.slice(7);
      const agentToken = await storage.getAgentTokenByToken(token);

      if (!agentToken) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      const settings = await storage.getSettings();
      const member = agentToken.teamMember;

      res.json({
        screenshotInterval: member.screenshotInterval || settings.screenshotInterval,
        enableActivityTracking: settings.enableActivityTracking,
        enableMouseTracking: settings.enableMouseTracking,
        enableKeyboardTracking: settings.enableKeyboardTracking,
        isMonitoring: member.isMonitoring,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get agent settings" });
    }
  });

  app.get("/api/team-members/:id/devices", async (req, res) => {
    try {
      const devices = await storage.getAgentTokensByMember(req.params.id);
      res.json(devices);
    } catch (error) {
      res.status(500).json({ error: "Failed to get devices" });
    }
  });

  app.delete("/api/agent/devices/:id", async (req, res) => {
    try {
      await storage.deactivateAgentToken(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to deactivate device" });
    }
  });

  app.get("/uploads/screenshots/:filename", async (req, res) => {
    try {
      const filePath = path.join(process.cwd(), "uploads", "screenshots", req.params.filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Screenshot not found" });
      }

      res.sendFile(filePath);
    } catch (error) {
      res.status(500).json({ error: "Failed to serve screenshot" });
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

  app.get("/api/time-entries", async (req, res) => {
    try {
      const memberId = req.query.memberId as string | undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      if (memberId) {
        const entries = await storage.getTimeEntriesByMember(memberId, startDate, endDate);
        return res.json(entries);
      }

      const entries = await storage.getAllTimeEntries(startDate, endDate);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to get time entries" });
    }
  });

  app.get("/api/time-entries/active/:memberId", async (req, res) => {
    try {
      const entry = await storage.getActiveTimeEntry(req.params.memberId);
      res.json(entry || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to get active time entry" });
    }
  });

  app.get("/api/team-members/:id/time-stats", async (req, res) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const stats = await storage.getMemberTimeStats(req.params.id, startDate, endDate);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get time stats" });
    }
  });

  const startTimerSchema = z.object({
    teamMemberId: z.string().min(1),
    project: z.string().optional(),
    notes: z.string().optional(),
  });

  app.post("/api/time-entries/start", async (req, res) => {
    try {
      const data = startTimerSchema.parse(req.body);

      const existingActive = await storage.getActiveTimeEntry(data.teamMemberId);
      if (existingActive) {
        return res.status(400).json({ error: "Timer already running", activeEntry: existingActive });
      }

      const entry = await storage.createTimeEntry({
        teamMemberId: data.teamMemberId,
        startTime: new Date(),
        project: data.project || null,
        notes: data.notes || null,
        isActive: true,
        idleSeconds: 0,
      });

      await storage.updateTeamMember(data.teamMemberId, { status: "online" });

      broadcast({ type: "TIMER_STARTED", entry });
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to start timer" });
    }
  });

  app.post("/api/time-entries/:id/stop", async (req, res) => {
    try {
      const entry = await storage.stopTimeEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: "Time entry not found" });
      }

      broadcast({ type: "TIMER_STOPPED", entry });
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to stop timer" });
    }
  });

  const updateTimeEntrySchema = z.object({
    project: z.string().optional(),
    notes: z.string().optional(),
    idleSeconds: z.number().int().min(0).optional(),
  });

  app.patch("/api/time-entries/:id", async (req, res) => {
    try {
      const data = updateTimeEntrySchema.parse(req.body);
      const entry = await storage.updateTimeEntry(req.params.id, data);
      if (!entry) {
        return res.status(404).json({ error: "Time entry not found" });
      }
      broadcast({ type: "TIME_ENTRY_UPDATED", entry });
      res.json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update time entry" });
    }
  });

  const manualTimeEntrySchema = z.object({
    teamMemberId: z.string().min(1),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    project: z.string().optional(),
    notes: z.string().optional(),
  });

  app.post("/api/time-entries/manual", async (req, res) => {
    try {
      const data = manualTimeEntrySchema.parse(req.body);
      const startTime = new Date(data.startTime);
      const endTime = new Date(data.endTime);
      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      if (duration <= 0) {
        return res.status(400).json({ error: "End time must be after start time" });
      }

      const entry = await storage.createTimeEntry({
        teamMemberId: data.teamMemberId,
        startTime,
        endTime,
        duration,
        project: data.project || null,
        notes: data.notes || null,
        isActive: false,
        idleSeconds: 0,
      });

      broadcast({ type: "TIME_ENTRY_ADDED", entry });
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create time entry" });
    }
  });

  app.delete("/api/time-entries/:id", async (req, res) => {
    try {
      await storage.deleteTimeEntry(req.params.id);
      broadcast({ type: "TIME_ENTRY_DELETED", id: req.params.id });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete time entry" });
    }
  });

  const agentTimerStartSchema = z.object({
    project: z.string().optional(),
    notes: z.string().optional(),
  });

  app.post("/api/agent/timer/start", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing authorization token" });
      }

      const token = authHeader.slice(7);
      const agentToken = await storage.getAgentTokenByToken(token);

      if (!agentToken) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      const data = agentTimerStartSchema.parse(req.body);

      const existingActive = await storage.getActiveTimeEntry(agentToken.teamMember.id);
      if (existingActive) {
        return res.status(400).json({ error: "Timer already running", activeEntry: existingActive });
      }

      const entry = await storage.createTimeEntry({
        teamMemberId: agentToken.teamMember.id,
        startTime: new Date(),
        project: data.project || null,
        notes: data.notes || null,
        isActive: true,
        idleSeconds: 0,
      });

      await storage.updateTeamMember(agentToken.teamMember.id, { status: "online" });
      await storage.updateAgentTokenLastSeen(agentToken.id);

      broadcast({ type: "TIMER_STARTED", entry });
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to start timer" });
    }
  });

  app.post("/api/agent/timer/stop", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing authorization token" });
      }

      const token = authHeader.slice(7);
      const agentToken = await storage.getAgentTokenByToken(token);

      if (!agentToken) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      const activeEntry = await storage.getActiveTimeEntry(agentToken.teamMember.id);
      if (!activeEntry) {
        return res.status(404).json({ error: "No active timer found" });
      }

      const entry = await storage.stopTimeEntry(activeEntry.id);
      await storage.updateAgentTokenLastSeen(agentToken.id);

      broadcast({ type: "TIMER_STOPPED", entry });
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to stop timer" });
    }
  });

  app.get("/api/agent/timer/status", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing authorization token" });
      }

      const token = authHeader.slice(7);
      const agentToken = await storage.getAgentTokenByToken(token);

      if (!agentToken) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      const activeEntry = await storage.getActiveTimeEntry(agentToken.teamMember.id);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStats = await storage.getMemberTimeStats(agentToken.teamMember.id, today);

      res.json({
        isRunning: !!activeEntry,
        activeEntry,
        todayStats,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get timer status" });
    }
  });

  const agentIdleUpdateSchema = z.object({
    idleSeconds: z.number().int().min(0),
  });

  app.post("/api/agent/timer/idle", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing authorization token" });
      }

      const token = authHeader.slice(7);
      const agentToken = await storage.getAgentTokenByToken(token);

      if (!agentToken) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      const data = agentIdleUpdateSchema.parse(req.body);

      const activeEntry = await storage.getActiveTimeEntry(agentToken.teamMember.id);
      if (!activeEntry) {
        return res.status(404).json({ error: "No active timer found" });
      }

      const entry = await storage.updateTimeEntry(activeEntry.id, {
        idleSeconds: (activeEntry.idleSeconds || 0) + data.idleSeconds,
      });

      res.json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update idle time" });
    }
  });

  return httpServer;
}
