import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ActivityBadge } from "@/components/activity-badge";
import { cn } from "@/lib/utils";
import type { ScreenshotWithMember } from "@shared/schema";

interface ScreenshotCardProps {
  screenshot: ScreenshotWithMember;
  onClick?: () => void;
  className?: string;
}

export function ScreenshotCard({
  screenshot,
  onClick,
  className,
}: ScreenshotCardProps) {
  const initials = screenshot.teamMember.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card
      className={cn(
        "group cursor-pointer overflow-hidden hover-elevate",
        className
      )}
      onClick={onClick}
      data-testid={`screenshot-card-${screenshot.id}`}
    >
      <div className="relative aspect-video bg-muted">
        {screenshot.imageUrl ? (
          <img
            src={screenshot.imageUrl}
            alt={`Screenshot from ${screenshot.teamMember.name}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-sm text-muted-foreground">No preview</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent invisible group-hover:visible" />
        <div className="absolute bottom-0 left-0 right-0 p-3 invisible group-hover:visible">
          <ActivityBadge
            mouseClicks={screenshot.mouseClicks}
            keystrokes={screenshot.keystrokes}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 p-3">
        <Avatar className="h-6 w-6">
          <AvatarImage src={screenshot.teamMember.avatar || undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-0.5 overflow-hidden">
          <span className="truncate text-sm font-medium">
            {screenshot.teamMember.name}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {format(new Date(screenshot.capturedAt), "HH:mm:ss")}
          </span>
        </div>
      </div>
    </Card>
  );
}
