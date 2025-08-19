import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConfig } from '@/components/app/ConfigContext';
import { getStatus } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Library, Plus, X, Eye } from 'lucide-react';
import PdfViewer from '@/components/PdfViewer';

const NewUploadFlow: React.FC = () => {
  const navigate = useNavigate();
  const { apiBaseUrl } = useConfig();
  const { toast } = useToast();

  // Upload states
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [persona, setPersona] = useState('');
  const [job, setJob] = useState('');
  const [collectionId, setCollectionId] = useState<string | undefined>();
  const [phase, setPhase] = useState<'setup' | 'uploading' | 'processing' | 'ready'>('setup');
  
  // Preview states
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  // Status polling
  const { data: status } = useQuery({
    queryKey: ['collection-status', collectionId, apiBaseUrl],
    queryFn: () => getStatus(apiBaseUrl, collectionId!),
    enabled: !!apiBaseUrl && !!collectionId && phase === 'processing',
    refetchInterval: (query) => {
      const data = query.state.data as { status: string } | undefined;
      if (!data) return 1000;
      return data.status === 'ready' || data.status === 'error' ? false : 1000;
    },
  });

  useEffect(() => {
    if (status?.status === 'ready' && collectionId) {
      setPhase('ready');
      navigate(`/reader/${collectionId}`);
    }
  }, [status?.status, collectionId, navigate]);

  // Upload mutation
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async ({
      bulkFiles: bulk,
      currentFile: current,
      persona,
      job,
    }: {
      bulkFiles: File[];
      currentFile: File | null;
      persona: string;
      job: string;
    }) => {
      if (!apiBaseUrl) throw new Error('Please set API Base URL in Settings');
      
      const form = new FormData();
      
      // Add bulk files (past documents)
      bulk.forEach((f) => form.append('bulk_files', f));
      
      // Add current file (fresh document)
      if (current) {
        form.append('current_file', current);
      }
      
      form.append('persona', persona);
      form.append('job', job);
      form.append('upload_type', 'hackathon_flow'); // Signal new flow
      
      const res = await fetch(`${apiBaseUrl}/collections`, { method: 'POST', body: form });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed (${res.status})`);
      }
      return (await res.json()) as { collectionId: string };
    },
  });

  // File handlers
  const handleBulkFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const pdfs = Array.from(files).filter((f) => f.type === 'application/pdf');
    setBulkFiles(prev => [...prev, ...pdfs]);
  }, []);

  const handleCurrentFile = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const pdf = Array.from(files).find((f) => f.type === 'application/pdf');
    if (pdf) setCurrentFile(pdf);
  }, []);

  const removeBulkFile = useCallback((index: number) => {
    setBulkFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handlePreview = useCallback((file: File) => {
    setPreviewFile(file);
    setPreviewOpen(true);
  }, []);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!apiBaseUrl) {
      toast({ title: 'Set API Base URL', description: 'Open Settings to configure the API.' });
      return;
    }
    
    if (bulkFiles.length === 0) {
      toast({ title: 'No library documents', description: 'Please upload at least one PDF to your library.' });
      return;
    }
    
    if (!currentFile) {
      toast({ title: 'No current document', description: 'Please select a PDF to read.' });
      return;
    }
    
    if (!persona.trim() || !job.trim()) {
      toast({ title: 'Missing details', description: 'Please fill Persona and Job-To-Be-Done.' });
      return;
    }

    try {
      setPhase('uploading');
      const res = await mutateAsync({ bulkFiles, currentFile, persona, job });
      setCollectionId(res.collectionId);
      setPhase('processing');
    } catch (e) {
      setPhase('setup');
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      toast({ title: 'Upload failed', description: msg });
    }
  }, [apiBaseUrl, bulkFiles, currentFile, persona, job, mutateAsync, toast]);

  const isLoading = isPending || phase === 'uploading' || phase === 'processing';

  return (
    <div className="min-h-screen bg-gradient-hero p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Document Intelligence System
          </h1>
          <p className="text-lg text-muted-foreground">
            Upload your document library and select a document to read with AI-powered insights
          </p>
        </div>

        {/* Upload Steps */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Step 1: Bulk Upload (Library) */}
          <Card className="p-6 shadow-elegant">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Library className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Step 1: Upload Library</h3>
                <Badge variant="outline">Past Documents</Badge>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Upload multiple PDFs that represent your document library. These will be used to find related content.
              </p>

              <div className="space-y-3">
                <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                  <input
                    type="file"
                    multiple
                    accept=".pdf"
                    onChange={(e) => handleBulkFiles(e.target.files)}
                    className="hidden"
                    id="bulk-upload"
                  />
                  <label htmlFor="bulk-upload" className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Click to upload library PDFs</p>
                    <p className="text-xs text-muted-foreground">Multiple files supported</p>
                  </label>
                </div>

                {bulkFiles.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {bulkFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 text-red-600 flex-shrink-0" />
                          <span className="text-sm truncate" title={file.name}>
                            {file.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(file)}
                            className="h-6 w-6 p-0"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBulkFile(index)}
                            className="h-6 w-6 p-0 text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Step 2: Current Document */}
          <Card className="p-6 shadow-elegant">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold">Step 2: Current Document</h3>
                <Badge variant="outline">Fresh Upload</Badge>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Select the PDF you want to read. Text selections in this document will find related content from your library.
              </p>

              <div className="space-y-3">
                <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleCurrentFile(e.target.files)}
                    className="hidden"
                    id="current-upload"
                  />
                  <label htmlFor="current-upload" className="cursor-pointer">
                    <Plus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Click to select current PDF</p>
                    <p className="text-xs text-muted-foreground">Single file only</p>
                  </label>
                </div>

                {currentFile && (
                  <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm font-medium truncate" title={currentFile.name}>
                        {currentFile.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(currentFile)}
                        className="h-6 w-6 p-0"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentFile(null)}
                        className="h-6 w-6 p-0 text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Step 3: Context */}
        <Card className="p-6 shadow-elegant">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Step 3: Context</h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Role/Persona</label>
                <Input
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                  placeholder="e.g., Research Scientist, Business Analyst, Student"
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Job-To-Be-Done</label>
                <Input
                  value={job}
                  onChange={(e) => setJob(e.target.value)}
                  placeholder="e.g., Analyze market trends, Prepare research summary"
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Submit */}
        <div className="text-center space-y-4">
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            size="lg"
            className="px-8"
          >
            {isLoading ? 'Processing...' : 'Start Reading with AI Insights'}
          </Button>
          
          {phase === 'processing' && (
            <p className="text-sm text-muted-foreground">
              Analyzing documents and building connections... This may take a moment.
            </p>
          )}
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center">
          <div className="flex items-center gap-4">
            {(['setup', 'uploading', 'processing', 'ready'] as const).map((step, index) => (
              <div key={step} className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    phase === step
                      ? 'bg-blue-600 animate-pulse'
                      : index < (['setup', 'uploading', 'processing', 'ready'] as const).indexOf(phase)
                      ? 'bg-green-600'
                      : 'bg-muted'
                  }`}
                />
                <span className="text-xs capitalize text-muted-foreground">
                  {step === 'setup' ? 'Setup' : step}
                </span>
                {index < 3 && <div className="w-8 h-px bg-muted" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl w-full h-[80vh]">
          <DialogHeader>
            <DialogTitle>Preview: {previewFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {previewFile && <PdfViewer file={previewFile} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewUploadFlow;
