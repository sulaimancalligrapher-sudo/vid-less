import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, Flame, CheckCircle2, XCircle, Send, Clock, 
  Sparkles, Award, RefreshCw, ArrowLeft, ArrowRight, Zap, Check, HelpCircle
} from 'lucide-react';
import { QuizActiveState, QuizQuestionItem, normalizeArabicText } from '../types';
import { submitStudentQuizAnswer, markStudentQuizFinished, setStudentQuizRetryMode } from '../api';

interface StudentQuizViewProps {
  quizState: QuizActiveState;
  username: string;
  sheetNumber: string;
  studentName?: string;
  onExit?: () => void;
}

const OPTION_COLORS = [
  'from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 border-blue-400/40 text-white shadow-blue-500/20',
  'from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 border-emerald-400/40 text-white shadow-emerald-500/20',
  'from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 border-amber-400/40 text-white shadow-amber-500/20',
  'from-purple-600 to-fuchsia-700 hover:from-purple-500 hover:to-fuchsia-600 border-purple-400/40 text-white shadow-purple-500/20',
  'from-rose-600 to-pink-700 hover:from-rose-500 hover:to-pink-600 border-rose-400/40 text-white shadow-rose-500/20',
  'from-cyan-600 to-sky-700 hover:from-cyan-500 hover:to-sky-600 border-cyan-400/40 text-white shadow-cyan-500/20',
];

const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

