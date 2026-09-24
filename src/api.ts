import { 
  WordData, AdminQuestionRow, AdminAnswerRow, Question, AdminQuestionItem, 
  HeaderNavButton, HeaderConfig, StudentCorrection,
  TelegramConfig, TelegramTemplateItem, TelegramUserBinding, TelegramBroadcastMessage
} from './types';

// Helper to get Main Spreadsheet ID from localStorage or fallback
export function getMainSpreadsheetId(): string {
  const localId = localStorage.getItem('mainSpreadsheetId');
  if (localId && localId.trim().length > 0) {
    return localId.trim();
  }
  return '155gPdRszuGrjRBHx6jZ8vYovsougqH35HGIw4BhkxBs';
}

// Helper to get Web App URL from localStorage or environment variables
export function getWebAppUrl(): string {
  // 1. Check localStorage first (allows individual overrides / testing)
  const localUrl = localStorage.getItem('webAppUrl');
  if (localUrl && localUrl.trim().length > 0) {
    return localUrl.trim();
  }

  // 2. Check Vite Environment Variable (perfect for production deployment like Vercel)
  const envUrl = (import.meta as any).env?.VITE_WEB_APP_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim();
  }

  // 3. Default fallback URL (User's active project)
  const fallbackUrl: string = 'https://script.google.com/macros/s/AKfycbxRHzgk-mpXY2kNbWb35vqAP1I-ubt3FhV3yAugOf8uqreO2wnQ5Hu5rw84yr0QJ7ZUCQ/exec';
  if (fallbackUrl && fallbackUrl.trim().length > 0) {
    return fallbackUrl.trim();
  }

  return '';
}

// Check if the API URL is configured
export function isApiConfigured(): boolean {
  return getWebAppUrl().trim().length > 0;
}

