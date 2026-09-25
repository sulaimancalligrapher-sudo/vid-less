import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, 
  QrCode, Users, CheckCircle2, AlertCircle, AlertTriangle, Sparkles, 
  ChevronRight, ChevronLeft, ArrowLeft, RefreshCw, FileSpreadsheet, 
  Eye, FastForward, Clock, ShieldAlert, Check, X, Award, ExternalLink, Copy,
  KeyRound, ShieldCheck, Tv
} from 'lucide-react';
import { 
  LiveLessonRow, LiveQuestionItem, LiveSessionState, LiveConnectedStudent, LiveAnswerRecord, LiveStudentAnswerSubmission, evaluateLiveAnswer, normalizeArabicText 
} from '../types';
import { 
  initLiveSession, triggerLiveQuestion, revealLiveAnswer, resumeLiveVideo, 
  finishLiveSession, resetLiveSession, getLiveSessionState, recordLiveAnswersBatchT,
  updateLivePin, leaveLiveSession,
  formatSecondsToTime, parseTimeToSeconds, formatDriveImageUrl,
  subscribeToLiveSession
} from '../api';

interface LiveTeacherRoomProps {
  initialLesson?: LiveLessonRow;
  allLessons: LiveLessonRow[];
  onBack: () => void;
}

// Extracted Google Drive File ID helper
function getGoogleDriveFileId(url: string): string | null {
  if (!url) return null;
  const fileDMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) return fileDMatch[1];
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];
  const ucMatch = url.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (ucMatch && ucMatch[1]) return ucMatch[1];
  return null;
}

function getPlayableMediaUrl(url: string): string {
  if (!url) return '';
  const driveId = getGoogleDriveFileId(url);
  if (driveId) {
    return `/api/proxy-drive?id=${driveId}`;
  }
  return url;
}

const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
const OPTION_BAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-rose-500',
  'bg-cyan-500'
];

