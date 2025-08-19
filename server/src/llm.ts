import OpenAI from 'openai'
import { spawn } from 'node:child_process'
import path from 'node:path'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || Bun.env.OPENAI_API_KEY
})

// Helper function to call Python LLM script
export async function callLLMScript(prompt: string, temperature: number = 0.7, maxTokens: number = 1000): Promise<string> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'sample_scripts', 'chat_with_llm.py')
    const proc = spawn('python3', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => stdout += data.toString())
    proc.stderr.on('data', (data) => stderr += data.toString())

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('LLM script error:', stderr)
        reject(new Error(stderr || 'LLM script failed'))
      } else {
        resolve(stdout.trim())
      }
    })

    // Send input to script
    proc.stdin.write(JSON.stringify({
      prompt,
      temperature,
      max_tokens: maxTokens
    }))
    proc.stdin.end()

    // Timeout after 30 seconds
    setTimeout(() => {
      proc.kill()
      reject(new Error('LLM script timeout'))
    }, 30000)
  })
}

// Helper function to call Python TTS script
async function callTTSScript(text: string, outputPath: string, voice?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, 'sample_scripts', 'generate_audio.py')
    const proc = spawn('python3', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env
    })

    let stderr = ''
    proc.stderr.on('data', (data) => stderr += data.toString())

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('TTS script error:', stderr)
        resolve(false)
      } else {
        resolve(true)
      }
    })

    // Send input to script
    proc.stdin.write(JSON.stringify({
      text,
      output_path: outputPath,
      voice: voice || undefined
    }))
    proc.stdin.end()

    // Timeout after 60 seconds
    setTimeout(() => {
      proc.kill()
      resolve(false)
    }, 60000)
  })
}

export interface DocumentInsights {
  key_insights: string[]
  did_you_know: string[]
  contradictions: string[]
  connections: string[]
  executive_summary: string
}

export interface PodcastScript {
  title: string
  duration_estimate: string
  script_sections: {
    speaker: string
    content: string
    timestamp: string
  }[]
  transcript: string
  audio_url?: string
}

/**
 * Generate comprehensive insights from document sections
 */
