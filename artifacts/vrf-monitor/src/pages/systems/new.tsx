import {
  useCreateSystem,
  useExtractStartupPdf,
  useAttachExtractedStartupReport,
} from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Loader2, FileText, UploadCloud, X, FileCheck, Sparkles,
} from "lucide-react";
import {
  SystemForm, SystemFormValues, defaultSystemValues,
} from "@/components/system-form";
import { useCallback, useRef, useState } from "react";

type StagedExtraction = {
  fileToken: string;
  originalFilename: string;
  baselineData: unknown;
};

export default function NewSystem() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createSystem = useCreateSystem();
  const extract = useExtractStartupPdf();
  const attach = useAttachExtractedStartupReport();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState<Partial<SystemFormValues> | undefined>();
  const [staged, setStaged] = useState<StagedExtraction | null>(null);

  const handleFile = useCallback((file: File) => {
    setExtractError(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setExtractError("Apenas arquivos PDF sao aceitos.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setExtractError("Arquivo maior que 50 MB.");
      return;
    }

    extract.mutate(
      { data: { file } },
      {
        onSuccess: (result) => {
          setStaged({
            fileToken: result.fileToken,
            originalFilename: result.originalFilename,
            baselineData: result.baselineData ?? null,
          });
          // Filter null values and convert to SystemFormValues partial
          const fd = result.formData ?? {};
          const next: Partial<SystemFormValues> = {};
          (Object.keys(fd) as (keyof typeof fd)[]).forEach((k) => {
            const v = fd[k];
            if (v != null) {
              (next as Record<string, unknown>)[k] = v;
            }
          });
          setPrefilled(next);
          toast({
            title: "Dados extraidos do relatorio",
            description: "Revise os campos preenchidos e edite se necessario.",
          });
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Falha ao processar PDF.";
          setExtractError(msg);
          toast({
            title: "Erro ao extrair dados",
            description: "Voce pode preencher manualmente.",
            variant: "destructive",
          });
        },
      }
    );
  }, [extract, toast]);

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onSubmit = (data: SystemFormValues) => {
    createSystem.mutate(
      { data },
      {
        onSuccess: (system) => {
          // If we staged a PDF, attach it
          if (staged) {
            attach.mutate(
              {
                systemId: system.id,
                data: {
                  fileToken: staged.fileToken,
                  originalFilename: staged.originalFilename,
                  baselineData: staged.baselineData as Record<string, unknown> | undefined,
                },
              },
              {
                onSettled: () => {
                  toast({ title: "Sistema cadastrado", description: "Sistema e relatorio salvos." });
                  setLocation(`/systems/${system.id}`);
                },
              }
            );
          } else {
            toast({ title: "Sistema cadastrado", description: "O sistema VRF foi registrado com sucesso." });
            setLocation(`/systems/${system.id}`);
          }
        },
        onError: () => {
          toast({ title: "Erro ao cadastrar", description: "Nao foi possivel cadastrar o sistema.", variant: "destructive" });
        },
      }
    );
  };

  const isExtracting = extract.isPending;
  const isSubmitting = createSystem.isPending || attach.isPending;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <div className="flex items-center gap-4">
        <Link href="/systems">
          <Button variant="outline" size="icon" className="h-9 w-9 border-border/50 bg-card hover:bg-muted/30">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1">Novo Registro</p>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Cadastrar Sistema VRF</h1>
        </div>
      </div>

      {/* PDF prefill block */}
      <Card className="border-border/50 bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-border/40">
          <Sparkles className="h-4 w-4" style={{ color: '#FF6200' }} />
          <span className="text-sm font-bold">Comecar com Relatorio de Partida</span>
          <span className="text-xs font-medium text-muted-foreground/70">(opcional)</span>
        </div>
        <CardContent className="p-6">
          {staged ? (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                <FileCheck className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-300 truncate">{staged.originalFilename}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Dados extraidos pela IA e preenchidos no formulario abaixo. Revise antes de salvar.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-red-400 shrink-0"
                onClick={() => {
                  setStaged(null);
                  setPrefilled(undefined);
                  setExtractError(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => !isExtracting && fileInputRef.current?.click()}
              className={`group relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                isExtracting
                  ? "border-border/50 bg-muted/10 cursor-wait"
                  : isDragging
                    ? "border-orange-400 bg-orange-400/5"
                    : "border-border/50 bg-muted/10 hover:border-orange-400/60 hover:bg-orange-400/5"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              {isExtracting ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#FF6200' }} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Lendo relatorio com IA...</p>
                    <p className="text-xs text-muted-foreground mt-1">Pode levar alguns segundos.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-orange-400/10 group-hover:bg-orange-400/15 flex items-center justify-center transition">
                    <UploadCloud className="h-5 w-5" style={{ color: '#FF6200' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Anexe o PDF para preencher automaticamente</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      A IA extrai modelo, localizacao, data de partida e observacoes
                    </p>
                  </div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
                    PDF ate 50 MB
                  </p>
                </div>
              )}
            </div>
          )}

          {extractError && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg border border-red-400/30 bg-red-400/5 text-xs text-red-300">
              <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{extractError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card">
        <CardContent className="p-6">
          <SystemForm
            initialValues={defaultSystemValues}
            prefilledValues={prefilled}
            onSubmit={onSubmit}
            isPending={isSubmitting}
            submitLabel="Cadastrar Sistema"
            pendingLabel="Cadastrando..."
          />
        </CardContent>
      </Card>
    </div>
  );
}
