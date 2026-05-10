import { useRoute, Link, useLocation } from "wouter";
import { 
  useGetSystem, 
  useGetSystemSummary, 
  useListStartupReports, 
  useListReadingSessions, 
  useDeleteSystem,
  getGetSystemQueryKey,
  getGetSystemSummaryQueryKey,
  getListStartupReportsQueryKey,
  getListReadingSessionsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HealthBadge } from "@/components/health-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ArrowLeft, MapPin, Server, Calendar, Upload, FileText, Activity, Trash2, Plus, AlertCircle, FilePlus, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getModeColor } from "@/lib/status-colors";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function SystemDetail() {
  const [, params] = useRoute("/systems/:systemId");
  const systemId = parseInt(params?.systemId || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: system, isLoading: isLoadingSystem } = useGetSystem(systemId, {
    query: { enabled: !!systemId }
  });
  
  const { data: summary, isLoading: isLoadingSummary } = useGetSystemSummary(systemId, {
    query: { enabled: !!systemId }
  });

  const { data: reports, isLoading: isLoadingReports } = useListStartupReports(systemId, {
    query: { enabled: !!systemId }
  });

  const { data: sessions, isLoading: isLoadingSessions } = useListReadingSessions(systemId, {
    query: { enabled: !!systemId }
  });

  const deleteSystem = useDeleteSystem();

  const handleUploadReport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/systems/${systemId}/startup-reports`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      
      toast({
        title: "Report uploaded",
        description: "The startup report has been uploaded and is being processed.",
      });
      
      queryClient.invalidateQueries({ queryKey: getListStartupReportsQueryKey(systemId) });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "There was an error uploading the report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = () => {
    deleteSystem.mutate({ systemId }, {
      onSuccess: () => {
        toast({ title: "System deleted" });
        setLocation("/systems");
      },
      onError: () => {
        toast({
          title: "Delete failed",
          description: "There was an error deleting the system.",
          variant: "destructive",
        });
      }
    });
  };

  if (isLoadingSystem || !system) {
    return <SystemDetailSkeleton />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/systems">
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{system.name}</h1>
              <HealthBadge status={system.healthStatus} />
            </div>
            <p className="text-muted-foreground font-mono text-sm mt-1">{system.code}</p>
          </div>
        </div>
        
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete System
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Are you sure?</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete the system
                and all of its startup reports and reading sessions.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteSystem.isPending}>
                {deleteSystem.isPending ? "Deleting..." : "Delete System"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>System Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Model</p>
                <p className="text-base mt-1 flex items-center">
                  <Server className="h-4 w-4 mr-2 text-muted-foreground" />
                  {system.model || "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">VRF Type</p>
                <p className="text-base mt-1 uppercase">
                  {system.vrfType.replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Location</p>
                <p className="text-base mt-1 flex items-center">
                  <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                  {system.location || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Startup Date</p>
                <p className="text-base mt-1 flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                  {system.startupDate ? format(new Date(system.startupDate), 'MMM d, yyyy') : "Not specified"}
                </p>
              </div>
              {system.notes && (
                <div className="col-span-2 mt-2">
                  <p className="text-sm font-medium text-muted-foreground">Notes</p>
                  <div className="mt-1 p-3 bg-muted rounded-md text-sm border">
                    {system.notes}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Total Diagnostic Sessions</p>
              <div className="text-3xl font-bold flex items-center">
                <Activity className="h-6 w-6 mr-2 text-primary" />
                {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : summary?.totalSessions || 0}
              </div>
            </div>
            
            {summary?.latestAnalysis && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Latest AI Insight</p>
                <div className="p-3 bg-muted rounded-md text-sm border line-clamp-3">
                  {summary.latestAnalysis}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex">
          <TabsTrigger value="sessions">Diagnostic Sessions</TabsTrigger>
          <TabsTrigger value="reports">Startup Reports</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sessions" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Diagnostic Sessions</h2>
            <Link href={`/systems/${systemId}/sessions/new`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Session
              </Button>
            </Link>
          </div>

          {isLoadingSessions ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : !sessions || sessions.length === 0 ? (
            <Card className="border-dashed bg-transparent shadow-none">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <Activity className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <h3 className="font-medium">No sessions recorded</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Create a new diagnostic session to start monitoring performance.</p>
                <Link href={`/systems/${systemId}/sessions/new`}>
                  <Button variant="outline">Create Session</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {sessions.map((session) => (
                <Link key={session.id} href={`/systems/${systemId}/sessions/${session.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                          <span className="font-semibold text-lg">{format(new Date(session.sessionDate), 'MMM d, yyyy')}</span>
                          <span className="text-sm text-muted-foreground">{format(new Date(session.sessionDate), 'h:mm a')}</span>
                        </div>
                        
                        <div className="hidden md:flex gap-3 items-center">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full uppercase border ${getModeColor(session.mode)}`}>
                            {session.mode}
                          </span>
                          <HealthBadge status={session.healthStatus} />
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="md:hidden flex flex-col items-end gap-2">
                          <HealthBadge status={session.healthStatus} showDot={false} className="text-[10px] px-1.5 py-0" />
                          <span className="text-xs uppercase text-muted-foreground">{session.mode}</span>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="reports" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Startup Reports</h2>
            <div>
              <input 
                type="file" 
                accept="application/pdf" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleUploadReport}
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                {isUploading ? (
                  <span className="flex items-center">
                    <div className="h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload PDF Report
                  </span>
                )}
              </Button>
            </div>
          </div>

          {isLoadingReports ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !reports || reports.length === 0 ? (
            <Card className="border-dashed bg-transparent shadow-none">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <FilePlus className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <h3 className="font-medium">No startup reports</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Upload a PDF startup report to establish a baseline for this system.</p>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Upload Report</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {reports.map((report) => (
                <Card key={report.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-muted rounded-md text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{report.filename}</p>
                        <p className="text-xs text-muted-foreground">Uploaded {format(new Date(report.uploadedAt), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                    <div>
                      {report.processingStatus === 'pending' || report.processingStatus === 'processing' ? (
                        <div className="flex items-center text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                          <div className="h-3 w-3 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Processing
                        </div>
                      ) : report.processingStatus === 'done' ? (
                        <div className="flex items-center text-sm text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                          <Activity className="h-3 w-3 mr-1.5" />
                          Analyzed
                        </div>
                      ) : (
                        <div className="flex items-center text-sm text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-200">
                          <AlertCircle className="h-3 w-3 mr-1.5" />
                          Error processing
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SystemDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="md:col-span-2 h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