export async function generateInsights(
  sections: any[],
  persona: string,
  jobToBeDone: string,
  llmProvider: string = 'openai'
): Promise<DocumentInsights> {
  const sectionsText = sections
    .map(s => `**${s.section_title || 'Section'}** (${s.document}, p.${s.page_number})\n${s.refined_text || s.text || ''}`)
    .join('\n\n---\n\n')

  const prompt = `You are an AI analyst helping a ${persona} with their task: "${jobToBeDone}".

Analyze the following document sections and provide insights. RESPOND ONLY WITH VALID JSON - no markdown, no explanations, just the JSON object:

${sectionsText}

Return exactly this JSON structure with your analysis:
{
  "key_insights": ["3-5 most important insights relevant to the persona and task"],
  "did_you_know": ["2-3 interesting facts or discoveries that might surprise the reader"],
  "contradictions": ["1-2 areas where different sections might disagree or present conflicting information"],
  "connections": ["2-3 ways these documents connect to each other or reveal patterns"],
  "executive_summary": "A 2-3 sentence summary of the most critical information for this persona's job-to-be-done"
}

Focus on actionable insights that directly help the ${persona} accomplish their goal. RETURN ONLY THE JSON OBJECT.`

  try {
    let content: string;
    
    // Use specified LLM provider
    if (llmProvider !== 'openai') {
      try {
        // Set environment variable for the script to use
        const originalProvider = process.env.LLM_PROVIDER
        process.env.LLM_PROVIDER = llmProvider
        console.log(`🤖 Using ${llmProvider.toUpperCase()} for insights generation`);
        content = await callLLMScript(prompt, 0.7, 1500);
        console.log(`✅ ${llmProvider.toUpperCase()} insights generation completed`);
        // Restore original value
        if (originalProvider) process.env.LLM_PROVIDER = originalProvider
        else delete process.env.LLM_PROVIDER
      } catch (scriptError) {
        console.warn(`❌ ${llmProvider.toUpperCase()} failed, falling back to OpenAI:`, scriptError);
        // Fall back to OpenAI
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1500
        });
        content = completion.choices[0]?.message?.content || '';
      }
    } else {
      // Use OpenAI directly
      try {
        console.log(`🤖 Using OPENAI for insights generation`);
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini', // Cost-effective model
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1500
        });
        content = completion.choices[0]?.message?.content || '';
        console.log(`✅ OPENAI insights generation completed`);
      } catch (openaiError) {
        console.warn(`❌ OPENAI failed, trying Gemini fallback:`, openaiError);
        // Fallback to Gemini if OpenAI fails
        const originalProvider = process.env.LLM_PROVIDER
        process.env.LLM_PROVIDER = 'gemini'
        content = await callLLMScript(prompt, 0.7, 1500);
        console.log(`✅ GEMINI fallback completed`);
        // Restore original value
        if (originalProvider) process.env.LLM_PROVIDER = originalProvider
        else delete process.env.LLM_PROVIDER
      }
    }

    if (!content) throw new Error('No response from LLM')

    // Clean the content and try to parse JSON
    let cleanContent = content.trim()
    
    // Remove markdown code blocks if present
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }
    
    try {
      const parsed = JSON.parse(cleanContent)
      // Validate the structure
      if (parsed.key_insights && parsed.executive_summary) {
        return parsed
      }
    } catch (parseError) {
      console.log('JSON parse error:', parseError)
      console.log('Content received:', content)
    }
    
    // Fallback: extract insights from text response
    return {
      key_insights: ['Document analysis completed - key insights extracted from your documents'],
      did_you_know: ['Your documents contain valuable information relevant to your role'],
      contradictions: [],
      connections: [],
      executive_summary: `Analysis complete for ${persona} working on: ${jobToBeDone}`
    }
  } catch (error) {
    console.error('OpenAI insights generation failed:', error)
    // Graceful fallback
    return {
      key_insights: ['Document analysis completed - review the sections for key information'],
      did_you_know: ['Your documents contain valuable insights relevant to your role'],
      contradictions: [],
      connections: [],
      executive_summary: `Analysis complete for ${persona} working on: ${jobToBeDone}`
    }
  }
}

/**
 * Generate a conversational podcast script from document content
 */