// Simple fetch wrapper that handles CORS for Google Apps Script
async function fetchGas(params: Record<string, string>, method: 'GET' | 'POST' = 'GET', postBody?: any) {
  const baseUrl = getWebAppUrl().trim();
  if (!baseUrl) {
    throw new Error('لم يتم تكوين رابط API الخاص بـ Google Sheet بعد.');
  }

  // Ensure spreadsheetId is passed in GET parameters if not explicitly provided
  const mainSpreadsheetId = getMainSpreadsheetId();
  if (!params.spreadsheetId && mainSpreadsheetId) {
    params.spreadsheetId = mainSpreadsheetId;
  }

  // Construct query string for GET parameters or action specification
  const urlParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    urlParams.append(key, value);
  });

  const url = `${baseUrl}?${urlParams.toString()}`;

  const options: RequestInit = {
    method: method,
    redirect: 'follow', // Crucial for GAS Web App redirects
  };

  if (method === 'POST' && postBody) {
    // If postBody is an object, attach spreadsheetId if not already present
    if (typeof postBody === 'object' && !postBody.spreadsheetId && mainSpreadsheetId) {
      postBody.spreadsheetId = mainSpreadsheetId;
    }
    // To avoid CORS preflight (OPTIONS) requests which GAS does not support,
    // we send the content as text/plain. The backend will parse it as JSON.
    options.body = JSON.stringify(postBody);
    options.headers = {
      'Content-Type': 'text/plain;charset=utf-8',
    };
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`خطأ في خادم Google Apps Script: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('GAS API Fetch Error:', error);
    throw new Error(error.message || 'فشل الاتصال بخادم Google Sheets. يرجى التحقق من الرابط والاتصال.');
  }
}

// 1. Authenticate / Login Student
export async function loginStudent(username: string, sheetNumber: string, deviceId: string, coords: { lat: number | null, lng: number | null }) {
  return fetchGas({ action: 'loginUser' }, 'POST', {
    username,
    sheet_number: sheetNumber,
    deviceId,
    lat: coords.lat,
    lng: coords.lng,
  });
}

// Helper to clean string & remove weird symbols / URL encoding
function cleanString(str: any): string {
  if (str === null || str === undefined) return '';
  let s = String(str).trim();
  if (s === 'undefined' || s === 'null') return '';
  if (s.includes('%')) {
    try {
      s = decodeURIComponent(s);
    } catch (e) {}
  }
  return s.trim();
}

export function sanitizeQuestionOptions(options: any): string[] {
  if (!options) return [];
  let rawList: string[] = [];
  if (Array.isArray(options)) {
    rawList = options.map(cleanString);
  } else {
    rawList = [cleanString(options)];
  }

  const result: string[] = [];
  for (const item of rawList) {
    if (!item || item === 'نص' || item === 'undefined' || item === 'NONE') continue;
    const parts = item
      .split(/[,;|\n\r،]/)
      .map(s => cleanString(s))
      .filter(s => s.length > 0 && s !== 'نص' && s !== 'undefined' && s !== 'NONE');
    result.push(...parts);
  }
  return result;
}

export function sanitizeQuestions<T extends { question?: string; text?: string; time?: number; image?: string; videoUrl?: string; options?: any; correctAnswer?: string; slotIndex?: number }>(qs?: T[]): T[] {
  if (!qs || !Array.isArray(qs)) return [];

  const cleaned: T[] = [];
  const seenSignatures = new Set<string>();

  for (const q of qs) {
    if (!q) continue;

    let qText = cleanString(q.question || q.text);
    const img = cleanString(q.image || q.videoUrl);
    const timeVal = typeof q.time === 'number' ? q.time : (parseFloat(String(q.time)) || 0);
    const opts = sanitizeQuestionOptions(q.options);

    // If qText is a placeholder like "NONE", "EMPTY", "-", "فارغ", treat as empty
    const lowerText = qText.toLowerCase();
    if (['none', 'empty', '-', 'فارغ', 'لا يوجد', 'null', 'undefined'].includes(lowerText)) {
      qText = '';
    }

    // Filter out completely empty question slots
    if (!qText && !img && opts.length === 0 && timeVal === 0) {
      continue;
    }

    // Deduplicate questions based on unique signature
    const signature = `${timeVal}_${qText.toLowerCase()}_${img.toLowerCase()}_${opts.join('|').toLowerCase()}`;
    if (seenSignatures.has(signature)) {
      continue;
    }
    seenSignatures.add(signature);

    const cleanedQ: any = {
      ...q,
      question: qText,
      image: img,
      time: timeVal,
      options: q.options,
      correctAnswer: cleanString(q.correctAnswer)
    };

    cleaned.push(cleanedQ as T);
  }

  return cleaned;
}

export function getQuestionSignature(q: any): string {
  if (!q) return '';
  const qText = cleanString(q.question || q.text).toLowerCase();
  const img = cleanString(q.image || q.videoUrl).toLowerCase();
  const timeVal = typeof q.time === 'number' ? q.time : (parseFloat(String(q.time)) || 0);
  const opts = sanitizeQuestionOptions(q.options).join('|').toLowerCase();
  const ans = cleanString(q.correctAnswer).toLowerCase();
  return `${timeVal}_${qText}_${img}_${opts}_${ans}`;
}

export function sanitizeLessonQuestions(questions?: any[], audioQuestions?: any[]): { cleanQuestions: any[]; cleanAudioQuestions: any[] } {
  const cleanAudio = sanitizeQuestions(audioQuestions || []);
  const audioSignatures = new Set(
    cleanAudio
      .map(getQuestionSignature)
      .filter(sig => sig.replace(/^[0_]*$/, '').length > 0)
  );

  const rawVideo = sanitizeQuestions(questions || []);
  const cleanVideo = rawVideo.filter(vq => {
    const sig = getQuestionSignature(vq);
    if (!sig || sig.replace(/^[0_]*$/, '').length === 0) return false;
    return !audioSignatures.has(sig);
  });

  return { cleanQuestions: cleanVideo, cleanAudioQuestions: cleanAudio };
}

export function prepareQuestionsForSaving(qs?: any[], targetCount: number = 15): AdminQuestionItem[] {
  const sanitized = sanitizeQuestions(qs || []);
  const padded: AdminQuestionItem[] = [];

  for (let i = 0; i < targetCount; i++) {
    if (i < sanitized.length) {
      const q = sanitized[i];
      padded.push({
        slotIndex: i + 1,
        time: typeof q.time === 'number' ? q.time : (parseFloat(String(q.time)) || 0),
        image: q.image || '',
        question: q.question || '',
        options: Array.isArray(q.options) ? q.options.join(', ') : (q.options || ''),
        correctAnswer: q.correctAnswer || ''
      });
    } else {
      // Send explicit clear placeholder 'NONE' so GAS & Google Sheets overwrite old duplicate values in these cells!
      padded.push({
        slotIndex: i + 1,
        time: 0,
        image: '',
        question: '',
        options: '',
        correctAnswer: ''
      });
    }
  }

  return padded;
}

// Helper to map AdminQuestionItem to Question
function mapAdminQuestionsToQuestions(qs?: AdminQuestionItem[]): Question[] {
  if (!qs || !Array.isArray(qs)) return [];
  const sanitized = sanitizeQuestions(qs);
  return sanitized.map(q => ({
    slotIndex: q.slotIndex,
    time: typeof q.time === 'number' ? q.time : (parseFloat(String(q.time)) || 0),
    image: q.image || '',
    question: q.question || '',
    options: Array.isArray(q.options) ? q.options : sanitizeQuestionOptions(q.options),
    correctAnswer: q.correctAnswer || ''
  }));
}

export interface GeneralAutoScheduleConfig {
  selectedDays: number[];
  autoStartDate: string;
  lessonsPerDay: number;
  autoHideMode: 'days' | 'unifiedDate' | 'none';
  autoExpireAfterDays: number | string;
  autoUnifiedEndDate: string;
}

export function getGeneralAutoScheduleConfig(): GeneralAutoScheduleConfig | null {
  try {
    const raw = localStorage.getItem('generalAutoScheduleConfig');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveGeneralAutoScheduleConfig(config: GeneralAutoScheduleConfig) {
  try {
    localStorage.setItem('generalAutoScheduleConfig', JSON.stringify(config));
  } catch (e) {}
}

export interface StudentCustomScheduleItem {
  word: string;
  comment?: string;
  startDate: string;
  endDate: string;
  expireAfterDays?: number | string;
}

export interface StudentCustomScheduleData {
  username: string;
  sheetNumber?: string;
  updatedAt: string;
  config: {
    selectedDays: number[];
    startDate: string;
    lessonsPerDay: number;
    autoHideMode: 'days' | 'unifiedDate' | 'none';
    autoExpireAfterDays: number | string;
    autoUnifiedEndDate: string;
  };
  schedule: StudentCustomScheduleItem[];
}

export function getStudentCustomSchedulesMap(): Record<string, StudentCustomScheduleData> {
  try {
    const raw = localStorage.getItem('studentCustomSchedules');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveStudentCustomSchedule(username: string, data: StudentCustomScheduleData) {
  const map = getStudentCustomSchedulesMap();
  const key = username.trim().toLowerCase();
  map[key] = data;
  if (data.sheetNumber && data.sheetNumber.trim()) {
    map[data.sheetNumber.trim().toLowerCase()] = data;
  }
  localStorage.setItem('studentCustomSchedules', JSON.stringify(map));
}

export function deleteStudentCustomSchedule(username: string, sheetNumber?: string) {
  const map = getStudentCustomSchedulesMap();
  const key = username.trim().toLowerCase();
  delete map[key];
  if (sheetNumber && sheetNumber.trim()) {
    delete map[sheetNumber.trim().toLowerCase()];
  }
  localStorage.setItem('studentCustomSchedules', JSON.stringify(map));
}

export function applyStudentCustomScheduleOverrides(lessons: WordData[], username?: string, sheetNumber?: string): WordData[] {
  if (!username && !sheetNumber) return lessons;
  const map = getStudentCustomSchedulesMap();
  let studentData: StudentCustomScheduleData | undefined;
  if (username && username.trim()) {
    studentData = map[username.trim().toLowerCase()];
  }
  if (!studentData && sheetNumber && sheetNumber.trim()) {
    studentData = map[sheetNumber.trim().toLowerCase()];
  }
  if (!studentData || !studentData.schedule || studentData.schedule.length === 0) {
    return lessons;
  }

  return lessons.map((lesson, idx) => {
    const match = studentData.schedule.find(
      s => (s.comment && lesson.comment && s.comment.trim() === lesson.comment.trim()) ||
           (s.word && lesson.word && s.word.trim() === lesson.word.trim())
    ) || studentData.schedule[idx];

    if (match) {
      return {
        ...lesson,
        startDate: match.startDate !== undefined ? match.startDate : lesson.startDate,
        endDate: match.endDate !== undefined ? match.endDate : lesson.endDate,
        expireAfterDays: match.expireAfterDays !== undefined ? match.expireAfterDays : lesson.expireAfterDays,
      };
    }
    return lesson;
  });
}

// 2. Fetch Lessons / Words
export async function fetchLessons(sheetName: string, username?: string): Promise<WordData[]> {
  let lessons: WordData[] = [];
  if (!isApiConfigured()) {
    const local = localStorage.getItem('mockAdminQuestions');
    if (local) {
      try {
        const adminQs: AdminQuestionRow[] = JSON.parse(local);
        lessons = adminQs.map(q => ({
          word: q.word,
          fullSound: '',
          letterSounds: [],
          image: q.image || '',
          comment: q.comment || '',
          explainSound: q.explainSound || '',
          youtubeUrl: q.youtubeUrl || '',
          showResult: (q.showResult as 'نعم' | 'لا') || 'نعم',
          totalQuestionsCount: q.totalQuestionsCount || 15,
          defaultRetryResetCount: q.defaultRetryResetCount || 1,
          retryResetCount: q.defaultRetryResetCount || 1,
          instruction: q.instruction || '',
          allowRecording: (q.allowRecording as 'نعم' | 'لا' | '') || '',
          maxRecordingTime: q.maxRecordingTime || 0,
          retryCount: q.retryCount || 0,
          completed: '' as const,
          showPrevButton: q.showPrevButton || '',
          allowUpload: (q.allowUpload as 'نعم' | 'لا' | '') || '',
          startDate: q.startDate || '',
          endDate: q.endDate || '',
          expireAfterDays: q.expireAfterDays !== undefined ? q.expireAfterDays : '',
          questions: mapAdminQuestionsToQuestions(q.questions),
          audioQuestions: mapAdminQuestionsToQuestions(q.audioQuestions)
        }));
      } catch (e) {}
    } else {
      lessons = [
        {
          word: 'الدرس الأول - الحروف',
          fullSound: 'https://example.com/audio1.mp3',
          letterSounds: [],
          image: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800',
          comment: 'L1',
          explainSound: '',
          youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          showResult: 'نعم',
          instruction: '',
          allowRecording: '',
          maxRecordingTime: 0,
          retryCount: 0,
          completed: '',
          showPrevButton: '',
          allowUpload: '',
          retryResetCount: 1,
          questions: [],
          audioQuestions: [],
          startDate: '',
          endDate: ''
        }
      ];
    }
  } else {
    const params: Record<string, string> = { action: 'getWords', sheetName };
    if (username) {
      params.username = username;
    }
    const response = await fetchGas(params);
    if (Array.isArray(response)) {
      lessons = (response as WordData[]).map(lesson => ({
        ...lesson,
        questions: mapAdminQuestionsToQuestions(lesson.questions as any),
        audioQuestions: mapAdminQuestionsToQuestions(lesson.audioQuestions as any)
      }));
    }
  }

  return applyStudentCustomScheduleOverrides(lessons, username, sheetName);
}

// 3. Save Question Answer (from YouTube Video or Explanation Audio)
export async function saveQuestionAnswer(payload: {
  sheet_number: string;
  username: string;
  word: string;
  youtubeUrl: string;
  question: string;
  selectedAnswer: string;
  isCorrect: boolean | null;
  timestamp: string;
  type: 'video' | 'audio';
  questionIndex: number;
  comment: string;
  explainSound: string;
}) {
  return fetchGas({ action: 'saveAnswer' }, 'POST', payload);
}

// 4. Retrieve Full Audio Listening Score
export async function getFullAudioListeningScore(comment: string, sheetNumber: string, username: string, word?: string): Promise<number> {
  const params: Record<string, string> = {
    action: 'getFullAudioScore',
    comment,
    sheet_number: sheetNumber,
    username,
  };
  if (word) params.word = word;
  const res = await fetchGas(params);
  return res && typeof res.score === 'number' ? res.score : 0;
}

// 5. Save Full Audio Listening Score (100% when completed)
export async function saveFullAudioListeningScore(payload: {
  sheet_number: string;
  username: string;
  word: string;
  score: number;
  timestamp: string;
  comment: string;
}) {
  return fetchGas({ action: 'saveFullAudioScore' }, 'POST', payload);
}

// 6. Retrieve Letter Sound Listening Score
export async function getLetterListeningScore(comment: string, sheetNumber: string, username: string, word?: string): Promise<number> {
  const params: Record<string, string> = {
    action: 'getLetterListenScore',
    comment,
    sheet_number: sheetNumber,
    username,
  };
  if (word) params.word = word;
  const res = await fetchGas(params);
  return res && typeof res.score === 'number' ? res.score : 0;
}

// 7. Save Letter Sound Listening Score
export async function saveLetterListeningScore(payload: {
  sheet_number: string;
  username: string;
  word: string;
  score: number;
  timestamp: string;
  comment: string;
}) {
  return fetchGas({ action: 'saveLetterListenScore' }, 'POST', payload);
}

// 8. Retrieve Saved Recording Link
export async function getSavedRecordingLink(comment: string, sheetNumber: string, username: string, word?: string): Promise<string> {
  const params: Record<string, string> = {
    action: 'getRecordingLink',
    comment,
    sheet_number: sheetNumber,
    username,
  };
  if (word) params.word = word;
  const res = await fetchGas(params);
  return res && res.link ? res.link : '';
}

// 9. Retrieve Saved Image Link
export async function getSavedImageLink(comment: string, sheetNumber: string, username: string, word?: string): Promise<string> {
  const params: Record<string, string> = {
    action: 'getImageLink',
    comment,
    sheet_number: sheetNumber,
    username,
  };
  if (word) params.word = word;
  const res = await fetchGas(params);
  return res && res.link ? res.link : '';
}

// 10. Upload Camera Photo / Image File (returns Drive file URL)
export async function uploadImage(payload: {
  base64Data: string;
  mimeType: string;
  word: string;
  username: string;
  sheet_number: string;
  comment?: string;
}) {
  return fetchGas({ action: 'uploadImageFromBase64' }, 'POST', payload);
}

// 11. Upload Recorded Audio / Audio File (returns Drive file URL)
export async function uploadRecording(payload: {
  base64Data: string;
  mimeType: string;
  word: string;
  username: string;
  sheet_number: string;
  comment?: string;
}) {
  return fetchGas({ action: 'uploadRecordingFromBase64' }, 'POST', payload);
}

// 12. Save Uploaded Image Link metadata to Answers sheet
export async function saveImageLinkMetadata(payload: {
  sheet_number: string;
  username: string;
  comment: string;
  link: string;
  timestamp: string;
}) {
  return fetchGas({ action: 'saveImageLink' }, 'POST', payload);
}

// 13. Save Uploaded Recording Link metadata to Answers sheet
export async function saveRecordingLinkMetadata(payload: {
  sheet_number: string;
  username: string;
  comment: string;
  link: string;
  timestamp: string;
}) {
  return fetchGas({ action: 'saveRecordingLink' }, 'POST', payload);
}

// 14. Mark Lesson Completed in Answers sheet
export async function markLessonCompleted(sheetName: string, lessonIndex: number, username: string, comment?: string) {
  return fetchGas({ action: 'markLessonCompleted' }, 'POST', { sheetName, lessonIndex, username, comment });
}

// 15. Re-open Lesson for Student in Answers sheet
export async function unmarkLessonCompleted(sheetName: string, lessonIndex: number, username?: string, comment?: string) {
  return fetchGas({ action: 'unmarkLessonCompleted' }, 'POST', { sheetName, lessonIndex, username, comment });
}

// 16. Reset State when Student navigates back early without completing
export async function resetToCompleted(sheetName: string, lessonIndex: number, username?: string, comment?: string) {
  return fetchGas({ action: 'resetToCompleted' }, 'POST', { sheetName, lessonIndex, username, comment });
}

// 17. Decrement Student's Lesson Retry Counts
export async function decrementRetryCount(sheetName: string, lessonIndex: number, username?: string, comment?: string) {
  return fetchGas({ action: 'decrementRetryCount' }, 'POST', { sheetName, lessonIndex, username, comment });
}

// 18. Admin: Fetch all questions/lessons from Questions sheet
export async function fetchAdminQuestions(): Promise<AdminQuestionRow[]> {
  if (!isApiConfigured()) {
    const local = localStorage.getItem('mockAdminQuestions');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        return (parsed as AdminQuestionRow[]).map(q => {
          const { cleanQuestions, cleanAudioQuestions } = sanitizeLessonQuestions(q.questions, q.audioQuestions);
          return {
            ...q,
            questions: cleanQuestions,
            audioQuestions: cleanAudioQuestions
          };
        });
      } catch (e) {}
    }
    const initial: AdminQuestionRow[] = [
      {
        rowIndex: 2,
        word: 'الدرس الأول - الحروف',
        comment: 'L1',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        showResult: 'نعم',
        totalQuestionsCount: 15,
        defaultRetryResetCount: 1,
        startDate: '',
        endDate: '',
        expireAfterDays: '',
        questions: [],
        audioQuestions: []
      }
    ];
    localStorage.setItem('mockAdminQuestions', JSON.stringify(initial));
    return initial;
  }
  const response = await fetchGas({ action: 'getAdminQuestions' });
  if (Array.isArray(response)) {
    return (response as AdminQuestionRow[]).map(q => {
      const { cleanQuestions, cleanAudioQuestions } = sanitizeLessonQuestions(q.questions, q.audioQuestions);
      return {
        ...q,
        questions: cleanQuestions,
        audioQuestions: cleanAudioQuestions
      };
    });
  }
  return [];
}

// 19. Admin: Save or Add question/lesson in Questions sheet
export async function saveAdminQuestion(payload: AdminQuestionRow) {
  const { cleanQuestions, cleanAudioQuestions } = sanitizeLessonQuestions(payload.questions, payload.audioQuestions);
  const sanitizedPayload: AdminQuestionRow = {
    ...payload,
    questions: cleanQuestions,
    audioQuestions: cleanAudioQuestions
  };

  if (!isApiConfigured()) {
    const questions = await fetchAdminQuestions();
    let updated = [...questions];
    if (sanitizedPayload.rowIndex && sanitizedPayload.rowIndex > 1) {
      const idx = updated.findIndex(q => q.rowIndex === sanitizedPayload.rowIndex);
      if (idx !== -1) {
        updated[idx] = { ...sanitizedPayload };
      } else {
        updated.push({ ...sanitizedPayload });
      }
    } else if (sanitizedPayload.comment) {
      const idx = updated.findIndex(q => q.comment && q.comment.trim() === sanitizedPayload.comment.trim());
      if (idx !== -1) {
        updated[idx] = { ...sanitizedPayload, rowIndex: updated[idx].rowIndex };
      } else {
        const maxRow = updated.reduce((max, q) => Math.max(max, q.rowIndex || 1), 1);
        const newRowIndex = maxRow + 1;
        updated.push({ ...sanitizedPayload, rowIndex: newRowIndex });
      }
    } else {
      const maxRow = updated.reduce((max, q) => Math.max(max, q.rowIndex || 1), 1);
      const newRowIndex = maxRow + 1;
      updated.push({ ...sanitizedPayload, rowIndex: newRowIndex });
    }
    localStorage.setItem('mockAdminQuestions', JSON.stringify(updated));
    return { success: true };
  }

  // When sending to Google Apps Script (GAS), pad questions to 15 slots and audio to 2 slots
  // to force GAS to clear any old duplicated columns in Google Sheets!
  const gasPayload: AdminQuestionRow = {
    ...payload,
    questions: prepareQuestionsForSaving(cleanQuestions, 15),
    audioQuestions: prepareQuestionsForSaving(cleanAudioQuestions, 2)
  };

  return fetchGas({ action: 'saveAdminQuestion' }, 'POST', gasPayload);
}

// 19b. Admin: Save batch of questions/lessons
export async function saveBatchAdminQuestions(payloadList: AdminQuestionRow[]) {
  const sanitizedList = payloadList.map(item => {
    const { cleanQuestions, cleanAudioQuestions } = sanitizeLessonQuestions(item.questions, item.audioQuestions);
    return {
      ...item,
      questions: cleanQuestions,
      audioQuestions: cleanAudioQuestions
    };
  });

  if (!isApiConfigured()) {
    localStorage.setItem('mockAdminQuestions', JSON.stringify(sanitizedList));
    return { success: true };
  }

  // Send each question update with padded 15 slots so GAS overwrites trailing columns in Sheets
  for (const item of payloadList) {
    const { cleanQuestions, cleanAudioQuestions } = sanitizeLessonQuestions(item.questions, item.audioQuestions);
    const gasItem: AdminQuestionRow = {
      ...item,
      questions: prepareQuestionsForSaving(cleanQuestions, 15),
      audioQuestions: prepareQuestionsForSaving(cleanAudioQuestions, 2)
    };
    await fetchGas({ action: 'saveAdminQuestion' }, 'POST', gasItem);
  }
  return { success: true };
}

// 20. Admin: Delete question/lesson row from Questions sheet
export async function deleteAdminQuestion(payload: { rowIndex?: number; comment?: string }) {
  if (!isApiConfigured()) {
    const questions = await fetchAdminQuestions();
    const updated = questions.filter(q => {
      if (payload.rowIndex && q.rowIndex === payload.rowIndex) return false;
      if (payload.comment && q.comment === payload.comment) return false;
      return true;
    });
    localStorage.setItem('mockAdminQuestions', JSON.stringify(updated));
    return { success: true };
  }
  return fetchGas({ action: 'deleteAdminQuestion' }, 'POST', payload);
}

// 21. Admin: Fetch all student answers from Answers sheet
export async function fetchAdminAnswers(): Promise<AdminAnswerRow[]> {
  if (!isApiConfigured()) {
    const local = localStorage.getItem('mockAdminAnswers');
    if (local) {
      try { return JSON.parse(local); } catch (e) {}
    }
    const initial: AdminAnswerRow[] = [
      {
        rowIndex: 2,
        sheetNumber: '1',
        username: 'أحمد علي',
        comment: 'L1',
        videoAnswersResult: '15/15',
        audioAnswersResult: '2/2',
        finalFormula: '15/15 + 2/2',
        finalResult: '100%',
        audioUploadCount: 1,
        imageUploadCount: 1,
        completed: 'تم',
        retryResetCount: 1
      }
    ];
    localStorage.setItem('mockAdminAnswers', JSON.stringify(initial));
    return initial;
  }
  const response = await fetchGas({ action: 'getAdminAnswers' });
  if (Array.isArray(response)) {
    return response as AdminAnswerRow[];
  }
  return [];
}

// 22. Admin: Update student data in Answers sheet
export async function updateAdminAnswer(payload: {
  rowIndex: number;
  sheetNumber?: string;
  username?: string;
  comment?: string;
  videoAnswersResult?: string;
  audioAnswersResult?: string;
  finalResult?: string;
  audioUploadCount?: number | string;
  imageUploadCount?: number | string;
  completed?: string;
  retryResetCount?: number | null;
}) {
  if (!isApiConfigured()) {
    const answers = await fetchAdminAnswers();
    const updated = answers.map(a => {
      if (a.rowIndex === payload.rowIndex) {
        return { ...a, ...payload };
      }
      return a;
    });
    localStorage.setItem('mockAdminAnswers', JSON.stringify(updated));
    return { success: true };
  }
  return fetchGas({ action: 'updateAdminAnswer' }, 'POST', payload);
}

// Helper to format image URLs (including converting Google Drive share links to embeddable links)
export function formatDriveImageUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Handle Google Drive file link: https://drive.google.com/file/d/FILE_ID/view...
  const matchFileD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFileD && matchFileD[1]) {
    return `https://lh3.googleusercontent.com/d/${matchFileD[1]}`;
  }

  // Handle Google Drive open/id link: https://drive.google.com/open?id=FILE_ID or ?id=FILE_ID
  const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) {
    return `https://lh3.googleusercontent.com/d/${matchId[1]}`;
  }

  return trimmed;
}

