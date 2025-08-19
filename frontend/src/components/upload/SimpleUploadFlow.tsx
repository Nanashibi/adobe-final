import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/components/app/ConfigContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PdfViewer from "@/components/PdfViewer";
import { Upload, FileText, Brain, Zap } from "lucide-react";

export default function SimpleUploadFlow() {
  const navigate = useNavigate();
  const { apiBaseUrl } = useConfig();
  const [persona, setPersona] = useState("");
  const [job, setJob] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"bulk" | "quick" | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  // Bulk analysis mutation
  const { mutateAsync: bulkUpload, isPending: isBulkPending } = useMutation({
    mutationFn: async ({ files: pdfs, persona, job }: { files: File[]; persona: string; job: string }) => {
      if (!apiBaseUrl) throw new Error("Please set API Base URL in Settings");
      
      const finalPersona = persona.trim() || "Knowledge Worker";
      const finalJob = job.trim() || "Extract insights and find connections across documents";
      
      const form = new FormData();
      pdfs.forEach((f) => form.append("files", f));
      form.append("persona", finalPersona);
      form.append("job", finalJob);
      form.append("upload_type", "bulk_analysis");
      
      const res = await fetch(`${apiBaseUrl}/collections`, { method: "POST", body: form });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed (${res.status})`);
      }
      return (await res.json()) as { collectionId: string };
    },
  });

  // Quick read mutation
  const { mutateAsync: quickUpload, isPending: isQuickPending } = useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      if (!apiBaseUrl) throw new Error("Please set API Base URL in Settings");
      
      const form = new FormData();
      form.append("file", file);
      form.append("upload_type", "quick_read");
      
      const res = await fetch(`${apiBaseUrl}/quick-read`, { method: "POST", body: form });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed (${res.status})`);
      }
      return (await res.json()) as { readerId: string };
    },
  });

  const onFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const pdfs = arr.filter((f) => f.type === "application/pdf");
    if (pdfs.length === 0) return;
    setFiles(pdfs);
  }, []);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const disabled = isBulkPending || isQuickPending;

  return (
    <main className="min-h-[calc(100vh-2rem)] flex flex-col items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-red-950/20 dark:via-orange-950/20 dark:to-yellow-950/20">
      <header className="text-center max-w-4xl mb-8">
        <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 bg-clip-text text-transparent mb-4">
          Adobe Document Intelligence
        </h1>
        <p className="text-xl text-muted-foreground mb-2">
          Upload PDFs and get AI-powered insights with text selection
        </p>
        <p className="text-sm text-muted-foreground">
          Powered by Adobe PDF technology
        </p>
      </header>

      <section className="w-full max-w-4xl px-4">
        {/* Mode Selection */}
        {!mode && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div 
              className="p-6 rounded-xl border-2 border-dashed border-orange-200 hover:border-orange-300 bg-white/60 backdrop-blur-sm cursor-pointer transition-all hover:shadow-lg"
              onClick={() => setMode("bulk")}
            >
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center text-white">
                  <Brain className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Bulk Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload multiple PDFs for comprehensive analysis with persona-driven insights and cross-document connections
                  </p>
                </div>
              </div>
            </div>

            <div 
              className="p-6 rounded-xl border-2 border-dashed border-blue-200 hover:border-blue-300 bg-white/60 backdrop-blur-sm cursor-pointer transition-all hover:shadow-lg"
              onClick={() => setMode("quick")}
            >
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white">
                  <Zap className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Quick Read</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload a single PDF for instant reading with AI explanations when you select text
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Interface */}
        {mode && (
          <div className="max-w-3xl mx-auto rounded-xl border bg-card/60 backdrop-blur-sm p-6 md:p-8 shadow-lg shadow-black/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">
                {mode === "bulk" ? "Bulk Analysis" : "Quick Read"}
              </h2>
              <Button variant="ghost" onClick={() => { setMode(null); setFiles([]); }}>
                Change Mode
              </Button>
            </div>

            {/* Persona/Job fields for bulk mode */}
            {mode === "bulk" && (
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <label htmlFor="persona" className="text-sm text-muted-foreground">Persona (optional)</label>
                  <Input 
                    id="persona" 
                    placeholder="e.g. HR Director, Research Scientist" 
                    value={persona} 
                    onChange={(e) => setPersona(e.target.value)} 
                    disabled={disabled} 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="job" className="text-sm text-muted-foreground">Job-To-Be-Done (optional)</label>
                  <Input 
                    id="job" 
                    placeholder="e.g. Compare policy sections across vendors" 
                    value={job} 
                    onChange={(e) => setJob(e.target.value)} 
                    disabled={disabled} 
                  />
                </div>
              </div>
            )}

            {/* File Upload */}
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
                multiple={mode === "bulk"}
                className="hidden" 
                onChange={(e) => onFiles(e.target.files || [])} 
                disabled={disabled} 
              />
              <div className="space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center text-white">
                  <Upload className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-lg font-medium mb-1">
                    {mode === "bulk" ? "Drop multiple PDFs here" : "Drop your PDF here"}
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">or</p>
                  <Button 
                    variant="secondary" 
                    onClick={() => inputRef.current?.click()} 
                    disabled={disabled}
                    className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white border-0"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {mode === "bulk" ? "Browse Files" : "Choose PDF"}
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

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                onClick={() => { setFiles([]); setPersona(""); setJob(""); }}
                disabled={disabled}
              >
                Clear
              </Button>
              <Button
                variant="default"
                onClick={async () => {
                  if (!apiBaseUrl) { toast({ title: "Set API Base URL", description: "Open Settings to configure the API." }); return; }
                  if (!files.length) { toast({ title: "No files", description: "Please select at least one PDF." }); return; }
                  
                  try {
                    if (mode === "bulk") {
                      const res = await bulkUpload({ files, persona, job });
                      // For bulk analysis, wait a moment then navigate to reader
                      toast({ title: "Processing started", description: "Your documents are being analyzed..." });
                      setTimeout(() => {
                        navigate(`/reader/${res.collectionId}`);
                      }, 2000);
                    } else {
                      const res = await quickUpload({ file: files[0] });
                      navigate(`/quick-reader/${res.readerId}`);
                    }
                  } catch (err) {
                    toast({ title: "Upload failed", description: (err as Error)?.message ?? "Something went wrong" });
                  }
                }}
                disabled={disabled || !files.length || (mode === "quick" && files.length > 1)}
                className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white px-8"
              >
                {disabled ? "Processing..." : mode === "bulk" ? "Analyze Documents" : "Start Reading"}
              </Button>
            </div>

            {/* Quick mode warning */}
            {mode === "quick" && files.length > 1 && (
              <p className="text-sm text-amber-600 mt-2 text-center">
                Quick Read mode only supports one PDF. Please select a single file.
              </p>
            )}
          </div>
        )}
      </section>

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
