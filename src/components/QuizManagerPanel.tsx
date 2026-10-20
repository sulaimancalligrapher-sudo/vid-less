import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, Play, Square, RotateCcw, Settings2, Plus, 
  Trash2, Edit3, Save, CheckCircle2, Clock, Users, Flame, 
  Sparkles, ExternalLink, Shuffle, Eye, EyeOff, RefreshCw, 
  FileSpreadsheet, ArrowDownToLine, Search, Award, Check, X,
  HelpCircle, Image as ImageIcon, ChevronRight, AlertCircle, Copy
} from 'lucide-react';
import { 
  QuizActiveState, QuizLessonRow, QuizQuestionItem, 
  QuizAnswerRecord, LiveSessionState 
} from '../types';
import { 
  fetchQuizQuestionsDirect, saveQuizLessonDirect, 
  fetchQuizAnswersDirect, recordQuizAnswersBatchDirect, 
  setupQuizDirectSheetsApi, startLiveQuiz, endLiveQuiz, 
  resetLiveQuiz, updateLiveQuizSettings, formatDriveImageUrl,
  openLiveQuizLobby, launchLiveQuizQuestions
} from '../api';

interface QuizManagerPanelProps {
  sessionState?: LiveSessionState | null;
  onOpenArenaDisplay?: () => void;
}

