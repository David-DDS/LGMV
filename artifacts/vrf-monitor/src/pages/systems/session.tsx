import { useRoute, Link } from "wouter";
import {
  useGetReadingSession, useGetSystem, useAnalyzeReadingSession,
  useListStartupReports, useDeleteReadingPhoto,
  getGetReadingSessionQueryKey,
} from "@workspace/api-client-react";
import { extractApiError, readErrorFromResponse } from "@/lib/api-error";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { HealthBadge } from "@/components/health-badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, BrainCircuit, Activity, AlertTriangle, FileImage, Upload, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getModeColor } from "@/lib/status-colors";
import { cn } from "@/lib/utils";

export default function ReadingSessionDetail() {
  const [, params] = useRoute("/systems/:systemId/sessions/:sessionId");
  const systemId = parseInt(params?.systemId || "0", 10);
  const sessionId = parseInt(params?.sessionId || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: system } = useGetSystem(systemId, { query: { enabled: !!systemId } as never });
  const { data: session, isLoading } = useGetReadingSession(systemId, sessionId, { query: { enabled: !!systemId && !!sessionId } as never });
  const { data: startupReports } = useListStartupReports(systemId, { query: { enabled: !!systemId } as never });
  const analyzeSession = useAnalyzeReadingSession();
  const deletePhoto = useDeleteReadingPhoto();

  const handleDeletePhoto = (photoId: number) => {
    if (!window.confirm("Tem certeza que deseja remover esta foto? Esta acao nao pode ser desfeita.")) return;
    deletePhoto.mutate({ systemId, sessionId, photoId }, {
      onSuccess: () => {
        toast({ title: "Foto removida", description: "A foto foi removida da sessao." });
        queryClient.invalidateQueries({ queryKey: getGetReadingSessionQueryKey(systemId, sessionId) });
      },
      onError: (err) => toast({
        title: "Erro ao remover",
        description: extractApiError(err, "Nao foi possivel remover a foto."),
        variant: "destructive",
      }),
    });
  };

  const hasBaseline = (startupReports ?? []).some((r) => r.processingStatus === "done" && r.extractedData);
  const baselineProcessing = (startupReports ?? []).some((r) => r.processingStatus === "processing" || r.processingStatus === "pending");

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("photo", file);
    try {
      const response = await fetch(`/api/systems/${systemId}/reading-sessions/${sessionId}/photos`, { method: "POST", body: formData });
      if (!response.ok) {
        const msg = await readErrorFromResponse(response, "Nao foi possivel enviar a foto.");
        throw new Error(msg);
      }
      toast({ title: "Foto enviada", description: "A foto LGMV foi adicionada a sessao." });
      queryClient.invalidateQueries({ queryKey: getGetReadingSessionQueryKey(systemId, sessionId) });
    } catch (err) {
      toast({ title: "Erro no upload", description: extractApiError(err, "Nao foi possivel enviar a foto."), variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleAnalyze = () => {
    if (!hasBaseline) {
      toast({
        title: "Relatorio de partida obrigatorio",
        description: baselineProcessing
          ? "O relatorio de partida ainda esta sendo processado pela IA. Aguarde a conclusao para iniciar a analise."
          : "Anexe um relatorio de partida (PDF) ao sistema antes de analisar leituras LGMV. Sem baseline a IA nao pode comparar valores.",
        variant: "destructive",
      });
      return;
    }
    analyzeSession.mutate({ systemId, sessionId }, {
      onSuccess: () => {
        toast({ title: "Analise concluida", description: "A IA finalizou a analise das leituras LGMV." });
        queryClient.invalidateQueries({ queryKey: getGetReadingSessionQueryKey(systemId, sessionId) });
      },
      onError: (err) => toast({
        title: "Erro na analise",
        description: extractApiError(err, "Nao foi possivel analisar a sessao."),
        variant: "destructive",
      }),
    });
  };

  if (isLoading || !session) return <SessionDetailSkeleton />;

  let analysisData: { summary?: string; insights?: string[]; recommendations?: string[] } | null = null;
  if (session.analysisResult) {
    try { analysisData = JSON.parse(session.analysisResult); } catch { /* ignore */ }
  }

  const getRowBg = (status: string) => {
    if (status === "normal") return "bg-emerald-400/5";
    if (status === "warning") return "bg-amber-400/5";
    if (status === "critical") return "bg-red-400/5";
    return "";
  };

  const getStatusPill = (status: string) => {
    const cfg: Record<string, { color: string; label: string }> = {
      normal: { color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", label: "Normal" },
      warning: { color: "text-amber-400 bg-amber-400/10 border-amber-400/20", label: "Alerta" },
      critical: { color: "text-red-400 bg-red-400/10 border-red-400/20", label: "Critico" },
    };
    const c = cfg[status] ?? { color: "text-slate-400 bg-slate-400/10 border-slate-400/20", label: "—" };
    return (
      <span className={cn("inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border", c.color)}>
        {c.label}
      </span>
    );
  };

  const getDeviationStyle = (dev?: number | null) => {
    if (dev === null || dev === undefined) return "text-muted-foreground/50";
    if (Math.abs(dev) > 15) return "text-red-400 font-bold";
    if (Math.abs(dev) > 10) return "text-amber-400 font-semibold";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0">
          <Link href={`/systems/${systemId}`}>
            <Button variant="outline" size="icon" className="h-9 w-9 border-border/50 bg-card hover:bg-muted/30 shrink-0 mt-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1.5">Sessao de Leitura LGMV</p>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-black tracking-tight">
                {format(new Date(session.sessionDate), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </h1>
              <HealthBadge status={session.healthStatus} />
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <Link href={`/systems/${systemId}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                {system?.name ?? `Sistema #${systemId}`}
              </Link>
              <span className="text-muted-foreground/30">•</span>
              <span className={cn("text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border", getModeColor(session.mode))}>
                {session.mode === "cooling" ? "Refrigeracao" : "Aquecimento"}
              </span>
            </div>
          </div>
        </div>

        <Button
          onClick={handleAnalyze}
          disabled={analyzeSession.isPending || !session.photos || session.photos.length === 0}
          className="font-bold shrink-0"
          style={{ background: 'linear-gradient(135deg, #FF6200, #FF8C42)' }}
        >
          {analyzeSession.isPending ? (
            <><div className="h-4 w-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analisando...</>
          ) : (
            <><BrainCircuit className="h-4 w-4 mr-2" />Analisar com IA</>
          )}
        </Button>
      </div>

      {/* Baseline warning */}
      {!hasBaseline && (
        <Card className="border-amber-400/30 bg-amber-400/[0.04]">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs leading-relaxed">
              <p className="font-bold text-amber-400 mb-0.5">Sem relatorio de partida cadastrado</p>
              <p className="text-muted-foreground">
                {baselineProcessing
                  ? "O relatorio de partida ainda esta sendo processado pela IA. Aguarde a conclusao para iniciar a analise."
                  : <>Anexe um relatorio de partida (PDF) ao sistema antes de analisar leituras LGMV — sem baseline a IA nao pode comparar valores. <Link href={`/systems/${systemId}`} className="underline hover:text-amber-400">Ir para o sistema</Link>.</>}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photos + Analysis */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Photos */}
        <Card className="md:col-span-2 border-border/50 bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <div className="flex items-center gap-2">
              <FileImage className="h-4 w-4 text-muted-foreground/60" />
              <span className="text-sm font-bold">Fotos LGMV</span>
              {session.photos && session.photos.length > 0 && (
                <span className="text-xs text-muted-foreground/50">({session.photos.length})</span>
              )}
            </div>
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-40"
            >
              {isUploading
                ? <><div className="h-3 w-3 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />Enviando...</>
                : <><Upload className="h-3.5 w-3.5" />Adicionar foto</>}
            </button>
            <input type="file" accept="image/*" className="hidden" ref={photoInputRef} onChange={handleUploadPhoto} />
          </div>
          <CardContent className="p-5">
            {(!session.photos || session.photos.length === 0) ? (
              <div
                className="aspect-video rounded-xl border-2 border-dashed border-border/40 flex flex-col items-center justify-center text-muted-foreground/40 hover:text-muted-foreground/70 hover:border-border/60 transition-all cursor-pointer"
                onClick={() => photoInputRef.current?.click()}
              >
                <FileImage className="h-10 w-10 mb-3" />
                <p className="text-sm font-semibold">Clique para adicionar fotos do LGMV</p>
                <p className="text-xs mt-1">As fotos serao analisadas pela IA</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {session.photos.map((photo, idx) => {
                  const label = photo.label ?? `Foto ${idx + 1}`;
                  return (
                    <div key={photo.id} className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-border/40 bg-muted/20">
                      {photo.fileUrl ? (
                        <img src={photo.fileUrl} alt={label} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileImage className="h-6 w-6 text-muted-foreground/20" />
                        </div>
                      )}
                      <span className="absolute top-1.5 left-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-black/70 text-white border border-white/10">
                        {label}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(photo.id)}
                        disabled={deletePhoto.isPending}
                        className="absolute top-1.5 right-1.5 h-6 w-6 rounded-md bg-black/70 hover:bg-red-500/90 text-white border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
                        aria-label={`Remover ${label}`}
                        title={`Remover ${label}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
                <div
                  className="aspect-[4/3] rounded-xl border-2 border-dashed border-border/40 flex flex-col items-center justify-center text-muted-foreground/30 hover:text-muted-foreground/60 hover:border-border/60 transition-all cursor-pointer"
                  onClick={() => photoInputRef.current?.click()}
                >
                  {isUploading
                    ? <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    : <><Upload className="h-5 w-5 mb-1" /><span className="text-[10px] font-semibold text-center">Adicionar</span></>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Analysis */}
        {analysisData ? (
          <Card className="border-[rgba(255,98,0,0.25)] bg-card relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ background: 'linear-gradient(135deg, #FF6200 0%, transparent 60%)' }} />
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[rgba(255,98,0,0.15)]">
              <BrainCircuit className="h-4 w-4" style={{ color: '#FF6200' }} />
              <span className="text-sm font-bold">Diagnostico IA</span>
            </div>
            <CardContent className="p-5 space-y-4">
              {analysisData.summary && (
                <p className="text-sm leading-relaxed text-muted-foreground">{analysisData.summary}</p>
              )}
              {analysisData.insights && analysisData.insights.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50 mb-2 flex items-center gap-1.5">
                    <Activity className="h-3 w-3" />Insights
                  </p>
                  <ul className="space-y-2">
                    {analysisData.insights.map((insight, i) => (
                      <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                        <span className="mt-1 w-1 h-1 rounded-full shrink-0" style={{ background: '#FF6200' }} />
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analysisData.recommendations && analysisData.recommendations.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-amber-400" />Recomendacoes
                  </p>
                  <ul className="space-y-2">
                    {analysisData.recommendations.map((rec, i) => (
                      <li key={i} className="flex gap-2.5 p-3 rounded-xl bg-muted/20 border border-border/40 text-xs text-muted-foreground">
                        <span className="flex items-center justify-center w-4 h-4 rounded-full shrink-0 text-[9px] font-black text-white mt-0.5" style={{ background: '#FF6200' }}>{i + 1}</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50 bg-card">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border/40">
              <BrainCircuit className="h-4 w-4 text-muted-foreground/40" />
              <span className="text-sm font-bold">Diagnostico IA</span>
            </div>
            <CardContent className="p-8 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
                <BrainCircuit className="h-6 w-6 text-muted-foreground/20" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground/60">Sem analise</p>
              <p className="text-xs text-muted-foreground/40 mt-1">Adicione fotos e clique em Analisar</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Readings table */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-muted-foreground/60" />
          <h2 className="text-base font-bold">
            Parametros Medidos
            {session.readings && session.readings.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground/50">({session.readings.length})</span>
            )}
          </h2>
        </div>

        {(!session.readings || session.readings.length === 0) ? (
          <Card className="border-dashed border-border/40 bg-transparent">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
                <Activity className="h-6 w-6 text-muted-foreground/20" />
              </div>
              <h3 className="font-bold text-sm mb-1">Nenhuma leitura extraida</h3>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Envie fotos do LGMV e clique em "Analisar com IA" para extrair os parametros automaticamente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50 bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 bg-muted/20 hover:bg-muted/20">
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60 py-3">Parametro</TableHead>
                    {(session.photos?.length ?? 0) > 1 && (
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60 py-3 hidden sm:table-cell">Foto</TableHead>
                    )}
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60 py-3">Valor</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60 py-3 hidden md:table-cell">Baseline</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60 py-3 hidden lg:table-cell">Desvio</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60 py-3 hidden sm:table-cell">Faixa Normal</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60 py-3 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.readings.map((reading, i) => (
                    <TableRow
                      key={reading.id}
                      className={cn("border-border/30 transition-colors", getRowBg(reading.status), i > 0 ? "border-t" : "")}
                    >
                      <TableCell className="font-semibold text-sm py-3.5">{reading.parameter}</TableCell>
                      {(session.photos?.length ?? 0) > 1 && (
                        <TableCell className="py-3.5 hidden sm:table-cell">
                          {reading.sourcePhotoLabel ? (
                            <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-muted/40 text-muted-foreground border border-border/40">
                              {reading.sourcePhotoLabel}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="py-3.5">
                        {reading.value !== null && reading.value !== undefined ? (
                          <span className="font-black text-sm">
                            {reading.value}{" "}
                            <span className="text-xs font-normal text-muted-foreground/60">{reading.unit}</span>
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-3.5 text-sm text-muted-foreground/60">
                        {reading.baselineValue !== null && reading.baselineValue !== undefined
                          ? `${reading.baselineValue} ${reading.unit}` : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell py-3.5 text-sm font-mono">
                        {reading.deviationPercent !== null && reading.deviationPercent !== undefined ? (
                          <span className={getDeviationStyle(reading.deviationPercent)}>
                            {reading.deviationPercent > 0 ? "+" : ""}{reading.deviationPercent}%
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-3.5 text-xs font-mono text-muted-foreground/50">
                        {reading.minNormal !== null && reading.maxNormal !== null
                          ? `${reading.minNormal} – ${reading.maxNormal}` : "—"}
                      </TableCell>
                      <TableCell className="py-3.5 text-right">
                        {getStatusPill(reading.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function SessionDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-lg bg-muted/40" />
          <div><Skeleton className="h-3 w-32 mb-2 bg-muted/40" /><Skeleton className="h-7 w-64 bg-muted/40" /></div>
        </div>
        <Skeleton className="h-9 w-36 bg-muted/40" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="md:col-span-2 h-52 rounded-xl bg-muted/40" />
        <Skeleton className="h-52 rounded-xl bg-muted/40" />
      </div>
      <Skeleton className="h-80 rounded-xl bg-muted/40" />
    </div>
  );
}
