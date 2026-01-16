import { format } from "date-fns";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ActivityBadge } from "@/components/activity-badge";
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ScreenshotWithMember } from "@shared/schema";

interface ScreenshotCardProps {
  screenshot: ScreenshotWithMember;
  onClick?: () => void;
  className?: string;
  showActions?: boolean;
}

export function ScreenshotCard({
  screenshot,
  onClick,
  className,
  showActions = true,
}: ScreenshotCardProps) {
  const initials = screenshot.teamMember.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const blurMutation = useMutation({
    mutationFn: async (isBlurred: boolean) => {
      return apiRequest("PATCH", `/api/screenshots/${screenshot.id}/blur`, { isBlurred });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/screenshots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/screenshots/recent"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/screenshots/${screenshot.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/screenshots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/screenshots/recent"] });
    },
  });

  const handleBlurToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    blurMutation.mutate(!screenshot.isBlurred);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this screenshot?")) {
      deleteMutation.mutate();
    }
  };

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
            className={cn(
              "h-full w-full object-cover transition-all",
              screenshot.isBlurred && "blur-xl"
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-sm text-muted-foreground">No preview</span>
          </div>
        )}
        {screenshot.isBlurred && (
          <div className="absolute inset-0 flex items-center justify-center">
            <EyeOff className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent invisible group-hover:visible" />
        
        {showActions && (
          <div className="absolute top-2 right-2 flex gap-1 invisible group-hover:visible">
            <Button
              size="icon"
              variant="secondary"
              className="h-7 w-7"
              onClick={handleBlurToggle}
              disabled={blurMutation.isPending}
              data-testid={`button-blur-${screenshot.id}`}
            >
              {screenshot.isBlurred ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              size="icon"
              variant="destructive"
              className="h-7 w-7"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-${screenshot.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        
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
