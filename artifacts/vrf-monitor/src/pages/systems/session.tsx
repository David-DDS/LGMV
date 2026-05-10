import { useRoute, Link } from "wouter";
import {
  useGetReadingSession,
  useGetSystem,
  useAnalyzeReadingSession,
  getGetReadingSessionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HealthBadge } from "@/components/health-badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, BrainCircuit, Activity, AlertTriangle,
  FileImage, Upload,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ReadingSessionDetail() {
  const [, params] = useRoute("/systems/:systemId/sessions/:sessionId");
  const systemId = parseInt(params?.systemId || "0", 10);
  const sessionId = parseInt(params?.sessionId || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: system } = useGetSystem(systemId, {
    query: { enabled: !!systemId },
  });
  const { data: session, isLoading } = useGetReadingSession(systemId, sessionId, {
    query: { enabled: !!systemId && !!sessionId },
  });
  const analyzeSession = useAnalyzeReadingSession();

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("photo", file);
    try {
      const response = await fetch(`/api/systems/${systemId}/reading-sessions/${sessionId}/photos`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Upload falhou");
      toast({ title: "Foto enviada", description: "A foto do LGMV foi adicionada a sessao." });
      queryClient.invalidateQueries({ queryKey: getGetReadingSessionQueryKey(systemId, sessionId) });
    } catch {
      toast({ title: "Erro no upload", description: "Nao foi possivel enviar a foto. Tente novamente.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleAnalyze = () => {
    analyzeSession.mutate({ systemId, sessionId }, {
      onSuccess: () => {
        toast({ title: "Analise concluida", description: "A IA finalizou a analise das leituras LGMV." });
        queryClient.invalidateQueries({ queryKey: getGetReadingSessionQueryKey(systemId, sessionId) });
      },
      onError: () => {
        toast({ title: "Erro na analise", description: "Nao foi possivel analisar a sessao. Tente novamente.", variant: "destructive" });
      },
    });
  };

  if (isLoading || !session) return <SessionDetailSkeleton />;

  let analysisData: { summary?: string; insights?: string[]; recommendations?: string[] } | null = null;
  if (session.analysisResult) {
    try { analysisData = JSON.parse(session.analysisResult); } catch { /* ignore */ }
  }

  const getRowStyle = (status: string) => {
    switch (status) {
      case "normal": return "bg-emerald-50/50 dark:bg-emerald-950/10";
      case "warning": return "bg-amber-50/50 dark:bg-amber-950/10";
      case "critical": return "bg-red-50/50 dark:bg-red-950/10";
      default: return "";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "normal": return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400 dark:border-emerald-800 text-xs">Normal</Badge>;
      case "warning": return <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/50 dark:text-amber-400 dark:border-amber-800 text-xs">Alerta</Badge>;
      case "critical": return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-400 dark:border-red-800 text-xs">Critico</Badge>;
      default: return <Badge variant="outline" className="text-xs">Desconhecido</Badge>;
    }
  };

  const getDeviationStyle = (dev?: number | null) => {
    if (dev === null || dev === undefined) return "text-muted-foreground";
    if (Math.abs(dev) > 15) return "text-red-600 font-semibold";
    if (Math.abs(dev) > 10) return "text-amber-600 font-medium";
    return "text-muted-foreground";
  };

  const modeLabel = session.mode === "cooling" ? "Refrigeracao" : "Aquecimento";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/systems/${systemId}`}>
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                Leitura de {format(new Date(session.sessionDate), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </h1>
              <HealthBadge status={session.healthStatus} />
            </div>
            <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
              Sistema:{" "}
              <Link href={`/systems/${systemId}`} className="hover:underline font-medium text-foreground">
                {system?.name ?? `#${systemId}`}
              </Link>{" "}
              • Modo: <span className="font-medium">{modeLabel}</span>
            </p>
          </div>
        </div>

        <Button
          onClick={handleAnalyze}
          disabled={analyzeSession.isPending || !session.photos || session.photos.length === 0}
          className="shrink-0"
        >
          {analyzeSession.isPending ? (
            <span className="flex items-center">
              <div className="h-4 w-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analisando...
            </span>
          ) : (
            <span className="flex items-center">
              <BrainCircuit className="h-4 w-4 mr-2" />
              Analisar com IA
            </span>
          )}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Fotos LGMV</CardTitle>
            <CardDescription className="text-xs">Capturas de tela do aplicativo LGMV para analise.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {session.photos && session.photos.map((photo) => (
                <div key={photo.id} className="relative aspect-[4/3] rounded-md overflow-hidden border bg-muted">
                  {photo.fileUrl ? (
                    <img src={photo.fileUrl} alt="LGMV" className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileImage className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
              ))}
              <div
                className="relative aspect-[4/3] rounded-md overflow-hidden border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:border-border transition-colors cursor-pointer"
                onClick={() => photoInputRef.current?.click()}
              >
                {isUploading ? (
                  <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload className="h-5 w-5 mb-1" />
                    <span className="text-[10px] font-medium text-center px-1">Adicionar Foto</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={photoInputRef}
                  onChange={handleUploadPhoto}
                />
              </div>
            </div>
            {(!session.photos || session.photos.length === 0) && (
              <p className="text-sm text-muted-foreground mt-3 text-center">
                Envie fotos do LGMV para habilitar a analise por IA.
              </p>
            )}
          </CardContent>
        </Card>

        {analysisData && (
          <Card className="border-primary/20">
            <CardHeader className="bg-primary/5 border-b pb-3">
              <div className="flex items-center gap-2 text-primary">
                <BrainCircuit className="h-4 w-4" />
                <CardTitle className="text-sm">Diagnostico IA</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {analysisData.summary && (
                <p className="text-sm leading-relaxed">{analysisData.summary}</p>
              )}
              {analysisData.insights && analysisData.insights.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <Activity className="h-3 w-3" /> Insights
                  </h4>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {analysisData.insights.map((insight, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analysisData.recommendations && analysisData.recommendations.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-500" /> Recomendacoes
                  </h4>
                  <ul className="space-y-2">
                    {analysisData.recommendations.map((rec, i) => (
                      <li key={i} className="flex gap-2 bg-muted/50 p-2.5 rounded-md border text-sm">
                        <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">{i + 1}</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">
          Leituras de Parametros
          {session.readings && session.readings.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({session.readings.length} parametros)
            </span>
          )}
        </h2>

        {(!session.readings || session.readings.length === 0) ? (
          <Card className="border-dashed bg-transparent shadow-none">
            <CardContent className="flex flex-col items-center justify-center p-10 text-center">
              <FileImage className="h-10 w-10 text-muted-foreground/30 mb-4" />
              <h3 className="text-base font-medium mb-1">Nenhuma leitura extraida</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                Envie fotos do aplicativo LGMV e clique em "Analisar com IA" para extrair os parametros automaticamente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[200px] md:w-[280px]">Parametro</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="hidden md:table-cell">Baseline</TableHead>
                    <TableHead className="hidden lg:table-cell">Desvio</TableHead>
                    <TableHead className="hidden sm:table-cell">Faixa Normal</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.readings.map((reading) => (
                    <TableRow key={reading.id} className={getRowStyle(reading.status)}>
                      <TableCell className="font-medium text-sm">{reading.parameter}</TableCell>
                      <TableCell>
                        {reading.value !== null && reading.value !== undefined ? (
                          <span className="font-semibold">
                            {reading.value}{" "}
                            <span className="text-xs font-normal text-muted-foreground">{reading.unit}</span>
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {reading.baselineValue !== null && reading.baselineValue !== undefined
                          ? `${reading.baselineValue} ${reading.unit}`
                          : "-"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {reading.deviationPercent !== null && reading.deviationPercent !== undefined ? (
                          <span className={getDeviationStyle(reading.deviationPercent)}>
                            {reading.deviationPercent > 0 ? "+" : ""}{reading.deviationPercent}%
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground font-mono">
                        {reading.minNormal !== null && reading.maxNormal !== null
                          ? `${reading.minNormal} – ${reading.maxNormal}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {getStatusBadge(reading.status)}
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
          <Skeleton className="h-8 w-8 rounded-md" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}
