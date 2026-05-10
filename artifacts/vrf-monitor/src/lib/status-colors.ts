export const getHealthColor = (status?: string | null) => {
  switch (status) {
    case "healthy":
    case "normal":
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "warning":
      return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case "critical":
      return "text-red-400 bg-red-400/10 border-red-400/20";
    default:
      return "text-slate-400 bg-slate-400/10 border-slate-400/20";
  }
};

export const getHealthDotColor = (status?: string | null) => {
  switch (status) {
    case "healthy":
    case "normal":
      return "bg-emerald-400";
    case "warning":
      return "bg-amber-400";
    case "critical":
      return "bg-red-400";
    default:
      return "bg-slate-500";
  }
};

export const getModeColor = (mode: string) => {
  if (mode === "cooling") {
    return "text-sky-400 bg-sky-400/10 border-sky-400/20";
  }
  if (mode === "heating") {
    return "text-orange-400 bg-orange-400/10 border-orange-400/20";
  }
  return "text-slate-400 bg-slate-400/10 border-slate-400/20";
};