// 23. Fetch Dynamic Header Configuration from 'header' sheet tab
export function parseHeaderResponse(res: any): HeaderConfig {
  if (!res) return {};

  // Case A: Response is an Object (e.g. { title, subtitle, logoUrl, loginLogoUrl, buttons, socials })
  if (typeof res === 'object' && !Array.isArray(res)) {
    const title = res.title || res.B2 || res.b2 || res.subject || '';
    const subtitle = res.subtitle || res.B3 || res.b3 || res.description || '';
    const logoUrl = formatDriveImageUrl(res.logoUrl || res.logo || res.C2 || res.c2 || '');
    const loginLogoUrl = formatDriveImageUrl(res.loginLogoUrl || res.D2 || res.d2 || '');

    let buttons: HeaderNavButton[] = [];
    if (Array.isArray(res.buttons)) {
      buttons = res.buttons
        .filter((b: any) => b && (b.url || b.link) && String(b.url || b.link).trim().length > 0)
        .map((b: any) => ({
          label: String(b.label || b.text || b.title || b.name || '').trim() || 'رابط',
          url: String(b.url || b.link).trim()
        }));
    } else {
      const pairKeys = [
        ['B4', 'C4'],
        ['B5', 'C5'],
        ['B6', 'C6'],
        ['B7', 'C7'],
        ['B8', 'C8'],
      ];
      for (const [bKey, cKey] of pairKeys) {
        const url = String(res[cKey] || res[cKey.toLowerCase()] || '').trim();
        if (url && url.length > 0 && url.toLowerCase() !== 'undefined' && url.toLowerCase() !== 'null') {
          const label = String(res[bKey] || res[bKey.toLowerCase()] || '').trim() || 'رابط';
          buttons.push({ label, url });
        }
      }
    }

    const socials = {
      facebook: String(res.socials?.facebook || res.E2 || res.e2 || '').trim(),
      instagram: String(res.socials?.instagram || res.F2 || res.f2 || '').trim(),
      youtube: String(res.socials?.youtube || res.G2 || res.g2 || '').trim(),
      line: String(res.socials?.line || res.H2 || res.h2 || '').trim()
    };

    return {
      title: title ? String(title).trim() : undefined,
      subtitle: subtitle ? String(subtitle).trim() : undefined,
      logoUrl: logoUrl ? String(logoUrl).trim() : undefined,
      loginLogoUrl: loginLogoUrl ? String(loginLogoUrl).trim() : undefined,
      buttons,
      socials
    };
  }

  // Case B: Response is 2D Array of rows from Google Sheets
  if (Array.isArray(res)) {
    const getCellValue = (rIdx: number, cIdx: number): string => {
      if (rIdx < 0 || rIdx >= res.length) return '';
      const row = res[rIdx];
      if (Array.isArray(row) && row.length > cIdx) {
        const val = row[cIdx];
        if (val !== null && val !== undefined) {
          const s = String(val).trim();
          if (s !== 'undefined' && s !== 'null') return s;
        }
      }
      return '';
    };

    // Row 2 in Sheet is index 1 (0-indexed). Cell B2 = col 1, C2 = col 2, D2 = col 3.
    // If array starts directly at Row 2, then index 0.
    let title = getCellValue(1, 1) || getCellValue(0, 1);
    let logoUrl = formatDriveImageUrl(getCellValue(1, 2) || getCellValue(0, 2));
    let loginLogoUrl = formatDriveImageUrl(getCellValue(1, 3) || getCellValue(0, 3));
    let subtitle = getCellValue(2, 1) || getCellValue(1, 1);

    // Socials row 2 (index 1): E2 (col 4), F2 (col 5), G2 (col 6), H2 (col 7)
    let facebook = getCellValue(1, 4) || getCellValue(0, 4);
    let instagram = getCellValue(1, 5) || getCellValue(0, 5);
    let youtube = getCellValue(1, 6) || getCellValue(0, 6);
    let line = getCellValue(1, 7) || getCellValue(0, 7);

    // Header label check
    if (getCellValue(0, 1) === 'الموضوع' || title === 'الموضوع') {
      title = getCellValue(1, 1);
      logoUrl = formatDriveImageUrl(getCellValue(1, 2));
      loginLogoUrl = formatDriveImageUrl(getCellValue(1, 3));
      subtitle = getCellValue(2, 1);
      facebook = getCellValue(1, 4);
      instagram = getCellValue(1, 5);
      youtube = getCellValue(1, 6);
      line = getCellValue(1, 7);
    }

    const buttons: HeaderNavButton[] = [];
    // Buttons B4..B8 (col 1) and C4..C8 (col 2)
    // Sheet Rows 4, 5, 6, 7, 8 -> 0-based indices 3, 4, 5, 6, 7
    for (let sheetRow = 4; sheetRow <= 8; sheetRow++) {
      let rIdx = sheetRow - 1;
      let btnLabel = getCellValue(rIdx, 1);
      let btnUrl = getCellValue(rIdx, 2);

      // If array offset shift
      if (!btnUrl && res.length > sheetRow) {
        btnLabel = getCellValue(sheetRow, 1);
        btnUrl = getCellValue(sheetRow, 2);
      }

      if (btnUrl && btnUrl.length > 0 && btnUrl.toLowerCase() !== 'undefined' && btnUrl.toLowerCase() !== 'null') {
        buttons.push({
          label: btnLabel || 'رابط',
          url: btnUrl
        });
      }
    }

    return {
      title: title || undefined,
      subtitle: subtitle || undefined,
      logoUrl: logoUrl || undefined,
      loginLogoUrl: loginLogoUrl || undefined,
      buttons,
      socials: {
        facebook: facebook || undefined,
        instagram: instagram || undefined,
        youtube: youtube || undefined,
        line: line || undefined
      }
    };
  }

  return {};
}

