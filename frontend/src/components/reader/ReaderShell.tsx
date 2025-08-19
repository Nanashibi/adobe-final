import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import PdfViewer from "@/components/PdfViewer";
import SectionsList from "@/components/SectionsList";
import RecommendationsList from "@/components/RecommendationsList";
import InsightsBulb from "@/components/InsightsBulb";
import PodcastPanel from "@/components/PodcastPanel";
import ChatInterface from "@/components/ChatInterface";
import TextExplanationPanel from "@/components/TextExplanationPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings, Lightbulb, Brain } from "lucide-react";
import { useConfig } from "@/components/app/ConfigContext";
import { getRecommendationsForText } from "@/services/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";

import type { CombinedResponse } from "@/types/api";

interface ReaderShellProps {
  collectionId: string;
  data: CombinedResponse;
}

export default function ReaderShell({ collectionId, data }: ReaderShellProps) {
  const { apiBaseUrl } = useConfig();
  const [selected, setSelected] = useState<{ document: string; page_number: number; section_title?: string } | null>(null);
  const [textSelection, setTextSelection] = useState<{
    text: string;
    document: string;
    page: number;
  } | null>(null);
  const [llmProvider, setLlmProvider] = useState<"openai" | "gemini">("openai");
  const [explanationMode, setExplanationMode] = useState<"pdf_context" | "general_knowledge">("general_knowledge");

  const sections = useMemo(() => {
    return [...(data.extracted_sections ?? [])].sort((a, b) => a.importance_rank - b.importance_rank);
  }, [data.extracted_sections]);

  // Auto-select the first section when data loads
  useEffect(() => {
    if (sections.length > 0 && !selected) {
      const firstSection = sections[0];
      setSelected({
        document: firstSection.document,
        page_number: firstSection.page_number,
        section_title: firstSection.section_title
      });
    }
  }, [sections, selected]);



  const onNavigate = useCallback((doc: string, page: number, title?: string) => {
    setSelected({ document: doc, page_number: page, section_title: title });
  }, []);

  const handleTextSelection = useCallback((selectedText: string, currentDocument: string, currentPage: number) => {
    console.log('🔍 Text selection triggered:', { selectedText, currentDocument, currentPage });
    if (selectedText.trim().length >= 3) {
      console.log('✅ Setting text selection state');
      setTextSelection({
        text: selectedText.trim(),
        document: currentDocument,
        page: currentPage,
      });
    } else {
      console.log('❌ Text too short:', selectedText.length);
    }
  }, []);

  const handleCloseTextSelection = useCallback(() => {
    setTextSelection(null);
  }, []);

  // Get recommendations based on selected text for AI explanation
  const { data: textRecommendations } = useQuery({
    queryKey: ['text-recommendations', collectionId, textSelection?.text],
    queryFn: () => textSelection ? getRecommendationsForText(
      apiBaseUrl,
      collectionId,
      textSelection.text,
      textSelection.document,
      textSelection.page
    ) : null,
    enabled: !!textSelection && !!apiBaseUrl && !!collectionId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Create a recommendations group structure for text-based recommendations
  const textBasedRecommendationsGroup = useMemo(() => {
    if (!textRecommendations?.recommendations || !textSelection) return [];
    
    return [{
      source: {
        document: textSelection.document,
        section_title: `Selected: "${textSelection.text.slice(0, 50)}${textSelection.text.length > 50 ? '...' : ''}"`,
        page_number: textSelection.page
      },
      recommendations: textRecommendations.recommendations
    }];
  }, [textRecommendations, textSelection]);

  const selectedHighlight = useMemo(() => {
    if (!selected) return undefined;
    const match = (data.subsection_analysis || []).find(
      (s) => s.document === selected.document && s.page_number === selected.page_number
    );
    const parts = [selected.section_title || "", match?.refined_text || ""]
      .filter(Boolean)
      .join(". ");
    return parts || selected.section_title || undefined;
  }, [selected, data.subsection_analysis]);

  return (
    <div className="min-h-screen grid grid-cols-[360px_1fr_320px]">
      <aside className="border-r p-4 overflow-y-auto">
        <Tabs defaultValue="sections" className="w-full">
          <TabsList className="flex w-full gap-2">
            <TabsTrigger value="sections" className="whitespace-nowrap">Sections</TabsTrigger>
            <TabsTrigger value="recs" className="whitespace-nowrap">Recommendations</TabsTrigger>
            <TabsTrigger value="library" className="whitespace-nowrap">Library</TabsTrigger>
          </TabsList>
          <TabsContent value="sections">
            <SectionsList sections={sections} onSelect={(doc, page, title) => setSelected({ document: doc, page_number: page, section_title: title })} />
          </TabsContent>
          <TabsContent value="recs">
            {textSelection && textBasedRecommendationsGroup.length > 0 ? (
              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-600 px-2">
                  Recommendations based on your selected text:
                </div>
                <RecommendationsList groups={textBasedRecommendationsGroup} onSelect={onNavigate} />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-600 px-2">
                  Document recommendations:
                </div>
                <RecommendationsList groups={data.recommendations ?? []} onSelect={onNavigate} />
              </div>
            )}
          </TabsContent>
          <TabsContent value="library">
            <RecommendationsList groups={data.library ?? []} onSelect={onNavigate} />
          </TabsContent>
        </Tabs>
      </aside>

      <section className="relative p-4">
        <div className="h-[calc(100vh-2rem)] flex flex-col">
          <div className="flex-1 min-h-0">
            <PdfViewer 
              collectionId={collectionId} 
              docName={selected?.document} 
              page={selected?.page_number} 
              highlight={selectedHighlight}
              onTextSelection={handleTextSelection}
            />
          </div>
          
          {/* Text explanation panel overlay */}
          {textSelection ? (
            <div className="absolute top-4 right-4 z-10">
              <TextExplanationPanel
                selectedText={textSelection.text}
                currentDocument={textSelection.document}
                currentPage={textSelection.page}
                llmProvider={llmProvider}
                explanationMode={explanationMode}
                onClose={handleCloseTextSelection}
              />
            </div>
          ) : (
            /* AI Explain Dialog - only shown when no text selection active */
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
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
                          setTextSelection({
                            text: userText.trim(),
                            document: selected?.document || 'unknown',
                            page: selected?.page_number || 1,
                          });
                          // Close the dialog
                          const closeButton = document.querySelector('[data-radix-collection-item] button[data-state="closed"]');
                          if (closeButton && closeButton instanceof HTMLElement) {
                            closeButton.click();
                          } else {
                            // Alternative approach - close any open dialog
                            const dialogCloseButtons = document.querySelectorAll('[data-radix-dialog-close]');
                            if (dialogCloseButtons.length > 0) {
                              (dialogCloseButtons[0] as HTMLElement).click();
                            }
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
        </div>
      </section>

      <aside className="border-l p-4 overflow-y-auto">
        <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center mb-2">
            <Settings className="h-4 w-4 mr-2" />
            AI Provider for Insights & Chat
          </Label>
          <Select value={llmProvider} onValueChange={(value: "openai" | "gemini") => setLlmProvider(value)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI GPT-4</SelectItem>
              <SelectItem value="gemini">Google Gemini</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Choose AI model for generating insights and answering questions
          </p>
        </div>
        
        <Tabs defaultValue="insights" className="w-full h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="podcast">Podcast</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
          </TabsList>
          <TabsContent value="insights" className="mt-3 flex-1">
            <InsightsBulb collectionId={collectionId} llmProvider={llmProvider} />
          </TabsContent>
          <TabsContent value="podcast" className="mt-3 flex-1">
            <PodcastPanel collectionId={collectionId} />
          </TabsContent>
          <TabsContent value="chat" className="mt-3 flex-1">
            <ChatInterface collectionId={collectionId} llmProvider={llmProvider} />
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  );
}


