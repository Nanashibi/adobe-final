import { CombinedResponse } from "@/types/api";

export const getCombined = async (baseUrl: string, id: string): Promise<CombinedResponse> => {
  const res = await fetch(`${baseUrl}/collections/${id}/combined`);
  if (!res.ok) throw new Error(`Failed to load collection (${res.status})`);
  return res.json();
};

export const getStatus = async (baseUrl: string, id: string): Promise<{ status: string; error?: string }> => {
  const res = await fetch(`${baseUrl}/collections/${id}/status`);
  if (!res.ok) throw new Error(`Failed to get status (${res.status})`);
  return res.json();
};

export const postCollections = async (
  baseUrl: string,
  files: FileList,
  persona: string,
  job: string
): Promise<{ collectionId: string }> => {
  const form = new FormData();
  Array.from(files).forEach((f) => form.append("files", f));
  form.append("persona", persona);
  form.append("job", job);
  const res = await fetch(`${baseUrl}/collections`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return res.json();
};

export const getPdfUrl = (baseUrl: string, collectionId: string, filename: string) =>
  `${baseUrl}/pdfs/${collectionId}/${encodeURIComponent(filename)}`;

export const getPodcast = async (
  baseUrl: string,
  id: string
): Promise<{
  status: 'not_started' | 'generating' | 'completed' | 'error';
  message?: string;
  progress?: number;
  title?: string;
  duration_estimate?: string;
  script_sections?: Array<{ speaker: string; content: string; timestamp: string }>;
  transcript?: string;
  audio_url?: string;
}> => {
  try {
    const res = await fetch(`${baseUrl}/collections/${id}/podcast`);
    if (!res.ok) {
      console.error(`Podcast API error: ${res.status}`);
      return { status: 'error', message: `API Error: ${res.status}` };
    }
    const data = await res.json();
    console.log('Podcast API response:', data);
    return data;
  } catch (error) {
    console.error('Podcast API fetch error:', error);
    return { status: 'error', message: 'Failed to connect to server' };
  }
};

export const generatePodcast = async (
  baseUrl: string,
  id: string
): Promise<{ status: string; message: string }> => {
  try {
    const res = await fetch(`${baseUrl}/collections/${id}/podcast/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Generate podcast error: ${res.status} - ${errorText}`);
      throw new Error(`Failed to start podcast generation (${res.status})`);
    }
    const data = await res.json();
    console.log('Generate podcast response:', data);
    return data;
  } catch (error) {
    console.error('Generate podcast fetch error:', error);
    throw error;
  }
};

export const getInsights = async (
  baseUrl: string,
  id: string,
  llmProvider?: string
): Promise<{
  key_insights: string[];
  did_you_know: string[];
  contradictions: string[];
  connections: string[];
  executive_summary: string;
}> => {
  const url = new URL(`${baseUrl}/collections/${id}/insights`);
  if (llmProvider) {
    url.searchParams.set('llm_provider', llmProvider);
  }
  
  console.log('Fetching insights from:', url.toString());
  console.log('LLM Provider:', llmProvider);
  
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to load insights (${res.status})`);
  
  const data = await res.json();
  console.log('Raw insights response:', data);
  console.log('Response keys:', Object.keys(data));
  console.log('Key insights length:', data.key_insights?.length);
  console.log('Executive summary:', data.executive_summary);
  
  return data;
};

export const askQuestion = async (
  baseUrl: string,
  id: string,
  question: string,
  llmProvider?: string
): Promise<{ question: string; answer: string }> => {
  const res = await fetch(`${baseUrl}/collections/${id}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, llm_provider: llmProvider }),
  });
  if (!res.ok) throw new Error(`Failed to ask question (${res.status})`);
  return res.json();
};

export const searchTextSelection = async (
  baseUrl: string,
  id: string,
  selectedText: string,
  currentDocument: string,
  currentPage: number,
  llmProvider?: string,
  contextBefore?: string,
  contextAfter?: string
): Promise<{ sections: unknown[]; snippets: unknown[] }> => {
  const res = await fetch(`${baseUrl}/collections/${id}/search-selection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      selectedText, 
      currentDocument, 
      currentPage, 
      llm_provider: llmProvider,
      contextBefore,
      contextAfter
    }),
  });
  if (!res.ok) throw new Error(`Text search failed (${res.status})`);
  return res.json();
};

export const explainText = async (
  baseUrl: string,
  mode: 'pdf_context' | 'general_knowledge',
  selectedText: string,
  currentDocument: string,
  currentPage: number,
  llmProvider?: string
): Promise<{ explanation: string }> => {
  const res = await fetch(`${baseUrl}/explain-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      selectedText, 
      mode,
      currentDocument,
      currentPage,
      llm_provider: llmProvider
    }),
  });
  if (!res.ok) throw new Error(`Text explanation failed (${res.status})`);
  return res.json();
};

export const getRecommendationsForText = async (
  baseUrl: string,
  collectionId: string,
  selectedText: string,
  currentDocument: string,
  currentPage: number
): Promise<{ recommendations: Array<{ document: string; section_title: string; page_number: number; similarity: number; snippet: string }> }> => {
  const res = await fetch(`${baseUrl}/collections/${collectionId}/recommendations-for-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      selectedText, 
      currentDocument,
      currentPage
    }),
  });
  if (!res.ok) throw new Error(`Failed to get recommendations for text (${res.status})`);
  return res.json();
};
