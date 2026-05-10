import { useGetDashboard } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Activity, Server, AlertTriangle, AlertCircle, ArrowRight,
  Calendar, TrendingUp, Building2, Droplets, Wind, ChevronRight,
} from "lucide-react";
import { HealthBadge } from "@/components/health-badge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({
  label, value, color, icon: Icon, hint, span,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ElementType;
  hint: string;
  span?: boolean;
}) {
  return (
    <Card className={`border-border/50 bg-card relative overflow-hidden ${span ? 'col-span-2 xl:col-span-1' : ''}`}>
      <div className="absolute inset-0 opacity-5" style={{ background: `linear-gradient(135deg, ${color} 0%, transparent 70%)` }} />
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}1a` }}>
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
        </div>
        <p className="text-4xl font-black" style={{ color }}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </CardContent>
    </Card>
  );
}

function CondensationTag({ type }: { type?: string | null }) {
  if (!type) return null;
  const isWater = type === "water";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${isWater ? "text-sky-400 bg-sky-400/10 border-sky-400/20" : "text-cyan-400 bg-cyan-400/10 border-cyan-400/20"}`}>
      {isWater ? <Droplets className="h-3 w-3" /> : <Wind className="h-3 w-3" />}
      {isWater ? "Cond. a Agua" : "Cond. a Ar"}
    </span>
  );
}

type BuildingSummary = {
  name: string;
  condensationType?: string | null;
  systemCount: number;
  healthySystems: number;
  warningSystems: number;
  criticalSystems: number;
  unknownSystems: number;
  systems: Array<{
    id: number;
    code: string;
    name: string;
    healthStatus?: string | null;
  }>;
};

