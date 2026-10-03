import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  Tv,
  Users,
  QrCode,
  Clock,
  CheckCircle2,
  Sparkles,
  Maximize2,
  Minimize2,
  MessageSquare,
  Flame,
  Award,
  Radio,
  X,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  LiveSessionState,
  LiveQuestionItem,
  LiveConnectedStudent,
} from '../types';
import {
  subscribeToLiveSession,
  getLiveSessionState,
  toggleShowChatInRoom,
  deleteStudentMessage,
  replyToStudentMessage,
  clearAllStudentMessages,
  sendTeacherBroadcastMessage,
  formatSecondsToTime,
} from '../api';
import LiveChatModal from './LiveChatModal';

interface LiveDirectDisplayRoomProps {
  onBackToAdmin?: () => void;
}

export default function LiveDirectDisplayRoom({
  onBackToAdmin,
}: LiveDirectDisplayRoomProps) {
  const [sessionState, setSessionState] = useState<LiveSessionState | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sound effects
  const playSound = (type: 'tick' | 'reveal' | 'chime') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'tick') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'reveal') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {}
  };

  // Connect to Live Session via Firebase WebSockets
  useEffect(() => {
    const unsubscribe = subscribeToLiveSession((state) => {
      if (state) {
        setSessionState(state);
      }
    });
    return () => unsubscribe();
  }, []);

  // Countdown timer when a question is active
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (sessionState?.status === 'question_active' && sessionState.questionTriggeredAt) {
      const limit = sessionState.timeLimit || 30;
      const calcRemaining = () => {
        const elapsed = Math.floor((Date.now() - (sessionState.questionTriggeredAt || 0)) / 1000);
        const rem = Math.max(0, limit - elapsed);
        setRemainingTime(rem);
        if (rem <= 5 && rem > 0) {
          playSound('tick');
        }
      };
      calcRemaining();
      timerRef.current = setInterval(calcRemaining, 1000);
    } else {
      setRemainingTime(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionState?.status, sessionState?.questionTriggeredAt, sessionState?.timeLimit]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // QR Code URL
  const effectivePin = sessionState?.sessionPin ? sessionState.sessionPin.trim() : '';
  const studentJoinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?page=live-student${effectivePin ? `&pin=${encodeURIComponent(effectivePin)}` : ''}`
    : '';
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(studentJoinUrl)}`;

  // Question Statistics
  const totalConnected = (sessionState?.connectedStudents || []).length;
  const currentAnswers = sessionState?.answersForCurrentQuestion || {};
  const answeredCount = Object.keys(currentAnswers).length;

  const currentQ = sessionState?.currentQuestion;
  const options = currentQ?.options || [];

  // Count votes per option
  const optionCounts = useMemo(() => {
    const counts: number[] = new Array(options.length).fill(0);
    Object.values(currentAnswers).forEach((sub) => {
      const ans = String(sub.answer).trim();
      // Try 1-based index
      const num = parseInt(ans, 10);
      if (!isNaN(num) && num >= 1 && num <= options.length) {
        counts[num - 1]++;
      } else {
        // Try direct text match
        const foundIdx = options.findIndex(o => o.trim().toLowerCase() === ans.toLowerCase());
        if (foundIdx >= 0) counts[foundIdx]++;
      }
    });
    return counts;
  }, [currentAnswers, options]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950 font-sans" dir="rtl">
      {/* Top Theater Header Bar */}
      <header className="p-3 sm:p-5 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between gap-4 sticky top-0 z-40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-inner">
            <Mic className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold tracking-wider uppercase animate-pulse">
                <Radio className="w-3 h-3 text-rose-500" />
                <span>شرح مباشر Live</span>
              </span>
              <h1 className="text-sm sm:text-base font-black text-slate-100 truncate max-w-xs sm:max-w-md">
                {sessionState?.lessonTitle || 'حصة تفاعلية حية'}
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
              شاشة العرض المباشر للمسرح والبروجكتر • تفاعل حي ومتزامن
            </p>
          </div>
        </div>

        {/* Center / Right Control Badges */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* PIN Badge */}
          {sessionState?.sessionPin && (
            <div className="flex items-center gap-2 bg-slate-950 border border-amber-500/30 px-3 py-1.5 rounded-xl shadow-inner">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">PIN:</span>
              <span className="font-mono text-base font-black text-amber-300 tracking-widest">{sessionState.sessionPin}</span>
            </div>
          )}

          {/* QR Code Button */}
          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-xl transition-all cursor-pointer border border-slate-800"
            title="عرض رمز QR للدخول"
          >
            <QrCode className="w-4 h-4" />
          </button>

          {/* Connected Students Badge */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-300">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>{totalConnected} طالب متصل</span>
          </div>

          {/* Chat Modal Button */}
          <button
            type="button"
            onClick={() => setShowChatModal(true)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-800 transition-all cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">المحادثة</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-[10px] font-mono text-indigo-300">
              {(sessionState?.messages || []).length}
            </span>
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl transition-all cursor-pointer border border-slate-800"
            title={isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Back to Admin (if provided) */}
          {onBackToAdmin && (
            <button
              type="button"
              onClick={onBackToAdmin}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              لوحة الإدارة
            </button>
          )}
        </div>
      </header>

      {/* Main Presentation Stage */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-6xl mx-auto w-full">
        {/* ========================================================================= */}
        {/* SCENARIO 1: EXPLANATION MODE (الأستاذ يشرح صوتياً/حضورياً) */}
        {/* ========================================================================= */}
        {(!sessionState || sessionState.status === 'idle' || sessionState.status === 'waiting' || sessionState.status === 'playing') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full text-center space-y-8 my-auto"
          >
            {/* Majestic Animated Podium Icon */}
            <div className="relative inline-block">
              <div className="absolute -inset-6 bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-teal-500/20 rounded-full blur-2xl animate-pulse" />
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-slate-900 border-2 border-amber-500/40 text-amber-400 flex items-center justify-center shadow-2xl mx-auto">
                <Mic className="w-14 h-14 sm:w-18 sm:h-18 animate-bounce text-amber-400" />
              </div>
            </div>

            <div className="space-y-3 max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs sm:text-sm">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>الأستاذ يشرح الآن 🎙️</span>
              </span>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-100 tracking-tight leading-tight">
                {sessionState?.lessonTitle || 'حصة تدريبية تفاعلية حية'}
              </h2>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-lg mx-auto">
                استمع بتركيز للشرح والملاحظات • سيتم طرح الأسئلة التفاعلية على هذه الشاشة وفي هواتفكم في أي لحظة.
              </p>
            </div>

            {/* Quick Live Stats Pill */}
            <div className="inline-flex items-center gap-6 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-xl">
              <div className="flex items-center gap-2 text-indigo-400">
                <Users className="w-5 h-5" />
                <span className="text-xs font-bold">الطلاب الحاضرون:</span>
                <span className="font-mono text-base font-black text-slate-100">{totalConnected}</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div className="flex items-center gap-2 text-amber-400">
                <QrCode className="w-5 h-5" />
                <span className="text-xs font-bold">رمز الانضمام:</span>
                <span className="font-mono text-base font-black text-amber-300">{effectivePin || '---'}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ========================================================================= */}
        {/* SCENARIO 2: QUESTION ACTIVE / REVEALED MODE (طرح السؤال وعرض الخيارات) */}
        {/* ========================================================================= */}
        {(sessionState?.status === 'question_active' || sessionState?.status === 'revealed') && currentQ && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full space-y-6 my-auto"
          >
            {/* Top Question Info Bar with Circular Countdown Timer */}
            <div className="flex items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-3xl shadow-xl">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-md">
                  س{(sessionState.currentQuestionIndex ?? 0) + 1}
                </span>
                <div>
                  <div className="text-xs text-slate-400 font-bold">السؤال التفاعلي المباشر</div>
                  <div className="text-xs font-mono text-amber-400 font-semibold">
                    أجاب {answeredCount} من {totalConnected} طالب
                  </div>
                </div>
              </div>

              {/* Timer & Revealed Badge */}
              <div className="flex items-center gap-3">
                {sessionState.status === 'question_active' && (
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-mono text-base font-black border transition-all ${
                    remainingTime <= 5
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse ring-2 ring-rose-500/30'
                      : 'bg-slate-950 border-amber-500/30 text-amber-300'
                  }`}>
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>{formatSecondsToTime(remainingTime)}</span>
                  </div>
                )}

                {sessionState.status === 'revealed' && (
                  <span className="px-4 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center gap-1.5 shadow-md">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>تم كشف الإجابة الصحيحة 🌟</span>
                  </span>
                )}
              </div>
            </div>

            {/* Question Text Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-4">
              <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-slate-100 leading-snug">
                {currentQ.question}
              </h2>
            </div>

            {/* Options Grid (with real-time vote percentage bars) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {options.map((opt, idx) => {
                const optLetter = ['أ', 'ب', 'ج', 'د', 'هـ'][idx] || String(idx + 1);
                const voteCount = optionCounts[idx] || 0;
                const percentage = answeredCount > 0 ? Math.round((voteCount / answeredCount) * 100) : 0;

                const isCorrect = sessionState.status === 'revealed' && (
                  String(idx + 1) === String(currentQ.correctAnswer).trim() ||
                  opt.trim().toLowerCase() === String(currentQ.correctAnswer).trim().toLowerCase()
                );

                return (
                  <div
                    key={idx}
                    className={`relative overflow-hidden p-5 sm:p-6 rounded-3xl border-2 transition-all shadow-xl flex items-center justify-between ${
                      isCorrect
                        ? 'bg-emerald-950/70 border-emerald-400 ring-4 ring-emerald-500/30 shadow-emerald-500/20'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    {/* Live Vote Progress Fill Bar */}
                    <div
                      className={`absolute inset-y-0 right-0 transition-all duration-500 pointer-events-none ${
                        isCorrect ? 'bg-emerald-500/20' : 'bg-indigo-600/15'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />

                    {/* Option Text and Letter */}
                    <div className="relative z-10 flex items-center gap-4">
                      <span className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-black text-base sm:text-lg shadow-md shrink-0 ${
                        isCorrect
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-indigo-300'
                      }`}>
                        {optLetter}
                      </span>
                      <span className="text-base sm:text-xl font-bold text-slate-100">
                        {opt}
                      </span>
                    </div>

                    {/* Stats & Badge */}
                    <div className="relative z-10 flex items-center gap-2 font-mono">
                      {isCorrect && (
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-500/30 text-emerald-300 text-xs font-bold">
                          صحيحة ✓
                        </span>
                      )}
                      <span className="text-sm sm:text-base font-bold text-slate-300">
                        {voteCount} ({percentage}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ========================================================================= */}
        {/* SCENARIO 3: FINISHED SESSION MODE */}
        {/* ========================================================================= */}
        {sessionState?.status === 'finished' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full text-center space-y-6 my-auto"
          >
            <div className="w-24 h-24 rounded-3xl bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-2xl mx-auto">
              <Award className="w-12 h-12" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-4xl font-black text-slate-100">
                تم إنهاء الحصة المباشرة بنجاح 🏁
              </h2>
              <p className="text-sm text-slate-400">
                شكراً لتفاعلكم! تم حفظ جميع الإجابات والنتائج بنجاح في ورقة Answers-Live.
              </p>
            </div>
          </motion.div>
        )}
      </main>

      {/* Footer Branding Bar */}
      <footer className="p-3 sm:p-4 bg-slate-950/80 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <span>نظام الحصص المباشرة والأسئلة الحية (Live)</span>
        <span>متزامن لحظياً عبر السحابة ⚡</span>
      </footer>

      {/* QR Code Modal Overlay */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-4 shadow-2xl relative"
            >
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute top-4 left-4 p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-black text-slate-100">رمز الدخول السريع (QR Code)</h3>
              <p className="text-xs text-slate-400">امسح الكود بكاميرا الجوال للانضمام المباشر للحصة</p>
              <div className="p-4 bg-white rounded-2xl inline-block shadow-inner">
                <img src={qrCodeUrl} alt="QR Code" className="w-56 h-56 object-contain" />
              </div>
              <div className="font-mono text-xl font-black text-amber-400 tracking-widest bg-slate-950 p-3 rounded-2xl border border-slate-800">
                PIN: {effectivePin || '---'}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Chat & Student Messages Modal */}
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
