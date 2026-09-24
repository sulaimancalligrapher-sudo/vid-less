import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, Plus, Play, Edit3, Trash2, Save, FileSpreadsheet, 
  Users, CheckCircle2, Clock, HelpCircle, Image, ExternalLink, 
  RefreshCw, Search, QrCode, Copy, Check, Sparkles, ChevronDown, 
  ChevronUp, ArrowLeft, AlertCircle, X
} from 'lucide-react';
import { 
  LiveLessonRow, LiveQuestionItem, LiveAnswerRecord 
} from '../types';
import { 
  fetchLiveQuestionsT, saveLiveLessonT, fetchLiveAnswersT, 
  formatSecondsToTime, parseTimeToSeconds, formatDriveImageUrl 
} from '../api';

interface LiveClassManagerProps {
  onStartTeacherTheater: (lesson: LiveLessonRow) => void;
  onBackToAdmin?: () => void;
}

// Helper to calculate exact column letters for each 5-column question block starting at C
function getQuestionColumnInfo(idx: number) {
  const startCol = 2 + idx * 5;
  const colLetter = (colIndex: number) => {
    let result = '';
    let temp = colIndex;
    while (temp >= 0) {
      result = String.fromCharCode((temp % 26) + 65) + result;
      temp = Math.floor(temp / 26) - 1;
    }
    return result;
  };
  const cTime = colLetter(startCol);
  const cImg = colLetter(startCol + 1);
  const cQ = colLetter(startCol + 2);
  const cOpt = colLetter(startCol + 3);
  const cAns = colLetter(startCol + 4);
  return {
    range: `${cTime}:${cAns}`,
    cTime,
    cImg,
    cQ,
    cOpt,
    cAns
  };
}

