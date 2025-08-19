import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, FileText, Lightbulb } from 'lucide-react';

interface SearchResult {
  document: string;
  section_title: string;
  page_number: number;
  similarity: number;
  snippet: string;
  source: 'current' | 'library';
  collection?: string;
}

interface TextSelectionResultsProps {
  selectedText: string;
  results: SearchResult[];
  isLoading: boolean;
  onNavigateToSection: (document: string, page: number, title: string) => void;
  onClose: () => void;
}

const TextSelectionResults: React.FC<TextSelectionResultsProps> = ({
  selectedText,
  results,
  isLoading,
  onNavigateToSection,
  onClose,
}) => {
  if (!selectedText && !isLoading) {
    return null;
  }

  return (
    <Card className="p-4 space-y-4 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          <h3 className="font-semibold text-sm">Related Sections</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ×
        </Button>
      </div>
      
      {selectedText && (
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          <strong>Selected:</strong> "{selectedText.slice(0, 100)}{selectedText.length > 100 ? '...' : ''}"
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="ml-2 text-sm text-muted-foreground">Finding related sections...</span>
        </div>
      )}

      {!isLoading && results.length === 0 && selectedText && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No related sections found for the selected text.
        </div>
      )}

      {!isLoading && results.length > 0 && (
        <div className="space-y-3">
          {results.map((result, index) => (
            <Card
              key={`${result.document}-${result.page_number}-${index}`}
              className="p-3 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onNavigateToSection(result.document, result.page_number, result.section_title)}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate" title={result.section_title}>
                      {result.section_title || 'Untitled Section'}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <span className="truncate">{result.document}</span>
                      <span>•</span>
                      <span>Page {result.page_number}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Badge 
                      variant={result.source === 'current' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {result.source === 'current' ? 'Current' : 'Library'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(result.similarity * 100)}%
                    </Badge>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground line-clamp-3">
                  {result.snippet}
                </p>
                
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToSection(result.document, result.page_number, result.section_title);
                    }}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Go to section
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
};

export default TextSelectionResults;
