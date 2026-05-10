import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateSystem } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
const VrfSystemInputVrfType = {
  multi_v_5: "multi_v_5",
  multi_v_iv: "multi_v_iv",
  multi_v_iii: "multi_v_iii",
  multi_v_ii: "multi_v_ii",
} as const;
type VrfSystemInputVrfTypeValue = typeof VrfSystemInputVrfType[keyof typeof VrfSystemInputVrfType];

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

const systemSchema = z.object({
  code: z.string().min(1, "System code is required"),
  name: z.string().min(1, "System name is required"),
  location: z.string().optional(),
  model: z.string().optional(),
  vrfType: z.nativeEnum(VrfSystemInputVrfType),
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
      model: "",
      vrfType: VrfSystemInputVrfType.multi_v_5,
      startupDate: "",
      notes: "",
    },
  });

  function onSubmit(data: SystemFormValues) {
    createSystem.mutate({ data }, {
      onSuccess: (system) => {
        toast({
          title: "System created",
          description: "The VRF system has been successfully registered.",
        });
        setLocation(`/systems/${system.id}`);
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to create the system. Please try again.",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link href="/systems">
          <Button variant="outline" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Register New System</h1>
          <p className="text-muted-foreground">Add a new LG VRF system to your monitoring dashboard.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Code</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. SYS-001" {...field} />
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
                      <FormLabel>System Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Roof Unit A" {...field} />
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
                      <FormLabel>VRF Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={VrfSystemInputVrfType.multi_v_5}>Multi V 5</SelectItem>
                          <SelectItem value={VrfSystemInputVrfType.multi_v_iv}>Multi V IV</SelectItem>
                          <SelectItem value={VrfSystemInputVrfType.multi_v_iii}>Multi V III</SelectItem>
                          <SelectItem value={VrfSystemInputVrfType.multi_v_ii}>Multi V II</SelectItem>
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
                      <FormLabel>Model Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. ARUM200LTE5" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Main Building, Roof North" {...field} value={field.value || ""} />
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
                      <FormLabel>Startup Date</FormLabel>
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
                    <FormItem className="md:col-span-2">
                      <FormLabel>Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any specific configuration or installation details..." 
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

              <div className="flex justify-end pt-4">
                <Button 
                  type="submit" 
                  disabled={createSystem.isPending}
                  className="w-full md:w-auto"
                >
                  {createSystem.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Register System"
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
