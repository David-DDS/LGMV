import { useRoute, Link } from "wouter";
import { 
  useGetReadingSession, 
  useGetSystem,
  useAnalyzeReadingSession,
  getGetReadingSessionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HealthBadge } from "@/components/health-badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowLeft, BrainCircuit, Activity, AlertTriangle, AlertCircle, FileImage, Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
export default function ReadingSessionDetail() {
  const [, params] = useRoute("/systems/:systemId/sessions/:sessionId");
  const systemId = parseInt(params?.systemId || "0", 10);
  const sessionId = parseInt(params?.sessionId || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: system } = useGetSystem(systemId, {
    query: { enabled: !!systemId }
  });

  const { data: session, isLoading } = useGetReadingSession(systemId, sessionId, {
    query: { enabled: !!systemId && !!sessionId }
  });

  const analyzeSession = useAnalyzeReadingSession();

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const response = await fetch(`/api/systems/${systemId}/sessions/${sessionId}/photos`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      
      toast({
        title: "Photo uploaded",
        description: "The reading photo has been added to the session.",
      });
      
      queryClient.invalidateQueries({ queryKey: getGetReadingSessionQueryKey(systemId, sessionId) });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "There was an error uploading the photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleAnalyze = () => {
    analyzeSession.mutate({ systemId, sessionId }, {
      onSuccess: () => {
        toast({
          title: "Analysis complete",
          description: "The AI has finished analyzing the LGMV readings.",
        });
        queryClient.invalidateQueries({ queryKey: getGetReadingSessionQueryKey(systemId, sessionId) });
      },
      onError: () => {
        toast({
          title: "Analysis failed",
          description: "There was an error analyzing the session. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  if (isLoading || !session) {
    return <SessionDetailSkeleton />;
  }

  // Parse analysis result if available
  let analysisData = null;
  if (session.analysisResult) {
    try {
      analysisData = JSON.parse(session.analysisResult);
    } catch (e) {
      console.error("Failed to parse analysis result");
    }
  }

  const getReadingStatusStyle = (status: string) => {
    switch (status) {
      case "normal": return "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/20";
      case "warning": return "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20";
      case "critical": return "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/20";
      default: return "";
    }
  };

  const getDeviationStyle = (dev?: number | null) => {
    if (dev === null || dev === undefined) return "";
    if (Math.abs(dev) > 15) return "text-red-600 font-semibold";
    if (Math.abs(dev) > 10) return "text-amber-600 font-medium";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/systems/${systemId}`}>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Session {format(new Date(session.sessionDate), 'MMM d, yyyy')}</h1>
              <HealthBadge status={session.healthStatus} />
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              System: <Link href={`/systems/${systemId}`} className="hover:underline font-medium text-foreground">{system?.name || `ID ${systemId}`}</Link> • Mode: <span className="uppercase font-medium">{session.mode}</span>
            </p>
          </div>
        </div>

        <Button 
          onClick={handleAnalyze} 
          disabled={analyzeSession.isPending || !session.readings || session.readings.length === 0}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {analyzeSession.isPending ? (
            <span className="flex items-center">
              <div className="h-4 w-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analyzing...
            </span>
          ) : (
            <span className="flex items-center">
              <BrainCircuit className="h-4 w-4 mr-2" />
              Analyze Data
            </span>
          )}
        </Button>
      </div>

      {analysisData && (
        <div className="grid gap-6 md:grid-cols-3 mb-6">
          <Card className="md:col-span-2 border-indigo-200 dark:border-indigo-900 shadow-md">
            <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/50 pb-4">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                <BrainCircuit className="h-5 w-5" />
                <CardTitle className="text-lg">AI Analysis Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-base leading-relaxed mb-6">{analysisData.summary}</p>
              
              <div className="space-y-4">
                {analysisData.insights && analysisData.insights.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center text-sm">
                      <Activity className="h-4 w-4 mr-2 text-muted-foreground" />
                      Key Insights
                    </h4>
                    <ul className="space-y-1.5 list-disc list-inside text-sm text-muted-foreground ml-1">
                      {analysisData.insights.map((insight: string, i: number) => (
                        <li key={i}>{insight}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {analysisData.recommendations && analysisData.recommendations.length > 0 && (
                  <div className="pt-2">
                    <h4 className="font-medium mb-2 flex items-center text-sm">
                      <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
                      Recommendations
                    </h4>
                    <ul className="space-y-2">
                      {analysisData.recommendations.map((rec: string, i: number) => (
                        <li key={i} className="flex gap-3 bg-muted/50 p-3 rounded-md border text-sm">
                          <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">{i+1}</div>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Session Photos</CardTitle>
              <CardDescription>LGMV screenshots</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {session.photos && session.photos.map((photo) => (
                    <div key={photo.id} className="relative aspect-[4/3] rounded-md overflow-hidden border bg-muted group">
                      {photo.fileUrl ? (
                        <img src={photo.fileUrl} alt="LGMV screenshot" className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileImage className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <div 
                    className="relative aspect-[4/3] rounded-md overflow-hidden border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:border-border transition-colors cursor-pointer"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {isUploading ? (
                      <div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin mb-2" />
                    ) : (
                      <Upload className="h-6 w-6 mb-2" />
                    )}
                    <span className="text-xs font-medium">Add Photo</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={photoInputRef}
                      onChange={handleUploadPhoto}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!analysisData && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">LGMV Readings</h2>
          <div>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={photoInputRef}
              onChange={handleUploadPhoto}
            />
            <Button variant="outline" onClick={() => photoInputRef.current?.click()} disabled={isUploading}>
              {isUploading ? "Uploading..." : "Upload Photo"}
            </Button>
          </div>
        </div>
      )}

      {(!session.readings || session.readings.length === 0) ? (
        <Card className="border-dashed bg-transparent shadow-none">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <FileImage className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">No reading data yet</h3>
            <p className="text-muted-foreground max-w-sm mb-6">Upload photos of the LGMV app to automatically extract and analyze parameter readings.</p>
            <Button onClick={() => photoInputRef.current?.click()} disabled={isUploading}>
              <Upload className="h-4 w-4 mr-2" />
              Upload LGMV Screenshots
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[300px]">Parameter</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="hidden md:table-cell">Baseline</TableHead>
                  <TableHead className="hidden lg:table-cell">Deviation</TableHead>
                  <TableHead className="hidden sm:table-cell">Normal Range</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {session.readings.map((reading) => (
                  <TableRow key={reading.id} className={getReadingStatusStyle(reading.status)}>
                    <TableCell className="font-medium">{reading.parameter}</TableCell>
                    <TableCell>
                      {reading.value !== null && reading.value !== undefined ? (
                        <span className="font-semibold">{reading.value} <span className="text-xs font-normal text-muted-foreground ml-1">{reading.unit}</span></span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {reading.baselineValue !== null && reading.baselineValue !== undefined ? reading.baselineValue : "-"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {reading.deviationPercent !== null && reading.deviationPercent !== undefined ? (
                        <span className={getDeviationStyle(reading.deviationPercent)}>
                          {reading.deviationPercent > 0 ? "+" : ""}{reading.deviationPercent}%
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground font-mono">
                      {(reading.minNormal !== null && reading.maxNormal !== null) ? (
                        `${reading.minNormal} - ${reading.maxNormal}`
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {reading.status === "normal" && <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400 dark:border-emerald-800">Normal</Badge>}
                      {reading.status === "warning" && <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/50 dark:text-amber-400 dark:border-amber-800">Warning</Badge>}
                      {reading.status === "critical" && <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-400 dark:border-red-800">Critical</Badge>}
                      {reading.status === "unknown" && <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">Unknown</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

function SessionDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
