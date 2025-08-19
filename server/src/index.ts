import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { generateInsights, generatePodcastScript, answerQuestion, generateTTSAudio, generateSmartSnippet } from './llm'

const app = new Hono()

app.use('*', cors({ origin: (origin) => origin ?? '*', allowMethods: ['GET','POST','OPTIONS'] }))

// Health
app.get('/health', (c) => c.json({ ok: true }))

// Static PDFs with Range + CORS for Adobe iframe (1b/input/<collection>/PDFs/<file>)
app.get('/pdfs/:collection/:filename', async (c) => {
  const collection = decodeURIComponent(c.req.param('collection'))
  const filename = decodeURIComponent(c.req.param('filename'))
  // Check both regular collections and quick read locations
  let filePath = path.join(inputRoot, collection, 'PDFs', filename)
  try {
    let file = Bun.file(filePath)
    
    // If not found in PDFs subfolder, check direct path (for quick read)
    if (!(await file.exists())) {
      filePath = path.join(inputRoot, collection, filename)
      file = Bun.file(filePath)
    }
    
    if (!(await file.exists())) return c.text('Not found', 404)
    const total = file.size
    const range = c.req.header('range')
    const commonHeaders: Record<string, string> = {
      'Content-Type': 'application/pdf',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range'
    }
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range)
      let start = match && match[1] ? parseInt(match[1], 10) : 0
      let end = match && match[2] ? parseInt(match[2], 10) : total - 1
      if (isNaN(start)) start = 0
      if (isNaN(end) || end >= total) end = total - 1
      if (start >= total) return c.text('Requested range not satisfiable', 416)
      const slice = file.slice(start, end + 1)
      const headers = {
        ...commonHeaders,
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Content-Length': String(end - start + 1)
      }
      return new Response(slice, { status: 206, headers })
    } else {
      const slice = file
      const headers = {
        ...commonHeaders,
        'Content-Length': String(total)
      }
      return new Response(slice, { status: 200, headers })
    }
  } catch {
    return c.text('Not found', 404)
  }
})

app.options('/pdfs/:collection/:filename', (c) => {
  return c.body(null, 204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type',
  })
})

// Serve audio files
app.get('/audio/:collection/:filename', async (c) => {
  const collection = decodeURIComponent(c.req.param('collection'))
  const filename = decodeURIComponent(c.req.param('filename'))
  const filePath = path.join(outputRoot, collection, filename)
  
  try {
    const file = Bun.file(filePath)
    if (!(await file.exists())) return c.text('Not found', 404)
    
    const headers = {
      'Content-Type': 'audio/mpeg',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    }
    
    return new Response(file, { status: 200, headers })
  } catch {
    return c.text('Not found', 404)
  }
})

// Utilities
const repoRoot = path.resolve(path.join(import.meta.dir, '../../')) // .../server → repo root
const oneBRoot = path.join(repoRoot, '1b')
const inputRoot = path.join(oneBRoot, 'input')
const outputRoot = path.join(oneBRoot, 'output')

type JobStatus = 'queued' | 'running' | 'ready' | 'error'
const jobs = new Map<string, { status: JobStatus; error?: string }>()

async function runOneB(collectionId: string) {
  // Prefer project venv; fallback to system python3
  const venvPython = path.join(oneBRoot, '.venv', 'bin', 'python')
  const pythonPath = await stat(venvPython).then(() => venvPython).catch(() => 'python3')
  const scriptPath = path.join(oneBRoot, 'src', 'main.py')
  jobs.set(collectionId, { status: 'running' })
  const env = {
    ...Bun.env,
    COLLECTION_ID: collectionId,
  }
  const proc = Bun.spawn([pythonPath, scriptPath], { cwd: oneBRoot, stdout: 'ignore', stderr: 'pipe', env })
  const exit = await proc.exited
  if (exit === 0) {
    jobs.set(collectionId, { status: 'ready' })
  } else {
    const err = await new Response(proc.stderr).text()
    jobs.set(collectionId, { status: 'error', error: err.slice(0, 2000) })
  }
}

