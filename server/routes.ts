import type { Express, NextFunction, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import {
  insertTeamMemberSchema,
  insertScreenshotSchema,
  insertActivityLogSchema,
  insertTimeEntrySchema,
  insertUserSchema,
  insertCompanySchema,
  companies,
  teamMembers,
  users,
} from "@shared/schema";
import { db } from "./db";
import { z } from "zod";
import { randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcrypt";
import { eq, sql } from "drizzle-orm";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  authenticateToken,
} from "./middleware/auth";
import {
  requireAdmin,
  requireAdminOrManager,
  canViewReports,
} from "./middleware/permissions";
import {
  loginRateLimiter,
  apiRateLimiter,
  screenshotRateLimiter,
  heartbeatRateLimiter,
} from "./middleware/rate-limit";
import { sanitizeInput } from "./middleware/validation";
import {
  validateEmail,
  validateStringLength,
  validateDateRange,
  validateBase64Image,
  validateTimeFormat,
  validateTimezone,
  validateUUID,
  validateNumericRange,
} from "./utils/validation";
import {
  requireTeamMemberAccess,
  canAccessTeamMember,
  getTeamMemberIdForUser,
} from "./middleware/data-access";

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

  // Authentication routes
  const loginSchema = z.object({
    email: z.string()
      .min(1, "Email is required")
      .max(255, "Email must be 255 characters or less")
      .email("Email must be a valid email address (e.g., user@example.com)")
      .transform((val) => val.trim().toLowerCase()),
    password: z.string()
      .min(1, "Password is required")
      .max(128, "Password must be 128 characters or less"),
  });

  // Combined company + first admin registration
  const companyRegisterSchema = z.object({
    companyName: z.string().min(1, "Company name is required"),
    companyEmail: z.string()
      .min(1, "Company email is required")
      .email("Company email must be valid"),
    companyWebsite: z.string().url().optional(),
    adminEmail: z.string()
      .min(1, "Admin email is required")
      .email("Admin email must be valid"),
    adminPassword: z.string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be 128 characters or less"),
  });

  // Company (multi-tenant) routes
  app.post("/api/companies", sanitizeInput, async (req: Request, res: Response) => {
    try {
      const data = insertCompanySchema.parse(req.body);

      // Basic uniqueness check on company email
      const existing = await storage.getCompanyByEmail(data.email);
      if (existing) {
        return res.status(400).json({ error: "Company with this email already exists" });
      }

      const company = await storage.createCompany(data);

      res.status(201).json(company);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create company" });
    }
  });

  // Public endpoint: create a company + first admin user in one step
  app.post("/api/auth/company-register", sanitizeInput, async (req: Request, res: Response) => {
    try {
      const data = companyRegisterSchema.parse(req.body);

      // Ensure company email is unique
      const existingCompany = await storage.getCompanyByEmail(data.companyEmail);
      if (existingCompany) {
        return res.status(400).json({ error: "A company with this email already exists" });
      }

      // Ensure admin email is unique
      const existingUser = await storage.getUserByEmail(data.adminEmail);
      if (existingUser) {
        return res.status(400).json({ error: "A user with this email already exists" });
      }

      // Create company
      const company = await storage.createCompany({
        name: data.companyName,
        email: data.companyEmail,
        website: data.companyWebsite ?? null,
        logoUrl: null,
        stripeCustomerId: null,
      });

      // Create admin user for that company
      const passwordHash = await bcrypt.hash(data.adminPassword, 10);
      const user = await storage.createUser({
        email: data.adminEmail,
        password: passwordHash,
        role: "admin",
        companyId: company.id,
      });

      // Create team member row linked to the admin user
      const [createdTeamMember] = await db.insert(teamMembers).values({
        userId: user.id,
        name: data.adminEmail.split("@")[0],
        email: data.adminEmail,
        role: "admin",
      }).returning();

      const tokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role!,
        companyId: user.companyId,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      await storage.updateUserRefreshToken(user.id, refreshToken);

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(201).json({
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
        },
        teamMember: {
          id: createdTeamMember.id,
          name: createdTeamMember.name,
          email: createdTeamMember.email,
          role: createdTeamMember.role,
        },
        company,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to register company" });
    }
  });

  app.post("/api/auth/login", loginRateLimiter, sanitizeInput, async (req: Request, res: Response) => {
    try {
      // Enhanced validation
      const emailValidation = validateEmail(req.body?.email);
      if (!emailValidation.valid) {
        return res.status(400).json({ error: emailValidation.error });
      }

      const data = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (user.isActive === false) {
        return res.status(403).json({ error: "Your account is inactive" });
      }

      // Ensure the user has been added as an employee (team member)
      const [member] = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.userId, user.id))
        .limit(1);

      if (!member) {
        return res.status(403).json({
          error: "Your company admin has not added you as an employee yet",
        });
      }

      const isValidPassword = await bcrypt.compare(data.password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const tokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role!,
        companyId: user.companyId,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      await storage.updateUserRefreshToken(user.id, refreshToken);

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error});
    }
  });

  app.post("/api/auth/register", sanitizeInput, async (req: Request, res: Response) => {
    try {
      // Enhanced validation
      const emailValidation = validateEmail(req.body?.email);
      if (!emailValidation.valid) {
        return res.status(400).json({ error: emailValidation.error });
      }

      const passwordValidation = validateStringLength(req.body?.password || "", 8, 128, "Password");
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.error });
      }

      const data = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const passwordHash = await bcrypt.hash(data.password, 10);

      const user = await storage.createUser({
        email: data.email,
        password: passwordHash,
        role: data.role || "viewer",
        companyId: data.companyId,
      });

      // Create a team member for the user
      const [createdTeamMember] = await db.insert(teamMembers).values({
        userId: user.id,
        name: data.email.split("@")[0], // Use email prefix as default name
        email: data.email,
        role: "member",
      }).returning();

      const tokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role!,
        companyId: user.companyId,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      await storage.updateUserRefreshToken(user.id, refreshToken);

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(201).json({
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        teamMember: {
          id: createdTeamMember.id,
          name: createdTeamMember.name,
          email: createdTeamMember.email,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to register" });
    }
  });

  app.post("/api/auth/logout", authenticateToken, async (req, res) => {
    try {
      if (req.user) {
        await storage.updateUserRefreshToken(req.user.id, null);
      }
      res.clearCookie("refreshToken");
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to logout" });
    }
  });

  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
      
      if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token required" });
      }

      const payload = verifyRefreshToken(refreshToken);
      
      const user = await storage.getUser(payload.id);
      if (!user || user.refreshToken !== refreshToken) {
        return res.status(403).json({ error: "Invalid refresh token" });
      }

      const tokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role!,
        companyId: user.companyId,
      };

      const newAccessToken = generateAccessToken(tokenPayload);
      const newRefreshToken = generateRefreshToken(tokenPayload);

      await storage.updateUserRefreshToken(user.id, newRefreshToken);

      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        accessToken: newAccessToken,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "JsonWebTokenError") {
        return res.status(403).json({ error: "Invalid refresh token" });
      }
      res.status(500).json({ error: "Failed to refresh token" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get user info" });
    }
  });

  app.get("/api/dashboard/stats", authenticateToken, apiRateLimiter, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const stats = await storage.getDashboardStatsByCompany(companyId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get dashboard stats" });
    }
  });

  app.get("/api/dashboard/timeline", authenticateToken, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const timeline = await storage.getTimelineByCompany(companyId);
      res.json(timeline);
    } catch (error) {
      res.status(500).json({ error: "Failed to get timeline" });
    }
  });

  app.get("/api/team-members", authenticateToken, apiRateLimiter, sanitizeInput, async (req: Request, res: Response) => {
    try {
      const userRole = req.user!.role;

      if (userRole === "admin" || userRole === "manager") {
        const members = await storage.getTeamMembersWithStats(req.user!.id);
        return res.json(members);
      }

      const myMemberId = await getTeamMemberIdForUser(req.user!.id);
      if (!myMemberId) {
        return res.json([]);
      }
      const myMember = await storage.getTeamMember(myMemberId);
      res.json(myMember ? [myMember] : []);
    } catch (error) {
      res.status(500).json({ error: "Failed to get team members" });
    }
  });

