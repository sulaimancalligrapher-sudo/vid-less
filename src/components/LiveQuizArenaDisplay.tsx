import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, Flame, Clock, Award, Users, CheckCircle2, 
  Crown, Sparkles, Volume2, VolumeX, Maximize2, Flag, ArrowRight,
  TrendingUp, BarChart3, Star, Zap, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import { QuizActiveState, QuizStudentProgress, LiveConnectedStudent } from '../types';
import LiveAttendanceChart from './LiveAttendanceChart';
import { launchLiveQuizQuestions } from '../api';

interface LiveQuizArenaDisplayProps {
  quizState: QuizActiveState;
  connectedStudents?: LiveConnectedStudent[];
  onEndQuiz?: () => void;
  onBackToPresentation?: () => void;
  isPresenter?: boolean;
}

// Simple synthesizer for audio effects via browser Web Audio API
class ArenaSoundEffects {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Lazily init on first user interaction
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  playScorePing() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } catch {}
  }

  playFanfare() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + (i * 0.12));
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime + (i * 0.12));
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (i * 0.12) + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + (i * 0.12));
        osc.stop(this.ctx.currentTime + (i * 0.12) + 0.5);
      });
    } catch {}
  }
}

export default function LiveQuizArenaDisplay({
  quizState,
  connectedStudents = [],
  onEndQuiz,
  onBackToPresentation,
  isPresenter = false,
}: LiveQuizArenaDisplayProps) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundRef = useRef<ArenaSoundEffects | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [showFullTable, setShowFullTable] = useState(false);
  const prevTopScorerRef = useRef<string | null>(null);

  useEffect(() => {
    soundRef.current = new ArenaSoundEffects();
    return () => {
      soundRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.setMuted(!soundEnabled);
    }
  }, [soundEnabled]);

  // Timer Countdown calculation
  useEffect(() => {
    if (quizState.quizStatus !== 'in_progress') {
      setSecondsRemaining(null);
      return;
    }

    if (!quizState.endTime) {
      // Unlimited timer -> calculate elapsed time
      const interval = setInterval(() => {
        if (quizState.startTime) {
          const elapsed = Math.floor((Date.now() - quizState.startTime) / 1000);
          setSecondsRemaining(elapsed);
        }
      }, 1000);
      return () => clearInterval(interval);
    }

    const updateRem = () => {
      const now = Date.now();
      const rem = Math.max(0, Math.floor((quizState.endTime! - now) / 1000));
      setSecondsRemaining(rem);
      if (rem === 0 && onEndQuiz && isPresenter) {
        onEndQuiz();
      }
    };

    updateRem();
    const interval = setInterval(updateRem, 1000);
    return () => clearInterval(interval);
  }, [quizState.quizStatus, quizState.endTime, quizState.startTime]);

  // Sound ping on participant score change
  const participants = Object.values(quizState.participants || {});
  const totalScoreSum = participants.reduce((acc, p) => acc + (p.totalScore || 0), 0);
  const prevScoreSumRef = useRef<number>(0);

  useEffect(() => {
    if (totalScoreSum > prevScoreSumRef.current) {
      if (prevScoreSumRef.current > 0) {
        soundRef.current?.playScorePing();
      }
      prevScoreSumRef.current = totalScoreSum;
    }
  }, [totalScoreSum]);

  // Play fanfare on quiz ended
  useEffect(() => {
    if (quizState.quizStatus === 'ended') {
      soundRef.current?.playFanfare();
    }
  }, [quizState.quizStatus]);

  // Sort participants by score descending, then time taken ascending
  const sortedParticipants = [...participants].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return (a.totalTimeTaken || 99999) - (b.totalTimeTaken || 99999);
  });

  const totalQuestions = quizState.questions.length || 1;
  const completedCount = participants.filter(p => p.isFinished).length;
  const maxScore = sortedParticipants.length > 0 ? Math.max(...sortedParticipants.map(p => p.totalScore), 1) : 1;

  // Podium top participants
  const firstPlace = sortedParticipants[0] || null;
  const secondPlace = sortedParticipants[1] || null;
  const thirdPlace = sortedParticipants[2] || null;
  const podiumLimit = quizState.podiumCount || 3;
  const remainingFinalists = sortedParticipants.slice(3, podiumLimit);

  // Format timer display
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-gradient-to-br from-slate-950 via-[#0a0f1d] to-[#120e24] text-white overflow-y-auto select-none font-sans flex flex-col">
      {/* Background glowing ambient orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Top Arena Navigation / Status Bar */}
      <header className="relative z-20 px-6 py-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black">
            <Trophy className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                تحدي كويز المباشر ⚡
              </span>
              <span className="text-xs text-slate-400 font-bold">
                {quizState.quizStatus === 'waiting'
                  ? 'قاعة الانتظار والاستعداد ⏳'
                  : quizState.quizStatus === 'in_progress'
                    ? 'المسابقة جارية الآن ⚡'
                    : 'انتهى التحدي 🏆'}
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-black text-slate-100 tracking-tight">
              {quizState.quizTitle || 'مسابقة الأسئلة السريعة'}
            </h1>
          </div>
        </div>

        {/* Center: Live Timer Badge */}
        <div className="flex items-center gap-3">
          {quizState.quizStatus === 'in_progress' && (
            <div className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl border font-mono font-bold text-base md:text-lg shadow-md transition-all ${
              quizState.endTime && (secondsRemaining || 0) <= 30
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse'
                : 'bg-slate-800/80 border-slate-700 text-amber-400'
            }`}>
              <Clock className="w-5 h-5 text-amber-400" />
              <span>
                {quizState.endTime
                  ? formatTime(secondsRemaining || 0)
                  : `مفتوح: ${formatTime(secondsRemaining || 0)}`}
              </span>
            </div>
          )}

          {/* Connected & Completed Stats */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border border-slate-700/60 rounded-xl text-xs text-slate-300">
            <Users className="w-4 h-4 text-sky-400" />
            <span className="font-bold text-slate-100">{participants.length}</span> مشارك
            <span className="text-slate-500">•</span>
            <span className="font-bold text-emerald-400">{completedCount}</span> أتموا
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Presenter Quick Launch in Header when in waiting */}
          {quizState.quizStatus === 'waiting' && isPresenter && (
            <button
              onClick={async () => { await launchLiveQuizQuestions(); }}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/25 flex items-center gap-1.5 cursor-pointer transition-all animate-pulse"
            >
              <Zap className="w-4 h-4 fill-slate-950 text-slate-950" />
              <span>ابدأ الآن ({participants.length})</span>
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
            title={soundEnabled ? 'كتم المؤثرات الصوتية' : 'تشغيل المؤثرات الصوتية'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* End Quiz button for presenter */}
          {quizState.quizStatus === 'in_progress' && isPresenter && onEndQuiz && (
            <button
              onClick={onEndQuiz}
              className="px-4 py-2 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-500/25 flex items-center gap-2 cursor-pointer transition-all"
            >
              <Flag className="w-4 h-4" />
              <span>إنهاء وإعلان الفائزين</span>
            </button>
          )}

          {onBackToPresentation && (
            <button
              onClick={onBackToPresentation}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              العودة للشرح
            </button>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="relative z-10 flex-grow p-4 md:p-8 flex flex-col items-center justify-start max-w-7xl mx-auto w-full">
        {quizState.quizStatus === 'waiting' ? (() => {
          // Merge participants with live connected students
          const readyMap = quizState.participants || {};
          const readyKeys = new Set(Object.keys(readyMap));
          const lobbyList: Array<{ username: string; studentName?: string; sheetNumber?: string; isReady: boolean }> = [];
          const processed = new Set<string>();

          // 1. Students who clicked 'أنا مستعد' (ready)
          sortedParticipants.forEach(p => {
            lobbyList.push({
              username: p.username,
              studentName: p.studentName || p.username,
              sheetNumber: p.sheetNumber,
              isReady: true,
            });
            processed.add(p.studentKey);
          });

          // 2. Connected students from live explanation who haven't clicked yet
          if (connectedStudents && connectedStudents.length > 0) {
            connectedStudents.forEach(cs => {
              const key = `${cs.username.trim().toLowerCase()}_${String(cs.sheetNumber || '').trim()}`;
              if (!processed.has(key)) {
                lobbyList.push({
                  username: cs.username,
                  studentName: cs.studentName || cs.username,
                  sheetNumber: cs.sheetNumber,
                  isReady: readyKeys.has(key),
                });
                processed.add(key);
              }
            });
          }

          const totalLobbyCount = Math.max(lobbyList.length, sortedParticipants.length);
          const readyLobbyCount = sortedParticipants.length;

          return (
            /* ============================================================== */
            /* STAGE 0: PRE-QUIZ WAITING LOBBY & LIVE ATTENDANCE CHART */
            /* ============================================================== */
            <div className="w-full my-auto py-4">
              <LiveAttendanceChart
                students={lobbyList}
                readyCount={readyLobbyCount}
                totalSessionCount={totalLobbyCount}
                title={`قاعة الانتظار: ${quizState.quizTitle || 'مسابقة التحدي التفاعلي'}`}
                subtitle="الطلاب الحاضرون بالقاعة • كل طالب ينقر على [أنا مستعد] تظهر بطاقته فوراً ويرتفع مؤشر الجاهزية ⚡"
                showLaunchButton={isPresenter}
                onLaunch={async () => { await launchLiveQuizQuestions(); }}
                launchLabel="ابدأ المسابقة والتحدي الآن لجميع الطلاب"
              />
            </div>
          );
        })() : quizState.quizStatus === 'in_progress' ? (
          /* ============================================================== */
          /* LIVE RACING LEADERBOARD (أشرطة السباق التفاعلية اللحظية) */
          /* ============================================================== */
          <div className="w-full space-y-6">
            {/* Header info bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
                <span className="text-sm font-black text-slate-200">
                  لوحة الترتيب اللحظية المباشرة (Racing Arena)
                </span>
                <span className="text-xs text-slate-400">
                  (تتحرك الأشرطة وترتفع النقاط لحظياً مع كل إجابة صحيحة للطلاب)
                </span>
              </div>
              <div className="text-xs text-slate-400 font-medium">
                إجمالي الأسئلة: <span className="font-bold text-amber-400">{totalQuestions} أسئلة</span>
              </div>
            </div>

            {/* If no participants yet */}
            {sortedParticipants.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 text-center bg-slate-900/40 border border-slate-800/60 rounded-3xl backdrop-blur-sm">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 animate-bounce">
                  <Zap className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-200 mb-1">في انتظار إجابات الطلاب الأولى...</h3>
                <p className="text-xs text-slate-400 max-w-md">
                  الطلاب الآن يستعرضون الأسئلة ويجيبون من أجهزتهم. ستظهر أشرطة التقدم فور تقديم أول إجابة!
                </p>
              </div>
            ) : (
              /* Participant Racing Bars */
              <div className="space-y-3">
                <AnimatePresence>
                  {sortedParticipants.map((participant, index) => {
                    const answeredCount = Object.keys(participant.answers || {}).length;
                    const progressPercent = Math.min(100, Math.round((answeredCount / totalQuestions) * 100));
                    const scoreRatio = Math.min(100, Math.round((participant.totalScore / maxScore) * 100));
                    const isTopThree = index < 3;

                    return (
                      <motion.div
                        key={participant.studentKey}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className={`relative p-3.5 md:p-4 rounded-2xl border transition-all ${
                          index === 0
                            ? 'bg-gradient-to-r from-amber-500/15 via-slate-900/90 to-slate-900/80 border-amber-500/40 shadow-lg shadow-amber-500/10'
                            : index === 1
                            ? 'bg-gradient-to-r from-slate-300/10 via-slate-900/90 to-slate-900/80 border-slate-400/30'
                            : index === 2
                            ? 'bg-gradient-to-r from-amber-700/15 via-slate-900/90 to-slate-900/80 border-amber-700/30'
                            : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Rank Badge */}
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                              index === 0
                                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                                : index === 1
                                ? 'bg-slate-300 text-slate-950'
                                : index === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                            </div>

                            {/* Name & Sheet */}
                            <div className="truncate">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-sm md:text-base text-slate-100 truncate">
                                  {participant.studentName || participant.username}
                                </span>
                                {participant.sheetNumber && (
                                  <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                                    #{participant.sheetNumber}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Streak badge */}
                            {participant.streak > 1 && (
                              <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 border border-orange-500/40 rounded-full text-orange-400 text-xs font-bold animate-pulse">
                                <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
                                <span>متتالي x{participant.streak}</span>
                              </div>
                            )}

                            {participant.isFinished && (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>أتم الحل</span>
                              </span>
                            )}
                          </div>

                          {/* Score and Stats */}
                          <div className="flex items-center gap-4 shrink-0 text-right">
                            <div className="text-right">
                              <div className="text-xs text-slate-400">التقدم</div>
                              <div className="text-xs font-bold text-slate-200">
                                {answeredCount} / {totalQuestions}
                              </div>
                            </div>
                            <div className="text-right min-w-[70px]">
                              <div className="text-xs text-slate-400">النقاط</div>
                              <div className="text-base md:text-lg font-black text-amber-400">
                                {participant.totalScore.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Animated racing progress bar */}
                        <div className="relative w-full h-3 bg-slate-950/80 rounded-full overflow-hidden border border-slate-800/80">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(4, scoreRatio)}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            className={`h-full rounded-full transition-all ${
                              index === 0
                                ? 'bg-gradient-to-r from-amber-500 to-yellow-300 shadow-sm shadow-amber-400'
                                : index === 1
                                ? 'bg-gradient-to-r from-slate-400 to-slate-200'
                                : index === 2
                                ? 'bg-gradient-to-r from-amber-700 to-amber-500'
                                : 'bg-gradient-to-r from-indigo-500 to-sky-400'
                            }`}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        ) : (
          /* ============================================================== */
          /* GRAND PODIUM & FINALS (منصة التتويج النهائية الفاخرة) */
          /* ============================================================== */
          <div className="w-full space-y-10 animate-fade-in">
            {/* Podium Title */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
                <Sparkles className="w-4 h-4" />
                <span>إعلان نتائج المسابقة والتتويج</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-orange-400 tracking-tight">
                أبطال التحدي المتميزون 🏆
              </h2>
              <p className="text-xs md:text-sm text-slate-400">
                مبارك لجميع الفائزين والمشاركين على أدائهم الرائع وسرعة إجاباتهم
              </p>
            </div>

            {/* The 3-Pedestal Olympic Podium */}
            {sortedParticipants.length > 0 && (
              <div className="flex items-end justify-center gap-3 md:gap-6 pt-12 pb-4 px-2 max-w-3xl mx-auto">
                {/* 2nd Place (Silver) */}
                <div className="flex-1 flex flex-col items-center">
                  {secondPlace ? (
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                      className="w-full flex flex-col items-center"
                    >
                      <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-slate-300 border-4 border-slate-100 flex items-center justify-center font-black text-xl text-slate-900 shadow-xl shadow-slate-400/20 mb-2">
                        🥈
                      </div>
                      <span className="font-bold text-xs md:text-sm text-slate-200 text-center truncate max-w-[120px]">
                        {secondPlace.studentName || secondPlace.username}
                      </span>
                      <span className="text-xs font-black text-slate-300 mt-0.5">
                        {secondPlace.totalScore.toLocaleString()} نقطة
                      </span>
                      <div className="w-full h-32 md:h-44 bg-gradient-to-t from-slate-800 to-slate-700/80 rounded-t-3xl border-t-4 border-slate-300 flex items-center justify-center font-black text-2xl md:text-3xl text-slate-300 shadow-lg mt-3">
                        2
                      </div>
                    </motion.div>
                  ) : (
                    <div className="w-full h-32 bg-slate-900/40 rounded-t-3xl" />
                  )}
                </div>

                {/* 1st Place (Gold Champion) */}
                <div className="flex-1 flex flex-col items-center">
                  {firstPlace ? (
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4, duration: 0.6 }}
                      className="w-full flex flex-col items-center relative"
                    >
                      <Crown className="w-8 h-8 text-amber-400 fill-amber-400 absolute -top-9 animate-bounce" />
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 border-4 border-amber-200 flex items-center justify-center font-black text-2xl text-slate-950 shadow-2xl shadow-amber-400/40 mb-2">
                        🥇
                      </div>
                      <span className="font-black text-sm md:text-base text-amber-300 text-center truncate max-w-[140px]">
                        {firstPlace.studentName || firstPlace.username}
                      </span>
                      <span className="text-xs md:text-sm font-black text-amber-400 mt-0.5">
                        {firstPlace.totalScore.toLocaleString()} نقطة
                      </span>
                      <div className="w-full h-44 md:h-60 bg-gradient-to-t from-amber-900/60 via-amber-800/40 to-amber-600/30 rounded-t-3xl border-t-4 border-amber-400 flex flex-col items-center justify-center shadow-2xl shadow-amber-500/20 mt-3">
                        <span className="font-black text-4xl md:text-5xl text-amber-400">1</span>
                        <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest mt-1">
                          البطل الأول
                        </span>
                      </div>
                    </motion.div>
                  ) : null}
                </div>

                {/* 3rd Place (Bronze) */}
                <div className="flex-1 flex flex-col items-center">
                  {thirdPlace ? (
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.5 }}
                      className="w-full flex flex-col items-center"
                    >
                      <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-amber-800 border-4 border-amber-600 flex items-center justify-center font-black text-xl text-white shadow-xl shadow-amber-900/30 mb-2">
                        🥉
                      </div>
                      <span className="font-bold text-xs md:text-sm text-slate-200 text-center truncate max-w-[120px]">
                        {thirdPlace.studentName || thirdPlace.username}
                      </span>
                      <span className="text-xs font-black text-amber-500 mt-0.5">
                        {thirdPlace.totalScore.toLocaleString()} نقطة
                      </span>
                      <div className="w-full h-24 md:h-32 bg-gradient-to-t from-amber-950 to-amber-900/60 rounded-t-3xl border-t-4 border-amber-700 flex items-center justify-center font-black text-xl md:text-2xl text-amber-600 shadow-md mt-3">
                        3
                      </div>
                    </motion.div>
                  ) : (
                    <div className="w-full h-24 bg-slate-900/40 rounded-t-3xl" />
                  )}
                </div>
              </div>
            )}

            {/* Top 4-10 finalists cards if enabled */}
            {remainingFinalists.length > 0 && (
              <div className="max-w-4xl mx-auto space-y-3">
                <h4 className="text-xs font-bold text-slate-400 text-center">
                  المراكز المتقدمة (أفضل {podiumLimit} فائزين):
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {remainingFinalists.map((finalist, idx) => {
                    const actualRank = idx + 4;
                    return (
                      <div
                        key={finalist.studentKey}
                        className="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center gap-2.5"
                      >
                        <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center">
                          #{actualRank}
                        </span>
                        <div className="min-w-0 truncate">
                          <div className="font-bold text-xs text-slate-200 truncate">
                            {finalist.studentName || finalist.username}
                          </div>
                          <div className="text-[11px] font-mono text-amber-400 font-bold">
                            {finalist.totalScore.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Toggle Full Leaderboard Table */}
            <div className="max-w-4xl mx-auto pt-4">
              <button
                onClick={() => setShowFullTable(!showFullTable)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl text-xs font-bold text-slate-300 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>{showFullTable ? 'إخفاء جدول كافة المشاركين' : `عرض قائمة كافة المشاركين والترتيب (${sortedParticipants.length} طالب)`}</span>
                {showFullTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showFullTable && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl"
                >
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                        <th className="p-3">الترتيب</th>
                        <th className="p-3">اسم الطالب</th>
                        <th className="p-3">الرقم</th>
                        <th className="p-3">الدرجة</th>
                        <th className="p-3">الإجابات الصحيحة</th>
                        <th className="p-3">الوقت المستغرق</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {sortedParticipants.map((p, idx) => (
                        <tr key={p.studentKey} className="hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-amber-400">#{idx + 1}</td>
                          <td className="p-3 font-semibold text-slate-200">{p.studentName || p.username}</td>
                          <td className="p-3 font-mono text-slate-400">{p.sheetNumber || '-'}</td>
                          <td className="p-3 font-black text-amber-400">{p.totalScore.toLocaleString()}</td>
                          <td className="p-3 text-emerald-400 font-bold">{p.correctCount} / {totalQuestions}</td>
                          <td className="p-3 text-slate-400 font-mono">{formatTime(p.totalTimeTaken || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
