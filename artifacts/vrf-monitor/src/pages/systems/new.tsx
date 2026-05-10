import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateSystem } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Server, Building2, Droplets, Wind } from "lucide-react";
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
  building: z.string().optional(),
  condensationType: z.enum(["air", "water"]).optional(),
  location: z.string().optional(),
  floor: z.string().optional(),
  servedArea: z.string().optional(),
  model: z.string().optional(),
  vrfType: z.enum(["multi_v_5", "multi_v_iv", "multi_v_iii", "multi_v_ii"]),
  startupDate: z.string().optional(),
  notes: z.string().optional(),
});
type SystemFormValues = z.infer<typeof systemSchema>;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <FormLabel className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
      {children}
    </FormLabel>
  );
}

function SectionHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 pb-1">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color ? `${color}18` : 'rgba(255,98,0,0.12)' }}>
        <Icon className="h-3.5 w-3.5" style={{ color: color ?? '#FF6200' }} />
      </div>
      <span className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground/70">{title}</span>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  );
}

export default function NewSystem() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createSystem = useCreateSystem();

  const form = useForm<SystemFormValues>({
    resolver: zodResolver(systemSchema),
    defaultValues: {
      code: "", name: "", building: "", location: "", floor: "", servedArea: "",
      model: "", vrfType: "multi_v_5", startupDate: "", notes: "",
    },
  });

  function onSubmit(data: SystemFormValues) {
    createSystem.mutate({ data }, {
      onSuccess: (system) => {
        toast({ title: "Sistema cadastrado", description: "O sistema VRF foi registrado com sucesso." });
        setLocation(`/systems/${system.id}`);
      },
      onError: () => {
        toast({ title: "Erro ao cadastrar", description: "Nao foi possivel cadastrar o sistema.", variant: "destructive" });
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-7">

              {/* Edificio */}
              <div className="space-y-4">
                <SectionHeader icon={Building2} title="Edificio / Localidade" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField control={form.control} name="building" render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Nome do Edificio</FieldLabel>
                      <FormControl>
                        <Input placeholder="Escritorio RLJ" className="bg-muted/20 border-border/50" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="condensationType" render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Tipo de Condensacao</FieldLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/20 border-border/50">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="air">
                            <span className="flex items-center gap-2"><Wind className="h-3.5 w-3.5 text-cyan-400" />Condensacao a Ar</span>
                          </SelectItem>
                          <SelectItem value="water">
                            <span className="flex items-center gap-2"><Droplets className="h-3.5 w-3.5 text-sky-400" />Condensacao a Agua</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* Identificacao */}
              <div className="space-y-4">
                <SectionHeader icon={Server} title="Identificacao do Sistema" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Codigo do Sistema</FieldLabel>
                      <FormControl>
                        <Input placeholder="IST-1286-17" className="bg-muted/20 border-border/50 font-mono" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Nome / Identificacao</FieldLabel>
                      <FormControl>
                        <Input placeholder="Bloco A - Sistema 01" className="bg-muted/20 border-border/50" {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField control={form.control} name="vrfType" render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Tipo VRF</FieldLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/20 border-border/50">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(Object.entries(VRF_TYPES) as [VrfTypeKey, string][]).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="model" render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Modelo (Unidade Mestre)</FieldLabel>
                      <FormControl>
                        <Input placeholder="CRNU260LTE5" className="bg-muted/20 border-border/50 font-mono" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FieldLabel>Localizacao / Endereco</FieldLabel>
                    <FormControl>
                      <Input placeholder="Av. Presidente JK, 1909 - Vila Olimpia, SP" className="bg-muted/20 border-border/50" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField control={form.control} name="floor" render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Andar</FieldLabel>
                      <FormControl>
                        <Input placeholder="12, Cobertura, Subsolo..." className="bg-muted/20 border-border/50" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="servedArea" render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Sistema Atende</FieldLabel>
                      <FormControl>
                        <Input placeholder="Sala de reunioes, TI..." className="bg-muted/20 border-border/50" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FormField control={form.control} name="startupDate" render={({ field }) => (
                    <FormItem>
                      <FieldLabel>Data de Partida</FieldLabel>
                      <FormControl>
                        <Input type="date" className="bg-muted/20 border-border/50" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FieldLabel>Observacoes</FieldLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detalhes da instalacao, configuracoes especificas..."
                        className="bg-muted/20 border-border/50 resize-none h-24"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={createSystem.isPending}
                  className="w-full sm:w-auto font-bold px-8"
                  style={{ background: 'linear-gradient(135deg, #FF6200, #FF8C42)' }}
                >
                  {createSystem.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cadastrando...</>
                  ) : "Cadastrar Sistema"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
