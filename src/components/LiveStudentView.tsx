import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, Sparkles, CheckCircle2, XCircle, Clock, Send, 
  User, Hash, LogOut, ArrowRight, Volume2, HelpCircle, 
  Award, ShieldAlert, Wifi, WifiOff, Loader2,
  KeyRound, ShieldCheck
} from 'lucide-react';
import { 
  LiveSessionState, LiveQuestionItem, evaluateLiveAnswer 
} from '../types';
import { 
  getLiveSessionState, joinLiveSession, pingLiveSession, leaveLiveSession, submitLiveAnswer, 
  formatDriveImageUrl 
} from '../api';
import { useLanguage } from '../translations';

interface LiveStudentViewProps {
  onBackToMain?: () => void;
}

const OPTION_COLORS = [
  'from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border-blue-400/30 text-white shadow-blue-500/20',
  'from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-emerald-400/30 text-white shadow-emerald-500/20',
  'from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 border-amber-400/30 text-white shadow-amber-500/20',
  'from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 border-purple-400/30 text-white shadow-purple-500/20',
  'from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 border-rose-400/30 text-white shadow-rose-500/20',
  'from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 border-cyan-400/30 text-white shadow-cyan-500/20',
];

const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

export default function LiveStudentView({ onBackToMain }: LiveStudentViewProps) {
  const { t } = useLanguage();

  // Student credentials
  const [username, setUsername] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('username') || p.get('name') || localStorage.getItem('loggedInUsername') || '';
    }
    return '';
  });

  const [sheetNumber, setSheetNumber] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('sheetNumber') || p.get('sheet') || p.get('id') || localStorage.getItem('loggedInSheetNumber') || '';
    }
    return '';
  });

  const [isJoined, setIsJoined] = useState(false);
  const [sessionState, setSessionState] = useState<LiveSessionState | null>(null);
  const [connected, setConnected] = useState(false);
  const [studentPin, setStudentPin] = useState('');
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedAnswer, setSubmittedAnswer] = useState<string | null>(null);
  const [currentQuestionKey, setCurrentQuestionKey] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Auto-join if username is already saved
  useEffect(() => {
    if (username.trim()) {
      handleJoin(username.trim(), sheetNumber.trim(), studentPin.trim());
    }
  }, []);

  // SSE or Polling listener for live updates
  useEffect(() => {
    if (!isJoined) return;

    let es: EventSource | null = null;
    let pollInterval: any = null;

    try {
      es = new EventSource('/api/live/stream');
      es.onopen = () => setConnected(true);
      es.onmessage = (event) => {
        try {
          const state: LiveSessionState = JSON.parse(event.data);
          setSessionState(state);
          setConnected(true);
        } catch (err) {
          console.warn('SSE parse error:', err);
        }
      };
      es.onerror = () => {
        setConnected(false);
        // Fallback to REST polling if SSE disconnects
        if (!pollInterval) {
          pollInterval = setInterval(async () => {
            const s = await getLiveSessionState();
            if (s) {
              setSessionState(s);
              setConnected(true);
            }
          }, 1500);
        }
      };
    } catch {
      // Direct polling fallback
      pollInterval = setInterval(async () => {
        const s = await getLiveSessionState();
        if (s) {
          setSessionState(s);
          setConnected(true);
        }
      }, 1500);
    }

    // Ping server every 5s to keep student active in teacher's list
    const pingTimer = setInterval(() => {
      pingLiveSession(username, sheetNumber);
    }, 5000);

    const handleBeforeUnload = () => {
      leaveLiveSession(username, sheetNumber);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (es) es.close();
      if (pollInterval) clearInterval(pollInterval);
      clearInterval(pingTimer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      leaveLiveSession(username, sheetNumber);
    };
  }, [isJoined, username, sheetNumber]);

  // Handle active question change & timer
  useEffect(() => {
    if (!sessionState) return;

    const q = sessionState.currentQuestion;
    const qKey = q ? `${sessionState.currentQuestionIndex}_${q.question}` : null;

    if (qKey !== currentQuestionKey) {
      setCurrentQuestionKey(qKey);
      // New question arrived!
      setSelectedOption(null);
      setTextAnswer('');
      setSubmittedAnswer(null);

      // Check if student already submitted for this question
      const studentKey = `${username.trim()}_${sheetNumber.trim()}`;
      if (sessionState.answersForCurrentQuestion?.[studentKey]) {
        const prev = sessionState.answersForCurrentQuestion[studentKey].answer;
        setSubmittedAnswer(prev);
        setSelectedOption(prev);
        setTextAnswer(prev);
      }

      // Calculate time left
      if (sessionState.status === 'question_active' && sessionState.questionTriggeredAt) {
        const elapsed = Math.floor((Date.now() - sessionState.questionTriggeredAt) / 1000);
        const rem = Math.max(0, (sessionState.timeLimit || 30) - elapsed);
        setTimeLeft(rem);
      }
    }
  }, [sessionState, currentQuestionKey, username, sheetNumber]);

  // Local Countdown ticker
  useEffect(() => {
    if (sessionState?.status !== 'question_active') return;
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionState?.status, timeLeft]);

  // Join Classroom
  const handleJoin = async (nameToJoin: string, sheetToJoin: string, pinToJoin?: string) => {
    if (!nameToJoin.trim()) {
      setJoinError('يرجى إدخال اسم الطالب');
      return;
    }
    setJoinError(null);
    try {
      localStorage.setItem('loggedInUsername', nameToJoin.trim());
      localStorage.setItem('loggedInSheetNumber', sheetToJoin.trim());
      const res = await joinLiveSession(nameToJoin.trim(), sheetToJoin.trim(), pinToJoin ? pinToJoin.trim() : undefined);
      if (res.success && res.state) {
        setSessionState(res.state);
        setIsJoined(true);
        setConnected(true);
        if (res.pinVerified) {
          setIsPinVerified(true);
        }
      } else {
        setIsJoined(true);
      }
    } catch (err: any) {
      setJoinError(err.message || 'تعذر الاتصال بالجلسة');
    }
  };

  // Submit Student Answer (Multiple Choice or Text Input)
  const handleSendAnswer = async (answerVal: string) => {
    if (submittedAnswer || isSubmitting || sessionState?.status !== 'question_active' || !answerVal.trim()) return;

    setSelectedOption(answerVal.trim());
    setIsSubmitting(true);

    try {
      const currentQ = sessionState.currentQuestion;
      const qIndex = sessionState.currentQuestionIndex ?? 0;
      const evalResult = currentQ ? evaluateLiveAnswer(currentQ, answerVal.trim()) : { isCorrect: null };

      // Submit answer directly to live hub
      await submitLiveAnswer({
        username: username.trim(),
        sheetNumber: sheetNumber.trim(),
        answer: answerVal.trim(),
        questionIndex: qIndex,
        isCorrect: evalResult.isCorrect
      });

      setSubmittedAnswer(answerVal.trim());
    } catch (err) {
      console.error('Error submitting answer:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Join Screen (if not logged in)
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
        >
          {/* Header Glow */}
          <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-500" />

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-3xl mx-auto flex items-center justify-center mb-3 shadow-inner">
              <Tv className="w-8 h-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-100">
              بوابة الطالب للحصة التفاعلية 📱
            </h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed font-semibold">
              سجل اسمك للانضمام إلى شاشة العرض والإجابة على الأسئلة من جوالك مباشرة!
            </p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleJoin(username, sheetNumber, studentPin); }} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                اسم الطالب:
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسمك الكريم..."
                  className="w-full px-4 py-3.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 rounded-2xl outline-none text-sm font-bold pr-11"
                />
                <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                رقم الطالب / الشيت (اختياري):
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={sheetNumber}
                  onChange={(e) => setSheetNumber(e.target.value)}
                  placeholder="مثال: 12 أو A1..."
                  className="w-full px-4 py-3.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 rounded-2xl outline-none text-sm font-mono pr-11"
                />
                <Hash className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-amber-300">
                  رمز تسجيل حصة الحضور (PIN):
                </label>
                <span className="text-[10px] text-amber-400/80 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  معروض على شاشة الفيديو
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  value={studentPin}
                  onChange={(e) => setStudentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="أدخل الرمز المكوّن من 4 أرقام (مثال: 5824)..."
                  className="w-full px-4 py-3.5 bg-slate-950 border-2 border-amber-500/40 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-amber-300 placeholder:text-slate-600 rounded-2xl outline-none text-base font-black font-mono tracking-widest text-center pr-11"
                />
                <KeyRound className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400" />
              </div>
            </div>

            {joinError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{joinError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-600/20 active:scale-98 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <Sparkles className="w-5 h-5" />
              <span>دخول الحصة المباشرة 🚀</span>
            </button>
          </form>

          {onBackToMain && (
            <button
              type="button"
              onClick={onBackToMain}
              className="w-full mt-4 text-xs text-slate-400 hover:text-slate-200 font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة للصفحة الرئيسية</span>
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  // 2. Active Classroom Remote Screen (Zero Video Overhead)
  const currentQ = sessionState?.currentQuestion;
  const isQuestionActive = sessionState?.status === 'question_active' && currentQ;
  const isRevealed = sessionState?.status === 'revealed' && currentQ;
  const validOptions = (currentQ?.options || []).map(o => String(o || '').trim()).filter(Boolean);
  const isMultipleChoice = Boolean(currentQ && validOptions.length > 0 && !currentQ.isTextAnswer);
  
  const evalResult = (isRevealed && submittedAnswer && currentQ)
    ? evaluateLiveAnswer(currentQ, submittedAnswer)
    : null;
  const isCorrectAnswer = evalResult?.isCorrect ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500/30">
      {/* Top Header Bar */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 sticky top-0 z-20">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
              <Tv className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                <span>{sessionState?.lessonTitle || 'الحصة التفاعلية المباشرة'}</span>
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              </div>
              <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5">
                <span>الطالب:</span>
                <span className="text-indigo-400 font-bold">{username}</span>
                {sheetNumber && <span className="text-slate-500 font-mono">({sheetNumber})</span>}
                {isPinVerified && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold flex items-center gap-0.5">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    <span>حضور مؤكد</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                leaveLiveSession(username, sheetNumber);
                setIsJoined(false);
              }}
              title="تسجيل خروج أو تغيير الاسم"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
            {onBackToMain && (
              <button
                onClick={() => {
                  leaveLiveSession(username, sheetNumber);
                  onBackToMain();
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                الرئيسية
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Dynamic Interactive Body */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {/* CASE A: Active Question Mode */}
          {isQuestionActive ? (
            <motion.div
              key={`q-${sessionState.currentQuestionIndex}`}
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.98 }}
              className="w-full space-y-4"
            >
              {/* Question Header & Timer */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                    السؤال {(sessionState.currentQuestionIndex ?? 0) + 1}
                  </span>
                  
                  {/* Timer Badge */}
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black font-mono border ${
                    timeLeft <= 5 
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 animate-bounce' 
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}>
                    <Clock className="w-3.5 h-3.5" />
                    <span>{timeLeft} ثانية</span>
                  </div>
                </div>

                {/* Optional Question Image */}
                {currentQ.image && (
                  <div className="aspect-video max-h-48 w-full rounded-2xl overflow-hidden border border-slate-800 mb-3 bg-slate-950">
                    <img 
                      src={formatDriveImageUrl(currentQ.image)} 
                      alt="Question Visual" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                <h3 className="text-base sm:text-lg font-black text-slate-100 leading-relaxed text-right">
                  {currentQ.question}
                </h3>
              </div>

              {/* Sub-case 1: Multiple Choice Options */}
              {isMultipleChoice ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentQ.options.map((opt, idx) => {
                    const isSelected = selectedOption === opt;
                    const letter = OPTION_LETTERS[idx] || `${idx + 1}`;
                    const colorGradient = OPTION_COLORS[idx % OPTION_COLORS.length];

                    return (
                      <motion.button
                        key={idx}
                        whileTap={{ scale: 0.97 }}
                        disabled={Boolean(submittedAnswer) || isSubmitting}
                        onClick={() => handleSendAnswer(opt)}
                        className={`relative p-4 rounded-2xl border text-right font-bold transition-all flex items-center justify-between cursor-pointer shadow-md ${
                          isSelected 
                            ? 'ring-4 ring-amber-400 bg-indigo-600 text-white border-white scale-[1.02]' 
                            : submittedAnswer 
                              ? 'opacity-50 bg-slate-900 border-slate-800 text-slate-400 cursor-not-allowed'
                              : `bg-gradient-to-r ${colorGradient}`
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="w-8 h-8 rounded-xl bg-black/20 border border-white/20 flex items-center justify-center font-black text-sm shrink-0">
                            {letter}
                          </span>
                          <span className="text-sm sm:text-base leading-snug break-words">
                            {opt}
                          </span>
                        </div>

                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-white text-indigo-700 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-5 h-5 fill-white text-indigo-600" />
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                /* Sub-case 2: Written Text Question (Column F is 'نص' or no options) */
                <div className="space-y-3 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
                  <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold mb-1">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span>أجب كتابياً على السؤال:</span>
                  </div>
                  <textarea
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    disabled={Boolean(submittedAnswer) || isSubmitting}
                    placeholder="اكتب إجابتك هنا بدقة..."
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-2xl text-slate-100 text-sm font-bold outline-none resize-none transition-all placeholder:text-slate-600"
                  />
                  {!submittedAnswer && (
                    <button
                      onClick={() => handleSendAnswer(textAnswer.trim())}
                      disabled={!textAnswer.trim() || isSubmitting}
                      className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all disabled:opacity-40 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>إرسال الإجابة 🚀</span>
                    </button>
                  )}
                </div>
              )}

              {/* Submission State Banner */}
              {submittedAnswer && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-1"
                >
                  <div className="flex items-center justify-center gap-2 text-emerald-400 font-black text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>تم استلام إجابتك بنجاح!</span>
                  </div>
                  <p className="text-xs text-amber-300 font-bold max-w-sm mx-auto truncate" dir="auto">
                    «{submittedAnswer}»
                  </p>
                  <p className="text-xs text-slate-400 font-semibold pt-1">
                    انتظر حتى يكشف الأستاذ الإجابة على شاشة العرض 🌟
                  </p>
                </motion.div>
              )}
            </motion.div>
          ) : isRevealed ? (
            /* CASE B: Question Answer Revealed Mode */
            <motion.div
              key="revealed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl"
            >
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mx-auto shadow-inner">
                {isCorrectAnswer === true ? (
                  <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center animate-bounce">
                    <Award className="w-10 h-10" />
                  </div>
                ) : isCorrectAnswer === false ? (
                  <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                    <XCircle className="w-10 h-10" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-3xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-100">
                  {isCorrectAnswer === true 
                    ? '🎉 إجابة صحيحة وممتازة يا بطل!' 
                    : isCorrectAnswer === false 
                      ? 'حظاً أوفر في السؤال القادم!' 
                      : 'تم تسجيل إجابتك بنجاح! 📝'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-semibold">
                  السؤال: {currentQ.question}
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-right space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>الإجابة النموذجية:</span>
                  <span className="text-emerald-400 font-extrabold text-sm bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20 font-mono">
                    {evalResult?.correctLabel || currentQ.correctAnswer || 'إجابة حرة (بدون تقييم صح/خطأ)'}
                  </span>
                </div>
                {submittedAnswer && (
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>إجابتك أنت:</span>
                    <span className={`font-extrabold text-sm px-3 py-1 rounded-xl border ${
                      isCorrectAnswer === true
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                        : isCorrectAnswer === false
                        ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                        : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
                    }`}>
                      {submittedAnswer}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-indigo-400 font-bold animate-pulse">
                شاهد الشاشة الكبيرة لمتابعة شرح الأستاذ ومواصلة الدرس 👨‍🏫
              </p>
            </motion.div>
          ) : (
            /* CASE C: Watching / Listening State (Video Playing on Projector) */
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl relative overflow-hidden"
            >
              {/* Glowing decorative orb */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-600/30 to-amber-500/30 border border-indigo-500/30 mx-auto flex items-center justify-center shadow-lg relative">
                  <div className="absolute inset-0 rounded-full border border-indigo-400/40 animate-ping opacity-30" />
                  <Volume2 className="w-10 h-10 text-amber-400 animate-pulse" />
                </div>
              </div>

              <div className="space-y-2 relative">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                  {sessionState?.status === 'playing' ? '🔴 الفيديو يعمل على الشاشة الآن' : 'في انتظار بدء العرض'}
                </span>
                <h3 className="text-lg sm:text-xl font-black text-slate-100">
                  استمع وركز مع الأستاذ 👨‍🏫
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed font-semibold">
                  الفيديو يُعرض أمامكم على الشاشة الكبيرة. عندما يصل الفيديو إلى سؤال تفاعلي، ستظهر الخيارات هنا على جوالك تلقائياً لتجيب عنها فوراً!
                </p>
              </div>

              {/* Status footer pill */}
              <div className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 bg-slate-950 border border-slate-800/80 rounded-2xl text-[11px] text-slate-400 font-mono font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>أنت متصل بالقاعة وجاهز للإجابة 👍</span>
                {isPinVerified && (
                  <span className="text-emerald-400 font-bold flex items-center gap-1 border-r border-slate-800 pr-2 mr-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>تم تأكيد الحضور</span>
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="p-3 text-center text-[10px] text-slate-600 font-mono border-t border-slate-900">
        نظام الحصص التفاعلية الحية • متزامن لحظياً عبر السحابة
      </footer>
    </div>
  );
}
