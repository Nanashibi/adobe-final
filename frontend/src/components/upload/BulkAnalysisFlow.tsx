import { useCallback, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/components/app/ConfigContext";
import { getStatus } from "@/services/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PdfViewer from "@/components/PdfViewer";
import { ArrowLeft, Upload, Brain, FileText } from "lucide-react";

interface BulkAnalysisFlowProps {
  onBack: () => void;
}

const Step = ({ label, active, done }: { label: string; active?: boolean; done?: boolean }) => (
  <div className="flex items-center gap-2">
    <div
      className={
        "h-2.5 w-2.5 rounded-full transition-colors " +
        (done ? "bg-orange-500" : active ? "bg-muted-foreground" : "bg-muted")
      }
      aria-hidden
    />
    <span className={done ? "text-orange-500" : active ? "text-foreground" : "text-muted-foreground"}>{label}</span>
  </div>
);

export default function BulkAnalysisFlow({ onBack }: BulkAnalysisFlowProps) {
  const navigate = useNavigate();
  const { apiBaseUrl } = useConfig();
  const [persona, setPersona] = useState("");
  const [job, setJob] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [collectionId, setCollectionId] = useState<string | undefined>();
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "ready">("idle");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const { data: status } = useQuery({
    queryKey: ["collection-status", collectionId, apiBaseUrl],
    queryFn: () => getStatus(apiBaseUrl, collectionId!),
    enabled: !!apiBaseUrl && !!collectionId,
    refetchInterval: (query) => {
      const data = query.state.data as { status: string } | undefined;
      if (!data) return 1000;
      return data.status === "ready" || data.status === "error" ? false : 1000;
    },
  });

  useEffect(() => {
    if (status?.status === "ready" && collectionId) {
      setPhase("ready");
      navigate(`/reader/${collectionId}`);
    }
  }, [status?.status, collectionId, navigate]);

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async ({ files: pdfs, persona, job }: { files: File[]; persona: string; job: string }) => {
      if (!apiBaseUrl) throw new Error("Please set API Base URL in Settings");
      
      // Smart defaults if user doesn't provide persona/job
      const finalPersona = persona.trim() || "Knowledge Worker";
      const finalJob = job.trim() || "Extract insights and find connections across documents";
      
      const form = new FormData();
      pdfs.forEach((f) => form.append("files", f));
      form.append("persona", finalPersona);
      form.append("job", finalJob);
      form.append("upload_type", "bulk_analysis"); // Bulk analysis mode
      
      const res = await fetch(`${apiBaseUrl}/collections`, { method: "POST", body: form });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed (${res.status})`);
      }
      return (await res.json()) as { collectionId: string };
    },
  });

  const onFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const pdfs = arr.filter((f) => f.type === "application/pdf");
    if (pdfs.length === 0) return;
    setFiles(pdfs);
  }, []);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const disabled = isPending || phase === "uploading" || phase === "processing";

  return (
    <main className="min-h-[calc(100vh-2rem)] flex flex-col items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-red-950/20 dark:via-orange-950/20 dark:to-yellow-950/20">
      <div className="w-full max-w-4xl px-4">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="mb-6 hover:bg-orange-100 dark:hover:bg-orange-900/20"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to options
        </Button>

        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white">
              <Brain className="h-8 w-8" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
              Bulk Document Analysis
            </h1>
          </div>
          <p className="text-muted-foreground text-lg mb-2">
            Upload multiple PDFs for comprehensive persona-driven analysis
          </p>
          <p className="text-sm text-muted-foreground">
            Get cross-document insights, contradictions, and connections tailored to your role
          </p>
        </header>

        <section className="w-full max-w-3xl mx-auto rounded-xl border bg-card/60 backdrop-blur-sm p-6 md:p-8 shadow-lg shadow-black/20">
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <label htmlFor="persona" className="text-sm text-muted-foreground">Persona</label>
              <Input 
                id="persona" 
                placeholder="e.g. HR Director, Research Scientist (optional)" 
                value={persona} 
                onChange={(e) => setPersona(e.target.value)} 
                disabled={disabled} 
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="job" className="text-sm text-muted-foreground">Job-To-Be-Done</label>
              <Input 
                id="job" 
                placeholder="e.g. Compare policy sections across vendors (optional)" 
                value={job} 
                onChange={(e) => setJob(e.target.value)} 
                disabled={disabled} 
              />
            </div>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
            className={"relative border-2 border-dashed rounded-xl p-8 text-center transition-colors mb-6 " + 
              (disabled ? "opacity-70 cursor-not-allowed" : "hover:border-orange-300 border-orange-200")}
          >
            <input 
              ref={inputRef} 
              type="file" 
              accept="application/pdf" 
              multiple 
              className="hidden" 
              onChange={(e) => onFiles(e.target.files || [])} 
              disabled={disabled} 
            />
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center text-white">
                <Upload className="h-8 w-8" />
              </div>
              <div>
                <p className="text-lg font-medium mb-1">Drag & drop multiple PDFs here</p>
                <p className="text-sm text-muted-foreground mb-3">or</p>
                <Button 
                  variant="secondary" 
                  onClick={() => inputRef.current?.click()} 
                  disabled={disabled}
                  className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white border-0"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Browse files
                </Button>
              </div>
            </div>
            
            {files.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {files.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    className="px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs border border-orange-200 hover:bg-orange-200 transition-colors"
                    onClick={() => { setPreviewFile(f); setPreviewOpen(true); }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center mb-6">
            <Button
              variant="outline"
              onClick={() => { setFiles([]); setPersona(""); setJob(""); setCollectionId(undefined); setPhase("idle"); }}
              disabled={disabled}
            >
              Reset
            </Button>
            <Button
              variant="default"
              onClick={async () => {
                if (!apiBaseUrl) { toast({ title: "Set API Base URL", description: "Open Settings to configure the API." }); return; }
                if (!files.length) { toast({ title: "No files", description: "Please select at least one PDF." }); return; }
                try {
                  setPhase("uploading");
                  const res = await mutateAsync({ files, persona, job });
                  setCollectionId(res.collectionId);
                  setPhase("processing");
                } catch (err) {
                  setPhase("idle");
                  toast({ title: "Upload failed", description: (err as Error)?.message ?? "Something went wrong" });
                }
              }}
              disabled={disabled || !files.length}
              className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white px-8"
            >
              {disabled ? "Processing..." : "Analyze Documents"}
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Step label="Uploading" active={phase === "uploading"} done={phase === "processing" || phase === "ready"} />
            <Step label="Processing" active={phase === "processing"} done={phase === "ready"} />
            <Step label="Ready" active={phase === "ready"} done={phase === "ready"} />
          </div>
        </section>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Preview: {previewFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="h-[75vh]">
            {previewFile && (
              <PdfViewer file={previewFile} page={1} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
