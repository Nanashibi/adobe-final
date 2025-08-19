import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, BookOpen, Brain, X, Loader2, FileText } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { explainText } from '@/services/api';
import { useConfig } from '@/components/app/ConfigContext';

interface TextExplanationPanelProps {
  selectedText: string;
  currentDocument: string;
  currentPage: number;
  llmProvider?: string;
  explanationMode?: 'pdf_context' | 'general_knowledge';
  onClose: () => void;
}

type ExplanationMode = 'pdf_context' | 'general_knowledge';

interface ExplanationResult {
  explanation: string;
  mode: ExplanationMode;
  source: string;
}

const TextExplanationPanel: React.FC<TextExplanationPanelProps> = ({
  selectedText,
  currentDocument,
  currentPage,
  llmProvider = 'openai',
  explanationMode = 'general_knowledge',
  onClose,
}) => {
  const { apiBaseUrl } = useConfig();
  const [selectedMode, setSelectedMode] = useState<ExplanationMode | null>(null);
  const [explanation, setExplanation] = useState<ExplanationResult | null>(null);

  const explainMutation = useMutation({
    mutationFn: (mode: ExplanationMode) => 
      explainText(
        apiBaseUrl,
        mode,
        selectedText,
        currentDocument,
        currentPage,
        llmProvider
      ),
    onSuccess: (data, mode) => {
      setExplanation({
        explanation: data.explanation,
        mode,
        source: mode === 'pdf_context' ? 'PDF Context' : 'General Knowledge'
      });
    },
    onError: (error) => {
      console.error('Explanation failed:', error);
      setExplanation({
        explanation: 'Sorry, I encountered an error while generating the explanation. Please try again.',
        mode: selectedMode || explanationMode,
        source: (selectedMode || explanationMode) === 'pdf_context' ? 'PDF Context' : 'General Knowledge'
      });
    }
  });

  const handleExplain = useCallback((mode: ExplanationMode) => {
    setSelectedMode(mode);
    setExplanation(null);
    explainMutation.mutate(mode);
  }, [explainMutation]);
  
  // Auto-explain using the provided explanationMode if it exists
  React.useEffect(() => {
    if (!selectedMode && !explanation) {
      handleExplain(explanationMode);
    }
  }, [explanationMode, selectedMode, explanation, handleExplain]);

  const resetExplanation = () => {
    setSelectedMode(null);
    setExplanation(null);
  };

  return (
    <Card className="w-96 max-h-[80vh] overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            AI Text Explanation
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Selected Text Display */}
        <div className="bg-muted/50 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-muted-foreground">Selected Text</span>
          </div>
          <p className="text-sm leading-relaxed text-black">
            "{selectedText.length > 150 ? selectedText.slice(0, 150) + '...' : selectedText}"
          </p>
          <div className="text-xs text-muted-foreground mt-2">
            From: {currentDocument} • Page {currentPage}
          </div>
        </div>

        {/* Mode Selection */}
        {!explanation && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Choose explanation type:</h4>
            
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => handleExplain('pdf_context')}
              disabled={explainMutation.isPending}
            >
              <div className="flex items-start gap-3 text-left">
                <BookOpen className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Explain from PDF Context</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Use information from your uploaded documents to explain this text
                  </div>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => handleExplain('general_knowledge')}
              disabled={explainMutation.isPending}
            >
              <div className="flex items-start gap-3 text-left">
                <Brain className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Explain with General Knowledge</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Use AI's general knowledge to explain this concept
                  </div>
                </div>
              </div>
            </Button>
          </div>
        )}

        {/* Loading State */}
        {explainMutation.isPending && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">
              Generating {selectedMode === 'pdf_context' ? 'PDF context' : 'general knowledge'} explanation...
            </span>
          </div>
        )}

        {/* Explanation Result */}
        {explanation && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-xs">
                {explanation.source}
              </Badge>
              <Button variant="ghost" size="sm" onClick={resetExplanation}>
                Try Different Mode
              </Button>
            </div>
            
            <div className="bg-muted/30 p-3 rounded-lg">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {explanation.explanation}
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {explainMutation.isError && !explanation && (
          <div className="text-center py-4 text-red-600 text-sm">
            Failed to generate explanation. Please try again.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TextExplanationPanel;
