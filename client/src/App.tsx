// App.tsx
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useWebSocket } from "@/hooks/use-websocket";
import Login from "@/pages/login";
import Signup from "@/pages/Signup";  

import Dashboard from "@/pages/dashboard";
import Screenshots from "@/pages/screenshots";
import Team from "@/pages/team";
import TeamMemberDetail from "@/pages/team-member-detail";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import Download from "@/pages/download";
import NotFound from "@/pages/not-found";
import ProtectedRoute from "./Layout/protected-route";
import { AuthProvider } from "@/contexts/auth-context";
import { useEffect } from "react";

// ---------------- WebSocket Provider ----------------
function WebSocketProvider({ children }: { children: React.ReactNode }) {
  useWebSocket();
  return <>{children}</>;
}

// ---------------- App Layout ----------------
function AppLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 p-2 border-b bg-background sticky top-0 z-10">
            <SidebarTrigger />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

// ---------------- Redirect Component ----------------
function RedirectToDashboard() {
  const [, navigate] = useLocation();
  // Redirect on mount
  useEffect(() => {
    navigate("/dashboard");
  }, [navigate]);
  return null;
}

// ---------------- Router ----------------
function Router() {
  return (
    <Switch>
      {/* Public Route */}
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />

      {/* Redirect root "/" to dashboard */}
      <Route path="/" component={RedirectToDashboard} />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        component={() => (
          <ProtectedRoute component={() => <AppLayout><Dashboard /></AppLayout>} />
        )}
      />
      <Route
        path="/screenshots"
        component={() => (
          <ProtectedRoute component={() => <AppLayout><Screenshots /></AppLayout>} />
        )}
      />
      <Route
        path="/team"
        component={() => (
          <ProtectedRoute component={() => <AppLayout><Team /></AppLayout>} />
        )}
      />
      <Route
        path="/team/:id"
        component={() => (
          <ProtectedRoute component={() => <AppLayout><TeamMemberDetail /></AppLayout>} />
        )}
      />
      <Route
        path="/reports"
        component={() => (
          <ProtectedRoute component={() => <AppLayout><Reports /></AppLayout>} />
        )}
      />
      <Route
        path="/settings"
        component={() => (
          <ProtectedRoute component={() => <AppLayout><Settings /></AppLayout>} />
        )}
      />
      <Route
        path="/download"
        component={() => (
          <ProtectedRoute component={() => <AppLayout><Download /></AppLayout>} />
        )}
      />

      {/* Catch-all 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

// ---------------- App ----------------
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <WebSocketProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </WebSocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
