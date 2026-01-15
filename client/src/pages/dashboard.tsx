import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Users, Camera, Activity, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { ScreenshotCard } from "@/components/screenshot-card";
import { TeamMemberRow } from "@/components/team-member-row";
import { ActivityTimeline } from "@/components/activity-timeline";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { EmptyState } from "@/components/empty-state";
import {
  StatCardSkeleton,
  ScreenshotCardSkeleton,
  TeamMemberRowSkeleton,
  TimelineSkeleton,
} from "@/components/loading-skeleton";
import type { TeamMemberWithStats, ScreenshotWithMember } from "@shared/schema";

interface DashboardStats {
  activeUsers: number;
  totalScreenshots: number;
  averageActivity: number;
  topPerformer: string;
}

interface TimelineData {
  hour: number;
  activityLevel: "high" | "medium" | "low" | "none";
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [selectedScreenshot, setSelectedScreenshot] = useState<ScreenshotWithMember | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: screenshots, isLoading: screenshotsLoading } = useQuery<ScreenshotWithMember[]>({
    queryKey: ["/api/screenshots/recent"],
  });

  const { data: teamMembers, isLoading: membersLoading } = useQuery<TeamMemberWithStats[]>({
    queryKey: ["/api/team-members/with-stats"],
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery<TimelineData[]>({
    queryKey: ["/api/dashboard/timeline"],
  });

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
    <div className="flex flex-col gap-6 p-6" data-testid="page-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your team's activity in real-time
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Active Users"
              value={stats?.activeUsers ?? 0}
              subtitle="Currently online"
              icon={Users}
              trend={{ value: 12, isPositive: true }}
            />
            <StatCard
              title="Screenshots Today"
              value={stats?.totalScreenshots ?? 0}
              subtitle="Captured automatically"
              icon={Camera}
            />
            <StatCard
              title="Avg. Activity"
              value={`${stats?.averageActivity ?? 0}%`}
              subtitle="Team performance"
              icon={Activity}
              trend={{ value: 5, isPositive: true }}
            />
            <StatCard
              title="Top Performer"
              value={stats?.topPerformer ?? "N/A"}
              subtitle="Highest activity today"
              icon={TrendingUp}
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-lg font-medium">Activity Timeline</CardTitle>
          <span className="text-xs text-muted-foreground">Today</span>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-lg font-medium">Recent Screenshots</CardTitle>
            <button
              onClick={() => navigate("/screenshots")}
              className="text-xs text-primary hover:underline"
              data-testid="link-view-all-screenshots"
            >
              View all
            </button>
          </CardHeader>
          <CardContent>
            {screenshotsLoading ? (
              <div className="grid grid-cols-2 gap-3">
                <ScreenshotCardSkeleton />
                <ScreenshotCardSkeleton />
                <ScreenshotCardSkeleton />
                <ScreenshotCardSkeleton />
              </div>
            ) : screenshots && screenshots.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {screenshots.slice(0, 4).map((screenshot, index) => (
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
                description="Screenshots will appear here once your team starts working"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-lg font-medium">Team Status</CardTitle>
            <button
              onClick={() => navigate("/team")}
              className="text-xs text-primary hover:underline"
              data-testid="link-view-all-team"
            >
              View all
            </button>
          </CardHeader>
          <CardContent className="p-0">
            {membersLoading ? (
              <div className="divide-y">
                <TeamMemberRowSkeleton />
                <TeamMemberRowSkeleton />
                <TeamMemberRowSkeleton />
              </div>
            ) : teamMembers && teamMembers.length > 0 ? (
              <div className="divide-y">
                {teamMembers.slice(0, 5).map((member) => (
                  <TeamMemberRow
                    key={member.id}
                    member={member}
                    onClick={() => navigate(`/team/${member.id}`)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="No team members"
                description="Add team members to start monitoring their activity"
              />
            )}
          </CardContent>
        </Card>
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
