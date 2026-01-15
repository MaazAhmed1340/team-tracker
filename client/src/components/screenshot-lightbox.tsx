import { format } from "date-fns";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ActivityBadge } from "@/components/activity-badge";
import { cn } from "@/lib/utils";
import type { ScreenshotWithMember } from "@shared/schema";

interface ScreenshotLightboxProps {
  screenshot: ScreenshotWithMember | null;
  isOpen: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export function ScreenshotLightbox({
  screenshot,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
}: ScreenshotLightboxProps) {
  if (!screenshot) return null;

  const initials = screenshot.teamMember.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden">
        <div className="relative bg-black">
          {hasPrevious && (
            <Button
              size="icon"
              variant="secondary"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10"
              onClick={onPrevious}
              data-testid="button-lightbox-previous"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}
          {hasNext && (
            <Button
              size="icon"
              variant="secondary"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10"
              onClick={onNext}
              data-testid="button-lightbox-next"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}
          <Button
            size="icon"
            variant="secondary"
            className="absolute right-2 top-2 z-10"
            onClick={onClose}
            data-testid="button-lightbox-close"
          >
            <X className="h-4 w-4" />
          </Button>
          {screenshot.imageUrl ? (
            <img
              src={screenshot.imageUrl}
              alt={`Screenshot from ${screenshot.teamMember.name}`}
              className="w-full h-auto max-h-[70vh] object-contain"
            />
          ) : (
            <div className="flex h-96 w-full items-center justify-center bg-muted">
              <span className="text-muted-foreground">No preview available</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-4 p-4 bg-card">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={screenshot.teamMember.avatar || undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{screenshot.teamMember.name}</span>
              <span className="text-sm text-muted-foreground font-mono">
                {format(new Date(screenshot.capturedAt), "MMM d, yyyy 'at' HH:mm:ss")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-muted-foreground">Activity Score</span>
              <span className="text-lg font-bold">
                {Math.round(screenshot.activityScore)}%
              </span>
            </div>
            <ActivityBadge
              mouseClicks={screenshot.mouseClicks}
              keystrokes={screenshot.keystrokes}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
