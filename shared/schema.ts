import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, real, index, pgEnum, decimal, json, unique, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ============ COMPANIES (Multi-tenant) ============
export const companies = pgTable("companies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  website: varchar("website", { length: 255 }),
  logoUrl: text("logo_url"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============ USERS (Multi-tenant scoped) ============
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    password: text("password").notNull(),
    refreshToken: text("refresh_token"),
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    role: varchar("role", { length: 50 }).default("member"), // admin, member
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [unique("email_company_unique").on(table.email, table.companyId)]
);

// ============ BILLING & SUBSCRIPTIONS ============
export const billingSubscriptions = pgTable("billing_subscriptions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }).unique(),
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull(), // active, past_due, canceled, trialing
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  canceledAt: timestamp("canceled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============ USAGE TRACKING (for metered billing) ============
export const usageMetrics = pgTable("usage_metrics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  metricType: varchar("metric_type", { length: 100 }).notNull(), // "active_users", "api_calls", etc.
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  billingPeriod: varchar("billing_period", { length: 50 }).notNull(), // "2024-01"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userRoleEnum = pgEnum("user_role", ["admin", "manager", "viewer"]);

export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatar: text("avatar"),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("offline"),
  lastActiveAt: timestamp("last_active_at"),
  screenshotInterval: integer("screenshot_interval").notNull().default(5),
  isMonitoring: boolean("is_monitoring").notNull().default(true),
  blurScreenshots: boolean("blur_screenshots").notNull().default(false),
  trackApps: boolean("track_apps").notNull().default(true),
  trackUrls: boolean("track_urls").notNull().default(true),
  workHoursStart: text("work_hours_start"),
  workHoursEnd: text("work_hours_end"),
  workHoursTimezone: text("work_hours_timezone").default("UTC"),
  privacyMode: boolean("privacy_mode").notNull().default(false),
}, (table) => ({
  userIdIdx: index("team_members_user_id_idx").on(table.userId),
}));

export const screenshots = pgTable("screenshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  capturedAt: timestamp("captured_at").notNull().default(sql`now()`),
  mouseClicks: integer("mouse_clicks").notNull().default(0),
  keystrokes: integer("keystrokes").notNull().default(0),
  activityScore: real("activity_score").notNull().default(0),
  isBlurred: boolean("is_blurred").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
});

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  eventData: text("event_data"),
  recordedAt: timestamp("recorded_at").notNull().default(sql`now()`),
});

export const usersRelations = relations(users, ({ one }) => ({
  teamMember: one(teamMembers),
}));

export const teamMembersRelations = relations(teamMembers, ({ one, many }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
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

const agentTimerStartSchema = z.object({
  project: z.string().optional(),
  notes: z.string().optional(),
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

export const userRoleSchema = z.enum(["admin", "manager", "viewer"]);

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

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true, updatedAt: true });
export const selectCompanySchema = createSelectSchema(companies);

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const selectUserSchema = createSelectSchema(users);

export const insertBillingSubscriptionSchema = createInsertSchema(billingSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const selectBillingSubscriptionSchema = createSelectSchema(billingSubscriptions);

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type BillingSubscription = typeof billingSubscriptions.$inferSelect;
export type InsertBillingSubscription = z.infer<typeof insertBillingSubscriptionSchema>;