export default function QuizManagerPanel({
  sessionState,
  onOpenArenaDisplay,
}: QuizManagerPanelProps) {
  // Tabs: 'control' | 'questions' | 'answers'
  const [activeTab, setActiveTab] = useState<'control' | 'questions' | 'answers'>('control');

  // Lessons list & Active lesson for quiz
  const [quizzes, setQuizzes] = useState<QuizLessonRow[]>([]);
  const [selectedQuizIdx, setSelectedQuizIdx] = useState<number>(0);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Settings for the challenge
  const [timerMinutes, setTimerMinutes] = useState<number>(0); // 0 = unlimited
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);
  const [showInstantFeedback, setShowInstantFeedback] = useState<boolean>(true);
  const [allowRetryWrong, setAllowRetryWrong] = useState<boolean>(true);
  const [podiumCount, setPodiumCount] = useState<number>(3); // 3 or 10

  // Answers from Google Sheets Answers-Qui
  const [sheetAnswers, setSheetAnswers] = useState<QuizAnswerRecord[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Editing state for questions tab
  const [editingQuiz, setEditingQuiz] = useState<QuizLessonRow | null>(null);
  const [editingQIndex, setEditingQIndex] = useState<number | null>(null);

  // Auto setup sheets status
  const [isSettingUpSheets, setIsSettingUpSheets] = useState(false);
  const [setupFeedback, setSetupFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Load quizzes and answers on mount
  useEffect(() => {
    loadQuizzes();
    loadAnswers();
  }, []);

  const loadQuizzes = async () => {
    setLoadingQuizzes(true);
    try {
      const data = await fetchQuizQuestionsDirect();
      if (data && data.length > 0) {
        setQuizzes(data);
      } else {
        // Sample default quiz to get started immediately
        const defaultSample: QuizLessonRow = {
          title: 'مسابقة التحدي التجريبية الأولى 🏆',
          description: 'تحدي سريع لقياس سرعة وفهم الطلاب',
          questions: [
            {
              index: 0,
              question: 'ما هي عاصمة المملكة العربية السعودية؟',
              options: ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة'],
              correctAnswer: '1',
              timeLimit: 30,
            },
            {
              index: 1,
              question: 'كم عدد أركان الإسلام؟',
              options: ['أربعة', 'خمسة', 'ستة', 'سبعة'],
              correctAnswer: '2',
              timeLimit: 30,
            },
            {
              index: 2,
              question: 'في أي شهر نزل القرآن الكريم؟',
              options: ['شعبان', 'رمضان', 'شوال', 'رجب'],
              correctAnswer: '2',
              timeLimit: 30,
            }
          ]
        };
        setQuizzes([defaultSample]);
      }
    } catch (err) {
      console.warn('Failed to load quizzes:', err);
    } finally {
      setLoadingQuizzes(false);
    }
  };

  const loadAnswers = async () => {
    setLoadingAnswers(true);
    try {
      const data = await fetchQuizAnswersDirect();
      setSheetAnswers(data);
    } catch (err) {
      console.warn('Failed to load quiz answers:', err);
    } finally {
      setLoadingAnswers(false);
    }
  };

  // Active quiz state from live session
  const currentQuizState = sessionState?.quizState || null;
  const isQuizActive = Boolean(currentQuizState?.isActive && currentQuizState.quizStatus === 'in_progress');

  // Trigger Start Quiz directly
  const handleStartQuiz = async () => {
    const activeQuiz = quizzes[selectedQuizIdx];
    if (!activeQuiz || !activeQuiz.questions || activeQuiz.questions.length === 0) {
      alert('يرجى اختيار مسابقة تحتوي على أسئلة للبدء!');
      return;
    }

    try {
      await startLiveQuiz({
        title: activeQuiz.title,
        questions: activeQuiz.questions,
        timerDurationSeconds: timerMinutes * 60,
        shuffleQuestions,
        showInstantFeedback,
        allowRetryWrong,
        podiumCount,
      });
      setSaveSuccessMsg('تم إطلاق المسابقة بنجاح! 🚀 الطلاب يمكنهم الحل الآن.');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      alert('تعذر إطلاق المسابقة: ' + err.message);
    }
  };

  // Open Pre-Quiz Waiting Lobby with live students and chart
  const handleOpenLobby = async () => {
    const activeQuiz = quizzes[selectedQuizIdx];
    if (!activeQuiz || !activeQuiz.questions || activeQuiz.questions.length === 0) {
      alert('يرجى اختيار مسابقة تحتوي على أسئلة للبدء!');
      return;
    }

    try {
      await openLiveQuizLobby({
        title: activeQuiz.title,
        questions: activeQuiz.questions,
        timerDurationSeconds: timerMinutes * 60,
        shuffleQuestions,
        showInstantFeedback,
        allowRetryWrong,
        podiumCount,
      });
      setSaveSuccessMsg('تم فتح قاعة الانتظار بنجاح! 👥 شاشة العرض تعرض الآن حضور الطلاب والرسم البياني.');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      alert('تعذر فتح قاعة الانتظار: ' + err.message);
    }
  };

  // Launch questions to in_progress from lobby
  const handleLaunchQuestionsNow = async () => {
    try {
      await launchLiveQuizQuestions();
      setSaveSuccessMsg('تم إطلاق المسابقة والأسئلة لجميع الطلاب الآن! ⚡');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      alert('تعذر إطلاق المسابقة: ' + err.message);
    }
  };

  // End Quiz and show podium
  const handleEndQuiz = async () => {
    if (!confirm('هل تريد إنهاء المسابقة الآن وإعلان منصة التتويج للفائزين؟')) return;
    try {
      await endLiveQuiz();
      setSaveSuccessMsg('تم إنهاء المسابقة وإعلان منصة التتويج! 🏆');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      alert('تعذر إنهاء المسابقة: ' + err.message);
    }
  };

  // Reset Quiz
  const handleResetQuiz = async () => {
    if (!confirm('هل أنت متأكد من إعادة ضبط المسابقة وإلغاء الجولة الحالية؟')) return;
    try {
      await resetLiveQuiz();
      setSaveSuccessMsg('تمت إعادة ضبط المسابقة بنجاح.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: any) {
      alert('تعذر إعادة ضبط المسابقة: ' + err.message);
    }
  };

  // One-click Setup Sheets in Google Spreadsheet
  const handleSetupSheets = async () => {
    setIsSettingUpSheets(true);
    setSetupFeedback(null);
    try {
      const res = await setupQuizDirectSheetsApi();
      setSetupFeedback({
        success: res.success,
        message: res.message || (res.success ? 'تم إنشاء وتهيئة الأوراق بنجاح!' : 'فشل إنشاء الأوراق')
      });
    } catch (err: any) {
      setSetupFeedback({
        success: false,
        message: err.message || 'حدث خطأ أثناء الاتصال'
      });
    } finally {
      setIsSettingUpSheets(false);
    }
  };

  // Export & Batch Save Live Results to Answers-Qui
  const handleExportBatchToSheet = async () => {
    if (!currentQuizState || !currentQuizState.participants) {
      alert('لا توجد نتائج مسابقة جارية لترحيلها!');
      return;
    }

    const participantsList = Object.values(currentQuizState.participants);
    if (participantsList.length === 0) {
      alert('لم يسجل أي طالب إجابات بعد!');
      return;
    }

    setSyncingSheet(true);
    try {
      const recordsToSave: QuizAnswerRecord[] = participantsList.map((p, idx) => {
        const answersMap: Record<number, string> = {};
        Object.values(p.answers || {}).forEach((a) => {
          answersMap[a.questionIndex] = a.isCorrect ? 'صح' : (a.answer || 'خطأ');
        });

        return {
          timestamp: new Date().toLocaleString('ar-SA'),
          sheetNumber: p.sheetNumber || String(idx + 1),
          username: p.username || p.studentName || 'طالب',
          studentName: p.studentName || p.username,
          quizTitle: currentQuizState.quizTitle || 'مسابقة التحدي',
          score: p.totalScore || 0,
          rank: p.rank || (idx + 1),
          totalTime: p.totalTimeTaken || 0,
          answers: answersMap,
        };
      });

      const res = await recordQuizAnswersBatchDirect(recordsToSave);
      if (res.success) {
        setSaveSuccessMsg(`تم ترحيل وحفظ ${recordsToSave.length} نتيجة في ورقة Answers-Qui بنجاح! ⚡`);
        loadAnswers();
      } else {
        alert('حدث خطأ أثناء الترحيل للشيت: ' + res.message);
      }
    } catch (err: any) {
      alert('تعذر ترحيل النتائج: ' + err.message);
    } finally {
      setSyncingSheet(false);
    }
  };

  // Add / Save Quiz question in questions tab
  const handleSaveQuizToSheet = async () => {
    if (!editingQuiz || !editingQuiz.title.trim()) {
      alert('يرجى كتابة عنوان للمسابقة!');
      return;
    }

    setLoadingQuizzes(true);
    try {
      const res = await saveQuizLessonDirect(editingQuiz);
      if (res.success) {
        setSaveSuccessMsg('تم حفظ أسئلة التحدي في ورقة Questions-Qui بنجاح! 🎯');
        loadQuizzes();
        setEditingQuiz(null);
      } else {
        alert('تعذر الحفظ: ' + res.message);
      }
    } catch (err: any) {
      alert('خطأ أثناء الحفظ: ' + err.message);
    } finally {
      setLoadingQuizzes(false);
    }
  };

  // Filtered answers
  const filteredAnswers = sheetAnswers.filter(a => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (a.username && a.username.toLowerCase().includes(term)) ||
      (a.studentName && a.studentName.toLowerCase().includes(term)) ||
      (a.sheetNumber && a.sheetNumber.includes(term)) ||
      (a.quizTitle && a.quizTitle.toLowerCase().includes(term))
    );
  });

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-4 md:p-6 space-y-6 shadow-2xl text-slate-100 font-sans select-none">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
            <Trophy className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                نظام التحدي والمسابقات التفاعلية ⚡
              </span>
              <span className="text-xs text-slate-400 font-mono">Questions-Qui & Answers-Qui</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-100 tracking-tight">
              إدارة مسابقات كويز السريعة (Quiz Arena)
            </h2>
          </div>
        </div>

        {/* Action button for display screen */}
        <div className="flex items-center gap-2">
          {onOpenArenaDisplay && (
            <button
              onClick={onOpenArenaDisplay}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>شاشة العرض الكبرى (Arena)</span>
            </button>
          )}

          <button
            onClick={handleSetupSheets}
            disabled={isSettingUpSheets}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="إنشاء وتهيئة ورقتي Questions-Qui و Answers-Qui في الشيت تلقائياً"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{isSettingUpSheets ? 'جاري التهيئة...' : 'تهيئة الأوراق بالشيت ⚡'}</span>
          </button>
        </div>
      </div>

      {/* Setup Feedback Banner */}
      {setupFeedback && (
        <div className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 ${
          setupFeedback.success 
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' 
            : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {setupFeedback.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{setupFeedback.message}</span>
          </div>
          <button onClick={() => setSetupFeedback(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Save Success Banner */}
      {saveSuccessMsg && (
        <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-between gap-2 animate-fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-Tabs Navigation (1. التحكم | 2. الأسئلة | 3. الإجابات) */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-950/80 rounded-2xl border border-slate-800">
        <button
          onClick={() => setActiveTab('control')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'control'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Settings2 className="w-4 h-4" />
          <span>1. غرفة التحكم المباشرة</span>
          {isQuizActive && (
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'questions'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>2. بنك الأسئلة (Questions-Qui)</span>
        </button>

        <button
          onClick={() => setActiveTab('answers')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'answers'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>3. سجل الإجابات والنتائج (Answers-Qui)</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* SUB-SECTION 1: CONTROL ROOM (قسم التحكم المباشر) */}
      {/* ============================================================== */}
      {activeTab === 'control' && (
        <div className="space-y-6">
          {/* Main Action Control Box */}
          <div className="p-6 bg-slate-950/70 border border-slate-800 rounded-3xl space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                  <Play className="w-5 h-5 text-amber-400" />
                  <span>إطلاق وإدارة التحدي المباشر</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  اختر موضوع المسابقة واضبط الخيارات، ثم اضغط "ابدأ التحدي" لتنطلق الأسئلة لجميع الطلاب فوراً.
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border shrink-0">
                {isQuizActive ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    المسابقة جارية الآن 🚀
                  </span>
                ) : currentQuizState?.quizStatus === 'ended' ? (
                  <span className="text-amber-400 bg-amber-500/10 border-amber-500/30">
                    انتهت المسابقة (منصة التتويج نشطة) 🏆
                  </span>
                ) : (
                  <span className="text-slate-400 bg-slate-800 border-slate-700">
                    المسابقة في وضع الاستعداد ⏸️
                  </span>
                )}
              </div>
            </div>

            {/* Quiz Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">اختر موضوع المسابقة من بنك الأسئلة:</label>
              <select
                value={selectedQuizIdx}
                onChange={(e) => setSelectedQuizIdx(Number(e.target.value))}
                disabled={isQuizActive}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-200 text-xs font-bold outline-none focus:border-amber-500 transition-all"
              >
                {quizzes.map((q, idx) => (
                  <option key={idx} value={idx}>
                    {q.title} ({q.questions?.length || 0} أسئلة)
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Action Buttons (4-Step Workflow) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {currentQuizState?.isActive && currentQuizState.quizStatus === 'waiting' ? (
                <>
                  <button
                    onClick={handleLaunchQuestionsNow}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer animate-pulse"
                  >
                    <Play className="w-5 h-5 fill-slate-950" />
                    <span>2. ابدأ التحدي الآن لجميع الطلاب ({Object.keys(currentQuizState.participants || {}).length} قبلوا التحدي) 🚀</span>
                  </button>
                  <button
                    onClick={handleEndQuiz}
                    className="w-full py-4 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Square className="w-4 h-4" />
                    <span>إلغاء القاعة</span>
                  </button>
                </>
              ) : !isQuizActive ? (
                <>
                  <button
                    onClick={handleOpenLobby}
                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black rounded-2xl text-xs sm:text-sm shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Users className="w-5 h-5 text-indigo-200" />
                    <span>1. استعداد (دعوة الطلاب للشاشة والرسم البياني) 👥</span>
                  </button>
                  <button
                    onClick={handleStartQuiz}
                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-slate-950" />
                    <span>ابدأ التحدي فوراً ⚡</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleEndQuiz}
                  className="w-full py-4 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-black rounded-2xl text-sm shadow-xl shadow-rose-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer col-span-1 sm:col-span-2"
                >
                  <Square className="w-5 h-5 fill-white" />
                  <span>4. إنهاء التحدي إجبارياً وتتويج الفائزين 🏆</span>
                </button>
              )}

              <button
                onClick={handleResetQuiz}
                className="py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-700"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة ضبط المسابقة</span>
              </button>

              <button
                onClick={handleExportBatchToSheet}
                disabled={syncingSheet}
                className="py-4 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ArrowDownToLine className="w-4 h-4 text-amber-400" />
                <span>{syncingSheet ? 'جاري الترحيل...' : 'ترحيل النتائج لشيت Answers-Qui'}</span>
              </button>
            </div>
          </div>

          {/* Waiting Lobby Realtime Quick Monitor for Teacher */}
          {currentQuizState?.isActive && currentQuizState.quizStatus === 'waiting' && (
            <div className="p-5 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/60 border border-indigo-500/30 rounded-3xl space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                  <h4 className="text-sm font-black text-slate-100">
                    قاعة الاستعداد نشطة حالياً على شاشة العرض (البروجكتر) 👥
                  </h4>
                </div>
                <div className="text-xs font-bold text-amber-300 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
                  {Object.keys(currentQuizState.participants || {}).length} طلاب قبلوا التحدي وجاهزون
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                تظهر للطلاب الآن نافذة "المعلم يستعد لإطلاق مسابقة التحدي النهائي!". كل طالب يضغط على "أنا مستعد" يُسجل فوراً في القاعة وترتفع نسبة الجاهزية على شاشة العرض. عندما يكتمل العدد اضغط الزر "2. ابدأ التحدي الآن لجميع الطلاب".
              </p>
              {/* Ready Students Mini Grid */}
              <div className="flex flex-wrap gap-2 pt-1 max-h-40 overflow-y-auto">
                {Object.values(currentQuizState.participants || {}).map((p) => (
                  <div key={p.studentKey} className="px-3 py-1.5 bg-slate-900 border border-emerald-500/40 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>{p.studentName || p.username}</span>
                    {p.sheetNumber && <span className="text-[10px] text-amber-400 font-mono">#{p.sheetNumber}</span>}
                  </div>
                ))}
                {Object.keys(currentQuizState.participants || {}).length === 0 && (
                  <div className="text-xs text-slate-500 italic py-2">
                    في انتظار ضغط الطلاب على [أنا مستعد • دخول التحدي ⚡] على أجهزتهم...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Settings & Toggles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Setting 1: Timer Duration */}
            <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-slate-200">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>1. مؤقت المسابقة التنازلي:</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { label: 'مفتوح', mins: 0 },
                  { label: '1 د', mins: 1 },
                  { label: '2 د', mins: 2 },
                  { label: '3 د', mins: 3 },
                  { label: '5 د', mins: 5 },
                  { label: '10 د', mins: 10 },
                ].map((item) => (
                  <button
                    key={item.mins}
                    onClick={() => {
                      setTimerMinutes(item.mins);
                      if (isQuizActive) {
                        updateLiveQuizSettings({
                          timerDurationSeconds: item.mins * 60,
                          endTime: item.mins > 0 ? Date.now() + (item.mins * 60 * 1000) : null,
                        });
                      }
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      timerMinutes === item.mins
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                {timerMinutes === 0
                  ? 'الوقت مفتوح: يستمر حتى يقوم المعلم بالضغط على إنهاء المسابقة.'
                  : `ينتهي التحدي تلقائياً بعد ${timerMinutes} دقيقة ويعلن منصة التتويج.`}
              </p>
            </div>

            {/* Setting 2: Podium Count */}
            <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-slate-200">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>2. عدد الفائزين في منصة التتويج:</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'أفضل 3 فائزين 🥇', count: 3 },
                  { label: 'أفضل 5 فائزين ⭐', count: 5 },
                  { label: 'أفضل 10 فائزين 🏆', count: 10 },
                ].map((item) => (
                  <button
                    key={item.count}
                    onClick={() => {
                      setPodiumCount(item.count);
                      if (isQuizActive) {
                        updateLiveQuizSettings({ podiumCount: item.count });
                      }
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      podiumCount === item.count
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                يحدد عدد المتأهلين الذين تبرز أسماؤهم وصورهم على منصة التكريم في نهاية التحدي.
              </p>
            </div>

            {/* Setting 3: Random Shuffle */}
            <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-black text-slate-200">
                  <Shuffle className="w-4 h-4 text-indigo-400" />
                  <span>3. ترتيب عشوائي للأسئلة لكل طالب:</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  يمنع الغش باختلاف ترتيب الأسئلة بين هواتف الطلاب المجاورة.
                </p>
              </div>
              <button
                onClick={() => {
                  const newVal = !shuffleQuestions;
                  setShuffleQuestions(newVal);
                  if (isQuizActive) {
                    updateLiveQuizSettings({ shuffleQuestions: newVal });
                  }
                }}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  shuffleQuestions ? 'bg-indigo-600' : 'bg-slate-800'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  shuffleQuestions ? 'left-1' : 'right-1'
                }`} />
              </button>
            </div>

            {/* Setting 4: Instant Feedback */}
            <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-black text-slate-200">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>4. إظهار النتيجة فوراً بعد كل سؤال:</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  إظهار بطاقة صح/خطأ والنقاط فور اختيار الطالب، أو الانتقال للسؤال التالي مباشرة.
                </p>
              </div>
              <button
                onClick={() => {
                  const newVal = !showInstantFeedback;
                  setShowInstantFeedback(newVal);
                  if (isQuizActive) {
                    updateLiveQuizSettings({ showInstantFeedback: newVal });
                  }
                }}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  showInstantFeedback ? 'bg-emerald-600' : 'bg-slate-800'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  showInstantFeedback ? 'left-1' : 'right-1'
                }`} />
              </button>
            </div>

            {/* Setting 5: Retry Wrong Answers */}
            <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl flex items-center justify-between gap-4 md:col-span-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-black text-slate-200">
                  <RefreshCw className="w-4 h-4 text-purple-400" />
                  <span>5. السماح بإعادة محاولة الأسئلة الخاطئة:</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  بعد إنهاء الطالب لكافة الأسئلة، تتاح له جولة إضافية لإعادة حل الأسئلة التي أخطأ فيها لتعزيز التعلم.
                </p>
              </div>
              <button
                onClick={() => {
                  const newVal = !allowRetryWrong;
                  setAllowRetryWrong(newVal);
                  if (isQuizActive) {
                    updateLiveQuizSettings({ allowRetryWrong: newVal });
                  }
                }}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  allowRetryWrong ? 'bg-purple-600' : 'bg-slate-800'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  allowRetryWrong ? 'left-1' : 'right-1'
                }`} />
              </button>
            </div>
          </div>

          {/* Live Progress Stats if active or finished */}
          {currentQuizState && currentQuizState.participants && (
            <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-400" />
                  <span className="text-sm font-black text-slate-200">إحصائيات الطلاب المشاركين في التحدي</span>
                </div>
                <span className="text-xs text-amber-400 font-mono font-bold">
                  {Object.keys(currentQuizState.participants).length} طالب مشارك
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-slate-400">المشاركون</div>
                  <div className="text-lg font-black text-slate-100">
                    {Object.keys(currentQuizState.participants).length}
                  </div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-slate-400">أتموا المسابقة</div>
                  <div className="text-lg font-black text-emerald-400">
                    {Object.values(currentQuizState.participants).filter(p => p.isFinished).length}
                  </div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-slate-400">المتصدر حالياً</div>
                  <div className="text-sm font-black text-amber-400 truncate">
                    {Object.values(currentQuizState.participants).sort((a,b) => b.totalScore - a.totalScore)[0]?.studentName || '-'}
                  </div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-slate-400">أعلى نقاط</div>
                  <div className="text-lg font-black text-amber-400 font-mono">
                    {Math.max(0, ...Object.values(currentQuizState.participants).map(p => p.totalScore || 0)).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-SECTION 2: QUESTIONS (قسم الأسئلة Questions-Qui) */}
      {/* ============================================================== */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-100">بنك أسئلة التحدي (Questions-Qui)</h3>
              <p className="text-xs text-slate-400">
                يمكنك إنشاء وتعديل وحذف أسئلة المسابقة وحفظها مباشرة في ورقة الشيت.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const newLesson: QuizLessonRow = {
                    title: 'مسابقة تحدي جديدة',
                    questions: [
                      {
                        index: 0,
                        question: 'نص السؤال الأول...',
                        options: ['الخيار 1', 'الخيار 2', 'الخيار 3', 'الخيار 4'],
                        correctAnswer: '1',
                        timeLimit: 30
                      }
                    ]
                  };
                  setEditingQuiz(newLesson);
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء مسابقة جديدة</span>
              </button>

              <button
                onClick={loadQuizzes}
                disabled={loadingQuizzes}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer"
                title="تحديث من شيت Questions-Qui"
              >
                <RefreshCw className={`w-4 h-4 ${loadingQuizzes ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Active Quiz Editor Modal / Box */}
          {editingQuiz ? (
            <div className="p-5 md:p-7 bg-slate-950 border border-amber-500/30 rounded-3xl space-y-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
                  محرر أسئلة التحدي
                </span>
                <button
                  onClick={() => setEditingQuiz(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  إلغاء التعديل
                </button>
              </div>

              {/* Title input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">عنوان موضوع المسابقة:</label>
                <input
                  type="text"
                  value={editingQuiz.title}
                  onChange={(e) => setEditingQuiz({ ...editingQuiz, title: e.target.value })}
                  placeholder="مثال: تحدي مراجعة الوحدة الأولى ⚡"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-100 text-sm font-bold outline-none focus:border-amber-500"
                />
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-200">
                    الأسئلة المدرجة ({editingQuiz.questions?.length || 0}):
                  </h4>
                  <button
                    onClick={() => {
                      const updated = [...(editingQuiz.questions || [])];
                      updated.push({
                        index: updated.length,
                        question: `السؤال رقم ${updated.length + 1}`,
                        options: ['خيار 1', 'خيار 2', 'خيار 3', 'خيار 4'],
                        correctAnswer: '1',
                        timeLimit: 30,
                      });
                      setEditingQuiz({ ...editingQuiz, questions: updated });
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة سؤال</span>
                  </button>
                </div>

                {editingQuiz.questions?.map((q, qIdx) => (
                  <div key={qIdx} className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-amber-400">السؤال #{qIdx + 1}</span>
                      <button
                        onClick={() => {
                          const updated = editingQuiz.questions.filter((_, idx) => idx !== qIdx);
                          setEditingQuiz({ ...editingQuiz, questions: updated });
                        }}
                        className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>

                    {/* Question text */}
                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) => {
                        const updated = [...editingQuiz.questions];
                        updated[qIdx].question = e.target.value;
                        setEditingQuiz({ ...editingQuiz, questions: updated });
                      }}
                      placeholder="نص السؤال..."
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs outline-none focus:border-amber-500"
                    />

                    {/* Optional Image URL */}
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-slate-500 shrink-0" />
                      <input
                        type="text"
                        value={q.image || ''}
                        onChange={(e) => {
                          const updated = [...editingQuiz.questions];
                          updated[qIdx].image = formatDriveImageUrl(e.target.value);
                          setEditingQuiz({ ...editingQuiz, questions: updated });
                        }}
                        placeholder="رابط صورة توضيحية اختياري (رابط مباشر أو Google Drive)"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 text-xs outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Options (comma-separated or text input) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400">
                          الخيارات (مفصولة بفواصل):
                        </label>
                        <input
                          type="text"
                          value={(q.options || []).join(', ')}
                          onChange={(e) => {
                            const updated = [...editingQuiz.questions];
                            const parts = e.target.value.split(/[,،]+/).map(s => s.trim()).filter(Boolean);
                            updated[qIdx].options = parts;
                            setEditingQuiz({ ...editingQuiz, questions: updated });
                          }}
                          placeholder="مثال: الرياض, مكة, جدة, الدمام"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400">
                          الإجابة الصحيحة (رقم الخيار 1، 2.. أو النص):
                        </label>
                        <input
                          type="text"
                          value={q.correctAnswer}
                          onChange={(e) => {
                            const updated = [...editingQuiz.questions];
                            updated[qIdx].correctAnswer = e.target.value;
                            setEditingQuiz({ ...editingQuiz, questions: updated });
                          }}
                          placeholder="مثال: 1"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-bold text-xs outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Save Button */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveQuizToSheet}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-black rounded-2xl text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ في ورقة Questions-Qui بالشيت</span>
                </button>

                <button
                  onClick={() => setEditingQuiz(null)}
                  className="px-4 py-3 bg-slate-800 text-slate-300 rounded-2xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            /* Quizzes List Cards */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quizzes.map((quiz, idx) => (
                <div
                  key={idx}
                  className="p-5 bg-slate-950/60 border border-slate-800 rounded-3xl space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                        مسابقة #{idx + 1}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {quiz.questions?.length || 0} أسئلة
                      </span>
                    </div>
                    <h4 className="text-base font-black text-slate-100">{quiz.title}</h4>
                    {quiz.description && (
                      <p className="text-xs text-slate-400 leading-relaxed">{quiz.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => {
                        setSelectedQuizIdx(idx);
                        setActiveTab('control');
                      }}
                      className="flex-1 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-amber-500/30"
                    >
                      <Play className="w-3.5 h-3.5 fill-amber-400" />
                      <span>تحديد للإطلاق</span>
                    </button>

                    <button
                      onClick={() => setEditingQuiz(quiz)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer"
                      title="تعديل الأسئلة"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-SECTION 3: ANSWERS (قسم الإجابات Answers-Qui) */}
      {/* ============================================================== */}
      {activeTab === 'answers' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-100">
                سجل إجابات ودرجات ومراكز الطلاب (Answers-Qui)
              </h3>
              <p className="text-xs text-slate-400">
                مشاهدة كافة الإجابات المسجلة في ورقة Answers-Qui مع الدرجات والمراكز وتوقيت الإنجاز.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportBatchToSheet}
                disabled={syncingSheet}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ArrowDownToLine className="w-4 h-4" />
                <span>ترحيل الجولة الحالية للشيت</span>
              </button>

              <button
                onClick={loadAnswers}
                disabled={loadingAnswers}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer"
                title="تحديث البيانات من ورقة Answers-Qui"
              >
                <RefreshCw className={`w-4 h-4 ${loadingAnswers ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="البحث باسم الطالب أو الرقم أو الموضوع..."
              className="w-full pr-10 pl-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500"
            />
          </div>

          {/* Answers Table */}
          {loadingAnswers ? (
            <div className="p-12 text-center text-xs text-slate-400">
              جاري جلب الإجابات من ورقة Answers-Qui...
            </div>
          ) : filteredAnswers.length === 0 ? (
            <div className="p-12 bg-slate-950/40 border border-slate-800 rounded-3xl text-center space-y-2">
              <Award className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">لا توجد إجابات مسجلة بعد في ورقة Answers-Qui</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                عند انتهاء أي جولة تحدي يمكنك الضغط على "ترحيل النتائج" لحفظها مباشرة في ورقة Answers-Qui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-slate-950 border border-slate-800 rounded-3xl shadow-xl">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-300 font-bold border-b border-slate-800">
                    <th className="p-3.5">الترتيب</th>
                    <th className="p-3.5">اسم الطالب</th>
                    <th className="p-3.5">الرقم</th>
                    <th className="p-3.5">الموضوع</th>
                    <th className="p-3.5">الدرجة</th>
                    <th className="p-3.5">الوقت المستغرق</th>
                    <th className="p-3.5">التاريخ والوقت</th>
                    <th className="p-3.5">س1</th>
                    <th className="p-3.5">س2</th>
                    <th className="p-3.5">س3</th>
                    <th className="p-3.5">س4</th>
                    <th className="p-3.5">س5</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredAnswers.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3.5 font-bold text-amber-400">
                        {row.rank === 1 ? '🥇 المركز 1' : row.rank === 2 ? '🥈 المركز 2' : row.rank === 3 ? '🥉 المركز 3' : `#${row.rank || idx + 1}`}
                      </td>
                      <td className="p-3.5 font-bold text-slate-100">{row.studentName || row.username}</td>
                      <td className="p-3.5 font-mono text-slate-400">{row.sheetNumber || '-'}</td>
                      <td className="p-3.5 text-slate-300">{row.quizTitle || '-'}</td>
                      <td className="p-3.5 font-black text-amber-400 font-mono text-sm">
                        {(row.score || 0).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-slate-400 font-mono">
                        {row.totalTime ? `${row.totalTime} ث` : '-'}
                      </td>
                      <td className="p-3.5 text-slate-500 text-[11px] font-mono">{row.timestamp || '-'}</td>
                      {/* Questions 1 to 5 sample columns */}
                      {[0, 1, 2, 3, 4].map((qIdx) => {
                        const ans = row.answers?.[qIdx];
                        return (
                          <td key={qIdx} className="p-3.5">
                            {ans === 'صح' ? (
                              <span className="text-emerald-400 font-bold">✓ صح</span>
                            ) : ans === 'خطأ' ? (
                              <span className="text-rose-400 font-bold">✗ خطأ</span>
                            ) : ans ? (
                              <span className="text-slate-300 truncate max-w-[80px] inline-block">{ans}</span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
