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
  LiveStudentAnswerSubmission 
} from '../types';

const LIVE_DOC_REF = doc(db, 'live_sessions', 'main');

export const defaultLiveSessionState: LiveSessionState = {
  sessionId: 'live-main',
  sessionPin: '1234',
  isProgramActive: false,
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
        const state: LiveSessionState = {
          sessionId: data.sessionId || 'live-main',
          sessionPin: data.sessionPin || '1234',
          isProgramActive: Boolean(data.isProgramActive),
          lessonTitle: data.lessonTitle || '',
          videoUrl: data.videoUrl || '',
          status: data.status || 'idle',
          currentQuestionIndex: data.currentQuestionIndex !== undefined ? data.currentQuestionIndex : null,
          currentQuestion: data.currentQuestion || null,
          questionTriggeredAt: data.questionTriggeredAt || null,
          timeLimit: data.timeLimit || 30,
          showResult: data.showResult || 'نعم',
          connectedStudents: Array.isArray(data.connectedStudents) ? data.connectedStudents : [],
          answersForCurrentQuestion: data.answersForCurrentQuestion || {},
          allSessionAnswers: data.allSessionAnswers || {},
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
      const state: LiveSessionState = {
        sessionId: data.sessionId || 'live-main',
        sessionPin: data.sessionPin || '1234',
        isProgramActive: Boolean(data.isProgramActive),
        lessonTitle: data.lessonTitle || '',
        videoUrl: data.videoUrl || '',
        status: data.status || 'idle',
        currentQuestionIndex: data.currentQuestionIndex !== undefined ? data.currentQuestionIndex : null,
        currentQuestion: data.currentQuestion || null,
        questionTriggeredAt: data.questionTriggeredAt || null,
        timeLimit: data.timeLimit || 30,
        showResult: data.showResult || 'نعم',
        connectedStudents: Array.isArray(data.connectedStudents) ? data.connectedStudents : [],
        answersForCurrentQuestion: data.answersForCurrentQuestion || {},
        allSessionAnswers: data.allSessionAnswers || {},
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

    if (!currentState.isProgramActive) {
      return { 
        success: false, 
        error: 'البرنامج المباشر مغلق حالياً من قِبل المعلم. يرجى الانتظار حتى يبدأ المعلم البرنامج.' 
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

// Teacher initializes a lesson theater
export async function initLiveSession(payload: {
  lessonTitle: string;
  videoUrl: string;
  timeLimit?: number;
  showResult?: 'نعم' | 'لا';
}): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    const update: Partial<LiveSessionState> = {
      lessonTitle: payload.lessonTitle,
      videoUrl: payload.videoUrl,
      timeLimit: payload.timeLimit ?? 30,
      showResult: payload.showResult ?? 'نعم',
      status: 'waiting',
      currentQuestionIndex: null,
      currentQuestion: null,
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
    console.error('Failed to init live lesson:', error);
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
}): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    const state = await getLiveSessionState() || cachedState;
    const currentAnswers = { ...(state.answersForCurrentQuestion || {}) };
    const allAnswers = { ...(state.allSessionAnswers || {}) };

    const cleanUser = String(payload.username || '').trim();
    let cleanSheet = String(payload.sheetNumber || '').trim();

    // If student submitted without sheetNumber, recover from connectedStudents
    if (!cleanSheet) {
      const match = (state.connectedStudents || []).find(
        (s) => String(s.username || '').trim().toLowerCase() === cleanUser.toLowerCase()
      );
      if (match && match.sheetNumber) {
        cleanSheet = String(match.sheetNumber).trim();
      }
    }

    const studentKey = cleanSheet ? `${cleanUser}_${cleanSheet}` : cleanUser;

    const submission: LiveStudentAnswerSubmission = {
      username: cleanUser,
      sheetNumber: cleanSheet,
      answer: String(payload.answer ?? '').trim(),
      isCorrect: payload.isCorrect,
      submittedAt: Date.now(),
    };

    currentAnswers[cleanUser] = submission;
    currentAnswers[studentKey] = submission;

    if (!allAnswers[studentKey]) {
      allAnswers[studentKey] = {};
    }
    allAnswers[studentKey][payload.questionIndex] = String(payload.answer ?? '').trim();

    // If an un-numbered entry existed for this student, merge into studentKey and delete un-numbered key
    if (cleanSheet && allAnswers[cleanUser] && cleanUser !== studentKey) {
      allAnswers[studentKey] = { ...allAnswers[cleanUser], ...allAnswers[studentKey] };
      delete allAnswers[cleanUser];
    }

    await updateDoc(LIVE_DOC_REF, {
      answersForCurrentQuestion: currentAnswers,
      allSessionAnswers: allAnswers,
      updatedAt: serverTimestamp(),
    });

    cachedState = { 
      ...state, 
      answersForCurrentQuestion: currentAnswers, 
      allSessionAnswers: allAnswers 
    };
    return { success: true, state: cachedState };
  } catch (error: any) {
    console.error('Failed to submit answer in Firebase:', error);
    throw error;
  }
}

// Teacher reveals correct answer
export async function revealLiveAnswer(): Promise<{ success: boolean; state?: LiveSessionState }> {
  try {
    await updateDoc(LIVE_DOC_REF, {
      status: 'revealed',
      updatedAt: serverTimestamp(),
    });
    cachedState = { ...cachedState, status: 'revealed' };
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
      status: 'finished',
      currentQuestion: null,
      currentQuestionIndex: null,
      answersForCurrentQuestion: {},
    };

    await updateDoc(LIVE_DOC_REF, {
      ...update,
      updatedAt: serverTimestamp(),
    });

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
