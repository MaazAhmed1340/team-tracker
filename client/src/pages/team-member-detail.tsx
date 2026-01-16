import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, Camera, Activity, Clock, Settings, Timer, Play, Pause, Monitor, Globe, Shield, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StatusIndicator } from "@/components/status-indicator";
import { ScreenshotCard } from "@/components/screenshot-card";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { ActivityTimeline } from "@/components/activity-timeline";
import { EmptyState } from "@/components/empty-state";
import {
  ScreenshotCardSkeleton,
  TimelineSkeleton,
} from "@/components/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TeamMember, ScreenshotWithMember, TimeEntry, AppUsage, AppUsageSummary } from "@shared/schema";

interface TimeStats {
  totalSeconds: number;
  totalIdleSeconds: number;
  entriesCount: number;
}

interface MemberStats {
  totalScreenshots: number;
  avgActivityScore: number;
  totalClicks: number;
  totalKeystrokes: number;
  activeHours: number;
}

interface TimelineData {
  hour: number;
  activityLevel: "high" | "medium" | "low" | "none";
}

interface AppUsageData {
  summary: AppUsageSummary[];
  activeApp: AppUsage | null;
}

interface PrivacySettings {
  blurScreenshots: boolean;
  trackApps: boolean;
  trackUrls: boolean;
  workHoursStart: string | null;
  workHoursEnd: string | null;
  workHoursTimezone: string;
  privacyMode: boolean;
}

