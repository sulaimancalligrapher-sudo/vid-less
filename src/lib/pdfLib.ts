import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker using self-hosted local worker first, with fallback
if (typeof window !== 'undefined' && pdfjsLib) {
  // Use our local /pdfjs/pdf.worker.mjs bundle to eliminate all external network failures
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.mjs';
}

// CMap (Character Map) configuration URL for Arabic, Thai, CJK, and complex scripts
// Without local/accessible cMap, Arabic letters become disconnected/separated glyphs
export const PDF_CMAP_URL = '/pdfjs/cmaps/';
export const PDF_CMAP_PACKED = true;

// Standard font data URL for embedded PDF fonts
export const PDF_STANDARD_FONT_DATA_URL = '/pdfjs/standard_fonts/';

export { pdfjsLib };