export default function LiveTeacherRoom({
  initialLesson,
  allLessons,
  onBack,
}: LiveTeacherRoomProps) {
  const [selectedLesson, setSelectedLesson] = useState<LiveLessonRow | null>(
    initialLesson || (allLessons.length > 0 ? allLessons[0] : null)
  );

  const [sessionState, setSessionState] = useState<LiveSessionState | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // UI Panels
  const [showQrModal, setShowQrModal] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [isFinishingLesson, setIsFinishingLesson] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  // Unsaved Answers Safety Prompt States
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const [showFinishConfirmModal, setShowFinishConfirmModal] = useState(false);
  const [finishErrorMsg, setFinishErrorMsg] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    | { type: 'switch_lesson'; lesson: LiveLessonRow }
    | { type: 'exit' }
    | null
  >(null);

  // Triggered questions history in this playback session
  const triggeredQuestionsRef = useRef<Set<number>>(new Set());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Direct Student Join URL
  const studentJoinUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/?page=live-student`
    : '';

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(studentJoinUrl)}`;

  // Initialize or Switch Lesson in Real-time Hub
  useEffect(() => {
    if (selectedLesson) {
      triggeredQuestionsRef.current = new Set();
      setCurrentTime(0);
      setIsPlaying(false);
      setDuration(0);
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
          videoRef.current.load();
        } catch {}
      }
      initLiveSession({
        lessonTitle: selectedLesson.title,
        videoUrl: selectedLesson.videoUrl,
        timeLimit: selectedLesson.settingTimeLimit || 30,
        showResult: selectedLesson.settingShowResult || 'نعم'
      }).then(res => {
        if (res.state) setSessionState(res.state);
      });
    }
  }, [selectedLesson?.title, selectedLesson?.videoUrl]);

  // Connect to Live Session via Firebase Real-time WebSockets
  useEffect(() => {
    const unsubscribe = subscribeToLiveSession((state) => {
      if (state) setSessionState(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Synchronize selected lesson when switched from Admin panel
  useEffect(() => {
    if (sessionState?.lessonTitle && allLessons.length > 0) {
      if (!selectedLesson || selectedLesson.title !== sessionState.lessonTitle) {
        const match = allLessons.find(l => l.title === sessionState.lessonTitle);
        if (match) {
          setSelectedLesson(match);
        }
      }
    }
  }, [sessionState?.lessonTitle, allLessons]);

  // Time tracking and smart auto-pause for questions
  const handleTimeUpdate = () => {
    if (!videoRef.current || !selectedLesson) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);

    // If a question is already active, make sure video remains paused
    if (sessionState?.status === 'question_active') {
      if (!videoRef.current.paused) {
        videoRef.current.pause();
      }
      return;
    }

    // Check if any question has arrived at current timestamp
    if (selectedLesson.questions && selectedLesson.questions.length > 0) {
      selectedLesson.questions.forEach((q, idx) => {
        const qTime = q.time;
        // Trigger if within 1.0 second and not yet triggered
        if (Math.abs(time - qTime) < 1.0 && !triggeredQuestionsRef.current.has(idx)) {
          triggeredQuestionsRef.current.add(idx);
          videoRef.current?.pause();
          setIsPlaying(false);
          
          // Trigger Question on Server & Student Devices!
          triggerLiveQuestion({
            questionIndex: idx,
            question: q,
            timeLimit: selectedLesson.settingTimeLimit || 30,
            showResult: selectedLesson.settingShowResult || 'نعم'
          }).then(res => {
            if (res.state) setSessionState(res.state);
          });
        }
      });
    }
  };

  // Play / Pause Toggle
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (sessionState?.status === 'question_active') return;

    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Manual Trigger Question
  const handleManualTrigger = (q: LiveQuestionItem, idx: number) => {
    if (!videoRef.current || !selectedLesson) return;
    videoRef.current.currentTime = q.time;
    videoRef.current.pause();
    setIsPlaying(false);
    triggeredQuestionsRef.current.add(idx);

    triggerLiveQuestion({
      questionIndex: idx,
      question: q,
      timeLimit: selectedLesson.settingTimeLimit || 30,
      showResult: selectedLesson.settingShowResult || 'نعم'
    }).then(res => {
      if (res.state) setSessionState(res.state);
    });
  };

  // Reveal Correct Answer
  const handleRevealAnswer = async () => {
    const res = await revealLiveAnswer();
    if (res.state) setSessionState(res.state);
  };

  // Resume Video Playback
  const handleResumeVideo = async () => {
    const res = await resumeLiveVideo();
    if (res.state) setSessionState(res.state);
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Copy Student Link
  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(studentJoinUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Copy or Regenerate PIN
  const handleCopyPin = () => {
    if (sessionState?.sessionPin && navigator.clipboard) {
      navigator.clipboard.writeText(sessionState.sessionPin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2500);
    }
  };

  const handleRegeneratePin = async () => {
    try {
      const res = await updateLivePin();
      if (res.success && res.pin && sessionState) {
        setSessionState({
          ...sessionState,
          sessionPin: res.pin
        });
      }
    } catch (e) {
      console.error('Failed to regenerate PIN:', e);
    }
  };

  // Build current batch records helper - attaches timestamp only upon finishing lesson
  const buildCurrentAnswerRecords = (includeTimestamp: boolean = true): LiveAnswerRecord[] => {
    if (!sessionState || !selectedLesson) return [];
    const records: LiveAnswerRecord[] = [];
    const timestamp = includeTimestamp ? new Date().toLocaleString('ar-SA') : '';
    const allAnswers = sessionState.allSessionAnswers || {};
    const students = sessionState.connectedStudents || [];

    // Collect unique students (one record per student identity)
    const canonicalMap = new Map<string, { username: string; sheetNumber: string }>();

    // 1. From connectedStudents
    students.forEach(s => {
      const u = String(s.username || '').trim();
      const num = String(s.sheetNumber || '').trim();
      if (u) {
        const key = u.toLowerCase();
        const existing = canonicalMap.get(key);
        canonicalMap.set(key, {
          username: u,
          sheetNumber: num || (existing ? existing.sheetNumber : '')
        });
      }
    });

    // 2. From allSessionAnswers (in case student disconnected before finish)
    Object.keys(allAnswers).forEach(rawKey => {
      const trimmed = String(rawKey || '').trim();
      if (!trimmed) return;
      let u = trimmed;
      let num = '';
      if (trimmed.includes('_')) {
        const parts = trimmed.split('_');
        u = parts[0] || '';
        num = parts.slice(1).join('_') || '';
      }
      if (u) {
        const key = u.toLowerCase();
        const existing = canonicalMap.get(key);
        if (!existing) {
          canonicalMap.set(key, { username: u, sheetNumber: num });
        } else if (!existing.sheetNumber && num) {
          existing.sheetNumber = num;
        }
      }
    });

    canonicalMap.forEach((studentInfo) => {
      const uname = studentInfo.username;
      const snum = studentInfo.sheetNumber;
      // Get all answers from allSessionAnswers under any key for this student
      const studentAnswers = {
        ...(allAnswers[uname] || {}),
        ...(allAnswers[`${uname}_${snum}`] || {}),
      };
      const formattedAnswers: Record<number, string> = {};
      
      let correctCount = 0;
      let evaluatedCount = 0;

      selectedLesson.questions.forEach((q, idx) => {
        const rawAns = studentAnswers[idx];
        if (rawAns !== undefined && rawAns !== null && String(rawAns).trim() !== '') {
          const strAns = String(rawAns).trim();
          const normStr = normalizeArabicText(strAns);

          if (normStr === 'صح' || normStr === 'صحيح' || normStr === '✓' || normStr === 'true') {
            formattedAnswers[idx] = 'صح';
            correctCount++;
            evaluatedCount++;
          } else if (normStr === 'خطا' || normStr === 'خاطي' || normStr === '✗' || normStr === 'false') {
            formattedAnswers[idx] = 'خطأ';
            evaluatedCount++;
          } else {
            const evalResult = evaluateLiveAnswer(q, strAns);
            if (evalResult.isCorrect === true) {
              formattedAnswers[idx] = 'صح';
              correctCount++;
              evaluatedCount++;
            } else if (evalResult.isCorrect === false) {
              formattedAnswers[idx] = 'خطأ';
              evaluatedCount++;
            } else {
              formattedAnswers[idx] = strAns;
            }
          }
        } else {
          formattedAnswers[idx] = '';
        }
      });

      // Include if student answered at least one question
      const hasAnyAnswer = Object.values(formattedAnswers).some(val => val !== '');
      if (hasAnyAnswer) {
        records.push({
          timestamp,
          sheetNumber: snum,
          username: uname,
          lessonTitle: selectedLesson.title,
          answers: formattedAnswers,
          totalScore: evaluatedCount > 0 ? `${correctCount}/${evaluatedCount}` : ''
        });
      }
    });

    return records;
  };

  // Finish Lesson: Saves answers with current date & time to Answers-T, finishes session, and returns to awaiting new lesson
  const handleFinishLesson = async (): Promise<boolean> => {
    if (!sessionState || !selectedLesson) return false;
    setIsFinishingLesson(true);
    setFinishErrorMsg(null);

    try {
      // 1. Record student answers to Google Sheets Answers-T with final timestamp
      const records = buildCurrentAnswerRecords(true);
      if (records.length > 0) {
        const res = await recordLiveAnswersBatchT(records);
        if (res && res.success) {
          setShowSaveSuccess(true);
        } else {
          setFinishErrorMsg('تعذر حفظ الإجابات في ورقة Answers-T:\n' + (res?.message || 'تحقق من رابط Google Apps Script وصلاحيات النشر (Who has access: Anyone)'));
          return false;
        }
      }
      // Clear localStorage emergency backup since successfully saved to Sheets
      try {
        localStorage.removeItem('pending_live_answers_backup');
      } catch {}

      // 2. Mark session finished in server
      await finishLiveSession();

      // 3. Stop video playback
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setIsPlaying(false);

      // 4. Show success toast if not already shown
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 4000);

      // Close confirm modal
      setShowFinishConfirmModal(false);

      // 5. Exit video and return to awaiting next video or lesson selection
      setSelectedLesson(null);
      return true;
    } catch (err: any) {
      console.error('Error finishing lesson and saving to Answers-T:', err);
      setFinishErrorMsg('حدث خطأ أثناء إنهاء الدرس: ' + (err?.message || 'خطأ غير معروف'));
      return false;
    } finally {
      setIsFinishingLesson(false);
    }
  };

  // Helper to check if there are any student answers submitted for the current lesson
  const hasUnsavedAnswers = (): boolean => {
    if (!selectedLesson || !sessionState) return false;
    const records = buildCurrentAnswerRecords(false);
    return records.length > 0;
  };

  // Safe handler when requesting to switch lesson
  const handleRequestSwitchLesson = (newLesson: LiveLessonRow) => {
    if (selectedLesson && selectedLesson.title !== newLesson.title && hasUnsavedAnswers()) {
      setPendingAction({ type: 'switch_lesson', lesson: newLesson });
      setShowUnsavedPrompt(true);
    } else {
      setSelectedLesson(newLesson);
    }
  };

  // Safe handler when requesting to close page
  const handleRequestClosePage = () => {
    if (selectedLesson && hasUnsavedAnswers()) {
      setPendingAction({ type: 'exit' });
      setShowUnsavedPrompt(true);
    } else {
      executeClose();
    }
  };

  const executeClose = () => {
    try {
      window.close();
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => {
      if (!window.closed) {
        try {
          window.location.href = 'about:blank';
        } catch {
          window.location.replace('about:blank');
        }
      }
    }, 100);
  };

  // Safety modal actions: Save & Proceed
  const handleSaveAndProceed = async () => {
    const success = await handleFinishLesson();
    if (success) {
      setShowUnsavedPrompt(false);
      if (pendingAction) {
        if (pendingAction.type === 'switch_lesson') {
          setSelectedLesson(pendingAction.lesson);
        } else if (pendingAction.type === 'exit') {
          executeClose();
        }
        setPendingAction(null);
      }
    }
  };

  // Safety modal actions: Discard & Proceed
  const handleDiscardAndProceed = () => {
    setShowUnsavedPrompt(false);
    if (pendingAction) {
      if (pendingAction.type === 'switch_lesson') {
        setSelectedLesson(pendingAction.lesson);
      } else if (pendingAction.type === 'exit') {
        executeClose();
      }
      setPendingAction(null);
    }
  };

  const connectedStudents = sessionState?.connectedStudents || [];
  const currentQ = sessionState?.currentQuestion;
  const isQuestionActive = sessionState?.status === 'question_active' && currentQ;
  const isRevealed = sessionState?.status === 'revealed' && currentQ;

  // Deduplicate answersMap so each student is represented exactly once
  const answersList = React.useMemo(() => {
    const raw = sessionState?.answersForCurrentQuestion || {};
    const map = new Map<string, LiveStudentAnswerSubmission>();
    Object.values(raw).forEach((sub) => {
      const u = String(sub.username || '').trim();
      if (!u) return;
      const key = u.toLowerCase();
      const existing = map.get(key);
      if (!existing || (!existing.sheetNumber && sub.sheetNumber)) {
        map.set(key, sub);
      }
    });
    return Array.from(map.values());
  }, [sessionState?.answersForCurrentQuestion]);

  const answeredCount = answersList.length;
  const totalStudentsCount = Math.max(connectedStudents.length, answeredCount);
  const answerPercentage = totalStudentsCount > 0 ? Math.round((answeredCount / totalStudentsCount) * 100) : 0;

  // Option distribution counts
  const optionStats: Record<string, number> = {};
  if (currentQ?.options) {
    currentQ.options.forEach(opt => {
      optionStats[opt] = 0;
    });
    answersList.forEach(sub => {
      if (optionStats[sub.answer] !== undefined) {
        optionStats[sub.answer]++;
      } else {
        optionStats[sub.answer] = (optionStats[sub.answer] || 0) + 1;
      }
    });
  }

  const playableUrl = selectedLesson?.videoUrl ? getPlayableMediaUrl(selectedLesson.videoUrl) : '';

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-black text-slate-100 flex flex-col justify-between selection:bg-amber-500/30 overflow-hidden font-sans"
    >
      {/* Top Theater Header */}
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          {/* Close Page Button (Icon only) */}
          <button
            onClick={handleRequestClosePage}
            title="إغلاق الصفحة"
            aria-label="إغلاق الصفحة"
            className="p-2 bg-slate-900/90 hover:bg-rose-950/80 border border-slate-800 hover:border-rose-500/50 text-slate-400 hover:text-rose-300 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="h-5 w-px bg-slate-800" />

          {/* Lesson Selector or Title */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>شاشة العرض</span>
            </span>

            {/* Lessons List Selector (Controlled via Admin - Hidden by default) */}
            {sessionState?.showLessonsListInRoom && allLessons.length > 0 ? (
              <div className="flex items-center gap-2 animate-in fade-in duration-200">
                <select
                  value={selectedLesson?.title || ''}
                  onChange={(e) => {
                    const found = allLessons.find(l => l.title === e.target.value);
                    if (found) handleRequestSwitchLesson(found);
                  }}
                  className="bg-slate-900 border border-amber-500/50 text-amber-300 text-xs font-bold rounded-xl px-3 py-1.5 outline-none cursor-pointer focus:border-amber-400 shadow-sm"
                  title="عرض قائمة الدروس وتبديل الدرس المعروض"
                >
                  {allLessons.map((l, i) => (
                    <option key={i} value={l.title}>{l.title}</option>
                  ))}
                </select>
              </div>
            ) : (
              <h1 className="text-sm sm:text-base font-black text-slate-100">
                {selectedLesson?.title || 'درس تفاعلي مباشر'}
              </h1>
            )}
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2.5">
          {/* Live Session PIN Code Indicator */}
          {sessionState?.sessionPin && (
            <div 
              onClick={handleCopyPin}
              title="رمز تأكيد الحضور للطلاب - انقر للنسخ"
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500/15 to-amber-600/25 border border-amber-500/40 hover:border-amber-400 text-amber-300 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] text-amber-400/80 font-normal hidden md:inline">رمز الحضور:</span>
              <span className="font-mono tracking-widest text-sm font-black text-amber-300">{sessionState.sessionPin}</span>
              {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
            </div>
          )}

          {/* QR Code Button for Classroom */}
          <button
            onClick={() => setShowQrModal(true)}
            className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>رمز الدخول والحضور (PIN)</span>
          </button>

          {/* Finish Lesson Button */}
          <button
            onClick={() => {
              setFinishErrorMsg(null);
              setShowFinishConfirmModal(true);
            }}
            disabled={isFinishingLesson}
            title="إنهاء الدرس الحالي وتسجيل تاريخ ونتائج إجابات الطلاب في ورقة Answers-T والعودة لاختيار درس جديد"
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {isFinishingLesson ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            )}
            <span>
              {isFinishingLesson ? 'جارٍ الحفظ والإنهاء...' : 'إنهاء الدرس'}
            </span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl transition-all cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Screen Video Theater Area */}
      <main className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        {selectedLesson && playableUrl ? (
          <video
            key={playableUrl || selectedLesson.title}
            ref={videoRef}
            src={playableUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                setDuration(videoRef.current.duration);
                videoRef.current.currentTime = 0;
              }
              setCurrentTime(0);
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onClick={togglePlay}
            className="w-full h-full object-contain cursor-pointer max-h-[calc(100vh-140px)]"
            playsInline
          />
        ) : selectedLesson ? (
          <div className="text-center p-8 space-y-3">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
            <h3 className="text-lg font-bold text-slate-300">لم يتم تحديد رابط فيديو لهذا الدرس ({selectedLesson.title})</h3>
            <p className="text-xs text-slate-500">يرجى إضافة رابط الفيديو في ورقة Questions-T أو عبر لوحة الإدارة</p>
          </div>
        ) : (
          /* Awaiting selection of new lesson/video */
          <div className="max-w-2xl w-full mx-auto p-6 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-xl">
              <Tv className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-100">
                في انتظار اختيار فيديو أو درس جديد 🎯
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                تم حفظ إجابات الدرس السابق وتسجيل تاريخ الحصة بنجاح في ورقة Answers-T. يمكنك الآن اختيار درس تفاعلي جديد من القائمة للبدء في عرضه:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[48vh] overflow-y-auto p-1 custom-scrollbar">
              {allLessons.map((lesson, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRequestSwitchLesson(lesson)}
                  className="p-4 bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 rounded-2xl text-right transition-all flex items-center justify-between group cursor-pointer shadow-md active:scale-98"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 group-hover:bg-amber-500 text-amber-400 group-hover:text-slate-950 flex items-center justify-center font-bold text-xs transition-colors">
                      <Play className="w-4 h-4 fill-current" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                        {lesson.title}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {lesson.questions.length} سؤال تفاعلي
                      </div>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-600 group-hover:text-amber-400 transition-colors" />
                </button>
              ))}
            </div>

            {onBack && (
              <button
                onClick={onBack}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer border border-slate-800"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>العودة للوحة الإدارة</span>
              </button>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* INTERACTIVE QUESTION THEATER OVERLAY (POPS UP ON PROJECTOR SCREEN) */}
        {/* ========================================================================= */}
        <AnimatePresence>
          {(isQuestionActive || isRevealed) && currentQ && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="absolute inset-0 bg-slate-950/92 backdrop-blur-xl z-20 flex flex-col justify-between p-6 sm:p-10 overflow-y-auto"
            >
              {/* Question Header Status Bar */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-black text-lg">
                    {(sessionState.currentQuestionIndex ?? 0) + 1}
                  </span>
                  <div>
                    <span className="text-xs font-black text-slate-400">سؤال تفاعلي للطلاب</span>
                    <h2 className="text-xl sm:text-2xl font-black text-white">
                      {currentQ.question}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold font-mono">
                    السؤال {(sessionState.currentQuestionIndex ?? 0) + 1} من {selectedLesson?.questions.length || 0}
                  </span>
                </div>
              </div>

              {/* Center Content: Question Image (if any) and Options Distribution or Written Answers */}
              <div className="my-6 max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {currentQ.image && (
                  <div className="aspect-video max-h-72 w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl flex items-center justify-center">
                    <img 
                      src={formatDriveImageUrl(currentQ.image)} 
                      alt="Question" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                <div className={`space-y-3.5 ${currentQ.image ? '' : 'md:col-span-2'}`}>
                  {/* Case A: Multiple Choice Question */}
                  {!currentQ.isTextAnswer && currentQ.options && currentQ.options.length > 0 ? (
                    currentQ.options.map((opt, idx) => {
                      const letter = OPTION_LETTERS[idx] || `${idx + 1}`;
                      const count = optionStats[opt] || 0;
                      const pct = answeredCount > 0 ? Math.round((count / answeredCount) * 100) : 0;
                      const evalRes = evaluateLiveAnswer(currentQ, opt);
                      const isCorrect = isRevealed && evalRes.isCorrect === true;
                      const barColor = OPTION_BAR_COLORS[idx % OPTION_BAR_COLORS.length];

                      return (
                        <div 
                          key={idx}
                          className={`p-4 rounded-2xl border transition-all relative overflow-hidden ${
                            isCorrect 
                              ? 'bg-emerald-950/60 border-emerald-500 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-400' 
                              : 'bg-slate-900/90 border-slate-800 shadow-md'
                          }`}
                        >
                          {/* Background Live Progress Bar */}
                          <div 
                            className={`absolute top-0 bottom-0 right-0 opacity-20 transition-all duration-500 ease-out ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />

                          <div className="relative flex items-center justify-between z-10">
                            <div className="flex items-center gap-3">
                              <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${
                                isCorrect 
                                  ? 'bg-emerald-500 text-slate-950' 
                                  : 'bg-slate-800 text-slate-300'
                              }`}>
                                {letter}
                              </span>
                              <span className="text-base sm:text-lg font-bold text-slate-100">
                                {opt}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              {isCorrect && (
                                <span className="px-2.5 py-1 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs flex items-center gap-1 shadow-sm">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>الإجابة الصحيحة</span>
                                </span>
                              )}
                              <div className="text-left font-mono">
                                <span className="text-base font-black text-slate-100">{count}</span>
                                <span className="text-xs text-slate-400 ml-1">({pct}%)</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    /* Case B: Written Text Answer (Column F is 'نص' or no options) */
                    <div className="space-y-3">
                      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                            سؤال كتابي نصي ✍️ (يكتب الطلاب إجاباتهم في جوالاتهم)
                          </span>
                          <span className="text-xs font-black text-slate-300">
                            {answeredCount} إجابة مستلمة
                          </span>
                        </div>

                        {/* Model answer reveal on projector */}
                        {isRevealed && (
                          <div className="mt-3 p-3 rounded-xl border transition-all bg-emerald-950/40 border-emerald-500/50 text-slate-200">
                            {currentQ.correctAnswer ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-emerald-400">الإجابة النموذجية المحددة:</span>
                                <span className="text-sm font-bold text-white bg-emerald-500/20 px-2.5 py-0.5 rounded-lg border border-emerald-500/30 font-mono">
                                  {currentQ.correctAnswer}
                                </span>
                              </div>
                            ) : (
                              <div className="text-xs text-emerald-300 font-bold flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span>إجابة نصية حرة - تم تسجيل إجابات الطلاب كاملة دون تقييم صح/خطأ</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Live stream list of text submissions */}
                      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 max-h-56 overflow-y-auto space-y-2">
                        <div className="text-[11px] font-bold text-slate-400 mb-1 px-1">
                          إجابات الطلاب المستلمة فورياً ({answersList.length}):
                        </div>
                        {answersList.length === 0 ? (
                          <p className="text-xs text-slate-500 py-4 text-center">في انتظار إجابات الطلاب من هواتفهم...</p>
                        ) : (
                          answersList.map((sub, sIdx) => {
                            const evalSub = isRevealed ? evaluateLiveAnswer(currentQ, sub.answer) : null;
                            return (
                              <div 
                                key={sIdx} 
                                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                                  isRevealed && evalSub?.isCorrect === true
                                    ? 'bg-emerald-950/50 border-emerald-500/40'
                                    : isRevealed && evalSub?.isCorrect === false
                                    ? 'bg-rose-950/30 border-rose-500/30'
                                    : 'bg-slate-950/80 border-slate-800/80'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-200">{sub.username}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">({sub.sheetNumber})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-amber-300 max-w-xs truncate" dir="auto">
                                    {sub.answer}
                                  </span>
                                  {isRevealed && evalSub?.isCorrect === true && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-black text-[10px]">صح</span>
                                  )}
                                  {isRevealed && evalSub?.isCorrect === false && (
                                    <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white font-black text-[10px]">خطأ</span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Theater Question Action Controls */}
              <div className="border-t border-slate-800/80 pt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>الأسئلة معروضة الآن على هواتف الطلاب للإجابة</span>
                </div>

                <div className="flex items-center gap-3">
                  {!isRevealed ? (
                    <button
                      onClick={handleRevealAnswer}
                      className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all cursor-pointer"
                    >
                      <Eye className="w-4.5 h-4.5" />
                      <span>كشف الإجابة للطلاب 👁️</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleResumeVideo}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-98 transition-all cursor-pointer"
                    >
                      <Play className="w-4.5 h-4.5 fill-slate-950" />
                      <span>متابعة تشغيل الفيديو ▶️</span>
                    </button>
                  )}

                  <button
                    onClick={handleResumeVideo}
                    className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <FastForward className="w-4 h-4" />
                    <span>تخطي السؤال</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Timeline & Controls Bar */}
      <footer className="bg-slate-950/90 backdrop-blur-md border-t border-slate-800/80 p-3 sm:p-4 z-20 space-y-2">
        {/* Timeline Slider with Question Pins */}
        <div className="relative flex items-center group">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setCurrentTime(val);
              if (videoRef.current) videoRef.current.currentTime = val;
            }}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />

          {/* Question markers on the timeline */}
          {selectedLesson?.questions?.map((q, idx) => {
            if (!duration) return null;
            const leftPct = (q.time / duration) * 100;
            const isTriggered = triggeredQuestionsRef.current.has(idx);

            return (
              <button
                key={idx}
                onClick={() => handleManualTrigger(q, idx)}
                title={`سؤال ${idx + 1}: ${formatSecondsToTime(q.time)} - ${q.question}`}
                style={{ left: `${leftPct}%` }}
                className={`absolute -top-1.5 -translate-x-1/2 w-4 h-4 rounded-full border-2 transition-transform hover:scale-125 cursor-pointer z-10 flex items-center justify-center text-[8px] font-black font-mono ${
                  isTriggered 
                    ? 'bg-emerald-500 border-white text-slate-950' 
                    : 'bg-amber-500 border-slate-950 text-slate-950 shadow-md'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-all cursor-pointer font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/10"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-slate-950" />}
              <span className="hidden sm:inline">{isPlaying ? 'إيقاف' : 'تشغيل'}</span>
            </button>

            {/* Time display */}
            <div className="text-slate-400 font-mono font-bold">
              <span className="text-slate-200">{formatSecondsToTime(currentTime)}</span>
              <span className="mx-1">/</span>
              <span>{formatSecondsToTime(duration)}</span>
            </div>

            {/* Volume control */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.muted = !isMuted;
                    setIsMuted(!isMuted);
                  }
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  setIsMuted(false);
                  if (videoRef.current) {
                    videoRef.current.volume = v;
                    videoRef.current.muted = false;
                  }
                }}
                className="w-16 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* QR CODE MODAL FOR STUDENTS IN CLASSROOM */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-center space-y-5"
            >
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute top-4 left-4 p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div>
                <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl mx-auto flex items-center justify-center mb-3">
                  <QrCode className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-black text-slate-100">
                  انضمام الطلاب للحصة التفاعلية 📱
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-semibold leading-relaxed">
                  وجّه كاميرا هاتفك نحو الرمز أو افتح الرابط للمشاركة في الإجابة على الأسئلة!
                </p>
              </div>

              {/* QR Image Box */}
              <div className="p-4 bg-white rounded-3xl inline-block shadow-xl border-4 border-indigo-500/30">
                <img
                  src={qrCodeUrl}
                  alt="Student Join QR Code"
                  className="w-56 h-56 mx-auto rounded-xl object-contain"
                />
              </div>

              {/* PIN Code Box for Classroom Attendance */}
              {sessionState?.sessionPin && (
                <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 border-2 border-amber-500/40 rounded-2xl flex items-center justify-between shadow-inner">
                  <div className="text-right">
                    <span className="text-[11px] font-black text-amber-400 block">
                      رمز تسجيل حصة الحضور (PIN):
                    </span>
                    <span className="text-2xl font-mono font-black text-amber-300 tracking-widest">
                      {sessionState.sessionPin}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleCopyPin}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-all shadow"
                    >
                      {copiedPin ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPin ? 'تم' : 'نسخ'}</span>
                    </button>
                    <button
                      onClick={handleRegeneratePin}
                      title="توليد رمز حضور جديد"
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Link Box */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono truncate max-w-[240px]" dir="ltr">
                  {studentJoinUrl}
                </span>
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'تم النسخ' : 'نسخ الرابط'}</span>
                </button>
              </div>

              <div className="text-xs text-emerald-400 font-bold flex items-center justify-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>الطلاب المتصلون بالقاعة الآن: {connectedStudents.length}</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Save Success Alert Notification */}
      <AnimatePresence>
        {showSaveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-emerald-600 text-white font-bold px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 z-50 text-xs"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>تم إنهاء الدرس وحفظ كافة النتائج والتاريخ في ورقة Answers-T بنجاح! 💾</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unsaved Student Answers Safety Prompt Modal */}
      <AnimatePresence>
        {showUnsavedPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-slate-900 border border-amber-500/50 rounded-3xl p-6 sm:p-7 shadow-2xl relative space-y-5 text-right"
              dir="rtl"
            >
              {/* Header with warning icon */}
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-100">تنبيه: إجابات الطلاب لم تُحفظ بعد!</h3>
                  <p className="text-xs text-amber-400/90 font-medium">لم يتم النقر على زر «إنهاء الدرس» لحفظ الإجابات في Answers-T</p>
                </div>
              </div>

              {/* Informative Explanation */}
              <div className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-2.5">
                <p>
                  أنت بصدد {pendingAction?.type === 'switch_lesson' ? `الانتقال إلى فيديو/درس جديد (${pendingAction.lesson.title})` : 'إغلاق شاشة العرض'}، بينما توجد إجابات مسجلة للطلاب في هذا الدرس (<b>{selectedLesson?.title}</b>).
                </p>
                <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-xs text-amber-300 font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>💡 لحفظ درجات وتفاعل الطلاب في ورقة Answers-T مع التاريخ والوقت تلقائياً، اختر «نعم، احفظ وأنهِ الدرس أولاً».</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnsavedPrompt(false);
                    setPendingAction(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
                >
                  إلغاء والعودة للدرس ↩️
                </button>
                <button
                  type="button"
                  onClick={handleDiscardAndProceed}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 transition-all cursor-pointer"
                >
                  إغلاق الصفحة دون حفظ ⚠️
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndProceed}
                  disabled={isFinishingLesson}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-lg shadow-emerald-900/40 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isFinishingLesson ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>جارٍ الحفظ والإنهاء...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                      <span>نعم، احفظ وأنهِ الدرس أولاً 💾</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Finish Lesson Confirmation In-App Modal */}
      <AnimatePresence>
        {showFinishConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl relative space-y-5 text-right"
              dir="rtl"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-100">تأكيد إنهاء الدرس وحفظ النتائج</h3>
                  <p className="text-xs text-emerald-400 font-medium">حفظ درجات الطلاب في ورقة Answers-T</p>
                </div>
              </div>

              <div className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-3">
                <p>
                  هل ترغب في <b>إنهاء الدرس الحالي ({selectedLesson?.title})</b>؟
                </p>
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-xs text-emerald-300 font-medium space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-emerald-200">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>ماذا سيحدث عند التأكيد؟</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px] pr-2">
                    <li>حفظ جميع إجابات ودرجات الطلاب في ورقة <b>Answers-T</b> مع الوقت والتاريخ تلقائياً.</li>
                    <li>إيقاف عرض الفيديو الحالي وإتاحة اختيار درس جديد لعرضه على الطلاب.</li>
                  </ul>
                </div>

                {(() => {
                  const unsavedCount = buildCurrentAnswerRecords(false).length;
                  if (unsavedCount > 0) {
                    return (
                      <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-xs text-amber-300 font-medium flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>سيتم توثيق إجابات <b>{unsavedCount}</b> طالب متفاعل في هذا الدرس.</span>
                      </div>
                    );
                  }
                  return (
                    <div className="text-[11px] text-slate-400 italic">
                      ملاحظة: لم يقم أي طالب بإرسال إجابات في هذا الدرس بعد.
                    </div>
                  );
                })()}

                {finishErrorMsg && (
                  <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl text-xs text-rose-300">
                    {finishErrorMsg}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowFinishConfirmModal(false);
                    setFinishErrorMsg(null);
                  }}
                  disabled={isFinishingLesson}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
                >
                  إلغاء وتراجع
                </button>
                <button
                  type="button"
                  onClick={() => handleFinishLesson()}
                  disabled={isFinishingLesson}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-lg shadow-emerald-900/40 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isFinishingLesson ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>جارٍ الحفظ والإنهاء...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                      <span>تأكيد الإنهاء والحفظ 💾</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