// Create collection: upload PDFs and persona/job, then trigger 1b
app.post('/collections', async (c) => {
  const form = await c.req.formData()
  const persona = String(form.get('persona') || '')
  const job = String(form.get('job') || '')
  const uploadType = String(form.get('upload_type') || '')
  const llmProvider = String(form.get('llm_provider') || 'openai')
  
  if (uploadType === 'bulk_analysis' || uploadType === 'hackathon_flow') {
    // New hackathon flow: can use regular files[] if bulk_files not provided
    let allFiles = form.getAll('bulk_files')
    const currentFile = form.get('current_file')
    
    // Fallback to regular files if bulk_files not provided
    if (!allFiles.length) {
      allFiles = form.getAll('files')
    }
    
    if (!allFiles.length || !persona || !job) {
      return c.text('Missing files, persona, or job', 400)
    }

    const collectionId = `Collection ${Date.now()}`
    const collectionDir = path.join(inputRoot, collectionId)
    const pdfDir = path.join(collectionDir, 'PDFs')
    await mkdir(pdfDir, { recursive: true })

    const docs: { filename: string; type?: string }[] = []
    
    // Save all files (treat as library by default)
    for (const f of allFiles) {
      if (!(f instanceof File)) continue
      const buffer = await f.arrayBuffer()
      const filePath = path.join(pdfDir, f.name)
      await writeFile(filePath, new Uint8Array(buffer))
      docs.push({ filename: f.name, type: 'library' })
    }
    
    // Save current file if provided separately
    if (currentFile instanceof File) {
      const buffer = await currentFile.arrayBuffer()
      const filePath = path.join(pdfDir, currentFile.name)
      await writeFile(filePath, new Uint8Array(buffer))
      docs.push({ filename: currentFile.name, type: 'current' })
    }

    const inputJson = {
      persona: { role: persona },
      job_to_be_done: { task: job },
      documents: docs,
      upload_type: 'hackathon_flow',
      current_document: currentFile instanceof File ? currentFile.name : '',
      llm_provider: llmProvider // Store for later use in insights/chat
    }
    await writeFile(path.join(collectionDir, 'challenge1b_input.json'), new TextEncoder().encode(JSON.stringify(inputJson, null, 2)))

    jobs.set(collectionId, { status: 'queued' })
    runOneB(collectionId) // fire and forget - no LLM provider needed for document processing

    return c.json({ collectionId })
  } else {
    // Legacy flow: multiple files
    const files = form.getAll('files')
    if (!files.length) return c.text('No files provided', 400)

    const collectionId = `Collection ${Date.now()}`
    const collectionDir = path.join(inputRoot, collectionId)
    const pdfDir = path.join(collectionDir, 'PDFs')
    await mkdir(pdfDir, { recursive: true })

    const docs: { filename: string }[] = []
    for (const f of files) {
      if (!(f instanceof File)) continue
      const buffer = await f.arrayBuffer()
      const filePath = path.join(pdfDir, f.name)
      await writeFile(filePath, new Uint8Array(buffer))
      docs.push({ filename: f.name })
    }

    const inputJson = {
      persona: { role: persona },
      job_to_be_done: { task: job },
      documents: docs,
      llm_provider: llmProvider // Store for later use in insights/chat
    }
    await writeFile(path.join(collectionDir, 'challenge1b_input.json'), new TextEncoder().encode(JSON.stringify(inputJson, null, 2)))

    jobs.set(collectionId, { status: 'queued' })
    runOneB(collectionId) // fire and forget - no LLM provider needed for document processing

    return c.json({ collectionId })
  }
})

app.get('/collections', async (c) => {
  const entries = await readdir(outputRoot).catch(() => [])
  return c.json(entries)
})

