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

export type ScreenshotWithMember = Screenshot & {
  teamMember: TeamMember;
};

export type TeamMemberWithStats = TeamMember & {
  screenshotCount: number;
  avgActivityScore: number;
  lastScreenshot?: Screenshot;
};
