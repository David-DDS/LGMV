import {
  useListTrashedSystems,
  useRestoreSystem,
  usePermanentlyDeleteSystem,
  getListTrashedSystemsQueryKey,
  getListSystemsQueryKey,
  getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, RotateCcw, AlertTriangle, Server } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { extractApiError } from "@/lib/api-error";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";

export default function TrashPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: systems, isLoading } = useListTrashedSystems();
  const restore = useRestoreSystem();
  const purge = usePermanentlyDeleteSystem();

  const [confirmId, setConfirmId] = useState<number | null>(null);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListTrashedSystemsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListSystemsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  };

  const handleRestore = (id: number) => {
    restore.mutate({ systemId: id }, {
      onSuccess: () => {
        toast({ title: "Sistema restaurado", description: "O sistema voltou para a lista ativa." });
        invalidateAll();
      },
      onError: (err) => toast({
        title: "Erro ao restaurar",
        description: extractApiError(err, "Tente novamente."),
        variant: "destructive",
      }),
    });
  };

  const handlePurge = (id: number) => {
    purge.mutate({ systemId: id }, {
      onSuccess: () => {
        toast({ title: "Sistema excluido", description: "Todos os dados foram removidos permanentemente." });
        setConfirmId(null);
        invalidateAll();
      },
      onError: (err) => toast({
        title: "Erro ao excluir",
        description: extractApiError(err, "Tente novamente."),
        variant: "destructive",
      }),
    });
  };

  const renderRemaining = (deletedAt: string | null | undefined) => {
    if (!deletedAt) return null;
    const expiresAt = new Date(new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000);
    const days = Math.max(0, differenceInDays(expiresAt, new Date()));
    return `${days} dia${days === 1 ? "" : "s"} restantes`;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2">Sistemas VRF</p>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">Lixeira</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Sistemas movidos para a lixeira sao excluidos automaticamente apos 30 dias.
          Voce pode restaura-los antes desse prazo.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl bg-muted/30" />)}
        </div>
      ) : !systems || systems.length === 0 ? (
        <Card className="border-dashed border-border/50 bg-transparent">
          <CardContent className="flex flex-col items-center justify-center p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/20 flex items-center justify-center mb-5">
              <Trash2 className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <h3 className="text-base font-bold mb-1.5">Lixeira vazia</h3>
            <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
              Sistemas removidos aparecerao aqui antes da exclusao definitiva.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {systems.map((system) => {
            const remaining = renderRemaining(system.deletedAt);
            return (
              <Card key={system.id} className="border-border/50 bg-card">
                <CardContent className="p-4 flex items-start gap-4 flex-wrap sm:flex-nowrap">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,98,0,0.08)' }}>
                    <Server className="h-4 w-4 text-muted-foreground/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate">{system.name}</h3>
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{system.code}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-muted-foreground/70">
                      {system.deletedAt && (
                        <span>
                          Movido em {format(new Date(system.deletedAt), "d MMM yyyy", { locale: ptBR })}
                        </span>
                      )}
                      {remaining && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20 text-[10px] font-bold uppercase tracking-wide">
                          <AlertTriangle className="h-3 w-3" />
                          {remaining}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-border/50"
                      onClick={() => handleRestore(system.id)}
                      disabled={restore.isPending}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      Restaurar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-400/30 text-red-400 hover:bg-red-400/10 hover:border-red-400/50"
                      onClick={() => setConfirmId(system.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={confirmId !== null} onOpenChange={(open) => !open && setConfirmId(null)}>
        <DialogContent className="border-border/50 bg-card">
          <DialogHeader>
            <DialogTitle>Excluir permanentemente?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Esta acao nao pode ser desfeita. O sistema, todos os relatorios de partida e sessoes de leitura serao removidos definitivamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="border-border/50" onClick={() => setConfirmId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmId !== null && handlePurge(confirmId)}
              disabled={purge.isPending}
            >
              {purge.isPending ? "Excluindo..." : "Excluir Definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
