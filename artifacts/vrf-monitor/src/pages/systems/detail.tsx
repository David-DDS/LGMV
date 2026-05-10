import { useRoute, Link, useLocation } from "wouter";
import {
  useGetSystem,
  useGetSystemSummary,
  useListStartupReports,
  useListReadingSessions,
  useDeleteSystem,
  getListStartupReportsQueryKey,
  getListReadingSessionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HealthBadge } from "@/components/health-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, MapPin, Server, Calendar, Upload, FileText,
  Activity, Trash2, Plus, AlertCircle, FilePlus, ChevronRight, Layers, Radio,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getModeColor } from "@/lib/status-colors";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export default function SystemDetail() {
  const [, params] = useRoute("/systems/:systemId");
  const systemId = parseInt(params?.systemId || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: system, isLoading: isLoadingSystem } = useGetSystem(systemId, {
    query: { enabled: !!systemId },
  });
  const { data: summary, isLoading: isLoadingSummary } = useGetSystemSummary(systemId, {
    query: { enabled: !!systemId },
  });
  const { data: reports, isLoading: isLoadingReports } = useListStartupReports(systemId, {
    query: { enabled: !!systemId },
  });
  const { data: sessions, isLoading: isLoadingSessions } = useListReadingSessions(systemId, {
    query: { enabled: !!systemId },
  });
  const deleteSystem = useDeleteSystem();

  const handleUploadReport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch(`/api/systems/${systemId}/startup-reports`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Upload falhou");
      toast({ title: "Relatorio enviado", description: "O relatorio de partida foi enviado e esta sendo processado." });
      queryClient.invalidateQueries({ queryKey: getListStartupReportsQueryKey(systemId) });
    } catch {
      toast({ title: "Erro no upload", description: "Nao foi possivel enviar o relatorio. Tente novamente.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = () => {
    deleteSystem.mutate({ systemId }, {
      onSuccess: () => {
        toast({ title: "Sistema removido" });
        setLocation("/systems");
      },
      onError: () => {
        toast({ title: "Erro ao remover", description: "Nao foi possivel remover o sistema.", variant: "destructive" });
      },
    });
  };

  if (isLoadingSystem || !system) return <SystemDetailSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/systems">
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-3xl font-bold tracking-tight truncate">{system.name}</h1>
              <HealthBadge status={system.healthStatus} />
            </div>
            <p className="text-muted-foreground font-mono text-xs md:text-sm mt-0.5">{system.code}</p>
          </div>
        </div>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive/10 shrink-0">
              <Trash2 className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Remover</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remover sistema?</DialogTitle>
              <DialogDescription>
                Esta acao nao pode ser desfeita. Todos os relatorios de partida e sessoes de leitura deste sistema serao permanentemente removidos.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteSystem.isPending}>
                {deleteSystem.isPending ? "Removendo..." : "Remover Sistema"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Dados do Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              {system.model && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Modelo</p>
                  <p className="text-sm mt-1 flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-muted-foreground" />
                    {system.model}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo VRF</p>
                <p className="text-sm mt-1 uppercase font-medium">
                  {system.vrfType.replace(/_/g, " ")}
                </p>
              </div>
              {system.location && (
                <div className="col-span-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Localizacao</p>
                  <p className="text-sm mt-1 flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {system.location}
                  </p>
                </div>
              )}
              {system.floor && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Andar</p>
                  <p className="text-sm mt-1 flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                    {system.floor}
                  </p>
                </div>
              )}
              {system.servedArea && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sistema Atende</p>
                  <p className="text-sm mt-1 flex items-center gap-2">
                    <Radio className="h-3.5 w-3.5 text-muted-foreground" />
                    {system.servedArea}
                  </p>
                </div>
              )}
              {system.startupDate && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data de Partida</p>
                  <p className="text-sm mt-1 flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {format(new Date(system.startupDate), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
              )}
              {system.notes && (
                <div className="col-span-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Observacoes</p>
                  <div className="mt-1 p-3 bg-muted rounded-md text-sm border">
                    {system.notes}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Total de Sessoes</p>
              <div className="text-3xl font-bold flex items-center">
                <Activity className="h-6 w-6 mr-2 text-primary" />
                {isLoadingSummary ? <Skeleton className="h-8 w-12" /> : (summary?.totalSessions ?? 0)}
              </div>
            </div>
            {summary?.latestAnalysis && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Ultimo Diagnostico IA</p>
                <div className="p-3 bg-muted rounded-md text-sm border line-clamp-4">
                  {summary.latestAnalysis}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="w-full grid grid-cols-2 md:w-auto md:inline-flex">
          <TabsTrigger value="sessions">Sessoes de Leitura</TabsTrigger>
          <TabsTrigger value="reports">Relatorios de Partida</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Sessoes de Leitura LGMV</h2>
            <Link href={`/systems/${systemId}/sessions/new`}>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nova Sessao
              </Button>
            </Link>
          </div>

          {isLoadingSessions ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : !sessions || sessions.length === 0 ? (
            <Card className="border-dashed bg-transparent shadow-none">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <Activity className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <h3 className="font-medium">Nenhuma sessao registrada</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Crie uma sessao e envie fotos do LGMV para iniciar o monitoramento.
                </p>
                <Link href={`/systems/${systemId}/sessions/new`}>
                  <Button variant="outline">Criar Sessao</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {sessions.map((session) => (
                <Link key={session.id} href={`/systems/${systemId}/sessions/${session.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4 md:gap-6 min-w-0">
                        <div className="flex flex-col shrink-0">
                          <span className="font-semibold text-sm md:text-base">
                            {format(new Date(session.sessionDate), "d MMM yyyy", { locale: ptBR })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(session.sessionDate), "HH:mm")}
                          </span>
                        </div>
                        <div className="hidden md:flex gap-3 items-center">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full uppercase border ${getModeColor(session.mode)}`}>
                            {session.mode === "cooling" ? "Refrigeracao" : "Aquecimento"}
                          </span>
                          <HealthBadge status={session.healthStatus} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="md:hidden flex flex-col items-end gap-1">
                          <HealthBadge status={session.healthStatus} showDot={false} className="text-[10px] px-1.5 py-0" />
                          <span className="text-xs uppercase text-muted-foreground">
                            {session.mode === "cooling" ? "Refrig." : "Aquec."}
                          </span>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reports" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Relatorios de Partida</h2>
            <div>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                ref={fileInputRef}
                onChange={handleUploadReport}
              />
              <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                {isUploading ? (
                  <span className="flex items-center">
                    <div className="h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <Upload className="h-4 w-4 mr-2" />
                    Enviar PDF
                  </span>
                )}
              </Button>
            </div>
          </div>

          {isLoadingReports ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !reports || reports.length === 0 ? (
            <Card className="border-dashed bg-transparent shadow-none">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <FilePlus className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <h3 className="font-medium">Nenhum relatorio de partida</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Envie o PDF do relatorio de partida para estabelecer o baseline do sistema.
                </p>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  Enviar Relatorio
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {reports.map((report) => (
                <Card key={report.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="p-2 bg-muted rounded-md text-primary shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{report.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          Enviado em {format(new Date(report.uploadedAt), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {report.processingStatus === "pending" || report.processingStatus === "processing" ? (
                        <div className="flex items-center text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                          <div className="h-3 w-3 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Processando
                        </div>
                      ) : report.processingStatus === "done" ? (
                        <div className="flex items-center text-xs text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                          <Activity className="h-3 w-3 mr-1.5" />
                          Analisado
                        </div>
                      ) : (
                        <div className="flex items-center text-xs text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-200">
                          <AlertCircle className="h-3 w-3 mr-1.5" />
                          Erro
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SystemDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div>
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="md:col-span-2 h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  );
}
