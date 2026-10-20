import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  LiveSessionState, 
  LiveQuestionItem, 
  LiveConnectedStudent, 
  LiveStudentAnswerSubmission,
  LiveStudentMessage,
  normalizeArabicText,
  QuizActiveState,
  QuizQuestionItem,
  QuizStudentProgress,
  QuizStudentAnswerDetail
} from '../types';

const LIVE_DOC_REF = doc(db, 'live_sessions', 'main');

export const defaultLiveSessionState: LiveSessionState = {
  sessionId: 'live-main',
  sessionPin: '1234',
  isProgramActive: false,
  showLessonsListInRoom: false,
  showPinInRoom: false,
  showQrInRoom: false,
  showFinishLessonInRoom: false,
  showRevealInRoom: false,
  showResumeInRoom: false,
  showSkipInRoom: false,
  showPlayPauseInRoom: false,
  videoPlaying: false,
  showOptionCountsInRoom: false,
  showStudentTextAnswersInRoom: false,
  showChatInRoom: false,
  showConnectedCountInRoom: false,
  showPdfInRoom: false,
  pdfUrl: '',
  pdfTitle: '',
  pdfPage: 1,
  messages: [],
  lessonTitle: '',
  videoUrl: '',
  status: 'idle',
  currentQuestionIndex: null,
  currentQuestion: null,
  questionTriggeredAt: null,
  timeLimit: 30,
  showResult: 'نعم',
  connectedStudents: [],
  answersForCurrentQuestion: {},
  allSessionAnswers: {},
  quizState: null,
};

export function generatePinCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// In-memory cache for ultra-fast local access
let cachedState: LiveSessionState = { ...defaultLiveSessionState };

export function getCachedLiveState(): LiveSessionState {
  return cachedState;
}

// Subscribe to real-time live session updates (replaces SSE)
export function subscribeToLiveSession(
  onUpdate: (state: LiveSessionState) => void,
  onError?: (err: any) => void
): () => void {
  // Return unsubscribe function
  const unsubscribe = onSnapshot(
    LIVE_DOC_REF,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as any;
        const now = Date.now();
        const rawStudents = Array.isArray(data.connectedStudents) ? data.connectedStudents : [];
        // Active heartbeat: lastPing or joinedAt within 60 seconds
        const activeStudents = rawStudents.filter((s: any) => {
          const lastActive = s.lastPing || s.joinedAt || 0;
          return (now - lastActive) < 60000;
        });

        const state: LiveSessionState = {
          sessionId: data.sessionId || 'live-main',
          sessionPin: data.sessionPin || '1234',
          isProgramActive: Boolean(data.isProgramActive),
          showLessonsListInRoom: Boolean(data.showLessonsListInRoom),
          showPinInRoom: Boolean(data.showPinInRoom),
          showQrInRoom: Boolean(data.showQrInRoom),
          showFinishLessonInRoom: Boolean(data.showFinishLessonInRoom),
          showRevealInRoom: Boolean(data.showRevealInRoom),
          showResumeInRoom: Boolean(data.showResumeInRoom),
          showSkipInRoom: Boolean(data.showSkipInRoom),
          showPlayPauseInRoom: Boolean(data.showPlayPauseInRoom),
          videoPlaying: Boolean(data.videoPlaying),
          showOptionCountsInRoom: Boolean(data.showOptionCountsInRoom),
          showStudentTextAnswersInRoom: Boolean(data.showStudentTextAnswersInRoom),
          showChatInRoom: Boolean(data.showChatInRoom),
          showConnectedCountInRoom: Boolean(data.showConnectedCountInRoom),
          showPdfInRoom: Boolean(data.showPdfInRoom),
          pdfUrl: data.pdfUrl || '',
          pdfTitle: data.pdfTitle || '',
          pdfPage: typeof data.pdfPage === 'number' ? data.pdfPage : 1,
          pdfTotalPages: typeof data.pdfTotalPages === 'number' ? data.pdfTotalPages : undefined,
          pdfLaser: data.pdfLaser || null,
          pdfFitMode: data.pdfFitMode === 'width' ? 'width' : 'contain',
          pdfZoom: typeof data.pdfZoom === 'number' ? data.pdfZoom : 1.0,
          pdfAnnotations: data.pdfAnnotations || {},
          messages: Array.isArray(data.messages) ? data.messages : [],
          lessonTitle: data.lessonTitle || '',
          videoUrl: data.videoUrl || '',
          status: data.status || 'idle',
          currentQuestionIndex: data.currentQuestionIndex !== undefined ? data.currentQuestionIndex : null,
          currentQuestion: data.currentQuestion || null,
          questionTriggeredAt: data.questionTriggeredAt || null,
          timeLimit: data.timeLimit || 30,
          showResult: data.showResult || 'نعم',
          connectedStudents: activeStudents,
          answersForCurrentQuestion: data.answersForCurrentQuestion || {},
          allSessionAnswers: data.allSessionAnswers || {},
          quizState: data.quizState || null,
        };
        cachedState = state;
        onUpdate(state);
      } else {
        // Doc does not exist yet, initialize it
        setDoc(LIVE_DOC_REF, {
          ...defaultLiveSessionState,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch((e) => console.warn('Failed to seed live session doc:', e));
        cachedState = defaultLiveSessionState;
        onUpdate(defaultLiveSessionState);
      }
    },
    (error) => {
      console.error('Firestore live stream error:', error);
      if (onError) onError(error);
    }
  );

  return unsubscribe;
}

