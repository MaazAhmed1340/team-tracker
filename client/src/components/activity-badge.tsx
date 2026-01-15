import { Badge } from "@/components/ui/badge";
import { MousePointerClick, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityBadgeProps {
  mouseClicks?: number;
  keystrokes?: number;
  className?: string;
}

export function ActivityBadge({
  mouseClicks,
  keystrokes,
  className,
}: ActivityBadgeProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {mouseClicks !== undefined && (
        <Badge variant="secondary" className="gap-1 text-xs">
          <MousePointerClick className="h-3 w-3" />
          {mouseClicks}
        </Badge>
      )}
      {keystrokes !== undefined && (
        <Badge variant="secondary" className="gap-1 text-xs">
          <Keyboard className="h-3 w-3" />
          {keystrokes}
        </Badge>
      )}
    </div>
  );
}
