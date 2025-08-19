# forty2 (Vite + React + Tailwind + TypeScript)

Modern frontend UI to upload PDF collections, analyze sections, and read insights with recommendations and podcast mode.

This project uses Vite (not Next.js). It provides runtime Settings to supply API Base URL and Adobe Client ID instead of env vars.

## Features
- Upload multiple PDFs per collection with Persona and Job-To-Be-Done
- Reader with sidebars: Sections, Recommendations, Insights, Podcast
- PDF viewer: Adobe PDF Embed (if Client ID set) or PDF.js fallback
- Fast navigation to pages across documents
- React Query data fetching/caching, skeletons, toasts

## API
- POST /collections (multipart: files[], persona, job) → { collectionId }
- GET /collections/:id/combined → combined payload
- GET /pdfs/:collectionId/:filename → served to the viewer
- Optional: GET /collections/:id/podcast → { audio_url, transcript }

## Getting Started
1. npm i
2. npm run dev
3. Click Settings (top-right) and set:
   - API Base URL (required)
   - Adobe PDF Client ID (optional)

## Env example (for reference)
If you run this in Next.js elsewhere, create .env.local:
- NEXT_PUBLIC_API_BASE_URL=
- NEXT_PUBLIC_ADOBE_PDF_CLIENT_ID=

## Scripts
- dev, build, preview, lint

## SEO
- Optimized title/meta, semantic layout, responsive design
