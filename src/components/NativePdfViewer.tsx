import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  pdfjsLib,
  PDF_CMAP_URL,
  PDF_CMAP_PACKED,
  PDF_STANDARD_FONT_DATA_URL,
} from '../lib/pdfLib';
import { getPdfFromIndexedDB } from '../lib/pdfStorage';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Palette,
  Sparkles,
  Trash2,
  Loader2,
  AlertCircle,
  Maximize2,
  Columns,
  RefreshCw,
} from 'lucide-react';

export interface LivePdfStroke {
  type: 'pen' | 'highlighter';
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

export interface LivePdfLaserData {
  x: number;
  y: number;
  active: boolean;
  timestamp: number;
  tool?: 'laser' | 'pen' | 'highlighter';
  color?: string;
  isDrawing?: boolean;
}

interface NativePdfViewerProps {
  pdfUrl: string;
  page?: number;
  onPageChange?: (page: number, total: number) => void;
  isTeacherControl?: boolean;
  readOnly?: boolean;
  realtimeLaser?: LivePdfLaserData | null;
  realtimeAnnotations?: Record<number, Array<LivePdfStroke>>;
  onLaserMove?: (laser: LivePdfLaserData | null) => void;
  onAnnotationsChange?: (annotations: Record<number, Array<LivePdfStroke>>) => void;
  onTotalPagesLoaded?: (total: number) => void;
  fitMode?: 'contain' | 'width';
  onFitModeChange?: (mode: 'contain' | 'width') => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}

export const NativePdfViewer: React.FC<NativePdfViewerProps> = ({
  pdfUrl,
  page = 1,
  onPageChange,
  isTeacherControl = false,
  readOnly = false,
  realtimeLaser,
  realtimeAnnotations,
  onLaserMove,
  onAnnotationsChange,
  onTotalPagesLoaded,
  fitMode: propFitMode,
  onFitModeChange,
  zoom: propZoom,
  onZoomChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const renderTaskRef = useRef<any>(null);
  const lastRenderedKeyRef = useRef<string>('');
  const redrawAnnotationsRef = useRef<() => void>(() => {});

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(page || 1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Scaling & Display Modes ('contain': fit height/whole slide, 'width': fill 100% width)
  const [fitMode, setFitMode] = useState<'contain' | 'width'>(propFitMode || 'contain');
  const [zoomScale, setZoomScale] = useState<number>(propZoom || 1.0);

  // Sync prop fitMode and zoom
  useEffect(() => {
    if (propFitMode && propFitMode !== fitMode) {
      setFitMode(propFitMode);
    }
  }, [propFitMode]);

  useEffect(() => {
    if (typeof propZoom === 'number' && propZoom !== zoomScale) {
      setZoomScale(propZoom);
    }
  }, [propZoom]);

  // Drawing tools state (for teacher control)
  const [activeTool, setActiveTool] = useState<'laser' | 'pen' | 'highlighter' | 'none'>('pen');
  const [penColor, setPenColor] = useState<string>('#ef4444'); // red default
  const [penWidth, setPenWidth] = useState<number>(3.5);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const currentStrokeRef = useRef<Array<{ x: number; y: number }>>([]);
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Local copy of annotations per page
  const [annotations, setAnnotations] = useState<Record<number, Array<LivePdfStroke>>>(() => realtimeAnnotations || {});
  const lastLocalAnnotationsUpdateRef = useRef<number>(0);

  // Local/received pointer data for drawing & laser movements
  const [currentPointer, setCurrentPointer] = useState<LivePdfLaserData | null>(() => realtimeLaser || null);
  const pointerFadeTimeoutRef = useRef<any>(null);

  // Setup BroadcastChannel for 0ms local cross-tab sync
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('vidless_live_pdf_channel');
        broadcastChannelRef.current = bc;

        bc.onmessage = (evt) => {
          const data = evt.data;
          if (!data) return;

          if (data.type === 'laser') {
            setCurrentPointer(data.laser);
          } else if (data.type === 'annotations') {
            if (data.updatedAt && data.updatedAt < lastLocalAnnotationsUpdateRef.current) {
              return;
            }
            setAnnotations(data.annotations);
          } else if (data.type === 'page' && typeof data.page === 'number') {
            setCurrentPage(data.page);
          } else if (data.type === 'view_settings') {
            if (data.fitMode) setFitMode(data.fitMode);
            if (typeof data.zoom === 'number') setZoomScale(data.zoom);
          }
        };

        return () => {
          bc.close();
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization bypassed:', err);
      }
    }
  }, []);