function BuildingCard({ building }: { building: BuildingSummary }) {
  const healthPct = building.systemCount > 0
    ? Math.round((building.healthySystems / building.systemCount) * 100)
    : 0;
  const isUngrouped = building.name === "Sem Edificio";

  return (
    <Card className="border-border/50 bg-card hover:border-[rgba(255,98,0,0.3)] transition-all group overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/40 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted/30 border border-border/40 flex items-center justify-center shrink-0">
            <Building2 className="h-4.5 w-4.5 text-muted-foreground/70" style={{ width: '18px', height: '18px' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-black truncate ${isUngrouped ? 'text-muted-foreground/70' : 'text-foreground'}`}>{building.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-muted-foreground/60">
                {building.systemCount} sistema{building.systemCount !== 1 ? 's' : ''}
              </span>
              <CondensationTag type={building.condensationType} />
            </div>
          </div>
        </div>

        {/* Health distribution */}
        <div className="p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Saude</span>
            <span className={`text-xs font-bold ${healthPct >= 80 ? 'text-emerald-400' : healthPct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
              {healthPct}%
            </span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden bg-muted/30">
            {building.healthySystems > 0 && (
              <div className="bg-emerald-400" style={{ width: `${(building.healthySystems / building.systemCount) * 100}%` }} />
            )}
            {building.warningSystems > 0 && (
              <div className="bg-amber-400" style={{ width: `${(building.warningSystems / building.systemCount) * 100}%` }} />
            )}
            {building.criticalSystems > 0 && (
              <div className="bg-red-400" style={{ width: `${(building.criticalSystems / building.systemCount) * 100}%` }} />
            )}
            {building.unknownSystems > 0 && (
              <div className="bg-muted/50" style={{ width: `${(building.unknownSystems / building.systemCount) * 100}%` }} />
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="text-center p-2 rounded-lg bg-emerald-400/5 border border-emerald-400/10">
              <p className="text-base font-black text-emerald-400 leading-none">{building.healthySystems}</p>
              <p className="text-[9px] uppercase font-semibold text-emerald-400/70 mt-1 tracking-wide">Normal</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-amber-400/5 border border-amber-400/10">
              <p className="text-base font-black text-amber-400 leading-none">{building.warningSystems}</p>
              <p className="text-[9px] uppercase font-semibold text-amber-400/70 mt-1 tracking-wide">Alerta</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-red-400/5 border border-red-400/10">
              <p className="text-base font-black text-red-400 leading-none">{building.criticalSystems}</p>
              <p className="text-[9px] uppercase font-semibold text-red-400/70 mt-1 tracking-wide">Critico</p>
            </div>
          </div>

          {/* System list (compact) */}
          {building.systems.length > 0 && (
            <div className="pt-2 border-t border-border/30 space-y-1">
              {building.systems.slice(0, 3).map((s) => (
                <Link key={s.id} href={`/systems/${s.id}`}>
                  <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-muted/20 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        s.healthStatus === "healthy" ? "bg-emerald-400" :
                        s.healthStatus === "warning" ? "bg-amber-400" :
                        s.healthStatus === "critical" ? "bg-red-400" : "bg-muted-foreground/30"
                      }`} />
                      <span className="text-xs font-medium text-foreground/90 truncate">{s.name}</span>
                    </div>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                  </div>
                </Link>
              ))}
              {building.systems.length > 3 && (
                <Link href="/systems">
                  <div className="px-2 py-1.5 text-[11px] text-muted-foreground/60 hover:text-[#FF6200] transition-colors cursor-pointer">
                    + {building.systems.length - 3} sistema{building.systems.length - 3 !== 1 ? 's' : ''}
                  </div>
                </Link>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: dashboard, isLoading, error } = useGetDashboard();

  if (isLoading) return <DashboardSkeleton />;

  if (error || !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <div className="w-12 h-12 rounded-2xl bg-red-400/10 flex items-center justify-center mb-4">
          <AlertCircle className="h-6 w-6 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold mb-1">Erro ao carregar painel</h2>
        <p className="text-muted-foreground text-sm">Verifique sua conexao e tente novamente.</p>
      </div>
    );
  }

  const totalWithStatus = dashboard.healthySystems + dashboard.warningSystems + dashboard.criticalSystems;
  const healthPct = totalWithStatus > 0 ? Math.round((dashboard.healthySystems / totalWithStatus) * 100) : 0;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-3 duration-500">

      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2">Visao Geral</p>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">Painel de Monitoramento</h1>
        </div>
        <Link href="/systems">
          <Button variant="outline" size="sm" className="hidden sm:flex border-border/50 bg-card hover:bg-muted/30 text-muted-foreground hover:text-foreground">
            Ver todos os sistemas
            <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total" value={dashboard.totalSystems} color="#FF6200" icon={Server} hint="Sistemas cadastrados" span />
        <StatCard label="Normal" value={dashboard.healthySystems} color="#22c55e" icon={Activity} hint="Em operacao normal" />
        <StatCard label="Alertas" value={dashboard.warningSystems} color="#f59e0b" icon={AlertTriangle} hint="Requerem atencao" />
        <StatCard label="Criticos" value={dashboard.criticalSystems} color="#ef4444" icon={AlertCircle} hint="Intervencao urgente" />
      </div>

      {/* Health bar */}
      {totalWithStatus > 0 && (
        <Card className="border-border/50 bg-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Saude Geral da Frota</span>
              </div>
              <span className={`text-sm font-bold ${healthPct >= 80 ? 'text-emerald-400' : healthPct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                {healthPct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${healthPct}%`,
                  background: healthPct >= 80
                    ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                    : healthPct >= 50
                      ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                      : 'linear-gradient(90deg, #ef4444, #f87171)'
                }} />
            </div>
            <div className="flex gap-4 mt-3">
              <span className="text-xs text-emerald-400/70">{dashboard.healthySystems} normal</span>
              <span className="text-xs text-amber-400/70">{dashboard.warningSystems} alerta</span>
              <span className="text-xs text-red-400/70">{dashboard.criticalSystems} critico</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Buildings */}
      {dashboard.buildings && dashboard.buildings.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-bold">Edificios Monitorados</h2>
            </div>
            <span className="text-xs text-muted-foreground/60">
              {dashboard.buildings.length} edificio{dashboard.buildings.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.buildings.map((b) => <BuildingCard key={b.name} building={b as BuildingSummary} />)}
          </div>
        </div>
      )}

      {/* Recent sessions */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-bold">Sessoes Recentes de Leitura</h2>
          </div>
        </div>

        <Card className="border-border/50 bg-card overflow-hidden">
          {dashboard.recentSessions.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                <Calendar className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="font-semibold text-sm">Nenhuma sessao encontrada.</p>
              <p className="text-sm text-muted-foreground mt-1">Envie uma leitura LGMV para comecar.</p>
            </CardContent>
          ) : (
            <div>
              {dashboard.recentSessions.map((session, i) => (
                <Link key={session.id} href={`/systems/${session.systemId}/sessions/${session.id}`}>
                  <div className={`flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors cursor-pointer group ${i > 0 ? 'border-t border-border/40' : ''}`}>
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="hidden sm:flex flex-col items-center justify-center w-11 h-11 rounded-xl bg-muted/30 border border-border/40 shrink-0">
                        <span className="text-sm font-black text-foreground leading-none">
                          {format(new Date(session.sessionDate), "dd")}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-none mt-0.5">
                          {format(new Date(session.sessionDate), "MMM", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">
                          Leitura de {format(new Date(session.sessionDate), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Sistema #{session.systemId} • {session.mode === "cooling" ? "Refrigeracao" : "Aquecimento"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <HealthBadge status={session.healthStatus} size="sm" />
                      <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-10">
      <div>
        <Skeleton className="h-3 w-24 mb-3 bg-muted/40" />
        <Skeleton className="h-9 w-72 bg-muted/40" />
      </div>
      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="border-border/50 bg-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-3 w-16 bg-muted/40" />
                <Skeleton className="h-8 w-8 rounded-lg bg-muted/40" />
              </div>
              <Skeleton className="h-10 w-16 mb-1 bg-muted/40" />
              <Skeleton className="h-3 w-28 bg-muted/40" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2].map(i => <Skeleton key={i} className="h-72 rounded-xl bg-muted/40" />)}
      </div>
    </div>
  );
}
