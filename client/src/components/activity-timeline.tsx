import { cn } from "@/lib/utils";

interface TimelineSegment {
  hour: number;
  activityLevel: "high" | "medium" | "low" | "none";
}

interface ActivityTimelineProps {
  segments: TimelineSegment[];
  className?: string;
}

const activityColors = {
  high: "bg-status-online",
  medium: "bg-status-away",
  low: "bg-status-busy",
  none: "bg-muted",
};

export function ActivityTimeline({
  segments,
  className,
}: ActivityTimelineProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex gap-0.5">
        {hours.map((hour) => {
          const segment = segments.find((s) => s.hour === hour);
          const level = segment?.activityLevel || "none";
          return (
            <div
              key={hour}
              className={cn(
                "h-6 flex-1 rounded-sm transition-colors",
                activityColors[level]
              )}
              title={`${hour}:00 - ${level} activity`}
              data-testid={`timeline-hour-${hour}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground font-mono">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
}
