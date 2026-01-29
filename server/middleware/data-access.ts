import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users, teamMembers } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function getTeamMemberIdForUser(userId: string): Promise<string | null> {
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));
  return member?.id || null;
}

export async function canAccessTeamMember(
  requestingUserId: string,
  targetMemberId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const [requestingUser] = await db.select().from(users).where(eq(users.id, requestingUserId));
  if (!requestingUser) {
    return { allowed: false, reason: "User not found" };
  }

  const [targetMember] = await db
    .select({ teamMember: teamMembers, user: users })
    .from(teamMembers)
    .leftJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.id, targetMemberId));

  if (!targetMember) {
    return { allowed: false, reason: "Team member not found" };
  }

  if (requestingUser.role === "admin" || requestingUser.role === "manager") {
    if (targetMember.user?.companyId === requestingUser.companyId) {
      return { allowed: true };
    }
    return { allowed: false, reason: "Team member belongs to a different company" };
  }

  const [requestingMember] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, requestingUserId));

  if (requestingMember?.id === targetMemberId) {
    return { allowed: true };
  }

  return { allowed: false, reason: "You can only access your own data" };
}

export function requireTeamMemberAccess(paramName = "id") {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const memberId = req.params[paramName];
    if (!memberId) {
      return res.status(400).json({ error: "Team member ID required" });
    }

    const access = await canAccessTeamMember(req.user.id, memberId);
    if (!access.allowed) {
      return res.status(403).json({ error: access.reason || "Access denied" });
    }

    next();
  };
}

export function requireSameCompany(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}
