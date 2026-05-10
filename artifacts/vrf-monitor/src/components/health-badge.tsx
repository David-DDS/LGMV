import { cn } from "@/lib/utils";
import { getHealthColor, getHealthDotColor } from "@/lib/status-colors";
import { Badge } from "@/components/ui/badge";

interface HealthBadgeProps {
  status?: string | null;
  className?: string;
  showDot?: boolean;
}

export function HealthBadge({ status, className, showDot = true }: HealthBadgeProps) {
  const displayStatus = status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-medium border shadow-sm px-2.5 py-0.5", 
        getHealthColor(status),
        className
      )}
    >
      {showDot && (
        <span className={cn("w-1.5 h-1.5 rounded-full mr-2 shrink-0", getHealthDotColor(status))} />
      )}
      {displayStatus}
    </Badge>
  );
}
