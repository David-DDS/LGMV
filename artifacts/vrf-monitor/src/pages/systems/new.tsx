import { useCreateSystem } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { SystemForm, SystemFormValues, defaultSystemValues } from "@/components/system-form";

export default function NewSystem() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createSystem = useCreateSystem();

  const onSubmit = (data: SystemFormValues) => {
    createSystem.mutate(
      { data },
      {
        onSuccess: (system) => {
          toast({ title: "Sistema cadastrado", description: "O sistema VRF foi registrado com sucesso." });
          setLocation(`/systems/${system.id}`);
        },
        onError: () => {
          toast({ title: "Erro ao cadastrar", description: "Nao foi possivel cadastrar o sistema.", variant: "destructive" });
        },
      }
    );
  };

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

      <Card className="border-border/50 bg-card">
        <CardContent className="p-6">
          <SystemForm
            initialValues={defaultSystemValues}
            onSubmit={onSubmit}
            isPending={createSystem.isPending}
            submitLabel="Cadastrar Sistema"
            pendingLabel="Cadastrando..."
          />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground/60 text-center">
        Apos cadastrar o sistema, voce podera anexar o relatorio de partida (PDF) na pagina de detalhes.
      </p>
    </div>
  );
}