// Quick read endpoint - single PDF with instant text selection
app.post('/quick-read', async (c) => {
  try {
    const form = await c.req.formData()
    const file = form.get('file')
    
    if (!(file instanceof File)) {
      return c.text('No file provided', 400)
    }

    if (file.type !== 'application/pdf') {
      return c.text('Only PDF files are supported', 400)
    }

    const readerId = `QuickRead_${Date.now()}`
    const readerDir = path.join(inputRoot, readerId)
    await mkdir(readerDir, { recursive: true })

    // Save the PDF
    const buffer = await file.arrayBuffer()
    const filePath = path.join(readerDir, file.name)
    await writeFile(filePath, new Uint8Array(buffer))

    // Create metadata for quick read mode
    const metadata = {
      readerId,
      filename: file.name,
      uploadedAt: new Date().toISOString(),
      mode: 'quick_read',
      status: 'ready' // No processing needed for quick read
    }

    await writeFile(
      path.join(readerDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    )

    return c.json({ readerId })
  } catch (error) {
    console.error('Quick read upload error:', error)
    return c.text('Upload failed', 500)
  }
})

// Explain text endpoint - enhanced LLM explanations with mode selection
app.post('/explain-text', async (c) => {
  try {
    const { selectedText, mode, currentDocument, currentPage, llm_provider } = await c.req.json()
    
    if (!selectedText || selectedText.trim().length < 3) {
      return c.json({ explanation: "Please select more text for explanation." })
    }

    let prompt: string;
    let llmProvider = llm_provider || 'openai';

    if (mode === 'pdf_context') {
      // PDF Context Mode: Use document information to explain
      prompt = `You are an AI assistant helping users understand text they've selected from a PDF document.

Selected text: "${selectedText}"
Document: ${currentDocument}
Page: ${currentPage}

Please provide a clear, helpful explanation that:
1. Explains what this text means in the context of the document
2. Connects it to the broader document content and purpose
3. Mentions any important concepts, terms, or implications specific to this document
4. Keeps the explanation concise but informative (3-5 sentences)

Focus on being educational and helpful. If the text contains technical terms, explain them in the context of this document. If it references concepts, provide context from the document's domain.`
    } else {
      // General Knowledge Mode: Use AI's general knowledge
      prompt = `You are an AI assistant helping users understand text they've selected.

Selected text: "${selectedText}"

Please provide a clear, helpful explanation that:
1. Explains what this text means in simple terms
2. Provides broader context or background knowledge from your general knowledge
3. Mentions any important concepts, terms, or implications
4. Keeps the explanation concise but informative (3-5 sentences)

Focus on being educational and helpful. Use your general knowledge to provide context, examples, and explanations that would help someone understand this text better.`
    }

    let explanation: string;

    try {
      // Use specified LLM provider with fallback
      if (llmProvider !== 'openai') {
        try {
          const originalProvider = process.env.LLM_PROVIDER;
          process.env.LLM_PROVIDER = llmProvider;
          console.log(`🤖 Using ${llmProvider.toUpperCase()} for text explanation (${mode})`);
          
          const { callLLMScript } = await import('./llm.js');
          explanation = await callLLMScript(prompt, 0.7, 400);
          
          console.log(`✅ ${llmProvider.toUpperCase()} text explanation completed`);
          if (originalProvider) process.env.LLM_PROVIDER = originalProvider;
          else delete process.env.LLM_PROVIDER;
        } catch (scriptError) {
          console.warn(`❌ ${llmProvider.toUpperCase()} failed, falling back to OpenAI:`, scriptError);
          // Fall back to OpenAI
          const { default: OpenAI } = await import('openai');
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 400
          });
          
          explanation = completion.choices[0]?.message?.content || "Unable to generate explanation.";
        }
      } else {
        // Use OpenAI directly
        try {
          console.log(`🤖 Using OPENAI for text explanation (${mode})`);
          const { default: OpenAI } = await import('openai');
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 400
          });
          
          explanation = completion.choices[0]?.message?.content || "Unable to generate explanation.";
          console.log(`✅ OPENAI text explanation completed`);
        } catch (openaiError) {
          console.warn(`❌ OPENAI failed, trying Gemini fallback:`, openaiError);
          // Fallback to Gemini if OpenAI fails
          const originalProvider = process.env.LLM_PROVIDER;
          process.env.LLM_PROVIDER = 'gemini';
          const { callLLMScript } = await import('./llm.js');
          explanation = await callLLMScript(prompt, 0.7, 400);
          console.log(`✅ GEMINI fallback completed`);
          if (originalProvider) process.env.LLM_PROVIDER = originalProvider;
          else delete process.env.LLM_PROVIDER;
        }
      }
    } catch (error) {
      console.error('LLM explanation error:', error);
      explanation = `This text appears to be about: ${selectedText.slice(0, 100)}... I'm unable to provide a detailed explanation at the moment, but you can try selecting different text or checking your internet connection.`
    }

    return c.json({ explanation });
  } catch (error) {
    console.error('Text explanation error:', error);
    return c.json({ explanation: "Unable to generate explanation at this time." });
  }
})