// Fetch current session state once
export async function getLiveSessionState(): Promise<LiveSessionState | null> {
  try {
    const snap = await getDoc(LIVE_DOC_REF);
    if (snap.exists()) {
      const data = snap.data() as any;
      const now = Date.now();
      const rawStudents = Array.isArray(data.connectedStudents) ? data.connectedStudents : [];
      const activeStudents = rawStudents.filter((s: any) => {
        const lastActive = s.lastPing || s.joinedAt || 0;
        return (now - lastActive) < 60000;
      });

      const state: LiveSessionState = {
        sessionId: data.sessionId || 'live-main',
        sessionPin: data.sessionPin || '1234',
        isProgramActive: Boolean(data.isProgramActive),
        showLessonsListInRoom: Boolean(data.showLessonsListInRoom),
        showPinInRoom: Boolean(data.showPinInRoom),
        showQrInRoom: Boolean(data.showQrInRoom),
        showFinishLessonInRoom: Boolean(data.showFinishLessonInRoom),
        showRevealInRoom: Boolean(data.showRevealInRoom),
        showResumeInRoom: Boolean(data.showResumeInRoom),
        showSkipInRoom: Boolean(data.showSkipInRoom),
        showPlayPauseInRoom: Boolean(data.showPlayPauseInRoom),
        videoPlaying: Boolean(data.videoPlaying),
        showOptionCountsInRoom: Boolean(data.showOptionCountsInRoom),
        showStudentTextAnswersInRoom: Boolean(data.showStudentTextAnswersInRoom),
        showChatInRoom: Boolean(data.showChatInRoom),
        showConnectedCountInRoom: Boolean(data.showConnectedCountInRoom),
        showPdfInRoom: Boolean(data.showPdfInRoom),
        pdfUrl: data.pdfUrl || '',
        pdfTitle: data.pdfTitle || '',
        pdfPage: typeof data.pdfPage === 'number' ? data.pdfPage : 1,
        pdfTotalPages: typeof data.pdfTotalPages === 'number' ? data.pdfTotalPages : undefined,
        pdfLaser: data.pdfLaser || null,
        pdfFitMode: data.pdfFitMode === 'width' ? 'width' : 'contain',
        pdfZoom: typeof data.pdfZoom === 'number' ? data.pdfZoom : 1.0,
        pdfAnnotations: data.pdfAnnotations || {},
        messages: Array.isArray(data.messages) ? data.messages : [],
        lessonTitle: data.lessonTitle || '',
        videoUrl: data.videoUrl || '',
        status: data.status || 'idle',
        currentQuestionIndex: data.currentQuestionIndex !== undefined ? data.currentQuestionIndex : null,
        currentQuestion: data.currentQuestion || null,
        questionTriggeredAt: data.questionTriggeredAt || null,
        timeLimit: data.timeLimit || 30,
        showResult: data.showResult || 'نعم',
        connectedStudents: activeStudents,
        answersForCurrentQuestion: data.answersForCurrentQuestion || {},
        allSessionAnswers: data.allSessionAnswers || {},
        quizState: data.quizState || null,
      };
      cachedState = state;
      return state;
    } else {
      await setDoc(LIVE_DOC_REF, {
        ...defaultLiveSessionState,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return defaultLiveSessionState;
    }
  } catch (err) {
    console.warn('Error fetching live session from Firestore:', err);
    return cachedState;
  }
}

// Teacher starts program session (Generates PIN, activates program, resets students)
export async function startLiveProgram(): Promise<{ success: boolean; pin?: string; state?: LiveSessionState }> {
  try {
    const pin = generatePinCode();
    const updatedState: Partial<LiveSessionState> = {
      sessionId: 'live-' + Date.now(),
      sessionPin: pin,
      isProgramActive: true,
      status: 'idle',
      connectedStudents: [],
      answersForCurrentQuestion: {},
      allSessionAnswers: {},
      currentQuestion: null,
      currentQuestionIndex: null,
      questionTriggeredAt: null,
    };

    await setDoc(LIVE_DOC_REF, {
      ...updatedState,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    cachedState = { ...cachedState, ...updatedState };
    return { success: true, pin, state: cachedState };
  } catch (error: any) {
    console.error('Failed to start live program in Firebase:', error);
    throw new Error('فشل بدء البرنامج في السحاب: ' + (error?.message || 'خطأ غير معروف'));
  }
}

// Teacher ends program session (Kicks out students, marks program_ended)
export async function endLiveProgram(): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    const updatedState: Partial<LiveSessionState> = {
      isProgramActive: false,
      status: 'program_ended',
      connectedStudents: [],
      currentQuestion: null,
      currentQuestionIndex: null,
      answersForCurrentQuestion: {},
      allSessionAnswers: {},
    };

    await setDoc(LIVE_DOC_REF, {
      ...updatedState,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    cachedState = { ...cachedState, ...updatedState };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to end live program in Firebase:', error);
    throw new Error('فشل إنهاء البرنامج في السحاب: ' + (error?.message || 'خطأ غير معروف'));
  }
}

// Regenerate or update session PIN
export async function updateLivePin(customPin?: string): Promise<{ success: boolean; pin?: string; state?: LiveSessionState }> {
  try {
    const pin = customPin && customPin.trim().length > 0 ? customPin.trim() : generatePinCode();
    await updateDoc(LIVE_DOC_REF, {
      sessionPin: pin,
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, sessionPin: pin };
    return { success: true, pin, state: cachedState };
  } catch (error: any) {
    console.error('Failed to update PIN in Firebase:', error);
    throw error;
  }
}

// Student joins session
export async function joinLiveSession(
  username: string, 
  sheetNumber: string, 
  pin?: string
): Promise<{ success: boolean; state?: LiveSessionState; pinVerified?: boolean; error?: string }> {
  try {
    const currentState = await getLiveSessionState();
    if (!currentState) {
      return { success: false, error: 'تعذر الاتصال بقاعدة بيانات الحصة المباشرة.' };
    }

    const isActive = Boolean(currentState.isProgramActive) || 
      (currentState.status !== 'program_ended' && currentState.status !== 'idle' && Boolean(currentState.lessonTitle));

    if (!isActive) {
      return { 
        success: false, 
        error: 'الحصة المباشرة مغلقة حالياً من قِبل المعلم. يرجى الانتظار حتى يبدأ المعلم الحصة.' 
      };
    }

    // Verify PIN if set
    const expectedPin = currentState.sessionPin?.trim();
    const enteredPin = pin?.trim();
    if (expectedPin && expectedPin.length > 0) {
      if (!enteredPin || enteredPin !== expectedPin) {
        return { 
          success: false, 
          pinVerified: false, 
          error: 'رمز الدخول غير صحيح! يرجى إدخال الرمز المعروض على شاشة الفصل.' 
        };
      }
    }

    const cleanUser = String(username || '').trim();
    const cleanSheet = String(sheetNumber || '').trim();
    const normUser = cleanUser.toLowerCase();

    // Check if student already exists in connectedStudents (by username case-insensitively OR by sheetNumber)
    const oldStudent = (currentState.connectedStudents || []).find(
      (s) => String(s.username || '').trim().toLowerCase() === normUser || 
             (cleanSheet && String(s.sheetNumber || '').trim() === cleanSheet)
    );

    // If student re-entered without sheetNumber this time, preserve previously saved sheetNumber!
    const effectiveSheetNumber = cleanSheet || (oldStudent ? String(oldStudent.sheetNumber || '').trim() : '');

    // Deduplicate: filter out any student with same username (case-insensitive) OR same sheet number
    const existing = (currentState.connectedStudents || []).filter((s) => {
      const sUser = String(s.username || '').trim().toLowerCase();
      const sSheet = String(s.sheetNumber || '').trim();
      if (sUser === normUser) return false;
      if (effectiveSheetNumber && sSheet && effectiveSheetNumber === sSheet) return false;
      return true;
    });

    const newStudent: LiveConnectedStudent = {
      username: cleanUser,
      sheetNumber: effectiveSheetNumber,
      joinedAt: oldStudent ? oldStudent.joinedAt : Date.now(),
      lastPing: Date.now(),
      pinVerified: true,
    };
    const updatedStudents = [...existing, newStudent];

    await updateDoc(LIVE_DOC_REF, {
      connectedStudents: updatedStudents,
      updatedAt: serverTimestamp(),
    });

    cachedState = { ...currentState, connectedStudents: updatedStudents };
    return { success: true, state: cachedState, pinVerified: true };
  } catch (error: any) {
    console.error('Failed to join live session:', error);
    return { success: false, error: error?.message || 'حدث خطأ أثناء الانضمام' };
  }
}

// Student ping
export async function pingLiveSession(username: string, sheetNumber?: string): Promise<void> {
  try {
    const state = cachedState;
    const cleanUser = String(username || '').trim().toLowerCase();
    const students = [...(state.connectedStudents || [])];
    const idx = students.findIndex((s) => String(s.username || '').trim().toLowerCase() === cleanUser);
    if (idx !== -1) {
      students[idx] = { ...students[idx], lastPing: Date.now() };
      await updateDoc(LIVE_DOC_REF, { connectedStudents: students });
    }
  } catch {}
}

// Student leaves
export async function leaveLiveSession(username: string, sheetNumber?: string): Promise<void> {
  try {
    const state = await getLiveSessionState();
    if (!state) return;
    const cleanUser = String(username || '').trim().toLowerCase();
    const updatedStudents = (state.connectedStudents || []).filter(
      (s) => String(s.username || '').trim().toLowerCase() !== cleanUser
    );
    await updateDoc(LIVE_DOC_REF, {
      connectedStudents: updatedStudents,
      updatedAt: serverTimestamp(),
    });
  } catch {}
}

// Reset / Clear all connected students manually (e.g. by teacher)
export async function clearConnectedStudents(): Promise<{ success: boolean }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      connectedStudents: [],
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, connectedStudents: [] };
    return { success: true };
  } catch (err: any) {
    console.error('Failed to clear connected students:', err);
    return { success: false };
  }
}

// Teacher initializes a lesson theater
export async function initLiveSession(payload: {
  lessonTitle: string;
  videoUrl?: string;
  mode?: 'video' | 'direct';
  explanationText?: string;
  timeLimit?: number;
  showResult?: 'نعم' | 'لا';
}): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    const isDirect = payload.mode === 'direct' || !payload.videoUrl;
    const pin = cachedState.sessionPin || generatePinCode();
    const isSameLesson = cachedState.lessonTitle === payload.lessonTitle;
    const update: Partial<LiveSessionState> = {
      sessionId: cachedState.sessionId || ('live-' + Date.now()),
      sessionPin: pin,
      isProgramActive: true,
      lessonTitle: payload.lessonTitle,
      videoUrl: payload.videoUrl || '',
      mode: isDirect ? 'direct' : 'video',
      explanationText: payload.explanationText || '',
      timeLimit: payload.timeLimit ?? 30,
      showResult: payload.showResult ?? 'نعم',
      status: isDirect ? 'playing' : 'waiting',
      currentQuestionIndex: null,
      currentQuestion: null,
      questionTriggeredAt: null,
      answersForCurrentQuestion: isSameLesson ? (cachedState.answersForCurrentQuestion || {}) : {},
      allSessionAnswers: isSameLesson ? (cachedState.allSessionAnswers || {}) : {},
    };

    await updateDoc(LIVE_DOC_REF, {
      ...update,
      updatedAt: serverTimestamp(),
    });

    cachedState = { ...cachedState, ...update };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to init live lesson:', error);
    throw error;
  }
}

