import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  pdfjsLib,
  PDF_CMAP_URL,
  PDF_CMAP_PACKED,
  PDF_STANDARD_FONT_DATA_URL,
} from '../lib/pdfLib';
import { getPdfFromIndexedDB } from '../lib/pdfStorage';
import {
  ChevronRight,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  Loader2,
  Palette,
  Trash2,
  Sparkles,
} from 'lucide-react';

interface NativePdfViewerProps {
  pdfUrl?: string; // Can be a direct URL, Google Drive preview/direct URL, or local file ID (local://id)
  page?: number; // Controlled active page (1-indexed)
  onPageChange?: (newPage: number, totalPages: number) => void;
  onTotalPagesLoaded?: (totalPages: number) => void;
  isTeacherControl?: boolean; // If true, displays teacher drawing tools and sends realtime laser/pen sync
  readOnly?: boolean; // If true (e.g. on projector display room), no drawing toolbar, only renders incoming drawings & laser
  realtimeLaser?: { x: number; y: number; active: boolean; timestamp: number; tool?: 'laser' | 'pen' | 'highlighter'; color?: string } | null;
  realtimeAnnotations?: Record<number, Array<{
    type: 'pen' | 'highlighter';
    color: string;
    width: number;
    points: Array<{ x: number; y: number }>;
  }>>;
  onLaserMove?: (laser: { x: number; y: number; active: boolean; timestamp: number; tool?: 'laser' | 'pen' | 'highlighter'; color?: string } | null) => void;
  onAnnotationsChange?: (annotations: Record<number, Array<{
    type: 'pen' | 'highlighter';
    color: string;
    width: number;
    points: Array<{ x: number; y: number }>;
  }>>) => void;
}

