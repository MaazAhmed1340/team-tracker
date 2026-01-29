// client/src/hooks/use-permissions.ts
import { useAuth } from "@/contexts/auth-context";

// Define your roles
export type Role = "admin" | "manager" | "viewer";

export const usePermissions = () => {
  const { user } = useAuth();
  const role = user?.role as Role | undefined;

  const canAddMembers = role === "admin" || role === "manager";
  const canEditSettings = role === "admin";
  const canDeleteScreenshots = role === "admin";

  return {
    role,
    canAddMembers,
    canEditSettings,
    canDeleteScreenshots,
  };
};
