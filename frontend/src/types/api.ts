export interface ExtractedSection {
  document: string;
  section_title: string;
  importance_rank: number;
  page_number: number;
}

export interface SubsectionAnalysis {
  document: string;
  refined_text: string;
  page_number: number;
}

export interface RecommendationItem {
  document: string;
  section_title: string;
  page_number: number;
  similarity: number;
  snippet: string;
}

export interface RecommendationsGroup {
  source: { document: string; section_title: string; page_number: number };
  recommendations: RecommendationItem[];
}

export interface CombinedResponse {
  metadata: Record<string, any> & { audio_url?: string; transcript?: string };
  extracted_sections: ExtractedSection[];
  subsection_analysis: SubsectionAnalysis[];
  recommendations: RecommendationsGroup[];
  library?: RecommendationsGroup[];
}