app.get('/collections/:id/status', async (c) => {
  const id = c.req.param('id')
  
  // Check if this is a quick read
  const quickReadMetaPath = path.join(inputRoot, id, 'metadata.json')
  try {
    const metaFile = await readFile(quickReadMetaPath, 'utf8')
    const metadata = JSON.parse(metaFile)
    if (metadata.mode === 'quick_read') {
      return c.json({ 
        status: 'ready', 
        filename: metadata.filename,
        mode: 'quick_read'
      })
    }
  } catch {
    // Not a quick read, continue with regular job status
  }
  
  const j = jobs.get(id)
  return c.json({ status: j?.status ?? 'queued', error: j?.error })
})

app.get('/collections/:id/output', async (c) => {
  const id = c.req.param('id')
  const p = path.join(outputRoot, id, 'challenge1b_output.json')
  try { const data = await readFile(p, 'utf8'); return c.body(data, 200, { 'content-type': 'application/json' }) } catch { return c.text('Not found', 404) }
})

app.get('/collections/:id/recommendations', async (c) => {
  const id = c.req.param('id')
  const p = path.join(outputRoot, id, 'recommendations_output.json')
  try { const data = await readFile(p, 'utf8'); return c.body(data, 200, { 'content-type': 'application/json' }) } catch { return c.text('Not found', 404) }
})

// Library-wide recommendations (cross-collection)
app.get('/collections/:id/library', async (c) => {
  const id = c.req.param('id')
  const p = path.join(outputRoot, id, 'library_recommendations.json')
  try { const data = await readFile(p, 'utf8'); return c.body(data, 200, { 'content-type': 'application/json' }) } catch { return c.text('Not found', 404) }
})

// Enhanced insights powered by LLM
app.get('/collections/:id/insights', async (c) => {
  const llmProviderParam = c.req.query('llm_provider') || null
  const id = c.req.param('id')
  try {
    const outputPath = path.join(outputRoot, id, 'challenge1b_output.json')
    const insightsPath = path.join(outputRoot, id, 'ai_insights.json')
    
    // Check if insights already exist
    try {
      const existingInsights = await readFile(insightsPath, 'utf8')
      return c.json(JSON.parse(existingInsights))
    } catch {
      // Generate new insights
      const output = JSON.parse(await readFile(outputPath, 'utf8'))
      const { extracted_sections, subsection_analysis, metadata } = output
      
      // Get LLM provider from query parameter or input JSON
      let llmProvider = llmProviderParam || 'openai' // default
      if (!llmProviderParam) {
        const inputPath = path.join(inputRoot, id, 'challenge1b_input.json')
        try {
          const inputData = JSON.parse(await readFile(inputPath, 'utf8'))
          llmProvider = inputData.llm_provider || 'openai'
        } catch {
          // Use default if input not found
        }
      }
      
      // Combine section data with refined text
      const enrichedSections = extracted_sections.map((section: any) => {
        const analysis = subsection_analysis.find((sub: any) => 
          sub.document === section.document && sub.page_number === section.page_number
        )
        return {
          ...section,
          refined_text: analysis?.refined_text || ''
        }
      })
      
      const insights = await generateInsights(
        enrichedSections,
        metadata.persona || 'Professional',
        metadata.job_to_be_done || 'Document analysis',
        llmProvider
      )
      
      // Cache insights
      await writeFile(insightsPath, JSON.stringify(insights, null, 2))
      console.log('Sending insights response:', JSON.stringify(insights, null, 2))
      return c.json(insights)
    }
  } catch (error) {
    console.error('Insights generation error:', error)
    return c.json({
      key_insights: ['Document analysis completed - review sections for insights'],
      did_you_know: [],
      contradictions: [],
      connections: [],
      executive_summary: 'Analysis in progress'
    })
  }
})

