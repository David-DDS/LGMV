import { useListSystems } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { HealthBadge } from "@/components/health-badge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Server, Plus, ArrowRight, MapPin, Calendar, Layers, Radio } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
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

      {(!systems || systems.length === 0) ? (
        <Card className="border-dashed border-border/50 bg-transparent">
          <CardContent className="flex flex-col items-center justify-center p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/20 flex items-center justify-center mb-5">
              <Server className="h-8 w-8 text-muted-foreground/30" />
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {systems.map((system) => (
            <Link key={system.id} href={`/systems/${system.id}`}>
              <Card className="h-full border-border/50 bg-card hover:border-[rgba(255,98,0,0.4)] transition-all duration-300 hover:shadow-lg cursor-pointer group overflow-hidden relative">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(135deg, rgba(255,98,0,0.04) 0%, transparent 60%)' }} />
                <CardContent className="p-0">
                  {/* Card header */}
                  <div className="p-5 pb-4 border-b border-border/40">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(255,98,0,0.1)' }}>
                        <Server className="h-4 w-4" style={{ color: '#FF6200' }} />
                      </div>
                      <HealthBadge status={system.healthStatus} size="sm" />
                    </div>
                    <h3 className="font-bold text-sm text-foreground group-hover:text-white transition-colors leading-snug">
                      {system.name}
                    </h3>
                    <p className="text-[11px] font-mono text-muted-foreground mt-1">{system.code}</p>
                  </div>

                  {/* Card body */}
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

                  {/* Card footer */}
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
          ))}
        </div>
      )}
    </div>
  );
}

function SystemsListSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <Skeleton className="h-3 w-24 mb-3 bg-muted/40" />
          <Skeleton className="h-9 w-48 bg-muted/40" />
        </div>
        <Skeleton className="h-9 w-36 bg-muted/40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="border-border/50 bg-card">
            <CardContent className="p-5 pb-0 space-y-4">
              <div className="flex items-start justify-between">
                <Skeleton className="h-9 w-9 rounded-xl bg-muted/40" />
                <Skeleton className="h-5 w-16 rounded-full bg-muted/40" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-40 bg-muted/40" />
                <Skeleton className="h-3 w-24 bg-muted/40" />
              </div>
              <div className="space-y-2 pb-4">
                <Skeleton className="h-3 w-full bg-muted/40" />
                <Skeleton className="h-3 w-3/4 bg-muted/40" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
