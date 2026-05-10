import { useRoute, Link, useLocation } from "wouter";
import { useCreateReadingSession, getGetSystemQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

const sessionSchema = z.object({
  sessionDate: z.string().min(1, "Data obrigatoria"),
  mode: z.enum(["cooling", "heating"]),
  notes: z.string().optional(),
});

type SessionFormValues = z.infer<typeof sessionSchema>;

export default function NewSession() {
  const [, params] = useRoute("/systems/:systemId/sessions/new");
  const systemId = parseInt(params?.systemId || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createSession = useCreateReadingSession();

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
          toast({
            title: "Sessao criada",
            description: "Sessao de leitura criada. Envie as fotos do LGMV.",
          });
          queryClient.invalidateQueries({ queryKey: getGetSystemQueryKey(systemId) });
          setLocation(`/systems/${systemId}/sessions/${session.id}`);
        },
        onError: () => {
          toast({
            title: "Erro ao criar sessao",
            description: "Nao foi possivel criar a sessao. Tente novamente.",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link href={`/systems/${systemId}`}>
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Nova Sessao de Leitura</h1>
          <p className="text-muted-foreground text-sm">Registre uma nova sessao de leitura LGMV.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da Sessao</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField
                  control={form.control}
                  name="sessionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data e Hora da Leitura</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modo de Operacao</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o modo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cooling">Refrigeracao</SelectItem>
                          <SelectItem value="heating">Aquecimento</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Observacoes do Tecnico</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Condicoes ambientais, observacoes iniciais..."
                          className="resize-none h-24"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={createSession.isPending}
                  className="w-full sm:w-auto"
                >
                  {createSession.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar Sessao"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