// Get podcast status or result
app.get('/collections/:id/podcast', async (c) => {
  const id = c.req.param('id')
  try {
    const podcastPath = path.join(outputRoot, id, 'podcast_script.json')
    const statusPath = path.join(outputRoot, id, 'podcast_status.json')
    
    // Check if podcast script already exists (completed)
    try {
      const existingPodcast = await readFile(podcastPath, 'utf8')
      return c.json({ status: 'completed', ...JSON.parse(existingPodcast) })
    } catch {
      // Check if generation is in progress
      try {
        const status = JSON.parse(await readFile(statusPath, 'utf8'))
        return c.json({ status: status.status, message: status.message, progress: status.progress })
      } catch {
        // Not started yet
        return c.json({ status: 'not_started', message: 'Click Generate Podcast to begin' })
      }
    }
  } catch (error) {
    console.error('Podcast status error:', error)
    return c.json({ status: 'error', message: 'Unable to check podcast status' })
  }
})

// Start podcast generation (async)
app.post('/collections/:id/podcast/generate', async (c) => {
  const id = c.req.param('id')
  try {
    const podcastPath = path.join(outputRoot, id, 'podcast_script.json')
    const statusPath = path.join(outputRoot, id, 'podcast_status.json')
    
    // Check if already completed
    try {
      await readFile(podcastPath, 'utf8')
      return c.json({ status: 'already_completed' })
    } catch {}
    
    // Check if already in progress
    try {
      const status = JSON.parse(await readFile(statusPath, 'utf8'))
      if (status.status === 'generating') {
        return c.json({ status: 'already_in_progress' })
      }
    } catch {}
    
    // Start background generation
    generatePodcastAsync(id) // Fire and forget
    
    // Set initial status
    await writeFile(statusPath, JSON.stringify({
      status: 'generating',
      message: 'Generating podcast script...',
      progress: 10,
      started_at: new Date().toISOString()
    }))
    
    return c.json({ status: 'started', message: 'Podcast generation started' })
    
  } catch (error) {
    console.error('Podcast generation start error:', error)
    return c.json({ status: 'error', message: 'Failed to start podcast generation' }, 500)
  }
})

