import {
  teamMembers,
  screenshots,
  activityLogs,
  type TeamMember,
  type InsertTeamMember,
  type Screenshot,
  type InsertScreenshot,
  type ActivityLog,
  type InsertActivityLog,
  type TeamMemberWithStats,
  type ScreenshotWithMember,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte } from "drizzle-orm";

export interface IStorage {
  getTeamMember(id: string): Promise<TeamMember | undefined>;
  getTeamMemberByEmail(email: string): Promise<TeamMember | undefined>;
  getAllTeamMembers(): Promise<TeamMember[]>;
  getTeamMembersWithStats(): Promise<TeamMemberWithStats[]>;
  createTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(id: string, updates: Partial<InsertTeamMember>): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string): Promise<boolean>;

  getScreenshot(id: string): Promise<Screenshot | undefined>;
  getAllScreenshots(): Promise<ScreenshotWithMember[]>;
  getRecentScreenshots(limit?: number): Promise<ScreenshotWithMember[]>;
  getScreenshotsByMember(memberId: string): Promise<ScreenshotWithMember[]>;
  createScreenshot(screenshot: InsertScreenshot): Promise<Screenshot>;
  deleteScreenshot(id: string): Promise<boolean>;

  getActivityLogs(memberId: string): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;

  getMemberStats(memberId: string): Promise<{
    totalScreenshots: number;
    avgActivityScore: number;
    totalClicks: number;
    totalKeystrokes: number;
    activeHours: number;
  }>;

  getDashboardStats(): Promise<{
    activeUsers: number;
    totalScreenshots: number;
    averageActivity: number;
    topPerformer: string;
  }>;

  getTimeline(memberId?: string): Promise<{ hour: number; activityLevel: "high" | "medium" | "low" | "none" }[]>;

  getSettings(): Promise<AppSettings>;
  updateSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
}

export interface AppSettings {
  screenshotInterval: number;
  enableActivityTracking: boolean;
  enableMouseTracking: boolean;
  enableKeyboardTracking: boolean;
  enableNotifications: boolean;
  idleThreshold: number;
  blurSensitiveContent: boolean;
  autoStartMonitoring: boolean;
}

const defaultSettings: AppSettings = {
  screenshotInterval: 5,
  enableActivityTracking: true,
  enableMouseTracking: true,
  enableKeyboardTracking: true,
  enableNotifications: true,
  idleThreshold: 5,
  blurSensitiveContent: false,
  autoStartMonitoring: true,
};

export class DatabaseStorage implements IStorage {
  private settings: AppSettings = { ...defaultSettings };

