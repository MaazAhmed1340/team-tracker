import { Request, Response, NextFunction } from "express";

export type UserRole = "admin" | "manager" | "viewer";

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = req.user.role as UserRole;
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: "Insufficient permissions",
        required: allowedRoles,
        current: userRole,
      });
    }

    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole("admin")(req, res, next);
}

export function requireAdminOrManager(req: Request, res: Response, next: NextFunction) {
  return requireRole("admin", "manager")(req, res, next);
}

export function canManageTeamMembers(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canDeleteTeamMembers(role: UserRole): boolean {
  return role === "admin";
}

export function canManageSettings(role: UserRole): boolean {
  return role === "admin";
}

export function canViewReports(role: UserRole): boolean {
  // All authenticated users can view reports
  return role === "admin" || role === "manager" || role === "viewer";
}