  // Sync incoming external annotations (protect against stale snapshots overwriting recent local edits)
  useEffect(() => {
    if (realtimeAnnotations) {
      if (Date.now() - lastLocalAnnotationsUpdateRef.current < 1500) {
        return;
      }
      setAnnotations(realtimeAnnotations);
    }
  }, [realtimeAnnotations]);

  // Sync incoming external laser / pen
  useEffect(() => {
    if (realtimeLaser !== undefined) {
      setCurrentPointer(realtimeLaser);
    }
  }, [realtimeLaser]);

  // Keep internal currentPage in sync with props
  useEffect(() => {
    if (page && page !== currentPage) {
      setCurrentPage(page);
    }
  }, [page]);

  // Load PDF Document
  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      if (!pdfUrl) {
        setLoading(false);
        setErrorMsg('لا يوجد ملف PDF محدد للعرض');
        return;
      }

      setLoading(true);
      setErrorMsg(null);

      try {
        let loadingTask: any;

        // Base options configuring CMap & standard fonts to prevent Arabic/Thai character disconnections
        const baseOptions = {
          cMapUrl: PDF_CMAP_URL,
          cMapPacked: PDF_CMAP_PACKED,
          standardFontDataUrl: PDF_STANDARD_FONT_DATA_URL,
          enableXfa: true,
          disableFontFace: false,
          fontExtraProperties: true,
          useWorkerFetch: true,
        };

        // 1. Local or Server-stored PDF
        if (pdfUrl.startsWith('local://') || pdfUrl.startsWith('/api/pdf/')) {
          const fileId = pdfUrl.replace(/^local:\/\//, '').replace(/^\/api\/pdf\//, '');
          const record = await getPdfFromIndexedDB(fileId);
          if (record && record.data) {
            loadingTask = pdfjsLib.getDocument({
              ...baseOptions,
              data: new Uint8Array(record.data),
            });
          } else {
            // Direct fetch from server route /api/pdf/:id
            const safeId = fileId.replace(/[^a-zA-Z0-9_-]/g, '_');
            
            // Check if file is available on server; if still writing, wait briefly and retry
            let checkRes = await fetch(`/api/pdf/${safeId}`, { method: 'HEAD' }).catch(() => null);
            if (!checkRes || !checkRes.ok) {
              await new Promise(r => setTimeout(r, 1200));
            }

            loadingTask = pdfjsLib.getDocument({
              ...baseOptions,
              url: `/api/pdf/${safeId}`,
              withCredentials: false,
            });
          }
        } else if (pdfUrl.startsWith('data:application/pdf;base64,')) {
          // Base64 direct data
          const base64Data = pdfUrl.split(',')[1];
          const rawData = atob(base64Data);
          const uint8Array = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; i++) {
            uint8Array[i] = rawData.charCodeAt(i);
          }
          loadingTask = pdfjsLib.getDocument({
            ...baseOptions,
            data: uint8Array,
          });
        } else {
          // Check if Google Drive link, convert to download/view stream through server proxy to bypass CORS
          let directFetchUrl = pdfUrl;
          const driveMatch = pdfUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                             pdfUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
          if (driveMatch && driveMatch[1]) {
            directFetchUrl = `/api/proxy-drive?id=${driveMatch[1]}`;
          }

          loadingTask = pdfjsLib.getDocument({
            ...baseOptions,
            url: directFetchUrl,
            withCredentials: false,
          });
        }

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        const count = doc.numPages;
        setTotalPages(count);
        if (onTotalPagesLoaded) {
          onTotalPagesLoaded(count);
        }
        setLoading(false);
      } catch (err: any) {
        if (isCancelled) return;
        console.error('Error loading native PDF:', err);
        setErrorMsg(err.message || 'تعذر تحميل ملف الـ PDF. يرجى التأكد من صلاحية الرابط أو رفع الملف مباشرة من جهازك.');
        setLoading(false);
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [pdfUrl, onTotalPagesLoaded, retryTrigger]);

