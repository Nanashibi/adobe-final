import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/components/app/ConfigContext";
import { getStatus } from "@/services/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PdfViewer from "@/components/PdfViewer";

const Step = ({ label, active, done }: { label: string; active?: boolean; done?: boolean }) => (
  <div className="flex items-center gap-2">
    <div
      className={
        "h-2.5 w-2.5 rounded-full transition-colors " +
        (done ? "bg-primary" : active ? "bg-muted-foreground" : "bg-muted")
      }
      aria-hidden
    />
    <span className={done ? "text-primary" : active ? "text-foreground" : "text-muted-foreground"}>{label}</span>
  </div>
);

export default function UploadHero() {
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
      form.append("upload_type", "hackathon_flow"); // Enable new features
      
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

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (isPending) return;
      onFiles(e.dataTransfer.files);
    },
    [onFiles, isPending]
  );

  const onBrowse = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) onFiles(e.target.files);
    },
    [onFiles]
  );

  const stage = phase;

  const disabled = isPending || phase === "uploading" || phase === "processing";

  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <main className="min-h-[calc(100vh-2rem)] flex flex-col items-center justify-center">
      <header className="text-center max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3">PDF Insights Demo</h1>
        <p className="text-muted-foreground mb-8">
          Drag-and-drop multiple PDFs, describe your Persona and Job-To-Be-Done, and get section-aware insights.
        </p>
      </header>

      <section className="w-full max-w-3xl rounded-xl border bg-card/60 backdrop-blur-sm p-6 md:p-8 shadow-lg shadow-black/20">
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <label htmlFor="persona" className="text-sm text-muted-foreground">Persona</label>
            <Input id="persona" placeholder="e.g. HR Director, Mid-market (optional - smart defaults used)" value={persona} onChange={(e)=>setPersona(e.target.value)} disabled={disabled} />
          </div>
          <div className="space-y-2">
            <label htmlFor="job" className="text-sm text-muted-foreground">Job-To-Be-Done</label>
            <Input id="job" placeholder="e.g. Compare policy sections across vendors (optional)" value={job} onChange={(e)=>setJob(e.target.value)} disabled={disabled} />
          </div>
        </div>

        <div
          onDragOver={(e)=>e.preventDefault()}
          onDrop={onDrop}
          className={
            "relative border-2 border-dashed rounded-xl p-8 text-center transition-colors " +
            (disabled ? "opacity-70 cursor-not-allowed" : "hover:border-muted-foreground/50")
          }
          aria-label="PDF upload area"
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={onBrowse}
            disabled={disabled}
          />
          <div className="space-y-2">
            <p className="text-lg">Drag and drop your PDFs here</p>
            <p className="text-sm text-muted-foreground">or</p>
            <Button variant="secondary" onClick={()=>inputRef.current?.click()} disabled={disabled}>Browse files</Button>
          </div>

          {files.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {files.map((f)=> (
                <button
                  key={f.name}
                  type="button"
                  className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs border hover:shadow-elegant"
                  onClick={() => { setPreviewFile(f); setPreviewOpen(true); }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => { setFiles([]); setPersona(""); setJob(""); setCollectionId(undefined); setPhase("idle"); }}
            disabled={isPending}
          >
            Reset
          </Button>
          <Button
            variant="hero"
            onClick={async () => {
              if (!apiBaseUrl) { toast({ title: "Set API Base URL", description: "Open Settings to configure the API." }); return; }
              if (!files.length) { toast({ title: "No files", description: "Please select at least one PDF." }); return; }
              try {
                setPhase("uploading");
                const res = await mutateAsync({ files, persona, job });
                setCollectionId(res.collectionId);
                setPhase("processing");
              } catch (e) {
                setPhase("idle");
                const msg = e instanceof Error ? e.message : "Something went wrong";
                toast({ title: "Upload failed", description: msg });
              }
            }}
            disabled={isPending}
          >
            {isPending || phase === "uploading" || phase === "processing" ? "Processing..." : "Process & Open Reader"}
          </Button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4">
          <Step label="Uploading" active={stage === "uploading"} done={stage === "processing" || stage === "ready"} />
          <Step label="Processing" active={stage === "processing"} done={stage === "ready"} />
          <Step label="Ready" active={stage === "ready"} done={stage === "ready"} />
        </div>
      </section>

      <p className="sr-only">SEO: Upload PDFs and explore insights using an Adobe-powered PDF reader.</p>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
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


