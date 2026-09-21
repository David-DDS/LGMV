import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { readErrorFromResponse } from "@/lib/api-error";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export function TechnicalReportButton({ systemId, sessionId }: { systemId: number; sessionId?: number }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [download, setDownload] = useState<{ url: string; filename: string } | null>(null);
  const { toast } = useToast();

  async function generate() {
    setBusy(true);
    try {
      const query = sessionId ? `?sessionId=${sessionId}` : "";
      const response = await fetch(`/api/systems/${systemId}/technical-report${query}`);
      if (!response.ok) {
        throw new Error(await readErrorFromResponse(response, "Não foi possível gerar o relatório."));
      }
      const blob = await response.blob();
      if (download) URL.revokeObjectURL(download.url);
      const url = URL.createObjectURL(blob);
      const filename = `relatorio-tecnico-sistema-${systemId}${sessionId ? `-sessao-${sessionId}` : ""}.docx`;
      setDownload({ url, filename });
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      toast({ title: "Relatório Word gerado", description: "O arquivo está pronto para baixar e editar." });
    } catch (error) {
      toast({
        title: "Falha ao exportar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  function changeOpen(next: boolean) {
    if (busy) return;
    setOpen(next);
    if (!next && download) {
      URL.revokeObjectURL(download.url);
      setDownload(null);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileDown className="h-4 w-4 mr-2" /> Relatório Word
      </Button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar relatório técnico</DialogTitle>
            <DialogDescription>
              Documento Word (.docx) no padrão do relatório de visita técnica.
              {sessionId ? " Inclui esta sessão de leitura." : " Inclui todas as sessões deste sistema."}
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc pl-5 text-sm space-y-2 text-muted-foreground">
            <li>Identificação do sistema, leituras e análises de IA completas.</li>
            <li>Diagnósticos, recomendações e campos para revisão e assinatura técnica.</li>
            <li>Fotos das leituras e páginas dos relatórios de startup em anexos.</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Os textos e tabelas são editáveis. Fotos e páginas dos PDFs permanecem como imagens.
            Dados ou anexos indisponíveis serão indicados no documento. A exportação utiliza as análises já salvas, sem executar uma nova análise.
          </p>
          {download && (
            <a className="text-sm underline text-primary" href={download.url} download={download.filename}>
              Baixar arquivo Word novamente
            </a>
          )}
          <Button onClick={generate} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            {busy ? "Preparando relatório e anexos…" : "Gerar e baixar Word"}
          </Button>
          {busy && <p role="status" className="text-xs text-muted-foreground">Aguarde. Relatórios com muitos anexos podem levar alguns minutos.</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}