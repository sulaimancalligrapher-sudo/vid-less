export interface Question {
  slotIndex?: number;
  time: number;
  image?: string;
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface WordData {
  word: string;
  fullSound: string;
  letterSounds: string[];
  image: string;
  comment: string;
  explainSound: string;
  youtubeUrl: string;
  questions: Question[];
  audioQuestions: Question[];
  showResult: 'نعم' | 'لا';
  instruction: string;
  allowRecording: 'نعم' | 'لا' | '';
  maxRecordingTime: number;
  retryCount: number;
  completed: 'تم' | 'اعادة' | '' | 'إعادة';
  showPrevButton: string;
  uploadTitle?: string;
  allowUpload: 'نعم' | 'لا' | '';
  retryResetCount: number;
  resetCondition?: 'نعم' | 'لا';
  dzValue?: string;
  totalQuestionsCount?: number;
  startDate?: string; // العمود DB (106) - تاريخ ظهور الموضوع
  endDate?: string; // العمود DC (107) - تاريخ إخفاء الموضوع
  expireAfterDays?: number | string; // العمود DD (108) - عدد أيام إخفاء الدرس بعد تاريخ الظهور
}

export interface Student {
  username: string;
  sheetNumber: string;
}

export interface AppSettings {
  webAppUrl: string;
}

export interface AdminQuestionItem {
  slotIndex?: number;
  time: number;
  image?: string;
  question: string;
  options: string;
  correctAnswer: string;
}

export interface AdminQuestionRow {
  rowIndex?: number;
  word: string;
  rawLinks?: string;
  fullSound?: string;
  comment: string;
  image?: string;
  explainSound?: string;
  youtubeUrl?: string;
  showResult?: string;
  totalQuestionsCount?: number;
  instruction?: string;
  allowRecording?: string;
  maxRecordingTime?: number;
  retryCount?: number;
  showPrevButton?: string;
  allowUpload?: string;
  defaultRetryResetCount?: number;
  startDate?: string; // العمود DB (106)
  endDate?: string; // العمود DC (107)
  expireAfterDays?: number | string; // العمود DD (108)
  questions?: AdminQuestionItem[];
  audioQuestions?: AdminQuestionItem[];
}

export interface AdminAnswerRow {
  rowIndex: number;
  sheetNumber: string; // العمود A
  username: string; // العمود B
  comment: string; // العمود C
  youtubeUrl?: string;
  videoAnswersResult?: string; // العمود U
  audioAnswersResult?: string; // العمود Z
  fullAudioScore?: string;
  letterListenScore?: string;
  recordingLink?: string;
  imageLink?: string;
  finalFormula?: string; // العمود AM
  finalResult?: string; // العمود AN
  audioUploadCount?: number | string; // العمود AK
  imageUploadCount?: number | string; // العمود AL
  completed?: string; // العمود AO
  retryResetCount?: number | null; // العمود AP
}

export interface HeaderNavButton {
  label: string;
  url: string;
}

export interface SocialLinks {
  facebook?: string; // E2
  instagram?: string; // F2
  youtube?: string; // G2
  line?: string; // H2
}

export interface HeaderConfig {
  title?: string;
  subtitle?: string;
  logoUrl?: string; // D2
  loginLogoUrl?: string; // login card logo
  siteTitle?: string; // C2
  welcomeMessage?: string; // B2
  buttons?: HeaderNavButton[];
  navButtons?: HeaderNavButton[];
  socials?: SocialLinks;
  socialLinks?: SocialLinks;
}

export interface CorrectionSectionData {
  status: string;
  score: string;
  mainImage: string;
  additionalImages: string[];
  videos: string[];
  audioExplanations: string[];
  date: string;
  sendCount: string;
  notes: string;
}

export interface StudentCorrection {
  sheetNumber: string;
  studentName: string;
  lessonTitle: string;
  imageSendCount: string;
  imageAssignment: string;
  audioSendCount: string;
  audioAssignment: string;
  imageCorrection: CorrectionSectionData;
  audioCorrection: CorrectionSectionData;
}

export interface TelegramConfig {
  botToken: string;
  botUsername?: string;
  teacherChatId: string;
  groupChatId: string;
  enableTeacherPrivate: boolean;
  enableStudentPrivate: boolean;
  enableGroupNotify: boolean;
  sendMediaFiles: boolean;
}

export interface TelegramUserBinding {
  studentName: string;
  sheetNumber: string;
  chatId: string;
  username?: string;
  language: 'ar' | 'th' | 'en';
  isRegistered: boolean;
  updatedAt?: string;
}

export interface TelegramTemplateItem {
  key: string;
  title: string;
  description: string;
  ar: string;
  th: string;
  en: string;
  variables: string[];
  buttonTextAr?: string;
  buttonTextTh?: string;
  buttonTextEn?: string;
  buttonUrl?: string;
}

export interface TelegramBroadcastMessage {
  recipientType: 'all' | 'specific_student' | 'teacher' | 'group';
  targetStudentName?: string;
  targetSheetNumber?: string;
  messageType: 'text' | 'photo' | 'voice' | 'video' | 'link';
  text: string;
  mediaUrl?: string;
  buttonLabel?: string;
  buttonUrl?: string;
}

// ==========================================
// --- LIVE CLASSROOM (Questions-T & Answers-T) ---
// ==========================================

export interface LiveQuestionItem {
  index: number;
  time: number; // in seconds (Column C, H, M...)
  timeFormatted?: string; // e.g. "00:15"
  image?: string; // Column D, I, N... (flexible / Drive thumbnail / direct)
  question: string; // Column E, J, O... (نص السؤال)
  options: string[]; // parsed from Column F, K, P... (خيارات مفصولة بفاصلة)
  isTextAnswer?: boolean; // true if Column F is 'نص'
  correctAnswer: string; // Column G, L, Q... (رقم خيار 1, 2.. أو نص مطابقة أو فارغ للحرة)
}

export interface LiveLessonRow {
  rowIndex?: number;
  title: string; // Column A (موضوع الدرس)
  videoUrl: string; // Column B (رابط الفيديو)
  questions: LiveQuestionItem[]; // Dynamic starting from Column C (5 cols per question: C:G, H:L, M:Q...)
  settingTimeLimit?: number;
  settingShowResult?: 'نعم' | 'لا';
}

export interface LiveConnectedStudent {
  username: string;
  sheetNumber: string;
  joinedAt: number;
  lastPing: number;
  pinVerified?: boolean;
}

export interface LiveStudentAnswerSubmission {
  username: string;
  sheetNumber: string;
  answer: string;
  isCorrect?: boolean | null;
  submittedAt: number;
}

export interface LiveSessionState {
  sessionId: string;
  sessionPin?: string;
  isProgramActive?: boolean;
  showLessonsListInRoom?: boolean; // Controls whether lessons list dropdown/button appears on projector display screen
  lessonTitle: string;
  videoUrl: string;
  status: 'idle' | 'waiting' | 'playing' | 'question_active' | 'revealed' | 'finished' | 'program_ended';
  currentQuestionIndex: number | null;
  currentQuestion: LiveQuestionItem | null;
  questionTriggeredAt: number | null;
  timeLimit: number;
  showResult: 'نعم' | 'لا';
  connectedStudents: LiveConnectedStudent[];
  answersForCurrentQuestion: Record<string, LiveStudentAnswerSubmission>;
  allSessionAnswers: Record<string, Record<number, string>>;
}

export interface LiveAnswerRecord {
  rowIndex?: number;
  timestamp: string; // Column A (تاريخ وتوقيت الإجابة)
  sheetNumber: string; // Column B (رقم المشترك)
  username: string; // Column C (اسم المشترك)
  lessonTitle: string; // Column D (موضوع الدرس)
  answers: Record<number, string>; // Columns E+ (إجابات الأسئلة س1، س2، ... "صح" / "خطأ" أو نص الإجابة)
  totalScore?: string;
}

/**
 * Normalizes Arabic strings and converts Arabic-Indic digits (٠-٩) to English (0-9)
 * for completely robust answer matching regardless of font or diacritics.
 */
export function normalizeArabicText(str: string): string {
  if (!str) return '';
  return str
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()) // convert Arabic numbers to English: ٠->0, ١->1 ...
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove Arabic Tashkeel / diacritics
    .replace(/[إأآٱ]/g, 'ا') // normalize Alef
    .replace(/ة/g, 'ه') // normalize Taa Marbuta
    .replace(/ى/g, 'ي') // normalize Yaa
    .replace(/[^\S\r\n]+/g, ' ') // normalize whitespace
    .trim()
    .toLowerCase();
}

