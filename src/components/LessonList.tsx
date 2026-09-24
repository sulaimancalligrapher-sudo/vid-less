import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WordData } from '../types';
import { LogOut, BookOpen, CheckCircle, RefreshCw, Star, PlayCircle, Lock, Eye, EyeOff, Award } from 'lucide-react';
import { decrementRetryCount, unmarkLessonCompleted } from '../api';
import { useLanguage } from '../translations';
import StudentCorrectionModal from './StudentCorrectionModal';

interface LessonListProps {
  username: string;
  sheetNumber: string;
  lessons: WordData[];
  onSelectLesson: (index: number, isReset: boolean) => void;
  onLogout: () => void;
  onRefresh: () => void;
  loading: boolean;
}

export default function LessonList({
  username,
  sheetNumber,
  lessons,
  onSelectLesson,
  onLogout,
  onRefresh,
  loading,
}: LessonListProps) {
  const { t } = useLanguage();
  const [hideCompleted, setHideCompleted] = React.useState<boolean>(true);
  const [expandedComments, setExpandedComments] = React.useState<Record<number, boolean>>({});
  const [resetModalLesson, setResetModalLesson] = React.useState<{ index: number; lesson: WordData } | null>(null);
  const [resetting, setResetting] = React.useState(false);
  const [resetError, setResetError] = React.useState<string | null>(null);
  const [showCorrectionModal, setShowCorrectionModal] = React.useState(false);

  const isLessonCompleted = (l: WordData): boolean => {
    if (!l || !l.completed) return false;
    const clean = String(l.completed).trim().toLowerCase();
    return clean === 'تم' || clean === 'completed' || clean === 'done';
  };

  // Helper to parse dates flexibly (Arabic numerals, ISO, YYYY-MM-DD, DD/MM/YYYY, etc.)
  const parseFlexibleDate = (dateStr: string | number | undefined, isEnd = false): Date | null => {
    if (dateStr === undefined || dateStr === null) return null;
    let cleanStr = String(dateStr).trim();
    if (!cleanStr || cleanStr === '-' || cleanStr === 'null' || cleanStr === 'undefined') return null;

    // Normalize Arabic numerals to standard 0-9
    cleanStr = cleanStr.replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());

    // Normalize CJK date formats if present
    cleanStr = cleanStr.replace(/[年月]/g, '/').replace(/日/g, '').trim();

    // Check direct ISO / standard string: "YYYY-MM-DD HH:mm" or "YYYY-MM-DDTHH:mm:ss"
    const directDate = new Date(cleanStr.replace(' ', 'T'));
    if (!isNaN(directDate.getTime())) {
      // If no time component was in the string, set boundary time
      if (!cleanStr.includes(':') && !cleanStr.includes('T') && !cleanStr.includes(' ')) {
        if (isEnd) {
          directDate.setHours(23, 59, 59, 999);
        } else {
          directDate.setHours(0, 0, 0, 0);
        }
      }
      return directDate;
    }

    // Try YYYY-MM-DD or YYYY/MM/DD with optional time
    const isoMatch = cleanStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10) - 1;
      const d = parseInt(isoMatch[3], 10);
      const h = isoMatch[4] !== undefined ? parseInt(isoMatch[4], 10) : (isEnd ? 23 : 0);
      const mi = isoMatch[5] !== undefined ? parseInt(isoMatch[5], 10) : (isEnd ? 59 : 0);
      const s = isoMatch[6] !== undefined ? parseInt(isoMatch[6], 10) : (isEnd ? 59 : 0);
      return new Date(y, m, d, h, mi, s);
    }

    // Try DD-MM-YYYY or DD/MM/YYYY with optional time
    const dmyMatch = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10);
      const m = parseInt(dmyMatch[2], 10) - 1;
      const y = parseInt(dmyMatch[3], 10);
      const h = dmyMatch[4] !== undefined ? parseInt(dmyMatch[4], 10) : (isEnd ? 23 : 0);
      const mi = dmyMatch[5] !== undefined ? parseInt(dmyMatch[5], 10) : (isEnd ? 59 : 0);
      const s = dmyMatch[6] !== undefined ? parseInt(dmyMatch[6], 10) : (isEnd ? 59 : 0);
      return new Date(y, m, d, h, mi, s);
    }

    return null;
  };

  const isLessonVisibleByDate = (l: WordData): boolean => {
    const hasStartDate = !!l.startDate && String(l.startDate).trim() !== '' && String(l.startDate).trim() !== '-';
    const hasEndDate = !!l.endDate && String(l.endDate).trim() !== '' && String(l.endDate).trim() !== '-';
    const hasDays = l.expireAfterDays !== undefined && l.expireAfterDays !== null && String(l.expireAfterDays).trim() !== '' && String(l.expireAfterDays).trim() !== '-';

    // If no schedule conditions defined, lesson is always visible
    if (!hasStartDate && !hasEndDate && !hasDays) return true;

    const now = new Date();

    if (hasStartDate) {
      const startDate = parseFlexibleDate(l.startDate, false);
      if (startDate && now < startDate) {
        // Scheduled in the future; not yet active!
        return false;
      }
      if (startDate && hasDays) {
        const days = typeof l.expireAfterDays === 'number' ? l.expireAfterDays : parseFloat(String(l.expireAfterDays));
        if (!isNaN(days) && days > 0) {
          const calculatedExpiry = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
          if (now > calculatedExpiry) {
            // Expired after X days from start date
            return false;
          }
        }
      }
    }

    if (hasEndDate) {
      const endDate = parseFlexibleDate(l.endDate, true);
      if (endDate && now > endDate) {
        // Expired after unified end date
        return false;
      }
    }

    return true;
  };

  const completedCount = React.useMemo(() => {
    return lessons.filter(isLessonCompleted).length;
  }, [lessons]);

  const lessonsWithIndex = React.useMemo(() => {
    return lessons.map((lesson, originalIndex) => ({
      ...lesson,
      originalIndex,
    }));
  }, [lessons]);

  const displayedLessons = React.useMemo(() => {
    return lessonsWithIndex.filter(l => {
      const completed = isLessonCompleted(l);

      if (completed) {
        // If hideCompleted is true, hide completed lessons.
        // If hideCompleted is false, show completed lessons!
        return !hideCompleted;
      }

      // Uncompleted lessons: only show if currently active and visible by date schedule
      return isLessonVisibleByDate(l);
    });
  }, [lessonsWithIndex, hideCompleted]);

  const toggleComment = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    setExpandedComments(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const hasMoreThanTwoWords = (text: string): boolean => {
    if (!text) return false;
    const words = text.trim().split(/\s+/).filter(Boolean);
    return words.length > 2;
  };

  const getTwoWordsOrFull = (text: string): string => {
    if (!text) return 'درس غير معنون';
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 2) return text;
    return words.slice(0, 2).join(' ') + '...';
  };

  const isCommentExpanded = (idx: number, text: string): boolean => {
    if (!hasMoreThanTwoWords(text)) return true;
    return !!expandedComments[idx];
  };

  const handleOpenResetModal = (e: React.MouseEvent, index: number, lesson: WordData) => {
    e.stopPropagation();
    setResetError(null);
    setResetModalLesson({ index, lesson });
  };

  const handleConfirmReset = async () => {
    if (!resetModalLesson) return;
    setResetting(true);
    setResetError(null);
    try {
      const { index, lesson } = resetModalLesson;
      await decrementRetryCount(sheetNumber, index, username, lesson.comment);
      await unmarkLessonCompleted(sheetNumber, index, username, lesson.comment);
      onRefresh();
      onSelectLesson(index, true);
      setResetModalLesson(null);
    } catch (err: any) {
      console.error('Reset lesson failed:', err);
      setResetError('فشل إعادة تعيين الدرس. يرجى مراجعة الاتصال والتحقق.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 text-right font-sans">
      {/* Student Profile Ribbon */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#fefcf8] dark:bg-slate-900 border border-amber-100 dark:border-slate-800 rounded-3xl p-5 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md shadow-amber-100/30 dark:shadow-none transition-colors duration-300"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-500 dark:text-amber-400 rounded-2xl flex items-center justify-center text-xl font-bold">
            👤
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{username}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">{t('student_sheet_badge')} #{sheetNumber}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => setShowCorrectionModal(true)}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer shadow-md shadow-amber-500/10 active:scale-98"
          >
            <Award className="w-4 h-4" />
            <span>{t('view_teacher_correction', 'عرض تصحيح الأستاذ')} 📝</span>
          </button>

          <button
            onClick={onLogout}
            className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/50 text-rose-500 dark:text-rose-400 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('logout_btn')}</span>
          </button>
        </div>
      </motion.div>

      {/* Title & Filter Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-amber-400 text-slate-900 rounded-2xl shadow-sm">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{t('available_lessons_title')}</h3>
        </div>

        <div className="flex items-center gap-2">
          {completedCount > 0 && (
            <button
              onClick={() => setHideCompleted(prev => !prev)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer border shadow-sm ${
                hideCompleted
                  ? 'bg-amber-100 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 hover:bg-amber-200'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              {hideCompleted ? <EyeOff className="w-4 h-4 text-amber-600 dark:text-amber-400" /> : <Eye className="w-4 h-4 text-indigo-500" />}
              <span>{hideCompleted ? `${t('show_completed')} (${completedCount})` : t('hide_completed')}</span>
            </button>
          )}

          {loading && (
            <div className="text-xs text-indigo-600 dark:text-indigo-400 font-bold animate-pulse flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
              <span>{t('syncing_status')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Lesson Board */}
      {lessons.length === 0 ? (
        <div className="bg-[#fefcf8] dark:bg-slate-900 border border-amber-100 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-500 dark:text-slate-400 shadow-md">
          <span className="text-4xl">📭</span>
          <p className="mt-3 text-sm font-semibold">{t('no_lessons_msg')}</p>
        </div>
      ) : displayedLessons.length === 0 ? (
        <div className="bg-[#fefcf8] dark:bg-slate-900 border border-amber-100 dark:border-slate-800 rounded-3xl p-10 text-center shadow-md">
          <span className="text-4xl">{completedCount > 0 ? '🎉' : '📅'}</span>
          <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-100 mt-2">
            {completedCount > 0 ? t('all_completed_title') : t('all_scheduled_future_title')}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
            {completedCount > 0 ? t('all_completed_sub') : t('all_scheduled_future_sub')}
          </p>
          <button
            onClick={() => setHideCompleted(false)}
            className="mt-4 px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-900 font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Eye className="w-4 h-4" />
            <span>{completedCount > 0 ? `${t('show_completed')} (${completedCount})` : t('show_all_lessons_btn')}</span>
          </button>
        </div>
      ) : (
        <div className="bg-[#fefcf8] dark:bg-slate-900 border border-amber-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-md shadow-amber-100/30 dark:shadow-none transition-colors duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-amber-50/40 dark:bg-slate-950/40 border-b border-amber-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-extrabold">
                  <th className="px-3 py-4 md:px-6">{t('table_col_lesson')}</th>
                  <th className="px-3 py-4 md:px-6 text-center">{t('table_col_status')}</th>
                  <th className="px-3 py-4 md:px-6 text-center">{t('table_col_retry')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100/40 dark:divide-slate-800/60">
                {displayedLessons.map((lesson) => {
                  const idx = lesson.originalIndex;
                  const isCompleted = isLessonCompleted(lesson);
                  
                  let showReset = isCompleted && lesson.retryResetCount > 0;
                  if (lesson.resetCondition === 'نعم') {
                    showReset = showReset && lesson.dzValue === 'تم';
                  }

                  const commentText = lesson.comment || 'درس غير معنون';
                  const isExpanded = isCommentExpanded(idx, commentText);

                  return (
                    <motion.tr
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.03 }}
                      key={idx}
                      onClick={() => onSelectLesson(idx, false)}
                      className={`group hover:bg-amber-50/30 dark:hover:bg-slate-800/40 cursor-pointer transition-all ${
                        isCompleted ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : 'bg-[#fefcf8] dark:bg-slate-900'
                      }`}
                    >
                      {/* Lesson Name & Topic */}
                      <td className="px-3 py-3 md:px-6 md:py-4.5">
                        <div className="flex items-center gap-2 md:gap-3">
                          <div className={`p-2 md:p-2.5 rounded-2xl transition-colors shrink-0 ${
                            isCompleted 
                              ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                              : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 group-hover:bg-amber-400 group-hover:text-slate-900 shadow-sm'
                          }`}>
                            <PlayCircle className="w-4 h-4 md:w-5 md:h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div 
                              onClick={(e) => {
                                if (hasMoreThanTwoWords(commentText)) {
                                  toggleComment(e, idx);
                                } else {
                                  onSelectLesson(idx, false);
                                }
                              }}
                              className="inline-block max-w-full"
                            >
                              <span className={`font-extrabold text-xs md:text-sm transition-colors cursor-pointer select-none ${
                                isCompleted ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400'
                              }`}>
                                {isExpanded ? (
                                  <span className="block break-words leading-relaxed max-w-[150px] xs:max-w-[200px] sm:max-w-md">
                                    {commentText}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1">
                                    <span>{getTwoWordsOrFull(commentText)}</span>
                                    <span className="text-[9px] text-indigo-500 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/50 px-1 py-0.5 rounded font-normal font-sans hover:bg-amber-100">
                                      {t('more_details')}
                                    </span>
                                  </span>
                                )}
                              </span>
                            </div>
                            <span className="text-[9px] md:text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-1 block">
                              {t('target_word')} {lesson.word}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Achievement Status */}
                      <td className="px-2 py-3 md:px-6 md:py-4.5 text-center">
                        <div className="flex items-center justify-center">
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full">
                              <CheckCircle className="w-3.5 h-3.5 hidden sm:inline" />
                              <span>{t('status_completed')}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-full">
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse hidden sm:inline" />
                              <span>{t('status_new')}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Reset / Retake Button */}
                      <td className="px-2 py-3 md:px-6 md:py-4.5 text-center">
                        <div className="flex items-center justify-center">
                          {showReset ? (
                            <button
                              onClick={(e) => handleOpenResetModal(e, idx, lesson)}
                              className="px-2 py-1 md:px-3 md:py-1.5 bg-amber-400 hover:bg-amber-500 border border-amber-300 text-slate-900 text-[10px] md:text-xs font-extrabold rounded-xl transition-all flex items-center gap-1 active:scale-95 cursor-pointer shadow-sm shrink-0"
                            >
                              <RefreshCw className="w-3 h-3 md:w-3.5 md:h-3.5 animate-spin-hover" />
                              <span>{t('retry_button')} ({lesson.retryResetCount})</span>
                            </button>
                          ) : isCompleted ? (
                            <span className="text-slate-400 dark:text-slate-500 text-[10px] md:text-[11px] flex items-center gap-1 justify-center font-bold">
                              <Lock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                              <span className="hidden sm:inline">{t('status_locked')}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">-</span>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      <AnimatePresence>
        {loading && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md select-none pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 rounded-3xl p-6 max-w-xs w-full shadow-2xl text-center flex flex-col items-center gap-3"
            >
              <div className="w-12 h-12 border-4 border-amber-200 dark:border-slate-800 border-t-amber-500 rounded-full animate-spin" />
              <div>
                <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{t('loading_lessons_title')}</h4>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {resetModalLesson && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-right"
            >
              <div className="flex items-center gap-3 text-amber-500 mb-3">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">{t('retry_modal_title')}</h3>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                    {resetModalLesson.lesson.comment || 'درس غير معنون'}
                  </p>
                </div>
              </div>

              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed my-4">
                {t('retry_modal_confirm')}
                <br />
                <span className="text-amber-600 dark:text-amber-400 font-bold block mt-1">
                  {t('retry_modal_sub')} (المتبقي: {resetModalLesson.lesson.retryResetCount}).
                </span>
              </p>

              {resetError && (
                <div className="p-3 mb-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-bold">
                  {resetError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setResetModalLesson(null)}
                  disabled={resetting}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  {t('cancel_btn')}
                </button>
                <button
                  onClick={handleConfirmReset}
                  disabled={resetting}
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-900 font-extrabold rounded-xl text-xs transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {resetting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>{t('confirm_retry_btn')}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student Corrections Modal */}
      <AnimatePresence>
        {showCorrectionModal && (
          <StudentCorrectionModal
            username={username}
            sheetNumber={sheetNumber}
            onClose={() => setShowCorrectionModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

