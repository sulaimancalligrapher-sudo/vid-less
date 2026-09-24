import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import {
  Radio,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Users,
  QrCode,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
  HelpCircle,
  FileText,
  Volume2,
  Tv,
  Eye,
  ChevronDown,
  RefreshCw,
  Award,
} from 'lucide-react';
import { liveSocket, LiveMessage } from '../lib/liveSocket';
import { WordData, Question } from '../types';
import { fetchLessons, fetchAdminQuestions } from '../api';

interface TeacherLiveScreenProps {
  onBack: () => void;
}

interface StudentInRoom {
  id: string;
  name: string;
  sheetNumber: string;
  joinedAt: number;
  currentAnswer?: string | number | null;
  isCorrect?: boolean | null;
  answeredAt?: number;
  online: boolean;
  score: number;
  totalAnswered: number;
}

interface QuestionStats {
  questionId: string | number;
  totalAnswered: number;
  totalCorrect: number;
  optionCounts: Record<number, number>;
}

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

export default function TeacherLiveScreen({ onBack }: TeacherLiveScreenProps) {
  // Session setup state
  const [teacherName, setTeacherName] = useState(() => localStorage.getItem('teacher_name') || 'أستاذ المادة');
  const [pin, setPin] = useState('');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [lessons, setLessons] = useState<WordData[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<WordData | null>(null);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [customVideoUrl, setCustomVideoUrl] = useState('');
  const [customLessonTitle, setCustomLessonTitle] = useState('');

  // Live state
  const [students, setStudents] = useState<StudentInRoom[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [status, setStatus] = useState<'lobby' | 'playing' | 'paused' | 'question_active' | 'showing_results' | 'ended'>('lobby');
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [questionStats, setQuestionStats] = useState<QuestionStats | null>(null);
  const [triggeredQuestions, setTriggeredQuestions] = useState<Set<number>>(new Set());
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Video / Audio refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Student URL
  const studentJoinUrl = `${window.location.origin}${window.location.pathname}?page=live-student&pin=${pin}`;

  // 1. Connect WebSocket and handle incoming messages
  useEffect(() => {
    liveSocket.connect();

    const unsubscribe = liveSocket.subscribe((msg: LiveMessage) => {
      switch (msg.type) {
        case 'ROOM_CREATED': {
          const room = msg.payload?.room;
          if (room) {
            setPin(room.pin);
            setIsSessionActive(true);
            setStatus(room.status || 'lobby');
            setStudents(room.students || []);
            setOnlineCount(room.onlineCount || 0);
          }
          break;
        }

        case 'STUDENT_LIST_UPDATED': {
          const list = msg.payload?.students || [];
          setStudents(list);
          setOnlineCount(msg.payload?.onlineCount || list.filter((s: any) => s.online).length);
          break;
        }

        case 'QUESTION_ACTIVATED': {
          setActiveQuestion(msg.payload?.question || null);
          setQuestionStats(msg.payload?.stats || null);
          setStatus('question_active');
          break;
        }

        case 'STUDENT_ANSWERED': {
          const updatedStats = msg.payload?.stats;
          if (updatedStats) {
            setQuestionStats(updatedStats);
          }
          // Mark student as answered in local state
          const studentId = msg.payload?.studentId;
          const selectedOption = msg.payload?.selectedOption;
          const isCorrect = msg.payload?.isCorrect;
          setStudents((prev) =>
            prev.map((s) =>
              s.id === studentId
                ? { ...s, currentAnswer: selectedOption, isCorrect, answeredAt: Date.now() }
                : s
            )
          );
          break;
        }

        case 'RESULTS_REVEALED': {
          setStatus('showing_results');
          if (msg.payload?.stats) {
            setQuestionStats(msg.payload.stats);
          }
          break;
        }

        case 'QUESTION_DISMISSED': {
          setActiveQuestion(null);
          setQuestionStats(null);
          setStatus('playing');
          break;
        }

        default:
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 2. Load lessons list on mount
  useEffect(() => {
    const loadLessons = async () => {
      setLoadingLessons(true);
      try {
        const words = await fetchLessons('1', 'teacher');
        if (Array.isArray(words) && words.length > 0) {
          setLessons(words);
          setSelectedLesson(words[0]);
        }
      } catch (e) {
        console.error('Failed to load lessons for teacher:', e);
      } finally {
        setLoadingLessons(false);
      }
    };
    loadLessons();
  }, []);

  // 3. Generate QR code when PIN is generated
  useEffect(() => {
    if (pin) {
      QRCode.toDataURL(studentJoinUrl, {
        width: 320,
        margin: 1.5,
        color: {
          dark: '#020617',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('Error generating QR code:', err));
    }
  }, [pin, studentJoinUrl]);

  // Handle Start Session
  const handleStartSession = () => {
    const title = selectedLesson?.word || customLessonTitle || 'درس تفاعلي صفي';
    const mediaUrl = selectedLesson?.youtubeUrl || selectedLesson?.fullSound || customVideoUrl;
    const mediaType = selectedLesson?.youtubeUrl ? 'video' : selectedLesson?.fullSound ? 'audio' : 'video';
    const questions = selectedLesson?.questions || [];

    localStorage.setItem('teacher_name', teacherName);

    liveSocket.send('TEACHER_INIT_ROOM', {
      teacherName,
      lessonTitle: title,
      sheetNumber: '1',
      mediaUrl,
      mediaType,
      questions,
    });
  };

  // Video / Audio playback handler & Question trigger check
  const handleTimeUpdate = () => {
    const media = videoRef.current || audioRef.current;
    if (!media) return;

    const cur = media.currentTime;
    setCurrentTime(cur);
    setDuration(media.duration || 0);

    // Broadcast time to students periodically
    liveSocket.send('MEDIA_STATE_CHANGE', {
      status: isPlaying ? 'playing' : 'paused',
      currentTime: cur,
    });

    // Check if we hit any question timestamp that hasn't been triggered yet
    if (selectedLesson && Array.isArray(selectedLesson.questions)) {
      selectedLesson.questions.forEach((q, idx) => {
        // Trigger if current time is within 0.8s of question.time
        if (
          Math.abs(cur - q.time) <= 0.8 &&
          !triggeredQuestions.has(idx) &&
          status !== 'question_active' &&
          status !== 'showing_results'
        ) {
          triggerQuestion(q, idx);
        }
      });
    }
  };

  // Manually or automatically trigger a question
  const triggerQuestion = (question: Question, index: number) => {
    // 1. Pause media
    if (videoRef.current) videoRef.current.pause();
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);

    // 2. Mark question as triggered
    setTriggeredQuestions((prev) => new Set(prev).add(index));
    setActiveQuestion(question);
    setStatus('question_active');

    // 3. Reset local student answers
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        currentAnswer: null,
        isCorrect: null,
        answeredAt: undefined,
      }))
    );

    // 4. Send to server to broadcast to all students
    liveSocket.send('TRIGGER_QUESTION', {
      question: {
        id: question.slotIndex || index,
        time: question.time,
        question: question.question,
        options: question.options,
        correctAnswer: question.correctAnswer,
        image: question.image,
      },
    });
  };

  // Teacher clicks "Reveal Results"
  const handleRevealResults = () => {
    liveSocket.send('REVEAL_RESULTS');
  };

  // Teacher clicks "Resume Video"
  const handleResumeAfterQuestion = () => {
    liveSocket.send('RESUME_AFTER_QUESTION');
    setActiveQuestion(null);
    setQuestionStats(null);
    setStatus('playing');

    // Play video
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else if (audioRef.current) {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }, 200);
  };

  // Rewind 10 seconds
  const handleRewind10 = () => {
    const media = videoRef.current || audioRef.current;
    if (media) {
      media.currentTime = Math.max(0, media.currentTime - 10);
    }
  };

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    const media = videoRef.current || audioRef.current;
    if (!media) return;

    if (isPlaying) {
      media.pause();
      setIsPlaying(false);
      liveSocket.send('MEDIA_STATE_CHANGE', { status: 'paused', currentTime: media.currentTime });
    } else {
      media.play().catch(() => {});
      setIsPlaying(true);
      liveSocket.send('MEDIA_STATE_CHANGE', { status: 'playing', currentTime: media.currentTime });
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Format time mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Current media URL
  const currentMediaUrl = selectedLesson?.youtubeUrl || selectedLesson?.fullSound || customVideoUrl;
  const playableUrl = getPlayableMediaUrl(currentMediaUrl);
  const isVideo = Boolean(selectedLesson?.youtubeUrl || (customVideoUrl && !customVideoUrl.endsWith('.mp3')));

  // Answered count calculation
  const totalStudents = students.length;
  const answeredCount = students.filter((s) => s.currentAnswer !== null && s.currentAnswer !== undefined).length;
  const answerPercentage = totalStudents > 0 ? Math.round((answeredCount / totalStudents) * 100) : 0;

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none"
      dir="rtl"
    >
      {/* Top Bar for Teacher / Screen */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between shrink-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-slate-100 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="العودة للنظام المعتاد"
          >
            <ArrowRight className="w-4 h-4" />
            <span className="hidden sm:inline">الرئيسية</span>
          </button>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg">
              <Tv className="w-4 h-4" />
            </span>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
                <span>عرض الدروس - وضع البث الصفي المباشر</span>
                <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] rounded-full font-bold flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  مباشر
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Action Controls in Top Bar */}
        {isSessionActive && (
          <div className="flex items-center gap-2 sm:gap-3">
            {/* PIN Badge */}
            <div
              onClick={() => {
                navigator.clipboard.writeText(pin);
                setCopiedPin(true);
                setTimeout(() => setCopiedPin(false), 2000);
              }}
              className="bg-slate-950 border border-amber-500/30 px-3 py-1.5 rounded-xl flex items-center gap-2 cursor-pointer hover:border-amber-500 transition-all shadow-sm shadow-amber-500/5"
              title="اضغط لنسخ رمز الجلسة"
            >
              <span className="text-[11px] text-slate-400 font-medium">رمز الجلسة:</span>
              <span className="font-mono text-base font-black text-amber-400 tracking-widest">{pin}</span>
              {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            </div>

            {/* QR Code button */}
            <button
              onClick={() => setShowQrModal(true)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="عرض رمز QR للطلاب"
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline">رمز QR</span>
            </button>

            {/* Attendance & Students badge */}
            <button
              onClick={() => setShowAttendanceModal(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer transition-all"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>{onlineCount} متصل</span>
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer"
              title="ملء الشاشة للعرض على البروجكتور"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      {!isSessionActive ? (
        /* Setup & Launch Room Screen */
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl"
          >
            <div className="text-center mb-6">
              <div className="inline-flex p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl mb-3 shadow-inner">
                <Radio className="w-8 h-8 animate-pulse" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-100">تهيئة وبدء الحصة التفاعلية المباشرة</h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed max-w-md mx-auto">
                يتم عرض الفيديو والشرح على شاشتك الكبيرة أو البروجكتور، بينما تظهر الأسئلة والخيارات التفاعلية فوراً على جوالات الطلاب!
              </p>
            </div>

            <div className="space-y-4 text-right">
              {/* Teacher Name Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم الأستاذ / المعلم:</label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="أستاذ المادة"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-200 rounded-xl outline-none transition-all text-sm font-semibold"
                />
              </div>

              {/* Lesson Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">اختر الدرس المراد عرضه في الحصة:</label>
                {loadingLessons ? (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>جارٍ تحميل الدروس من ورقة Questions...</span>
                  </div>
                ) : (
                  <select
                    value={selectedLesson ? lessons.indexOf(selectedLesson) : 0}
                    onChange={(e) => setSelectedLesson(lessons[parseInt(e.target.value)])}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-200 rounded-xl outline-none transition-all text-sm font-semibold cursor-pointer"
                  >
                    {lessons.map((lesson, idx) => (
                      <option key={idx} value={idx}>
                        {lesson.word || `الدرس رقم ${idx + 1}`} ({lesson.questions?.length || 0} أسئلة)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Selected Lesson Info Box */}
              {selectedLesson && (
                <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">
                      <HelpCircle className="w-4 h-4" />
                    </span>
                    <span className="text-slate-300 font-semibold">عدد الأسئلة المربوطة بالفيديو:</span>
                  </div>
                  <span className="font-bold text-amber-400 text-sm">
                    {selectedLesson.questions?.length || 0} أسئلة مبرمجة للتوقف التلقائي
                  </span>
                </div>
              )}

              {/* Start Session Button */}
              <button
                onClick={handleStartSession}
                className="w-full mt-3 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-2xl shadow-xl shadow-amber-500/10 active:scale-98 transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
              >
                <Radio className="w-5 h-5" />
                <span>بدء الجلسة وإنشاء رمز الدخول (PIN)</span>
              </button>
            </div>
          </motion.div>
        </div>
      ) : (
        /* Active Screen / Projector View */
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Main Media Player & Stage Area */}
          <div className="flex-1 flex flex-col bg-black relative justify-center items-center overflow-hidden">
            {/* The Video Element */}
            {isVideo && playableUrl ? (
              <video
                ref={videoRef}
                src={playableUrl}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="w-full h-full object-contain max-h-[80vh]"
                playsInline
                controls={false}
              />
            ) : playableUrl ? (
              /* Audio Mode with Visualizer Canvas / Album Art */
              <div className="flex flex-col items-center justify-center p-8 text-center max-w-lg">
                <audio
                  ref={audioRef}
                  src={playableUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
                <div className="w-32 h-32 rounded-3xl bg-gradient-to-tr from-amber-500/20 to-purple-500/20 border border-amber-500/30 flex items-center justify-center mb-6 shadow-2xl">
                  <Volume2 className="w-16 h-16 text-amber-400 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold text-slate-200 mb-2">{selectedLesson?.word}</h3>
                <p className="text-xs text-slate-400">استمع للشرح الصفي بتركيز مع الأستاذ</p>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                لم يتم العثور على رابط فيديو صالح لهذا الدرس
              </div>
            )}

            {/* Question Overlay HUD (When Active Question triggers) */}
            <AnimatePresence>
              {activeQuestion && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center"
                >
                  <div className="w-full max-w-3xl bg-slate-900/90 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-500/10">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="p-2 bg-amber-500/15 text-amber-400 rounded-xl">
                          <HelpCircle className="w-5 h-5" />
                        </span>
                        <h4 className="text-sm font-bold text-amber-400">سؤال تفاعلي للطلاب الآن</h4>
                      </div>

                      {/* Live Counter of Answers */}
                      <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-1.5 rounded-full border border-slate-800">
                        <span className="text-xs text-slate-400">الإجابات:</span>
                        <span className="font-extrabold text-amber-400 text-sm">
                          {answeredCount} / {totalStudents}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold">({answerPercentage}%)</span>
                      </div>
                    </div>

                    {/* Question Text */}
                    <h3 className="text-xl sm:text-2xl font-black text-slate-100 mb-6 leading-relaxed">
                      {activeQuestion.question}
                    </h3>

                    {/* Options Grid (showing choices with optional live stats when revealed) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                      {(activeQuestion.options || []).map((opt, oIdx) => {
                        const count = questionStats?.optionCounts[oIdx] || 0;
                        const optPercentage = answeredCount > 0 ? Math.round((count / answeredCount) * 100) : 0;
                        const isCorrectOption =
                          String(activeQuestion.correctAnswer).trim() === String(oIdx + 1) ||
                          String(activeQuestion.correctAnswer).trim().toLowerCase() === String(opt).trim().toLowerCase();

                        return (
                          <div
                            key={oIdx}
                            className={`p-4 rounded-2xl border text-right relative overflow-hidden transition-all ${
                              status === 'showing_results'
                                ? isCorrectOption
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/50'
                                  : 'bg-slate-950/60 border-slate-800 text-slate-400 opacity-60'
                                : 'bg-slate-950/80 border-slate-800 text-slate-200'
                            }`}
                          >
                            {/* Visual Percentage Bar in Showing Results Mode */}
                            {status === 'showing_results' && (
                              <div
                                className={`absolute inset-y-0 right-0 opacity-15 pointer-events-none transition-all duration-700 ${
                                  isCorrectOption ? 'bg-emerald-500' : 'bg-slate-500'
                                }`}
                                style={{ width: `${optPercentage}%` }}
                              />
                            )}

                            <div className="flex items-center justify-between relative z-10">
                              <span className="text-base font-bold flex items-center gap-2">
                                <span className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-mono">
                                  {['أ', 'ب', 'ج', 'د'][oIdx] || oIdx + 1}
                                </span>
                                <span>{opt}</span>
                              </span>

                              {status === 'showing_results' && (
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-sm">{optPercentage}%</span>
                                  {isCorrectOption && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Teacher Action Controls for Question */}
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      {status === 'question_active' ? (
                        <button
                          onClick={handleRevealResults}
                          className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-sm flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all"
                        >
                          <BarChart3 className="w-4.5 h-4.5" />
                          <span>كشف النتائج والإجابة الصحيحة 📊</span>
                        </button>
                      ) : (
                        <button
                          onClick={handleResumeAfterQuestion}
                          className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 font-black rounded-xl text-sm flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all"
                        >
                          <Play className="w-4.5 h-4.5" />
                          <span>متابعة الفيديو والشرح ▶</span>
                        </button>
                      )}

                      <button
                        onClick={handleRewind10}
                        className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-sm flex items-center gap-1.5 cursor-pointer transition-all"
                        title="إرجاع 10 ثوانٍ لإعادة المقطع"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>إعادة 10ث</span>
                      </button>

                      <button
                        onClick={handleResumeAfterQuestion}
                        className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-bold rounded-xl text-sm flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <SkipForward className="w-4 h-4" />
                        <span>تخطي</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Custom Control Scrubber Bar for Teacher */}
            <div className="w-full bg-slate-950/95 border-t border-slate-800 p-3 sm:px-6 flex flex-col gap-2 z-20">
              {/* Timeline Progress Bar with Question Markers */}
              <div className="relative w-full h-3 bg-slate-800 rounded-full cursor-pointer overflow-visible">
                {/* Progress */}
                <div
                  className="absolute inset-y-0 right-0 bg-amber-500 rounded-full"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />

                {/* Question markers on timeline */}
                {(selectedLesson?.questions || []).map((q, qIdx) => {
                  const markerPos = duration > 0 ? (q.time / duration) * 100 : 0;
                  const isPassed = currentTime >= q.time;
                  return (
                    <div
                      key={qIdx}
                      style={{ right: `${markerPos}%` }}
                      className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 -mr-2 rounded-full border-2 border-slate-950 shadow-md flex items-center justify-center transition-all ${
                        isPassed ? 'bg-emerald-500 ring-2 ring-emerald-500/30' : 'bg-amber-400'
                      }`}
                      title={`سؤال عند ${formatTime(q.time)}`}
                    >
                      <span className="text-[8px] font-bold text-slate-950">{qIdx + 1}</span>
                    </div>
                  );
                })}
              </div>

              {/* Media Controls */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleTogglePlay}
                    className="p-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold cursor-pointer transition-all active:scale-95 shadow-md"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={handleRewind10}
                    className="p-2 hover:bg-slate-800 text-slate-300 rounded-xl cursor-pointer transition-all"
                    title="إرجاع 10 ثوانٍ"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <div className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1">
                    <span>{formatTime(currentTime)}</span>
                    <span className="text-slate-600">/</span>
                    <span className="text-slate-500">{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="text-xs font-bold text-slate-300 truncate max-w-xs sm:max-w-md">
                  {selectedLesson?.word}
                </div>
              </div>
            </div>
          </div>

          {/* Side Panel: Live Classroom Radar & Attendance */}
          <div className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-r border-slate-800 flex flex-col shrink-0">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-200">الطلاب الحاضرون</h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                {onlineCount} متصل
              </span>
            </div>

            {/* Students List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[35vh] lg:max-h-none">
              {students.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs leading-relaxed">
                  <p>بانتظار انضمام الطلاب للجلسة...</p>
                  <p className="mt-1 text-slate-600">أعطهم رمز الجلسة: <span className="font-mono text-amber-400 font-bold">{pin}</span></p>
                </div>
              ) : (
                students.map((student) => (
                  <div
                    key={student.id}
                    className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${student.online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                      <div className="text-right">
                        <div className="font-bold text-slate-200">{student.name}</div>
                        {student.sheetNumber && (
                          <div className="text-[10px] text-slate-500 font-mono">شيت: #{student.sheetNumber}</div>
                        )}
                      </div>
                    </div>

                    {/* Status Badge during Question */}
                    {activeQuestion && (
                      <div>
                        {student.currentAnswer !== null && student.currentAnswer !== undefined ? (
                          <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-md font-bold text-[10px] flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            أجاب
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-md font-bold text-[10px] animate-pulse">
                            يفكر...
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Quick Share Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(studentJoinUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'تم نسخ رابط الطلاب!' : 'نسخ رابط انضمام الطلاب'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal for Classroom Projection */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-2xl relative"
            >
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-100 rounded-xl transition-all cursor-pointer"
              >
                ✕
              </button>

              <h3 className="text-base font-bold text-slate-100 mb-1">امسح رمز الاستجابة السريعة (QR)</h3>
              <p className="text-xs text-slate-400 mb-4">وجّه كاميرا جوالك للانضمام للحصة فوراً</p>

              {qrCodeDataUrl ? (
                <div className="p-4 bg-white rounded-2xl inline-block shadow-lg mb-4">
                  <img src={qrCodeDataUrl} alt="QR Code" className="w-56 h-56 mx-auto" />
                </div>
              ) : (
                <div className="w-56 h-56 bg-slate-800 rounded-2xl mx-auto flex items-center justify-center text-xs text-slate-500">
                  جارٍ التوليد...
                </div>
              )}

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 mb-3">
                <span className="text-xs text-slate-400">رمز الدخول اليدوي:</span>
                <div className="text-2xl font-mono font-black text-amber-400 tracking-widest mt-0.5">{pin}</div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Attendance & Reports Modal */}
      <AnimatePresence>
        {showAttendanceModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold text-slate-100">سجل حضور الحصة المباشرة</h3>
                </div>
                <button
                  onClick={() => setShowAttendanceModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {students.length === 0 ? (
                  <p className="text-center py-6 text-slate-500 text-xs">لا يوجد طلاب مسجلون حتى الآن.</p>
                ) : (
                  students.map((std, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center font-mono font-bold">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-slate-200">{std.name}</div>
                          <div className="text-[10px] text-slate-500">رقم الشيت: #{std.sheetNumber || 'زائر'}</div>
                        </div>
                      </div>

                      <div className="text-left">
                        <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg font-bold text-[11px]">
                          النقاط: {std.score} / {std.totalAnswered}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-4 border-t border-slate-800 mt-4 flex items-center justify-between">
                <span className="text-xs text-slate-400">إجمالي الحاضرين: <strong className="text-slate-100">{students.length}</strong></span>
                <button
                  onClick={() => {
                    const text = students.map((s, i) => `${i + 1}. ${s.name} (شيت #${s.sheetNumber}) - نقاط: ${s.score}`).join('\n');
                    navigator.clipboard.writeText(text);
                    alert('تم نسخ قائمة الحضور إلى الحافظة!');
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Copy className="w-4 h-4" />
                  <span>نسخ القائمة</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