// Text selection endpoint for real-time semantic search
app.post('/collections/:id/search-selection', async (c) => {
  const id = c.req.param('id')
  try {
    const { selectedText, currentDocument, currentPage, llm_provider, contextBefore, contextAfter } = await c.req.json()
    if (!selectedText || selectedText.trim().length < 3) {
      return c.json({ sections: [], snippets: [] })
    }
    
    // Get LLM provider from request or stored input JSON
    let llmProvider = llm_provider || 'openai'
    if (!llm_provider) {
      const inputPath = path.join(inputRoot, id, 'challenge1b_input.json')
      try {
        const inputData = JSON.parse(await readFile(inputPath, 'utf8'))
        llmProvider = inputData.llm_provider || 'openai'
      } catch {
        // Use default if input not found
      }
    }
    
    // Create enriched search query with context for better matching
    let enrichedQuery = selectedText
    if (contextBefore || contextAfter) {
      // Build context-aware query
      const contextParts: string[] = []
      if (contextBefore) contextParts.push(contextBefore.slice(-50)) // Last 50 chars
      contextParts.push(selectedText)
      if (contextAfter) contextParts.push(contextAfter.slice(0, 50)) // First 50 chars
      
      enrichedQuery = contextParts.join(' ').trim()
      console.log('Enhanced search query with context:', {
        original: selectedText,
        enriched: enrichedQuery.slice(0, 200) + '...'
      })
    }
    
    // Get all sections from the collection and library
    const outputPath = path.join(outputRoot, id, 'challenge1b_output.json')
    const output = JSON.parse(await readFile(outputPath, 'utf8'))
    const { extracted_sections, subsection_analysis, metadata } = output
    
    // Load library sections from cache if available
    let librarySections: any[] = []
    try {
      const libraryMetaPath = path.join(__dirname, '../../1b/cache/library_meta.json')
      const libraryMeta = JSON.parse(await readFile(libraryMetaPath, 'utf8'))
      // Exclude current collection to show cross-document results
      librarySections = libraryMeta.filter((section: any) => section.collection !== id)
    } catch {
      // Library not available, continue with current collection only
    }
    
    // Combine current collection sections with library
    const allSections = [
      ...extracted_sections.map((section: any) => {
        const analysis = subsection_analysis.find((sub: any) => 
          sub.document === section.document && sub.page_number === section.page_number
        )
        return {
          ...section,
          refined_text: analysis?.refined_text || '',
          collection: id,
          source: 'current'
        }
      }),
      ...librarySections.map((section: any) => ({
        ...section,
        source: 'library'
      }))
    ]
    
    // Filter out current section if it matches exactly
    const filteredSections = allSections.filter((section: any) => 
      !(section.document === currentDocument && section.page_number === currentPage)
    )
    
    // Use 1b semantic search to find relevant sections
    const { spawn } = require('node:child_process')
    const searchResults = await new Promise<any[]>((resolve, reject) => {
      const pythonPath = process.env.PYTHON_PATH || 'python3'
      const searchScript = path.join(__dirname, '../../1b/src/text_search.py')
      
      const proc = spawn(pythonPath, [searchScript], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, COLLECTION_ID: id }
      })
      
      let stdout = ''
      let stderr = ''
      
      proc.stdout.on('data', (data) => stdout += data.toString())
      proc.stderr.on('data', (data) => stderr += data.toString())
      
      proc.on('close', (code) => {
        if (code !== 0) {
          console.error('Search script error:', stderr)
          resolve([]) // Graceful fallback
        } else {
          try {
            const results = JSON.parse(stdout)
            resolve(results)
          } catch (e) {
            console.error('Search result parse error:', e)
            resolve([])
          }
        }
      })
      
      // Send search data to Python script with enhanced query
      proc.stdin.write(JSON.stringify({
        selected_text: enrichedQuery, // Use context-enriched query for better matching
        original_text: selectedText,  // Keep original for snippet generation
        sections: filteredSections.slice(0, 50), // Limit for performance
        top_k: 5
      }))
      proc.stdin.end()
      
      // Timeout after 5 seconds
      setTimeout(() => {
        proc.kill()
        resolve([])
      }, 5000)
    })
    
    // Generate snippets (2-4 sentences) for each result using LLM
    const snippets = await Promise.all(
      searchResults.map(async (result: any) => ({
        ...result,
        snippet: await generateSnippet(result.text || result.refined_text || '', selectedText, llmProvider),
        relevance_score: result.similarity || result.score || 0
      }))
    )
    
    return c.json({ 
      sections: searchResults.slice(0, 5), 
      snippets: snippets.slice(0, 5) 
    })
    
  } catch (error) {
    console.error('Text selection search error:', error)
    return c.json({ sections: [], snippets: [] })
  }
})

