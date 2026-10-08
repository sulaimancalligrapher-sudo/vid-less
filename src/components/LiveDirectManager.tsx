import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  MessageSquare,
  Users,
  QrCode,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Trash2,
  Edit,
  Save,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ListVideo,
  Eye,
  EyeOff,
  Flame,
  Award,
  BarChart3,
  Tv,
  X,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  Send,
  Radio,
  Share2,
  Power,
  ShieldAlert,
  Image as ImageIcon,
} from 'lucide-react';
import {
  LiveDirectLessonRow,
  LiveDirectQuestionItem,
  LiveDirectAnswerRecord,
  LiveSessionState,
  evaluateLiveAnswer,
  normalizeArabicText,
} from '../types';
import {
  fetchLiveQuestionsDirect,
  saveLiveLessonDirect,
  fetchLiveAnswersDirect,
  recordLiveAnswersBatchDirect,
  subscribeToLiveSession,
  getLiveSessionState,
  initLiveSession,
  triggerLiveQuestion,
  revealLiveAnswer,
  finishLiveSession,
  resetLiveSession,
  updateLivePin,
  returnToLiveExplanation,
  deleteStudentMessage,
  replyToStudentMessage,
  clearAllStudentMessages,
  sendTeacherBroadcastMessage,
  toggleShowChatInRoom,
  toggleShowPinInRoom,
  toggleShowQrInRoom,
  toggleShowConnectedCountInRoom,
  toggleShowOptionCountsInRoom,
  toggleShowStudentTextAnswersInRoom,
  leaveLiveSession,
  formatSecondsToTime,
  formatDriveImageUrl,
  setupLiveDirectSheetsApi,
  startLiveProgram,
  endLiveProgram,
} from '../api';
import LiveChatModal from './LiveChatModal';

interface LiveDirectManagerProps {
  onOpenDisplayScreen?: () => void;
  onBackToAdmin?: () => void;
}