export async function fetchHeaderConfig(): Promise<HeaderConfig> {
  const cached = localStorage.getItem('headerConfigCache');
  let fallbackConfig: HeaderConfig = {};
  if (cached) {
    try {
      fallbackConfig = JSON.parse(cached);
    } catch (e) {}
  }

  if (!isApiConfigured()) {
    return fallbackConfig;
  }

  try {
    let res = await fetchGas({ action: 'getHeaderConfig' });
    let parsed = parseHeaderResponse(res);

    if (!parsed.title && !parsed.logoUrl && (!parsed.buttons || parsed.buttons.length === 0)) {
      // Retry with action 'getHeader'
      res = await fetchGas({ action: 'getHeader' });
      parsed = parseHeaderResponse(res);
    }

    if (parsed.title || parsed.logoUrl || (parsed.buttons && parsed.buttons.length > 0)) {
      localStorage.setItem('headerConfigCache', JSON.stringify(parsed));
      return parsed;
    }
  } catch (e) {
    console.warn('Could not fetch dynamic header config from GAS, using cached config if available:', e);
  }

  return fallbackConfig;
}

export function parseMultiUrls(rawStr?: any): string[] {
  if (!rawStr) return [];
  if (Array.isArray(rawStr)) {
    return rawStr.flatMap(s => parseMultiUrls(s)).filter(Boolean);
  }
  const str = String(rawStr).trim();
  if (!str) return [];

  // Split by |||, ||, |, newlines, commas, or semicolons
  const lines = str.split(/(?:\|\|\||\|\||\||\r?\n|,|;)+/);
  const result: string[] = [];
  for (const item of lines) {
    const cleaned = item.trim();
    if (cleaned) {
      result.push(formatDriveImageUrl(cleaned));
    }
  }
  return result;
}

