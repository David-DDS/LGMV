import { useListSystems } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { HealthBadge } from "@/components/health-badge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Server, Plus, ArrowRight, MapPin, Calendar, Layers, Radio,
  Building2, Droplets, Wind, ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type System = {
  id: number;
  code: string;
  name: string;
  location?: string | null;
  floor?: string | null;
  servedArea?: string | null;
  model?: string | null;
  vrfType: string;
  building?: string | null;
  condensationType?: string | null;
  healthStatus?: string | null;
  lastReadingDate?: string | null;
};

function CondensationBadge({ type }: { type?: string | null }) {
  if (!type) return null;
  const isWater = type === "water";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${isWater ? "text-sky-400 bg-sky-400/10 border-sky-400/20" : "text-cyan-400 bg-cyan-400/10 border-cyan-400/20"}`}>
      {isWater ? <Droplets className="h-3 w-3" /> : <Wind className="h-3 w-3" />}
      {isWater ? "Cond. a Agua" : "Cond. a Ar"}
    </span>
  );
}

function SystemCard({ system }: { system: System }) {
  return (
    <Link href={`/systems/${system.id}`}>
      <Card className="h-full border-border/50 bg-card hover:border-[rgba(255,98,0,0.4)] transition-all duration-300 hover:shadow-lg cursor-pointer group overflow-hidden relative">
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: 'linear-gradient(135deg, rgba(255,98,0,0.04) 0%, transparent 60%)' }} />
        <CardContent className="p-0">
          <div className="p-5 pb-4 border-b border-border/40">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,98,0,0.1)' }}>
                <Server className="h-4 w-4" style={{ color: '#FF6200' }} />
              </div>
              <HealthBadge status={system.healthStatus} size="sm" />
            </div>
            <h3 className="font-bold text-sm text-foreground group-hover:text-white transition-colors leading-snug">{system.name}</h3>
            <p className="text-[11px] font-mono text-muted-foreground mt-1">{system.code}</p>
          </div>
          <div className="p-5 pt-4 space-y-2.5">
            {system.location && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span className="line-clamp-1">{system.location}</span>
              </div>
            )}
            {system.floor && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Layers className="h-3.5 w-3.5 shrink-0" />
                <span>Andar: <span className="text-foreground/80">{system.floor}</span></span>
              </div>
            )}
            {system.servedArea && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Radio className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span className="line-clamp-1">{system.servedArea}</span>
              </div>
            )}
            {system.model && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Server className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono">{system.model}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                {system.lastReadingDate
                  ? format(new Date(system.lastReadingDate), "d MMM yyyy", { locale: ptBR })
                  : "Sem leituras"}
              </span>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/50">
              {system.vrfType.replace(/_/g, " ")}
            </span>
            <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground/40 group-hover:text-[#FF6200] transition-colors">
              Ver detalhes <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function BuildingGroup({ building, systems }: { building: string; systems: System[] }) {
  const condensationType = systems[0]?.condensationType;
  const healthCounts = {
    healthy: systems.filter(s => s.healthStatus === "healthy").length,
    warning: systems.filter(s => s.healthStatus === "warning").length,
    critical: systems.filter(s => s.healthStatus === "critical").length,
  };

  return (
    <div className="space-y-4">
      {/* Building header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted/30 border border-border/40 shrink-0">
          <Building2 className="h-4.5 w-4.5 text-muted-foreground/60" style={{ width: '18px', height: '18px' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-black tracking-tight text-foreground">{building}</h2>
            {condensationType && <CondensationBadge type={condensationType} />}
            <span className="text-xs text-muted-foreground/50">{systems.length} sistema{systems.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {healthCounts.healthy > 0 && <span className="text-[11px] text-emerald-400/70">{healthCounts.healthy} normal</span>}
            {healthCounts.warning > 0 && <span className="text-[11px] text-amber-400/70">{healthCounts.warning} alerta</span>}
            {healthCounts.critical > 0 && <span className="text-[11px] text-red-400/70">{healthCounts.critical} critico</span>}
          </div>
        </div>
        <Link href={`/systems/new`}>
          <button className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground/40 hover:text-[#FF6200] transition-colors">
            <Plus className="h-3.5 w-3.5" />
            Adicionar sistema
          </button>
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground/20 shrink-0" />
      </div>

      {/* Divider line */}
      <div className="h-px bg-gradient-to-r from-border/60 via-border/20 to-transparent" />

      {/* System cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {systems.map(system => <SystemCard key={system.id} system={system} />)}
      </div>
    </div>
  );
}

export default function SystemsList() {
  const { data: systems, isLoading, error } = useListSystems();

  if (isLoading) return <SystemsListSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <h2 className="text-lg font-semibold mb-2">Erro ao carregar sistemas</h2>
        <p className="text-muted-foreground text-sm">Tente novamente mais tarde.</p>
      </div>
    );
  }

  // Group systems by building
  const grouped = new Map<string, System[]>();
  const ungrouped: System[] = [];

  (systems ?? []).forEach(s => {
    const b = s.building?.trim();
    if (b) {
      if (!grouped.has(b)) grouped.set(b, []);
      grouped.get(b)!.push(s);
    } else {
      ungrouped.push(s);
    }
  });

  const hasAny = (systems?.length ?? 0) > 0;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2">Infraestrutura</p>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">Sistemas VRF</h1>
        </div>
        <Link href="/systems/new">
          <Button size="sm" className="font-semibold" style={{ background: 'linear-gradient(135deg, #FF6200, #FF8C42)' }}>
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Cadastrar Sistema</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </Link>
      </div>

      {/* Empty state */}
      {!hasAny && (
        <Card className="border-dashed border-border/50 bg-transparent">
          <CardContent className="flex flex-col items-center justify-center p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/20 flex items-center justify-center mb-5">
              <Building2 className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <h3 className="text-base font-bold mb-1.5">Nenhum sistema cadastrado</h3>
            <p className="text-muted-foreground mb-6 max-w-xs text-sm leading-relaxed">
              Cadastre o primeiro sistema VRF para iniciar o monitoramento preditivo.
            </p>
            <Link href="/systems/new">
              <Button style={{ background: 'linear-gradient(135deg, #FF6200, #FF8C42)' }} className="font-semibold">
                Cadastrar Primeiro Sistema
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Buildings */}
      {Array.from(grouped.entries()).map(([building, buildingSystems]) => (
        <BuildingGroup key={building} building={building} systems={buildingSystems} />
      ))}

      {/* Ungrouped systems */}
      {ungrouped.length > 0 && (
        <div className="space-y-4">
          {grouped.size > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted/20 border border-border/30 shrink-0">
                <Server className="h-4 w-4 text-muted-foreground/40" />
              </div>
              <div>
                <h2 className="text-base font-black tracking-tight text-foreground/60">Outros Sistemas</h2>
                <p className="text-xs text-muted-foreground/40 mt-0.5">{ungrouped.length} sistema{ungrouped.length !== 1 ? 's' : ''} sem edificio</p>
              </div>
              <div className="h-px flex-1 bg-border/30" />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ungrouped.map(system => <SystemCard key={system.id} system={system} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function SystemsListSkeleton() {
  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between">
        <div><Skeleton className="h-3 w-24 mb-3 bg-muted/40" /><Skeleton className="h-9 w-48 bg-muted/40" /></div>
        <Skeleton className="h-9 w-36 bg-muted/40" />
      </div>
      {[0, 1].map(g => (
        <div key={g} className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl bg-muted/40" />
            <div><Skeleton className="h-5 w-40 mb-1 bg-muted/40" /><Skeleton className="h-3 w-24 bg-muted/40" /></div>
          </div>
          <div className="h-px bg-border/30" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2].map(i => (
              <Card key={i} className="border-border/50 bg-card">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-9 w-9 rounded-xl bg-muted/40" />
                    <Skeleton className="h-5 w-16 rounded-full bg-muted/40" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40 bg-muted/40" />
                    <Skeleton className="h-3 w-24 bg-muted/40" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-full bg-muted/40" />
                    <Skeleton className="h-3 w-3/4 bg-muted/40" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
