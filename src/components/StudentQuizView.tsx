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

  // Ordered questions queue (shuffled if admin enabled shuffle)
  const [questionQueue, setQuestionQueue] = useState<QuizQuestionItem[]>(() => {
    if (quizState.shuffleQuestions) {
      return deterministicShuffle(quizState.questions, studentKey);
    }
    return quizState.questions;
  });

  // Re-sync queue if questions change or shuffle toggle changes
  useEffect(() => {
    if (quizState.shuffleQuestions) {
      setQuestionQueue(deterministicShuffle(quizState.questions, studentKey));
    } else {
      setQuestionQueue(quizState.questions);
    }
  }, [quizState.questions, quizState.shuffleQuestions, studentKey]);

  // Local step index to ensure instant, reliable transition from question to question
  const [localStep, setLocalStep] = useState<number>(() => {
    return studentProgress?.currentQuestionIndex || 0;
  });

  // Re-sync localStep if remote progress is further ahead (e.g. on page refresh)
  useEffect(() => {
    if (studentProgress?.currentQuestionIndex !== undefined && studentProgress.currentQuestionIndex > localStep) {
      setLocalStep(studentProgress.currentQuestionIndex);
    }
  }, [studentProgress?.currentQuestionIndex]);

  // Current active question index in the queue
  const currentStep = localStep;
  const isRetryRound = Boolean(studentProgress?.isInRetryRound);

  // When in retry round, questions to review
  const wrongIndices = studentProgress?.wrongQuestionIndices || [];
  const retryQuestions = quizState.questions.filter(q => wrongIndices.includes(q.index));

  const [currentRetryIdx, setCurrentRetryIdx] = useState(0);

  // Active question being displayed
  const currentQ: QuizQuestionItem | undefined = isRetryRound
    ? retryQuestions[currentRetryIdx]
    : questionQueue[currentStep];

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; pointsEarned: number } | null>(null);

  // Timing
  const questionStartTimeRef = useRef<number>(Date.now());
  useEffect(() => {
    questionStartTimeRef.current = Date.now();
    setSelectedOption(null);
    setTextInput('');
    setFeedback(null);
  }, [currentStep, isRetryRound, currentRetryIdx]);

  // Check if finished - only when student has actually completed all questions in the queue
  const totalQuestions = questionQueue.length || quizState.questions.length || 1;
  const isFinished = (questionQueue.length > 0 && currentStep >= questionQueue.length);

  // When student finishes all questions in queue, notify server
  useEffect(() => {
    if (isFinished && !isRetryRound && !studentProgress?.isFinished) {
      markStudentQuizFinished(studentKey).catch(() => {});
    }
  }, [isFinished, isRetryRound, studentKey, studentProgress?.isFinished]);

  // Advance step helper (clears inputs, increments question index)
  const advanceToNext = () => {
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

    // Automatically transition to next question after 1s (or immediately if feedback disabled)
    if (quizState.showInstantFeedback) {
      setTimeout(advanceToNext, 1100);
    } else {
      advanceToNext();
    }
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
      setTimeout(advanceToNext, 1100);
    } else {
      advanceToNext();
    }
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
        ) : isFinished && !isRetryRound ? (
          /* ============================================================== */
          /* STUDENT FINISHED SCREEN */
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
                أحسنت يا بطل! أتممت التحدي 🌟
              </h2>
              <p className="text-xs md:text-sm text-slate-400">
                تم تسجيل كافة إجاباتك بنجاح. انظر للشاشة الرئيسية لمتابعة التتويج والمراكز النهائية!
              </p>
            </div>

            {/* Score Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
                <div className="text-xs text-slate-400 mb-1">النقاط الكلية</div>
                <div className="text-xl font-black text-amber-400">
                  {(studentProgress?.totalScore || 0).toLocaleString()}
                </div>
              </div>
              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
                <div className="text-xs text-slate-400 mb-1">الإجابات الصحيحة</div>
                <div className="text-xl font-black text-emerald-400">
                  {studentProgress?.correctCount || 0} / {totalQuestions}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1 p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
                <div className="text-xs text-slate-400 mb-1">المركز الحالي</div>
                <div className="text-xl font-black text-sky-400">
                  {studentProgress?.rank ? `#${studentProgress.rank}` : '-'}
                </div>
              </div>
            </div>

            {/* Option to Retry Wrong Answers if enabled and has wrong questions */}
            {quizState.allowRetryWrong && (studentProgress?.wrongCount || 0) > 0 && (
              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl space-y-2 text-right">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                  <RefreshCw className="w-4 h-4" />
                  <span>فرصة إضافية للتعلم والتميز!</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  لديك ({studentProgress?.wrongCount}) أسئلة يمكنك إعادة محاولة حلها الآن لترسيخ الفهم وكسب نقاط إضافية:
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

            <div className="pt-2 text-xs text-slate-500">
              في انتظار إعلان المعلم للمراكز الأولى على شاشة العرض... 🏆
            </div>
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
            {currentQ.isTextAnswer ? (
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
                <button
                  type="submit"
                  disabled={!textInput.trim() || isSubmitting || feedback !== null}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-40 text-slate-950 font-black rounded-2xl text-base shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  <span>تأكيد الإجابة</span>
                </button>
              </form>
            ) : (
              /* Multiple Choice Buttons */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(currentQ.options || []).map((opt, optIdx) => {
                  const letter = OPTION_LETTERS[optIdx] || String(optIdx + 1);
                  const isSelected = selectedOption === opt;
                  const colorClass = OPTION_COLORS[optIdx % OPTION_COLORS.length];

                  return (
                    <motion.button
                      key={optIdx}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectOption(opt, optIdx)}
                      disabled={isSubmitting || feedback !== null}
                      className={`relative p-4 md:p-5 rounded-2xl bg-gradient-to-r border text-right font-black text-sm md:text-base flex items-center gap-3 transition-all cursor-pointer shadow-md ${colorClass} ${
                        isSelected ? 'ring-4 ring-white/60 scale-[1.02]' : ''
                      }`}
                    >
                      <span className="w-8 h-8 rounded-xl bg-black/25 flex items-center justify-center text-xs font-black shrink-0 border border-white/20">
                        {letter}
                      </span>
                      <span className="flex-grow leading-snug">{opt}</span>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
