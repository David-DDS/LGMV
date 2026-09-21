import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileText,
  SearchX,
  ShieldAlert,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ManufacturerGuideStatus = "grounded" | "no_match" | "not_applicable" | "unavailable";

export interface ManufacturerGuide {
  version: 1;
  documentId: "lg-multi-v5-troubleshooting-2021";
  title: string;
  status: ManufacturerGuideStatus;
  reason?: string;
  safetyNotice: string;
  references: Array<{ page: number; printedPage: string; title: string }>;
  procedures: Array<{
    title: string;
    evidence: string;
    steps: Array<{
      instruction: string;
      expectedResult: string;
      onPass: string;
      onFail: string;
      page: number;
      sourceQuote: string;
    }>;
  }>;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string";
}

function isValidPage(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 1 && value <= 66;
}

function isGuideStatus(value: unknown): value is ManufacturerGuideStatus {
  return value === "grounded" || value === "no_match" || value === "not_applicable" || value === "unavailable";
}

function isReference(value: unknown): value is ManufacturerGuide["references"][number] {
  if (!isRecord(value)) return false;
  return isValidPage(value.page) && isText(value.printedPage) && isText(value.title);
}

function isStep(value: unknown): value is ManufacturerGuide["procedures"][number]["steps"][number] {
  if (!isRecord(value)) return false;
  return (
    isText(value.instruction) &&
    isText(value.expectedResult) &&
    isText(value.onPass) &&
    isText(value.onFail) &&
    isValidPage(value.page) &&
    isText(value.sourceQuote)
  );
}

function isProcedure(value: unknown): value is ManufacturerGuide["procedures"][number] {
  if (!isRecord(value)) return false;
  return (
    isText(value.title) &&
    isText(value.evidence) &&
    Array.isArray(value.steps) &&
    value.steps.every(isStep)
  );
}

export function getManufacturerGuide(value: unknown): ManufacturerGuide | null {
  if (!isRecord(value)) return null;
  if (
    value.version !== 1 ||
    value.documentId !== "lg-multi-v5-troubleshooting-2021" ||
    !isText(value.title) ||
    !isGuideStatus(value.status) ||
    (value.reason !== undefined && !isText(value.reason)) ||
    !isText(value.safetyNotice) ||
    !Array.isArray(value.references) ||
    !value.references.every(isReference) ||
    !Array.isArray(value.procedures) ||
    !value.procedures.every(isProcedure)
  ) {
    return null;
  }
  return {
    version: 1,
    documentId: "lg-multi-v5-troubleshooting-2021",
    title: value.title,
    status: value.status,
    reason: value.reason,
    safetyNotice: value.safetyNotice,
    references: value.references,
    procedures: value.procedures,
  };
}

export function ManufacturerGuideAvailability({
  applicable,
  hasAnalysis,
  hasGuide,
}: {
  applicable: boolean;
  hasAnalysis: boolean;
  hasGuide: boolean;
}) {
  if (!applicable) return null;

  return (
    <Card className="border-[#FF6200]/30 bg-[#FF6200]/[0.05]">
      <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <BookOpen className="h-4 w-4 text-[#FF6200] mt-0.5 shrink-0" />
          <div className="text-xs leading-relaxed">
            <p className="font-bold text-[#FF6200]">Guia LG disponível para a análise</p>
            <p className="mt-1 text-muted-foreground" data-testid="text-guide-availability">
              Ao analisar, o diagnóstico pode incluir testes e fluxogramas fundamentados no manual LG MULTI V 5.
              A consulta ao PDF não inicia uma nova análise.
            </p>
            {hasAnalysis && !hasGuide && (
              <p className="mt-2 font-semibold text-amber-400" data-testid="status-guide-reanalysis-needed">
                Esta é uma análise antiga. Analise novamente para gerar o guia; etapas não são criadas retroativamente.
              </p>
            )}
          </div>
        </div>
        <a
          href="/api/manufacturer-guide/pdf"
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-[#FF6200] hover:underline"
          data-testid="link-consult-lg-guide"
        >
          Consultar guia LG <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </CardContent>
    </Card>
  );
}

const statusConfig: Record<ManufacturerGuideStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  grounded: {
    label: "Fundamentado no manual",
    className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-400",
    icon: CheckCircle2,
  },
  no_match: {
    label: "Sem correspondência",
    className: "border-amber-400/25 bg-amber-400/10 text-amber-400",
    icon: SearchX,
  },
  not_applicable: {
    label: "Não aplicável",
    className: "border-slate-400/25 bg-slate-400/10 text-slate-400",
    icon: XCircle,
  },
  unavailable: {
    label: "Guia indisponível",
    className: "border-red-400/25 bg-red-400/10 text-red-400",
    icon: AlertTriangle,
  },
};

function OriginalPage({ page, printedPage, title }: { page: number; printedPage?: string; title?: string }) {
  const [zoom, setZoom] = useState(100);
  const pdfUrl = `/api/manufacturer-guide/pdf#page=${page}`;
  const imageUrl = `/api/manufacturer-guide/pages/${page}`;

  return (
    <details className="rounded-xl border border-border/50 bg-background/30 overflow-hidden">
      <summary
        className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/20"
        data-testid={`button-expand-original-page-${page}`}
      >
        <span className="text-xs font-bold">
          Página original em inglês · PDF {page}
          {printedPage ? ` · impressa ${printedPage}` : ""}
        </span>
        <span className="text-[10px] text-muted-foreground">{title ?? "Ver fluxograma"}</span>
      </summary>
      <div className="border-t border-border/40 p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setZoom((value) => Math.max(75, value - 25))}
            aria-label={`Reduzir zoom da página ${page}`}
            data-testid={`button-zoom-out-page-${page}`}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground" data-testid={`text-zoom-page-${page}`}>{zoom}%</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setZoom((value) => Math.min(200, value + 25))}
            aria-label={`Ampliar zoom da página ${page}`}
            data-testid={`button-zoom-in-page-${page}`}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[#FF6200] hover:underline"
            data-testid={`link-open-image-page-${page}`}
          >
            Abrir imagem <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF6200] hover:underline"
            data-testid={`link-open-pdf-page-${page}`}
          >
            Abrir PDF <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="max-h-[70vh] overflow-auto rounded-lg bg-white">
          <img
            src={imageUrl}
            alt={`Página ${page} original do guia LG, em inglês`}
            className="max-w-none h-auto"
            style={{ width: `${zoom}%`, minWidth: "100%" }}
            loading="lazy"
            data-testid={`image-original-page-${page}`}
          />
        </div>
      </div>
    </details>
  );
}

