import * as pdfjsLib from 'pdfjs-dist';

// PDF.js version matching installed package (v6.4.299)
const PDFJS_VERSION = pdfjsLib.version || '6.4.299';

// Configure PDF.js worker using official fast CDN
if (typeof window !== 'undefined' && pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
}

// CMap (Character Map) configuration URL for Arabic, Thai, and complex scripts via CDN
export const PDF_CMAP_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`;
export const PDF_CMAP_PACKED = true;

// Standard font data URL for embedded PDF fonts via CDN
export const PDF_STANDARD_FONT_DATA_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`;

export { pdfjsLib };
