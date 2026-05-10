import { useGetDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, Server, AlertTriangle, AlertCircle, ArrowRight, Calendar } from "lucide-react";
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
        <AlertCircle className="h-10 w-10 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Erro ao carregar painel</h2>
        <p className="text-muted-foreground">Verifique sua conexao e tente novamente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Painel de Monitoramento</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          Visao geral da saude de todos os sistemas VRF.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Total de Sistemas</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold">{dashboard.totalSystems}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Normal</CardTitle>
            <Activity className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-emerald-600 dark:text-emerald-400">{dashboard.healthySystems}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Alertas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-amber-600 dark:text-amber-400">{dashboard.warningSystems}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Criticos</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-red-600 dark:text-red-400">{dashboard.criticalSystems}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 pb-4">
          <div>
            <CardTitle className="text-base md:text-lg">Sessoes Recentes de Leitura</CardTitle>
            <CardDescription className="text-xs md:text-sm">Ultimas leituras LGMV realizadas nos sistemas.</CardDescription>
          </div>
          <Link href="/systems">
            <Button variant="outline" size="sm" className="hidden sm:flex">
              Ver todos os sistemas
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {dashboard.recentSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-muted-foreground font-medium">Nenhuma sessao encontrada.</p>
              <p className="text-sm text-muted-foreground/80 mt-1">Envie uma leitura LGMV para comecar.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {dashboard.recentSessions.map((session) => (
                <Link key={session.id} href={`/systems/${session.systemId}/sessions/${session.id}`}>
                  <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:block">
                        <HealthBadge status={session.healthStatus} />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">
                          Leitura de {format(new Date(session.sessionDate), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Sistema #{session.systemId} • Modo: <span className="capitalize">{session.mode === "cooling" ? "Refrigeracao" : "Aquecimento"}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="sm:hidden">
                        <HealthBadge status={session.healthStatus} showDot={false} className="text-[10px] px-1.5 py-0" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-9 w-64 mb-2" />
        <Skeleton className="h-5 w-80" />
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-6 w-20 rounded-full hidden sm:block" />
                  <div>
                    <Skeleton className="h-5 w-40 mb-1" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