export default function LiveClassManager({
  onStartTeacherTheater,
  onBackToAdmin,
}: LiveClassManagerProps) {
  const [activeTab, setActiveTab] = useState<'lessons' | 'answers' | 'qrcode'>('lessons');
  const [lessons, setLessons] = useState<LiveLessonRow[]>([]);
  const [answers, setAnswers] = useState<LiveAnswerRecord[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LiveLessonRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Link copy state
  const [copiedLink, setCopiedLink] = useState(false);

  const studentJoinUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/?page=live-student`
    : '';

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(studentJoinUrl)}`;

  // Load Lessons from Questions-T
  const loadLessons = async () => {
    setLoadingLessons(true);
    try {
      const data = await fetchLiveQuestionsT();
      setLessons(data);
    } catch (err) {
      console.error('Error loading Questions-T:', err);
    } finally {
      setLoadingLessons(false);
    }
  };

  // Load Answers from Answers-T
  const loadAnswers = async () => {
    setLoadingAnswers(true);
    try {
      const data = await fetchLiveAnswersT();
      setAnswers(data);
    } catch (err) {
      console.error('Error loading Answers-T:', err);
    } finally {
      setLoadingAnswers(false);
    }
  };

  useEffect(() => {
    loadLessons();
  }, []);

  useEffect(() => {
    if (activeTab === 'answers') {
      loadAnswers();
    }
  }, [activeTab]);

  // Open New Lesson Form
  const handleAddNewLesson = () => {
    const defaultQuestions: LiveQuestionItem[] = [
      {
        index: 0,
        time: 60,
        timeFormatted: '01:00',
        question: 'ما هو اللون المناسب؟',
        options: ['أحمر', 'أصفر', 'برتقالي', 'أخضر'],
        isTextAnswer: false,
        correctAnswer: '1',
        image: ''
      },
      {
        index: 1,
        time: 120,
        timeFormatted: '02:00',
        question: 'اكتب تعريف المفهوم باختصار:',
        options: [],
        isTextAnswer: true,
        correctAnswer: '',
        image: ''
      }
    ];

    setEditingLesson({
      title: 'درس تفاعلي جديد',
      videoUrl: '',
      questions: defaultQuestions
    });
    setIsEditorOpen(true);
  };

  // Open Existing Lesson for Editing
  const handleEditLesson = (lesson: LiveLessonRow) => {
    setEditingLesson(JSON.parse(JSON.stringify(lesson)));
    setIsEditorOpen(true);
  };

  // Save Lesson to Questions-T
  const handleSaveLesson = async () => {
    if (!editingLesson || !editingLesson.title.trim()) return;
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await saveLiveLessonT(editingLesson);
      setSaveMessage(res.message || 'تم الحفظ بنجاح');
      setTimeout(() => {
        setIsEditorOpen(false);
        setSaveMessage(null);
        loadLessons();
      }, 1200);
    } catch (err: any) {
      setSaveMessage('حدث خطأ: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered answers
  const filteredAnswers = answers.filter(a => {
    const q = searchQuery.toLowerCase();
    return (
      (a.username && a.username.toLowerCase().includes(q)) ||
      (a.sheetNumber && a.sheetNumber.toLowerCase().includes(q)) ||
      (a.lessonTitle && a.lessonTitle.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 text-slate-100">
      {/* Top Banner & Navigation */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center shadow-inner">
              <Tv className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-100">
                  إدارة الحصص التفاعلية المباشرة 🎯
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[10px] font-bold">
                  Questions-T & Answers-T
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                تشغيل الدروس على البروجكتر بالفصل وبث الأسئلة لهواتف الطلاب لحظياً دون عرض الفيديو على هواتفهم.
              </p>
            </div>
          </div>

          {onBackToAdmin && (
            <button
              onClick={onBackToAdmin}
              className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>العودة للوحة الإدارة</span>
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mt-6 border-t border-slate-800/80 pt-4">
          <button
            onClick={() => setActiveTab('lessons')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'lessons'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/10'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>دروس ورقة Questions-T ({lessons.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('answers')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'answers'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/10'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>سجل إجابات الطلاب Answers-T</span>
          </button>

          <button
            onClick={() => setActiveTab('qrcode')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'qrcode'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/10'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>رمز ورابط دخول الطلاب</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LESSONS (Questions-T) */}
      {/* ========================================================================= */}
      {activeTab === 'lessons' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400 font-bold">
              دروس الفيديو التفاعلية المجهزة للعرض الصفي
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadLessons}
                disabled={loadingLessons}
                className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl transition-all cursor-pointer"
                title="تحديث القائمة"
              >
                <RefreshCw className={`w-4 h-4 ${loadingLessons ? 'animate-spin text-amber-500' : ''}`} />
              </button>
              <button
                onClick={handleAddNewLesson}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/10 active:scale-98 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة درس تفاعلي جديد</span>
              </button>
            </div>
          </div>

          {loadingLessons ? (
            <div className="p-12 text-center text-slate-500 bg-slate-900/50 rounded-3xl border border-slate-800">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
              <p className="text-xs font-bold">جاري جلب الدروس من ورقة Questions-T...</p>
            </div>
          ) : lessons.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/50 rounded-3xl border border-dashed border-slate-800 space-y-4">
              <Tv className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-300">لا توجد دروس تفاعلية مضافة بعد في Questions-T</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  يمكنك إضافة درس جديد الآن مع رابط الفيديو ونقاط التوقف لأسئلة الطلاب.
                </p>
              </div>
              <button
                onClick={handleAddNewLesson}
                className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة أول درس تفاعلي 🚀</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lessons.map((lesson, idx) => (
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
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate max-w-xs" dir="ltr">
                            {lesson.videoUrl || 'لم يحدد رابط فيديو'}
                          </div>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-indigo-400 font-bold shrink-0">
                        {lesson.questions?.length || 0} أسئلة
                      </span>
                    </div>

                    {/* Question Time Points Chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                      {lesson.questions?.slice(0, 6).map((q, qIdx) => (
                        <span
                          key={qIdx}
                          className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800/80 text-[10px] font-mono text-slate-400 shrink-0"
                        >
                          س{qIdx + 1}: {formatSecondsToTime(q.time)}
                        </span>
                      ))}
                      {(lesson.questions?.length || 0) > 6 && (
                        <span className="text-[10px] text-slate-500 font-bold shrink-0">
                          +{(lesson.questions?.length || 0) - 6} أخرى
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-800/60">
                    <button
                      onClick={() => onStartTeacherTheater(lesson)}
                      className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/10 active:scale-98 transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-slate-950" />
                      <span>بدء العرض على البروجكتر 📽️</span>
                    </button>

                    <button
                      onClick={() => handleEditLesson(lesson)}
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer"
                      title="تعديل تفاصيل الدرس والأسئلة"
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

      {/* ========================================================================= */}
      {/* TAB 2: ANSWERS RECORD (Answers-T) */}
      {/* ========================================================================= */}
      {activeTab === 'answers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم الطالب أو موضوع الدرس..."
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none pr-10 focus:border-amber-500 font-bold"
              />
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            </div>

            <button
              onClick={loadAnswers}
              disabled={loadingAnswers}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className={`w-4 h-4 ${loadingAnswers ? 'animate-spin text-amber-500' : ''}`} />
              <span>تحديث السجل</span>
            </button>
          </div>

          {loadingAnswers ? (
            <div className="p-12 text-center text-slate-500 bg-slate-900/50 rounded-3xl border border-slate-800">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
              <p className="text-xs font-bold">جاري جلب إجابات الطلاب من ورقة Answers-T...</p>
            </div>
          ) : filteredAnswers.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/50 rounded-3xl border border-slate-800 text-slate-500 space-y-2">
              <FileSpreadsheet className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-xs font-bold">لم يتم تسجيل أي إجابات في ورقة Answers-T حتى الآن</p>
              <p className="text-[11px] text-slate-600">
                ستظهر النتائج هنا تلقائياً عند قيام الطلاب بالإجابة وحفظ الجلسة في شاشة البروجكتر.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                    <tr>
                      <th className="p-3.5 whitespace-nowrap">التاريخ والتوقيت (A)</th>
                      <th className="p-3.5 whitespace-nowrap">رقم المشترك (B)</th>
                      <th className="p-3.5 whitespace-nowrap">اسم المشترك (C)</th>
                      <th className="p-3.5 whitespace-nowrap">موضوع الدرس (D)</th>
                      <th className="p-3.5 whitespace-nowrap">إجابات الأسئلة (E:T)</th>
                      <th className="p-3.5 whitespace-nowrap">الدرجة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-semibold text-slate-300">
                    {filteredAnswers.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {item.timestamp}
                        </td>
                        <td className="p-3.5 font-mono text-amber-400 font-bold whitespace-nowrap">
                          {item.sheetNumber || '-'}
                        </td>
                        <td className="p-3.5 font-bold text-slate-100 whitespace-nowrap">
                          {item.username}
                        </td>
                        <td className="p-3.5 text-indigo-300 font-bold whitespace-nowrap">
                          {item.lessonTitle}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap max-w-md">
                            {Object.entries(item.answers || {}).map(([qIdx, ans]) => {
                              const ansStr = String(ans || '').trim();
                              const isCorrect = ansStr === 'صح';
                              const isWrong = ansStr === 'خطأ';
                              const isFreeText = Boolean(ansStr && !isCorrect && !isWrong);

                              return (
                                <span
                                  key={qIdx}
                                  title={`السؤال ${Number(qIdx) + 1}: ${ansStr}`}
                                  className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold whitespace-nowrap ${
                                    isCorrect 
                                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
                                      : isWrong 
                                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400' 
                                      : isFreeText 
                                      ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 max-w-[120px] truncate' 
                                      : 'bg-slate-950 border-slate-800 text-slate-600'
                                  }`}
                                >
                                  س{Number(qIdx) + 1}: {ansStr || '—'}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          {item.totalScore ? (
                            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-black">
                              {item.totalScore}
                            </span>
                          ) : (
                            <span className="text-slate-600 font-mono">-</span>
                          )}
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
      {/* TAB 3: STUDENT JOIN QR & LINK */}
      {/* ========================================================================= */}
      {activeTab === 'qrcode' && (
        <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl">
          <div>
            <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-3xl mx-auto flex items-center justify-center mb-3">
              <QrCode className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-100">
              رمز ورابط دخول الطلاب للحصة التفاعلية 📱
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              يمكنك طباعة هذا الرمز أو عرضه على البروجكتر ليمسحه الطلاب بكاميرات هواتفهم ويدخلوا فوراً!
            </p>
          </div>

          <div className="p-5 bg-white rounded-3xl inline-block shadow-2xl border-4 border-indigo-500/20">
            <img
              src={qrCodeUrl}
              alt="QR Code"
              className="w-64 h-64 mx-auto rounded-2xl object-contain"
            />
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
            <span className="text-slate-300 font-mono truncate max-w-[280px]" dir="ltr">
              {studentJoinUrl}
            </span>
            <button
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(studentJoinUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2500);
                }
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'تم النسخ!' : 'نسخ الرابط'}</span>
            </button>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 text-right text-xs text-slate-400 space-y-2">
            <h4 className="font-black text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>كيف تعمل الحصة التفاعلية في الفصل؟</span>
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-slate-400 leading-relaxed font-semibold">
              <li>المعلم يشغل الفيديو على شاشة البروجكتر عبر زر «بدء العرض على البروجكتر».</li>
              <li>الطلاب يمسحون رمز الـ QR بهواتفهم ويكتبون أسماءهم.</li>
              <li>الفيديو يُعرض بصوته وصورته على البروجكتر فقط لتوفير باقات هواتف الطلاب.</li>
              <li>عند وصول الفيديو لنقطة السؤال، يتوقف تلقائياً وتظهر الخيارات فوراً على هواتف جميع الطلاب للإجابة!</li>
            </ol>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT LESSON & 15 QUESTIONS FOR Questions-T */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isEditorOpen && editingLesson && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col justify-between shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-100">
                    محرر درس ورقة Questions-T التفاعلي 🎬
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    تحديد رابط الفيديو وإعدادات التوقف التلقائي للأسئلة
                  </p>
                </div>
                <button
                  onClick={() => setIsEditorOpen(false)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body (Scrollable) */}
              <div className="p-5 overflow-y-auto space-y-5">
                {/* General Lesson Info: Column A & B */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-400">
                    <Sparkles className="w-4 h-4" />
                    <span>البيانات الأساسية للدرس (العمودان A و B في ورقة Questions-T)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        موضوع الدرس (العمود A):
                      </label>
                      <input
                        type="text"
                        value={editingLesson.title}
                        onChange={(e) => setEditingLesson({ ...editingLesson, title: e.target.value })}
                        placeholder="عنوان موضوع الدرس..."
                        className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 outline-none focus:border-amber-500 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        رابط الفيديو (العمود B):
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={editingLesson.videoUrl}
                        onChange={(e) => setEditingLesson({ ...editingLesson, videoUrl: e.target.value })}
                        placeholder="https://drive.google.com/file/d/... أو رابط mp4 مباشر"
                        className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 outline-none focus:border-amber-500 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Questions Configuration (C:G, H:L, M:Q... up to 15 questions or more) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-slate-200 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>أسئلة الفيديو التفاعلي ({editingLesson.questions?.length || 0} أسئلة)</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        لكل سؤال 5 أعمدة في ورقة Questions-T تبدأ من العمود C بنظام مرن
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        const nextIdx = editingLesson.questions?.length || 0;
                        const newQ: LiveQuestionItem = {
                          index: nextIdx,
                          time: (nextIdx + 1) * 60,
                          timeFormatted: formatSecondsToTime((nextIdx + 1) * 60),
                          question: `سؤال تفاعلي ${nextIdx + 1}`,
                          options: ['أحمر', 'أصفر', 'برتقالي', 'أخضر'],
                          isTextAnswer: false,
                          correctAnswer: '1',
                          image: ''
                        };
                        setEditingLesson({
                          ...editingLesson,
                          questions: [...(editingLesson.questions || []), newQ]
                        });
                      }}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة سؤال جديد</span>
                    </button>
                  </div>

                  <div className="space-y-3.5">
                    {editingLesson.questions?.map((q, idx) => {
                      const colInfo = getQuestionColumnInfo(idx);
                      const isTextMode = Boolean(q.isTextAnswer);

                      return (
                        <div
                          key={idx}
                          className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 relative overflow-hidden"
                        >
                          {/* Question Card Header */}
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-black text-xs">
                                السؤال {idx + 1}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 font-bold">
                                الأعمدة: {colInfo.range}
                              </span>
                            </div>

                            <button
                              onClick={() => {
                                const updated = editingLesson.questions.filter((_, i) => i !== idx);
                                setEditingLesson({ ...editingLesson, questions: updated });
                              }}
                              className="text-slate-500 hover:text-rose-400 transition-colors p-1 cursor-pointer"
                              title="حذف هذا السؤال"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Row 1: Time (col 1), Image (col 2), Question text (col 3) */}
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                وقت الظهور ({colInfo.cTime}):
                              </label>
                              <input
                                type="text"
                                dir="ltr"
                                value={q.timeFormatted || formatSecondsToTime(q.time)}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const sec = parseTimeToSeconds(val);
                                  const updated = [...editingLesson.questions];
                                  updated[idx] = { ...q, time: sec, timeFormatted: val };
                                  setEditingLesson({ ...editingLesson, questions: updated });
                                }}
                                placeholder="01:30"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 outline-none focus:border-amber-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                رابط الصورة ({colInfo.cImg} - اختياري):
                              </label>
                              <input
                                type="text"
                                dir="ltr"
                                value={q.image || ''}
                                onChange={(e) => {
                                  const updated = [...editingLesson.questions];
                                  updated[idx] = { ...q, image: e.target.value };
                                  setEditingLesson({ ...editingLesson, questions: updated });
                                }}
                                placeholder="رابط صورة..."
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 outline-none focus:border-amber-500"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                                نص السؤال ({colInfo.cQ}):
                              </label>
                              <input
                                type="text"
                                value={q.question}
                                onChange={(e) => {
                                  const updated = [...editingLesson.questions];
                                  updated[idx] = { ...q, question: e.target.value };
                                  setEditingLesson({ ...editingLesson, questions: updated });
                                }}
                                placeholder="اكتب نص السؤال هنا..."
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-100 outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>

                          {/* Image preview thumbnail if provided */}
                          {q.image && (
                            <div className="flex items-center gap-3 p-2 bg-slate-900/60 rounded-xl border border-slate-800/80">
                              <img
                                src={formatDriveImageUrl(q.image)}
                                alt="معاينة"
                                className="w-12 h-12 rounded-lg object-cover bg-black"
                              />
                              <span className="text-[11px] text-slate-400">معاينة الصورة المرفقة بالسؤال</span>
                            </div>
                          )}

                          {/* Row 2: Question Type & Options (col 4), Correct Answer method (col 5) */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            {/* Column 4: Options or 'نص' */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold text-slate-300">
                                  نوع السؤال والخيارات ({colInfo.cOpt}):
                                </label>

                                {/* Toggle Multiple Choice vs Text */}
                                <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...editingLesson.questions];
                                      updated[idx] = { 
                                        ...q, 
                                        isTextAnswer: false,
                                        options: q.options && q.options.length > 0 ? q.options : ['خيار 1', 'خيار 2', 'خيار 3']
                                      };
                                      setEditingLesson({ ...editingLesson, questions: updated });
                                    }}
                                    className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                                      !isTextMode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                  >
                                    خيارات متعددة
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...editingLesson.questions];
                                      updated[idx] = { 
                                        ...q, 
                                        isTextAnswer: true,
                                        options: []
                                      };
                                      setEditingLesson({ ...editingLesson, questions: updated });
                                    }}
                                    className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                                      isTextMode ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                  >
                                    إجابة نصية (نص)
                                  </button>
                                </div>
                              </div>

                              {!isTextMode ? (
                                <div>
                                  <input
                                    type="text"
                                    value={(q.options || []).join(', ')}
                                    onChange={(e) => {
                                      const parts = e.target.value.split(/[,،]/).map(s => s.trim()).filter(Boolean);
                                      const updated = [...editingLesson.questions];
                                      updated[idx] = { ...q, options: parts, isTextAnswer: false };
                                      setEditingLesson({ ...editingLesson, questions: updated });
                                    }}
                                    placeholder="أحمر, اصفر, برتقالي, اخضر"
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 outline-none focus:border-indigo-500"
                                  />
                                  <span className="text-[10px] text-slate-500 block mt-1">
                                    افصل بين كل خيار بفاصلة (,) لتسجيلها بالعامود {colInfo.cOpt}
                                  </span>
                                </div>
                              ) : (
                                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 font-bold flex items-center gap-1.5">
                                  <span>✍️ سيكتب في العامود {colInfo.cOpt} كلمة (نص) - يدخل المشترك إجابته كتابياً</span>
                                </div>
                              )}
                            </div>

                            {/* Column 5: Correct Answer Method */}
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-bold text-slate-300">
                                طريقة الإجابة والتقييم ({colInfo.cAns}):
                              </label>
                              <input
                                type="text"
                                value={q.correctAnswer}
                                onChange={(e) => {
                                  const updated = [...editingLesson.questions];
                                  updated[idx] = { ...q, correctAnswer: e.target.value };
                                  setEditingLesson({ ...editingLesson, questions: updated });
                                }}
                                placeholder={!isTextMode ? "سجل رقم الخيار الصحيح (1 أو 2...) أو نصه" : "اكتب النص المطلوب للإجابة الصحيحة أو اتركه فارغاً"}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-emerald-400 font-bold outline-none focus:border-emerald-500"
                              />
                              <div className="text-[10px] text-slate-500 leading-snug space-y-0.5">
                                <div>• <b>رقم 1/2/3</b>: يطابق رقم الخيار من الخيارات.</div>
                                <div>• <b>نص</b>: يشترط كتابة نفس النص لاعتباره صح.</div>
                                <div>• <b>فارغ</b>: إجابة نصية حرة دون تقييم صح/خطأ.</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-800 flex items-center justify-between">
                {saveMessage ? (
                  <span className="text-xs font-bold text-amber-400">{saveMessage}</span>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditorOpen(false)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>

                  <button
                    onClick={handleSaveLesson}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/10 active:scale-98 transition-all cursor-pointer"
                  >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin text-slate-950" /> : <Save className="w-4 h-4" />}
                    <span>حفظ الدرس في Questions-T 💾</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