// Teacher returns to explanation mode (clears active question so students return to live listening screen)
export async function returnToLiveExplanation(payload?: {
  explanationText?: string;
}): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    const update: Partial<LiveSessionState> = {
      status: 'playing',
      currentQuestionIndex: null,
      currentQuestion: null,
      questionTriggeredAt: null,
      answersForCurrentQuestion: {},
      explanationText: payload?.explanationText ?? cachedState.explanationText ?? '',
    };
    await updateDoc(LIVE_DOC_REF, {
      ...update,
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, ...update };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to return to live explanation:', error);
    throw error;
  }
}

// Teacher triggers a live question
export async function triggerLiveQuestion(payload: {
  questionIndex: number;
  question: LiveQuestionItem;
  timeLimit?: number;
  showResult?: 'نعم' | 'لا';
}): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    const update: Partial<LiveSessionState> = {
      status: 'question_active',
      videoPlaying: false,
      currentQuestionIndex: payload.questionIndex,
      currentQuestion: payload.question,
      questionTriggeredAt: Date.now(),
      timeLimit: payload.timeLimit ?? cachedState.timeLimit ?? 30,
      showResult: payload.showResult ?? cachedState.showResult ?? 'نعم',
      answersForCurrentQuestion: {},
    };

    await updateDoc(LIVE_DOC_REF, {
      ...update,
      updatedAt: serverTimestamp(),
    });

    cachedState = { ...cachedState, ...update };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to trigger question in Firebase:', error);
    throw error;
  }
}