export function ManufacturerGuidePanel({ guide }: { guide: ManufacturerGuide }) {
  const status = statusConfig[guide.status];
  const StatusIcon = status.icon;
  const referenceByPage = new Map(guide.references.map((reference) => [reference.page, reference]));

  return (
    <Card className="border-[#FF6200]/30 bg-card overflow-hidden" data-testid="panel-manufacturer-guide">
      <div className="px-5 py-4 border-b border-[#FF6200]/20 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#FF6200]">Diagnóstico fundamentado</p>
          <h2 className="mt-1 text-base font-black">Guia LG: testes e fluxogramas</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{guide.title}</p>
        </div>
        <span
          className={cn("inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide", status.className)}
          data-testid="status-manufacturer-guide"
        >
          <StatusIcon className="h-3.5 w-3.5" />
          {status.label}
        </span>
      </div>
      <CardContent className="p-5 sm:p-6 space-y-6">
        {guide.safetyNotice && (
          <div className="rounded-xl border border-red-400/25 bg-red-400/[0.06] p-4 flex gap-3" data-testid="notice-guide-safety">
            <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-red-400">Segurança</p>
              <p className="mt-1 text-sm leading-relaxed text-foreground/80">{guide.safetyNotice}</p>
            </div>
          </div>
        )}

        {guide.status !== "grounded" && (
          <div className="rounded-xl border border-border/50 bg-muted/15 p-4" data-testid={`message-guide-${guide.status}`}>
            <p className="text-sm font-bold">{status.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {guide.reason || "O guia do fabricante não forneceu procedimentos para este diagnóstico."}
            </p>
          </div>
        )}

        {guide.references.length > 0 && (
          <section aria-labelledby="guide-references-title">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 id="guide-references-title" className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                Referências do manual
              </h3>
              <a
                href="/api/manufacturer-guide/pdf"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#FF6200] hover:underline"
                data-testid="link-full-guide-pdf"
              >
                PDF completo <FileText className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="space-y-2">
              {guide.references.map((reference, index) => (
                <OriginalPage
                  key={`${reference.page}-${index}`}
                  page={reference.page}
                  printedPage={reference.printedPage}
                  title={reference.title}
                />
              ))}
            </div>
          </section>
        )}

        {guide.status === "grounded" && guide.procedures.length === 0 && (
          <p className="text-sm text-muted-foreground" data-testid="message-guide-no-procedures">
            Nenhum procedimento foi incluído neste diagnóstico.
          </p>
        )}

        {guide.procedures.map((procedure, procedureIndex) => (
          <section
            key={`${procedure.title}-${procedureIndex}`}
            className="rounded-2xl border border-border/50 bg-muted/[0.08] p-4 sm:p-5"
            aria-labelledby={`procedure-title-${procedureIndex}`}
            data-testid={`section-guide-procedure-${procedureIndex}`}
          >
            <h3 id={`procedure-title-${procedureIndex}`} className="text-base font-black">{procedure.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <span className="font-bold text-foreground/80">Evidência observada: </span>{procedure.evidence}
            </p>
            <ol className="mt-5 space-y-4">
              {procedure.steps.map((step, stepIndex) => {
                const reference = referenceByPage.get(step.page);
                return (
                  <li key={`${step.page}-${stepIndex}`} className="relative pl-10" data-testid={`card-guide-step-${procedureIndex}-${stepIndex}`}>
                    <span className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-[#FF6200] text-xs font-black text-white">
                      {stepIndex + 1}
                    </span>
                    <div className="rounded-xl border border-border/50 bg-card p-4">
                      <p className="text-sm font-semibold leading-relaxed">{step.instruction}</p>
                      <div className="mt-3 rounded-lg bg-muted/20 p-3">
                        <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Resultado esperado</p>
                        <p className="mt-1 text-sm leading-relaxed text-foreground/80">{step.expectedResult}</p>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] p-3">
                          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Se passar
                          </p>
                          <p className="mt-1.5 text-sm leading-relaxed text-foreground/75">{step.onPass}</p>
                        </div>
                        <div className="rounded-lg border border-red-400/20 bg-red-400/[0.06] p-3">
                          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-red-400">
                            <XCircle className="h-3.5 w-3.5" /> Se falhar
                          </p>
                          <p className="mt-1.5 text-sm leading-relaxed text-foreground/75">{step.onFail}</p>
                        </div>
                      </div>
                      <details className="mt-3 text-xs">
                        <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground" data-testid={`button-source-quote-${procedureIndex}-${stepIndex}`}>
                          Trecho original em inglês · PDF {step.page}
                          {reference ? ` · impressa ${reference.printedPage}` : ""}
                        </summary>
                        <blockquote className="mt-2 border-l-2 border-[#FF6200]/50 pl-3 italic leading-relaxed text-muted-foreground">
                          {step.sourceQuote}
                        </blockquote>
                      </details>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}