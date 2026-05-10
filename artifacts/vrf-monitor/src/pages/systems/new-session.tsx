import { useRoute, Link, useLocation } from "wouter";
import { useCreateReadingSession, useListStartupReports, getGetSystemQueryKey } from "@workspace/api-client-react";
import { extractApiError } from "@/lib/api-error";
import { AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

const sessionSchema = z.object({
  sessionDate: z.string().min(1, "Data obrigatoria"),
  mode: z.enum(["cooling", "heating"]),
  notes: z.string().optional(),
});
type SessionFormValues = z.infer<typeof sessionSchema>;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <FormLabel className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
      {children}
    </FormLabel>
  );
}

export default function NewSession() {
  const [, params] = useRoute("/systems/:systemId/sessions/new");
  const systemId = parseInt(params?.systemId || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createSession = useCreateReadingSession();
  const { data: startupReports } = useListStartupReports(systemId, { query: { enabled: !!systemId } as never });
  const hasBaseline = (startupReports ?? []).some((r) => r.processingStatus === "done" && r.extractedData);
  const baselineProcessing = (startupReports ?? []).some((r) => r.processingStatus === "processing" || r.processingStatus === "pending");

  const form = useForm<SessionFormValues>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      sessionDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      mode: "cooling",
      notes: "",
    },
  });

  function onSubmit(data: SessionFormValues) {
    createSession.mutate(
      {
        systemId,
        data: {
          sessionDate: new Date(data.sessionDate).toISOString(),
          mode: data.mode,
          notes: data.notes,
        },
      },
      {
        onSuccess: (session) => {
          toast({ title: "Sessao criada", description: "Envie as fotos do LGMV para iniciar a analise." });
          queryClient.invalidateQueries({ queryKey: getGetSystemQueryKey(systemId) });
          setLocation(`/systems/${systemId}/sessions/${session.id}`);
        },
        onError: (err) => {
          toast({ title: "Erro ao criar sessao", description: extractApiError(err, "Nao foi possivel criar a sessao."), variant: "destructive" });
        },
      }
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <div className="flex items-center gap-4">
        <Link href={`/systems/${systemId}`}>
          <Button variant="outline" size="icon" className="h-9 w-9 border-border/50 bg-card hover:bg-muted/30">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1">Nova Sessao</p>
          <h1 className="text-2xl font-black tracking-tight">Nova Sessao de Leitura</h1>
        </div>
      </div>

      {!hasBaseline && (
        <Card className="border-amber-400/30 bg-amber-400/[0.04]">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs leading-relaxed">
              <p className="font-bold text-amber-400 mb-0.5">Sem relatorio de partida cadastrado</p>
              <p className="text-muted-foreground">
                {baselineProcessing
                  ? "O relatorio de partida ainda esta sendo processado pela IA. Aguarde a conclusao antes de iniciar a analise."
                  : <>Voce pode criar a sessao, mas a analise por IA so ira funcionar apos anexar um relatorio de partida (PDF) na tela do sistema. Sem baseline a IA nao pode comparar valores. <Link href={`/systems/${systemId}`} className="underline hover:text-amber-400">Ir para o sistema</Link>.</>}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 bg-card">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/40">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarDays className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-bold">Dados da Sessao</span>
        </div>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField control={form.control} name="sessionDate" render={({ field }) => (
                  <FormItem>
                    <FieldLabel>Data e Hora da Leitura</FieldLabel>
                    <FormControl>
                      <Input type="datetime-local" className="bg-muted/20 border-border/50" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="mode" render={({ field }) => (
                  <FormItem>
                    <FieldLabel>Modo de Operacao</FieldLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted/20 border-border/50">
                          <SelectValue placeholder="Selecione o modo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cooling">Refrigeracao</SelectItem>
                        <SelectItem value="heating">Aquecimento</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FieldLabel>Observacoes do Tecnico</FieldLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Condicoes ambientais, observacoes iniciais..."
                      className="bg-muted/20 border-border/50 resize-none h-28"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={createSession.isPending}
                  className="w-full sm:w-auto font-bold px-8"
                  style={{ background: 'linear-gradient(135deg, #FF6200, #FF8C42)' }}
                >
                  {createSession.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</>
                  ) : "Criar Sessao"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
