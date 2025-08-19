import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/components/app/ConfigContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PdfViewer from "@/components/PdfViewer";
import { ArrowLeft, Upload, Zap, FileText } from "lucide-react";

interface QuickReadFlowProps {
  onBack: () => void;
}

export default function QuickReadFlow({ onBack }: QuickReadFlowProps) {
  const navigate = useNavigate();
  const { apiBaseUrl } = useConfig();
  const [file, setFile] = useState<File | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      if (!apiBaseUrl) throw new Error("Please set API Base URL in Settings");
      
      const form = new FormData();
      form.append("file", file);
      form.append("upload_type", "quick_read"); // Quick read mode
      
      const res = await fetch(`${apiBaseUrl}/quick-read`, { method: "POST", body: form });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed (${res.status})`);
      }
      return (await res.json()) as { readerId: string };
    },
  });

  const onFileSelect = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const pdf = arr.find((f) => f.type === "application/pdf");
    if (pdf) setFile(pdf);
  }, []);

  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <main className="min-h-[calc(100vh-2rem)] flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 dark:from-blue-950/20 dark:via-cyan-950/20 dark:to-teal-950/20">
      <div className="w-full max-w-4xl px-4">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="mb-6 hover:bg-blue-100 dark:hover:bg-blue-900/20"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to options
        </Button>

        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
              <Zap className="h-8 w-8" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">
              Quick Read & Explore
            </h1>
          </div>
          <p className="text-muted-foreground text-lg mb-2">
            Upload a single PDF for instant reading with AI-powered insights
          </p>
          <p className="text-sm text-muted-foreground">
            Select any text in your PDF to get AI explanations and broader context
          </p>
        </header>

        <section className="w-full max-w-2xl mx-auto rounded-xl border bg-card/60 backdrop-blur-sm p-6 md:p-8 shadow-lg shadow-black/20">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFileSelect(e.dataTransfer.files); }}
            className={"relative border-2 border-dashed rounded-xl p-12 text-center transition-colors mb-6 " + 
              (isPending ? "opacity-70 cursor-not-allowed" : "hover:border-cyan-300 border-cyan-200")}
          >
            <input 
              ref={inputRef} 
              type="file" 
              accept="application/pdf" 
              className="hidden" 
              onChange={(e) => onFileSelect(e.target.files || [])} 
              disabled={isPending} 
            />
            <div className="space-y-4">
              <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white">
                <Upload className="h-10 w-10" />
              </div>
              <div>
                <p className="text-xl font-medium mb-2">Drop your PDF here</p>
                <p className="text-sm text-muted-foreground mb-4">Single document for instant reading</p>
                <Button 
                  variant="secondary" 
                  onClick={() => inputRef.current?.click()} 
                  disabled={isPending}
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Choose PDF
                </Button>
              </div>
            </div>
            
            {file && (
              <div className="mt-6">
                <button
                  type="button"
                  className="px-4 py-2 rounded-full bg-cyan-100 text-cyan-800 text-sm border border-cyan-200 hover:bg-cyan-200 transition-colors"
                  onClick={() => setPreviewOpen(true)}
                >
                  📄 {file.name}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">What you'll get:</h3>
              <ul className="text-sm text-blue-700 dark:text-blue-200 space-y-1">
                <li>• Instant PDF reading with Adobe technology</li>
                <li>• Select any text → get AI explanations</li>
                <li>• Broader knowledge context beyond the document</li>
                <li>• No setup required - just upload and read!</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={() => setFile(null)}
              disabled={isPending}
            >
              Clear
            </Button>
            <Button
              variant="default"
              onClick={async () => {
                if (!apiBaseUrl) { toast({ title: "Set API Base URL", description: "Open Settings to configure the API." }); return; }
                if (!file) { toast({ title: "No file", description: "Please select a PDF file." }); return; }
                try {
                  const res = await mutateAsync({ file });
                  navigate(`/quick-reader/${res.readerId}`);
                } catch (err) {
                  toast({ title: "Upload failed", description: (err as Error)?.message ?? "Something went wrong" });
                }
              }}
              disabled={isPending || !file}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-8"
            >
              {isPending ? "Opening..." : "Start Reading"}
            </Button>
          </div>
        </section>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Preview: {file?.name}</DialogTitle>
          </DialogHeader>
          <div className="h-[75vh]">
            {file && (
              <PdfViewer file={file} page={1} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
