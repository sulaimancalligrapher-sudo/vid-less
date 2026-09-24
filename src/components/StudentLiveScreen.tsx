import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Radio,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Send,
  Sparkles,
  Award,
  User,
  Hash,
  Tv,
  Eye,
  Check,
} from 'lucide-react';
import { liveSocket, LiveMessage } from '../lib/liveSocket';

interface StudentLiveScreenProps {
  initialPin?: string;
  onExit?: () => void;
}

interface IncomingQuestion {
  id: string | number;
  time: number;
  question: string;
  options: string[];
  image?: string;
}

export default function StudentLiveScreen({ initialPin, onExit }: StudentLiveScreenProps) {
  // Join form state
  const [pin, setPin] = useState(initialPin || '');
  const [studentName, setStudentName] = useState(() => localStorage.getItem('live_student_name') || '');
  const [sheetNumber, setSheetNumber] = useState(() => localStorage.getItem('live_student_sheet') || '');
  const [isJoined, setIsJoined] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Live session state
  const [roomTitle, setRoomTitle] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [sessionStatus, setSessionStatus] = useState<string>('lobby');
  const [activeQuestion, setActiveQuestion] = useState<IncomingQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<string>('');
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [explanation, setExplanation] = useState<string>('');
  const [score, setScore] = useState(0);
  const [totalQuestionsAnswered, setTotalQuestionsAnswered] = useState(0);

  // 1. Connect WebSocket
  useEffect(() => {
    liveSocket.connect();

    const unsubscribe = liveSocket.subscribe((msg: LiveMessage) => {
      switch (msg.type) {
        case 'JOIN_SUCCESS': {
          setIsJoined(true);
          setIsJoining(false);
          const room = msg.payload?.room;
          if (room) {
            setRoomTitle(room.lessonTitle || 'الدرس المباشر');
            setTeacherName(room.teacherName || 'الأستاذ');
            setSessionStatus(room.status || 'lobby');
            if (room.activeQuestion) {
              setActiveQuestion(room.activeQuestion);
            }
          }
          break;
        }

        case 'JOIN_ERROR': {
          setIsJoining(false);
          setJoinError(msg.message || 'تعذر الانضمام، تأكد من صحة رمز الجلسة.');
          break;
        }

        case 'NEW_QUESTION': {
          setActiveQuestion(msg.payload?.question || null);
          setSessionStatus('question_active');
          setSelectedOption(null);
          setSelectedIndex(null);
          setIsSubmitted(false);
          setIsCorrect(null);
          setCorrectAnswer('');
          setCorrectIndex(null);
          setExplanation('');
          // Vibrate device if supported
          if (navigator.vibrate) {
            navigator.vibrate(200);
          }
          break;
        }

        case 'ANSWER_RECEIVED': {
          setIsSubmitted(true);
          break;
        }

        case 'RESULTS_REVEALED': {
          setSessionStatus('showing_results');
          setCorrectAnswer(msg.payload?.correctAnswer || '');
          setCorrectIndex(msg.payload?.correctIndex ?? null);
          setExplanation(msg.payload?.explanation || '');

          // Check if my answer was correct
          if (selectedOption !== null) {
            const numAns = parseInt(msg.payload?.correctAnswer);
            const myIdx = selectedIndex;
            let myCorrect = false;
            if (!isNaN(numAns) && myIdx !== null) {
              myCorrect = myIdx === numAns - 1;
            } else {
              myCorrect = String(selectedOption).trim().toLowerCase() === String(msg.payload?.correctAnswer).trim().toLowerCase();
            }
            setIsCorrect(myCorrect);
            if (myCorrect) {
              setScore((prev) => prev + 1);
            }
            setTotalQuestionsAnswered((prev) => prev + 1);
          }
          break;
        }

        case 'QUESTION_DISMISSED': {
          setActiveQuestion(null);
          setSelectedOption(null);
          setSelectedIndex(null);
          setIsSubmitted(false);
          setIsCorrect(null);
          setSessionStatus('playing');
          break;
        }

        case 'SESSION_ENDED': {
          setSessionStatus('ended');
          break;
        }

        default:
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [selectedOption, selectedIndex]);

  // Handle Join
  const handleJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin.trim() || !studentName.trim()) {
      setJoinError('يرجى كتابة رمز الجلسة واسمك أولاً.');
      return;
    }

    setJoinError('');
    setIsJoining(true);

    localStorage.setItem('live_student_name', studentName.trim());
    if (sheetNumber.trim()) {
      localStorage.setItem('live_student_sheet', sheetNumber.trim());
    }

    liveSocket.send('STUDENT_JOIN', {
      pin: pin.trim(),
      studentName: studentName.trim(),
      sheetNumber: sheetNumber.trim(),
    });
  };

  // Handle Option Select
  const handleSelectOption = (opt: string, idx: number) => {
    if (isSubmitted || sessionStatus === 'showing_results') return;
    setSelectedOption(opt);
    setSelectedIndex(idx);
  };

  // Submit Answer
  const handleSubmitAnswer = () => {
    if (!activeQuestion || selectedOption === null || isSubmitted) return;

    setIsSubmitted(true);
    liveSocket.send('SUBMIT_ANSWER', {
      questionId: activeQuestion.id,
      selectedOption,
      selectedIndex,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none" dir="rtl">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800/80 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg">
            <Radio className="w-4 h-4 animate-pulse" />
          </span>
          <div>
            <h1 className="text-sm font-extrabold text-slate-100">بوابة إجابة الطالب المباشرة</h1>
            {isJoined && (
              <p className="text-[10px] text-slate-400">
                الأستاذ: <span className="text-slate-200 font-bold">{teacherName}</span> | رمز الجلسة: <span className="text-amber-400 font-mono font-bold">{pin}</span>
              </p>
            )}
          </div>
        </div>

        {isJoined ? (
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs rounded-full font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              متصل بالحصة
            </span>
          </div>
        ) : (
          onExit && (
            <button onClick={onExit} className="text-xs text-slate-400 hover:text-slate-200">
              خروج
            </button>
          )
        )}
      </header>

      {/* Main View */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {!isJoined ? (
          /* Join Card */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl text-right"
          >
            <div className="text-center mb-6">
              <div className="inline-flex p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl mb-2.5">
                <Radio className="w-7 h-7 animate-pulse" />
              </div>
              <h2 className="text-lg font-black text-slate-100">انضم للحصة المباشرة</h2>
              <p className="text-xs text-slate-400 mt-1">اكتب رمز الجلسة من شاشة الأستاذ واسمك للمشاركة</p>
            </div>

            <form onSubmit={handleJoin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">رمز الجلسة (PIN):</label>
                <input
                  type="text"
                  dir="ltr"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="4821"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-amber-400 rounded-xl outline-none transition-all text-center font-mono text-xl tracking-widest font-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسمك الكامل:</label>
                <div className="relative">
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="مثال: أحمد محمد"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-200 rounded-xl outline-none transition-all text-sm font-semibold pr-10"
                  />
                  <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">رقم الشيت الخاص بك (اختياري):</label>
                <div className="relative">
                  <input
                    type="text"
                    dir="ltr"
                    value={sheetNumber}
                    onChange={(e) => setSheetNumber(e.target.value)}
                    placeholder="مثال: 222"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-200 rounded-xl outline-none transition-all text-sm font-semibold pr-10"
                  />
                  <Hash className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                </div>
              </div>

              {joinError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{joinError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isJoining}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/10 active:scale-98 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-60"
              >
                {isJoining ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Radio className="w-4 h-4" />
                    <span>انضمام للحصة الآن</span>
                  </>
                )}
              </button>
            </form>
          </motion.div>
        ) : activeQuestion ? (
          /* Active Question Card */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col text-right"
          >
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4" />
                سؤال مباشر الآن!
              </span>
              <span className="text-[11px] text-slate-400">
                الطالب: <strong className="text-slate-200">{studentName}</strong>
              </span>
            </div>

            {/* Question Text */}
            <h2 className="text-lg sm:text-xl font-black text-slate-100 mb-5 leading-relaxed">
              {activeQuestion.question}
            </h2>

            {/* Options List */}
            <div className="space-y-2.5 mb-6">
              {(activeQuestion.options || []).map((opt, idx) => {
                const isSelected = selectedIndex === idx;
                const isOptionCorrect = correctIndex !== null && correctIndex === idx;
                const isOptionWrong = isSelected && isCorrect === false;

                let cardClasses = 'bg-slate-950/80 border-slate-800 text-slate-200 hover:border-slate-700';

                if (sessionStatus === 'showing_results') {
                  if (isOptionCorrect) {
                    cardClasses = 'bg-emerald-500/20 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/50';
                  } else if (isOptionWrong) {
                    cardClasses = 'bg-rose-500/20 border-rose-500 text-rose-200';
                  } else {
                    cardClasses = 'bg-slate-950/40 border-slate-800 text-slate-500 opacity-50';
                  }
                } else if (isSelected) {
                  cardClasses = 'bg-amber-500/15 border-amber-500 text-amber-300 ring-2 ring-amber-500/40';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(opt, idx)}
                    disabled={isSubmitted || sessionStatus === 'showing_results'}
                    className={`w-full min-h-[52px] p-3.5 rounded-2xl border text-right transition-all flex items-center justify-between text-sm font-bold cursor-pointer disabled:cursor-default ${cardClasses}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-slate-800 flex items-center justify-center text-xs font-mono font-bold text-slate-300 shrink-0">
                        {['أ', 'ب', 'ج', 'د'][idx] || idx + 1}
                      </span>
                      <span>{opt}</span>
                    </div>

                    {sessionStatus === 'showing_results' ? (
                      isOptionCorrect ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : isOptionWrong ? (
                        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                      ) : null
                    ) : (
                      isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Submit / Status Button */}
            {sessionStatus === 'showing_results' ? (
              <div
                className={`p-4 rounded-2xl text-center text-xs font-bold border flex items-center justify-center gap-2 ${
                  isCorrect
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                }`}
              >
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>إجابة صحيحة! أحسنت يا بطل 🎉</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                    <span>إجابة خاطئة. الإجابة الصحيحة هي: {correctAnswer}</span>
                  </>
                )}
              </div>
            ) : isSubmitted ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-center text-xs font-bold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4.5 h-4.5" />
                <span>تم إرسال إجابتك بنجاح! بانتظار إشارة الأستاذ ⏳</span>
              </div>
            ) : (
              <button
                onClick={handleSubmitAnswer}
                disabled={selectedIndex === null}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-black rounded-2xl text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 transition-all active:scale-95 shadow-lg shadow-amber-500/10"
              >
                <Send className="w-4 h-4" />
                <span>إرسال إجابتي</span>
              </button>
            )}
          </motion.div>
        ) : (
          /* Waiting / Focus Mode */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-xl"
          >
            <div className="w-20 h-20 rounded-full bg-slate-950 border border-slate-800 mx-auto flex items-center justify-center mb-5 relative">
              <Eye className="w-9 h-9 text-amber-400 animate-pulse" />
              <div className="absolute inset-0 rounded-full border-2 border-amber-500/30 animate-ping" />
            </div>

            <h3 className="text-base font-extrabold text-slate-100 mb-2">شاهد شاشة الأستاذ بتركيز</h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto mb-6">
              يتم تشغيل الفيديو والشرح على الشاشة الكبيرة.. سينبثق السؤال وخيارات الإجابة هنا فور توقف الأستاذ!
            </p>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">نقاطك الحالية:</span>
              <span className="font-mono font-bold text-amber-400">
                {score} / {totalQuestionsAnswered}
              </span>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