// Student submits an answer
export async function submitLiveAnswer(payload: {
  username: string;
  sheetNumber: string;
  answer: string;
  questionIndex: number;
  isCorrect?: boolean | null;
}): Promise<{ success: boolean; state?: LiveSessionState; error?: string }> {
  try {
    const state = await getLiveSessionState() || cachedState;
    const currentAnswers = { ...(state.answersForCurrentQuestion || {}) };
    const allAnswers = { ...(state.allSessionAnswers || {}) };

    const cleanUser = String(payload.username || '').trim();
    let cleanSheet = String(payload.sheetNumber || '').trim();

    if (!cleanUser) {
      return { success: false, error: 'اسم الطالب مطلوب لتسجيل الإجابة.' };
    }

    const normClean = normalizeArabicText(cleanUser);

    // If student submitted without sheetNumber, recover from connectedStudents
    if (!cleanSheet) {
      const match = (state.connectedStudents || []).find(
        (s) => normalizeArabicText(String(s.username || '')) === normClean
      );
      if (match && match.sheetNumber) {
        cleanSheet = String(match.sheetNumber).trim();
      }
    }

    // Ensure student is registered and active in connectedStudents
    let updatedStudents = [...(state.connectedStudents || [])];
    const matchIdx = updatedStudents.findIndex(
      (s) => normalizeArabicText(String(s.username || '')) === normClean
    );
    if (matchIdx >= 0) {
      updatedStudents[matchIdx] = {
        ...updatedStudents[matchIdx],
        sheetNumber: cleanSheet || updatedStudents[matchIdx].sheetNumber,
        pinVerified: true,
        lastPing: Date.now(),
      };
    } else {
      updatedStudents.push({
        username: cleanUser,
        sheetNumber: cleanSheet,
        joinedAt: Date.now(),
        lastPing: Date.now(),
        pinVerified: true,
      });
    }

    const studentKey = cleanSheet ? `${cleanUser}_${cleanSheet}` : cleanUser;

    const submission: LiveStudentAnswerSubmission = {
      username: cleanUser,
      sheetNumber: cleanSheet,
      answer: String(payload.answer ?? '').trim(),
      isCorrect: payload.isCorrect,
      submittedAt: Date.now(),
    };

    // Deduplicate: Clean up any old or alternate keys for this same student so they never appear twice
    Object.keys(currentAnswers).forEach((k) => {
      const existingSub = currentAnswers[k];
      const existingUser = existingSub?.username ? String(existingSub.username).trim() : (k.includes('_') ? k.split('_')[0] : k);
      if (normalizeArabicText(existingUser) === normClean) {
        delete currentAnswers[k];
      }
    });

    // Store EXACTLY ONE entry per student in currentAnswers
    currentAnswers[studentKey] = submission;

    // Deduplicate allSessionAnswers: merge and clean up any alternate keys
    Object.keys(allAnswers).forEach((k) => {
      const existingUser = k.includes('_') ? k.split('_')[0] : k;
      if (normalizeArabicText(existingUser) === normClean && k !== studentKey) {
        allAnswers[studentKey] = { ...(allAnswers[k] || {}), ...(allAnswers[studentKey] || {}) };
        delete allAnswers[k];
      }
    });

    if (!allAnswers[studentKey]) {
      allAnswers[studentKey] = {};
    }
    
    // Format answer cleanly as 'صح' or 'خطأ' if evaluation is available, or preserve text
    const formattedAnswer = payload.isCorrect === true
      ? 'صح'
      : payload.isCorrect === false
        ? 'خطأ'
        : String(payload.answer ?? '').trim();

    allAnswers[studentKey][payload.questionIndex] = formattedAnswer;

    await updateDoc(LIVE_DOC_REF, {
      answersForCurrentQuestion: currentAnswers,
      allSessionAnswers: allAnswers,
      connectedStudents: updatedStudents,
      updatedAt: serverTimestamp(),
    });

    cachedState = { 
      ...state, 
      answersForCurrentQuestion: currentAnswers, 
      allSessionAnswers: allAnswers,
      connectedStudents: updatedStudents,
    };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to submit answer in Firebase:', error);
    return { success: false, error: error?.message || 'فشل إرسال الإجابة لقاعدة البيانات' };
  }
}

// Teacher reveals correct answer
export async function revealLiveAnswer(): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      status: 'revealed',
      videoPlaying: false,
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, status: 'revealed', videoPlaying: false };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to reveal answer in Firebase:', error);
    throw error;
  }
}

// Teacher resumes video playback
export async function resumeLiveVideo(): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    const update: Partial<LiveSessionState> = {
      status: 'playing',
      videoPlaying: true,
      currentQuestion: null,
      currentQuestionIndex: null,
      questionTriggeredAt: null,
      answersForCurrentQuestion: {},
    };

    await updateDoc(LIVE_DOC_REF, {
      ...update,
      updatedAt: serverTimestamp(),
    });

    cachedState = { ...cachedState, ...update };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to resume video in Firebase:', error);
    throw error;
  }
}

// Teacher finishes lesson
export async function finishLiveSession(): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    const update: Partial<LiveSessionState> = {
      isProgramActive: false,
      status: 'finished',
      currentQuestion: null,
      currentQuestionIndex: null,
      answersForCurrentQuestion: {},
      allSessionAnswers: {},
    };

    await setDoc(LIVE_DOC_REF, {
      ...update,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    cachedState = { ...cachedState, ...update };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to finish live session:', error);
    throw error;
  }
}

// Reset session state
export async function resetLiveSession(): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    const freshState: LiveSessionState = {
      ...defaultLiveSessionState,
      sessionId: 'live-' + Date.now(),
      sessionPin: cachedState.sessionPin || generatePinCode(),
      isProgramActive: cachedState.isProgramActive,
    };

    await setDoc(LIVE_DOC_REF, {
      ...freshState,
      updatedAt: serverTimestamp(),
    });

    cachedState = freshState;
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to reset live session in Firebase:', error);
    throw error;
  }
}

// Backup & Recovery
export async function getLiveBackup(): Promise<{ success: boolean; backup?: any }> {
  try {
    const state = await getLiveSessionState();
    return {
      success: true,
      backup: {
        savedAt: new Date().toISOString(),
        session: state || cachedState,
      }
    };
  } catch {
    return { success: false };
  }
}

export async function restoreLiveBackup(backupSession: any): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    if (!backupSession) return { success: false };
    await setDoc(LIVE_DOC_REF, {
      ...backupSession,
      updatedAt: serverTimestamp(),
    });
    cachedState = backupSession;
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to restore backup:', error);
    throw error;
  }
}

// Toggle showing lessons list selector in projector display screen
export async function toggleShowLessonsListInRoom(show: boolean): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      showLessonsListInRoom: show,
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, showLessonsListInRoom: show };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to toggle showLessonsListInRoom in Firebase:', error);
    return { success: false };
  }
}

