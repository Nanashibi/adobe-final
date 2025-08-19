import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/components/app/ConfigContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PdfViewer from "@/components/PdfViewer";
import { Upload, FileText, Brain, Zap, Sparkles, Users, Target, ArrowRight } from "lucide-react";

export default function BeautifulUploadFlow() {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 py-16">
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
                <Sparkles className="h-12 w-12" />
              </div>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-4 tracking-tight">
              Adobe Document Intelligence
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-2 font-light">
              Transform your PDFs with AI-powered insights
            </p>
            <p className="text-white/70 text-lg">
              Powered by Adobe PDF Embed API • Built for Adobe Hackathon 2025
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-16">
        {/* Mode Selection */}
        {!mode && (
          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div 
              className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-800 shadow-2xl shadow-orange-100 dark:shadow-orange-900/20 border border-orange-100 dark:border-orange-800/50 hover:shadow-3xl hover:shadow-orange-200 dark:hover:shadow-orange-900/30 transition-all duration-500 cursor-pointer transform hover:-translate-y-2"
              onClick={() => setMode("bulk")}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-red-950/20 dark:via-orange-950/20 dark:to-yellow-950/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative p-8">
                <div className="flex items-center mb-6">
                  <div className="p-4 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-2xl mr-4">
                    <Brain className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Deep Analysis</h3>
                    <p className="text-slate-600 dark:text-slate-300">Multi-document insights</p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center text-slate-700 dark:text-slate-300">
                    <Users className="h-5 w-5 text-orange-500 mr-3" />
                    <span>Persona-driven analysis</span>
                  </div>
                  <div className="flex items-center text-slate-700 dark:text-slate-300">
                    <Target className="h-5 w-5 text-orange-500 mr-3" />
                    <span>Job-specific insights</span>
                  </div>
                  <div className="flex items-center text-slate-700 dark:text-slate-300">
                    <FileText className="h-5 w-5 text-orange-500 mr-3" />
                    <span>Cross-document connections</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Multiple PDFs</span>
                  <ArrowRight className="h-5 w-5 text-orange-500 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>

            <div 
              className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-800 shadow-2xl shadow-blue-100 dark:shadow-blue-900/20 border border-blue-100 dark:border-blue-800/50 hover:shadow-3xl hover:shadow-blue-200 dark:hover:shadow-blue-900/30 transition-all duration-500 cursor-pointer transform hover:-translate-y-2"
              onClick={() => setMode("quick")}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 dark:from-blue-950/20 dark:via-cyan-950/20 dark:to-teal-950/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative p-8">
                <div className="flex items-center mb-6">
                  <div className="p-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-2xl mr-4">
                    <Zap className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Quick Read</h3>
                    <p className="text-slate-600 dark:text-slate-300">Instant AI assistance</p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center text-slate-700 dark:text-slate-300">
                    <Zap className="h-5 w-5 text-blue-500 mr-3" />
                    <span>Instant PDF reading</span>
                  </div>
                  <div className="flex items-center text-slate-700 dark:text-slate-300">
                    <Sparkles className="h-5 w-5 text-blue-500 mr-3" />
                    <span>Text selection AI</span>
                  </div>
                  <div className="flex items-center text-slate-700 dark:text-slate-300">
                    <Brain className="h-5 w-5 text-blue-500 mr-3" />
                    <span>Contextual explanations</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Single PDF</span>
                  <ArrowRight className="h-5 w-5 text-blue-500 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Interface */}
        {mode && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 px-8 py-6 border-b border-slate-200 dark:border-slate-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`p-3 rounded-xl text-white mr-4 ${mode === "bulk" ? "bg-gradient-to-r from-red-500 to-orange-500" : "bg-gradient-to-r from-blue-500 to-cyan-500"}`}>
                      {mode === "bulk" ? <Brain className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {mode === "bulk" ? "Deep Analysis Setup" : "Quick Read Setup"}
                      </h2>
                      <p className="text-slate-600 dark:text-slate-300">
                        {mode === "bulk" ? "Configure your analysis parameters" : "Upload and start reading instantly"}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    onClick={() => { setMode(null); setFiles([]); setPersona(""); setJob(""); }}
                    className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  >
                    Change Mode
                  </Button>
                </div>
              </div>

              <div className="p-8">
                {/* Persona/Job fields for bulk mode */}
                {mode === "bulk" && (
                  <div className="space-y-6 mb-8">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center">
                          <Users className="h-4 w-4 mr-2" />
                          Your Persona
                        </label>
                        <Input 
                          placeholder="e.g., Research Scientist, Business Analyst" 
                          value={persona} 
                          onChange={(e) => setPersona(e.target.value)} 
                          disabled={disabled}
                          className="h-12 border-slate-300 dark:border-slate-600 focus:border-orange-500 dark:focus:border-orange-400"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">Optional - helps tailor insights to your role</p>
                      </div>
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center">
                          <Target className="h-4 w-4 mr-2" />
                          Your Goal
                        </label>
                        <Input 
                          placeholder="e.g., Compare vendor policies, Research trends" 
                          value={job} 
                          onChange={(e) => setJob(e.target.value)} 
                          disabled={disabled}
                          className="h-12 border-slate-300 dark:border-slate-600 focus:border-orange-500 dark:focus:border-orange-400"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">Optional - focuses analysis on your objectives</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* File Upload */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
                  className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
                    disabled 
                      ? "opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-700" 
                      : files.length > 0
                        ? "border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-950/20"
                        : mode === "bulk"
                          ? "border-orange-300 dark:border-orange-600 hover:border-orange-400 dark:hover:border-orange-500 bg-orange-50/30 dark:bg-orange-950/10"
                          : "border-blue-300 dark:border-blue-600 hover:border-blue-400 dark:hover:border-blue-500 bg-blue-50/30 dark:bg-blue-950/10"
                  }`}
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
                  
                  <div className="space-y-6">
                    <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center text-white ${
                      files.length > 0 
                        ? "bg-gradient-to-r from-green-500 to-emerald-500"
                        : mode === "bulk"
                          ? "bg-gradient-to-r from-red-500 to-orange-500"
                          : "bg-gradient-to-r from-blue-500 to-cyan-500"
                    }`}>
                      {files.length > 0 ? (
                        <FileText className="h-10 w-10" />
                      ) : (
                        <Upload className="h-10 w-10" />
                      )}
                    </div>
                    
                    <div>
                      <p className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                        {files.length > 0 
                          ? `${files.length} PDF${files.length > 1 ? 's' : ''} ready`
                          : mode === "bulk" 
                            ? "Drop your PDFs here" 
                            : "Drop your PDF here"
                        }
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 mb-6">
                        {mode === "bulk" ? "Multiple documents for comprehensive analysis" : "Single document for instant reading"}
                      </p>
                      
                      <Button 
                        variant="outline"
                        size="lg"
                        onClick={() => inputRef.current?.click()} 
                        disabled={disabled}
                        className={`h-12 px-8 font-medium ${
                          mode === "bulk"
                            ? "border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-600 dark:text-orange-300 dark:hover:bg-orange-950/20"
                            : "border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-300 dark:hover:bg-blue-950/20"
                        }`}
                      >
                        <FileText className="h-5 w-5 mr-2" />
                        {mode === "bulk" ? "Choose PDFs" : "Choose PDF"}
                      </Button>
                    </div>
                  </div>
                  
                  {files.length > 0 && (
                    <div className="mt-8 flex flex-wrap gap-3 justify-center">
                      {files.map((f) => (
                        <button
                          key={f.name}
                          type="button"
                          className="px-4 py-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 hover:shadow-md transition-all duration-200 truncate max-w-48"
                          onClick={() => { setPreviewFile(f); setPreviewOpen(true); }}
                        >
                          📄 {f.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <Button
                    variant="outline"
                    onClick={() => { setFiles([]); setPersona(""); setJob(""); }}
                    disabled={disabled}
                    className="text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600"
                  >
                    Clear All
                  </Button>
                  
                  <Button
                    size="lg"
                    onClick={async () => {
                      if (!apiBaseUrl) { toast({ title: "Configuration Error", description: "API endpoint not configured." }); return; }
                      if (!files.length) { toast({ title: "No Files", description: "Please select at least one PDF file." }); return; }
                      
                      try {
                        if (mode === "bulk") {
                          const res = await bulkUpload({ files, persona, job });
                          toast({ title: "Analysis Started", description: "Your documents are being processed..." });
                          setTimeout(() => {
                            navigate(`/reader/${res.collectionId}`);
                          }, 2000);
                        } else {
                          const res = await quickUpload({ file: files[0] });
                          navigate(`/quick-reader/${res.readerId}`);
                        }
                      } catch (err) {
                        toast({ 
                          title: "Upload Failed", 
                          description: (err as Error)?.message ?? "Something went wrong. Please try again.",
                          variant: "destructive"
                        });
                      }
                    }}
                    disabled={disabled || !files.length || (mode === "quick" && files.length > 1)}
                    className={`h-12 px-8 font-semibold text-white ${
                      mode === "bulk"
                        ? "bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
                        : "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                    } shadow-lg hover:shadow-xl transition-all duration-300`}
                  >
                    {disabled ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                        Processing...
                      </>
                    ) : mode === "bulk" ? (
                      <>
                        <Brain className="h-5 w-5 mr-2" />
                        Start Analysis
                      </>
                    ) : (
                      <>
                        <Zap className="h-5 w-5 mr-2" />
                        Start Reading
                      </>
                    )}
                  </Button>
                </div>

                {/* Quick mode warning */}
                {mode === "quick" && files.length > 1 && (
                  <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <p className="text-sm text-amber-800 dark:text-amber-200 text-center">
                      ⚠️ Quick Read supports only one PDF at a time. Please select a single file.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-4">
          <DialogHeader className="flex-shrink-0 pb-4">
            <DialogTitle className="text-lg">Preview: {previewFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-white rounded border overflow-hidden" style={{ height: '750px', width: '100%' }}>
            {previewFile && (
              <PdfViewer file={previewFile} page={1} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
