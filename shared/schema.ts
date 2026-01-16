import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatar: text("avatar"),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("offline"),
  lastActiveAt: timestamp("last_active_at"),
  screenshotInterval: integer("screenshot_interval").notNull().default(5),
  isMonitoring: boolean("is_monitoring").notNull().default(true),
});

export const screenshots = pgTable("screenshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  capturedAt: timestamp("captured_at").notNull().default(sql`now()`),
  mouseClicks: integer("mouse_clicks").notNull().default(0),
  keystrokes: integer("keystrokes").notNull().default(0),
  activityScore: real("activity_score").notNull().default(0),
});

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  eventData: text("event_data"),
  recordedAt: timestamp("recorded_at").notNull().default(sql`now()`),
});

export const teamMembersRelations = relations(teamMembers, ({ many }) => ({
  screenshots: many(screenshots),
  activityLogs: many(activityLogs),
  timeEntries: many(timeEntries),
  appUsage: many(appUsage),
}));

export const screenshotsRelations = relations(screenshots, ({ one }) => ({
  teamMember: one(teamMembers, {
    fields: [screenshots.teamMemberId],
    references: [teamMembers.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  teamMember: one(teamMembers, {
    fields: [activityLogs.teamMemberId],
    references: [teamMembers.id],
  }),
}));

export const timeEntries = pgTable("time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"),
  project: text("project"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  idleSeconds: integer("idle_seconds").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  teamMember: one(teamMembers, {
    fields: [timeEntries.teamMemberId],
    references: [teamMembers.id],
  }),
}));

export const agentTokens = pgTable("agent_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  deviceName: text("device_name").notNull(),
  platform: text("platform").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const agentTokensRelations = relations(agentTokens, ({ one }) => ({
  teamMember: one(teamMembers, {
    fields: [agentTokens.teamMemberId],
    references: [teamMembers.id],
  }),
}));

export const appUsage = pgTable("app_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  appName: text("app_name").notNull(),
  appType: text("app_type").notNull().default("application"),
  windowTitle: text("window_title"),
  url: text("url"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const appUsageRelations = relations(appUsage, ({ one }) => ({
  teamMember: one(teamMembers, {
    fields: [appUsage.teamMemberId],
    references: [teamMembers.id],
  }),
}));

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  lastActiveAt: true,
});

export const insertScreenshotSchema = createInsertSchema(screenshots).omit({
  id: true,
  capturedAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  recordedAt: true,
});

export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;

export type InsertScreenshot = z.infer<typeof insertScreenshotSchema>;
export type Screenshot = typeof screenshots.$inferSelect;

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({
  id: true,
  createdAt: true,
});

export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;

export type TimeEntryWithMember = TimeEntry & {
  teamMember: TeamMember;
};

export type ScreenshotWithMember = Screenshot & {
  teamMember: TeamMember;
};

export type TeamMemberWithStats = TeamMember & {
  screenshotCount: number;
  avgActivityScore: number;
  lastScreenshot?: Screenshot;
  timeTrackedToday?: number;
  hasActiveTimer?: boolean;
};

export const insertAgentTokenSchema = createInsertSchema(agentTokens).omit({
  id: true,
  lastSeenAt: true,
  createdAt: true,
});

export type InsertAgentToken = z.infer<typeof insertAgentTokenSchema>;
export type AgentToken = typeof agentTokens.$inferSelect;

export type AgentTokenWithMember = AgentToken & {
  teamMember: TeamMember;
};

export const insertAppUsageSchema = createInsertSchema(appUsage).omit({
  id: true,
});

export type InsertAppUsage = z.infer<typeof insertAppUsageSchema>;
export type AppUsage = typeof appUsage.$inferSelect;

export type AppUsageSummary = {
  appName: string;
  appType: string;
  totalDuration: number;
  sessionCount: number;
};
