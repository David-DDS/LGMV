import { useListSystems } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        <h2 className="text-xl font-semibold mb-2">Erro ao carregar sistemas</h2>
        <p className="text-muted-foreground">Tente novamente mais tarde.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Sistemas VRF</h1>
          <p className="text-muted-foreground mt-1 text-sm">Gerencie e monitore todas as unidades cadastradas.</p>
        </div>
        <Link href="/systems/new">
          <Button size="sm" className="md:size-default">
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Cadastrar Sistema</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </Link>
      </div>

      {(!systems || systems.length === 0) ? (
        <Card className="border-dashed border-2 bg-transparent shadow-none">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Server className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">Nenhum sistema cadastrado</h3>
            <p className="text-muted-foreground mb-6 max-w-sm text-sm">
              Cadastre o primeiro sistema VRF para iniciar o monitoramento.
            </p>
            <Link href="/systems/new">
              <Button>Cadastrar Primeiro Sistema</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {systems.map((system) => (
            <Link key={system.id} href={`/systems/${system.id}`}>
              <Card className="h-full hover:border-primary/50 transition-all hover:shadow-md cursor-pointer group shadow-sm">
                <CardHeader className="pb-3 border-b bg-muted/10">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base group-hover:text-primary transition-colors truncate">
                        {system.name}
                      </CardTitle>
                      <CardDescription className="font-mono text-xs mt-1">{system.code}</CardDescription>
                    </div>
                    <HealthBadge status={system.healthStatus} />
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-2.5">
                  {system.location && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="mr-2 h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{system.location}</span>
                    </div>
                  )}
                  {system.floor && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Layers className="mr-2 h-3.5 w-3.5 shrink-0" />
                      <span>Andar: {system.floor}</span>
                    </div>
                  )}
                  {system.servedArea && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Radio className="mr-2 h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Atende: {system.servedArea}</span>
                    </div>
                  )}
                  {system.model && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Server className="mr-2 h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Modelo: {system.model}</span>
                    </div>
                  )}
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="mr-2 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {system.lastReadingDate
                        ? `Ultima leitura: ${format(new Date(system.lastReadingDate), "d MMM yyyy", { locale: ptBR })}`
                        : "Sem leituras"}
                    </span>
                  </div>
                  <div className="pt-1 flex items-center text-sm font-medium text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                    Ver Detalhes <ArrowRight className="ml-1 h-4 w-4" />
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-start justify-between">
                <div>
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-2.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
