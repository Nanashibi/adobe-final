import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Lightbulb, X, Zap, FileText, Brain, Sparkles, Settings } from "lucide-react";
import PdfViewer from "@/components/PdfViewer";
import { useConfig } from "@/components/app/ConfigContext";
import { searchTextSelection } from "@/services/api";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";

interface TextSelectionResultsProps {
  selectedText: string;
  explanation: string;
  isLoading: boolean;
  onClose: () => void;
}

const TextSelectionResults = ({ selectedText, explanation, isLoading, onClose }: TextSelectionResultsProps) => (
  <Card className="shadow-lg">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium flex items-center gap-2">
        <Lightbulb className="h-4 w-4" /> AI Explanation
      </CardTitle>
      <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
        <X className="h-3 w-3" />
      </Button>
    </CardHeader>
    <CardContent className="p-3 pt-0">
      <div className="text-xs text-muted-foreground mb-3 line-clamp-2 bg-muted p-2 rounded">
        Selected: "{selectedText}"
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : (
        <ScrollArea className="h-48">
          <div className="text-sm leading-relaxed pr-3">
            {explanation || "No explanation available."}
          </div>
        </ScrollArea>
      )}
    </CardContent>
  </Card>
);

export default function QuickReader() {
  const { readerId } = useParams<{ readerId: string }>();
  const navigate = useNavigate();
  const { apiBaseUrl } = useConfig();
  const [textSelection, setTextSelection] = useState<{
    text: string;
    document: string;
    page: number;
  } | null>(null);
  const [llmProvider, setLlmProvider] = useState<"openai" | "gemini">("openai");
  const [explanationMode, setExplanationMode] = useState<"pdf_context" | "general_knowledge">("general_knowledge");
  
  // Get quick reader metadata
  const { data: metadata } = useQuery({
    queryKey: ['quick-reader-metadata', readerId],
    queryFn: async () => {
      const res = await fetch(`${apiBaseUrl}/collections/${readerId}/status`);
      if (!res.ok) throw new Error('Failed to load reader');
      return res.json();
    },
    enabled: !!readerId && !!apiBaseUrl,
  });

  // Auto-determine the PDF filename for quick read
  const pdfDocument = metadata?.filename || 'document.pdf';

  // Get AI explanation for selected text
  const { data: explanation, isLoading: isExplaining } = useQuery({
    queryKey: ['text-explanation', textSelection?.text, llmProvider, explanationMode],
    queryFn: async () => {
      if (!textSelection) return null;
      
      console.log('Fetching explanation for:', textSelection.text);
      console.log('Using LLM provider:', llmProvider);
      console.log('Explanation mode:', explanationMode);
      
      // Call LLM for explanation with selected provider and mode
      const res = await fetch(`${apiBaseUrl}/explain-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedText: textSelection.text,
          currentDocument: textSelection.document,
          currentPage: textSelection.page,
          mode: explanationMode,
          llm_provider: llmProvider,
          readerId: readerId // Pass readerId for PDF context mode
        })
      });
      
      if (!res.ok) {
        console.error('Explanation request failed:', res.status, res.statusText);
        throw new Error('Failed to get explanation');
      }
      
      const data = await res.json();
      console.log('Got explanation:', data.explanation);
      return data.explanation;
    },
    enabled: !!textSelection && !!apiBaseUrl,
    staleTime: 60000, // Cache explanations for 1 minute
  });

  const handleTextSelection = useCallback((selectedText: string, currentDocument: string, currentPage: number) => {
    console.log('Text selected:', { selectedText, currentDocument, currentPage });
    if (selectedText.trim().length >= 3) {
      // Force clear any existing selection to ensure UI updates
      setTextSelection(null);
      
      // Small delay to ensure state update before setting new selection
      setTimeout(() => {
        setTextSelection({
          text: selectedText.trim(),
          document: currentDocument,
          page: currentPage,
        });
        console.log('Text selection state updated');
      }, 10);
    } else {
      console.warn('Text too short, ignoring');
    }
  }, []);

  const handleCloseTextSelection = () => {
    setTextSelection(null);
  };
  
  useEffect(() => {
    document.title = `Quick Reader - ${readerId}`;
    
    // Add keyboard shortcut for AI Explain (Ctrl+E or Cmd+E)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        
        // Find and click the AI Explain button to open the dialog
        const explainButton = document.querySelector('[data-state="closed"]');
        if (explainButton && explainButton instanceof HTMLElement) {
          explainButton.click();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [readerId]);

  if (!readerId) {
    return <div>Reader ID not found</div>;
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex flex-col">
      {/* Header */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 flex-shrink-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/')}
                className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <div className="flex items-center gap-4">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                    Quick Reader
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {metadata?.filename || readerId} • Select text for AI insights
                  </p>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-sm font-medium text-slate-900 dark:text-white">AI-Powered Reading</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Adobe PDF Technology</div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 grid grid-cols-1 xl:grid-cols-4 gap-4 p-4 min-h-0">
          {/* PDF Viewer */}
          <div className="xl:col-span-3 flex flex-col min-h-0">
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col h-full">
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 px-4 py-3 border-b border-slate-200 dark:border-slate-600 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg">
                      <FileText className="h-3 w-3" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white text-sm">PDF Viewer</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Select text for AI explanations</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      {metadata?.filename || 'Loading...'}
                      {textSelection && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          Text Selected
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 min-h-0 bg-slate-50 dark:bg-slate-900 relative">
                {metadata?.status === 'ready' ? (
                  <>
                    <div className="w-full h-full">
                      <PdfViewer
                        collectionId={readerId}
                        docName={pdfDocument}
                        page={1}
                        onTextSelection={handleTextSelection}
                      />
                    </div>
                    
                                        {/* Permanent AI buttons */}
                    {!textSelection && (
                      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
                        {/* AI Explain Dialog */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <button
                              className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-lg shadow-lg text-base font-medium flex items-center gap-2"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9"></path>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                              </svg>
                              AI Explain
                            </button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <Lightbulb className="h-5 w-5 text-yellow-500" />
                                AI Explanation Settings
                              </DialogTitle>
                            </DialogHeader>
                            
                            <div className="space-y-6 py-4">
                              {/* Text input */}
                              <div className="space-y-2">
                                <Label htmlFor="explanation-text">Text to explain</Label>
                                <textarea
                                  id="explanation-text"
                                  className="w-full min-h-[100px] p-3 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-black"
                                  placeholder="Enter or paste text from the PDF that you want explained..."
                                  autoFocus
                                />
                              </div>
                              
                              {/* LLM Provider Selection */}
                              <div className="space-y-2">
                                <Label htmlFor="llm-provider" className="flex items-center gap-2">
                                  <Settings className="h-4 w-4" />
                                  AI Provider
                                </Label>
                                <Select value={llmProvider} onValueChange={(value: "openai" | "gemini") => setLlmProvider(value)}>
                                  <SelectTrigger id="llm-provider" className="w-full">
                                    <SelectValue placeholder="Select AI provider" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="openai">OpenAI GPT-4</SelectItem>
                                    <SelectItem value="gemini">Google Gemini</SelectItem>
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Choose which AI model to use for generating the explanation
                                </p>
                              </div>
                              
                              {/* Explanation Mode Selection */}
                              <div className="space-y-2">
                                <Label htmlFor="explanation-mode" className="flex items-center gap-2">
                                  <Brain className="h-4 w-4" />
                                  Explanation Type
                                </Label>
                                <Select value={explanationMode} onValueChange={(value: "pdf_context" | "general_knowledge") => setExplanationMode(value)}>
                                  <SelectTrigger id="explanation-mode" className="w-full">
                                    <SelectValue placeholder="Select explanation type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pdf_context">From PDF Context</SelectItem>
                                    <SelectItem value="general_knowledge">From General Knowledge</SelectItem>
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Choose whether to explain using information from the PDF or general knowledge
                                </p>
                              </div>
                            </div>
                            
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                              </DialogClose>
                              <Button 
                                type="button" 
                                onClick={() => {
                                  const textElement = document.getElementById('explanation-text') as HTMLTextAreaElement;
                                  const userText = textElement?.value;
                                  if (userText && userText.trim().length > 3) {
                                    handleTextSelection(userText.trim(), pdfDocument, 1);
                                    const closeButton = document.querySelector('[data-state="open"] button[data-state="closed"]');
                                    if (closeButton && closeButton instanceof HTMLElement) {
                                      closeButton.click();
                                    }
                                  }
                                }}
                                className="bg-purple-600 hover:bg-purple-700"
                              >
                                Explain
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                      <p className="text-slate-600 dark:text-slate-400">Loading your PDF...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Assistant Panel */}
          <div className="xl:col-span-1">
            <div className="sticky top-24">
              {textSelection ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50 px-6 py-4 border-b border-slate-200 dark:border-slate-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <h3 className="font-semibold text-slate-900 dark:text-white">AI Explanation</h3>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleCloseTextSelection}
                        className="h-6 w-6 p-0 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center">
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-full">
                          {llmProvider === "openai" ? "OpenAI GPT-4" : "Google Gemini"}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-full">
                          {explanationMode === "pdf_context" ? "PDF Context" : "General Knowledge"}
                        </span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          const explainButton = document.querySelector('[data-state="closed"]');
                          if (explainButton && explainButton instanceof HTMLElement) {
                            explainButton.click();
                          }
                        }}
                        className="h-6 p-0 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        Change
                      </Button>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 mb-4">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Selected Text:</p>
                      <p className="text-sm text-slate-800 dark:text-slate-200 line-clamp-3">"{textSelection.text}"</p>
                    </div>
                    
                    {isExplaining ? (
                      <div className="space-y-3">
                        <div className="animate-pulse">
                          <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded w-full mb-2"></div>
                          <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded w-4/5 mb-2"></div>
                          <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded w-3/4"></div>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                          {explanation || "No explanation available."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50 px-6 py-4 border-b border-slate-200 dark:border-slate-600">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <h3 className="font-semibold text-slate-900 dark:text-white">AI Assistant</h3>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                      Select any text in the PDF to get instant AI-powered explanations and broader context.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-900 dark:text-white text-sm">Instant Explanations</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Get immediate context for any text</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                          <Brain className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-900 dark:text-white text-sm">Broader Knowledge</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Contextual information beyond the document</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                          <Sparkles className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-900 dark:text-white text-sm">No Setup Required</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Just select and learn</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}