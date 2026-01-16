import { format } from "date-fns";
import { X, ChevronLeft, ChevronRight, Eye, EyeOff, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ActivityBadge } from "@/components/activity-badge";
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  const blurMutation = useMutation({
    mutationFn: async ({ id, isBlurred }: { id: string; isBlurred: boolean }) => {
      return apiRequest("PATCH", `/api/screenshots/${id}/blur`, { isBlurred });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/screenshots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/screenshots/recent"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/screenshots/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/screenshots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/screenshots/recent"] });
      onClose();
    },
  });

  if (!screenshot) return null;

  const initials = screenshot.teamMember.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleBlurToggle = () => {
    blurMutation.mutate({ id: screenshot.id, isBlurred: !screenshot.isBlurred });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this screenshot?")) {
      deleteMutation.mutate(screenshot.id);
    }
  };

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
            <div className="relative">
              <img
                src={screenshot.imageUrl}
                alt={`Screenshot from ${screenshot.teamMember.name}`}
                className={cn(
                  "w-full h-auto max-h-[70vh] object-contain transition-all",
                  screenshot.isBlurred && "blur-xl"
                )}
              />
              {screenshot.isBlurred && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-white">
                    <EyeOff className="h-12 w-12" />
                    <span className="text-sm">Screenshot is blurred</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-96 w-full items-center justify-center bg-muted">
              <span className="text-muted-foreground">No preview available</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-4 p-4 bg-card flex-wrap">
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
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBlurToggle}
                disabled={blurMutation.isPending}
                data-testid="button-lightbox-blur"
              >
                {screenshot.isBlurred ? (
                  <>
                    <Eye className="h-4 w-4 mr-1" />
                    Unblur
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4 mr-1" />
                    Blur
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                data-testid="button-lightbox-delete"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
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