// Deterministic shuffle for student based on studentKey so it's consistent on page reload
function deterministicShuffle<T>(array: T[], seedStr: string): T[] {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) & 0xffffffff;
  }
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function StudentQuizView({
  quizState,
  username,
  sheetNumber,
  studentName,
  onExit,
}: StudentQuizViewProps) {
  const studentKey = `${username.trim().toLowerCase()}_${sheetNumber.trim()}`;
  const studentProgress = quizState.participants?.[studentKey];

  // Base questions from state
  const baseQuestions = (quizState.questions && quizState.questions.length > 0) ? quizState.questions : [];

  // Ordered questions queue (shuffled if admin enabled shuffle)
  const [questionQueue, setQuestionQueue] = useState<QuizQuestionItem[]>(() => {
    if (quizState.shuffleQuestions && baseQuestions.length > 0) {
      return deterministicShuffle(baseQuestions, studentKey);
    }
    return baseQuestions;
  });

  // Re-sync queue if questions change or shuffle toggle changes
  useEffect(() => {
    if (baseQuestions.length > 0) {
      if (quizState.shuffleQuestions) {
        setQuestionQueue(deterministicShuffle(baseQuestions, studentKey));
      } else {
        setQuestionQueue(baseQuestions);
      }
    }
  }, [quizState.questions, quizState.shuffleQuestions, studentKey]);

  // Guaranteed active questions list
  const activeQuestions = (questionQueue && questionQueue.length > 0) ? questionQueue : baseQuestions;
  const totalQuestions = activeQuestions.length;

  // Local step index - initialized only on mount to prevent remote sync race conditions
  const [localStep, setLocalStep] = useState<number>(() => {
    return studentProgress?.currentQuestionIndex || 0;
  });

  // Current active question index in the queue
  const currentStep = localStep;
  const isRetryRound = Boolean(studentProgress?.isInRetryRound);

  // When in retry round, questions to review
  const wrongIndices = studentProgress?.wrongQuestionIndices || [];
  const retryQuestions = baseQuestions.filter(q => wrongIndices.includes(q.index));

  const [currentRetryIdx, setCurrentRetryIdx] = useState(0);

  // Active question being displayed with guaranteed fallback
  const currentQ: QuizQuestionItem | undefined = isRetryRound
    ? retryQuestions[currentRetryIdx]
    : (activeQuestions[currentStep] || (currentStep < totalQuestions ? activeQuestions[Math.min(currentStep, Math.max(0, totalQuestions - 1))] : undefined));

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; pointsEarned: number } | null>(null);

  // Timer ref to ensure clean timeouts
  const advanceTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  // Timing
  const questionStartTimeRef = useRef<number>(Date.now());
  useEffect(() => {
    questionStartTimeRef.current = Date.now();
    setSelectedOption(null);
    setTextInput('');
    setFeedback(null);
    setIsSubmitting(false);
  }, [currentStep, isRetryRound, currentRetryIdx]);

  // Check if finished - only when all questions in queue are answered, or teacher ended the quiz
  const isFinished = (totalQuestions > 0 && currentStep >= totalQuestions) || 
    (quizState.quizStatus === 'ended') || 
    (Boolean(studentProgress?.isFinished) && totalQuestions > 0 && Object.keys(studentProgress?.answers || {}).length >= totalQuestions);

  // When student finishes all questions in queue, notify server
  useEffect(() => {
    if (isFinished && !isRetryRound && !studentProgress?.isFinished) {
      markStudentQuizFinished(studentKey).catch(() => {});
    }
  }, [isFinished, isRetryRound, studentKey, studentProgress?.isFinished]);

  // Advance step helper (clears inputs, increments question index smoothly)
  const advanceToNext = () => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setFeedback(null);
    setSelectedOption(null);
    setTextInput('');
    setIsSubmitting(false);

    if (isRetryRound) {
      if (currentRetryIdx + 1 < retryQuestions.length) {
        setCurrentRetryIdx(prev => prev + 1);
      } else {
        setStudentQuizRetryMode(studentKey, false);
      }
    } else {
      setLocalStep(prev => prev + 1);
    }
  };

  // Submit Answer handler
  const handleSelectOption = (optionText: string, optIndex: number) => {
    if (isSubmitting || feedback !== null || !currentQ) return;
    setIsSubmitting(true);
    setSelectedOption(optionText);

    const timeTaken = Math.max(1, Math.round((Date.now() - questionStartTimeRef.current) / 1000));
    
    // Evaluate correctness
    let isCorrect = false;
    const cleanCorrect = normalizeArabicText(currentQ.correctAnswer || '').trim().toLowerCase();
    const cleanOpt = normalizeArabicText(optionText).trim().toLowerCase();
    const cleanNum = String(optIndex + 1);

    if (cleanCorrect === cleanNum || cleanCorrect === cleanOpt) {
      isCorrect = true;
    }

    // Points
    let points = 0;
    if (isCorrect) {
      const base = 1000;
      const speed = Math.max(0, Math.round((30 - Math.min(timeTaken, 30)) * 16.6));
      const streakBonus = Math.min((studentProgress?.streak || 0) * 100, 500);
      points = isRetryRound ? 500 : (base + speed + streakBonus);
    }

    if (quizState.showInstantFeedback) {
      setFeedback({ isCorrect, pointsEarned: points });
    }

    // Background non-blocking sync to Firebase hub
    submitStudentQuizAnswer(studentKey, {
      username,
      studentName: studentName || username,
      sheetNumber,
      questionIndex: currentQ.index ?? currentStep,
      questionText: currentQ.question,
      answer: optionText,
      isCorrect,
      timeTaken,
      isRetry: isRetryRound,
      totalQuizQuestions: totalQuestions,
    }).catch(err => {
      console.warn('Background sync error (answer recorded locally):', err);
    });

    // Automatically transition to next question after 1.1s (or immediately if feedback disabled)
    if (quizState.showInstantFeedback) {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(advanceToNext, 1100);
    } else {
      advanceToNext();
    }

    // Safety fallback: ensure isSubmitting is never permanently stuck
    setTimeout(() => {
      setIsSubmitting(false);
    }, 2500);
  };

  // Submit Text Answer handler
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isSubmitting || feedback !== null || !currentQ) return;
    setIsSubmitting(true);

    const timeTaken = Math.max(1, Math.round((Date.now() - questionStartTimeRef.current) / 1000));
    const cleanCorrect = normalizeArabicText(currentQ.correctAnswer || '').trim().toLowerCase();
    const cleanInput = normalizeArabicText(textInput).trim().toLowerCase();
    const isCorrect = cleanCorrect === cleanInput;

    let points = 0;
    if (isCorrect) {
      const base = 1000;
      const speed = Math.max(0, Math.round((30 - Math.min(timeTaken, 30)) * 16.6));
      points = isRetryRound ? 500 : (base + speed);
    }

    if (quizState.showInstantFeedback) {
      setFeedback({ isCorrect, pointsEarned: points });
    }

    // Background non-blocking sync to Firebase
    submitStudentQuizAnswer(studentKey, {
      username,
      studentName: studentName || username,
      sheetNumber,
      questionIndex: currentQ.index ?? currentStep,
      questionText: currentQ.question,
      answer: textInput.trim(),
      isCorrect,
      timeTaken,
      isRetry: isRetryRound,
      totalQuizQuestions: totalQuestions,
    }).catch(err => {
      console.warn('Background sync error (text answer recorded locally):', err);
    });

    if (quizState.showInstantFeedback) {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(advanceToNext, 1100);
    } else {
      advanceToNext();
    }

    // Safety fallback
    setTimeout(() => {
      setIsSubmitting(false);
    }, 2500);
  };

  const handleStartRetryRound = () => {
    setCurrentRetryIdx(0);
    setStudentQuizRetryMode(studentKey, true);
  };

  return (
    <div className="w-full min-h-[90vh] bg-gradient-to-b from-slate-950 via-slate-900 to-[#120f26] text-white flex flex-col font-sans select-none">
      {/* Top Header / Progress Bar */}
      <header className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md flex items-center justify-between gap-3 sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-slate-950 font-black text-sm shrink-0">
            <Trophy className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="text-[11px] text-slate-400 font-bold truncate">
              {quizState.quizTitle || 'مسابقة التحدي'}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-100">
              <span>{studentName || username}</span>
              <span className="text-[10px] text-slate-500 font-mono">#{sheetNumber}</span>
            </div>
          </div>
        </div>

        {/* Center: Progress & Points */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Streak badge */}
          {(studentProgress?.streak || 0) > 1 && (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-orange-500/20 border border-orange-500/40 rounded-full text-orange-400 text-xs font-black animate-pulse">
              <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
              <span>x{studentProgress?.streak}</span>
            </div>
          )}

          {/* Points */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 font-mono font-black text-sm">
            <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span>{(studentProgress?.totalScore || 0).toLocaleString()}</span>
          </div>

          {/* Rank if available */}
          {studentProgress?.rank && (
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-300 font-bold text-xs">
              <span>المركز: #{studentProgress.rank}</span>
            </div>
          )}
        </div>
      </header>

      {/* Progress Line */}
      <div className="w-full h-1.5 bg-slate-950">
        <div 
          className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-300"
          style={{ 
            width: `${Math.min(100, Math.round(((isRetryRound ? currentRetryIdx : currentStep) / (isRetryRound ? retryQuestions.length : totalQuestions)) * 100))}%` 
          }}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col items-center justify-center p-4 md:p-6 max-w-2xl mx-auto w-full">
        {quizState.quizStatus === 'waiting' ? (
          /* ============================================================== */
          /* STUDENT WAITING LOBBY (قبل بدء المسابقة) */
          /* ============================================================== */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 text-center space-y-6 shadow-2xl backdrop-blur-md"
          >
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 border-4 border-amber-300 flex items-center justify-center text-4xl shadow-xl shadow-amber-500/30">
                🎯
              </div>
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>أنت مسجل وجاهز في المسابقة!</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-100">
                استعد للتحدي يا {studentName || username} ⚡
              </h2>
              <p className="text-xs md:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                المعلم يقوم بإعداد التحدي حالياً وسيطلق شارة البدء قريباً. انظر للشاشة الرئيسية وابقَ مستعداً على جهازك!
              </p>
            </div>

            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl max-w-sm mx-auto space-y-2 text-right">
              <div className="text-xs font-bold text-amber-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>إرشادات المسابقة:</span>
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
                <li>الأسئلة ستظهر تباعاً وتنتقل للسؤال التالي فور إجابتك.</li>
                <li>كلما أجبت أسرع وبدقة، حصلت على نقاط ومضاعفات أعلى (Streak 🔥).</li>
                <li>حافظ على اتصال هاتفك ولا تغلق الصفحة.</li>
              </ul>
            </div>
          </motion.div>
        ) : ((isFinished && !isRetryRound) || quizState.quizStatus === 'ended' || (totalQuestions > 0 && currentStep >= totalQuestions)) ? (
          /* ============================================================== */
          /* STUDENT FINISHED SCREEN (Requirement 3) */
          /* ============================================================== */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 text-center space-y-6 shadow-2xl backdrop-blur-md"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 border-4 border-amber-200 flex items-center justify-center text-3xl mx-auto shadow-xl shadow-amber-400/20">
              🎉
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-black text-slate-100">
                تم الانتهاء من جميع الأسئلة بنجاح 🎉
              </h2>
              <p className="text-xs md:text-sm text-slate-400 max-w-md mx-auto">
                أحسنت يا {studentName || username}! تم تسجيل كافة إجاباتك بنجاح في النظام.
              </p>
            </div>

            {/* Score & Answers Count Cards */}
            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                <div className="text-[11px] text-emerald-400 font-bold mb-1">الإجابات الصحيحة</div>
                <div className="text-2xl font-black text-emerald-300 font-mono">
                  {studentProgress?.correctCount || 0}
                </div>
              </div>
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl">
                <div className="text-[11px] text-rose-400 font-bold mb-1">الإجابات الخاطئة</div>
                <div className="text-2xl font-black text-rose-300 font-mono">
                  {studentProgress?.wrongCount || 0}
                </div>
              </div>
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                <div className="text-[11px] text-amber-400 font-bold mb-1">إجمالي النقاط</div>
                <div className="text-2xl font-black text-amber-300 font-mono">
                  {(studentProgress?.totalScore || 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Waiting for Podium / Final Results Announcement */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl max-w-md mx-auto space-y-2">
              <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-xs">
                <Trophy className="w-4 h-4 animate-bounce" />
                <span>
                  {quizState.quizStatus === 'ended' && studentProgress?.rank
                    ? `أنت في المركز #${studentProgress.rank} في الترتيب النهائي!`
                    : 'في انتظار إعلان النتيجة النهائية وترتيب الفائزين على شاشة العرض الرئيسية 🏆'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {quizState.quizStatus === 'ended'
                  ? 'تم إنهاء التحدي واعتماد النتائج وتتويج الفائزين على شاشة العرض.'
                  : 'تابع شاشة العرض الآن لمشاهدة منصة التتويج والمراكز الأولى فور إنهاء المسابقة.'}
              </p>
            </div>

            {/* Option to Retry Wrong Answers if enabled and has wrong questions */}
            {quizState.allowRetryWrong && (studentProgress?.wrongCount || 0) > 0 && quizState.quizStatus !== 'ended' && (
              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl space-y-2 text-right max-w-md mx-auto">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                  <RefreshCw className="w-4 h-4" />
                  <span>فرصة إضافية للتعلم والتميز!</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  لديك ({studentProgress?.wrongCount}) أسئلة يمكنك إعادة محاولة حلها الآن لترسيخ الفهم:
                </p>
                <button
                  onClick={handleStartRetryRound}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg shadow-purple-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4 animate-spin-slow" />
                  <span>ابدأ جولة تصحيح الأسئلة الخاطئة الآن 🎯</span>
                </button>
              </div>
            )}
          </motion.div>
        ) : currentQ ? (
          /* ============================================================== */
          /* ACTIVE QUESTION CARD */
          /* ============================================================== */
          <div className="w-full space-y-4">
            {/* Question Counter Pill */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="font-bold text-amber-400">
                {isRetryRound 
                  ? `🎯 تصحيح خطأ (${currentRetryIdx + 1} من ${retryQuestions.length})` 
                  : `السؤال ${currentStep + 1} من ${totalQuestions}`}
              </span>
              <span>أجب بالسرعة والدقة للحصول على أعلى النقاط ⚡</span>
            </div>

            {/* Main Question Box */}
            <div className="p-5 md:p-7 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-4 shadow-xl backdrop-blur-md relative overflow-hidden">
              {/* Optional Question Image */}
              {currentQ.image && (
                <div className="w-full max-h-56 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
                  <img
                    src={currentQ.image}
                    alt="صورة السؤال"
                    className="max-h-56 w-auto object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Question Text */}
              <h3 className="text-base md:text-xl font-black text-slate-100 text-right leading-relaxed">
                {currentQ.question}
              </h3>

              {/* Instant Feedback Overlay */}
              <AnimatePresence>
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`p-4 rounded-2xl border text-center font-black text-sm flex flex-col items-center justify-center gap-2.5 shadow-xl ${
                      feedback.isCorrect
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-rose-500/20 border-rose-500 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {feedback.isCorrect ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span>إجابة صحيحة وممتازة! (+{feedback.pointsEarned} نقطة) 🎯</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-rose-400" />
                          <span>إجابة غير صحيحة، ركز في السؤال القادم! 💪</span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => advanceToNext()}
                      className="px-4 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      <span>الانتقال للسؤال التالي فوراً</span>
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Options Area */}
            {Boolean(currentQ.isTextAnswer || !currentQ.options || currentQ.options.length === 0) ? (
              /* Text Input Form */
              <form onSubmit={handleTextSubmit} className="space-y-3">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="اكتب إجابتك هنا..."
                  disabled={isSubmitting || feedback !== null}
                  className="w-full px-5 py-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-100 placeholder-slate-500 text-base font-medium outline-none focus:border-amber-500 transition-all text-right"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={!textInput.trim() || isSubmitting || feedback !== null}
                    className="flex-1 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-40 text-slate-950 font-black rounded-2xl text-base shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    <span>تأكيد الإجابة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => advanceToNext()}
                    className="px-5 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>تخطي ⬅️</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Multiple Choice Buttons */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(currentQ.options || []).map((opt, optIdx) => {
                  const letter = OPTION_LETTERS[optIdx] || String(optIdx + 1);
                  const isSelected = selectedOption === opt;
                  const colorClass = OPTION_COLORS[optIdx % OPTION_COLORS.length];

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectOption(opt, optIdx)}
                      disabled={isSubmitting || feedback !== null}
                      className={`relative p-4 md:p-5 rounded-2xl bg-gradient-to-r border text-right font-black text-sm md:text-base flex items-center gap-3 transition-all cursor-pointer shadow-md touch-manipulation active:scale-95 ${colorClass} ${
                        isSelected ? 'ring-4 ring-white/60 scale-[1.02]' : ''
                      }`}
                    >
                      <span className="w-8 h-8 rounded-xl bg-black/25 flex items-center justify-center text-xs font-black shrink-0 border border-white/20">
                        {letter}
                      </span>
                      <span className="flex-grow leading-snug">{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Quick Navigation Footer */}
            <div className="flex items-center justify-between pt-3 px-1 text-xs border-t border-slate-800/60">
              <button
                type="button"
                onClick={() => {
                  if (currentStep > 0) setLocalStep(prev => prev - 1);
                }}
                disabled={currentStep === 0}
                className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 disabled:opacity-30 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span className="hidden sm:inline">السابق</span>
              </button>

              <div className="flex items-center gap-1.5 overflow-x-auto max-w-[200px] sm:max-w-none py-1">
                {activeQuestions.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLocalStep(i)}
                    className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center transition-all cursor-pointer ${
                      i === currentStep
                        ? 'bg-amber-500 text-slate-950 shadow-md scale-110'
                        : i < currentStep
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => advanceToNext()}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <span>السؤال التالي</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full text-center py-12 px-6 bg-slate-900/80 border border-slate-800 rounded-3xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-7 h-7 animate-spin-slow" />
            </div>
            <h3 className="text-lg font-bold text-slate-100">جاري مزامنة وتجهيز السؤال...</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              إذا لم يظهر السؤال تلقائياً، اضغط على الزر أدناه لبدء المحاولة
            </p>
            <button
              onClick={() => {
                setLocalStep(0);
              }}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg cursor-pointer"
            >
              عرض السؤال الأول ⚡
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
