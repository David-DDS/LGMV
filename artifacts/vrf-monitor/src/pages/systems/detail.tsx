import { useRoute, Link, useLocation } from "wouter";
import {
  useGetSystem, useGetSystemSummary, useListStartupReports,
  useListReadingSessions, useDeleteSystem,
  getListStartupReportsQueryKey, getListReadingSessionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { HealthBadge } from "@/components/health-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, MapPin, Server, Calendar, Upload, FileText,
  Activity, Trash2, Plus, AlertCircle, FilePlus, ChevronRight,
  Layers, Radio, BrainCircuit,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getModeColor } from "@/lib/status-colors";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

function InfoRow({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">{label}</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function SystemDetail() {
  const [, params] = useRoute("/systems/:systemId");
  const systemId = parseInt(params?.systemId || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: system, isLoading: isLoadingSystem } = useGetSystem(systemId, { query: { enabled: !!systemId } });
  const { data: summary } = useGetSystemSummary(systemId, { query: { enabled: !!systemId } });
  const { data: reports, isLoading: isLoadingReports } = useListStartupReports(systemId, { query: { enabled: !!systemId } });
  const { data: sessions, isLoading: isLoadingSessions } = useListReadingSessions(systemId, { query: { enabled: !!systemId } });
  const deleteSystem = useDeleteSystem();

  const handleUploadReport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch(`/api/systems/${systemId}/startup-reports`, { method: "POST", body: formData });
      if (!response.ok) throw new Error();
      toast({ title: "Relatorio enviado", description: "O relatorio de partida esta sendo processado pela IA." });
      queryClient.invalidateQueries({ queryKey: getListStartupReportsQueryKey(systemId) });
    } catch {
      toast({ title: "Erro no upload", description: "Nao foi possivel enviar o relatorio.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = () => {
    deleteSystem.mutate({ systemId }, {
      onSuccess: () => { toast({ title: "Sistema removido" }); setLocation("/systems"); },
      onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
    });
  };

  if (isLoadingSystem || !system) return <SystemDetailSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <Link href="/systems">
            <Button variant="outline" size="icon" className="h-9 w-9 border-border/50 bg-card hover:bg-muted/30 shrink-0 mt-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1.5">Detalhes do Sistema</p>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl md:text-2xl font-black tracking-tight">{system.name}</h1>
              <HealthBadge status={system.healthStatus} />
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-1">{system.code}</p>
          </div>
        </div>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="border-red-400/20 text-red-400 hover:bg-red-400/10 hover:border-red-400/30 shrink-0">
              <Trash2 className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Remover</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border/50 bg-card">
            <DialogHeader>
              <DialogTitle>Remover sistema?</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Esta acao nao pode ser desfeita. Todos os dados deste sistema serao permanentemente removidos.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" className="border-border/50" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteSystem.isPending}>
                {deleteSystem.isPending ? "Removendo..." : "Remover Sistema"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2 border-border/50 bg-card">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-border/40">
            <Server className="h-4 w-4 text-muted-foreground/60" />
            <span className="text-sm font-bold">Dados do Sistema</span>
          </div>
          <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {system.model && <InfoRow label="Modelo" value={system.model} icon={Server} />}
            <InfoRow label="Tipo VRF" value={system.vrfType.replace(/_/g, " ").toUpperCase()} icon={Activity} />
            {system.location && <InfoRow label="Localizacao" value={system.location} icon={MapPin} />}
            {system.floor && <InfoRow label="Andar" value={system.floor} icon={Layers} />}
            {system.servedArea && <InfoRow label="Sistema Atende" value={system.servedArea} icon={Radio} />}
            {system.startupDate && (
              <InfoRow
                label="Data de Partida"
                value={format(new Date(system.startupDate), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                icon={Calendar}
              />
            )}
            {system.notes && (
              <div className="sm:col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 mb-2">Observacoes</p>
                <div className="p-3.5 rounded-xl bg-muted/20 border border-border/40 text-sm text-muted-foreground leading-relaxed">
                  {system.notes}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-border/40">
            <BrainCircuit className="h-4 w-4 text-muted-foreground/60" />
            <span className="text-sm font-bold">Resumo IA</span>
          </div>
          <CardContent className="p-6 space-y-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 mb-2">Sessoes de Leitura</p>
              <p className="text-4xl font-black" style={{ color: '#FF6200' }}>{summary?.totalSessions ?? 0}</p>
            </div>
            {summary?.latestAnalysis ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 mb-2">Ultimo Diagnostico</p>
                <div className="p-3.5 rounded-xl bg-muted/20 border border-border/40 text-xs text-muted-foreground leading-relaxed line-clamp-5">
                  {summary.latestAnalysis}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-muted/10 border border-border/30 text-center">
                <p className="text-xs text-muted-foreground/50">Sem analises ainda</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="w-full sm:w-auto bg-muted/20 border border-border/40 p-1 rounded-xl">
          <TabsTrigger value="sessions" className="rounded-lg text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            Sessoes de Leitura
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            Relatorios de Partida
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Sessoes de Leitura LGMV</h2>
            <Link href={`/systems/${systemId}/sessions/new`}>
              <Button size="sm" className="font-semibold" style={{ background: 'linear-gradient(135deg, #FF6200, #FF8C42)' }}>
                <Plus className="h-4 w-4 mr-2" />Nova Sessao
              </Button>
            </Link>
          </div>

          {isLoadingSessions ? (
            <div className="space-y-3">
              {[1,2].map(i => <Skeleton key={i} className="h-20 w-full bg-muted/40 rounded-xl" />)}
            </div>
          ) : !sessions || sessions.length === 0 ? (
            <Card className="border-dashed border-border/40 bg-transparent">
              <CardContent className="flex flex-col items-center justify-center p-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
                  <Activity className="h-6 w-6 text-muted-foreground/30" />
                </div>
                <h3 className="font-bold text-sm">Nenhuma sessao registrada</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-xs">
                  Crie uma sessao e envie fotos do LGMV para iniciar o monitoramento.
                </p>
                <Link href={`/systems/${systemId}/sessions/new`}>
                  <Button variant="outline" size="sm" className="border-border/50">Criar Sessao</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <Link key={session.id} href={`/systems/${systemId}/sessions/${session.id}`}>
                  <Card className="border-border/50 bg-card hover:border-[rgba(255,98,0,0.3)] transition-all duration-200 cursor-pointer group">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-muted/30 border border-border/40 shrink-0">
                          <span className="text-sm font-black">{format(new Date(session.sessionDate), "dd")}</span>
                          <span className="text-[9px] uppercase font-semibold text-muted-foreground">{format(new Date(session.sessionDate), "MMM", { locale: ptBR })}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {format(new Date(session.sessionDate), "EEEE, d 'de' MMMM", { locale: ptBR })}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${getModeColor(session.mode)}`}>
                              {session.mode === "cooling" ? "Refrig." : "Aquec."}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <HealthBadge status={session.healthStatus} size="sm" />
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-[#FF6200] transition-colors" />
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
            <h2 className="text-base font-bold">Relatorios de Partida</h2>
            <div>
              <input type="file" accept="application/pdf" className="hidden" ref={fileInputRef} onChange={handleUploadReport} />
              <Button size="sm" className="font-semibold" onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                style={{ background: 'linear-gradient(135deg, #FF6200, #FF8C42)' }}>
                {isUploading ? (
                  <><div className="h-4 w-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enviando...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" />Enviar PDF</>
                )}
              </Button>
            </div>
          </div>

          {isLoadingReports ? (
            <div className="space-y-3">
              {[1,2].map(i => <Skeleton key={i} className="h-16 w-full bg-muted/40 rounded-xl" />)}
            </div>
          ) : !reports || reports.length === 0 ? (
            <Card className="border-dashed border-border/40 bg-transparent">
              <CardContent className="flex flex-col items-center justify-center p-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
                  <FilePlus className="h-6 w-6 text-muted-foreground/30" />
                </div>
                <h3 className="font-bold text-sm">Nenhum relatorio de partida</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-xs">
                  Envie o PDF para estabelecer o baseline do sistema.
                </p>
                <Button variant="outline" size="sm" className="border-border/50" onClick={() => fileInputRef.current?.click()}>
                  Enviar Relatorio
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <Card key={report.id} className="border-border/50 bg-card">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-muted/30 border border-border/40 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-muted-foreground/60" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{report.filename}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(report.uploadedAt), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {report.processingStatus === "pending" || report.processingStatus === "processing" ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
                          <div className="h-2.5 w-2.5 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />
                          Processando
                        </span>
                      ) : report.processingStatus === "done" ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
                          <Activity className="h-2.5 w-2.5" />
                          Analisado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-red-400 bg-red-400/10 px-2.5 py-1 rounded-full border border-red-400/20">
                          <AlertCircle className="h-2.5 w-2.5" />
                          Erro
                        </span>
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
        <Skeleton className="h-9 w-9 rounded-lg bg-muted/40" />
        <div><Skeleton className="h-3 w-24 mb-2 bg-muted/40" /><Skeleton className="h-7 w-56 bg-muted/40" /></div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="md:col-span-2 h-52 rounded-xl bg-muted/40" />
        <Skeleton className="h-52 rounded-xl bg-muted/40" />
      </div>
    </div>
  );
}
