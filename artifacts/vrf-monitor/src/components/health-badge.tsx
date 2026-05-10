import { cn } from "@/lib/utils";
import { getHealthColor, getHealthDotColor } from "@/lib/status-colors";

interface HealthBadgeProps {
  status?: string | null;
  className?: string;
  showDot?: boolean;
  size?: "sm" | "md";
}

const STATUS_LABELS: Record<string, string> = {
  healthy: "Normal",
  warning: "Alerta",
  critical: "Critico",
  normal: "Normal",
};

export function HealthBadge({ status, className, showDot = true, size = "md" }: HealthBadgeProps) {
  const displayStatus = status ? (STATUS_LABELS[status] ?? status) : "Desconhecido";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide uppercase",
        size === "sm" ? "text-[9px] px-2 py-0.5" : "text-[10px] px-2.5 py-1",
        getHealthColor(status),
        className
      )}
    >
      {showDot && (
        <span className={cn("rounded-full shrink-0 pulse-dot", size === "sm" ? "w-1 h-1" : "w-1.5 h-1.5", getHealthDotColor(status))} />
      )}
      {displayStatus}
    </span>
  );
}
