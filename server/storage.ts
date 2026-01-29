import {
  users,
  teamMembers,
  screenshots,
  activityLogs,
  agentTokens,
  timeEntries,
  appUsage,
  companies,
  type User,
  type InsertUser,
  type TeamMember,
  type InsertTeamMember,
  type Screenshot,
  type InsertScreenshot,
  type ActivityLog,
  type InsertActivityLog,
  type AgentToken,
  type InsertAgentToken,
  type TimeEntry,
  type InsertTimeEntry,
  type AppUsage,
  type InsertAppUsage,
  type AppUsageSummary,
  type TeamMemberWithStats,
  type ScreenshotWithMember,
  type AgentTokenWithMember,
  type TimeEntryWithMember,
  type Company,
  type InsertCompany,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte } from "drizzle-orm";

export interface IStorage {
  // Company / multi-tenant
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyByEmail(email: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompanyStripeCustomerId(companyId: string, stripeCustomerId: string): Promise<void>;
  getUsersByCompany(companyId: string): Promise<User[]>;

  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: Omit<InsertUser, "password"> & { password: string }): Promise<User>;
  updateUserRefreshToken(userId: string, refreshToken: string | null): Promise<void>;
  
  getTeamMember(id: string): Promise<TeamMember | undefined>;
  getTeamMemberByEmail(email: string): Promise<TeamMember | undefined>;
  getAllTeamMembers(): Promise<TeamMember[]>;
  getTeamMembersWithStats(userId: string): Promise<TeamMemberWithStats[]>;

  createTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(id: string, updates: Partial<InsertTeamMember>): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string): Promise<boolean>;

  getScreenshot(id: string): Promise<Screenshot | undefined>;
  getAllScreenshots(): Promise<ScreenshotWithMember[]>;
  getRecentScreenshots(limit?: number): Promise<ScreenshotWithMember[]>;
  getScreenshotsByMember(memberId: string): Promise<ScreenshotWithMember[]>;
  createScreenshot(screenshot: InsertScreenshot): Promise<Screenshot>;
  deleteScreenshot(id: string): Promise<boolean>;
  updateScreenshotBlur(id: string, isBlurred: boolean): Promise<Screenshot | undefined>;

  getActivityLogs(memberId: string): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;

  getAgentTokenByToken(token: string): Promise<AgentTokenWithMember | undefined>;
  createAgentToken(agentToken: InsertAgentToken): Promise<AgentToken>;
  updateAgentTokenLastSeen(id: string): Promise<void>;
  getAgentTokensByMember(memberId: string): Promise<AgentToken[]>;
  deactivateAgentToken(id: string): Promise<void>;

  getTimeEntry(id: string): Promise<TimeEntry | undefined>;
  getActiveTimeEntry(memberId: string): Promise<TimeEntry | undefined>;
  getTimeEntriesByMember(memberId: string, startDate?: Date, endDate?: Date): Promise<TimeEntry[]>;
  getAllTimeEntries(startDate?: Date, endDate?: Date): Promise<TimeEntryWithMember[]>;
  createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: string, updates: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;
  stopTimeEntry(id: string): Promise<TimeEntry | undefined>;
  deleteTimeEntry(id: string): Promise<boolean>;
  getMemberTimeStats(memberId: string, startDate?: Date, endDate?: Date): Promise<{
    totalSeconds: number;
    totalIdleSeconds: number;
    entriesCount: number;
  }>;

  getActiveAppUsage(memberId: string): Promise<AppUsage | undefined>;
  getAppUsageByMember(memberId: string, startDate?: Date, endDate?: Date): Promise<AppUsage[]>;
  getAppUsageSummary(memberId: string, startDate?: Date, endDate?: Date): Promise<AppUsageSummary[]>;
  createAppUsage(usage: InsertAppUsage): Promise<AppUsage>;
  updateAppUsage(id: string, updates: Partial<InsertAppUsage>): Promise<AppUsage | undefined>;
  endAppUsage(id: string): Promise<AppUsage | undefined>;

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
    totalTimeToday: number;
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

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async getCompanyByEmail(email: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.email, email));
    return company || undefined;
  }

  async createCompany(companyData: InsertCompany): Promise<Company> {
    const [created] = await db.insert(companies).values(companyData).returning();
    return created;
  }

  async updateCompanyStripeCustomerId(companyId: string, stripeCustomerId: string): Promise<void> {
    await db
      .update(companies)
      .set({ stripeCustomerId, updatedAt: new Date() })
      .where(eq(companies.id, companyId));
  }

  async getUsersByCompany(companyId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.companyId, companyId));
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(userData: Omit<InsertUser, "password"> & { password: string }): Promise<User> {
    const { password, ...rest } = userData;
    const [created] = await db.insert(users).values({
      ...rest,
      password,
    }).returning();
    return created;
  }

  async updateUserRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
    await db
      .update(users)
      .set({ refreshToken, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

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

  async getTeamMembersWithStats(userId: string): Promise<TeamMemberWithStats[]> {
    // 1️⃣ Get the logged-in user to find their company
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return [];
  
    const companyId = user.companyId;
  
    // 2️⃣ Get all team members belonging to users of this company
    const membersWithUsers = await db
      .select({
        teamMember: teamMembers,
        user: users,
      })
      .from(teamMembers)
      .leftJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(users.companyId, companyId));
  
    const result: TeamMemberWithStats[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
  
    for (const { teamMember } of membersWithUsers) {
      const memberScreenshots = await db
        .select()
        .from(screenshots)
        .where(eq(screenshots.teamMemberId, teamMember.id))
        .orderBy(desc(screenshots.capturedAt))
        .limit(1);
  
      const statsResult = await db
        .select({
          count: sql<number>`count(*)`,
          avgScore: sql<number>`coalesce(avg(${screenshots.activityScore}), 0)`,
        })
        .from(screenshots)
        .where(eq(screenshots.teamMemberId, teamMember.id));
  
      const timeStats = await this.getMemberTimeStats(teamMember.id, today);
      const activeTimer = await this.getActiveTimeEntry(teamMember.id);
  
      result.push({
        ...teamMember,
        screenshotCount: Number(statsResult[0]?.count ?? 0),
        avgActivityScore: Number(statsResult[0]?.avgScore ?? 0),
        lastScreenshot: memberScreenshots[0],
        timeTrackedToday: timeStats.totalSeconds,
        hasActiveTimer: !!activeTimer,
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
      .where(eq(screenshots.isDeleted, false))
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

  async getScreenshotsByCompany(companyId: string): Promise<ScreenshotWithMember[]> {
    const companyUsers = await db.select().from(users).where(eq(users.companyId, companyId));
    const companyUserIds = companyUsers.map(u => u.id);
    
    if (companyUserIds.length === 0) return [];

    const companyMembers = await db
      .select()
      .from(teamMembers)
      .where(sql`${teamMembers.userId} IN (${sql.join(companyUserIds.map(id => sql`${id}`), sql`, `)})`);
    
    const memberIds = companyMembers.map(m => m.id);
    if (memberIds.length === 0) return [];

    const companyScreenshots = await db
      .select()
      .from(screenshots)
      .where(and(
        eq(screenshots.isDeleted, false),
        sql`${screenshots.teamMemberId} IN (${sql.join(memberIds.map(id => sql`${id}`), sql`, `)})`
      ))
      .orderBy(desc(screenshots.capturedAt));

    const memberMap = new Map(companyMembers.map(m => [m.id, m]));
    return companyScreenshots.map(s => ({
      ...s,
      teamMember: memberMap.get(s.teamMemberId)!,
    })).filter(s => s.teamMember);
  }

  async getRecentScreenshots(limit = 8): Promise<ScreenshotWithMember[]> {
    const recentScreenshots = await db
      .select()
      .from(screenshots)
      .where(eq(screenshots.isDeleted, false))
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

  async getRecentScreenshotsByCompany(companyId: string, limit = 8): Promise<ScreenshotWithMember[]> {
    const all = await this.getScreenshotsByCompany(companyId);
    return all.slice(0, limit);
  }

  async getScreenshotsByMember(memberId: string): Promise<ScreenshotWithMember[]> {
    const memberScreenshots = await db
      .select()
      .from(screenshots)
      .where(and(
        eq(screenshots.teamMemberId, memberId),
        eq(screenshots.isDeleted, false)
      ))
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
    await db
      .update(screenshots)
      .set({ isDeleted: true })
      .where(eq(screenshots.id, id));
    return true;
  }

  async updateScreenshotBlur(id: string, isBlurred: boolean): Promise<Screenshot | undefined> {
    const [updated] = await db
      .update(screenshots)
      .set({ isBlurred })
      .where(eq(screenshots.id, id))
      .returning();
    return updated;
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
    totalTimeToday: number;
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

    const todayTimeResult = await db
      .select({
        totalSeconds: sql<number>`coalesce(sum(${timeEntries.duration}), 0)`,
      })
      .from(timeEntries)
      .where(and(gte(timeEntries.startTime, today), eq(timeEntries.isActive, false)));

    return {
      activeUsers,
      totalScreenshots: Number(todayScreenshots[0]?.count ?? 0),
      averageActivity: Number(todayScreenshots[0]?.avgScore ?? 0),
      totalTimeToday: Number(todayTimeResult[0]?.totalSeconds ?? 0),
    };
  }

  async getDashboardStatsByCompany(companyId: string): Promise<{
    activeUsers: number;
    totalScreenshots: number;
    averageActivity: number;
    totalTimeToday: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const companyUsers = await db.select().from(users).where(eq(users.companyId, companyId));
    const companyUserIds = companyUsers.map(u => u.id);
    
    if (companyUserIds.length === 0) {
      return { activeUsers: 0, totalScreenshots: 0, averageActivity: 0, totalTimeToday: 0 };
    }

    const companyMembers = await db
      .select()
      .from(teamMembers)
      .where(sql`${teamMembers.userId} IN (${sql.join(companyUserIds.map(id => sql`${id}`), sql`, `)})`);

    const activeUsers = companyMembers.filter((m) => m.status === "online").length;
    const memberIds = companyMembers.map(m => m.id);
    
    if (memberIds.length === 0) {
      return { activeUsers: 0, totalScreenshots: 0, averageActivity: 0, totalTimeToday: 0 };
    }

    const todayScreenshots = await db
      .select({
        count: sql<number>`count(*)`,
        avgScore: sql<number>`coalesce(avg(${screenshots.activityScore}), 0)`,
      })
      .from(screenshots)
      .where(and(
        gte(screenshots.capturedAt, today),
        sql`${screenshots.teamMemberId} IN (${sql.join(memberIds.map(id => sql`${id}`), sql`, `)})`
      ));

    const todayTimeResult = await db
      .select({
        totalSeconds: sql<number>`coalesce(sum(${timeEntries.duration}), 0)`,
      })
      .from(timeEntries)
      .where(and(
        gte(timeEntries.startTime, today),
        eq(timeEntries.isActive, false),
        sql`${timeEntries.teamMemberId} IN (${sql.join(memberIds.map(id => sql`${id}`), sql`, `)})`
      ));

    return {
      activeUsers,
      totalScreenshots: Number(todayScreenshots[0]?.count ?? 0),
      averageActivity: Number(todayScreenshots[0]?.avgScore ?? 0),
      totalTimeToday: Number(todayTimeResult[0]?.totalSeconds ?? 0),
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

  async getTimelineByCompany(companyId: string): Promise<{ hour: number; activityLevel: "high" | "medium" | "low" | "none" }[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const companyUsers = await db.select().from(users).where(eq(users.companyId, companyId));
    const companyUserIds = companyUsers.map(u => u.id);
    
    if (companyUserIds.length === 0) {
      return Array.from({ length: 24 }, (_, i) => ({ hour: i, activityLevel: "none" as const }));
    }

    const companyMembers = await db
      .select()
      .from(teamMembers)
      .where(sql`${teamMembers.userId} IN (${sql.join(companyUserIds.map(id => sql`${id}`), sql`, `)})`);

    const memberIds = companyMembers.map(m => m.id);
    if (memberIds.length === 0) {
      return Array.from({ length: 24 }, (_, i) => ({ hour: i, activityLevel: "none" as const }));
    }

    const todayScreenshots = await db
      .select()
      .from(screenshots)
      .where(and(
        gte(screenshots.capturedAt, today),
        sql`${screenshots.teamMemberId} IN (${sql.join(memberIds.map(id => sql`${id}`), sql`, `)})`
      ));

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

  async getAgentTokenByToken(token: string): Promise<AgentTokenWithMember | undefined> {
    const [agentToken] = await db
      .select()
      .from(agentTokens)
      .where(and(eq(agentTokens.token, token), eq(agentTokens.isActive, true)));

    if (!agentToken) return undefined;

    const member = await this.getTeamMember(agentToken.teamMemberId);
    if (!member) return undefined;

    return { ...agentToken, teamMember: member };
  }

  async createAgentToken(agentToken: InsertAgentToken): Promise<AgentToken> {
    const [created] = await db.insert(agentTokens).values(agentToken).returning();
    return created;
  }

  async updateAgentTokenLastSeen(id: string): Promise<void> {
    await db
      .update(agentTokens)
      .set({ lastSeenAt: new Date() })
      .where(eq(agentTokens.id, id));
  }

  async getAgentTokensByMember(memberId: string): Promise<AgentToken[]> {
    return db
      .select()
      .from(agentTokens)
      .where(eq(agentTokens.teamMemberId, memberId))
      .orderBy(desc(agentTokens.createdAt));
  }

  async deactivateAgentToken(id: string): Promise<void> {
    await db
      .update(agentTokens)
      .set({ isActive: false })
      .where(eq(agentTokens.id, id));
  }

  async getTimeEntry(id: string): Promise<TimeEntry | undefined> {
    const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
    return entry || undefined;
  }

  async getActiveTimeEntry(memberId: string): Promise<TimeEntry | undefined> {
    const [entry] = await db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.teamMemberId, memberId), eq(timeEntries.isActive, true)));
    return entry || undefined;
  }

  async getTimeEntriesByMember(memberId: string, startDate?: Date, endDate?: Date): Promise<TimeEntry[]> {
    let conditions = [eq(timeEntries.teamMemberId, memberId)];
    
    if (startDate) {
      conditions.push(gte(timeEntries.startTime, startDate));
    }
    if (endDate) {
      conditions.push(sql`${timeEntries.startTime} <= ${endDate}`);
    }

    return db
      .select()
      .from(timeEntries)
      .where(and(...conditions))
      .orderBy(desc(timeEntries.startTime));
  }

  async getAllTimeEntries(startDate?: Date, endDate?: Date): Promise<TimeEntryWithMember[]> {
    let conditions: any[] = [];
    
    if (startDate) {
      conditions.push(gte(timeEntries.startTime, startDate));
    }
    if (endDate) {
      conditions.push(sql`${timeEntries.startTime} <= ${endDate}`);
    }

    const entries = conditions.length > 0
      ? await db.select().from(timeEntries).where(and(...conditions)).orderBy(desc(timeEntries.startTime))
      : await db.select().from(timeEntries).orderBy(desc(timeEntries.startTime));

    const result: TimeEntryWithMember[] = [];
    for (const entry of entries) {
      const member = await this.getTeamMember(entry.teamMemberId);
      if (member) {
        result.push({ ...entry, teamMember: member });
      }
    }
    return result;
  }

  async createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry> {
    const [created] = await db.insert(timeEntries).values(entry).returning();
    return created;
  }

  async updateTimeEntry(id: string, updates: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const [updated] = await db
      .update(timeEntries)
      .set(updates)
      .where(eq(timeEntries.id, id))
      .returning();
    return updated || undefined;
  }

  async stopTimeEntry(id: string): Promise<TimeEntry | undefined> {
    const entry = await this.getTimeEntry(id);
    if (!entry) return undefined;

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - entry.startTime.getTime()) / 1000);

    const [updated] = await db
      .update(timeEntries)
      .set({
        endTime,
        duration,
        isActive: false,
      })
      .where(eq(timeEntries.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTimeEntry(id: string): Promise<boolean> {
    await db.delete(timeEntries).where(eq(timeEntries.id, id));
    return true;
  }

  async getMemberTimeStats(memberId: string, startDate?: Date, endDate?: Date): Promise<{
    totalSeconds: number;
    totalIdleSeconds: number;
    entriesCount: number;
  }> {
    let conditions = [eq(timeEntries.teamMemberId, memberId), eq(timeEntries.isActive, false)];
    
    if (startDate) {
      conditions.push(gte(timeEntries.startTime, startDate));
    }
    if (endDate) {
      conditions.push(sql`${timeEntries.startTime} <= ${endDate}`);
    }

    const result = await db
      .select({
        totalSeconds: sql<number>`coalesce(sum(${timeEntries.duration}), 0)`,
        totalIdleSeconds: sql<number>`coalesce(sum(${timeEntries.idleSeconds}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(timeEntries)
      .where(and(...conditions));

    return {
      totalSeconds: Number(result[0]?.totalSeconds ?? 0),
      totalIdleSeconds: Number(result[0]?.totalIdleSeconds ?? 0),
      entriesCount: Number(result[0]?.count ?? 0),
    };
  }

  async getActiveAppUsage(memberId: string): Promise<AppUsage | undefined> {
    const [usage] = await db
      .select()
      .from(appUsage)
      .where(and(eq(appUsage.teamMemberId, memberId), eq(appUsage.isActive, true)));
    return usage || undefined;
  }

  async getAppUsageByMember(memberId: string, startDate?: Date, endDate?: Date): Promise<AppUsage[]> {
    let conditions = [eq(appUsage.teamMemberId, memberId)];
    
    if (startDate) {
      conditions.push(gte(appUsage.startTime, startDate));
    }
    if (endDate) {
      conditions.push(sql`${appUsage.startTime} <= ${endDate}`);
    }

    return db
      .select()
      .from(appUsage)
      .where(and(...conditions))
      .orderBy(desc(appUsage.startTime));
  }

  async getAppUsageSummary(memberId: string, startDate?: Date, endDate?: Date): Promise<AppUsageSummary[]> {
    let conditions = [eq(appUsage.teamMemberId, memberId), eq(appUsage.isActive, false)];
    
    if (startDate) {
      conditions.push(gte(appUsage.startTime, startDate));
    }
    if (endDate) {
      conditions.push(sql`${appUsage.startTime} <= ${endDate}`);
    }

    const result = await db
      .select({
        appName: appUsage.appName,
        appType: appUsage.appType,
        totalDuration: sql<number>`coalesce(sum(${appUsage.durationSeconds}), 0)`,
        sessionCount: sql<number>`count(*)`,
      })
      .from(appUsage)
      .where(and(...conditions))
      .groupBy(appUsage.appName, appUsage.appType)
      .orderBy(sql`sum(${appUsage.durationSeconds}) desc`);

    return result.map(r => ({
      appName: r.appName,
      appType: r.appType,
      totalDuration: Number(r.totalDuration),
      sessionCount: Number(r.sessionCount),
    }));
  }

  async createAppUsage(usage: InsertAppUsage): Promise<AppUsage> {
    const [created] = await db.insert(appUsage).values(usage).returning();
    return created;
  }

  async updateAppUsage(id: string, updates: Partial<InsertAppUsage>): Promise<AppUsage | undefined> {
    const [updated] = await db
      .update(appUsage)
      .set(updates)
      .where(eq(appUsage.id, id))
      .returning();
    return updated || undefined;
  }

  async endAppUsage(id: string): Promise<AppUsage | undefined> {
    const [usage] = await db.select().from(appUsage).where(eq(appUsage.id, id));
    if (!usage) return undefined;

    const endTime = new Date();
    const durationSeconds = Math.floor((endTime.getTime() - usage.startTime.getTime()) / 1000);

    const [updated] = await db
      .update(appUsage)
      .set({
        endTime,
        durationSeconds,
        isActive: false,
      })
      .where(eq(appUsage.id, id))
      .returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();
