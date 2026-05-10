import { cn } from "@/lib/utils";

export const getHealthColor = (status?: string | null) => {
  switch (status) {
    case "healthy":
    case "normal":
      return "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-900";
    case "warning":
      return "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-900";
    case "critical":
      return "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-900";
    default:
      return "text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-900 dark:border-slate-800";
  }
};

export const getHealthDotColor = (status?: string | null) => {
  switch (status) {
    case "healthy":
    case "normal":
      return "bg-emerald-500";
    case "warning":
      return "bg-amber-500";
    case "critical":
      return "bg-red-500";
    default:
      return "bg-slate-400";
  }
};

export const getModeColor = (mode: string) => {
  if (mode === "cooling") {
    return "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-900";
  }
  if (mode === "heating") {
    return "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/30 dark:border-orange-900";
  }
  return "text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-900 dark:border-slate-800";
};
