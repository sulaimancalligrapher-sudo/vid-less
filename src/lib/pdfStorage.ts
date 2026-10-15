/**
 * Helper to manage client-side storage of PDF files using IndexedDB.
 * Allows instant, lag-free storage of full PDFs (even 50MB+) without consuming network bandwidth or backend storage.
 */

const DB_NAME = 'MadrasaPdfStorageDB';
const STORE_NAME = 'pdf_files';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface StoredPdfRecord {
  id: string;
  name: string;
  size: number;
  type: string;
  data: ArrayBuffer;
  updatedAt: number;
}

/**
 * Helper to upload PDF ArrayBuffer to backend server storage
 */
export async function uploadPdfToServer(id: string, name: string, buffer: ArrayBuffer): Promise<boolean> {
  try {
    const safeId = id.replace(/^local:\/\//, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // Convert ArrayBuffer to Base64 in chunks to avoid stack overflow with large files
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    const chunkSize = 0x8000;
    for (let i = 0; i < len; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, Math.min(i + chunkSize, len))));
    }
    const base64 = btoa(binary);

    const res = await fetch('/api/pdf/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: safeId,
        name,
        base64,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to upload PDF to server:', err);
    return false;
  }
}

/**
 * Save a PDF File (or ArrayBuffer) into IndexedDB and sync with server
 */
export async function savePdfToIndexedDB(id: string, name: string, fileOrBuffer: File | ArrayBuffer): Promise<void> {
  const db = await openDB();
  let buffer: ArrayBuffer;
  let size: number;
  let type = 'application/pdf';

  if (fileOrBuffer instanceof File) {
    buffer = await fileOrBuffer.arrayBuffer();
    size = fileOrBuffer.size;
    type = fileOrBuffer.type || 'application/pdf';
  } else {
    buffer = fileOrBuffer;
    size = buffer.byteLength;
  }

  // 1. Save locally in IndexedDB for instant 0ms access
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record: StoredPdfRecord = {
      id,
      name,
      size,
      type,
      data: buffer,
      updatedAt: Date.now(),
    };
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // 2. Concurrently sync with backend server so all remote screens/projectors/students can access it
  uploadPdfToServer(id, name, buffer).catch((e) => console.warn('Background server sync skipped:', e));
}

/**
 * Get a PDF ArrayBuffer by its ID from IndexedDB with automatic server fallback
 */
export async function getPdfFromIndexedDB(id: string): Promise<StoredPdfRecord | null> {
  const cleanId = id.replace(/^local:\/\//, '');

  try {
    const db = await openDB();
    const localRecord = await new Promise<StoredPdfRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cleanId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (localRecord && localRecord.data) {
      return localRecord;
    }
  } catch (err) {
    console.warn('IndexedDB read failed, trying server fallback:', err);
  }

  // Fallback: If not found in IndexedDB (e.g. running on another device or projector), fetch from server
  try {
    const safeId = cleanId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const res = await fetch(`/api/pdf/${safeId}`);
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const record: StoredPdfRecord = {
        id: cleanId,
        name: cleanId,
        size: arrayBuffer.byteLength,
        type: 'application/pdf',
        data: arrayBuffer,
        updatedAt: Date.now(),
      };

      // Cache into local IndexedDB for future visits
      try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(record);
      } catch {}

      return record;
    }
  } catch (fetchErr) {
    console.warn('Server fallback fetch failed for PDF:', fetchErr);
  }

  return null;
}

/**
 * Delete a PDF from IndexedDB
 */
export async function deletePdfFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to delete PDF from IndexedDB:', err);
  }
}