export async function fetchStudentCorrections(username: string, sheetNumber: string): Promise<StudentCorrection[]> {
  const correctionSheetId = localStorage.getItem('correctionSheetId') || '1F3hDUfjgBEkUAIOaF66634EWQQ8XZSdyKjlTzrVA25k';
  
  try {
    const res = await fetchGas({
      action: 'getCorrections',
      username: username.trim(),
      sheetNumber: sheetNumber.trim(),
      corrSheetId: correctionSheetId,
      correctionSheetId: correctionSheetId
    });

    if (res && res.success && Array.isArray(res.corrections)) {
      return res.corrections.map((item: any) => ({
        sheetNumber: String(item.sheetNumber || sheetNumber).trim(),
        studentName: String(item.studentName || username).trim(),
        lessonTitle: String(item.lessonTitle || '').trim(),
        imageSendCount: String(item.imageSendCount || '').trim(),
        imageAssignment: String(item.imageAssignment || '').trim(),
        audioSendCount: String(item.audioSendCount || '').trim(),
        audioAssignment: String(item.audioAssignment || '').trim(),
        imageCorrection: {
          status: String(item.imageCorrection?.status || '').trim(),
          score: String(item.imageCorrection?.score || '').trim(),
          mainImage: formatDriveImageUrl(item.imageCorrection?.mainImage),
          additionalImages: parseMultiUrls(item.imageCorrection?.additionalImages),
          videos: parseMultiUrls(item.imageCorrection?.videos),
          audioExplanations: parseMultiUrls(item.imageCorrection?.audioExplanations),
          date: String(item.imageCorrection?.date || '').trim(),
          sendCount: String(item.imageCorrection?.sendCount || '').trim(),
          notes: String(item.imageCorrection?.notes || '').trim()
        },
        audioCorrection: {
          status: String(item.audioCorrection?.status || '').trim(),
          score: String(item.audioCorrection?.score || '').trim(),
          mainImage: formatDriveImageUrl(item.audioCorrection?.mainImage),
          audioExplanations: parseMultiUrls(item.audioCorrection?.audioExplanations),
          additionalImages: parseMultiUrls(item.audioCorrection?.additionalImages),
          videos: parseMultiUrls(item.audioCorrection?.videos),
          date: String(item.audioCorrection?.date || '').trim(),
          sendCount: String(item.audioCorrection?.sendCount || '').trim(),
          notes: String(item.audioCorrection?.notes || '').trim()
        }
      }));
    }
  } catch (err) {
    console.warn('Error fetching corrections from Apps Script:', err);
  }

  return [];
}

// ==========================================
// TELEGRAM INTEGRATION & NOTIFICATION SYSTEM
// ==========================================

export function normalizeLanguage(lang: any): 'ar' | 'th' | 'en' {
  if (!lang) return 'ar';
  const str = String(lang).trim().toLowerCase();

  // Thai check
  if (
    str === 'th' ||
    str === 'thai' ||
    str === 'thailand' ||
    str.includes('ไทย') ||
    str.includes('ภาษาไทย') ||
    str.includes('تايلاند') ||
    str.includes('تايلند') ||
    str.includes('🇹🇭')
  ) {
    return 'th';
  }

  // English check
  if (
    str === 'en' ||
    str === 'eng' ||
    str === 'english' ||
    str.includes('انجليز') ||
    str.includes('إنجليز') ||
    str.includes('انكليز') ||
    str.includes('إنكليز') ||
    str.includes('🇬🇧') ||
    str.includes('🇺🇸')
  ) {
    return 'en';
  }

  // Arabic default
  return 'ar';
}

export function formatLanguageBadge(lang: any): string {
  const norm = normalizeLanguage(lang);
  if (norm === 'th') return '🇹🇭 تايلاندي (TH)';
  if (norm === 'en') return '🇬🇧 إنجليزي (EN)';
  return '🇸🇦 عربي (AR)';
}

