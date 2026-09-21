import { useGetSystem, useUpdateSystem, getGetSystemQueryKey, getListSystemsQueryKey } from "@workspace/api-client-react";
import { useLocation, useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { SystemForm, SystemFormValues } from "@/components/system-form";
import { useMemo } from "react";

export default function EditSystem() {
  const [, params] = useRoute("/systems/:systemId/edit");
  const systemId = parseInt(params?.systemId || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: system, isLoading } = useGetSystem(
    systemId,
    { query: { enabled: !!systemId } as never }
  );
  const updateSystem = useUpdateSystem();

  const initialValues = useMemo<Partial<SystemFormValues> | undefined>(() => {
    if (!system) return undefined;
    return {
      code: system.code,
      name: system.name,
      category: (system.category as SystemFormValues["category"]) ?? "escritorios_xp",
      building: system.building ?? "",
      condensationType: (system.condensationType as "air" | "water" | undefined) ?? undefined,
      location: system.location ?? "",
      floor: system.floor ?? "",
      servedArea: system.servedArea ?? "",
      model: system.model ?? "",
      vrfType: system.vrfType as SystemFormValues["vrfType"],
      startupDate: system.startupDate ? system.startupDate.slice(0, 10) : "",
      notes: system.notes ?? "",
    };
  }, [system]);

  const onSubmit = (data: SystemFormValues) => {
    updateSystem.mutate(
      { systemId, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSystemQueryKey(systemId) });
          queryClient.invalidateQueries({ queryKey: getListSystemsQueryKey() });
          toast({ title: "Sistema atualizado", description: "As alteracoes foram salvas." });
          setLocation(`/systems/${systemId}`);
        },
        onError: () => {
          toast({ title: "Erro ao atualizar", description: "Nao foi possivel salvar as alteracoes.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <div className="flex items-center gap-4">
        <Link href={`/systems/${systemId}`}>
          <Button variant="outline" size="icon" className="h-9 w-9 border-border/50 bg-card hover:bg-muted/30">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1">Editar Cadastro</p>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            {system?.name ?? "Carregando..."}
          </h1>
        </div>
      </div>

      <Card className="border-border/50 bg-card">
        <CardContent className="p-6">
          {isLoading || !initialValues ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full bg-muted/30" />
              <Skeleton className="h-10 w-full bg-muted/30" />
              <Skeleton className="h-10 w-full bg-muted/30" />
              <Skeleton className="h-24 w-full bg-muted/30" />
            </div>
          ) : (
            <SystemForm
              initialValues={initialValues}
              onSubmit={onSubmit}
              isPending={updateSystem.isPending}
              submitLabel="Salvar Alteracoes"
              pendingLabel="Salvando..."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
