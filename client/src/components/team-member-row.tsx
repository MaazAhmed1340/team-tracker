import { formatDistanceToNow } from "date-fns";
import { Play, Timer } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatusIndicator } from "@/components/status-indicator";
import { cn } from "@/lib/utils";
import type { TeamMemberWithStats } from "@shared/schema";

interface TeamMemberRowProps {
  member: TeamMemberWithStats;
  onClick?: () => void;
  className?: string;
}

export function TeamMemberRow({
  member,
  onClick,
  className,
}: TeamMemberRowProps) {
  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const status = (member.status as "online" | "idle" | "offline") || "offline";

  const formatTimeTracked = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-md p-3 hover-elevate cursor-pointer",
        className
      )}
      onClick={onClick}
      data-testid={`team-member-row-${member.id}`}
    >
      <div className="relative">
        <Avatar className="h-10 w-10">
          <AvatarImage src={member.avatar || undefined} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-background">
          <StatusIndicator status={status} size="sm" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{member.name}</span>
          <Badge variant="outline" className="text-xs">
            {member.role}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground truncate">
          {member.email}
        </span>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          {member.hasActiveTimer && (
            <div className="flex items-center gap-1 text-primary" data-testid="timer-active-indicator">
              <Play className="h-3 w-3 animate-pulse" />
            </div>
          )}
          {member.timeTrackedToday !== undefined && member.timeTrackedToday > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="time-tracked-today">
              <Timer className="h-3 w-3" />
              <span>{formatTimeTracked(member.timeTrackedToday)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Progress
            value={member.avgActivityScore}
            className="h-1.5 w-16"
          />
          <span className="text-xs font-medium w-8 text-right">
            {Math.round(member.avgActivityScore)}%
          </span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {member.lastActiveAt
            ? formatDistanceToNow(new Date(member.lastActiveAt), {
                addSuffix: true,
              })
            : "Never"}
        </span>
      </div>
    </div>
  );
}