// Toggle showing attendance PIN badge in projector display screen
export async function toggleShowPinInRoom(show: boolean): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      showPinInRoom: show,
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, showPinInRoom: show };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to toggle showPinInRoom in Firebase:', error);
    return { success: false };
  }
}

// Toggle showing join QR code in projector display screen
export async function toggleShowQrInRoom(show: boolean): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      showQrInRoom: show,
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, showQrInRoom: show };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to toggle showQrInRoom in Firebase:', error);
    return { success: false };
  }
}

// Toggle showing finish lesson button in projector display screen
export async function toggleShowFinishLessonInRoom(show: boolean): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      showFinishLessonInRoom: show,
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, showFinishLessonInRoom: show };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to toggle showFinishLessonInRoom in Firebase:', error);
    return { success: false };
  }
}

// Toggle showing "الإجابة" button in projector display screen
export async function toggleShowRevealInRoom(show: boolean): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      showRevealInRoom: show,
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, showRevealInRoom: show };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to toggle showRevealInRoom in Firebase:', error);
    return { success: false };
  }
}

// Toggle showing "تخطي" button in projector display screen
export async function toggleShowSkipInRoom(show: boolean): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      showSkipInRoom: show,
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, showSkipInRoom: show };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to toggle showSkipInRoom in Firebase:', error);
    return { success: false };
  }
}

// Toggle showing counts of students per option on projector display screen
export async function toggleShowOptionCountsInRoom(show: boolean): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      showOptionCountsInRoom: show,
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, showOptionCountsInRoom: show };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to toggle showOptionCountsInRoom in Firebase:', error);
    return { success: false };
  }
}

// Toggle showing student submitted text answers on projector display screen
export async function toggleShowStudentTextAnswersInRoom(show: boolean): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      showStudentTextAnswersInRoom: show,
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, showStudentTextAnswersInRoom: show };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to toggle showStudentTextAnswersInRoom in Firebase:', error);
    return { success: false };
  }
}

// Toggle showing "متابعة تشغيل الفيديو" button in projector display screen
export async function toggleShowResumeInRoom(show: boolean): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      showResumeInRoom: show,
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, showResumeInRoom: show };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to toggle showResumeInRoom in Firebase:', error);
    return { success: false };
  }
}

// Toggle showing Play/Pause video controls in projector display screen
export async function toggleShowPlayPauseInRoom(show: boolean): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      showPlayPauseInRoom: show,
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, showPlayPauseInRoom: show };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to toggle showPlayPauseInRoom in Firebase:', error);
    return { success: false };
  }
}

// Teacher toggles Play/Pause state synced across room and admin
export async function toggleLiveVideoPlay(playing: boolean): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      videoPlaying: playing,
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, videoPlaying: playing };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to toggle videoPlay in Firebase:', error);
    return { success: false };
  }
}

// Student sends a message or reaction (Raise Hand, Agree, Disagree, Question, Clap)
export async function sendStudentMessage(payload: {
  senderName: string;
  sheetNumber?: string;
  type: 'question' | 'hand' | 'agree' | 'disagree' | 'clap';
  text?: string;
}): Promise<{ success: boolean; messageId: string }> {
  try {
    const newMessage: LiveStudentMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderName: payload.senderName.trim(),
      sheetNumber: payload.sheetNumber?.trim() || '',
      type: payload.type,
      text: payload.text?.trim() || '',
      createdAt: Date.now(),
    };

    const currentMessages = cachedState.messages || [];
    // Keep last 100 messages to prevent document size bloat
    const updatedMessages = [...currentMessages.slice(-99), newMessage];

    await updateDoc(LIVE_DOC_REF, {
      messages: updatedMessages,
      updatedAt: serverTimestamp(),
    });

    cachedState = { ...cachedState, messages: updatedMessages };
    return { success: true, messageId: newMessage.id };
  } catch (error: any) {
    console.error('Failed to send student message:', error);
    throw error;
  }
}

// Teacher replies to a student message (private or public)
export async function replyToStudentMessage(
  messageId: string,
  replyText: string,
  replyType: 'private' | 'public'
): Promise<{ success: boolean }> {
  try {
    const currentMessages = cachedState.messages || [];
    const updatedMessages = currentMessages.map((msg) => {
      if (msg.id === messageId) {
        return {
          ...msg,
          reply: {
            text: replyText.trim(),
            type: replyType,
            repliedAt: Date.now(),
            repliedBy: 'الأستاذ',
          },
        };
      }
      return msg;
    });

    await updateDoc(LIVE_DOC_REF, {
      messages: updatedMessages,
      updatedAt: serverTimestamp(),
    });

    cachedState = { ...cachedState, messages: updatedMessages };
    return { success: true };
  } catch (error: any) {
    console.error('Failed to reply to student message:', error);
    throw error;
  }
}

// Teacher deletes a specific student message
export async function deleteStudentMessage(messageId: string): Promise<{ success: boolean }> {
  try {
    const currentMessages = cachedState.messages || [];
    const updatedMessages = currentMessages.filter((m) => m.id !== messageId);

    await updateDoc(LIVE_DOC_REF, {
      messages: updatedMessages,
      updatedAt: serverTimestamp(),
    });

    cachedState = { ...cachedState, messages: updatedMessages };
    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete student message:', error);
    throw error;
  }
}

// Teacher clears all student messages
export async function clearAllStudentMessages(): Promise<{ success: boolean }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      messages: [],
      updatedAt: serverTimestamp(),
    });

    cachedState = { ...cachedState, messages: [] };
    return { success: true };
  } catch (error: any) {
    console.error('Failed to clear student messages:', error);
    throw error;
  }
}

