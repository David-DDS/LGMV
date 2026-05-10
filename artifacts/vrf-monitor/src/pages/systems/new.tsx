import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateSystem } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "wouter";

const VRF_TYPES = {
  multi_v_5: "Multi V 5",
  multi_v_iv: "Multi V IV",
  multi_v_iii: "Multi V III",
  multi_v_ii: "Multi V II",
} as const;
type VrfTypeKey = keyof typeof VRF_TYPES;

const systemSchema = z.object({
  code: z.string().min(1, "Codigo obrigatorio"),
  name: z.string().min(1, "Nome obrigatorio"),
  location: z.string().optional(),
  floor: z.string().optional(),
  servedArea: z.string().optional(),
  model: z.string().optional(),
  vrfType: z.enum(["multi_v_5", "multi_v_iv", "multi_v_iii", "multi_v_ii"]),
  startupDate: z.string().optional(),
  notes: z.string().optional(),
});

type SystemFormValues = z.infer<typeof systemSchema>;

export default function NewSystem() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createSystem = useCreateSystem();

  const form = useForm<SystemFormValues>({
    resolver: zodResolver(systemSchema),
    defaultValues: {
      code: "",
      name: "",
      location: "",
      floor: "",
      servedArea: "",
      model: "",
      vrfType: "multi_v_5",
      startupDate: "",
      notes: "",
    },
  });

  function onSubmit(data: SystemFormValues) {
    createSystem.mutate({ data }, {
      onSuccess: (system) => {
        toast({
          title: "Sistema cadastrado",
          description: "O sistema VRF foi registrado com sucesso.",
        });
        setLocation(`/systems/${system.id}`);
      },
      onError: () => {
        toast({
          title: "Erro ao cadastrar",
          description: "Nao foi possivel cadastrar o sistema. Tente novamente.",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link href="/systems">
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Cadastrar Sistema VRF</h1>
          <p className="text-muted-foreground text-sm">Registre um novo sistema LG VRF para monitoramento.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informacoes do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Codigo do Sistema</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: IST-1286-17" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome / Identificacao</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Bloco A - Sistema 01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vrfType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo VRF</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(Object.entries(VRF_TYPES) as [VrfTypeKey, string][]).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo (Unidade Mestre)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: CRNU260LTE5" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Localizacao / Endereco</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Av. Presidente JK, 1909 - Vila Olimpia, SP" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="floor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Andar</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 12, Cobertura, Subsolo" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="servedArea"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sistema Atende</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Sala de reunioes, TI, Diretoria" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="startupDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Partida</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Observacoes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detalhes da instalacao, configuracoes especificas..."
                          className="resize-none"
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
                  disabled={createSystem.isPending}
                  className="w-full sm:w-auto"
                >
                  {createSystem.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    "Cadastrar Sistema"
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