  async getTeamMember(id: string): Promise<TeamMember | undefined> {
    const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, id));
    return member || undefined;
  }

  async getTeamMemberByEmail(email: string): Promise<TeamMember | undefined> {
    const [member] = await db.select().from(teamMembers).where(eq(teamMembers.email, email));
    return member || undefined;
  }

  async getAllTeamMembers(): Promise<TeamMember[]> {
    return db.select().from(teamMembers).orderBy(teamMembers.name);
  }

  async getTeamMembersWithStats(): Promise<TeamMemberWithStats[]> {
    const members = await this.getAllTeamMembers();
    const result: TeamMemberWithStats[] = [];

    for (const member of members) {
      const memberScreenshots = await db
        .select()
        .from(screenshots)
        .where(eq(screenshots.teamMemberId, member.id))
        .orderBy(desc(screenshots.capturedAt))
        .limit(1);

      const statsResult = await db
        .select({
          count: sql<number>`count(*)`,
          avgScore: sql<number>`coalesce(avg(${screenshots.activityScore}), 0)`,
        })
        .from(screenshots)
        .where(eq(screenshots.teamMemberId, member.id));

      result.push({
        ...member,
        screenshotCount: Number(statsResult[0]?.count ?? 0),
        avgActivityScore: Number(statsResult[0]?.avgScore ?? 0),
        lastScreenshot: memberScreenshots[0],
      });
    }

    return result;
  }

  async createTeamMember(member: InsertTeamMember): Promise<TeamMember> {
    const [created] = await db.insert(teamMembers).values(member).returning();
    return created;
  }

  async updateTeamMember(id: string, updates: Partial<InsertTeamMember>): Promise<TeamMember | undefined> {
    const [updated] = await db
      .update(teamMembers)
      .set(updates)
      .where(eq(teamMembers.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTeamMember(id: string): Promise<boolean> {
    const result = await db.delete(teamMembers).where(eq(teamMembers.id, id));
    return true;
  }

  async getScreenshot(id: string): Promise<Screenshot | undefined> {
    const [screenshot] = await db.select().from(screenshots).where(eq(screenshots.id, id));
    return screenshot || undefined;
  }

  async getAllScreenshots(): Promise<ScreenshotWithMember[]> {
    const allScreenshots = await db
      .select()
      .from(screenshots)
      .orderBy(desc(screenshots.capturedAt));

    const result: ScreenshotWithMember[] = [];
    for (const screenshot of allScreenshots) {
      const member = await this.getTeamMember(screenshot.teamMemberId);
      if (member) {
        result.push({ ...screenshot, teamMember: member });
      }
    }
    return result;
  }

  async getRecentScreenshots(limit = 8): Promise<ScreenshotWithMember[]> {
    const recentScreenshots = await db
      .select()
      .from(screenshots)
      .orderBy(desc(screenshots.capturedAt))
      .limit(limit);

    const result: ScreenshotWithMember[] = [];
    for (const screenshot of recentScreenshots) {
      const member = await this.getTeamMember(screenshot.teamMemberId);
      if (member) {
        result.push({ ...screenshot, teamMember: member });
      }
    }
    return result;
  }

  async getScreenshotsByMember(memberId: string): Promise<ScreenshotWithMember[]> {
    const memberScreenshots = await db
      .select()
      .from(screenshots)
      .where(eq(screenshots.teamMemberId, memberId))
      .orderBy(desc(screenshots.capturedAt));

    const member = await this.getTeamMember(memberId);
    if (!member) return [];

    return memberScreenshots.map((screenshot) => ({
      ...screenshot,
      teamMember: member,
    }));
  }

  async createScreenshot(screenshot: InsertScreenshot): Promise<Screenshot> {
    const [created] = await db.insert(screenshots).values(screenshot).returning();
    return created;
  }

  async deleteScreenshot(id: string): Promise<boolean> {
    await db.delete(screenshots).where(eq(screenshots.id, id));
    return true;
  }

  async getActivityLogs(memberId: string): Promise<ActivityLog[]> {
    return db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.teamMemberId, memberId))
      .orderBy(desc(activityLogs.recordedAt));
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [created] = await db.insert(activityLogs).values(log).returning();
    return created;
  }

  async getMemberStats(memberId: string): Promise<{
    totalScreenshots: number;
    avgActivityScore: number;
    totalClicks: number;
    totalKeystrokes: number;
    activeHours: number;
  }> {
    const statsResult = await db
      .select({
        count: sql<number>`count(*)`,
        avgScore: sql<number>`coalesce(avg(${screenshots.activityScore}), 0)`,
        totalClicks: sql<number>`coalesce(sum(${screenshots.mouseClicks}), 0)`,
        totalKeystrokes: sql<number>`coalesce(sum(${screenshots.keystrokes}), 0)`,
      })
      .from(screenshots)
      .where(eq(screenshots.teamMemberId, memberId));

    return {
      totalScreenshots: Number(statsResult[0]?.count ?? 0),
      avgActivityScore: Number(statsResult[0]?.avgScore ?? 0),
      totalClicks: Number(statsResult[0]?.totalClicks ?? 0),
      totalKeystrokes: Number(statsResult[0]?.totalKeystrokes ?? 0),
      activeHours: Math.floor(Number(statsResult[0]?.count ?? 0) * (this.settings.screenshotInterval / 60)),
    };
  }

  async getDashboardStats(): Promise<{
    activeUsers: number;
    totalScreenshots: number;
    averageActivity: number;
    topPerformer: string;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const members = await this.getAllTeamMembers();
    const activeUsers = members.filter((m) => m.status === "online").length;

    const todayScreenshots = await db
      .select({
        count: sql<number>`count(*)`,
        avgScore: sql<number>`coalesce(avg(${screenshots.activityScore}), 0)`,
      })
      .from(screenshots)
      .where(gte(screenshots.capturedAt, today));

    const memberStats = await Promise.all(
      members.map(async (member) => {
        const stats = await this.getMemberStats(member.id);
        return { name: member.name, score: stats.avgActivityScore };
      })
    );

    const topPerformer = memberStats.sort((a, b) => b.score - a.score)[0]?.name || "N/A";

    return {
      activeUsers,
      totalScreenshots: Number(todayScreenshots[0]?.count ?? 0),
      averageActivity: Number(todayScreenshots[0]?.avgScore ?? 0),
      topPerformer,
    };
  }

  async getTimeline(memberId?: string): Promise<{ hour: number; activityLevel: "high" | "medium" | "low" | "none" }[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query = memberId
      ? db
          .select()
          .from(screenshots)
          .where(and(eq(screenshots.teamMemberId, memberId), gte(screenshots.capturedAt, today)))
      : db
          .select()
          .from(screenshots)
          .where(gte(screenshots.capturedAt, today));

    const todayScreenshots = await query;

    const hourlyActivity: Map<number, number[]> = new Map();
    for (let i = 0; i < 24; i++) {
      hourlyActivity.set(i, []);
    }

    for (const screenshot of todayScreenshots) {
      const hour = new Date(screenshot.capturedAt).getHours();
      const scores = hourlyActivity.get(hour) || [];
      scores.push(screenshot.activityScore);
      hourlyActivity.set(hour, scores);
    }

    return Array.from(hourlyActivity.entries()).map(([hour, scores]) => {
      if (scores.length === 0) {
        return { hour, activityLevel: "none" as const };
      }
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg >= 70) return { hour, activityLevel: "high" as const };
      if (avg >= 40) return { hour, activityLevel: "medium" as const };
      return { hour, activityLevel: "low" as const };
    });
  }

  async getSettings(): Promise<AppSettings> {
    return this.settings;
  }

  async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    this.settings = { ...this.settings, ...updates };
    return this.settings;
  }
}

export const storage = new DatabaseStorage();