export const DEFAULT_TELEGRAM_TEMPLATES: TelegramTemplateItem[] = [
  {
    key: 'homework_received',
    title: 'تأكيد استلام الواجب (للطالب)',
    description: 'يُرسل للطالب فور اكتمال حل الواجب وظهور كلمة "تم" في العمود AO',
    ar: '✅ تم استلام واجبك بنجاح يا {student}!\n📚 الدرس: {lesson}\nتم إرسال إجاباتك وملفاتك إلى الأستاذ، وسيصلك إشعار التصحيح فور اعتماده 🌸',
    th: '✅ ได้รับการบ้านเรียบร้อยแล้ว คุณ {student}!\n📚 บทเรียน: {lesson}\nส่งคำตอบและไฟล์ไปยังอาจารย์แล้ว และจะแจ้งผลการตรวจทันทีที่เสร็จสิ้น 🌸',
    en: '✅ Your homework for: 📚 {lesson} has been received, {student}!\nYour answers and files have been sent to the teacher. You will be notified once reviewed 🌸',
    variables: ['{student}', '{lesson}', '{sheet}'],
    buttonTextAr: '🔗 فتح ملف الواجب',
    buttonTextTh: '🔗 เปิดไฟล์การบ้าน',
    buttonTextEn: '🔗 View Homework File',
    buttonUrl: ''
  },
  {
    key: 'new_homework_teacher',
    title: 'إشعار تسليم واجب جديد (للأستاذ والقروب)',
    description: 'يُرسل في خاص الأستاذ أو قروب الأساتذة عند تسليم طالب لواجبه كاملاً لأول مرة',
    ar: '📝 تسليم واجب جديد\n👤 الطالب: {student}\n🔢 رقم الطالب/الشيت: #{sheet}\n📚 الموضوع: {lesson}\n📊 النتيجة الكلية: {score}',
    th: '📝 ส่งการบ้านใหม่\n👤 นักเรียน: {student}\n🔢 ชีท: #{sheet}\n📚 บทเรียน: {lesson}\n📊 คะแนนรวม: {score}',
    en: '📝 New Homework Submission\n👤 Student: {student}\n🔢 Sheet: #{sheet}\n📚 Lesson: {lesson}\n📊 Total Score: {score}',
    variables: ['{student}', '{sheet}', '{lesson}', '{score}'],
    buttonTextAr: '',
    buttonTextTh: '',
    buttonTextEn: '',
    buttonUrl: ''
  },
  {
    key: 'resubmit_homework_teacher',
    title: 'إشعار إعادة تسليم / تعديل واجب (للأستاذ والقروب)',
    description: 'يُرسل للأستاذ عند قيام الطالب بإعادة رفع تسجيل أو صورة بعد التصحيح',
    ar: '🔄 تنبيه: إعادة تسليم واجب\n👤 الطالب: {student}\n🔢 رقم الطالب/الشيت: #{sheet}\n📚 الموضوع: {lesson}\n⚠️ نوع التحديث: {type}\n📊 النتيجة الكلية: {score}',
    th: '🔄 มีการส่งการบ้านซ้ำ/แก้ไข\n👤 นักเรียน: {student}\n🔢 ชีท: #{sheet}\n📚 บทเรียน: {lesson}\n⚠️ ประเภทการอัปเดต: {type}\n📊 คะแนนรวม: {score}',
    en: '🔄 Homework Resubmission / Update\n👤 Student: {student}\n🔢 Sheet: #{sheet}\n📚 Lesson: {lesson}\n⚠️ Update Type: {type}\n📊 Total Score: {score}',
    variables: ['{student}', '{sheet}', '{lesson}', '{type}', '{score}'],
    buttonTextAr: '',
    buttonTextTh: '',
    buttonTextEn: '',
    buttonUrl: ''
  }
];

const TELEGRAM_CONFIG_STORAGE_KEY = 'telegram_system_config';
const TELEGRAM_TEMPLATES_STORAGE_KEY = 'telegram_templates_config';
const TELEGRAM_STUDENTS_STORAGE_KEY = 'telegram_linked_students';

export function getTelegramConfig(): TelegramConfig {
  const saved = localStorage.getItem(TELEGRAM_CONFIG_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {}
  }
  return {
    botToken: '',
    botUsername: '',
    teacherChatId: '',
    groupChatId: '',
    enableTeacherPrivate: true,
    enableStudentPrivate: true,
    enableGroupNotify: false,
    sendMediaFiles: true
  };
}

