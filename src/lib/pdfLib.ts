import * as pdfjsLib from 'pdfjs-dist';

// Configure standard PDF.js worker using unpkg or cdnjs bundle to ensure zero bundler config breaks
if (typeof window !== 'undefined' && pdfjsLib) {
  // Use worker matching version or bundled script
  const workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
}

export { pdfjsLib };