  // Redraw annotations strictly on the overlay drawing canvas (NEVER touches or clears the PDF canvas!)
  const redrawAnnotations = useCallback(() => {
    if (!drawingCanvasRef.current) return;
    const canvas = drawingCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear ONLY the transparent overlay canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pageStrokes = annotations[currentPage] || [];
    if (pageStrokes.length === 0) return;

    const w = canvas.width;
    const h = canvas.height;
    const dpr = window.devicePixelRatio || 1;

    pageStrokes.forEach((stroke) => {
      if (!stroke.points || stroke.points.length < 2) return;

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width * dpr;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.type === 'highlighter') {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = stroke.width * 3 * dpr;
      } else {
        ctx.globalAlpha = 0.95;
      }

      const p0 = stroke.points[0];
      ctx.moveTo(p0.x * w, p0.y * h);

      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        ctx.lineTo(pt.x * w, pt.y * h);
      }
      ctx.stroke();
      ctx.restore();
    });
  }, [annotations, currentPage]);

  // Keep latest redrawAnnotations accessible without triggering renderPage rebuilds
  useEffect(() => {
    redrawAnnotationsRef.current = redrawAnnotations;
  }, [redrawAnnotations]);

  // Render current PDF page onto background canvas (ONLY on page/zoom/scale changes, NOT on drawing/laser moves!)
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    try {
      const pageToRender = Math.max(1, Math.min(currentPage, totalPages));
      const pageObj = await pdfDoc.getPage(pageToRender);

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Ensure all document and Arabic fonts are ready
      if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch {}
      }

      // Calculate reliable width & height of presentation viewport
      let availableW = 0;
      let availableH = 0;

      if (readOnly) {
        // Full screen / theater mode (Projector Display Room)
        const windowW = window.innerWidth;
        const windowH = window.innerHeight;
        const clientW = containerRef.current?.clientWidth || 0;
        const clientH = containerRef.current?.clientHeight || 0;
        availableW = Math.max(clientW, windowW);
        availableH = Math.max(clientH, windowH - 56); // 56px header
      } else {
        // Teacher Manager Card mode
        const cRect = containerRef.current?.getBoundingClientRect();
        availableW = Math.max(300, containerRef.current?.clientWidth || cRect?.width || 600);
        availableH = Math.max(350, containerRef.current?.clientHeight || cRect?.height || 500);
      }

      // Base unscaled page viewport
      const unscaledViewport = pageObj.getViewport({ scale: 1.0 });

      let finalScale = 1.0;
      if (fitMode === 'width') {
        const marginH = readOnly ? 0 : 16;
        finalScale = ((availableW - marginH) / unscaledViewport.width) * zoomScale;
      } else {
        const marginH = readOnly ? 0 : 20;
        const marginV = readOnly ? 0 : 32;
        const scaleX = (availableW - marginH) / unscaledViewport.width;
        const scaleY = (availableH - marginV) / unscaledViewport.height;
        finalScale = Math.min(scaleX, scaleY) * zoomScale;
      }

      finalScale = Math.max(0.4, Math.min(finalScale, 4.0));

      const viewport = pageObj.getViewport({ scale: finalScale });

      // Match HiDPI devices for razor-sharp Retina presentation
      const dpr = window.devicePixelRatio || 1;
      const pixelWidth = Math.floor(viewport.width * dpr);
      const pixelHeight = Math.floor(viewport.height * dpr);
      const cssWidth = Math.floor(viewport.width);
      const cssHeight = Math.floor(viewport.height);

      // Cache key: If page and exact dimensions haven't changed, DO NOT wipe or re-render canvas!
      const renderKey = `${pageToRender}_${pixelWidth}_${pixelHeight}_${finalScale}`;
      if (lastRenderedKeyRef.current === renderKey && canvas.width === pixelWidth) {
        return;
      }

      // Cancel any ongoing render task before starting a new one
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
        renderTaskRef.current = null;
      }

      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;

      // Match drawing overlay canvas exactly
      if (drawingCanvasRef.current) {
        const dCanvas = drawingCanvasRef.current;
        dCanvas.width = pixelWidth;
        dCanvas.height = pixelHeight;
        dCanvas.style.width = `${cssWidth}px`;
        dCanvas.style.height = `${cssHeight}px`;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Support Arabic RTL text shaping on canvas context
      if ('direction' in ctx) {
        try {
          (ctx as any).direction = 'rtl';
        } catch {}
      }
      if ('fontKerning' in ctx) {
        try {
          (ctx as any).fontKerning = 'normal';
        } catch {}
      }

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      const task = pageObj.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
      lastRenderedKeyRef.current = renderKey;
      ctx.restore();

      // Redraw drawings on overlay canvas once page is painted
      if (redrawAnnotationsRef.current) {
        redrawAnnotationsRef.current();
      }
    } catch (renderErr: any) {
      if (renderErr?.name !== 'RenderingCancelledException') {
        console.warn('PDF Page render interrupted or failed:', renderErr);
      }
    }
  }, [pdfDoc, currentPage, totalPages, zoomScale, fitMode, readOnly]);

  // Trigger page render on page/zoom/scale changes or debounced window resize
  useEffect(() => {
    renderPage();

    let debounceTimer: any = null;
    let lastW = containerRef.current?.clientWidth || 0;
    let lastH = containerRef.current?.clientHeight || 0;

    const handleResize = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        renderPage();
      }, 150);
    };

    window.addEventListener('resize', handleResize);

    let observer: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const newW = entry.contentRect.width;
          const newH = entry.contentRect.height;
          // Only re-render if dimensions changed meaningfully (> 4px)
          if (Math.abs(newW - lastW) > 4 || Math.abs(newH - lastH) > 4) {
            lastW = newW;
            lastH = newH;
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              renderPage();
            }, 150);
          }
        }
      });
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (observer) observer.disconnect();
    };
  }, [renderPage]);

  // Redraw ONLY annotations overlay when annotations or page change (never wipes PDF canvas!)
  useEffect(() => {
    redrawAnnotations();
  }, [redrawAnnotations]);

  // Page navigation handlers
  const handlePrevPage = () => {
    if (currentPage > 1) {
      const nextP = currentPage - 1;
      setCurrentPage(nextP);
      if (onPageChange) onPageChange(nextP, totalPages);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ type: 'page', page: nextP });
      }
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const nextP = currentPage + 1;
      setCurrentPage(nextP);
      if (onPageChange) onPageChange(nextP, totalPages);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ type: 'page', page: nextP });
      }
    }
  };

  // Drawing & Pointer event handlers (Teacher control)
  const getNormalizedCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawingCanvasRef.current) return { x: 0, y: 0 };
    const rect = drawingCanvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x, y };
  };

  const broadcastPointer = (pointer: LivePdfLaserData | null) => {
    // 1. Local BroadcastChannel (0ms delay)
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({ type: 'laser', laser: pointer });
      } catch {}
    }
    // 2. Local state
    setCurrentPointer(pointer);
    // 3. Callback (Firebase)
    if (onLaserMove) {
      onLaserMove(pointer);
    }
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (readOnly || !isTeacherControl) return;

    if (pointerFadeTimeoutRef.current) {
      clearTimeout(pointerFadeTimeoutRef.current);
    }

    const coords = getNormalizedCoords(e);

    if (activeTool === 'laser') {
      broadcastPointer({ ...coords, active: true, timestamp: Date.now(), tool: 'laser' });
      return;
    }

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      setIsDrawing(true);
      currentStrokeRef.current = [coords];

      // Broadcast live pen tip cursor position with isDrawing = true
      broadcastPointer({
        ...coords,
        active: true,
        timestamp: Date.now(),
        tool: activeTool,
        color: penColor,
        isDrawing: true,
      });
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (readOnly || !isTeacherControl) return;

    const coords = getNormalizedCoords(e);

    if (activeTool === 'laser') {
      broadcastPointer({ ...coords, active: true, timestamp: Date.now(), tool: 'laser' });
      return;
    }

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      if (isDrawing) {
        currentStrokeRef.current.push(coords);

        // Broadcast live writing movement in real time!
        broadcastPointer({
          ...coords,
          active: true,
          timestamp: Date.now(),
          tool: activeTool,
          color: penColor,
          isDrawing: true,
        });

        // Draw immediate live stroke segment on teacher canvas
        if (drawingCanvasRef.current) {
          const canvas = drawingCanvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = penColor;
            ctx.lineWidth = penWidth * (window.devicePixelRatio || 1);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (activeTool === 'highlighter') {
              ctx.globalAlpha = 0.35;
              ctx.lineWidth = penWidth * 3 * (window.devicePixelRatio || 1);
            } else {
              ctx.globalAlpha = 0.95;
            }

            const pts = currentStrokeRef.current;
            if (pts.length >= 2) {
              const pPrev = pts[pts.length - 2];
              const pCurr = pts[pts.length - 1];
              ctx.moveTo(pPrev.x * canvas.width, pPrev.y * canvas.height);
              ctx.lineTo(pCurr.x * canvas.width, pCurr.y * canvas.height);
              ctx.stroke();
            }
            ctx.restore();
          }
        }
      } else {
        // Teacher is hovering or pointing with pen (before clicking):
        // Broadcast pointer position so students see where teacher is pointing with the pen
        broadcastPointer({
          ...coords,
          active: true,
          timestamp: Date.now(),
          tool: activeTool,
          color: penColor,
          isDrawing: false,
        });
      }
    }
  };

  const handlePointerUp = () => {
    if (readOnly || !isTeacherControl) return;

    if (activeTool === 'laser') {
      broadcastPointer(null);
      return;
    }

    if (isDrawing) {
      setIsDrawing(false);

      const pts = currentStrokeRef.current;
      if (pts.length > 1) {
        lastLocalAnnotationsUpdateRef.current = Date.now();
        const newStroke: LivePdfStroke = {
          type: activeTool as 'pen' | 'highlighter',
          color: penColor,
          width: penWidth,
          points: pts,
        };

        const updated = {
          ...annotations,
          [currentPage]: [...(annotations[currentPage] || []), newStroke],
        };
        setAnnotations(updated);
        if (onAnnotationsChange) {
          onAnnotationsChange(updated);
        }
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({
            type: 'annotations',
            annotations: updated,
            updatedAt: Date.now(),
          });
        }
      }
      currentStrokeRef.current = [];

      // Keep the pen tip visible for a short moment after release, then gently fade
      if (pointerFadeTimeoutRef.current) clearTimeout(pointerFadeTimeoutRef.current);
      pointerFadeTimeoutRef.current = setTimeout(() => {
        broadcastPointer(null);
      }, 1500);
    }
  };

  const handlePointerLeave = () => {
    if (readOnly || !isTeacherControl) return;
    if (isDrawing) {
      handlePointerUp();
    } else {
      if (pointerFadeTimeoutRef.current) clearTimeout(pointerFadeTimeoutRef.current);
      pointerFadeTimeoutRef.current = setTimeout(() => {
        broadcastPointer(null);
      }, 800);
    }
  };

  const handleClearPageDrawings = () => {
    lastLocalAnnotationsUpdateRef.current = Date.now();
    const updated = {
      ...annotations,
      [currentPage]: [],
    };
    setAnnotations(updated);
    if (onAnnotationsChange) {
      onAnnotationsChange(updated);
    }
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'annotations',
        annotations: updated,
        updatedAt: Date.now(),
      });
    }
    redrawAnnotations();
  };

  const handleToggleFitMode = (mode: 'contain' | 'width') => {
    setFitMode(mode);
    if (onFitModeChange) onFitModeChange(mode);
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'view_settings',
        fitMode: mode,
        zoom: zoomScale,
      });
    }
  };

  const handleZoomChange = (delta: number) => {
    const newZ = Math.max(0.6, Math.min(2.5, Math.round((zoomScale + delta) * 100) / 100));
    setZoomScale(newZ);
    if (onZoomChange) onZoomChange(newZ);
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'view_settings',
        fitMode,
        zoom: newZ,
      });
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-slate-950 select-none text-slate-100 ${
        readOnly ? 'p-0 m-0' : ''
      }`}
    >
      {/* Top Teacher Control Bar (Annotations, Laser, Colors, Zoom, Fit Mode) */}
      {isTeacherControl && !readOnly && (
        <div className="absolute top-2 z-30 flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl max-w-full">
          {/* Laser Tool */}
          <button
            type="button"
            onClick={() => setActiveTool('laser')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTool === 'laser'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-400'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="مؤشر الليزر الأحمر"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse"></span>
            <span>مؤشر الليزر 🔴</span>
          </button>

          {/* Pen Tool */}
          <button
            type="button"
            onClick={() => setActiveTool('pen')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTool === 'pen'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="القلم للرسم والكتابة الحية"
          >
            <Palette className="w-3.5 h-3.5" />
            <span>القلم ✏️</span>
          </button>

          {/* Highlighter Tool */}
          <button
            type="button"
            onClick={() => setActiveTool('highlighter')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTool === 'highlighter'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 ring-2 ring-amber-300 font-black'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="تظليل فسفوري شفاف"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>تظليل فسفوري 🖍️</span>
          </button>

          {/* Color Switcher */}
          {(activeTool === 'pen' || activeTool === 'highlighter') && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-950/70 rounded-xl border border-slate-700">
              {['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#ffffff'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPenColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform cursor-pointer border border-white/30 ${
                    penColor === c ? 'scale-125 ring-2 ring-white' : 'hover:scale-110 opacity-70'
                  }`}
                  style={{ backgroundColor: c }}
                  title={`لون ${c}`}
                />
              ))}
            </div>
          )}

          {/* Clear Page Drawings */}
          <button
            type="button"
            onClick={handleClearPageDrawings}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-300 text-xs font-semibold transition-all cursor-pointer border border-slate-700"
            title="مسح رسومات هذه الصفحة"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>مسح الرسومات</span>
          </button>

          <div className="h-4 w-px bg-slate-700 mx-0.5"></div>

          {/* Display Mode: Fit Screen vs Fit Width */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => handleToggleFitMode('contain')}
              className={`px-2 py-1 rounded-lg font-bold transition-all ${
                fitMode === 'contain'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="ملاءمة كامل الشاشة (ارتفاع وعرض)"
            >
              ملاءمة الشاشة
            </button>
            <button
              type="button"
              onClick={() => handleToggleFitMode('width')}
              className={`px-2 py-1 rounded-lg font-bold transition-all ${
                fitMode === 'width'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="ملء العرض الكامل (شاشة عريضة وضخمة)"
            >
              ملء العرض
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 text-slate-400">
            <button
              type="button"
              onClick={() => handleZoomChange(-0.15)}
              className="p-1 hover:text-white transition-colors cursor-pointer"
              title="تصغير"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1 font-bold">{Math.round(zoomScale * 100)}%</span>
            <button
              type="button"
              onClick={() => handleZoomChange(0.15)}
              className="p-1 hover:text-white transition-colors cursor-pointer"
              title="تكبير"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Canvas Presentation Viewport */}
      <div
        className={`relative flex-1 w-full h-full flex items-center justify-center overflow-auto ${
          readOnly ? 'p-0 m-0' : 'p-2'
        }`}
      >
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/80 backdrop-blur-sm">
            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
            <div className="text-sm font-semibold text-slate-300">جاري تجهيز وعرض صفحة الـ PDF بدقة فائقة...</div>
          </div>
        )}

        {errorMsg && (
          <div className="flex flex-col items-center justify-center p-6 bg-rose-950/40 border border-rose-800 rounded-2xl max-w-md text-center">
            <AlertCircle className="w-12 h-12 text-rose-400 mb-2" />
            <div className="text-base font-bold text-rose-200 mb-1">تعذر فتح ملف الـ PDF</div>
            <div className="text-xs text-rose-300 mb-3">{errorMsg}</div>
            
            <button
              type="button"
              onClick={() => setRetryTrigger(prev => prev + 1)}
              className="mb-3 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة المحاولة الآن 🔄</span>
            </button>

            <div className="text-xs text-slate-400 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              💡 نصيحة: يمكنك رفع ملف الـ PDF مباشرة من جهازك عبر زر &quot;رفع ملف PDF&quot;، ليعمل بأقصى سرعة وبدون قيود.
            </div>
          </div>
        )}

        {/* PDF Render Canvas & Overlay Wrapper */}
        <div
          className={`relative shadow-2xl overflow-hidden bg-white leading-none ${
            readOnly ? 'rounded-none border-0' : 'rounded-lg border border-slate-800'
          }`}
          style={{
            fontFamily: "'Noto Naskh Arabic', 'Cairo', 'Amiri', 'Tajawal', sans-serif",
            fontFeatureSettings: "'liga' 1, 'kern' 1",
            direction: 'rtl',
          }}
        >
          {/* Base PDF Render Canvas */}
          <canvas
            ref={canvasRef}
            className="block pointer-events-none mx-auto max-w-none"
            style={{
              fontFamily: "'Noto Naskh Arabic', 'Cairo', 'Amiri', 'Tajawal', sans-serif",
              fontFeatureSettings: "'liga' 1, 'kern' 1",
              direction: 'rtl',
            }}
          />

          {/* Realtime Drawing / Interaction Overlay Canvas */}
          <canvas
            ref={drawingCanvasRef}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerLeave}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            onTouchCancel={handlePointerUp}
            className={`absolute inset-0 z-10 touch-none ${
              readOnly
                ? 'pointer-events-none'
                : activeTool === 'laser'
                ? 'cursor-crosshair'
                : activeTool === 'pen' || activeTool === 'highlighter'
                ? 'cursor-crosshair'
                : 'cursor-default'
            }`}
          />

          {/* Realtime Writing Pen / Laser Dynamic Indicator */}
          {Boolean(currentPointer?.active) && (
            <div
              className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-all duration-75 ease-out"
              style={{
                left: `${(currentPointer?.x ?? 0.5) * 100}%`,
                top: `${(currentPointer?.y ?? 0.5) * 100}%`,
                willChange: 'transform, left, top',
              }}
            >
              {currentPointer?.tool === 'pen' || currentPointer?.tool === 'highlighter' ? (
                /* LIVE WRITING PEN INDICATOR: Shows pen icon tilted down and animated nib */
                <div className="relative flex items-center justify-center">
                  {/* Ink contact dot / nib */}
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-pulse"
                    style={{ backgroundColor: currentPointer?.color || penColor }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>

                  {/* Pulsing ink ripple when pen is actively writing / drawing */}
                  {Boolean(currentPointer?.isDrawing) && (
                    <span
                      className="absolute w-8 h-8 rounded-full border-2 border-white/80 animate-ping"
                      style={{ borderColor: currentPointer?.color || penColor }}
                    />
                  )}

                  {/* Distinct tilted pen cursor icon floating right above the nib */}
                  <div className="absolute -top-7 -right-6 pointer-events-none transform -rotate-12 transition-transform duration-100 flex items-center gap-1 bg-slate-900/90 text-white px-1.5 py-0.5 rounded-md border border-slate-700/80 shadow-md text-[10px] font-bold">
                    <span>✏️</span>
                    <span className="text-[9px] font-mono opacity-80">
                      {currentPointer?.isDrawing ? 'يكتب...' : 'قلم'}
                    </span>
                  </div>
                </div>
              ) : (
                /* RED PULSING LASER BEAM */
                <div className="relative flex items-center justify-center">
                  <span className="absolute w-8 h-8 rounded-full bg-rose-500/40 animate-ping"></span>
                  <span className="w-4 h-4 rounded-full bg-rose-600 border-2 border-white shadow-[0_0_15px_#ff0055]"></span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Navigation Controls (Page Navigator) - Shown in Teacher Control or standalone mode */}
      {!readOnly && (
        <div className="sticky bottom-2 z-30 flex items-center gap-3 px-5 py-2 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
              currentPage <= 1
                ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-500'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-md shadow-emerald-950'
            }`}
            title="الصفحة السابقة"
          >
            <ChevronRight className="w-4 h-4" />
            <span>السابقة</span>
          </button>

          <div className="flex items-center gap-2 px-3 py-1 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs">
            <span className="text-slate-400">صفحة</span>
            <span className="text-emerald-400 font-black text-sm">{currentPage}</span>
            <span className="text-slate-500">من</span>
            <span className="text-slate-300 font-bold">{totalPages}</span>
          </div>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
              currentPage >= totalPages
                ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-500'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-md shadow-emerald-950'
            }`}
            title="الصفحة التالية"
          >
            <span>التالية</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
