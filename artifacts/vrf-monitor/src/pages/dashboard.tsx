import { useGetDashboard } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Server, AlertTriangle, AlertCircle, ArrowRight, Calendar, TrendingUp } from "lucide-react";
import { HealthBadge } from "@/components/health-badge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2">
            Visao Geral
          </p>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
            Painel de Monitoramento
          </h1>
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
        {/* Total */}
        <Card className="border-border/50 bg-card col-span-2 xl:col-span-1 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5"
            style={{ background: 'linear-gradient(135deg, #FF6200 0%, transparent 70%)' }} />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Total</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,98,0,0.15)' }}>
                <Server className="h-4 w-4" style={{ color: '#FF6200' }} />
              </div>
            </div>
            <p className="text-4xl font-black text-foreground mb-1">{dashboard.totalSystems}</p>
            <p className="text-xs text-muted-foreground">Sistemas cadastrados</p>
          </CardContent>
        </Card>

        {/* Normal */}
        <Card className="border-border/50 bg-card relative overflow-hidden">
          <div className="absolute inset-0 opacity-5" style={{ background: 'linear-gradient(135deg, #22c55e 0%, transparent 70%)' }} />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Normal</p>
              <div className="w-8 h-8 rounded-lg bg-emerald-400/10 flex items-center justify-center">
                <Activity className="h-4 w-4 text-emerald-400" />
              </div>
            </div>
            <p className="text-4xl font-black text-emerald-400">{dashboard.healthySystems}</p>
            <p className="text-xs text-muted-foreground mt-1">Em operacao normal</p>
          </CardContent>
        </Card>

        {/* Alertas */}
        <Card className="border-border/50 bg-card relative overflow-hidden">
          <div className="absolute inset-0 opacity-5" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, transparent 70%)' }} />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Alertas</p>
              <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              </div>
            </div>
            <p className="text-4xl font-black text-amber-400">{dashboard.warningSystems}</p>
            <p className="text-xs text-muted-foreground mt-1">Requerem atencao</p>
          </CardContent>
        </Card>

        {/* Criticos */}
        <Card className="border-border/50 bg-card relative overflow-hidden">
          <div className="absolute inset-0 opacity-5" style={{ background: 'linear-gradient(135deg, #ef4444 0%, transparent 70%)' }} />
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Criticos</p>
              <div className="w-8 h-8 rounded-lg bg-red-400/10 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-red-400" />
              </div>
            </div>
            <p className="text-4xl font-black text-red-400">{dashboard.criticalSystems}</p>
            <p className="text-xs text-muted-foreground mt-1">Intervencao urgente</p>
          </CardContent>
        </Card>
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

      {/* Recent sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
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
    <div className="space-y-8">
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
    </div>
  );
}