// Async podcast generation function
async function generatePodcastAsync(collectionId: string) {
  const statusPath = path.join(outputRoot, collectionId, 'podcast_status.json')
  const podcastPath = path.join(outputRoot, collectionId, 'podcast_script.json')
  
  try {
    // Update status: Loading data
    await writeFile(statusPath, JSON.stringify({
      status: 'generating',
      message: 'Loading document data...',
      progress: 20
    }))
    
    const outputPath = path.join(outputRoot, collectionId, 'challenge1b_output.json')
    const insightsPath = path.join(outputRoot, collectionId, 'ai_insights.json')
    
    const output = JSON.parse(await readFile(outputPath, 'utf8'))
    
    // Update status: Generating insights
    await writeFile(statusPath, JSON.stringify({
      status: 'generating',
      message: 'Analyzing document insights...',
      progress: 40
    }))
    
    let insights
    try {
      insights = JSON.parse(await readFile(insightsPath, 'utf8'))
    } catch {
      // Generate insights first if they don't exist
      const { extracted_sections, subsection_analysis, metadata } = output
      const enrichedSections = extracted_sections.map((section: any) => {
        const analysis = subsection_analysis.find((sub: any) => 
          sub.document === section.document && sub.page_number === section.page_number
        )
        return { ...section, refined_text: analysis?.refined_text || '' }
      })
      
      insights = await generateInsights(
        enrichedSections,
        metadata.persona || 'Professional',
        metadata.job_to_be_done || 'Document analysis',
        'openai' // Default LLM provider for podcast generation
      )
    }
    
    // Update status: Generating script
    await writeFile(statusPath, JSON.stringify({
      status: 'generating',
      message: 'Creating podcast script...',
      progress: 60
    }))
    
    const podcastScript = await generatePodcastScript(
      output.extracted_sections,
      output.metadata.persona || 'Professional',
      output.metadata.job_to_be_done || 'Document analysis',
      insights
    )
    
    // Update status: Generating audio
    await writeFile(statusPath, JSON.stringify({
      status: 'generating',
      message: 'Generating audio (this may take a while)...',
      progress: 80
    }))
    
    // Generate TTS audio if we have a transcript
    if (podcastScript.transcript) {
      const audioPath = path.join(outputRoot, collectionId, 'podcast_audio.mp3')
      const audioFile = await generateTTSAudio(podcastScript.transcript, audioPath)
      if (audioFile) {
        podcastScript.audio_url = `/audio/${collectionId}/podcast_audio.mp3`
      }
    }
    
    // Save completed podcast
    await writeFile(podcastPath, JSON.stringify(podcastScript, null, 2))
    
    // Update status: Completed
    await writeFile(statusPath, JSON.stringify({
      status: 'completed',
      message: 'Podcast ready!',
      progress: 100,
      completed_at: new Date().toISOString()
    }))
    
    console.log(`Podcast generation completed for collection ${collectionId}`)
    
  } catch (error) {
    console.error(`Podcast generation failed for collection ${collectionId}:`, error)
    
    // Update status: Error
    await writeFile(statusPath, JSON.stringify({
      status: 'error',
      message: 'Podcast generation failed. Please try again.',
      progress: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }))
  }
}

// Helper function to generate smart snippets using LLM
async function generateSnippet(text: string, selectedText: string, llmProvider: string = 'openai'): Promise<string> {
  try {
    // Use LLM-enhanced snippet generation for better relevance
    return await generateSmartSnippet(selectedText, text, llmProvider);
  } catch (error) {
    console.warn('Smart snippet generation failed, using fallback:', error);
    
    // Fallback to current logic
    if (!text || text.length < 20) return text;
    
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
    if (sentences.length === 0) return text.slice(0, 200) + '...';
    
    const selectedWords = selectedText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    let bestSentences: string[] = [];
    let maxScore = 0;
    
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
    return snippet.length > 300 ? snippet.slice(0, 300) + '...' : snippet;
  }
}