export default function TeamMemberDetail() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/team/:id");
  const memberId = params?.id;
  const { toast } = useToast();

  const [selectedScreenshot, setSelectedScreenshot] = useState<ScreenshotWithMember | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const { data: member, isLoading: memberLoading } = useQuery<TeamMember>({
    queryKey: ["/api/team-members", memberId],
    enabled: !!memberId,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<MemberStats>({
    queryKey: ["/api/team-members", memberId, "stats"],
    enabled: !!memberId,
  });

  const { data: screenshots, isLoading: screenshotsLoading } = useQuery<ScreenshotWithMember[]>({
    queryKey: ["/api/screenshots", { memberId }],
    enabled: !!memberId,
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery<TimelineData[]>({
    queryKey: ["/api/team-members", memberId, "timeline"],
    enabled: !!memberId,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: timeStats, isLoading: timeStatsLoading } = useQuery<TimeStats>({
    queryKey: ["/api/team-members", memberId, "time-stats"],
    enabled: !!memberId,
  });

  const { data: timeEntries, isLoading: timeEntriesLoading } = useQuery<TimeEntry[]>({
    queryKey: ["/api/time-entries", { memberId }],
    enabled: !!memberId,
  });

  const { data: activeTimer } = useQuery<TimeEntry | null>({
    queryKey: ["/api/time-entries/active", memberId],
    enabled: !!memberId,
    refetchInterval: 60000,
  });

  const { data: appUsage, isLoading: appUsageLoading } = useQuery<AppUsageData>({
    queryKey: ["/api/team-members", memberId, "app-usage"],
    enabled: !!memberId,
    refetchInterval: 30000,
  });

  const { data: privacySettings, isLoading: privacyLoading } = useQuery<PrivacySettings>({
    queryKey: ["/api/team-members", memberId, "privacy"],
    enabled: !!memberId,
  });

  const privacyMutation = useMutation({
    mutationFn: async (updates: Partial<PrivacySettings>) => {
      return apiRequest("PATCH", `/api/team-members/${memberId}/privacy`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members", memberId, "privacy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team-members", memberId] });
      toast({
        title: "Privacy settings updated",
        description: "The changes have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update privacy settings.",
        variant: "destructive",
      });
    },
  });

  const handlePrivacyToggle = (key: keyof PrivacySettings, value: boolean) => {
    privacyMutation.mutate({ [key]: value });
  };

  const formatTimeTracked = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (!memberId) {
    navigate("/team");
    return null;
  }

  const initials = member?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "??";

  const status = (member?.status as "online" | "idle" | "offline") || "offline";

  const openLightbox = (screenshot: ScreenshotWithMember, index: number) => {
    setSelectedScreenshot(screenshot);
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setSelectedScreenshot(null);
  };

  const goToPrevious = () => {
    if (screenshots && lightboxIndex > 0) {
      const newIndex = lightboxIndex - 1;
      setLightboxIndex(newIndex);
      setSelectedScreenshot(screenshots[newIndex]);
    }
  };

  const goToNext = () => {
    if (screenshots && lightboxIndex < screenshots.length - 1) {
      const newIndex = lightboxIndex + 1;
      setLightboxIndex(newIndex);
      setSelectedScreenshot(screenshots[newIndex]);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="page-team-member-detail">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/team")}
          data-testid="button-back-to-team"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {memberLoading ? <Skeleton className="h-9 w-48" /> : member?.name}
          </h1>
          {memberLoading ? (
            <Skeleton className="h-5 w-64 mt-1" />
          ) : (
            <p className="text-muted-foreground">Team member activity details</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {timelineLoading ? (
                <TimelineSkeleton />
              ) : timeline && timeline.length > 0 ? (
                <ActivityTimeline segments={timeline} />
              ) : (
                <ActivityTimeline segments={[]} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-lg font-medium">Recent Screenshots</CardTitle>
              <span className="text-xs text-muted-foreground">
                {screenshots?.length ?? 0} total
              </span>
            </CardHeader>
            <CardContent>
              {screenshotsLoading ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <ScreenshotCardSkeleton key={i} />
                  ))}
                </div>
              ) : screenshots && screenshots.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {screenshots.slice(0, 9).map((screenshot, index) => (
                    <ScreenshotCard
                      key={screenshot.id}
                      screenshot={screenshot}
                      onClick={() => openLightbox(screenshot, index)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Camera}
                  title="No screenshots yet"
                  description="Screenshots will appear here once this team member starts working"
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="p-6">
              {memberLoading ? (
                <div className="flex flex-col items-center gap-4">
                  <Skeleton className="h-20 w-20 rounded-full" />
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={member?.avatar || undefined} />
                      <AvatarFallback className="text-xl">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 rounded-full border-4 border-card">
                      <StatusIndicator status={status} size="lg" />
                    </div>
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-semibold">{member?.name}</h2>
                    <p className="text-sm text-muted-foreground">{member?.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{member?.role}</Badge>
                    <StatusIndicator status={status} showLabel />
                  </div>
                  {member?.lastActiveAt && (
                    <p className="text-xs text-muted-foreground">
                      Last active{" "}
                      {formatDistanceToNow(new Date(member.lastActiveAt), {
                        addSuffix: true,
                      })}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Statistics</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {statsLoading ? (
                <>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-6 w-12" />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Camera className="h-4 w-4" />
                      Screenshots
                    </div>
                    <span className="font-semibold">{stats?.totalScreenshots ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Activity className="h-4 w-4" />
                      Avg. Activity
                    </div>
                    <span className="font-semibold">
                      {Math.round(stats?.avgActivityScore ?? 0)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Active Hours
                    </div>
                    <span className="font-semibold">{stats?.activeHours ?? 0}h</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Activity Score</span>
                      <span className="font-medium">
                        {Math.round(stats?.avgActivityScore ?? 0)}%
                      </span>
                    </div>
                    <Progress value={stats?.avgActivityScore ?? 0} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-medium">
                <Settings className="h-4 w-4" />
                Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent>
              {memberLoading ? (
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Screenshot Interval</span>
                    <span className="font-medium">
                      Every {member?.screenshotInterval ?? 5} min
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Monitoring</span>
                    <Badge variant={member?.isMonitoring ? "default" : "secondary"}>
                      {member?.isMonitoring ? "Active" : "Paused"}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-time-tracking">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-medium">
                <Timer className="h-4 w-4" />
                Time Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeStatsLoading ? (
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {activeTimer && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <Play className="h-4 w-4 text-primary animate-pulse" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Timer Running</p>
                        <p className="text-xs text-muted-foreground">
                          {activeTimer.project || "No project"} - Started{" "}
                          {formatDistanceToNow(new Date(activeTimer.startTime), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Time Today</span>
                      <span className="font-semibold text-lg">
                        {formatTimeTracked(timeStats?.totalSeconds ?? 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Idle Time</span>
                      <span className="font-medium text-orange-500">
                        {formatTimeTracked(timeStats?.totalIdleSeconds ?? 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Entries</span>
                      <span className="font-medium">{timeStats?.entriesCount ?? 0}</span>
                    </div>
                  </div>
                  {timeEntries && timeEntries.length > 0 && (
                    <div className="border-t pt-3 mt-2">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Recent Entries</p>
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                        {timeEntries.slice(0, 5).map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between text-xs p-2 rounded bg-muted/50"
                            data-testid={`time-entry-${entry.id}`}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{entry.project || "No project"}</span>
                              <span className="text-muted-foreground">
                                {format(new Date(entry.startTime), "MMM d, h:mm a")}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-semibold">
                                {entry.duration ? formatTimeTracked(entry.duration) : "-"}
                              </span>
                              {entry.isActive && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  Active
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-app-usage">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-medium">
                <Monitor className="h-4 w-4" />
                App Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appUsageLoading ? (
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {appUsage?.activeApp && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      {appUsage.activeApp.appType === "website" ? (
                        <Globe className="h-4 w-4 text-green-500" />
                      ) : (
                        <Monitor className="h-4 w-4 text-green-500" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{appUsage.activeApp.appName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {appUsage.activeApp.windowTitle || "Active now"}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">Now</Badge>
                    </div>
                  )}
                  {appUsage?.summary && appUsage.summary.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium text-muted-foreground">Today's Usage</p>
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                        {appUsage.summary.slice(0, 8).map((app, index) => (
                          <div
                            key={`${app.appName}-${index}`}
                            className="flex items-center justify-between text-xs p-2 rounded bg-muted/50"
                            data-testid={`app-usage-${index}`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {app.appType === "website" ? (
                                <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                              ) : (
                                <Monitor className="h-3 w-3 text-muted-foreground shrink-0" />
                              )}
                              <span className="font-medium truncate">{app.appName}</span>
                            </div>
                            <span className="font-semibold shrink-0 ml-2">
                              {formatTimeTracked(app.totalDuration)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      icon={Monitor}
                      title="No app data yet"
                      description="App usage will appear here once tracking begins"
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-privacy-settings">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-medium">
                <Shield className="h-4 w-4" />
                Privacy Settings
              </CardTitle>
              <CardDescription className="text-xs">
                Configure monitoring and privacy options for this member
              </CardDescription>
            </CardHeader>
            <CardContent>
              {privacyLoading ? (
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      {privacySettings?.privacyMode ? (
                        <EyeOff className="h-4 w-4 text-orange-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <Label className="text-sm font-medium">Privacy Mode</Label>
                        <p className="text-xs text-muted-foreground">Pause all monitoring temporarily</p>
                      </div>
                    </div>
                    <Switch
                      checked={privacySettings?.privacyMode ?? false}
                      onCheckedChange={(checked) => handlePrivacyToggle("privacyMode", checked)}
                      disabled={privacyMutation.isPending}
                      data-testid="switch-privacy-mode"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <Label className="text-sm font-medium">Blur Screenshots</Label>
                      <p className="text-xs text-muted-foreground">Auto-blur new screenshots</p>
                    </div>
                    <Switch
                      checked={privacySettings?.blurScreenshots ?? false}
                      onCheckedChange={(checked) => handlePrivacyToggle("blurScreenshots", checked)}
                      disabled={privacyMutation.isPending}
                      data-testid="switch-blur-screenshots"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <Label className="text-sm font-medium">Track Applications</Label>
                      <p className="text-xs text-muted-foreground">Monitor active applications</p>
                    </div>
                    <Switch
                      checked={privacySettings?.trackApps ?? true}
                      onCheckedChange={(checked) => handlePrivacyToggle("trackApps", checked)}
                      disabled={privacyMutation.isPending}
                      data-testid="switch-track-apps"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <Label className="text-sm font-medium">Track URLs</Label>
                      <p className="text-xs text-muted-foreground">Monitor browser URLs</p>
                    </div>
                    <Switch
                      checked={privacySettings?.trackUrls ?? true}
                      onCheckedChange={(checked) => handlePrivacyToggle("trackUrls", checked)}
                      disabled={privacyMutation.isPending}
                      data-testid="switch-track-urls"
                    />
                  </div>

                  {privacySettings?.privacyMode && (
                    <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                      <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                        Privacy mode is active. No data is being collected for this member.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ScreenshotLightbox
        screenshot={selectedScreenshot}
        isOpen={!!selectedScreenshot}
        onClose={closeLightbox}
        onPrevious={goToPrevious}
        onNext={goToNext}
        hasPrevious={lightboxIndex > 0}
        hasNext={screenshots ? lightboxIndex < screenshots.length - 1 : false}
      />
    </div>
  );
}
