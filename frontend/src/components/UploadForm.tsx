import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useConfig } from "./app/ConfigContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PdfViewer from "@/components/PdfViewer";

interface PostResult { collectionId: string }

const UploadForm = () => {
  const { apiBaseUrl } = useConfig();
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileList | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [persona, setPersona] = useState("");
  const [job, setJob] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!apiBaseUrl) throw new Error("Please set API Base URL in Settings");
      if (!files || files.length === 0) throw new Error("Please select PDFs");
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append("files", f));
      formData.append("persona", persona);
      formData.append("job", job);
      const res = await fetch(`${apiBaseUrl}/collections`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      return (await res.json()) as PostResult;
    },
    onSuccess: (data) => {
      toast({ title: "Processing started", description: "Opening reader..." });
      navigate(`/reader/${data.collectionId}`);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message ?? "Failed to upload" });
    },
  });

  return (
    <>
    <Card className="shadow-elegant">
      <CardContent className="pt-6">
        <div className="grid gap-6">
          <div className="grid gap-2">
            <Label>PDF Files</Label>
            <div className="flex items-center justify-center w-full">
              <label htmlFor="dropzone" className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer bg-secondary hover:bg-secondary/70 transition">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg className="w-8 h-8 mb-2 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  <p className="text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop PDFs</p>
                </div>
                <Input id="dropzone" className="hidden" type="file" accept="application/pdf" multiple onChange={(e) => setFiles(e.target.files)} />
              </label>
            </div>
            {files && files.length > 0 && (
              <ul className="text-sm text-muted-foreground flex flex-wrap gap-2 mt-3">
                {Array.from(files).map((f) => (
                  <li key={f.name}>
                    <button
                      type="button"
                      className="px-3 py-1 rounded-full bg-secondary text-foreground/80 hover:shadow-elegant transition"
                      onClick={() => { setPreviewFile(f); setPreviewOpen(true); }}
                    >
                      {f.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Persona</Label>
            <Input value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="e.g., Finance Manager at mid-size SaaS" />
          </div>
          <div className="grid gap-2">
            <Label>Job-To-Be-Done</Label>
            <Input value={job} onChange={(e) => setJob(e.target.value)} placeholder="e.g., Evaluate compliance requirements" />
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-3">
        <Button variant="secondary" onClick={() => { setFiles(null); setPersona(""); setJob(""); }}>Reset</Button>
        <Button variant="hero" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Uploading..." : "Process & Open Reader"}
        </Button>
      </CardFooter>
    </Card>
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
    </>
  );
};

export default UploadForm;
