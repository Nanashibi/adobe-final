import { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { useConfig } from "./app/ConfigContext";
import { getPdfUrl } from "@/services/api";
import { Card } from "@/components/ui/card";

// pdfjs fallback
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist";
// @ts-expect-error - vite will resolve this URL asset
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = workerSrc as unknown as string;

declare global {
  interface Window {
    AdobeDC?: any;
  }
}

export interface PdfViewerHandle {
  goTo: (documentName: string, page: number, highlight?: string) => void;
}

interface PdfViewerProps {
  collectionId?: string;
  docName?: string;
  page?: number;
  highlight?: string;
  file?: File | ArrayBuffer; // if provided, render local file
  onTextSelection?: (selectedText: string, currentDocument: string, currentPage: number) => void;
}

const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(
  ({ collectionId, docName, page = 1, highlight, file, onTextSelection }, ref) => {
    const { apiBaseUrl, adobeClientId } = useConfig();
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
    const [currentDoc, setCurrentDoc] = useState<string | null>(docName ?? null);
    const apisRef = useRef<any | null>(null);
    const viewRef = useRef<any | null>(null);
    const containerId = useMemo(() => `adobe-dc-view-${collectionId || 'local'}`, [collectionId]);
    const timeoutsRef = useRef<number[]>([]);

    const url = useMemo(() => (collectionId && currentDoc ? getPdfUrl(apiBaseUrl, collectionId, currentDoc) : ''), [apiBaseUrl, collectionId, currentDoc]);

    // Keep currentDoc synced to prop
    useEffect(() => {
      if (docName && docName !== currentDoc) setCurrentDoc(docName);
    }, [docName]);

    // Adobe Embed loader
    useEffect(() => {
      if (!adobeClientId) return; // require Adobe viewer
      if (!currentDoc && !file) return; // nothing selected yet
      const ensureReady = () => new Promise<void>((resolve) => {
        if ((window as any).AdobeDC?.View) return resolve();
        const handler = () => resolve();
        document.addEventListener("adobe_dc_view_sdk.ready", handler, { once: true } as any);
        // Load script if not present
        if (!document.querySelector('script[src^="https://documentcloud.adobe.com/view-sdk/main.js"]')) {
          const script = document.createElement("script");
          script.src = "https://documentcloud.adobe.com/view-sdk/main.js";
          document.body.appendChild(script);
        }
      });

      const preview = async () => {
        await ensureReady();
        const AdobeDC = (window as any).AdobeDC;
        if (!AdobeDC?.View) return;
        const view = new AdobeDC.View({ clientId: adobeClientId, divId: containerId });
        viewRef.current = view;
        apisRef.current = null;

        const options = { 
          embedMode: "SIZED_CONTAINER", 
          defaultViewMode: "FIT_WIDTH", 
          showLeftHandPanel: false, 
          dockPageControls: false,
          showDownloadPDF: false,
          showPrintPDF: false,
          showSharePDF: false,
          showAnnotationTools: false
        } as any;
        try {
          if (file) {
            const buffer = file instanceof File ? await file.arrayBuffer() : file;
            await view.previewFile({ content: { promise: Promise.resolve(buffer) }, metaData: { fileName: currentDoc ?? 'document.pdf' } }, options);
          } else if (url) {
            await view.previewFile({ content: { location: { url } }, metaData: { fileName: currentDoc ?? 'document.pdf' } }, options);
          }
          // wait for APIs; Adobe can be async even after previewFile
          if (typeof (view as any).getAPIs === 'function') {
            const apis = await (view as any).getAPIs();
            apisRef.current = apis;
            
                        // Add text selection listener
            if (onTextSelection && apis.registerCallback) {
              console.log('Setting up text selection listeners...');
              console.log('Available callback types:', (window as any).AdobeDC?.View?.Enum?.CallbackType);
              
              try {
                apis.registerCallback(
                  (window as any).AdobeDC.View.Enum.CallbackType.GET_USER_PROFILE_API,
                  () => ({ userProfile: { name: "User", email: "user@example.com" } }),
                  {}
                );
                
                // Adobe PDF Embed doesn't have reliable text selection callbacks
                // Use document-level selection detection instead
                console.log('Setting up document-level text selection detection');
                throw new Error('Using fallback approach for better reliability');
              } catch (e) {
                console.warn('Could not register Adobe text selection callback:', e);
                console.log('Setting up fallback text selection...');

                // Enhanced fallback: listen for selection events on multiple levels
                const setupFallback = () => {
                  const container = document.getElementById(containerId);
                  console.log('Container found:', !!container, 'ID:', containerId);
                  
                  const handleSelection = (event: Event) => {
                    // Small delay to ensure selection is complete
                    setTimeout(() => {
                      const selection = window.getSelection();
                      const selectedText = selection?.toString().trim();
                      console.log('🎯 Adobe Selection detected:', {
                        text: selectedText,
                        length: selectedText?.length,
                        event: event.type,
                        target: (event.target as Element)?.tagName,
                        hasCallback: !!onTextSelection
                      });
                      
                      if (selectedText && selectedText.length > 3) {
                        console.log('🚀 Calling onTextSelection callback');
                        onTextSelection(
                          selectedText,
                          currentDoc || 'unknown',
                          page || 1
                        );
                      } else {
                        console.log('⚠️ Selection too short or empty');
                      }
                    }, 100);
                  };

                  // Add listeners to multiple elements for better coverage
                  if (container) {
                    console.log('Adding listeners to container');
                    container.addEventListener('mouseup', handleSelection, true);
                    container.addEventListener('touchend', handleSelection, true);
                    container.addEventListener('selectionchange', handleSelection, true);
                  }
                  
                  // Also listen on document level
                  document.addEventListener('mouseup', handleSelection, true);
                  document.addEventListener('touchend', handleSelection, true);
                  document.addEventListener('selectionchange', handleSelection, true);
                  
                  // Listen on iframe content if present
                  setTimeout(() => {
                    const iframe = container?.querySelector('iframe');
                    if (iframe) {
                      console.log('Found iframe, adding listeners');
                      try {
                        iframe.contentDocument?.addEventListener('mouseup', handleSelection, true);
                        iframe.contentDocument?.addEventListener('selectionchange', handleSelection, true);
                      } catch (e) {
                        console.log('Cannot access iframe content (CORS):', e);
                      }
                    }
                  }, 3000);
                };

                // Setup immediately and with delays for iframe loading
                setupFallback();
                setTimeout(setupFallback, 1000);
                setTimeout(setupFallback, 3000);
              }
            }
            // robust goto with retries until text layer settles
            const doGoto = async (p: number) => {
              try { await apis.gotoLocation({ pageNumber: p }); return true } catch {}
              try { await apis.gotoLocation(p); return true } catch {}
              return false
            }
            if (page) {
              const attempts = [0, 250, 700, 1500, 2500]
              attempts.forEach((delay) => {
                const t = window.setTimeout(() => { doGoto(page) }, delay)
                timeoutsRef.current.push(t)
              })
            }
            if (highlight && highlight.length > 3) {
              const query = highlight.replace(/\s+/g, ' ').trim().slice(0, 200);
              // Retry search a few times to allow text layer to settle
              timeoutsRef.current.forEach((t) => clearTimeout(t));
              timeoutsRef.current = [0, 300, 900, 1800].map((delay) => window.setTimeout(async () => {
                try { await apis.search?.(query); } catch {}
                try { await apis.searchText?.(query); } catch {}
              }, delay));
            }
          }
        } catch {
          // Silent failure; Adobe SDK may still load later
        }
      };

      preview();
      return () => {
        viewRef.current = null;
        apisRef.current = null;
        timeoutsRef.current.forEach((t) => clearTimeout(t));
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adobeClientId, url, currentDoc, file, containerId, page, highlight]);

    // pdfjs fallback render
    useEffect(() => {
      if (adobeClientId) return; // adobe mode only
      if (!currentDoc && !file) return; // nothing selected
      let cancelled = false;
      const render = async () => {
        const loaded = file
          ? await getDocument({ data: file instanceof File ? await file.arrayBuffer() : file }).promise
          : await getDocument(url).promise;
        if (cancelled) return;
        setPdf(loaded);
        const pg = await loaded.getPage(page);
        if (!canvasRef.current) return;
        const viewport = pg.getViewport({ scale: 1.25 });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await pg.render({ canvasContext: ctx, viewport }).promise;
        
        // Add text selection support for PDF.js fallback
        if (onTextSelection) {
          console.log('Setting up PDF.js text selection');
          const handleSelection = (event: Event) => {
            setTimeout(() => {
              const selection = window.getSelection();
              const selectedText = selection?.toString().trim();
              
              console.log('📄 PDF.js selection:', {
                text: selectedText,
                length: selectedText?.length,
                event: event.type,
                hasCallback: !!onTextSelection
              });
              
              if (selectedText && selectedText.length > 3) {
                console.log('🚀 PDF.js calling onTextSelection callback');
                onTextSelection(
                  selectedText,
                  currentDoc || 'unknown',
                  page || 1
                );
              } else {
                console.log('⚠️ PDF.js selection too short or empty');
              }
            }, 100);
          };
          
          // Add multiple event listeners for better coverage
          canvas.addEventListener('mouseup', handleSelection, true);
          canvas.addEventListener('touchend', handleSelection, true);
          document.addEventListener('mouseup', handleSelection, true);
          document.addEventListener('touchend', handleSelection, true);
          document.addEventListener('selectionchange', handleSelection, true);
        }
      };
      render();
      return () => { cancelled = true; };
    }, [url, page, adobeClientId]);

    useImperativeHandle(ref, () => ({
      goTo: (doc, pg, hl) => {
        setCurrentDoc(doc);
        const apis = apisRef.current;
        const doGoto = async (p: number) => {
          if (!apis) return;
          try { await apis.gotoLocation({ pageNumber: p }); return } catch {}
          try { await apis.gotoLocation(p); return } catch {}
        }
        // schedule retries whether or not APIs are ready
        timeoutsRef.current.forEach((t) => clearTimeout(t));
        [0, 250, 700, 1500, 2500].forEach((d) => timeoutsRef.current.push(window.setTimeout(() => doGoto(pg), d)));
        if (hl && hl.length > 3) {
          const query = hl.replace(/\s+/g, ' ').trim().slice(0, 200);
          [500, 1200, 2000].forEach((d) => timeoutsRef.current.push(window.setTimeout(async () => {
            const a = apisRef.current; if (!a) return;
            try { await a.search?.(query); } catch {}
            try { await a.searchText?.(query); } catch {}
          }, d)));
        }
      }
    }), [adobeClientId]);

    if (!currentDoc && !file) {
      return (
        <Card className="h-full w-full flex items-center justify-center border-0">
          <div className="text-sm text-muted-foreground">Select a section to open the PDF.</div>
        </Card>
      );
    }

    return (
      <div className="w-full h-full overflow-hidden">
        {adobeClientId ? (
          <div 
            ref={containerRef} 
            id={containerId} 
            className="w-full h-full bg-white"
            style={{ 
              width: '100%', 
              height: '100%',
              minHeight: '700px', 
              minWidth: '600px',
              maxHeight: '100%',
              maxWidth: '100%'
            }}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center p-6 text-sm text-destructive bg-white">
            Adobe PDF Embed Client ID not set. Please open Settings and add your Client ID.
          </div>
        )}
        <canvas ref={canvasRef} className="w-full h-full object-contain hidden" />
      </div>
    );
  }
);

PdfViewer.displayName = "PdfViewer";
export default PdfViewer;