export const NativePdfViewer: React.FC<NativePdfViewerProps> = ({
  pdfUrl,
  page = 1,
  onPageChange,
  onTotalPagesLoaded,
  isTeacherControl = false,
  readOnly = false,
  realtimeLaser,
  realtimeAnnotations,
  onLaserMove,
  onAnnotationsChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(page || 1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  // Drawing tools state (only for teacher)
  const [activeTool, setActiveTool] = useState<'laser' | 'pen' | 'highlighter' | 'eraser' | 'none'>('laser');
  const [penColor, setPenColor] = useState<string>('#ef4444'); // red default
  const [penWidth, setPenWidth] = useState<number>(3.5);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const currentStrokeRef = useRef<Array<{ x: number; y: number }>>([]);

  // Local copy of annotations per page
  const [annotations, setAnnotations] = useState<Record<number, Array<{
    type: 'pen' | 'highlighter';
    color: string;
    width: number;
    points: Array<{ x: number; y: number }>;
  }>>>(() => realtimeAnnotations || {});

  // Sync incoming external annotations
  useEffect(() => {
    if (realtimeAnnotations) {
      setAnnotations(realtimeAnnotations);
    }
  }, [realtimeAnnotations]);

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

        // Base options configuring CMap & fonts to prevent Arabic/Thai character disconnections
        const baseOptions = {
          cMapUrl: PDF_CMAP_URL,
          cMapPacked: PDF_CMAP_PACKED,
          standardFontDataUrl: PDF_STANDARD_FONT_DATA_URL,
          enableXfa: true,
        };

        // Check if local file from IndexedDB
        if (pdfUrl.startsWith('local://')) {
          const fileId = pdfUrl.replace('local://', '');
          const record = await getPdfFromIndexedDB(fileId);
          if (!record || !record.data) {
            throw new Error('لم يتم العثور على الملف المحلي المخزن');
          }
          loadingTask = pdfjsLib.getDocument({
            ...baseOptions,
            data: new Uint8Array(record.data),
          });
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
          // Check if Google Drive link, convert to download/view stream if possible
          let directFetchUrl = pdfUrl;
          const driveMatch = pdfUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
          if (driveMatch && driveMatch[1]) {
            directFetchUrl = `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
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
  }, [pdfUrl]);

  // Redraw annotations on the overlay canvas
  const redrawAnnotations = useCallback(() => {
    if (!drawingCanvasRef.current) return;
    const canvas = drawingCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

  // Render current page onto canvas
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    try {
      const pageToRender = Math.max(1, Math.min(currentPage, totalPages));
      const pageObj = await pdfDoc.getPage(pageToRender);

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Accurately obtain client dimensions with fallback to window viewport
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = Math.max(containerRect.width, containerRef.current.clientWidth || (window.innerWidth - 32));
      const containerHeight = Math.max(containerRect.height, containerRef.current.clientHeight || (window.innerHeight - 80));

      // Base unscaled viewport
      const unscaledViewport = pageObj.getViewport({ scale: 1.0 });

      // In readOnly presentation mode (Projector Display Room), maximize screen utilization
      const marginH = readOnly ? 0 : 20;
      const marginV = readOnly ? 0 : 40;
      const availableW = Math.max(100, containerWidth - marginH);
      const availableH = Math.max(100, containerHeight - marginV);

      const scaleX = availableW / unscaledViewport.width;
      const scaleY = availableH / unscaledViewport.height;

      // Fit to fill maximum possible viewport dimension (contain)
      const fitScale = Math.min(scaleX, scaleY) * zoomScale;
      const finalScale = Math.max(fitScale, 0.4);

      const viewport = pageObj.getViewport({ scale: finalScale });

      // Match HiDPI devices for crystal sharp rendering
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      // Match drawing overlay canvas exactly
      if (drawingCanvasRef.current) {
        const dCanvas = drawingCanvasRef.current;
        dCanvas.width = canvas.width;
        dCanvas.height = canvas.height;
        dCanvas.style.width = canvas.style.width;
        dCanvas.style.height = canvas.style.height;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      await pageObj.render(renderContext).promise;
      ctx.restore();

      // Redraw any existing drawings for this page
      redrawAnnotations();
    } catch (renderErr) {
      console.warn('PDF Page render interrupted or failed:', renderErr);
    }
  }, [pdfDoc, currentPage, totalPages, zoomScale, readOnly, redrawAnnotations]);

  // Trigger page render on state changes or window resize with ResizeObserver for instant responsive re-render
  useEffect(() => {
    renderPage();

    const handleResize = () => {
      renderPage();
    };
    window.addEventListener('resize', handleResize);

    let observer: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        renderPage();
      });
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
    };
  }, [renderPage]);

  // Redraw annotations whenever annotations prop or currentPage changes
  useEffect(() => {
    redrawAnnotations();
  }, [redrawAnnotations]);

  // Page navigation handlers
  const handlePrevPage = () => {
    if (currentPage > 1) {
      const nextP = currentPage - 1;
      setCurrentPage(nextP);
      if (onPageChange) onPageChange(nextP, totalPages);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const nextP = currentPage + 1;
      setCurrentPage(nextP);
      if (onPageChange) onPageChange(nextP, totalPages);
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

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (readOnly || !isTeacherControl) return;

    if (activeTool === 'laser') {
      const coords = getNormalizedCoords(e);
      if (onLaserMove) {
        onLaserMove({ ...coords, active: true, timestamp: Date.now(), tool: 'laser' });
      }
      return;
    }

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      setIsDrawing(true);
      const coords = getNormalizedCoords(e);
      currentStrokeRef.current = [coords];

      // Broadcast live pen tip cursor position so students see the teacher touching down the pen
      if (onLaserMove) {
        onLaserMove({ ...coords, active: true, timestamp: Date.now(), tool: activeTool, color: penColor });
      }
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (readOnly || !isTeacherControl) return;

    if (activeTool === 'laser') {
      const coords = getNormalizedCoords(e);
      if (onLaserMove) {
        onLaserMove({ ...coords, active: true, timestamp: Date.now(), tool: 'laser' });
      }
      return;
    }

    if (isDrawing && (activeTool === 'pen' || activeTool === 'highlighter')) {
      const coords = getNormalizedCoords(e);
      currentStrokeRef.current.push(coords);

      // Broadcast live pen tip motion in real time! Students see the pen cursor moving as it draws!
      if (onLaserMove) {
        onLaserMove({ ...coords, active: true, timestamp: Date.now(), tool: activeTool, color: penColor });
      }

      // Draw immediate live stroke on teacher canvas
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
    }
  };

  const handlePointerUp = () => {
    if (readOnly || !isTeacherControl) return;

    if (activeTool === 'laser') {
      if (onLaserMove) {
        onLaserMove(null);
      }
      return;
    }

    if (isDrawing) {
      setIsDrawing(false);
      // Turn off live pen cursor on release
      if (onLaserMove) {
        onLaserMove(null);
      }

      const pts = currentStrokeRef.current;
      if (pts.length > 1) {
        const newStroke = {
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
      }
      currentStrokeRef.current = [];
    }
  };

  const handleClearPageDrawings = () => {
    const updated = {
      ...annotations,
      [currentPage]: [],
    };
    setAnnotations(updated);
    if (onAnnotationsChange) {
      onAnnotationsChange(updated);
    }
    redrawAnnotations();
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-slate-950 select-none text-slate-100 ${
        readOnly ? 'p-0' : ''
      }`}
    >
      {/* Top Floating Teacher Control Bar (if teacher control mode) */}
      {isTeacherControl && !readOnly && (
        <div className="absolute top-3 z-30 flex flex-wrap items-center justify-center gap-2 px-4 py-2 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl">
          {/* Laser Tool */}
          <button
            type="button"
            onClick={() => setActiveTool('laser')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTool === 'laser'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-400'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
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
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>تظليل فسفوري 🖍️</span>
          </button>

          {/* Colors quick switch (if pen active) */}
          {(activeTool === 'pen' || activeTool === 'highlighter') && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-950/70 rounded-xl border border-slate-700">
              {['#ef4444', '#eab308', '#3b82f6', '#10b981', '#ffffff'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPenColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform cursor-pointer border border-white/30 ${
                    penColor === c ? 'scale-125 ring-2 ring-white' : 'hover:scale-110 opacity-70'
                  }`}
                  style={{ backgroundColor: c }}
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

          <div className="h-4 w-px bg-slate-700 mx-1"></div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 text-slate-400">
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.max(0.6, z - 0.15))}
              className="p-1 hover:text-white transition-colors cursor-pointer"
              title="تصغير"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1 font-bold">{Math.round(zoomScale * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.min(2.0, z + 0.15))}
              className="p-1 hover:text-white transition-colors cursor-pointer"
              title="تكبير"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Canvas Presentation Viewport */}
      <div className={`relative flex-1 w-full h-full flex items-center justify-center overflow-auto ${readOnly ? 'p-0' : 'p-2'}`}>
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
            <div className="text-xs text-rose-300 mb-4">{errorMsg}</div>
            <div className="text-xs text-slate-400 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              💡 نصيحة: يمكنك رفع ملف الـ PDF مباشرة من جهازك عبر زر &quot;رفع ملف PDF&quot;، ليعمل بأقصى سرعة وبدون قيود.
            </div>
          </div>
        )}

        {/* PDF Render Canvas & Overlay Wrapper */}
        <div className="relative shadow-2xl rounded-lg overflow-hidden border border-slate-800 bg-white leading-none">
          <canvas ref={canvasRef} className="block pointer-events-none" />

          {/* Realtime Drawing / Laser Interaction Overlay Canvas */}
          <canvas
            ref={drawingCanvasRef}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
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

          {/* Realtime Laser Dot Indicator (Received from Teacher or Local) */}
          {(realtimeLaser?.active || (activeTool === 'laser' && isTeacherControl)) && (
            <div
              className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
              style={{
                left: `${(realtimeLaser?.x ?? 0.5) * 100}%`,
                top: `${(realtimeLaser?.y ?? 0.5) * 100}%`,
              }}
            >
              {/* Dynamic Indicator: either Laser (red pulsing beam) or Pen tip (animated writing marker) */}
              {realtimeLaser?.tool === 'pen' || realtimeLaser?.tool === 'highlighter' ? (
                <div className="relative flex items-center justify-center">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow-lg animate-pulse"
                    style={{ backgroundColor: realtimeLaser.color || penColor }}
                  />
                  {/* Subtle pen cursor icon next to tip */}
                  <span className="absolute -top-3 -right-3 text-xs drop-shadow-md select-none">
                    ✏️
                  </span>
                </div>
              ) : (
                <div className="relative flex items-center justify-center">
                  <span className="absolute w-8 h-8 rounded-full bg-rose-500/40 animate-ping"></span>
                  <span className="w-4 h-4 rounded-full bg-rose-600 border-2 border-white shadow-[0_0_15px_#ff0055]"></span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Navigation Controls (Page Navigator) - Only shown in Teacher Control or standalone mode, hidden on projector display room */}
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