/**
 * Evaluates a student's answer against the 3 cases in Column G:
 * Case 1: Option index (1, 2, 3... or ١, ٢, ٣...) when Column F contains options
 * Case 2: Specific text match when Column F is 'نص' and Column G has text
 * Case 3: Free text answer when Column G is empty (isCorrect: null, not evaluated as right or wrong)
 */
export function evaluateLiveAnswer(
  question: LiveQuestionItem,
  answer: string
): { isCorrect: boolean | null; correctLabel?: string } {
  const rawAnswer = String(answer || '').trim();
  if (!rawAnswer) return { isCorrect: null };

  const normAnswer = normalizeArabicText(rawAnswer);
  const rawCorrect = String(question.correctAnswer || '').trim();
  const normCorrect = normalizeArabicText(rawCorrect);
  const validOptions = (question.options || []).map(o => String(o || '').trim()).filter(Boolean);
  const isMultipleChoice = validOptions.length > 0 && !question.isTextAnswer;

  if (isMultipleChoice) {
    // Case 1: G contains a number (1, 2, 3... or ١, ٢, ٣...) pointing to 1-based index in options
    const numAnswer = parseInt(normCorrect, 10);
    let correctOptionText = '';
    if (!isNaN(numAnswer) && numAnswer >= 1 && numAnswer <= validOptions.length) {
      correctOptionText = validOptions[numAnswer - 1];
    } else if (rawCorrect) {
      // Direct text match against options
      const matchedOpt = validOptions.find(o => normalizeArabicText(o) === normCorrect);
      correctOptionText = matchedOpt || rawCorrect;
    }

    if (correctOptionText) {
      const normCorrectOpt = normalizeArabicText(correctOptionText);

      // Check if student answer matches correct option
      let isCorrect = (normAnswer === normCorrectOpt);

      // Also handle when options are ["صح", "خطأ"] or binary options
      if (!isCorrect) {
        if ((normAnswer === 'صح' || normAnswer === 'صحيح' || normAnswer === '✓' || normAnswer === 'true') && 
            (normCorrectOpt === 'صح' || normCorrectOpt === 'صحيح' || normCorrect === '1')) {
          isCorrect = true;
        } else if ((normAnswer === 'خطا' || normAnswer === 'خاطي' || normAnswer === '✗' || normAnswer === 'false') && 
                   (normCorrectOpt === 'خطا' || normCorrectOpt === 'خاطي' || normCorrect === '2')) {
          isCorrect = true;
        }
      }

      return { isCorrect, correctLabel: correctOptionText };
    } else {
      // Ungraded multiple choice (Column G left empty)
      return { isCorrect: null };
    }
  } else {
    // Text question (Column F is 'نص' or no options)
    if (rawCorrect) {
      // Case 2: Specific model answer required
      const isCorrect = normAnswer === normCorrect;
      return { isCorrect, correctLabel: rawCorrect };
    } else {
      // Case 3: Free text answer, not graded as right or wrong
      return { isCorrect: null };
    }
  }
}