// Teacher sends a broadcast message or direct private message to a specific student
export async function sendTeacherBroadcastMessage(payload: {
  text: string;
  recipientStudent?: string; // If empty, public broadcast to all
  recipientSheet?: string;
}): Promise<{ success: boolean; messageId: string }> {
  try {
    const isPrivate = Boolean(payload.recipientStudent && payload.recipientStudent.trim());
    const cleanText = payload.text.trim();
    const newMessage: LiveStudentMessage = {
      id: `teach_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderName: isPrivate ? (payload.recipientStudent?.trim() || 'المشترك') : 'الأستاذ 👨‍🏫',
      sheetNumber: payload.recipientSheet?.trim() || '',
      type: 'question',
      text: isPrivate ? `رسالة خاصة من الأستاذ: ${cleanText}` : cleanText,
      createdAt: Date.now(),
    };

    const currentMessages = cachedState.messages || [];
    const updatedMessages = [...currentMessages.slice(-99), newMessage];

    await updateDoc(LIVE_DOC_REF, {
      messages: updatedMessages,
      updatedAt: serverTimestamp(),
    });

    cachedState = { ...cachedState, messages: updatedMessages };
    return { success: true, messageId: newMessage.id };
  } catch (error: any) {
    console.error('Failed to send teacher broadcast message:', error);
    throw error;
  }
}

// Toggle showing chat / messages on projector display screen
export async function toggleShowChatInRoom(show: boolean): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      showChatInRoom: show,
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, showChatInRoom: show };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to toggle showChatInRoom in Firebase:', error);
    return { success: false };
  }
}

// Toggle showing connected students badge on projector display screen
export async function toggleShowConnectedCountInRoom(show: boolean): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      showConnectedCountInRoom: show,
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, showConnectedCountInRoom: show };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to toggle showConnectedCountInRoom in Firebase:', error);
    return { success: false };
  }
}

// Toggle or update PDF presentation in projector display room
export async function updateLivePdfState({
  showPdfInRoom,
  pdfUrl,
  pdfTitle,
  pdfPage,
  pdfTotalPages,
  pdfFitMode,
  pdfZoom,
}: {
  showPdfInRoom?: boolean;
  pdfUrl?: string;
  pdfTitle?: string;
  pdfPage?: number;
  pdfTotalPages?: number;
  pdfFitMode?: 'contain' | 'width';
  pdfZoom?: number;
}): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    const updatePayload: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };
    if (showPdfInRoom !== undefined) updatePayload.showPdfInRoom = showPdfInRoom;
    if (pdfUrl !== undefined) updatePayload.pdfUrl = pdfUrl;
    if (pdfTitle !== undefined) updatePayload.pdfTitle = pdfTitle;
    if (pdfPage !== undefined) updatePayload.pdfPage = pdfPage;
    if (pdfTotalPages !== undefined) updatePayload.pdfTotalPages = pdfTotalPages;
    if (pdfFitMode !== undefined) updatePayload.pdfFitMode = pdfFitMode;
    if (pdfZoom !== undefined) updatePayload.pdfZoom = pdfZoom;

    await updateDoc(LIVE_DOC_REF, updatePayload);
    cachedState = {
      ...cachedState,
      ...(showPdfInRoom !== undefined ? { showPdfInRoom } : {}),
      ...(pdfUrl !== undefined ? { pdfUrl } : {}),
      ...(pdfTitle !== undefined ? { pdfTitle } : {}),
      ...(pdfPage !== undefined ? { pdfPage } : {}),
      ...(pdfTotalPages !== undefined ? { pdfTotalPages } : {}),
      ...(pdfFitMode !== undefined ? { pdfFitMode } : {}),
      ...(pdfZoom !== undefined ? { pdfZoom } : {}),
    };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to update live PDF state in Firebase:', error);
    return { success: false };
  }
}

export async function toggleShowPdfInRoom(show: boolean): Promise<{ success: boolean; state?: LiveSessionState }> {
  return updateLivePdfState({ showPdfInRoom: show });
}

// Realtime sync of laser pointer or live pen tip (debounced/throttled on caller side)
export async function updateLivePdfLaser(laser: { x: number; y: number; active: boolean; timestamp: number; tool?: 'laser' | 'pen' | 'highlighter'; color?: string } | null): Promise<{ success: boolean }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      pdfLaser: laser,
    });
    cachedState = { ...cachedState, pdfLaser: laser };
    return { success: true };
  } catch (error: any) {
    return { success: false };
  }
}

// Realtime sync of drawings/annotations per page
export async function updateLivePdfAnnotations(
  annotations: Record<number, Array<{
    type: 'pen' | 'highlighter';
    color: string;
    width: number;
    points: Array<{ x: number; y: number }>;
  }>>
): Promise<{ success: boolean }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      pdfAnnotations: annotations,
    });
    cachedState = { ...cachedState, pdfAnnotations: annotations };
    return { success: true };
  } catch (error: any) {
    console.error('Failed to update pdfAnnotations in Firebase:', error);
    return { success: false };
  }
}

// ==========================================
// --- REAL-TIME LIVE QUIZ / CHALLENGE ARENA ---
// ==========================================

export async function openLiveQuizLobby(config: {
  title: string;
  questions: QuizQuestionItem[];
  timerDurationSeconds: number;
  shuffleQuestions: boolean;
  showInstantFeedback: boolean;
  allowRetryWrong: boolean;
  podiumCount: number;
}): Promise<{ success: boolean; quizState?: QuizActiveState }> {
  try {
    const quizState: QuizActiveState = {
      isActive: true,
      quizStatus: 'waiting', // Waiting in Lobby with students chart!
      quizTitle: config.title || 'مسابقة التحدي التفاعلي',
      questions: config.questions || [],
      timerDurationSeconds: config.timerDurationSeconds || 0,
      startTime: null,
      endTime: null,
      shuffleQuestions: Boolean(config.shuffleQuestions),
      showInstantFeedback: Boolean(config.showInstantFeedback),
      allowRetryWrong: Boolean(config.allowRetryWrong),
      podiumCount: config.podiumCount || 3,
      participants: {},
    };

    await updateDoc(LIVE_DOC_REF, {
      quizState,
      updatedAt: serverTimestamp(),
    });

    cachedState = { ...cachedState, quizState };
    return { success: true, quizState };
  } catch (err: any) {
    console.error('Failed to open live quiz lobby:', err);
    return { success: false };
  }
}

export async function launchLiveQuizQuestions(): Promise<{ success: boolean }> {
  try {
    if (!cachedState.quizState) return { success: false };
    const currentQuiz = { ...cachedState.quizState };
    currentQuiz.quizStatus = 'in_progress';
    currentQuiz.startTime = Date.now();
    currentQuiz.endTime = currentQuiz.timerDurationSeconds > 0
      ? Date.now() + (currentQuiz.timerDurationSeconds * 1000)
      : null;

    await updateDoc(LIVE_DOC_REF, {
      quizState: currentQuiz,
      updatedAt: serverTimestamp(),
    });

    cachedState = { ...cachedState, quizState: currentQuiz };
    return { success: true };
  } catch (err: any) {
    console.error('Failed to launch live quiz questions:', err);
    return { success: false };
  }
}

export async function startLiveQuiz(config: {
  title: string;
  questions: QuizQuestionItem[];
  timerDurationSeconds: number;
  shuffleQuestions: boolean;
  showInstantFeedback: boolean;
  allowRetryWrong: boolean;
  podiumCount: number;
  initialStatus?: 'waiting' | 'in_progress';
}): Promise<{ success: boolean; quizState?: QuizActiveState }> {
  try {
    const status = config.initialStatus || 'in_progress';
    const now = Date.now();
    const quizState: QuizActiveState = {
      isActive: true,
      quizStatus: status,
      quizTitle: config.title || 'مسابقة التحدي التفاعلي',
      questions: config.questions || [],
      timerDurationSeconds: config.timerDurationSeconds || 0,
      startTime: status === 'in_progress' ? now : null,
      endTime: (status === 'in_progress' && config.timerDurationSeconds > 0)
        ? now + (config.timerDurationSeconds * 1000)
        : null,
      shuffleQuestions: Boolean(config.shuffleQuestions),
      showInstantFeedback: Boolean(config.showInstantFeedback),
      allowRetryWrong: Boolean(config.allowRetryWrong),
      podiumCount: config.podiumCount || 3,
      participants: {},
    };

    await updateDoc(LIVE_DOC_REF, {
      quizState,
      updatedAt: serverTimestamp(),
    });

    cachedState = { ...cachedState, quizState };
    return { success: true, quizState };
  } catch (err: any) {
    console.error('Failed to start live quiz:', err);
    return { success: false };
  }
}

export async function launchActiveQuiz(): Promise<{ success: boolean }> {
  try {
    const snap = await getDoc(LIVE_DOC_REF);
    if (!snap.exists()) return { success: false };
    const data = snap.data() as any;
    const currentQuiz = data.quizState as QuizActiveState;
    if (!currentQuiz || !currentQuiz.isActive) return { success: false };

    const now = Date.now();
    const duration = currentQuiz.timerDurationSeconds || 0;
    const updatedQuiz: QuizActiveState = {
      ...currentQuiz,
      quizStatus: 'in_progress',
      startTime: now,
      endTime: duration > 0 ? now + (duration * 1000) : null,
    };

    await updateDoc(LIVE_DOC_REF, {
      quizState: updatedQuiz,
      updatedAt: serverTimestamp(),
    });

    cachedState = { ...cachedState, quizState: updatedQuiz };
    return { success: true };
  } catch (err: any) {
    console.error('Failed to launch active quiz:', err);
    return { success: false };
  }
}

export async function updateLiveQuizSettings(
  settings: Partial<QuizActiveState>
): Promise<{ success: boolean }> {
  try {
    if (!cachedState.quizState) return { success: false };
    const updatedQuiz = { ...cachedState.quizState, ...settings };
    await updateDoc(LIVE_DOC_REF, {
      quizState: updatedQuiz,
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, quizState: updatedQuiz };
    return { success: true };
  } catch (err: any) {
    console.error('Failed to update quiz settings:', err);
    return { success: false };
  }
}

export async function joinQuizLobby(
  studentKey: string,
  payload: {
    username: string;
    studentName?: string;
    sheetNumber: string;
  }
): Promise<{ success: boolean }> {
  try {
    const snap = await getDoc(LIVE_DOC_REF);
    if (!snap.exists()) return { success: false };
    const data = snap.data() as any;
    const currentQuiz = data.quizState as QuizActiveState;
    if (!currentQuiz || !currentQuiz.isActive) return { success: false };

    const participants = { ...(currentQuiz.participants || {}) };
    const totalQ = currentQuiz.questions?.length || 1;

    if (!participants[studentKey]) {
      participants[studentKey] = {
        studentKey,
        username: payload.username,
        studentName: payload.studentName || payload.username,
        sheetNumber: payload.sheetNumber,
        currentQuestionIndex: 0,
        answers: {},
        totalScore: 0,
        correctCount: 0,
        wrongCount: 0,
        totalQuestions: totalQ,
        streak: 0,
        isFinished: false,
        totalTimeTaken: 0,
        wrongQuestionIndices: [],
      };
    }

    const updatedQuiz: QuizActiveState = {
      ...currentQuiz,
      participants,
    };

    await updateDoc(LIVE_DOC_REF, {
      quizState: updatedQuiz,
      updatedAt: serverTimestamp(),
    });

    cachedState = { ...cachedState, quizState: updatedQuiz };
    return { success: true };
  } catch (err: any) {
    console.error('Failed to join quiz lobby:', err);
    return { success: false };
  }
}

export async function endLiveQuiz(): Promise<{ success: boolean }> {
  try {
    if (!cachedState.quizState) return { success: false };
    const currentQuiz = { ...cachedState.quizState };
    currentQuiz.quizStatus = 'ended';

    const totalQ = currentQuiz.questions?.length || 1;
    const participantsList = Object.values(currentQuiz.participants || {});

    // For any student who hasn't completed, mark their remaining unanswered questions as wrong
    participantsList.forEach((p) => {
      const answeredCount = Object.keys(p.answers || {}).length;
      if (!p.isFinished) {
        p.isFinished = true;
        const remainingUnanswered = Math.max(0, totalQ - answeredCount);
        p.wrongCount = (p.wrongCount || 0) + remainingUnanswered;
      }
    });

    // Calculate final ranks
    participantsList.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return (a.totalTimeTaken || 99999) - (b.totalTimeTaken || 99999);
    });

    participantsList.forEach((p, index) => {
      if (currentQuiz.participants[p.studentKey]) {
        currentQuiz.participants[p.studentKey].rank = index + 1;
      }
    });

    await updateDoc(LIVE_DOC_REF, {
      quizState: currentQuiz,
      updatedAt: serverTimestamp(),
    });

    cachedState = { ...cachedState, quizState: currentQuiz };
    return { success: true };
  } catch (err: any) {
    console.error('Failed to end live quiz:', err);
    return { success: false };
  }
}

export async function resetLiveQuiz(): Promise<{ success: boolean }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      quizState: null,
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, quizState: null };
    return { success: true };
  } catch (err: any) {
    console.error('Failed to reset live quiz:', err);
    return { success: false };
  }
}

export async function submitStudentQuizAnswer(
  studentKey: string,
  payload: {
    username: string;
    studentName?: string;
    sheetNumber: string;
    questionIndex: number;
    questionText: string;
    answer: string;
    isCorrect: boolean;
    timeTaken: number;
    isRetry?: boolean;
    totalQuizQuestions: number;
  }
): Promise<{ success: boolean }> {
  try {
    const snap = await getDoc(LIVE_DOC_REF);
    if (!snap.exists()) return { success: false };
    const data = snap.data() as any;
    const currentQuiz: QuizActiveState = data.quizState;
    if (!currentQuiz || !currentQuiz.isActive) return { success: false };

    const participants = { ...(currentQuiz.participants || {}) };
    let student = participants[studentKey];
    // Calculate true total questions from quizState or payload
    const quizCount = Array.isArray(currentQuiz.questions) ? currentQuiz.questions.length : 0;
    const payloadCount = typeof payload.totalQuizQuestions === 'number' ? payload.totalQuizQuestions : 0;
    const studentCount = typeof student?.totalQuestions === 'number' ? student.totalQuestions : 0;
    const effectiveTotal = Math.max(quizCount, payloadCount, studentCount, 1);

    if (!student) {
      student = {
        studentKey,
        username: payload.username,
        studentName: payload.studentName || payload.username,
        sheetNumber: payload.sheetNumber,
        currentQuestionIndex: 0,
        answers: {},
        totalScore: 0,
        correctCount: 0,
        wrongCount: 0,
        totalQuestions: effectiveTotal,
        streak: 0,
        isFinished: false,
        totalTimeTaken: 0,
        wrongQuestionIndices: [],
      };
    } else {
      if (effectiveTotal > student.totalQuestions) {
        student.totalQuestions = effectiveTotal;
      }
    }

    // Points calculation (Quizizz / Kahoot style)
    let points = 0;
    let newStreak = student.streak || 0;

    if (payload.isCorrect) {
      newStreak += 1;
      const basePoints = 1000;
      // Speed bonus: up to 500 bonus points for fast responses (decay within 30s)
      const speedBonus = Math.max(0, Math.round((30 - Math.min(payload.timeTaken, 30)) * 16.6));
      // Streak bonus: 100 points for streak 2, 200 for streak 3, up to 500
      const streakBonus = Math.min((newStreak - 1) * 100, 500);
      points = payload.isRetry ? 500 : (basePoints + speedBonus + streakBonus);
    } else {
      newStreak = 0;
      points = 0;
    }

    const answerDetail: QuizStudentAnswerDetail = {
      questionIndex: payload.questionIndex,
      questionText: payload.questionText,
      answer: payload.answer,
      isCorrect: payload.isCorrect,
      timeTaken: payload.timeTaken,
      scoreEarned: points,
      isRetry: payload.isRetry,
    };

    const updatedAnswers = { ...(student.answers || {}) };
    updatedAnswers[payload.questionIndex] = answerDetail;

    let updatedWrong = [...(student.wrongQuestionIndices || [])];
    if (!payload.isCorrect) {
      if (!updatedWrong.includes(payload.questionIndex)) {
        updatedWrong.push(payload.questionIndex);
      }
    } else if (payload.isRetry) {
      // Solved correctly on retry!
      updatedWrong = updatedWrong.filter(idx => idx !== payload.questionIndex);
    }

    const newCorrectCount = Object.values(updatedAnswers).filter((a: any) => a.isCorrect).length;
    const newWrongCount = updatedWrong.length;
    const newTotalScore = Math.max(0, (student.totalScore || 0) + points);
    const newTotalTime = (student.totalTimeTaken || 0) + payload.timeTaken;
    const nextQIndex = payload.isRetry ? student.currentQuestionIndex : (student.currentQuestionIndex + 1);
    
    // Only mark finished if all questions have truly been answered
    const totalAnswered = Object.keys(updatedAnswers).length;
    const isNowFinished = !payload.isRetry && (effectiveTotal > 1 ? totalAnswered >= effectiveTotal : (quizCount === 1 && totalAnswered >= 1));

    student = {
      ...student,
      currentQuestionIndex: nextQIndex,
      answers: updatedAnswers,
      totalScore: newTotalScore,
      streak: newStreak,
      correctCount: newCorrectCount,
      wrongCount: newWrongCount,
      totalTimeTaken: newTotalTime,
      wrongQuestionIndices: updatedWrong,
      isFinished: isNowFinished,
      finishTime: (isNowFinished && !student.finishTime) ? Date.now() : (isNowFinished ? student.finishTime : undefined),
    };

    participants[studentKey] = student;

    // Recalculate live leaderboard ranks
    const allParticipants = Object.values(participants);
    allParticipants.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return (a.totalTimeTaken || 99999) - (b.totalTimeTaken || 99999);
    });

    allParticipants.forEach((p, idx) => {
      if (participants[p.studentKey]) {
        participants[p.studentKey].rank = idx + 1;
      }
    });

    currentQuiz.participants = participants;

    await updateDoc(LIVE_DOC_REF, {
      quizState: currentQuiz,
      updatedAt: serverTimestamp(),
    });

    cachedState = { ...cachedState, quizState: currentQuiz };
    return { success: true };
  } catch (err: any) {
    console.error('Failed to submit student quiz answer:', err);
    return { success: false };
  }
}

export async function markStudentQuizFinished(studentKey: string): Promise<{ success: boolean }> {
  try {
    if (!cachedState.quizState) return { success: false };
    const currentQuiz = { ...cachedState.quizState };
    if (currentQuiz.participants && currentQuiz.participants[studentKey]) {
      currentQuiz.participants[studentKey].isFinished = true;
      currentQuiz.participants[studentKey].finishTime = Date.now();
      await updateDoc(LIVE_DOC_REF, {
        quizState: currentQuiz,
        updatedAt: serverTimestamp(),
      });
      cachedState = { ...cachedState, quizState: currentQuiz };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Failed to mark quiz finished:', err);
    return { success: false };
  }
}

export async function setStudentQuizRetryMode(studentKey: string, inRetry: boolean): Promise<{ success: boolean }> {
  try {
    if (!cachedState.quizState) return { success: false };
    const currentQuiz = { ...cachedState.quizState };
    if (currentQuiz.participants && currentQuiz.participants[studentKey]) {
      currentQuiz.participants[studentKey].isInRetryRound = inRetry;
      await updateDoc(LIVE_DOC_REF, {
        quizState: currentQuiz,
        updatedAt: serverTimestamp(),
      });
      cachedState = { ...cachedState, quizState: currentQuiz };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Failed to toggle retry mode:', err);
    return { success: false };
  }
}