app.get("/api/team-members/with-stats", authenticateToken, apiRateLimiter, async (req, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (userRole !== "admin" && userRole !== "manager") {
      return res.status(403).json({ error: "Access denied" });
    }

    const members = await storage.getTeamMembersWithStats(userId);
    res.json(members);
  } catch (error) {
    console.error("Failed to get team members with stats:", error);
    res.status(500).json({ error: "Failed to get team members with stats" });
  }
});


  app.get("/api/team-members/:id", authenticateToken, apiRateLimiter, sanitizeInput, async (req: Request, res: Response) => {
    try {
      const access = await canAccessTeamMember(req.user!.id, req.params.id);
      if (!access.allowed) {
        return res.status(403).json({ error: access.reason || "Access denied" });
      }
      const member = await storage.getTeamMember(req.params.id);
      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }
      res.json(member);
    } catch (error) {
      res.status(500).json({ error: "Failed to get team member" });
    }
  });

  app.get("/api/team-members/:id/stats", authenticateToken, apiRateLimiter, async (req, res) => {
    try {
      const access = await canAccessTeamMember(req.user!.id, req.params.id);
      if (!access.allowed) {
        return res.status(403).json({ error: access.reason || "Access denied" });
      }
      const stats = await storage.getMemberStats(req.params.id);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get member stats" });
    }
  });

  app.get("/api/team-members/:id/timeline", authenticateToken, apiRateLimiter, async (req, res) => {
    try {
      const access = await canAccessTeamMember(req.user!.id, req.params.id);
      if (!access.allowed) {
        return res.status(403).json({ error: access.reason || "Access denied" });
      }
      const timeline = await storage.getTimeline(req.params.id);
      res.json(timeline);
    } catch (error) {
      res.status(500).json({ error: "Failed to get member timeline" });
    }
  });

  // Schema for creating an employee (user + team member)
  const createEmployeeSchema = insertTeamMemberSchema
    .extend({
      password: z.string()
        .min(8, "Password must be at least 8 characters")
        .max(128, "Password must be 128 characters or less"),
    })
    .omit({ userId: true });

  app.post("/api/team-members", authenticateToken, requireAdminOrManager, sanitizeInput, async (req: Request, res: Response) => {
    try {
      // Enhanced validation
      if (req.body?.email) {
        const emailValidation = validateEmail(req.body.email);
        if (!emailValidation.valid) {
          return res.status(400).json({ error: emailValidation.error });
        }
      }

      if (req.body?.name) {
        const nameValidation = validateStringLength(req.body.name, 1, 255, "Name");
        if (!nameValidation.valid) {
          return res.status(400).json({ error: nameValidation.error });
        }
      }

      const data = createEmployeeSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Find the admin/manager's user to inherit companyId
      const adminUser = await storage.getUser(req.user.id);
      if (!adminUser) {
        return res.status(401).json({ error: "Admin user not found" });
      }

      // Ensure no existing user with that email
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ error: "A user with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(data.password, 10);

      // Create user account for the employee
      const employeeUser = await storage.createUser({
        email: data.email,
        password: passwordHash,
        role: "viewer", // auth-level role; permissions middleware enforces access
        companyId: adminUser.companyId,
      });

      const { password, ...memberData } = data;

      // Create team member linked to the user
      const member = await storage.createTeamMember({
        ...memberData,
        userId: employeeUser.id,
      });

      broadcast({ type: "MEMBER_ADDED", member });
      res.status(201).json({
        member,
        user: {
          id: employeeUser.id,
          email: employeeUser.email,
          role: employeeUser.role,
          companyId: employeeUser.companyId,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create team member" });
    }
  });

  const updateTeamMemberSchema = insertTeamMemberSchema.partial();

  app.patch("/api/team-members/:id", authenticateToken, requireAdminOrManager, async (req, res) => {
    try {
      const access = await canAccessTeamMember(req.user!.id, req.params.id);
      if (!access.allowed) {
        return res.status(403).json({ error: access.reason || "Access denied" });
      }
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

  app.delete("/api/team-members/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteTeamMember(req.params.id);
      broadcast({ type: "MEMBER_DELETED", id: req.params.id });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete team member" });
    }
  });

  app.get("/api/screenshots", authenticateToken, apiRateLimiter, async (req, res) => {
    try {
      const memberId = req.query.memberId as string | undefined;
      const userRole = req.user!.role;
      const companyId = req.user!.companyId;

      if (memberId) {
        const access = await canAccessTeamMember(req.user!.id, memberId);
        if (!access.allowed) {
          return res.status(403).json({ error: access.reason || "Access denied" });
        }
        const screenshots = await storage.getScreenshotsByMember(memberId);
        return res.json(screenshots);
      }

      if (userRole === "admin" || userRole === "manager") {
        const screenshots = await storage.getScreenshotsByCompany(companyId);
        return res.json(screenshots);
      }

      const myMemberId = await getTeamMemberIdForUser(req.user!.id);
      if (!myMemberId) {
        return res.json([]);
      }
      const screenshots = await storage.getScreenshotsByMember(myMemberId);
      res.json(screenshots);
    } catch (error) {
      res.status(500).json({ error: "Failed to get screenshots" });
    }
  });

  app.get("/api/screenshots/recent", authenticateToken, apiRateLimiter, async (req, res) => {
    try {
      const userRole = req.user!.role;
      const companyId = req.user!.companyId;

      if (userRole === "admin" || userRole === "manager") {
        const screenshots = await storage.getRecentScreenshotsByCompany(companyId, 8);
        return res.json(screenshots);
      }

      const myMemberId = await getTeamMemberIdForUser(req.user!.id);
      if (!myMemberId) {
        return res.json([]);
      }
      const screenshots = await storage.getScreenshotsByMember(myMemberId);
      res.json(screenshots.slice(0, 8));
    } catch (error) {
      res.status(500).json({ error: "Failed to get recent screenshots" });
    }
  });

  app.get("/api/screenshots/:id", authenticateToken, apiRateLimiter, async (req, res) => {
    try {
      const screenshot = await storage.getScreenshot(req.params.id);
      if (!screenshot) {
        return res.status(404).json({ error: "Screenshot not found" });
      }
      const access = await canAccessTeamMember(req.user!.id, screenshot.teamMemberId);
      if (!access.allowed) {
        return res.status(403).json({ error: access.reason || "Access denied" });
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

  app.delete("/api/screenshots/:id", authenticateToken, requireAdminOrManager, async (req, res) => {
    try {
      const screenshot = await storage.getScreenshot(req.params.id);
      if (!screenshot) {
        return res.status(404).json({ error: "Screenshot not found" });
      }
      const access = await canAccessTeamMember(req.user!.id, screenshot.teamMemberId);
      if (!access.allowed) {
        return res.status(403).json({ error: access.reason || "Access denied" });
      }
      await storage.deleteScreenshot(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete screenshot" });
    }
  });

  const blurScreenshotSchema = z.object({
    isBlurred: z.boolean(),
  });

  app.patch("/api/screenshots/:id/blur", authenticateToken, requireAdminOrManager, async (req, res) => {
    try {
      const existingScreenshot = await storage.getScreenshot(req.params.id);
      if (!existingScreenshot) {
        return res.status(404).json({ error: "Screenshot not found" });
      }
      const access = await canAccessTeamMember(req.user!.id, existingScreenshot.teamMemberId);
      if (!access.allowed) {
        return res.status(403).json({ error: access.reason || "Access denied" });
      }
      const data = blurScreenshotSchema.parse(req.body);
      const screenshot = await storage.updateScreenshotBlur(req.params.id, data.isBlurred);
      if (!screenshot) {
        return res.status(404).json({ error: "Screenshot not found" });
      }
      broadcast({ type: "SCREENSHOT_UPDATED", screenshot });
      res.json(screenshot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update screenshot" });
    }
  });

  const privacySettingsSchema = z.object({
    blurScreenshots: z.boolean().optional(),
    trackApps: z.boolean().optional(),
    trackUrls: z.boolean().optional(),
    workHoursStart: z.string()
      .nullable()
      .optional()
      .refine((val) => !val || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(val), {
        message: "workHoursStart must be in HH:mm format (e.g., 09:00, 17:30)"
      }),
    workHoursEnd: z.string()
      .nullable()
      .optional()
      .refine((val) => !val || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(val), {
        message: "workHoursEnd must be in HH:mm format (e.g., 09:00, 17:30)"
      }),
    workHoursTimezone: z.string()
      .optional()
      .refine((val) => !val || /^[A-Z][a-z]+(\/[A-Z][a-z]+)*$/.test(val) || val === "UTC", {
        message: "workHoursTimezone must be a valid IANA timezone (e.g., America/New_York, UTC)"
      }),
    privacyMode: z.boolean().optional(),
  });

  app.get("/api/team-members/:id/privacy", authenticateToken, async (req, res) => {
    try {
      const access = await canAccessTeamMember(req.user!.id, req.params.id);
      if (!access.allowed) {
        return res.status(403).json({ error: access.reason || "Access denied" });
      }
      const member = await storage.getTeamMember(req.params.id);
      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }
      res.json({
        blurScreenshots: member.blurScreenshots,
        trackApps: member.trackApps,
        trackUrls: member.trackUrls,
        workHoursStart: member.workHoursStart,
        workHoursEnd: member.workHoursEnd,
        workHoursTimezone: member.workHoursTimezone,
        privacyMode: member.privacyMode,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get privacy settings" });
    }
  });

  app.patch("/api/team-members/:id/privacy", authenticateToken, sanitizeInput, async (req: Request, res: Response) => {
    try {
      const access = await canAccessTeamMember(req.user!.id, req.params.id);
      if (!access.allowed) {
        return res.status(403).json({ error: access.reason || "Access denied" });
      }
      // Validate ID format
      const idValidation = validateUUID(req.params.id, "Team member ID");
      if (!idValidation.valid) {
        return res.status(400).json({ error: idValidation.error });
      }

      // Validate time fields if provided
      if (req.body.workHoursStart) {
        const timeValidation = validateTimeFormat(req.body.workHoursStart, "workHoursStart");
        if (!timeValidation.valid) {
          return res.status(400).json({ error: timeValidation.error });
        }
      }

      if (req.body.workHoursEnd) {
        const timeValidation = validateTimeFormat(req.body.workHoursEnd, "workHoursEnd");
        if (!timeValidation.valid) {
          return res.status(400).json({ error: timeValidation.error });
        }
      }

      if (req.body.workHoursTimezone) {
        const timezoneValidation = validateTimezone(req.body.workHoursTimezone);
        if (!timezoneValidation.valid) {
          return res.status(400).json({ error: timezoneValidation.error });
        }
      }

      // Validate time range if both times are provided
      if (req.body.workHoursStart && req.body.workHoursEnd) {
        const timeRangeValidation = validateTimeFormat(req.body.workHoursStart, "workHoursStart");
        const timeRangeValidation2 = validateTimeFormat(req.body.workHoursEnd, "workHoursEnd");
        if (timeRangeValidation.valid && timeRangeValidation2.valid) {
          const [startHour, startMin] = req.body.workHoursStart.split(":").map(Number);
          const [endHour, endMin] = req.body.workHoursEnd.split(":").map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          
          if (startMinutes >= endMinutes) {
            return res.status(400).json({ 
              error: "workHoursStart must be before workHoursEnd" 
            });
          }
        }
      }

      const data = privacySettingsSchema.parse(req.body);
      const member = await storage.updateTeamMember(req.params.id, data);
      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }
      broadcast({ type: "PRIVACY_UPDATED", member });
      res.json({
        blurScreenshots: member.blurScreenshots,
        trackApps: member.trackApps,
        trackUrls: member.trackUrls,
        workHoursStart: member.workHoursStart,
        workHoursEnd: member.workHoursEnd,
        workHoursTimezone: member.workHoursTimezone,
        privacyMode: member.privacyMode,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update privacy settings" });
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

  app.post("/api/agent/screenshot", screenshotRateLimiter, sanitizeInput, async (req: Request, res: Response) => {
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

      // Validate base64 image
      const imageValidation = validateBase64Image(data.imageData);
      if (!imageValidation.valid) {
        return res.status(400).json({ error: imageValidation.error });
      }

      const uploadsDir = path.join(process.cwd(), "uploads", "screenshots");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const fileName = `${Date.now()}-${agentToken.teamMember.id}.png`;
      const filePath = path.join(uploadsDir, fileName);
      
      const base64Data = data.imageData.replace(/^data:image\/\w+;base64,/, "");
      
      // Validate file size
      const sizeInBytes = (base64Data.length * 3) / 4;
      const sizeValidation = validateNumericRange(sizeInBytes, 0, 5 * 1024 * 1024, "File size");
      if (!sizeValidation.valid) {
        return res.status(400).json({ error: sizeValidation.error });
      }
      
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

  app.post("/api/agent/heartbeat", heartbeatRateLimiter, async (req, res) => {
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
      const updatedMember = await storage.getTeamMember(agentToken.teamMember.id);

      res.json({
        success: true,
        settings: {
          screenshotInterval: updatedMember?.screenshotInterval || settings.screenshotInterval,
          enableActivityTracking: settings.enableActivityTracking,
          enableMouseTracking: settings.enableMouseTracking,
          enableKeyboardTracking: settings.enableKeyboardTracking,
        },
        privacy: {
          privacyMode: updatedMember?.privacyMode ?? false,
          blurScreenshots: updatedMember?.blurScreenshots ?? false,
          trackApps: updatedMember?.trackApps ?? true,
          trackUrls: updatedMember?.trackUrls ?? true,
          workHoursStart: updatedMember?.workHoursStart,
          workHoursEnd: updatedMember?.workHoursEnd,
          workHoursTimezone: updatedMember?.workHoursTimezone || "UTC",
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
        privacy: {
          privacyMode: member.privacyMode ?? false,
          blurScreenshots: member.blurScreenshots ?? false,
          trackApps: member.trackApps ?? true,
          trackUrls: member.trackUrls ?? true,
          workHoursStart: member.workHoursStart,
          workHoursEnd: member.workHoursEnd,
          workHoursTimezone: member.workHoursTimezone || "UTC",
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get agent settings" });
    }
  });

  app.get("/api/team-members/:id/devices", authenticateToken, async (req, res) => {
    try {
      const access = await canAccessTeamMember(req.user!.id, req.params.id);
      if (!access.allowed) {
        return res.status(403).json({ error: access.reason || "Access denied" });
      }
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

  app.get("/api/settings", authenticateToken, requireAdmin, async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get settings" });
    }
  });

  const settingsSchema = z.object({
    screenshotInterval: z.number()
      .int("screenshotInterval must be an integer")
      .min(1, "screenshotInterval must be at least 1 second")
      .max(60, "screenshotInterval must be 60 seconds or less")
      .optional(),
    enableActivityTracking: z.boolean().optional(),
    enableMouseTracking: z.boolean().optional(),
    enableKeyboardTracking: z.boolean().optional(),
    enableNotifications: z.boolean().optional(),
    idleThreshold: z.number()
      .int("idleThreshold must be an integer")
      .min(1, "idleThreshold must be at least 1 minute")
      .max(30, "idleThreshold must be 30 minutes or less")
      .optional(),
    blurSensitiveContent: z.boolean().optional(),
    autoStartMonitoring: z.boolean().optional(),
  });

  app.put("/api/settings", authenticateToken, requireAdmin, sanitizeInput, async (req: Request, res: Response) => {
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

  app.get("/api/team-members/:id/time-stats", authenticateToken, async (req, res) => {
    try {
      const access = await canAccessTeamMember(req.user!.id, req.params.id);
      if (!access.allowed) {
        return res.status(403).json({ error: access.reason || "Access denied" });
      }
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

// Agent authentication middleware
async function agentAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const token = authHeader.slice(7);
  const agentToken = await storage.getAgentTokenByToken(token);

  if (!agentToken) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Attach the agent token to the request for easy access in handlers
  (req as any).agent = agentToken;
  next();
}

// Timer start endpoint
app.post("/api/agent/timer/start", agentAuth, async (req: Request, res: Response) => {
  try {
    const agentToken = (req as any).agent;
    const data = agentTimerStartSchema.parse(req.body);

    // Check if a timer is already running
    const existingActive = await storage.getActiveTimeEntry(agentToken.teamMember.id);
    if (existingActive) {
      return res.status(400).json({
        error: "Timer already running",
        activeEntry: existingActive,
      });
    }

    // Create new time entry
    const entry = await storage.createTimeEntry({
      teamMemberId: agentToken.teamMember.id,
      startTime: new Date(),
      project: data.project || null,
      notes: data.notes || null,
      isActive: true,
      idleSeconds: 0,
    });

    // Update team member status and last seen for the agent
    await storage.updateTeamMember(agentToken.teamMember.id, { status: "online" });
    await storage.updateAgentTokenLastSeen(agentToken.id);

    // Broadcast to any listeners (WebSocket or similar)
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

  const appUsageSchema = z.object({
    appName: z.string().min(1),
    appType: z.enum(["application", "website"]).default("application"),
    windowTitle: z.string().optional(),
    url: z.string().optional(),
  });

  app.post("/api/agent/app-usage", async (req, res) => {
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
      const data = appUsageSchema.parse(req.body);

      const activeUsage = await storage.getActiveAppUsage(agentToken.teamMember.id);

      if (activeUsage) {
        if (activeUsage.appName === data.appName && 
            activeUsage.windowTitle === data.windowTitle) {
          return res.json({ status: "unchanged", usage: activeUsage });
        }

        await storage.endAppUsage(activeUsage.id);
      }

      const usage = await storage.createAppUsage({
        teamMemberId: agentToken.teamMember.id,
        appName: data.appName,
        appType: data.appType,
        windowTitle: data.windowTitle,
        url: data.url,
        startTime: new Date(),
        isActive: true,
      });

      broadcast({ type: "APP_USAGE_CHANGED", memberId: agentToken.teamMember.id, usage });
      res.json({ status: "created", usage });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to record app usage" });
    }
  });

  app.get("/api/team-members/:id/app-usage", authenticateToken, async (req, res) => {
    try {
      const access = await canAccessTeamMember(req.user!.id, req.params.id);
      if (!access.allowed) {
        return res.status(403).json({ error: access.reason || "Access denied" });
      }
      const memberId = req.params.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const summary = await storage.getAppUsageSummary(memberId, today);
      const activeApp = await storage.getActiveAppUsage(memberId);

      res.json({ summary, activeApp });
    } catch (error) {
      res.status(500).json({ error: "Failed to get app usage" });
    }
  });

  app.get("/api/team-members/:id/app-usage/history", authenticateToken, async (req, res) => {
    try {
      const access = await canAccessTeamMember(req.user!.id, req.params.id);
      if (!access.allowed) {
        return res.status(403).json({ error: access.reason || "Access denied" });
      }
      const memberId = req.params.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const history = await storage.getAppUsageByMember(memberId, today);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to get app usage history" });
    }
  });

  app.get("/api/reports", authenticateToken, apiRateLimiter, sanitizeInput, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          error: "startDate and endDate are required",
          expectedFormat: "YYYY-MM-DD or ISO 8601 format (e.g., 2024-01-15 or 2024-01-15T00:00:00Z)"
        });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      // Enhanced date validation
      const dateValidation = validateDateRange(start, end, { start: "startDate", end: "endDate" });
      if (!dateValidation.valid) {
        return res.status(400).json({ error: dateValidation.error });
      }

      const members = await storage.getAllTeamMembers();
      const timeEntries = await storage.getAllTimeEntries(start, end);
      
      const timeBreakdown = await Promise.all(
        members.map(async (member) => {
          const stats = await storage.getMemberTimeStats(member.id, start, end);
          const entries = await storage.getTimeEntriesByMember(member.id, start, end);
          
          const projectMap = new Map<string, number>();
          for (const entry of entries) {
            const projectName = entry.project || "No Project";
            const duration = entry.duration || 0;
            projectMap.set(projectName, (projectMap.get(projectName) || 0) + duration);
          }

          const projects = Array.from(projectMap.entries()).map(([name, duration]) => ({
            name,
            duration,
          }));

          return {
            memberId: member.id,
            memberName: member.name,
            totalTime: stats.totalSeconds,
            activeTime: stats.totalSeconds - stats.totalIdleSeconds,
            idleTime: stats.totalIdleSeconds,
            projects,
          };
        })
      );

      const teamAppUsageMap = new Map<string, { appType: string; totalDuration: number; users: Set<string> }>();
      
      for (const member of members) {
        const appSummary = await storage.getAppUsageSummary(member.id, start, end);
        for (const app of appSummary) {
          const existing = teamAppUsageMap.get(app.appName);
          if (existing) {
            existing.totalDuration += app.totalDuration;
            existing.users.add(member.id);
          } else {
            teamAppUsageMap.set(app.appName, {
              appType: app.appType,
              totalDuration: app.totalDuration,
              users: new Set([member.id]),
            });
          }
        }
      }

      const teamAppUsage = Array.from(teamAppUsageMap.entries())
        .map(([appName, data]) => ({
          appName,
          appType: data.appType,
          totalDuration: data.totalDuration,
          userCount: data.users.size,
        }))
        .sort((a, b) => b.totalDuration - a.totalDuration);

      const dayMap = new Map<string, { activeTime: number; idleTime: number; screenshots: number }>();
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateKey = currentDate.toISOString().split("T")[0];
        dayMap.set(dateKey, { activeTime: 0, idleTime: 0, screenshots: 0 });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      for (const entry of timeEntries) {
        if (entry.startTime) {
          const dateKey = entry.startTime.toISOString().split("T")[0];
          const dayData = dayMap.get(dateKey);
          if (dayData) {
            const duration = entry.duration || 0;
            const idle = entry.idleSeconds || 0;
            dayData.activeTime += duration - idle;
            dayData.idleTime += idle;
          }
        }
      }

      const allScreenshots = await storage.getAllScreenshots();
      for (const screenshot of allScreenshots) {
        if (screenshot.capturedAt >= start && screenshot.capturedAt <= end) {
          const dateKey = screenshot.capturedAt.toISOString().split("T")[0];
          const dayData = dayMap.get(dateKey);
          if (dayData) {
            dayData.screenshots += 1;
          }
        }
      }

      const productivity = Array.from(dayMap.entries())
        .map(([date, data]) => ({
          date,
          activeTime: data.activeTime,
          idleTime: data.idleTime,
          screenshots: data.screenshots,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const totalActiveTime = timeBreakdown.reduce((sum, m) => sum + m.activeTime, 0);
      const totalIdleTime = timeBreakdown.reduce((sum, m) => sum + m.idleTime, 0);
      const totalScreenshots = productivity.reduce((sum, d) => sum + d.screenshots, 0);

      const screenshotsInRange = allScreenshots.filter(
        s => s.capturedAt >= start && s.capturedAt <= end
      );
      const avgActivityScore = screenshotsInRange.length > 0
        ? screenshotsInRange.reduce((sum, s) => sum + (s.activityScore || 0), 0) / screenshotsInRange.length
        : 0;

      res.json({
        productivity,
        timeBreakdown: timeBreakdown.filter(m => m.totalTime > 0),
        teamAppUsage,
        summary: {
          totalActiveTime,
          totalIdleTime,
          totalScreenshots,
          avgActivityScore,
        },
      });
    } catch (error) {
      console.error("Failed to generate report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // ============ BILLING ROUTES (Pay-per-user) ============
  const { stripeService } = await import("./stripe/stripeService");
  const { getStripePublishableKey } = await import("./stripe/stripeClient");

  // Get Stripe publishable key for frontend
  app.get("/api/billing/config", async (req: Request, res: Response) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Failed to get Stripe config:", error);
      res.status(500).json({ error: "Failed to get billing configuration" });
    }
  });

  // Get company subscription status
  app.get("/api/billing/subscription", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
    try {
      const company = await storage.getCompany(req.user!.companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Count active employees
      const employees = await storage.getUsersByCompany(req.user!.companyId);
      const activeEmployeeCount = employees.filter(e => e.isActive).length;

      // Get subscription from Stripe if exists
      let subscription = null;
      if (company.stripeCustomerId) {
        const subscriptions = await db.execute(
          sql`SELECT * FROM stripe.subscriptions WHERE customer = ${company.stripeCustomerId} AND status = 'active' LIMIT 1`
        );
        subscription = subscriptions.rows[0] || null;
      }

      res.json({
        company: {
          id: company.id,
          name: company.name,
          stripeCustomerId: company.stripeCustomerId,
        },
        subscription,
        activeEmployeeCount,
      });
    } catch (error) {
      console.error("Failed to get subscription:", error);
      res.status(500).json({ error: "Failed to get subscription status" });
    }
  });

  // List available products/prices
  app.get("/api/billing/products", async (req: Request, res: Response) => {
    try {
      const rows = await stripeService.listProductsWithPrices();

      const productsMap = new Map();
      for (const row of rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            active: row.product_active,
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unit_amount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
            active: row.price_active,
          });
        }
      }

      res.json({ products: Array.from(productsMap.values()) });
    } catch (error) {
      console.error("Failed to list products:", error);
      res.status(500).json({ error: "Failed to list products" });
    }
  });

  // Create checkout session for subscription
  app.post("/api/billing/checkout", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { priceId, quantity } = req.body;
      
      if (!priceId) {
        return res.status(400).json({ error: "Price ID is required" });
      }

      const company = await storage.getCompany(req.user!.companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Create or get Stripe customer
      let customerId = company.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(
          company.email,
          company.id,
          company.name
        );
        await storage.updateCompanyStripeCustomerId(company.id, customer.id);
        customerId = customer.id;
      }

      // Count employees for quantity
      const employees = await storage.getUsersByCompany(req.user!.companyId);
      const employeeCount = quantity || employees.filter(e => e.isActive).length || 1;

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        employeeCount,
        `${baseUrl}/settings?billing=success`,
        `${baseUrl}/settings?billing=canceled`,
        company.id
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Failed to create checkout session:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Create customer portal session for managing subscription
  app.post("/api/billing/portal", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
    try {
      const company = await storage.getCompany(req.user!.companyId);
      if (!company || !company.stripeCustomerId) {
        return res.status(400).json({ error: "No active subscription found" });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripeService.createCustomerPortalSession(
        company.stripeCustomerId,
        `${baseUrl}/settings`
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Failed to create portal session:", error);
      res.status(500).json({ error: "Failed to create billing portal session" });
    }
  });

  // Update subscription quantity when employees change
  app.post("/api/billing/update-seats", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
    try {
      const company = await storage.getCompany(req.user!.companyId);
      if (!company || !company.stripeCustomerId) {
        return res.status(400).json({ error: "No active subscription found" });
      }

      // Get active subscription
      const subscriptions = await db.execute(
        sql`SELECT * FROM stripe.subscriptions WHERE customer = ${company.stripeCustomerId} AND status = 'active' LIMIT 1`
      );
      const subscription = subscriptions.rows[0] as any;

      if (!subscription) {
        return res.status(400).json({ error: "No active subscription found" });
      }

      // Count active employees
      const employees = await storage.getUsersByCompany(req.user!.companyId);
      const newQuantity = employees.filter(e => e.isActive).length;

      await stripeService.updateSubscriptionQuantity(subscription.id, newQuantity);

      res.json({ success: true, newQuantity });
    } catch (error) {
      console.error("Failed to update seats:", error);
      res.status(500).json({ error: "Failed to update subscription seats" });
    }
  });

  // ============ USER MANAGEMENT / PERMISSION ROUTES ============
  
  // Get all users in the company (admin only)
  app.get("/api/users", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
    try {
      const employees = await storage.getUsersByCompany(req.user!.companyId);
      const usersWithoutPasswords = employees.map(({ password, refreshToken, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Failed to get users:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  // Update user role (admin only)
  const updateUserRoleSchema = z.object({
    role: z.enum(["admin", "manager", "viewer"]),
  });

  app.patch("/api/users/:userId/role", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { role } = updateUserRoleSchema.parse(req.body);

      // Cannot change own role
      if (userId === req.user!.id) {
        return res.status(400).json({ error: "Cannot change your own role" });
      }

      // Ensure user belongs to the same company
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (targetUser.companyId !== req.user!.companyId) {
        return res.status(403).json({ error: "User belongs to a different company" });
      }

      await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));

      // Also update the team member role if exists
      const [member] = await db.select().from(teamMembers).where(eq(teamMembers.userId, userId));
      if (member) {
        await db.update(teamMembers).set({ role }).where(eq(teamMembers.userId, userId));
      }

      res.json({ success: true, userId, newRole: role });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to update user role:", error);
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  // Toggle user active status (admin only)
  app.patch("/api/users/:userId/status", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== "boolean") {
        return res.status(400).json({ error: "isActive must be a boolean" });
      }

      // Cannot deactivate self
      if (userId === req.user!.id) {
        return res.status(400).json({ error: "Cannot deactivate your own account" });
      }

      // Ensure user belongs to the same company
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (targetUser.companyId !== req.user!.companyId) {
        return res.status(403).json({ error: "User belongs to a different company" });
      }

      await db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, userId));

      res.json({ success: true, userId, isActive });
    } catch (error) {
      console.error("Failed to update user status:", error);
      res.status(500).json({ error: "Failed to update user status" });
    }
  });

  return httpServer;
}