export function saveTelegramConfig(config: TelegramConfig): void {
  localStorage.setItem(TELEGRAM_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

// Save Telegram Config directly to Google Sheet (Telegram_Config) and localStorage
export async function saveTelegramConfigToSheet(config: TelegramConfig): Promise<{ success: boolean; message?: string }> {
  localStorage.setItem(TELEGRAM_CONFIG_STORAGE_KEY, JSON.stringify(config));
  try {
    const payload = {
      action: 'saveTelegramConfig',
      botToken: config.botToken || '',
      botUsername: config.botUsername || '',
      teacherChatId: config.teacherChatId || '',
      groupChatId: config.groupChatId || '',
      notifyTeacherOnSubmit: config.enableTeacherPrivate !== false,
      notifyGroupOnSubmit: config.enableGroupNotify === true,
      notifyStudentOnScore: config.enableStudentPrivate !== false,
      notifyStudentOnRedo: config.enableStudentPrivate !== false,
    };
    const res = await fetchGas({ action: 'saveTelegramConfig' }, 'POST', payload);
    return res && typeof res === 'object' ? res : { success: true };
  } catch (err: any) {
    return { success: false, message: err.message || 'تعذر الاتصال بـ Google Apps Script' };
  }
}

// Fetch Telegram Config directly from Google Sheet (Telegram_Config)
export async function fetchTelegramConfigFromSheet(): Promise<{ success: boolean; config?: TelegramConfig; error?: string }> {
  try {
    const res = await fetchGas({ action: 'getTelegramConfig' }, 'GET');
    if (res && typeof res === 'object') {
      const cfg: TelegramConfig = {
        botToken: res.botToken || '',
        botUsername: res.botUsername || '',
        teacherChatId: res.teacherChatId || '',
        groupChatId: res.groupChatId || '',
        enableTeacherPrivate: res.notifyTeacherOnSubmit !== false,
        enableStudentPrivate: res.notifyStudentOnScore !== false,
        enableGroupNotify: res.notifyGroupOnSubmit === true,
        sendMediaFiles: true
      };
      if (cfg.botToken || cfg.teacherChatId || cfg.groupChatId) {
        localStorage.setItem(TELEGRAM_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
      }
      return { success: true, config: cfg };
    }
    return { success: false };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function getTelegramTemplates(): TelegramTemplateItem[] {
  const saved = localStorage.getItem(TELEGRAM_TEMPLATES_STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  return DEFAULT_TELEGRAM_TEMPLATES;
}

export function saveTelegramTemplates(templates: TelegramTemplateItem[]): void {
  localStorage.setItem(TELEGRAM_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

// Save templates directly to Google Sheets (Telegram_Templates)
export async function saveTelegramTemplatesToSheet(templates: TelegramTemplateItem[]): Promise<{ success: boolean; message?: string }> {
  saveTelegramTemplates(templates);
  try {
    const res = await fetchGas({ action: 'saveTelegramTemplates' }, 'POST', {
      action: 'saveTelegramTemplates',
      templates: templates
    });
    return res && typeof res === 'object' ? res : { success: true };
  } catch (err: any) {
    return { success: false, message: err.message || 'تعذر حفظ القوالب في Google Sheets' };
  }
}

// Fetch templates directly from Google Sheet (Telegram_Templates)
export async function fetchTelegramTemplatesFromSheet(): Promise<{ success: boolean; templates?: TelegramTemplateItem[]; error?: string }> {
  try {
    const res = await fetchGas({ action: 'getTelegramTemplates' }, 'GET');
    if (Array.isArray(res) && res.length > 0) {
      const formatted: TelegramTemplateItem[] = res.map((item: any) => ({
        key: item.key,
        title: item.title || item.key,
        description: item.description || '',
        ar: item.text_ar || item.ar || '',
        th: item.text_th || item.th || '',
        en: item.text_en || item.en || '',
        variables: DEFAULT_TELEGRAM_TEMPLATES.find(d => d.key === item.key)?.variables || ['{student}', '{lesson}'],
        buttonTextAr: item.button_text_ar || item.buttonTextAr || '',
        buttonTextTh: item.button_text_th || item.buttonTextTh || '',
        buttonTextEn: item.button_text_en || item.buttonTextEn || '',
        buttonUrl: item.button_url || item.buttonUrl || ''
      }));
      saveTelegramTemplates(formatted);
      return { success: true, templates: formatted };
    }
    return { success: true, templates: DEFAULT_TELEGRAM_TEMPLATES };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function getLinkedTelegramStudents(): Record<string, TelegramUserBinding> {
  const saved = localStorage.getItem(TELEGRAM_STUDENTS_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {}
  }
  return {};
}

export function saveLinkedTelegramStudent(binding: TelegramUserBinding): void {
  const all = getLinkedTelegramStudents();
  const key = `${binding.studentName.trim().toLowerCase()}__${binding.sheetNumber.trim()}`;
  all[key] = { ...binding, updatedAt: new Date().toISOString() };
  localStorage.setItem(TELEGRAM_STUDENTS_STORAGE_KEY, JSON.stringify(all));
}

export function removeLinkedTelegramStudent(studentName: string, sheetNumber: string): void {
  const all = getLinkedTelegramStudents();
  const key = `${studentName.trim().toLowerCase()}__${sheetNumber.trim()}`;
  delete all[key];
  localStorage.setItem(TELEGRAM_STUDENTS_STORAGE_KEY, JSON.stringify(all));
}

// Fetch all students registered in Settings sheet (Columns B & C)
export async function fetchSettingsStudentsFromSheet(): Promise<{ success: boolean; students?: Array<{ name: string; sheet: string }>; error?: string }> {
  try {
    let data: any = null;
    if (isApiConfigured()) {
      try {
        data = await fetchGas({ action: 'getAllSettingsStudents' }, 'GET');
      } catch (e) {
        try {
          data = await fetchGas({ action: 'getAllSettingsStudents' }, 'POST', { action: 'getAllSettingsStudents' });
        } catch (e2) {}
      }
    }
    if (Array.isArray(data) && data.length > 0) {
      const valid = data
        .filter((s: any) => s && (s.name || s.sheet))
        .map((s: any) => ({
          name: String(s.name || '').trim(),
          sheet: String(s.sheet || '').trim()
        }));
      if (valid.length > 0) {
        localStorage.setItem('cached_settings_students', JSON.stringify(valid));
        return { success: true, students: valid };
      }
    }

    // Try reading cached students
    const cached = localStorage.getItem('cached_settings_students');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { success: true, students: parsed };
        }
      } catch (e) {}
    }

    // Fallback from answers or default list
    const mockAnswers = localStorage.getItem('mockAdminAnswers');
    if (mockAnswers) {
      try {
        const parsed = JSON.parse(mockAnswers);
        if (Array.isArray(parsed)) {
          const map = new Map<string, { name: string; sheet: string }>();
          parsed.forEach((a: any) => {
            if (a.username) {
              const name = String(a.username).trim();
              const sheet = String(a.sheetNumber || '1').trim();
              map.set(name.toLowerCase(), { name, sheet });
            }
          });
          if (map.size > 0) {
            return { success: true, students: Array.from(map.values()) };
          }
        }
      } catch (e) {}
    }

    const defaultStudents = [
      { name: 'حنين', sheet: '222' },
      { name: 'أحمد علي', sheet: '101' },
      { name: 'سارة محمد', sheet: '102' },
      { name: 'عبدالله خالد', sheet: '103' }
    ];
    return { success: true, students: defaultStudents };
  } catch (err: any) {
    const cached = localStorage.getItem('cached_settings_students');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { success: true, students: parsed };
        }
      } catch (e) {}
    }
    return { success: false, error: err.message || 'تعذر جلب الطلاب من ورقة Settings.' };
  }
}

// Fetch linked Telegram users directly from Google Sheet
export async function fetchLinkedTelegramUsersFromSheet(): Promise<{ success: boolean; users?: Record<string, TelegramUserBinding>; error?: string }> {
  try {
    const data = await fetchGas({ action: 'getTelegramUsers' }, 'GET');
    if (data && typeof data === 'object') {
      // Also cache to localStorage
      localStorage.setItem(TELEGRAM_STUDENTS_STORAGE_KEY, JSON.stringify(data));
      return { success: true, users: data };
    }
    return { success: true, users: {} };
  } catch (err: any) {
    return { success: false, error: err.message || 'تعذر جلب الطلاب من جدول البيانات.' };
  }
}

// Generate direct Telegram deep-link for a student
export function generateStudentTelegramLink(botUsername: string, studentName: string, sheetNumber: string, lang: string = 'ar'): string {
  const cleanBot = botUsername.replace(/^@/, '').trim();
  if (!cleanBot) return '';
  // Telegram deep linking strictly requires pure ASCII alphanumeric characters [a-zA-Z0-9_-], max 64 bytes
  const cleanSheet = sheetNumber.trim().replace(/[^a-zA-Z0-9]/g, '');
  const payload = `S${cleanSheet || '1'}_${lang}`;
  return `https://t.me/${cleanBot}?start=${payload}`;
}

// Test Bot Token by pinging Telegram getMe API
export async function testTelegramBotToken(botToken: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const token = botToken.trim();
  if (!token) return { success: false, error: 'يرجى إدخال Bot Token صالح.' };
  
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (data.ok && data.result) {
      return {
        success: true,
        data: {
          id: data.result.id,
          name: data.result.first_name,
          username: data.result.username,
          canJoinGroups: data.result.can_join_groups,
          canReadAllGroupMessages: data.result.can_read_all_group_messages
        }
      };
    } else {
      return { success: false, error: data.description || 'فشل التحقق من صحة التوكن عبر Telegram API' };
    }
  } catch (err: any) {
    return { success: false, error: 'تعذر الاتصال بـ Telegram API: ' + (err.message || '') };
  }
}

// Fetch recent chats / updates to discover Chat ID
export async function getTelegramRecentUpdates(botToken: string): Promise<{ success: boolean; chats?: Array<{ id: number | string; title: string; type: string; date: string }>; error?: string }> {
  const token = botToken.trim();
  if (!token) return { success: false, error: 'يرجى إدخال Bot Token أولاً.' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=-10`);
    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      const chatsMap = new Map<string, { id: number | string; title: string; type: string; date: string }>();
      
      for (const update of data.result) {
        const msg = update.message || update.channel_post || update.my_chat_member;
        if (msg && msg.chat) {
          const chat = msg.chat;
          const key = String(chat.id);
          const title = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || 'محادثة خاصة';
          const type = chat.type === 'private' ? 'خاص (أستاذ/طالب)' : chat.type.includes('group') ? 'قروب' : chat.type;
          const dateStr = msg.date ? new Date(msg.date * 1000).toLocaleTimeString('ar-EG') : '';
          
          chatsMap.set(key, {
            id: chat.id,
            title,
            type,
            date: dateStr
          });
        }
      }
      
      return { success: true, chats: Array.from(chatsMap.values()) };
    } else {
      return { success: false, error: data.description || 'لم يتم العثور على تحديثات' };
    }
  } catch (err: any) {
    return { success: false, error: 'خطأ أثناء جلب التحديثات: ' + (err.message || '') };
  }
}

// Direct send message or photo via Telegram API
export async function sendTelegramMessageDirect(params: {
  botToken: string;
  chatId: string | number;
  text: string;
  photoUrl?: string;
  buttons?: Array<{ text: string; url: string }>;
  buttonLabel?: string;
  buttonUrl?: string;
  parseMode?: 'HTML' | 'Markdown';
}): Promise<{ success: boolean; error?: string }> {
  const { botToken, chatId, text, photoUrl, buttons, buttonLabel, buttonUrl, parseMode } = params;
  if (!botToken || !chatId || (!text && !photoUrl)) {
    return { success: false, error: 'البيانات غير مكتملة (Bot Token، Chat ID، أو المحتوى مفقود).' };
  }

  let replyMarkup: any = undefined;
  if (buttons && buttons.length > 0) {
    const validBtns = buttons.filter(b => b.text && b.url && b.url.startsWith('http'));
    if (validBtns.length > 0) {
      replyMarkup = {
        inline_keyboard: [validBtns]
      };
    }
  } else if (buttonLabel && buttonUrl && buttonUrl.startsWith('http')) {
    replyMarkup = {
      inline_keyboard: [
        [
          {
            text: buttonLabel,
            url: buttonUrl
          }
        ]
      ]
    };
  }

  // إذا تم تزويد رابط صورة، نجرب إرسال كـ sendPhoto أولاً
  if (photoUrl && photoUrl.startsWith('http')) {
    try {
      const photoPayload: any = {
        chat_id: chatId,
        photo: photoUrl,
        caption: text.substring(0, 1024)
      };
      if (parseMode) photoPayload.parse_mode = parseMode;
      if (replyMarkup) photoPayload.reply_markup = replyMarkup;

      const pRes = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(photoPayload)
      });
      const pData = await pRes.json();
      if (pData.ok) {
        return { success: true };
      }
    } catch (errPhoto) {
      // fallback to sendMessage
    }
  }

  const payload: any = {
    chat_id: chatId,
    text: text
  };

  if (parseMode) {
    payload.parse_mode = parseMode;
  }

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok) {
      return { success: true };
    } else {
      return { success: false, error: data.description || 'رفض Telegram إرسال الرسالة.' };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'خطأ في الاتصال بتلغرام.' };
  }
}

// Set Webhook for Bot to point to Google Apps Script Web App URL
export async function setTelegramWebhook(botToken: string, webAppUrl: string): Promise<{ success: boolean; description?: string; error?: string }> {
  const token = botToken.trim();
  const url = webAppUrl.trim();
  if (!token || !url) return { success: false, error: 'يرجى تزويد Bot Token ورابط Web App URL صالحين.' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(url)}&drop_pending_updates=true`);
    const data = await res.json();
    if (data.ok) {
      return { success: true, description: data.description || 'تم تفعيل الربط التلقائي Webhook بنجاح!' };
    } else {
      return { success: false, error: data.description || 'فشل تفعيل Webhook من جانب Telegram.' };
    }
  } catch (err: any) {
    return { success: false, error: 'خطأ في الاتصال: ' + (err.message || '') };
  }
}

// Delete Webhook / Drop pending updates
export async function deleteTelegramWebhook(botToken: string): Promise<{ success: boolean; description?: string; error?: string }> {
  const token = botToken.trim();
  if (!token) return { success: false, error: 'يرجى إدخال Bot Token.' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`);
    const data = await res.json();
    if (data.ok) {
      return { success: true, description: data.description || 'تم إيقاف Webhook ومسح الرسائل العالقة بنجاح' };
    } else {
      return { success: false, error: data.description || 'تعذر حذف Webhook' };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'خطأ في الاتصال' };
  }
}

// Get Webhook Info
export async function getTelegramWebhookInfo(botToken: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const token = botToken.trim();
  if (!token) return { success: false, error: 'يرجى إدخال Bot Token.' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = await res.json();
    if (data.ok) {
      return { success: true, data: data.result };
    } else {
      return { success: false, error: data.description || 'تعذر جلب معلومات Webhook' };
    }
  } catch (err: any) {
    return { success: false, error: err.message || '' };
  }
}

// Setup and initialize all Telegram sheets in Google Sheets via API
export async function setupTelegramSheetsInGas(): Promise<{ success: boolean; message?: string }> {
  try {
    let res = await fetchGas({ action: 'setupTelegramSheets' }, 'GET');
    if (!res || res.success === false) {
      res = await fetchGas({ action: 'setupTelegramSheets' }, 'POST', { action: 'setupTelegramSheets' });
    }
    if (res && res.message === 'الإجراء المطلوب غير معروف') {
      return {
        success: false,
        message: 'السكربت السحابي ينفذ إصداراً قديماً من كود Google Apps Script. يرجى إنشاء نشر جديد (New Deployment) ونسخ رابط Web App الجديد ولصقه في الإعدادات.'
      };
    }
    return res;
  } catch (err: any) {
    return { success: false, message: err.message || 'تعذر تهيئة الأوراق في Google Sheets' };
  }
}

// Bind Telegram student directly in Google Sheet
export async function bindTelegramUserInGas(payload: {
  studentName: string;
  sheetNumber: string;
  chatId: string;
  language?: string;
}): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetchGas({ action: 'bindTelegramUser' }, 'POST', {
      action: 'bindTelegramUser',
      ...payload
    });
    if (res && res.message === 'الإجراء المطلوب غير معروف') {
      return {
        success: false,
        message: 'السكربت السحابي ينفذ إصداراً قديماً من كود Google Apps Script. يرجى إنشاء نشر جديد (New Deployment).'
      };
    }
    // Save to local cache as well
    saveLinkedTelegramStudent({
      studentName: payload.studentName,
      sheetNumber: payload.sheetNumber,
      chatId: payload.chatId,
      language: (payload.language === 'en' || payload.language === 'th' ? payload.language : 'ar'),
      isRegistered: true
    });
    return res;
  } catch (err: any) {
    return { success: false, message: err.message || 'تعذر ربط الطالب في Google Sheets' };
  }
}

// Simulate Telegram webhook message directly to Google Apps Script Web App
export async function simulateTelegramWebhookInGas(sheetNumber: string, studentName: string): Promise<{ success: boolean; message?: string; rawResponse?: any }> {
  try {
    const fakeUpdate = {
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        message_id: Math.floor(Math.random() * 100000),
        from: {
          id: 999888777,
          first_name: studentName || 'طالب تجريبي',
          username: 'test_student'
        },
        chat: {
          id: 999888777,
          first_name: studentName || 'طالب تجريبي',
          type: 'private'
        },
        date: Math.floor(Date.now() / 1000),
        text: `/start S${sheetNumber}_ar`
      }
    };

    let res = await fetchGas({ action: 'simulateTelegramWebhook', sheetNumber, studentName }, 'GET');
    if (!res || res.message === 'الإجراء المطلوب غير معروف' || res.success === false) {
      res = await fetchGas({ action: 'simulateTelegramWebhook' }, 'POST', {
        action: 'simulateTelegramWebhook',
        sheetNumber,
        studentName,
        update_id: fakeUpdate.update_id,
        message: fakeUpdate.message,
        update: fakeUpdate
      });
    }

    if (res && res.message === 'الإجراء المطلوب غير معروف') {
      return {
        success: false,
        message: 'السكربت السحابي ينفذ إصداراً قديماً. يمكنك تنفيذ دالة RUN_SETUP_TELEGRAM_SHEETS مباشرة من محرر Apps Script بالضغط على زر (Run / تشغيل) لإنشاء الأوراق فوراً دون انتظار النشر!'
      };
    }
    return res;
  } catch (err: any) {
    return { success: false, message: err.message || 'فشلت محاكاة التلغرام' };
  }
}

// Trigger Google Apps Script to scan external teacher correction sheet (A1) and send telegram messages
export async function syncTeacherCorrectionsFromA1(forceRescan: boolean = false): Promise<{ success: boolean; processedCount?: number; unlinkedCount?: number; message?: string }> {
  try {
    let res = await fetchGas({ action: 'checkAndSendTeacherCorrections', forceRescan: forceRescan ? 'true' : 'false' }, 'GET');
    if (!res || res.message === 'الإجراء المطلوب غير معروف' || res.success === false) {
      res = await fetchGas({ action: 'checkAndSendTeacherCorrections' }, 'POST', {
        action: 'checkAndSendTeacherCorrections',
        forceRescan: forceRescan
      });
    }
    return res || { success: false, message: 'تعذر الاتصال بـ Google Apps Script' };
  } catch (err: any) {
    return { success: false, message: err.message || 'تعذر فحص تصحيحات الأستاذ من شيت A1' };
  }
}

// Install Time-Driven Clock Trigger in Google Apps Script to auto-check A1 sheet every 1 minute
export async function installAutomaticCorrectionTriggerInGas(): Promise<{ success: boolean; message?: string }> {
  try {
    let res = await fetchGas({ action: 'installAutomaticCorrectionTrigger' }, 'GET');
    if (!res || res.message === 'الإجراء المطلوب غير معروف' || res.success === false) {
      res = await fetchGas({ action: 'installAutomaticCorrectionTrigger' }, 'POST', {
        action: 'installAutomaticCorrectionTrigger'
      });
    }
    return res || { success: false, message: 'تعذر تثبيت المشغل التلقائي' };
  } catch (err: any) {
    return { success: false, message: err.message || 'تعذر تثبيت المشغل التلقائي' };
  }
}

// Clear correction cache to allow re-scanning all rows
export async function clearCorrectionCacheInGas(): Promise<{ success: boolean; message?: string }> {
  try {
    let res = await fetchGas({ action: 'clearCorrectionCache' }, 'GET');
    if (!res || res.message === 'الإجراء المطلوب غير معروف' || res.success === false) {
      res = await fetchGas({ action: 'clearCorrectionCache' }, 'POST', {
        action: 'clearCorrectionCache'
      });
    }
    return res || { success: false, message: 'تعذر مسح كاش التصحيحات' };
  } catch (err: any) {
    return { success: false, message: err.message || 'تعذر مسح كاش التصحيحات' };
  }
}



