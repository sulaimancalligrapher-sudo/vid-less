import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined' && pdfjsLib) {
  // Use official unpkg CDN matching installed version with reliable fallback
  const workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/build/pdf.worker.min.mjs`;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
}

// CMap (Character Map) configuration URL for Arabic, Thai, CJK, and complex scripts
// Without cMap, Arabic letters and Thai marks become disconnected/scrambled glyphs
export const PDF_CMAP_URL = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/cmaps/`;
export const PDF_CMAP_PACKED = true;

// Standard font data URL for embedded PDF fonts
export const PDF_STANDARD_FONT_DATA_URL = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/standard_fonts/`;

export { pdfjsLib };