export default function LiveDirectManager({
  onOpenDisplayScreen,
  onBackToAdmin,
}: LiveDirectManagerProps) {
  // Main tabs: 1- أسئلة الشيت | 2- سجل الإجابات | 3- إعدادات التدريس والتحكم المباشر
  const [activeTab, setActiveTab] = useState<'teaching' | 'questions' | 'answers'>('teaching');

  // Lessons and Answers
  const [lessons, setLessons] = useState<LiveDirectLessonRow[]>([]);
  const [answers, setAnswers] = useState<LiveDirectAnswerRecord[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [searchLessons, setSearchLessons] = useState('');
  const [searchAnswers, setSearchAnswers] = useState('');

  // Real-time Session State
  const [sessionState, setSessionState] = useState<LiveSessionState | null>(null);
  const [selectedLessonTitle, setSelectedLessonTitle] = useState<string>('');
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isRegeneratingPin, setIsRegeneratingPin] = useState(false);
  const [isResettingSession, setIsResettingSession] = useState(false);
  const [isFinishingSession, setIsFinishingSession] = useState(false);
  const [isTogglingProgram, setIsTogglingProgram] = useState(false);
  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Program active state
  const isProgramRunning = Boolean(sessionState?.isProgramActive);

  // Lesson Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LiveDirectLessonRow | null>(null);
  const [isSavingLesson, setIsSavingLesson] = useState(false);

  // Dynamic on-the-fly teacher timer when launching questions (default 30s)
  const [launchTimerDuration, setLaunchTimerDuration] = useState<number>(30);

  // Teaching Active Question preview
  const [previewQuestionIndex, setPreviewQuestionIndex] = useState<number>(0);

  // Room projector visibility update states
  const [isUpdatingPinVisibility, setIsUpdatingPinVisibility] = useState(false);
  const [isUpdatingQrVisibility, setIsUpdatingQrVisibility] = useState(false);
  const [isUpdatingConnectedCountVisibility, setIsUpdatingConnectedCountVisibility] = useState(false);
  const [isUpdatingChatVisibility, setIsUpdatingChatVisibility] = useState(false);
  const [isUpdatingOptionCountsVisibility, setIsUpdatingOptionCountsVisibility] = useState(false);
  const [isUpdatingStudentAnswersVisibility, setIsUpdatingStudentAnswersVisibility] = useState(false);

  // Student list search & Unanswered filter
  const [studentSearch, setStudentSearch] = useState('');
  const [filterUnansweredOnly, setFilterUnansweredOnly] = useState(false);

  // Notice timer
  const showNotice = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotice({ text, type });
    setTimeout(() => setNotice(null), 4000);
  };

  // Load Lessons from Questions-Live
  const loadLessons = async () => {
    setLoadingLessons(true);
    try {
      const data = await fetchLiveQuestionsDirect();
      setLessons(data);
    } catch (err) {
      console.error('Error loading Questions-Live:', err);
      showNotice('تعذر جلب أسئلة ورقة Questions-Live', 'error');
    } finally {
      setLoadingLessons(false);
    }
  };

  // Load Answers from Answers-Live
  const loadAnswers = async () => {
    setLoadingAnswers(true);
    try {
      const data = await fetchLiveAnswersDirect();
      setAnswers(data);
    } catch (err) {
      console.error('Error loading Answers-Live:', err);
      showNotice('تعذر جلب إجابات ورقة Answers-Live', 'error');
    } finally {
      setLoadingAnswers(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadLessons();
    loadAnswers();
  }, []);

  // Listen to Firebase Live Session updates
  useEffect(() => {
    const unsubscribe = subscribeToLiveSession((s) => {
      if (s) {
        setSessionState(s);
      }
    });
    return () => unsubscribe();
  }, []);

  // Filter lessons
  const filteredLessons = useMemo(() => {
    if (!searchLessons.trim()) return lessons;
    const q = searchLessons.trim().toLowerCase();
    return lessons.filter(l => l.title.toLowerCase().includes(q));
  }, [lessons, searchLessons]);

  // Filter answers
  const filteredAnswers = useMemo(() => {
    if (!searchAnswers.trim()) return answers;
    const q = searchAnswers.trim().toLowerCase();
    return answers.filter(a =>
      (a.studentName || a.username || '').toLowerCase().includes(q) ||
      (a.sheetNumber || '').toLowerCase().includes(q) ||
      (a.lessonTitle || '').toLowerCase().includes(q)
    );
  }, [answers, searchAnswers]);

  // Currently active lesson in teaching tab
  const activeLesson = useMemo(() => {
    if (!selectedLessonTitle) return null;
    return lessons.find(l => l.title === selectedLessonTitle) || null;
  }, [lessons, selectedLessonTitle]);

  // Student Join Link and QR
  const effectivePin = sessionState?.sessionPin ? sessionState.sessionPin.trim() : '';
  const studentJoinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?page=live-student${effectivePin ? `&pin=${encodeURIComponent(effectivePin)}` : ''}`
    : '';
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(studentJoinUrl)}`;

  // Copy PIN
  const handleCopyPin = () => {
    if (!effectivePin) return;
    navigator.clipboard.writeText(effectivePin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  // Copy Student Link
  const handleCopyLink = () => {
    if (!studentJoinUrl) return;
    navigator.clipboard.writeText(studentJoinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Regenerate PIN
  const handleRegeneratePin = async () => {
    setIsRegeneratingPin(true);
    try {
      const res = await updateLivePin();
      if (res.success && res.pin) {
        showNotice(`تم توليد رمز حضور جديد: ${res.pin}`, 'success');
      }
    } catch {
      showNotice('فشل توليد رمز جديد', 'error');
    } finally {
      setIsRegeneratingPin(false);
    }
  };

  // Toggle PIN display on projector display room screen
  const handleTogglePinVisibility = async (show: boolean) => {
    setIsUpdatingPinVisibility(true);
    try {
      const res = await toggleShowPinInRoom(show);
      if (res.success && res.state) setSessionState(res.state);
    } catch (e) {
      console.error('Failed to toggle PIN visibility in room:', e);
    } finally {
      setIsUpdatingPinVisibility(false);
    }
  };

  // Toggle QR code display on projector display room screen
  const handleToggleQrVisibility = async (show: boolean) => {
    setIsUpdatingQrVisibility(true);
    try {
      const res = await toggleShowQrInRoom(show);
      if (res.success && res.state) setSessionState(res.state);
    } catch (e) {
      console.error('Failed to toggle QR visibility in room:', e);
    } finally {
      setIsUpdatingQrVisibility(false);
    }
  };

  // Toggle connected students count on projector display room screen
  const handleToggleConnectedCountVisibility = async (show: boolean) => {
    setIsUpdatingConnectedCountVisibility(true);
    try {
      const res = await toggleShowConnectedCountInRoom(show);
      if (res.success && res.state) setSessionState(res.state);
    } catch (e) {
      console.error('Failed to toggle connected count visibility in room:', e);
    } finally {
      setIsUpdatingConnectedCountVisibility(false);
    }
  };

  // Toggle chat modal on projector display room screen
  const handleToggleChatVisibility = async (show: boolean) => {
    setIsUpdatingChatVisibility(true);
    try {
      const res = await toggleShowChatInRoom(show);
      if (res.success && res.state) setSessionState(res.state);
    } catch (e) {
      console.error('Failed to toggle chat visibility in room:', e);
    } finally {
      setIsUpdatingChatVisibility(false);
    }
  };

  // Toggle option vote counts on projector display room screen
  const handleToggleOptionCountsVisibility = async (show: boolean) => {
    setIsUpdatingOptionCountsVisibility(true);
    try {
      const res = await toggleShowOptionCountsInRoom(show);
      if (res.success && res.state) setSessionState(res.state);
    } catch (e) {
      console.error('Failed to toggle option counts visibility:', e);
    } finally {
      setIsUpdatingOptionCountsVisibility(false);
    }
  };

  // Toggle student text answers on projector display room screen
  const handleToggleStudentAnswersVisibility = async (show: boolean) => {
    setIsUpdatingStudentAnswersVisibility(true);
    try {
      const res = await toggleShowStudentTextAnswersInRoom(show);
      if (res.success && res.state) setSessionState(res.state);
    } catch (e) {
      console.error('Failed to toggle student answers visibility:', e);
    } finally {
      setIsUpdatingStudentAnswersVisibility(false);
    }
  };

  // Remove a student from live session
  const handleRemoveStudent = async (username: string, sheetNumber?: string) => {
    if (!confirm(`هل أنت متأكد من حذف الطالب "${username}" من الحصة المباشرة؟`)) return;
    try {
      await leaveLiveSession(username, sheetNumber);
      showNotice(`تم إخراج الطالب ${username} من الحصة بنجاح`, 'info');
    } catch (err: any) {
      console.error('Failed to remove student:', err);
      showNotice('تعذر حذف الطالب', 'error');
    }
  };

  // Reset Session
  const handleResetSession = async () => {
    setIsResettingSession(true);
    try {
      await resetLiveSession();
      showNotice('تم تصفير ذاكرة الحصة بنجاح 🔄', 'info');
    } catch {
      showNotice('فشل تصفير الجلسة', 'error');
    } finally {
      setIsResettingSession(false);
    }
  };

  // Setup / verify sheets in Google Spreadsheet
  const [isSettingUpSheets, setIsSettingUpSheets] = useState(false);
  const handleSetupSheets = async () => {
    setIsSettingUpSheets(true);
    try {
      const res = await setupLiveDirectSheetsApi();
      if (res.success) {
        showNotice(res.message || 'تم تهيئة وتأكيد أوراق Questions-Live و Answers-Live بنجاح في الشيت! ⚡', 'success');
        loadLessons();
        loadAnswers();
      } else {
        showNotice(res.message || 'تعذر تهيئة الأوراق في الشيت', 'error');
      }
    } catch (err: any) {
      showNotice(err.message || 'حدث خطأ أثناء تهيئة الأوراق', 'error');
    } finally {
      setIsSettingUpSheets(false);
    }
  };

  // Program Lifecycle: Start (generates PIN, opens room) / End (expels students, ends session)
  const handleToggleProgram = async () => {
    if (isProgramRunning) {
      setShowEndConfirmModal(true);
      return;
    }

    setIsTogglingProgram(true);
    try {
      const res = await startLiveProgram();
      if (res.success && res.pin) {
        if (selectedLessonTitle) {
          await initLiveSession({
            lessonTitle: selectedLessonTitle,
            mode: 'direct',
            explanationText: `موضوع الحصة: ${selectedLessonTitle}`,
            timeLimit: 30,
            showResult: 'نعم',
          });
        }
        showNotice(`تم بدء الحصة المباشرة بنجاح! رمز الحضور للطلاب هو (${res.pin}) 🚀`, 'success');
      }
    } catch (e: any) {
      console.error('Failed to start live session:', e);
      showNotice('تعذر بدء الحصة: ' + (e?.message || 'خطأ في الاتصال'), 'error');
    } finally {
      setIsTogglingProgram(false);
    }
  };

  // Helper to format answers as 'صح' / 'خطأ' / 'نص' to match Answers-T & Answers-Live structure
  const formatAnswersForAnswersLive = (
    answersMap: Record<number, string>,
    targetQuestions?: LiveDirectQuestionItem[]
  ): Record<number, string> => {
    const formatted: Record<number, string> = {};
    if (targetQuestions && targetQuestions.length > 0) {
      targetQuestions.forEach((q, idx) => {
        const rawAns = answersMap[idx];
        if (rawAns !== undefined && rawAns !== null && String(rawAns).trim() !== '') {
          const strAns = String(rawAns).trim();
          if (q.isTextAnswer) {
            formatted[idx] = strAns;
          } else {
            const norm = normalizeArabicText(strAns);
            if (norm === 'صح' || norm === 'صحيح' || norm === '✓' || norm === 'true') {
              formatted[idx] = 'صح';
            } else if (norm === 'خطا' || norm === 'خاطي' || norm === '✗' || norm === 'false') {
              formatted[idx] = 'خطأ';
            } else {
              const evalRes = evaluateLiveAnswer(q, strAns);
              if (evalRes.isCorrect === true) {
                formatted[idx] = 'صح';
              } else if (evalRes.isCorrect === false) {
                formatted[idx] = 'خطأ';
              } else {
                formatted[idx] = strAns;
              }
            }
          }
        } else {
          formatted[idx] = '';
        }
      });
    } else {
      Object.entries(answersMap).forEach(([idx, val]) => {
        formatted[Number(idx)] = String(val);
      });
    }
    return formatted;
  };

  // Helper to construct complete, deduplicated student answer records from the live session
  const buildDirectAnswerRecords = (): LiveDirectAnswerRecord[] => {
    if (!sessionState) return [];
    const timestamp = new Date().toLocaleString('ar-SA');
    const title = sessionState.lessonTitle || selectedLessonTitle || 'حصة تدريبية مباشرة';
    const currentLesson = lessons.find(l => l.title === title) || activeLesson;
    const allAnswers = { ...(sessionState.allSessionAnswers || {}) };
    const currentAnswers = sessionState.answersForCurrentQuestion || {};
    const currentQIdx = sessionState.currentQuestionIndex;

    // 1. Merge any answers from current active question into allAnswers
    if (currentQIdx !== null && currentQIdx !== undefined && currentAnswers) {
      Object.entries(currentAnswers).forEach(([studentKey, ansSub]) => {
        if (!allAnswers[studentKey]) {
          allAnswers[studentKey] = {};
        }
        const val = typeof ansSub === 'object' && ansSub !== null && 'answer' in ansSub ? ansSub.answer : ansSub;
        if (allAnswers[studentKey][currentQIdx] === undefined && val !== undefined && val !== null && String(val).trim() !== '') {
          allAnswers[studentKey][currentQIdx] = String(val).trim();
        }
      });
    }

    // 2. Build canonical student map from connectedStudents, allAnswers keys, and currentAnswers keys
    const studentMap = new Map<string, { username: string; sheetNumber: string }>();

    // From connectedStudents
    (sessionState.connectedStudents || []).forEach(s => {
      const u = String(s.username || '').trim();
      const num = String(s.sheetNumber || '').trim();
      if (u) {
        studentMap.set(normalizeArabicText(u), { username: u, sheetNumber: num });
      }
    });

    // Helper to extract student identity from keys like "username_sheetNumber" or "username"
    const parseKey = (rawKey: string) => {
      const trimmed = String(rawKey || '').trim();
      if (!trimmed) return null;
      let u = trimmed;
      let num = '';
      if (trimmed.includes('_')) {
        const parts = trimmed.split('_');
        u = parts[0] || '';
        num = parts.slice(1).join('_') || '';
      }
      return { u, num };
    };

    // From allAnswers keys
    Object.keys(allAnswers).forEach(rawKey => {
      const parsed = parseKey(rawKey);
      if (parsed && parsed.u) {
        const key = normalizeArabicText(parsed.u);
        const existing = studentMap.get(key);
        if (!existing) {
          studentMap.set(key, { username: parsed.u, sheetNumber: parsed.num });
        } else if (!existing.sheetNumber && parsed.num) {
          existing.sheetNumber = parsed.num;
        }
      }
    });

    // From currentAnswers keys
    Object.keys(currentAnswers).forEach(rawKey => {
      const parsed = parseKey(rawKey);
      if (parsed && parsed.u) {
        const key = normalizeArabicText(parsed.u);
        const existing = studentMap.get(key);
        if (!existing) {
          studentMap.set(key, { username: parsed.u, sheetNumber: parsed.num });
        } else if (!existing.sheetNumber && parsed.num) {
          existing.sheetNumber = parsed.num;
        }
      }
    });

    // 3. For each unique student, aggregate answers across all variations of keys
    const recordsToSave: LiveDirectAnswerRecord[] = [];

    studentMap.forEach(({ username: u, sheetNumber: sNum }) => {
      const keyNorm = normalizeArabicText(u);
      const studentAnswers: Record<number, string> = {};

      Object.entries(allAnswers).forEach(([rawKey, ansMap]) => {
        const parsed = parseKey(rawKey);
        if (parsed && normalizeArabicText(parsed.u) === keyNorm && ansMap) {
          Object.entries(ansMap).forEach(([qIdx, ansVal]) => {
            if (ansVal !== undefined && ansVal !== null && String(ansVal).trim() !== '') {
              studentAnswers[Number(qIdx)] = String(ansVal).trim();
            }
          });
        }
      });

      // Also ensure current question answer is captured
      if (currentQIdx !== null && currentQIdx !== undefined) {
        Object.entries(currentAnswers).forEach(([rawKey, ansSub]) => {
          const parsed = parseKey(rawKey);
          if (parsed && normalizeArabicText(parsed.u) === keyNorm) {
            const val = typeof ansSub === 'object' && ansSub !== null && 'answer' in ansSub ? ansSub.answer : ansSub;
            if (val !== undefined && val !== null && String(val).trim() !== '' && studentAnswers[currentQIdx] === undefined) {
              studentAnswers[currentQIdx] = String(val).trim();
            }
          }
        });
      }

      if (Object.keys(studentAnswers).length > 0) {
        const formatted = formatAnswersForAnswersLive(studentAnswers, currentLesson?.questions);
        recordsToSave.push({
          timestamp,
          sheetNumber: sNum,
          username: u,
          studentName: u,
          lessonTitle: title,
          answers: formatted,
        });
      }
    });

    return recordsToSave;
  };

  const handleConfirmEndProgram = async () => {
    setShowEndConfirmModal(false);
    setIsTogglingProgram(true);
    try {
      const recordsToSave = buildDirectAnswerRecords();
      let savedCount = 0;

      // Auto-save student answers to Google Sheets Answers-Live
      if (recordsToSave.length > 0) {
        try {
          const res = await recordLiveAnswersBatchDirect(recordsToSave);
          if (res && res.success) {
            savedCount = res.count ?? recordsToSave.length;
            showNotice(`تم توثيق إجابات ${savedCount} طالب في ورقة Answers-Live بنجاح 💾`, 'success');
          } else {
            showNotice(`تنبيه: تعذر الحفظ في Google Sheets: ${res?.message || 'تحقق من الرابط في الإعدادات'}`, 'error');
          }
        } catch (saveErr: any) {
          console.error('Auto-save answers on end session error:', saveErr);
          showNotice(`فشل إرسال الإجابات إلى الشيت: ${saveErr?.message || ''}`, 'error');
        }
      }

      await endLiveProgram();
      await finishLiveSession();
      if (savedCount > 0) {
        showNotice(`تم حفظ إجابات ${savedCount} طالب وإنهاء الحصة المباشرة وتحديث الشاشة بنجاح 🛑`, 'success');
      } else {
        showNotice('تم إنهاء الحصة المباشرة وإغلاق القاعة وتحديث الشاشة بنجاح 🛑', 'success');
      }
      await loadAnswers();
    } catch (e: any) {
      console.error('Failed to end live program:', e);
      showNotice('حدث خطأ أثناء إنهاء الحصة: ' + (e?.message || 'خطأ في الاتصال'), 'error');
    } finally {
      setIsTogglingProgram(false);
    }
  };

  // Dedicated button to save answers to Answers-Live at any time without ending the room
  const handleQuickSaveAnswers = async () => {
    setIsFinishingSession(true);
    try {
      const recordsToSave = buildDirectAnswerRecords();
      if (recordsToSave.length === 0) {
        showNotice('لا توجد إجابات مسجلة من الطلاب لحفظها حالياً', 'info');
        return;
      }
      const res = await recordLiveAnswersBatchDirect(recordsToSave);
      if (res && res.success) {
        const count = res.count ?? recordsToSave.length;
        showNotice(`تم توثيق إجابات ${count} طالب في ورقة Answers-Live بنجاح دون إغلاق الحصة 💾`, 'success');
        await loadAnswers();
      } else {
        showNotice(`تعذر الحفظ في الشيت: ${res?.message || 'خطأ غير معروف'}`, 'error');
      }
    } catch (e: any) {
      console.error('Failed to quick save answers:', e);
      showNotice('فشل حفظ الإجابات: ' + (e?.message || 'خطأ في الاتصال'), 'error');
    } finally {
      setIsFinishingSession(false);
    }
  };

  // Select lesson in teaching control
  const handleSelectLesson = async (title: string) => {
    setSelectedLessonTitle(title);
    setPreviewQuestionIndex(0);
    if (!title) return;

    try {
      await initLiveSession({
        lessonTitle: title,
        mode: 'direct',
        explanationText: `موضوع الحصة: ${title}`,
        timeLimit: 30,
        showResult: 'نعم',
      });
      showNotice(`تم تفعيل موضوع الحصة: ${title} في وضع Live المباشر 🎙️ والقاعة مفتوحة للطلاب!`, 'success');
    } catch (e) {
      console.error('Failed to init direct live session:', e);
    }
  };

  // Launch Question Live with flexible teacher timer
  const handleLaunchQuestion = async (q: LiveDirectQuestionItem, idx: number, customLimit?: number) => {
    if (!activeLesson) return;
    try {
      const timeToUse = customLimit !== undefined ? customLimit : launchTimerDuration;
      await triggerLiveQuestion({
        questionIndex: idx,
        question: {
          index: idx,
          time: 0,
          question: q.question,
          options: q.options || [],
          correctAnswer: q.correctAnswer,
          image: q.image,
          isTextAnswer: q.isTextAnswer,
        },
        timeLimit: timeToUse,
        showResult: 'نعم',
      });
      showNotice(`تم طرح السؤال (${idx + 1}) لجميع الطلاب والشاشة فورياً 🚀`, 'success');
    } catch (e) {
      console.error('Failed to trigger live question:', e);
      showNotice('فشل طرح السؤال للطلاب', 'error');
    }
  };

  // Reveal Answer
  const handleRevealAnswer = async () => {
    try {
      await revealLiveAnswer();
      showNotice('تم كشف الإجابة الصحيحة للطلاب وعلى الشاشة 🌟', 'success');
    } catch (e) {
      console.error('Failed to reveal answer:', e);
    }
  };

  // Return to explanation mode
  const handleReturnToExplanation = async () => {
    try {
      await returnToLiveExplanation({
        explanationText: activeLesson ? `موضوع الحصة: ${activeLesson.title}` : 'استمع وركز مع شرح الأستاذ 🎙️',
      });
      showNotice('تمت العودة لوضع الشرح المباشر (الشاشة وهواتف الطلاب في وضع الاستماع) 🎙️', 'info');
    } catch (e) {
      console.error('Failed to return to explanation:', e);
    }
  };

  // Finish session and save to Answers-Live
  const handleFinishAndSave = () => {
    setShowEndConfirmModal(true);
  };

  // Editor: Open New Lesson
  const handleAddNewLesson = () => {
    setEditingLesson({
      title: '',
      description: '',
      questions: [
        {
          index: 0,
          question: '',
          options: ['خيار 1', 'خيار 2', 'خيار 3', 'خيار 4'],
          correctAnswer: '1',
          timeLimit: 30,
        },
      ],
    });
    setIsEditorOpen(true);
  };

  // Editor: Save Lesson
  const handleSaveLessonForm = async () => {
    if (!editingLesson || !editingLesson.title.trim()) {
      showNotice('يرجى كتابة عنوان أو موضوع الحصة', 'error');
      return;
    }

    setIsSavingLesson(true);
    try {
      const sanitized: LiveDirectLessonRow = {
        ...editingLesson,
        title: editingLesson.title.trim(),
        questions: editingLesson.questions.map((q, idx) => ({
          ...q,
          index: idx,
          question: q.question.trim(),
          timeLimit: q.timeLimit || 30,
        })),
      };

      const res = await saveLiveLessonDirect(sanitized);
      showNotice(res.message || 'تم حفظ الأسئلة في ورقة Questions-Live بنجاح 💾', 'success');
      setIsEditorOpen(false);
      await loadLessons();
    } catch (err: any) {
      showNotice(`فشل الحفظ: ${err?.message || ''}`, 'error');
    } finally {
      setIsSavingLesson(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-100" dir="rtl">
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-amber-600/20 via-slate-900 to-indigo-900/30 border border-amber-500/30 rounded-3xl p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-inner">
            <Mic className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-100">قسم الحصص المباشرة والأسئلة الحية (Live) 🎙️</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-mono font-bold border border-amber-500/30">
                Direct Lecture Mode
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              إلقاء وشرح مباشر بدون فيديو، مع إطلاق الأسئلة التفاعلية في أي لحظة تختارها، مربوط بأوراق الشيت Questions-Live & Answers-Live.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Start / End Live Program Button */}
          <button
            type="button"
            onClick={handleToggleProgram}
            disabled={isTogglingProgram}
            className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
              isProgramRunning
                ? 'bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white shadow-rose-900/30 ring-2 ring-rose-500/50'
                : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-emerald-900/30 ring-2 ring-emerald-500/50 animate-pulse'
            }`}
            title={isProgramRunning ? 'إنهاء الحصة المباشرة وإخراج المشتركين' : 'بدء الحصة المباشرة وتفعيل دخول الطلاب'}
          >
            <Power className={`w-4 h-4 ${isTogglingProgram ? 'animate-spin' : ''}`} />
            <span>
              {isTogglingProgram
                ? 'جارٍ التنفيذ...'
                : isProgramRunning
                ? 'إنهاء الحصة المباشرة 🛑'
                : 'بدء الحصة المباشرة 🚀'}
            </span>
          </button>

          {/* Display screen launch */}
          <button
            type="button"
            onClick={() => {
              if (onOpenDisplayScreen) {
                onOpenDisplayScreen();
              } else {
                window.open('/?page=live-direct-display', '_blank');
              }
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            title="فتح شاشة العرض المخصصة للبروجكتر والمسرح"
          >
            <Tv className="w-4 h-4" />
            <span>فتح شاشة العرض (المسرح) 🖥️</span>
          </button>

          {/* Student Join Link */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
            title="نسخ رابط دخول الطلاب المباشر"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-indigo-400" />}
            <span>{copiedLink ? 'تم نسخ الرابط!' : 'رابط الطلاب'}</span>
          </button>

          {/* QR Code Modal Toggle */}
          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all cursor-pointer border border-slate-700"
            title="عرض رمز QR للدخول"
          >
            <QrCode className="w-4 h-4 text-amber-400" />
          </button>

          {/* Reset Session Memory */}
          <button
            type="button"
            onClick={handleResetSession}
            disabled={isResettingSession}
            className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-all cursor-pointer border border-rose-500/20"
            title="تصفير ذاكرة الحصة 🔄"
          >
            <RefreshCw className={`w-4 h-4 ${isResettingSession ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notice alert banner */}
      {notice && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between border shadow-lg ${
            notice.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : notice.type === 'error'
              ? 'bg-rose-950/80 border-rose-500/40 text-rose-200'
              : 'bg-indigo-950/80 border-indigo-500/40 text-indigo-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice.text}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* 3 Main Tabs: 1- إعدادات التدريس | 2- الأسئلة | 3- سجل الإجابات */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('teaching')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border ${
            activeTab === 'teaching'
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>3. إعدادات التدريس والتحكم المباشر 🎙️</span>
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border ${
            activeTab === 'questions'
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>1. قسم إعدادات الأسئلة (Questions-Live)</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-950/40 text-[10px] font-mono">
            {lessons.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('answers')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border ${
            activeTab === 'answers'
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>2. قسم سجل الإجابات (Answers-Live)</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-950/40 text-[10px] font-mono">
            {answers.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TEACHING CONTROL (غرفة قيادة المعلم المباشرة) */}
      {/* ========================================================================= */}
      {activeTab === 'teaching' && (
        <div className="space-y-4">
          {/* Program Lifecycle Status Banner */}
          {!isProgramRunning ? (
            <div className="p-4 bg-gradient-to-r from-rose-950/70 via-slate-900 to-rose-950/70 border-2 border-rose-500/40 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                  <Power className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-rose-200 flex items-center gap-2">
                    <span>الحصة المباشرة متوقفة حالياً (مغلقة أمام دخول الطلاب)</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping inline-block" />
                  </h4>
                  <p className="text-xs text-slate-300 mt-1">
                    الطلاب لن يتمكنوا من الدخول برمز الحضور حتى تضغط على زر <b>بدء الحصة المباشرة 🚀</b> لتفعيل الجلسة وتوليد رمز الحضور (PIN).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleProgram}
                disabled={isTogglingProgram}
                className="w-full md:w-auto px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <Power className={`w-4 h-4 ${isTogglingProgram ? 'animate-spin' : ''}`} />
                <span>{isTogglingProgram ? 'جارٍ البدء...' : 'بدء الحصة المباشرة الآن 🚀'}</span>
              </button>
            </div>
          ) : (
            <div className="p-4 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-emerald-950/70 border-2 border-emerald-500/40 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                  <span className="w-4 h-4 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-emerald-200">
                      الحصة المباشرة نشطة والباب مفتوح للطلاب! 🟢
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold font-mono">
                      LIVE ACTIVE
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    بإمكان الطلاب الآن الانضمام فورياً عبر رمز PIN: <b className="font-mono text-amber-300 text-sm px-1.5 py-0.5 bg-slate-950 rounded border border-amber-500/30">{sessionState?.sessionPin}</b> أو عبر مسح رمز QR.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
                <div className="flex items-center gap-1 bg-slate-900 border border-amber-500/30 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    className="px-2.5 py-1 text-amber-400 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer hover:text-amber-300"
                    title="معاينة رمز QR"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>رمز QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleQrVisibility(!sessionState?.showQrInRoom)}
                    disabled={isUpdatingQrVisibility}
                    title={sessionState?.showQrInRoom ? 'إخفاء رمز QR من شاشة العرض' : 'إظهار رمز QR في شاشة العرض'}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer border ${
                      sessionState?.showQrInRoom
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                    }`}
                  >
                    {sessionState?.showQrInRoom ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleToggleProgram}
                  disabled={isTogglingProgram}
                  className="px-4 py-2 bg-rose-600/30 hover:bg-rose-600 border border-rose-500/40 text-rose-200 hover:text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <Power className="w-4 h-4" />
                  <span>إنهاء الحصة 🛑</span>
                </button>
              </div>
            </div>
          )}

          {/* Session Overview Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Lesson Picker */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-bold text-slate-300">موضوع الحصة المباشرة:</span>
                <select
                  value={selectedLessonTitle}
                  onChange={(e) => handleSelectLesson(e.target.value)}
                  className="bg-slate-950 border border-slate-700 hover:border-amber-400 text-slate-100 text-xs font-bold rounded-xl px-3 py-2 outline-none cursor-pointer focus:border-amber-400 transition-colors min-w-[240px]"
                >
                  <option value="">-- اختر درس أو موضوع الحصة للبدء --</option>
                  {lessons.map((l, i) => (
                    <option key={i} value={l.title}>
                      {l.title} ({l.questions?.length || 0} أسئلة)
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Chips with Eye toggles */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* PIN Badge with Eye toggle (افتراضياً مخفي عن شاشة العرض) */}
                {sessionState?.sessionPin && (
                  <div className="flex items-center gap-1.5 bg-slate-950 border border-amber-500/30 px-2.5 py-1.5 rounded-xl font-mono text-xs">
                    <span className="text-slate-400">PIN:</span>
                    <span className="font-bold text-amber-300">{sessionState.sessionPin}</span>
                    <button onClick={handleCopyPin} title="نسخ الرمز" className="p-1 hover:text-amber-400">
                      {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={handleRegeneratePin} title="توليد رمز جديد" className="p-1 hover:text-amber-400">
                      <RefreshCw className={`w-3.5 h-3.5 ${isRegeneratingPin ? 'animate-spin' : ''}`} />
                    </button>
                    {/* أيقونة العين لإظهار/إخفاء الرمز في شاشة العرض */}
                    <button
                      type="button"
                      onClick={() => handleTogglePinVisibility(!sessionState?.showPinInRoom)}
                      disabled={isUpdatingPinVisibility}
                      title={sessionState?.showPinInRoom ? 'إخفاء الرمز من شاشة العرض' : 'إظهار الرمز في شاشة العرض'}
                      className={`p-1 rounded-lg transition-all cursor-pointer border ${
                        sessionState?.showPinInRoom
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                      }`}
                    >
                      {sessionState?.showPinInRoom ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}

                {/* QR Code Button with Eye toggle (افتراضياً مخفي عن شاشة العرض) */}
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 p-1 rounded-xl shadow-sm">
                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    title="معاينة رمز QR"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>رمز QR</span>
                  </button>
                  {/* أيقونة العين لإظهار/إخفاء رمز QR في شاشة العرض */}
                  <button
                    type="button"
                    onClick={() => handleToggleQrVisibility(!sessionState?.showQrInRoom)}
                    disabled={isUpdatingQrVisibility}
                    title={sessionState?.showQrInRoom ? 'إخفاء رمز QR من شاشة العرض' : 'إظهار رمز QR في شاشة العرض'}
                    className={`p-1 rounded-lg transition-all cursor-pointer border ${
                      sessionState?.showQrInRoom
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                    }`}
                  >
                    {sessionState?.showQrInRoom ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Connected Students Counter with Eye toggle (افتراضياً مخفي عن شاشة العرض) */}
                <div className="flex items-center gap-1.5 bg-slate-950 border border-indigo-500/30 p-1 rounded-xl shadow-sm">
                  <div className="px-2 py-0.5 text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>المتصلون: {(sessionState?.connectedStudents || []).length}</span>
                  </div>
                  {/* أيقونة العين لإظهار/إخفاء عدد المتصلين في شاشة العرض */}
                  <button
                    type="button"
                    onClick={() => handleToggleConnectedCountVisibility(!sessionState?.showConnectedCountInRoom)}
                    disabled={isUpdatingConnectedCountVisibility}
                    title={sessionState?.showConnectedCountInRoom ? 'إخفاء عدد المتصلين من شاشة العرض' : 'إظهار عدد المتصلين في شاشة العرض'}
                    className={`p-1 rounded-lg transition-all cursor-pointer border ${
                      sessionState?.showConnectedCountInRoom
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                    }`}
                  >
                    {sessionState?.showConnectedCountInRoom ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Chat Modal Button with Eye toggle (افتراضياً مخفي عن شاشة العرض) */}
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 p-1 rounded-xl shadow-sm">
                  <button
                    type="button"
                    onClick={() => setShowChatModal(true)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 border border-indigo-500/40 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>المحادثة</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono">
                      {(sessionState?.messages || []).length}
                    </span>
                  </button>
                  {/* أيقونة العين لإظهار/إخفاء المحادثة في شاشة العرض */}
                  <button
                    type="button"
                    onClick={() => handleToggleChatVisibility(!sessionState?.showChatInRoom)}
                    disabled={isUpdatingChatVisibility}
                    title={sessionState?.showChatInRoom ? 'إخفاء المحادثة من شاشة العرض' : 'إظهار المحادثة في شاشة العرض'}
                    className={`p-1 rounded-lg transition-all cursor-pointer border ${
                      sessionState?.showChatInRoom
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                    }`}
                  >
                    {sessionState?.showChatInRoom ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Current State Live Monitor Bar */}
            <div className={`p-4 rounded-2xl border transition-all ${
              sessionState?.status === 'question_active'
                ? 'bg-amber-950/30 border-amber-500/50 shadow-lg shadow-amber-500/10 animate-pulse'
                : sessionState?.status === 'revealed'
                ? 'bg-emerald-950/30 border-emerald-500/50'
                : 'bg-slate-950/60 border-slate-800'
            }`}>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                    sessionState?.status === 'question_active'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : sessionState?.status === 'revealed'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'bg-slate-800 text-slate-300'
                  }`}>
                    {sessionState?.status === 'question_active' ? 'سؤال' : sessionState?.status === 'revealed' ? 'كشف' : 'شرح'}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-100">
                      {sessionState?.status === 'question_active'
                        ? `السؤال الحالي معروض للطلاب: س${(sessionState.currentQuestionIndex ?? 0) + 1}`
                        : sessionState?.status === 'revealed'
                        ? 'تم كشف الإجابة الصحيحة للطلاب وعلى شاشة العرض ✨'
                        : 'وضع الشرح المباشر نشط 🎙️ (شاشة العرض وهواتف الطلاب في وضع الاستماع ومتابعة الشرح)'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {sessionState?.status === 'question_active'
                        ? `${Object.keys(sessionState?.answersForCurrentQuestion || {}).length} طالب أجابوا حتى الآن`
                        : 'يمكنك إطلاق أي سؤال من القائمة أدناه بنقرة واحدة في أي وقت'}
                    </p>
                  </div>
                </div>

                {/* Instant Actions while question is active */}
                <div className="flex items-center gap-2 flex-wrap">
                  {sessionState?.status === 'question_active' && (
                    <button
                      type="button"
                      onClick={handleRevealAnswer}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>كشف الإجابة الصحيحة 🌟</span>
                    </button>
                  )}

                  {(sessionState?.status === 'question_active' || sessionState?.status === 'revealed') && (
                    <button
                      type="button"
                      onClick={handleReturnToExplanation}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                    >
                      <Mic className="w-4 h-4" />
                      <span>العودة لوضع الشرح 🎙️</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleQuickSaveAnswers}
                    disabled={isFinishingSession}
                    className="px-4 py-2 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white font-bold rounded-xl text-xs flex items-center gap-1.5 border border-emerald-500/40 transition-all cursor-pointer"
                    title="حفظ وتوثيق إجابات الطلاب المسجلة في ورقة Answers-Live فوراً دون إنهاء الحصة"
                  >
                    <Save className="w-4 h-4" />
                    <span>حفظ في الشيت الآن 💾</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFinishAndSave}
                    disabled={isFinishingSession}
                    className="px-4 py-2 bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white font-bold rounded-xl text-xs flex items-center gap-1.5 border border-rose-500/40 transition-all cursor-pointer"
                    title="إنهاء الحصة وتوثيق كافة النتائج في ورقة Answers-Live وإغلاق الجلسة"
                  >
                    <Power className="w-4 h-4" />
                    <span>إنهاء وحفظ في الشيت 🛑</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Real-time Interactive Controls Bar (أعداد الخيارات، إجابات الطلاب، الذين لم يجاوبوا، البحث) */}
            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              {/* Search Bar + Unanswered Filter Button */}
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px] max-w-xl">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="بحث باسم الطالب أو رقم المشترك..."
                    className="w-full pr-10 pl-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500"
                  />
                </div>

                {/* زر إظهار الذين لم يجيبوا */}
                {(() => {
                  const answersMap = sessionState?.answersForCurrentQuestion || {};
                  const answeredUsers = new Set(
                    Object.values(answersMap)
                      .map(sub => String(sub.username || '').trim().toLowerCase())
                      .filter(Boolean)
                  );
                  const totalCount = sessionState?.connectedStudents?.length || 0;
                  const unansweredCount = Math.max(0, totalCount - answeredUsers.size);

                  return (
                    <button
                      type="button"
                      onClick={() => setFilterUnansweredOnly(prev => !prev)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border shrink-0 ${
                        filterUnansweredOnly
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-lg shadow-amber-500/20 ring-2 ring-amber-300'
                          : 'bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white border-slate-800'
                      }`}
                      title={filterUnansweredOnly ? 'إلغاء الفلتر وعرض جميع الطلاب' : 'إظهار المشتركين الذين لم يجيبوا فقط'}
                    >
                      <Clock className={`w-3.5 h-3.5 ${filterUnansweredOnly ? 'text-slate-950' : 'text-amber-400'}`} />
                      <span>{filterUnansweredOnly ? 'عرض الجميع' : 'الذين لم يجيبوا'}</span>
                      <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-black ${
                        filterUnansweredOnly ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {unansweredCount}
                      </span>
                    </button>
                  );
                })()}
              </div>

              {/* أزرار التحكم في إظهار وإخفاء عناصر الإجابات في شاشة العرض (أعداد الخيارات + إجابات الطلاب) */}
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. زر إظهار/إخفاء عدد المصوتين بالخيارات (افتراضياً مخفي) */}
                <button
                  type="button"
                  onClick={() => handleToggleOptionCountsVisibility(!sessionState?.showOptionCountsInRoom)}
                  disabled={isUpdatingOptionCountsVisibility}
                  title={sessionState?.showOptionCountsInRoom ? 'عدد المصوتين بالخيارات ظاهر بشاشة العرض - انقر للإخفاء' : 'عدد المصوتين بالخيارات مخفي بشاشة العرض - انقر للإظهار'}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border shadow-sm ${
                    sessionState?.showOptionCountsInRoom
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sessionState?.showOptionCountsInRoom ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                      <span>أعداد الخيارات: إظهار</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                      <span>أعداد الخيارات: إخفاء</span>
                    </>
                  )}
                </button>

                {/* 2. زر إظهار/إخفاء نصوص إجابات الطلاب بشاشة العرض (افتراضياً مخفي) */}
                <button
                  type="button"
                  onClick={() => handleToggleStudentAnswersVisibility(!sessionState?.showStudentTextAnswersInRoom)}
                  disabled={isUpdatingStudentAnswersVisibility}
                  title={sessionState?.showStudentTextAnswersInRoom ? 'نصوص وإجابات الطلاب معروضة بشاشة العرض - انقر للإخفاء' : 'نصوص وإجابات الطلاب مخفية بشاشة العرض - انقر للإظهار'}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border shadow-sm ${
                    sessionState?.showStudentTextAnswersInRoom
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sessionState?.showStudentTextAnswersInRoom ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                      <span>إجابات الطلاب: إظهار</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                      <span>إجابات الطلاب: إخفاء</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Response Meter Badge Card */}
            {(() => {
              const currentQ = sessionState?.currentQuestion;
              const answersMap = sessionState?.answersForCurrentQuestion || {};
              const uniqueAnsweredUsers = new Set(
                Object.values(answersMap)
                  .map(sub => String(sub.username || '').trim().toLowerCase())
                  .filter(Boolean)
              );
              const totalStudentsCount = sessionState?.connectedStudents?.length || 0;
              const answeredCount = uniqueAnsweredUsers.size;
              const answerPercentage = totalStudentsCount > 0 
                ? Math.min(100, Math.round((answeredCount / totalStudentsCount) * 100)) 
                : 0;

              return (
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 shadow-inner">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black text-xs font-mono">
                          {(sessionState?.currentQuestionIndex ?? 0) + 1}
                        </span>
                        <span className="text-xs font-bold text-amber-400">
                          {sessionState?.status === 'question_active' 
                            ? '⚡ سؤال تفاعلي نشط معروض على الشاشة وأجهزة الطلاب' 
                            : sessionState?.status === 'revealed'
                            ? '🎯 تم كشف الإجابة النموذجية'
                            : 'متابعة إجابات وتفاعل الطلاب على الأسئلة الحية'}
                        </span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-200 line-clamp-1">
                        {currentQ ? currentQ.question : (selectedLessonTitle ? `الدرس: ${selectedLessonTitle}` : 'في انتظار طرح سؤال من بنك الأسئلة...')}
                      </h4>
                    </div>

                    {/* Progress Percentage Badge */}
                    <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 self-start sm:self-auto">
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400">إجابات الطلاب</div>
                        <div className="text-sm font-black text-emerald-400 font-mono">
                          {answeredCount} / {totalStudentsCount} طالب
                        </div>
                      </div>
                      <div className="w-10 h-10 relative flex items-center justify-center">
                        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                          <path
                            className="text-slate-800"
                            strokeWidth="3.5"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="text-emerald-500 transition-all duration-500 ease-out"
                            strokeDasharray={`${answerPercentage}, 100`}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <span className="absolute text-[10px] font-black font-mono text-slate-200">
                          {answerPercentage}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Live Students Responses List */}
            {(() => {
              const answersMap = sessionState?.answersForCurrentQuestion || {};
              const currentQ = sessionState?.currentQuestion;
              const list = (sessionState?.connectedStudents || []).filter(s => {
                const studentKey = s.sheetNumber ? `${s.username}_${s.sheetNumber}` : s.username;
                const ansObj = answersMap[studentKey] || 
                               answersMap[s.username] || 
                               answersMap[`${s.username}_${s.sheetNumber || ''}`] ||
                               Object.values(answersMap).find(sub => String(sub.username || '').trim().toLowerCase() === s.username.trim().toLowerCase());
                const hasAnswered = Boolean(ansObj);

                if (filterUnansweredOnly && hasAnswered) {
                  return false;
                }

                if (!studentSearch.trim()) return true;
                const q = studentSearch.toLowerCase();
                return s.username.toLowerCase().includes(q) || (s.sheetNumber && s.sheetNumber.includes(q));
              });

              if (list.length === 0) {
                return (
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 text-center space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-800/60 text-slate-500 mx-auto flex items-center justify-center">
                      {filterUnansweredOnly ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Users className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-300">
                        {filterUnansweredOnly
                          ? '🎉 جميع الطلاب المتصلين قاموا بالإجابة على السؤال الحالي!'
                          : studentSearch
                          ? 'لم يتم العثور على طالب يطابق البحث'
                          : 'لا يوجد طلاب متصلون حالياً بالحصة'}
                      </h4>
                      {filterUnansweredOnly && (
                        <button
                          onClick={() => setFilterUnansweredOnly(false)}
                          className="mt-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          عرض جميع الطلاب ({(sessionState?.connectedStudents || []).length})
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl overflow-hidden shadow-lg divide-y divide-slate-800/70 max-h-72 overflow-y-auto">
                  {list.map((student, idx) => {
                    const studentKey = student.sheetNumber ? `${student.username}_${student.sheetNumber}` : student.username;
                    const ansObj = answersMap[studentKey] || 
                                   answersMap[student.username] || 
                                   answersMap[`${student.username}_${student.sheetNumber || ''}`] ||
                                   Object.values(answersMap).find(s => String(s.username || '').trim().toLowerCase() === student.username.trim().toLowerCase());
                    const hasAnswered = Boolean(ansObj);
                    const evalSub = (hasAnswered && currentQ && sessionState?.status === 'revealed')
                      ? evaluateLiveAnswer(currentQ, ansObj.answer)
                      : null;

                    return (
                      <div
                        key={idx}
                        className="px-3.5 py-2.5 sm:py-3 flex items-center justify-between gap-3 hover:bg-slate-900/60 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[11px] font-mono shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                            {student.username}
                          </span>
                          <span className="font-mono font-bold text-[11px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                            {student.sheetNumber || '-'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center justify-center p-0.5" title="متصل الآن">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                          </div>

                          {hasAnswered ? (
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>الإجابة: <b className="font-mono text-white mr-0.5">{ansObj.answer}</b></span>
                              </span>
                              {evalSub && evalSub.isCorrect !== null && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  evalSub.isCorrect ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                                }`}>
                                  {evalSub.isCorrect ? '✓ صحيح' : '✗ خطأ'}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>في انتظار الإجابة</span>
                            </span>
                          )}

                          <button
                            onClick={() => handleRemoveStudent(student.username, student.sheetNumber)}
                            title="حذف المشترك من الحصة"
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Interactive Questions Launchpad */}
          {activeLesson ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    <span>بنك أسئلة الحصة المباشرة ({activeLesson.questions?.length || 0} أسئلة)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    انقر على أي سؤال لمعاينته ثم اضغط زر "طرح السؤال الآن" لعرضه فورياً للطلاب وعلى الشاشة.
                  </p>
                </div>
              </div>

              {/* Question Chips */}
              <div className="flex flex-wrap items-center gap-2 overflow-x-auto py-1">
                {activeLesson.questions.map((q, idx) => {
                  const isActive = sessionState?.currentQuestionIndex === idx && sessionState?.status === 'question_active';
                  const isRevealed = sessionState?.currentQuestionIndex === idx && sessionState?.status === 'revealed';
                  const isSelectedForPreview = previewQuestionIndex === idx;

                  return (
                    <button
                      key={idx}
                      onClick={() => setPreviewQuestionIndex(idx)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 cursor-pointer border ${
                        isActive
                          ? 'bg-amber-500 border-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/20 ring-2 ring-amber-300 animate-pulse'
                          : isRevealed
                          ? 'bg-emerald-950 border-emerald-500/60 text-emerald-300'
                          : isSelectedForPreview
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                          : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                      }`}
                    >
                      <span>س{idx + 1}</span>
                      {q.image && (
                        <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1 rounded">🖼️</span>
                      )}
                      {q.isTextAnswer && (
                        <span className="text-[10px] bg-indigo-400/20 text-indigo-300 px-1 rounded">✍️</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected Question Preview & Launch Box */}
              {activeLesson.questions[previewQuestionIndex] && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
                  {/* Top Header of Preview */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs">
                          معاينة السؤال {previewQuestionIndex + 1}
                        </span>
                        {activeLesson.questions[previewQuestionIndex].isTextAnswer ? (
                          <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-bold flex items-center gap-1">
                            ✍️ إجابة كتابية / نصية
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                            🔘 خيارات متعددة ({(activeLesson.questions[previewQuestionIndex].options || []).length})
                          </span>
                        )}
                      </div>

                      {/* Question Text */}
                      {activeLesson.questions[previewQuestionIndex].question && (
                        <h4 className="text-base font-bold text-slate-100 leading-relaxed pt-1">
                          {activeLesson.questions[previewQuestionIndex].question}
                        </h4>
                      )}
                    </div>

                    {/* Launch Controls */}
                    <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                      {/* Teacher Live Timer Selector */}
                      <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-2 rounded-xl">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-[11px] text-slate-400 font-bold">المهلة:</span>
                        <select
                          value={launchTimerDuration}
                          onChange={(e) => setLaunchTimerDuration(parseInt(e.target.value, 10) || 30)}
                          className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold font-mono px-2 py-1 rounded-lg outline-none cursor-pointer"
                        >
                          <option value={15}>15 ثانية</option>
                          <option value={30}>30 ثانية</option>
                          <option value={45}>45 ثانية</option>
                          <option value={60}>60 ثانية</option>
                          <option value={90}>90 ثانية</option>
                          <option value={120}>دقيقتان</option>
                          <option value={9999}>مفتوح بدون وقت</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleLaunchQuestion(activeLesson.questions[previewQuestionIndex], previewQuestionIndex, launchTimerDuration)}
                        className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
                      >
                        <Play className="w-4 h-4 fill-slate-950" />
                        <span>طرح السؤال للطلاب الآن 🚀</span>
                      </button>
                    </div>
                  </div>

                  {/* Question Image Preview if present */}
                  {activeLesson.questions[previewQuestionIndex].image && (
                    <div className="max-w-md max-h-56 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 p-1.5">
                      <img
                        src={formatDriveImageUrl(activeLesson.questions[previewQuestionIndex].image)}
                        alt="توضيح السؤال"
                        className="w-full max-h-52 object-contain rounded-xl mx-auto"
                      />
                    </div>
                  )}

                  {/* Multiple Choice Options List or Text Answer Info */}
                  {activeLesson.questions[previewQuestionIndex].isTextAnswer ? (
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1 text-xs">
                      <div className="text-slate-400 font-bold">طريقة الإجابة: نصية كتابية</div>
                      {activeLesson.questions[previewQuestionIndex].correctAnswer ? (
                        <div className="text-emerald-400 font-mono">
                          الإجابة النموذجية المحددة: <span className="font-bold underline">{activeLesson.questions[previewQuestionIndex].correctAnswer}</span>
                        </div>
                      ) : (
                        <div className="text-amber-400/90">
                          إجابة حرة مفتوحة (تقييم حر من الأستاذ)
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {(activeLesson.questions[previewQuestionIndex].options || []).map((opt, optIdx) => {
                        const isCorrect = String(optIdx + 1) === String(activeLesson.questions[previewQuestionIndex].correctAnswer).trim() ||
                                          opt.trim().toLowerCase() === String(activeLesson.questions[previewQuestionIndex].correctAnswer).trim().toLowerCase();
                        return (
                          <div
                            key={optIdx}
                            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                              isCorrect
                                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                                : 'bg-slate-900 border-slate-800 text-slate-300'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-mono">
                                {optIdx + 1}
                              </span>
                              <span>{opt}</span>
                            </span>
                            {isCorrect && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px]">
                                الإجابة الصحيحة ✓
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-900/50 rounded-3xl border border-dashed border-slate-800 space-y-3">
              <Mic className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-300">يرجى اختيار موضوع الحصة من القائمة أعلاه للبدء</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                أو يمكنك إضافة موضوع جديد مع أسئلته التفاعلية عبر تبويب "قسم إعدادات الأسئلة (Questions-Live)".
              </p>
            </div>
          )}

          {/* Extensible Future Widgets Slot (و أشياء أخرى لاحقاً نضيف) */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-3.5 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>مساحة التوسعات القادمة: استطلاعات الرأي السريعة، الأسئلة المفتوحة، والمؤقتات المباشرة.</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Ready for extensions</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: QUESTIONS SETTINGS (Questions-Live) */}
      {/* ========================================================================= */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchLessons}
                onChange={(e) => setSearchLessons(e.target.value)}
                placeholder="بحث في دروس ورقة Questions-Live..."
                className="w-full pr-10 pl-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSetupSheets}
                disabled={isSettingUpSheets}
                className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-amber-500/30"
                title="إنشاء وتأكيد أوراق Live في ملف الشيت تلقائياً"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isSettingUpSheets ? 'animate-spin text-amber-400' : ''}`} />
                <span className="hidden sm:inline">تهيئة الأوراق بالشيت ⚡</span>
              </button>

              <button
                type="button"
                onClick={loadLessons}
                disabled={loadingLessons}
                className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl transition-all cursor-pointer border border-slate-800"
                title="تحديث من الشيت"
              >
                <RefreshCw className={`w-4 h-4 ${loadingLessons ? 'animate-spin text-amber-400' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleAddNewLesson}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة موضوع وأسئلة جديدة</span>
              </button>
            </div>
          </div>

          {/* Auto-Creation Notice Banner */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                💡 <b>نظام تلقائي بالكامل:</b> ورقتي <b>Questions-Live</b> و <b>Answers-Live</b> تُنشأ وتُهيأ تلقائياً في ملف الشيت فور حفظ أول درس أو إجابة بدون الحاجة لإنشائها يدوياً.
              </span>
            </div>
            <button
              onClick={handleSetupSheets}
              disabled={isSettingUpSheets}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] shrink-0 transition-all cursor-pointer shadow-sm"
            >
              {isSettingUpSheets ? 'جاري التهيئة...' : 'تأكيد الإنشاء بالشيت الآن ⚡'}
            </button>
          </div>

          {loadingLessons ? (
            <div className="p-12 text-center text-slate-500 bg-slate-900/50 rounded-3xl border border-slate-800">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
              <p className="text-xs font-bold">جاري جلب الأسئلة من ورقة Questions-Live...</p>
            </div>
          ) : filteredLessons.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/50 rounded-3xl border border-dashed border-slate-800 space-y-4">
              <HelpCircle className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-300">لا توجد أسئلة مضافة بعد في ورقة Questions-Live</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  يمكنك إضافة موضوعك الأول مع خياراته وإجابته الصحيحة ليكون جاهزاً للإلقاء المباشر.
                </p>
              </div>
              <button
                onClick={handleAddNewLesson}
                className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة أول موضوع وأسئلة 🚀</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredLessons.map((lesson, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </span>
                        <div>
                          <h3 className="text-base font-black text-slate-100 group-hover:text-amber-400 transition-colors">
                            {lesson.title}
                          </h3>
                          <div className="text-[11px] text-slate-500">
                            حصة إلقاء وشرح مباشر مع أسئلة تفاعلية 🎙️
                          </div>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-indigo-400 font-bold shrink-0">
                        {lesson.questions?.length || 0} أسئلة
                      </span>
                    </div>

                    {/* Preview first 3 questions */}
                    <div className="space-y-1.5 pt-1">
                      {lesson.questions?.slice(0, 3).map((q, qIdx) => (
                        <div key={qIdx} className="text-xs text-slate-400 flex items-center justify-between gap-2 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-amber-400/80 shrink-0">س{qIdx + 1}:</span>
                            <span className="truncate">{q.question || '(سؤال بالصورة)'}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {q.image && (
                              <span className="text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                🖼️ صورة
                              </span>
                            )}
                            {q.isTextAnswer && (
                              <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                ✍️ نص
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectLesson(lesson.title);
                        setActiveTab('teaching');
                      }}
                      className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>بدء التدريس المباشر 🎙️</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingLesson(lesson);
                        setIsEditorOpen(true);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>تعديل</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ANSWERS LOG (Answers-Live) */}
      {/* ========================================================================= */}
      {activeTab === 'answers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchAnswers}
                onChange={(e) => setSearchAnswers(e.target.value)}
                placeholder="بحث باسم الطالب أو رقم الورقة أو موضوع الحصة..."
                className="w-full pr-10 pl-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSetupSheets}
                disabled={isSettingUpSheets}
                className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-amber-500/30"
                title="إنشاء وتأكيد ورقة Answers-Live في الشيت تلقائياً"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isSettingUpSheets ? 'animate-spin text-amber-400' : ''}`} />
                <span className="hidden sm:inline">تهيئة الأوراق بالشيت ⚡</span>
              </button>

              <button
                type="button"
                onClick={loadAnswers}
                disabled={loadingAnswers}
                className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl transition-all cursor-pointer border border-slate-800 flex items-center gap-2 text-xs font-bold"
              >
                <RefreshCw className={`w-4 h-4 ${loadingAnswers ? 'animate-spin text-amber-400' : ''}`} />
                <span>تحديث السجل</span>
              </button>
            </div>
          </div>

          {/* Auto-Creation Notice Banner */}
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                💡 <b>حفظ تلقائي للإجابات:</b> عند إنهاء أي حصة مباشرة Live، تُسجل إجابات الطلاب ونتائجهم تلقائياً في ورقة <b>Answers-Live</b> التي تُنشأ في ملف الشيت تلقائياً.
              </span>
            </div>
            <button
              onClick={handleSetupSheets}
              disabled={isSettingUpSheets}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px] shrink-0 transition-all cursor-pointer shadow-sm"
            >
              {isSettingUpSheets ? 'جاري الفحص...' : 'فحص وتهيئة الشيت ⚡'}
            </button>
          </div>

          {loadingAnswers ? (
            <div className="p-12 text-center text-slate-500 bg-slate-900/50 rounded-3xl border border-slate-800">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
              <p className="text-xs font-bold">جاري جلب إجابات ورقة Answers-Live...</p>
            </div>
          ) : filteredAnswers.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/50 rounded-3xl border border-dashed border-slate-800 space-y-2">
              <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-300">لا توجد إجابات مسجلة بعد في ورقة Answers-Live</h3>
              <p className="text-xs text-slate-500">
                عند إنهاء أي حصة مباشرة وحفظ الإجابات، ستظهر درجات وتفاعل الطلاب هنا فورياً.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold">
                    <tr>
                      <th className="p-3.5">تاريخ الحصة</th>
                      <th className="p-3.5">رقم المشترك</th>
                      <th className="p-3.5">اسم المشترك</th>
                      <th className="p-3.5">موضوع الحصة</th>
                      <th className="p-3.5">عدد الإجابات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredAnswers.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-850/50 transition-colors">
                        <td className="p-3.5 text-slate-400 font-mono text-[11px]">{row.timestamp || '-'}</td>
                        <td className="p-3.5 font-mono text-indigo-400 font-bold">#{row.sheetNumber || '-'}</td>
                        <td className="p-3.5 font-bold text-slate-100">{row.username}</td>
                        <td className="p-3.5 text-slate-300">{row.lessonTitle}</td>
                        <td className="p-3.5 font-mono text-amber-400 font-bold">
                          {Object.keys(row.answers || {}).length} إجابات
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT LESSON FOR Questions-Live */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isEditorOpen && editingLesson && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-black text-slate-100">
                    {editingLesson.title ? `تعديل موضوع: ${editingLesson.title}` : 'إضافة موضوع وأسئلة حية جديدة (Questions-Live)'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsEditorOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 custom-scrollbar">
                {/* Topic Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    موضوع الحصة / المحاضرة المباشرة (العمود A في ورقة Questions-Live):
                  </label>
                  <input
                    type="text"
                    value={editingLesson.title}
                    onChange={(e) => setEditingLesson({ ...editingLesson, title: e.target.value })}
                    placeholder="مثال: مقدمة في الخط العربي - أسرار حرف الألف"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl text-slate-100 text-xs font-bold outline-none"
                  />
                </div>

                {/* Questions Section */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">
                      الأسئلة التفاعلية المخصصة لهذا الدرس ({editingLesson.questions.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newQ: LiveDirectQuestionItem = {
                          index: editingLesson.questions.length,
                          question: '',
                          options: ['خيار 1', 'خيار 2', 'خيار 3', 'خيار 4'],
                          correctAnswer: '1',
                          image: '',
                          isTextAnswer: false,
                        };
                        setEditingLesson({
                          ...editingLesson,
                          questions: [...editingLesson.questions, newQ],
                        });
                      }}
                      className="px-3 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة سؤال إضافي</span>
                    </button>
                  </div>

                  {editingLesson.questions.map((q, qIdx) => (
                    <div key={qIdx} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3.5">
                      <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                            سؤال {qIdx + 1}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            (4 أعمدة في الشيت: صورة، نص، خيارات، إجابة)
                          </span>
                        </div>
                        {editingLesson.questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = editingLesson.questions.filter((_, idx) => idx !== qIdx);
                              setEditingLesson({ ...editingLesson, questions: updated });
                            }}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                            title="حذف هذا السؤال"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* 1. Image URL (Column B, F, J...) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] text-slate-300 font-bold flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                            <span>1. رابط صورة السؤال (مرن: اختياري - يمكن تركه فارغاً):</span>
                          </label>
                          {q.image && (
                            <span className="text-[10px] text-emerald-400 font-bold">تم إرفاق صورة ✓</span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={q.image || ''}
                          onChange={(e) => {
                            const updated = [...editingLesson.questions];
                            updated[qIdx].image = e.target.value;
                            setEditingLesson({ ...editingLesson, questions: updated });
                          }}
                          placeholder="رابط Google Drive أو رابط مباشر للصورة..."
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-amber-400 rounded-xl text-slate-200 text-xs font-mono outline-none"
                        />
                        {q.image && (
                          <div className="max-h-28 max-w-sm rounded-xl overflow-hidden border border-slate-800 bg-slate-900 p-1 mt-1">
                            <img
                              src={formatDriveImageUrl(q.image)}
                              alt="معاينة الصورة"
                              className="max-h-24 object-contain rounded-lg mx-auto"
                            />
                          </div>
                        )}
                      </div>

                      {/* 2. Question Text (Column C, G, K...) */}
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-300 font-bold block">
                          2. نص السؤال التفاعلي:
                        </label>
                        <input
                          type="text"
                          value={q.question}
                          onChange={(e) => {
                            const updated = [...editingLesson.questions];
                            updated[qIdx].question = e.target.value;
                            setEditingLesson({ ...editingLesson, questions: updated });
                          }}
                          placeholder="اكتب نص السؤال هنا..."
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-indigo-400 rounded-xl text-slate-100 text-xs font-semibold outline-none"
                        />
                      </div>

                      {/* 3. Question Options / Text Mode (Column D, H, L...) */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] text-slate-300 font-bold">
                            3. نوع السؤال وخيارات الإجابة:
                          </label>
                          <div className="flex items-center gap-1.5 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...editingLesson.questions];
                                updated[qIdx].isTextAnswer = false;
                                if (!updated[qIdx].options || updated[qIdx].options.length === 0) {
                                  updated[qIdx].options = ['خيار 1', 'خيار 2', 'خيار 3', 'خيار 4'];
                                }
                                setEditingLesson({ ...editingLesson, questions: updated });
                              }}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                !q.isTextAnswer
                                  ? 'bg-amber-500 text-slate-950 font-black'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              خيارات
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...editingLesson.questions];
                                updated[qIdx].isTextAnswer = true;
                                setEditingLesson({ ...editingLesson, questions: updated });
                              }}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                q.isTextAnswer
                                  ? 'bg-indigo-600 text-white font-black'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              نص كتابي
                            </button>
                          </div>
                        </div>

                        {/* Options inputs if multiple choice */}
                        {!q.isTextAnswer ? (
                          <div className="grid grid-cols-2 gap-2">
                            {(q.options || []).map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500 font-mono w-4 text-center">{optIdx + 1}:</span>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    const updated = [...editingLesson.questions];
                                    const opts = [...(updated[qIdx].options || [])];
                                    opts[optIdx] = e.target.value;
                                    updated[qIdx].options = opts;
                                    setEditingLesson({ ...editingLesson, questions: updated });
                                  }}
                                  className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-indigo-400"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-2.5 bg-indigo-950/30 border border-indigo-500/30 rounded-xl text-[11px] text-indigo-300">
                            ✍️ سيكتب في الشيت كلمة <b>نص</b>، وسيقوم الطلاب بكتابة إجاباتهم يدوياً على أجهزتهم.
                          </div>
                        )}
                      </div>

                      {/* 4. Correct Answer (Column E, I, M...) */}
                      <div className="pt-1">
                        <label className="block text-[11px] text-slate-300 font-bold mb-1">
                          4. الإجابة الصحيحة أو النموذجية (رقم الخيار 1-4، أو نص الإجابة، أو اتركه فارغاً للحرة):
                        </label>
                        <input
                          type="text"
                          value={q.correctAnswer || ''}
                          onChange={(e) => {
                            const updated = [...editingLesson.questions];
                            updated[qIdx].correctAnswer = e.target.value;
                            setEditingLesson({ ...editingLesson, questions: updated });
                          }}
                          placeholder={q.isTextAnswer ? "اكتب الإجابة النموذجية أو اترك فارغاً للحر" : "مثال: 1 أو 2"}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-xs font-bold outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveLessonForm}
                  disabled={isSavingLesson}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingLesson ? 'جارٍ الحفظ في الشيت...' : 'حفظ في Questions-Live 💾'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl relative"
              dir="rtl"
            >
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute top-4 left-4 p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-base font-black text-slate-100">رمز الدخول السريع (QR Code)</h3>
              <p className="text-xs text-slate-400">امسح الكود بكاميرا الجوال للانضمام المباشر للحصة</p>
              <div className="p-4 bg-white rounded-2xl inline-block shadow-inner">
                <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 object-contain" />
              </div>
              <div className="font-mono text-lg font-black text-amber-400 tracking-widest bg-slate-950 p-2 rounded-xl border border-slate-800">
                PIN: {effectivePin || '---'}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* End Program Confirmation Modal */}
      <AnimatePresence>
        {showEndConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 max-w-md w-full text-right space-y-4 shadow-2xl relative"
              dir="rtl"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-100">هل أنت متأكد من إنهاء الحصة المباشرة؟</h3>
                  <p className="text-xs text-slate-400 mt-0.5">سيتم إغلاق الجلسة وحفظ الإجابات في ورقة Answers-Live وإخراج الطلاب.</p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">موضوع الحصة:</span>
                  <span className="font-bold text-amber-300">{sessionState?.lessonTitle || selectedLessonTitle || 'حصة تدريبية مباشرة'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">الطلاب المتصلون:</span>
                  <span className="font-bold text-indigo-300">{(sessionState?.connectedStudents || []).length} طلاب</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
                  <span className="text-slate-400">النتائج المسجلة للحفظ:</span>
                  <span className={`font-bold ${buildDirectAnswerRecords().length > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {buildDirectAnswerRecords().length > 0 ? `${buildDirectAnswerRecords().length} طالب جاهز للتوثيق 💾` : 'لا توجد إجابات مسجلة'}
                  </span>
                </div>
                {buildDirectAnswerRecords().length > 0 ? (
                  <p className="text-[11px] text-emerald-400/90 font-medium bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                    ✅ سيتم توثيق إجابات {buildDirectAnswerRecords().length} طالب في ورقة <b>Answers-Live</b> تلقائياً عند التأكيد.
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-400/90 font-medium bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                    💡 لم يتم تسجيل أي إجابات طلاب حتى الآن (تأكد من إرسال الطلاب لإجاباتهم أثناء طرح السؤال).
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEndConfirmModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  إلغاء التراجع
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEndProgram}
                  disabled={isTogglingProgram}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-rose-900/30 cursor-pointer"
                >
                  <Power className="w-4 h-4" />
                  <span>تأكيد إنهاء الحصة 🛑</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Unified Chat & Messages Modal */}
      <LiveChatModal
        isOpen={showChatModal}
        onClose={() => setShowChatModal(false)}
        messages={sessionState?.messages || []}
        connectedStudents={sessionState?.connectedStudents || []}
        onReply={async (messageId, replyText, replyType) => {
          await replyToStudentMessage(messageId, replyText, replyType);
        }}
        onDeleteMessage={async (messageId) => {
          await deleteStudentMessage(messageId);
        }}
        onClearAll={async () => {
          await clearAllStudentMessages();
        }}
        onSendTeacherBroadcast={async (text, recipientStudent, recipientSheet) => {
          await sendTeacherBroadcastMessage({ text, recipientStudent, recipientSheet });
        }}
        showChatInRoom={Boolean(sessionState?.showChatInRoom)}
        onToggleShowInRoom={async (show) => {
          await toggleShowChatInRoom(show);
        }}
        isTeacher={true}
      />
    </div>
  );
}
