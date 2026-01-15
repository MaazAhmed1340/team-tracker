import { cn } from "@/lib/utils";

type Status = "online" | "idle" | "offline";

interface StatusIndicatorProps {
  status: Status;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const statusConfig = {
  online: {
    color: "bg-status-online",
    label: "Active",
  },
  idle: {
    color: "bg-status-away",
    label: "Idle",
  },
  offline: {
    color: "bg-status-offline",
    label: "Offline",
  },
};

const sizeConfig = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
};

export function StatusIndicator({
  status,
  showLabel = false,
  size = "md",
  className,
}: StatusIndicatorProps) {
  const config = statusConfig[status] || statusConfig.offline;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div
        className={cn("rounded-full", config.color, sizeConfig[size])}
        data-testid={`status-indicator-${status}`}
      />
      {showLabel && (
        <span className="text-xs text-muted-foreground">{config.label}</span>
      )}
    </div>
  );
}
