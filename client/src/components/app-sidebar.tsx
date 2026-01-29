import { useLocation, Link } from "wouter";
import { LayoutDashboard, Camera, Users, Settings, Monitor, Download, BarChart3, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Screenshots",
    url: "/screenshots",
    icon: Camera,
  },
  {
    title: "Team",
    url: "/team",
    icon: Users,
    adminOnly: true,
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
    adminOnly: true,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    adminOnly: true,
  },
  {
    title: "Download",
    url: "/download",
    icon: Download,
  },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdminOrManager);

  const handleLogout = async () => {
    try {
      const stored = localStorage.getItem("auth");
      if (stored) {
        const { accessToken } = JSON.parse(stored);
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      logout();
      setLocation("/login");
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Monitor className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">TeamTrack</span>
            <span className="text-xs text-muted-foreground">Remote Monitoring</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-3">
        {user && (
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="font-medium truncate">{user.email}</span>
            <span className="capitalize">{user.role}</span>
          </div>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-start gap-2"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="status-system-online">
          <div className="h-2 w-2 rounded-full bg-status-online" />
          <span>System Online</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