// Chat endpoint for document Q&A
app.post('/collections/:id/chat', async (c) => {
  const id = c.req.param('id')
  try {
    const { question, llm_provider } = await c.req.json()
    if (!question) return c.text('Question required', 400)
    
    const outputPath = path.join(outputRoot, id, 'challenge1b_output.json')
    const output = JSON.parse(await readFile(outputPath, 'utf8'))
    const { extracted_sections, subsection_analysis, metadata } = output
    
    // Get LLM provider from request body or input JSON
    let llmProvider = llm_provider || 'openai' // default
    if (!llm_provider) {
      const inputPath = path.join(inputRoot, id, 'challenge1b_input.json')
      try {
        const inputData = JSON.parse(await readFile(inputPath, 'utf8'))
        llmProvider = inputData.llm_provider || 'openai'
      } catch {
        // Use default if input not found
      }
    }
    
    // Combine section data with refined text
    const enrichedSections = extracted_sections.map((section: any) => {
      const analysis = subsection_analysis.find((sub: any) => 
        sub.document === section.document && sub.page_number === section.page_number
      )
      return {
        ...section,
        refined_text: analysis?.refined_text || ''
      }
    })
    
    const answer = await answerQuestion(
      question,
      enrichedSections,
      metadata.persona || 'Professional',
      metadata.job_to_be_done || 'Document analysis',
      llmProvider
    )
    
    return c.json({ question, answer })
  } catch (error) {
    console.error('Chat error:', error)
    return c.json({ 
      question: 'Error', 
      answer: 'I apologize, but I could not process your question at this time.' 
    })
  }
})

app.get('/collections/:id/combined', async (c) => {
  const id = c.req.param('id')
  try {
    const out = JSON.parse(await readFile(path.join(outputRoot, id, 'challenge1b_output.json'), 'utf8'))
    const rec = JSON.parse(await readFile(path.join(outputRoot, id, 'recommendations_output.json'), 'utf8'))
    let lib: any = null
    try {
      lib = JSON.parse(await readFile(path.join(outputRoot, id, 'library_recommendations.json'), 'utf8'))
    } catch {}
    
    // Try to include AI insights if available
    let insights: any = null
    try {
      insights = JSON.parse(await readFile(path.join(outputRoot, id, 'ai_insights.json'), 'utf8'))
    } catch {}
    
    return c.json({ 
      ...out, 
      recommendations: rec.recommendations ?? rec, 
      library: lib?.recommendations ?? lib,
      insights 
    })
  } catch (e) {
    return c.text('Not found', 404)
  }
})

// Serve static frontend files
app.get('*', async (c) => {
  const path = c.req.path
  
  // Skip API routes
  if (path.startsWith('/collections') || path.startsWith('/pdfs') || path.startsWith('/health')) {
    return c.notFound()
  }
  
  try {
    const fs = await import('fs/promises')
    const pathModule = await import('path')
    
    // Determine file path
    let filePath = pathModule.join(__dirname, '../public', path === '/' ? 'index.html' : path)
    
    // Check if file exists, otherwise serve index.html for SPA routing
    try {
      await fs.access(filePath)
    } catch {
      filePath = pathModule.join(__dirname, '../public/index.html')
    }
    
    const content = await fs.readFile(filePath)
    const ext = pathModule.extname(filePath).toLowerCase()
    
    // Set appropriate content type
    const contentTypes: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    }
    
    const contentType = contentTypes[ext] || 'text/plain'
    
    return new Response(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000'
      }
    })
  } catch (error) {
    console.error('Static file serving error:', error)
    return c.text('File not found', 404)
  }
})

export default {
  port: parseInt(process.env.PORT || '8787'),
  fetch: app.fetch,
  idleTimeout: 30 // 30 seconds instead of default 10
}

