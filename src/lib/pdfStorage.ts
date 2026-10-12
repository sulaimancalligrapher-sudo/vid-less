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
 * Save a PDF File (or ArrayBuffer) into IndexedDB
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

  return new Promise((resolve, reject) => {
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
}

/**
 * Get a PDF ArrayBuffer by its ID from IndexedDB
 */
export async function getPdfFromIndexedDB(id: string): Promise<StoredPdfRecord | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to get PDF from IndexedDB:', err);
    return null;
  }
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