export async function generatePodcastScript(
  sections: any[],
  persona: string,
  jobToBeDone: string,
  insights: DocumentInsights
): Promise<PodcastScript> {
  const prompt = `Create a detailed podcast script for a ${persona}. Target duration: 1.5-2 minutes minimum. RESPOND ONLY WITH VALID JSON:

Key points to cover:
- ${insights.key_insights.slice(0, 3).join('\n- ')}
- Executive summary: ${insights.executive_summary}

Return exactly this JSON structure:
{
  "title": "Document Analysis for ${persona}",
  "duration_estimate": "1.5-2 minutes",
  "script_sections": [
    {"speaker": "Host 1", "content": "Engaging opening about the analysis with context", "timestamp": "0:00"},
    {"speaker": "Host 2", "content": "Deep dive into first key insight with examples", "timestamp": "0:20"},
    {"speaker": "Host 1", "content": "Discussion of second insight and implications", "timestamp": "0:45"},
    {"speaker": "Host 2", "content": "Third insight and practical applications", "timestamp": "1:10"},
    {"speaker": "Host 1", "content": "Wrap-up with actionable takeaways", "timestamp": "1:30"}
  ],
  "transcript": "Combined transcript of the full conversation"
}

Make the conversation detailed, engaging, and informative. Each speaker section should be substantial (30-40 words minimum). RETURN ONLY THE JSON OBJECT.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1200 // Increased for longer podcast content
    })

    const content = completion.choices[0]?.message?.content
    if (!content) throw new Error('No response from OpenAI')

    // Clean and parse JSON similar to insights
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    try {
      const parsed = JSON.parse(cleanContent)
      if (parsed.title && parsed.script_sections) {
        return parsed
      }
    } catch (parseError) {
      console.log('Podcast JSON parse error:', parseError)
    }
    
    // Fallback script
    return {
      title: `Document Insights for ${persona}`,
      duration_estimate: "1.5-2 minutes",
      script_sections: [
        {
          speaker: "AI Assistant",
          content: `Key findings for ${persona}: ${insights.executive_summary}`,
          timestamp: "0:00"
        }
      ],
      transcript: `Document analysis summary: ${insights.executive_summary}`
    }
  } catch (error) {
    console.error('Podcast script generation failed:', error)
    return {
      title: `Document Analysis for ${persona}`,
      duration_estimate: "1.5-2 minutes",
      script_sections: [
        {
          speaker: "AI Assistant",
          content: insights.executive_summary,
          timestamp: "0:00"
        }
      ],
      transcript: insights.executive_summary
    }
  }
}

/**
 * Generate TTS audio from text using OpenAI's TTS API
 */
/**
 * Generate contextually relevant snippets using LLM
 */
export async function generateSmartSnippet(
  selectedText: string,
  candidateText: string,
  llmProvider: string = 'openai'
): Promise<string> {
  if (!candidateText || candidateText.length < 50) {
    return candidateText.slice(0, 200) + (candidateText.length > 200 ? '...' : '');
  }

  const prompt = `Given this selected text: "${selectedText}"

Find the most relevant 2-3 sentences from this document section that relate to the selected text:

"${candidateText}"

Requirements:
- Extract ONLY the most relevant sentences that connect to the selected text
- Maximum 3 sentences
- If multiple topics, focus on the one most related to the selection
- Return ONLY the extracted sentences, no explanations or additions

Extracted sentences:`;

  try {
    let response: string;
    
    // Use specified LLM provider
    if (llmProvider !== 'openai') {
      try {
        // Set environment variable for the script to use
        const originalProvider = process.env.LLM_PROVIDER;
        process.env.LLM_PROVIDER = llmProvider;
        console.log(`🤖 Using ${llmProvider.toUpperCase()} for snippet generation`);
        response = await callLLMScript(prompt, 0.3, 300);
        console.log(`✅ ${llmProvider.toUpperCase()} snippet generation completed`);
        // Restore original value
        if (originalProvider) process.env.LLM_PROVIDER = originalProvider;
        else delete process.env.LLM_PROVIDER;
      } catch (scriptError) {
        console.warn(`❌ ${llmProvider.toUpperCase()} failed for snippet generation, falling back to OpenAI:`, scriptError);
        // Fall back to OpenAI
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 300
        });
        response = completion.choices[0]?.message?.content || '';
      }
    } else {
      // Use OpenAI directly
      console.log(`🤖 Using OPENAI for snippet generation`);
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300
      });
      response = completion.choices[0]?.message?.content || '';
      console.log(`✅ OPENAI snippet generation completed`);
    }

    // Clean and validate response
    const cleaned = response.trim();
    if (cleaned && cleaned.length > 20 && cleaned.length < 1000) {
      return cleaned;
    }
    
    // Fallback to simple extraction if LLM response is poor
    return fallbackSnippet(candidateText, selectedText);
    
  } catch (error) {
    console.error('Smart snippet generation failed:', error);
    return fallbackSnippet(candidateText, selectedText);
  }
}

/**
 * Fallback snippet generation (current logic)
 */
function fallbackSnippet(text: string, selectedText: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
  if (sentences.length === 0) return text.slice(0, 200) + '...';
  
  const selectedWords = selectedText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  let bestSentences: string[] = [];
  let maxScore = 0;
  
  // Find sentences with highest word overlap
  for (let i = 0; i < sentences.length; i++) {
    for (let len = 1; len <= Math.min(3, sentences.length - i); len++) {
      const candidate = sentences.slice(i, i + len);
      const candidateText = candidate.join(' ').toLowerCase();
      
      const score = selectedWords.reduce((acc, word) => 
        candidateText.includes(word) ? acc + 1 : acc, 0
      );
      
      if (score > maxScore || (score === maxScore && candidate.length < bestSentences.length)) {
        maxScore = score;
        bestSentences = candidate;
      }
    }
  }
  
  if (bestSentences.length === 0) {
    bestSentences = sentences.slice(0, Math.min(2, sentences.length));
  }
  
  const snippet = bestSentences.join(' ');
  return snippet.length > 400 ? snippet.slice(0, 400) + '...' : snippet;
}

export async function generateTTSAudio(
  text: string,
  outputPath: string,
  voice?: string
): Promise<string | null> {
  try {
    // Use external TTS script if environment variables are set
    if (process.env.TTS_PROVIDER && process.env.TTS_PROVIDER !== 'openai') {
      try {
        const success = await callTTSScript(text, outputPath, voice);
        if (success) {
          return outputPath;
        }
      } catch (scriptError) {
        console.warn('External TTS failed, falling back to OpenAI:', scriptError);
      }
    }
    
    // Use OpenAI TTS as fallback or primary
    const mp3 = await openai.audio.speech.create({
      model: "tts-1", // Faster model for real-time generation
      voice: (voice as any) || "nova", // Natural female voice
      input: text.slice(0, 4000), // Limit to 4000 chars for cost control
      response_format: "mp3",
      speed: 0.9 // Slightly slower for better comprehension
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    // Write to file
    const fs = await import('fs/promises');
    await fs.writeFile(outputPath, buffer);
    
    return outputPath;
  } catch (error) {
    console.error('TTS generation failed:', error);
    return null;
  }
}

/**
 * Answer questions about the documents using RAG
 */
export async function answerQuestion(
  question: string,
  sections: any[],
  persona: string,
  jobToBeDone: string,
  llmProvider: string = 'openai'
): Promise<string> {
  const relevantSections = sections
    .slice(0, 5) // Limit context to avoid token limits
    .map(s => `**${s.section_title || 'Section'}** (${s.document}, p.${s.page_number})\n${s.refined_text || s.text || ''}`)
    .join('\n\n---\n\n')

  const prompt = `You are an AI assistant helping a ${persona} with their task: "${jobToBeDone}".

Based on the following document sections, answer this question: "${question}"

Document sections:
${relevantSections}

Provide a helpful, accurate answer based on the document content. If the information isn't in the documents, say so clearly. 
Keep your response concise and actionable for the ${persona}.`

  try {
    let response: string;
    
    // Use specified LLM provider
    if (llmProvider !== 'openai') {
      try {
        // Set environment variable for the script to use
        const originalProvider = process.env.LLM_PROVIDER
        process.env.LLM_PROVIDER = llmProvider
        response = await callLLMScript(prompt, 0.3, 800);
        // Restore original value
        if (originalProvider) process.env.LLM_PROVIDER = originalProvider
        else delete process.env.LLM_PROVIDER
      } catch (scriptError) {
        console.warn(`${llmProvider} failed for Q&A, falling back to OpenAI:`, scriptError);
        // Fall back to OpenAI
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 800
        });
        response = completion.choices[0]?.message?.content || '';
      }
    } else {
      // Use OpenAI directly
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3, // Lower temperature for factual answers
        max_tokens: 800
      });
      response = completion.choices[0]?.message?.content || '';
    }

    return response || 'I apologize, but I could not generate an answer at this time.'
  } catch (error) {
    console.error('Question answering failed:', error)
    return 'I apologize, but I could not process your question at this time. Please try again.'
  }
}
