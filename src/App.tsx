import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Student, WordData, HeaderConfig } from './types';
import { fetchLessons, isApiConfigured, getWebAppUrl, fetchHeaderConfig } from './api';
import StudentLogin from './components/StudentLogin';
import LessonList from './components/LessonList';
import LessonDetail from './components/LessonDetail';
import SettingsPanel from './components/SettingsPanel';
import AdminPasswordModal from './components/AdminPasswordModal';
import AdminPanel from './components/AdminPanel';
import LanguageSelector from './components/LanguageSelector';
import { useLanguage } from './translations';
import { 
  Settings, RefreshCw, BookOpen, Sparkles, Database, Sun, Moon, 
  Lock, ShieldCheck, Copy, CheckCircle2, ArrowLeft, ExternalLink, 
  KeyRound, Layers, ShieldAlert, FileSpreadsheet, UserCheck,
  Facebook, Instagram, Youtube
} from 'lucide-react';

const LineIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2C6.48 2 2 5.82 2 10.53c0 4.22 3.61 7.77 8.48 8.43.33.07.78.22.89.5.1.26.07.66.03.92-.06.4-.26 1.57-.3 1.91-.05.47.22.46.46.3.19-.12 5.18-3.08 7.08-5.28C20.46 15.35 22 13.08 22 10.53 22 5.82 17.52 2 12 2zm7.36 8.49c.35 0 .63.29.63.63s-.28.63-.63.63h-1.26v1.26c0 .35-.28.63-.63.63s-.63-.28-.63-.63v-2.52c0-.35.28-.63.63-.63h1.88zm-4.75 0c.35 0 .63.29.63.63v2.52c0 .35-.28.63-.63.63s-.63-.28-.63-.63v-2.52c0-.35.28-.63.63-.63zm-2.52 0c.35 0 .63.29.63.63v2.52c0 .35-.28.63-.63.63s-.63-.28-.63-.63v-2.52c0-.35.28-.63.63-.63zm-3.27 0h1.26c.35 0 .63.29.63.63s-.28.63-.63.63h-.63v.63h.63c.35 0 .63.29.63.63s-.28.63-.63.63h-1.26c-.35 0-.63-.28-.63-.63v-2.52c0-.35.28-.63.63-.63z" />
  </svg>
);

export default function App() {
  const { t } = useLanguage();
  const [webAppUrl, setWebAppUrl] = useState(getWebAppUrl());
  const [isConfigured, setIsConfigured] = useState(isApiConfigured());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Page Routing Mode: 'student' | 'admin'
  const [pageMode, setPageMode] = useState<'student' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('page') === 'admin' ? 'admin' : 'student';
    }
    return 'student';
  });

  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => localStorage.getItem('isAdminUnlocked') === 'true');
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [showFirstPassModal, setShowFirstPassModal] = useState(false);
  const [showSecondPassModal, setShowSecondPassModal] = useState(false);
  const [copiedStudentUrl, setCopiedStudentUrl] = useState(false);

  // Admin login input state for inline unlock
  const [adminInputPassword, setAdminInputPassword] = useState('');
  const [adminPassError, setAdminPassError] = useState<string | null>(null);

  const [student, setStudent] = useState<Student | null>(null);
  const [sheetName, setSheetName] = useState<string>('');
  const [lessons, setLessons] = useState<WordData[]>([]);
  const [currentLessonIdx, setCurrentLessonIdx] = useState<number | null>(null);
  const [isReset, setIsReset] = useState(false);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Dynamic Header Configuration from 'header' sheet
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchHeaderConfig().then(cfg => {
      if (mounted && cfg) {
        setHeaderConfig(cfg);
      }
    });
    return () => { mounted = false; };
  }, [webAppUrl, isConfigured]);

  // Sync route with URL query param and popstate
  const navigateToPage = (mode: 'student' | 'admin') => {
    setPageMode(mode);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (mode === 'admin') {
        url.searchParams.set('page', 'admin');
      } else {
        url.searchParams.delete('page');
      }
      window.history.pushState({}, '', url.toString());
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setPageMode(params.get('page') === 'admin' ? 'admin' : 'student');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Auto-login for student if cookies/localStorage or URL parameters exist
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlUsername = params.get('username') || params.get('name') || params.get('user') || params.get('student') || params.get('student_name');
      const urlSheetNumber = params.get('sheet_number') || params.get('sheetNumber') || params.get('number') || params.get('sheet') || params.get('num') || params.get('id');

      if (urlUsername && urlSheetNumber) {
        localStorage.setItem('loggedInUsername', urlUsername.trim());
        localStorage.setItem('loggedInSheetNumber', urlSheetNumber.trim());
      }
    }

    const loggedUsername = localStorage.getItem('loggedInUsername');
    const loggedSheetNumber = localStorage.getItem('loggedInSheetNumber');
    if (loggedUsername && loggedSheetNumber && isConfigured) {
      setStudent({ username: loggedUsername, sheetNumber: loggedSheetNumber });
      setSheetName(loggedSheetNumber);
      loadStudentLessons(loggedSheetNumber, loggedUsername);
    }
  }, [webAppUrl, isConfigured]);

  const loadStudentLessons = async (nameOfSheet: string, userOverride?: string) => {
    setLoadingLessons(true);
    setError(null);
    try {
      const activeUser = userOverride || student?.username || localStorage.getItem('loggedInUsername') || '';
      const data = await fetchLessons(nameOfSheet, activeUser);
      setLessons(data);
    } catch (err: any) {
      console.error(err);
      setError('فشل استرداد قائمة الدروس من الشيت. يرجى مراجعة إعدادات الرابط وصلاحيات الوصول.');
    } finally {
      setLoadingLessons(false);
    }
  };

  const handleLoginSuccess = (username: string, sheetNum: string, returnedSheetName: string) => {
    setStudent({ username, sheetNumber: sheetNum });
    setSheetName(returnedSheetName || sheetNum);
    loadStudentLessons(returnedSheetName || sheetNum, username);
  };

  const handleLogout = () => {
    localStorage.removeItem('loggedInUsername');
    localStorage.removeItem('loggedInSheetNumber');
    setStudent(null);
    setSheetName('');
    setLessons([]);
    setCurrentLessonIdx(null);
    setIsReset(false);
  };

  const handleRefreshList = () => {
    if (sheetName) {
      loadStudentLessons(sheetName);
    }
  };

  const handleSelectLesson = (index: number, resetMode: boolean = false) => {
    setIsReset(resetMode);
    setCurrentLessonIdx(index);
  };

  const handleSaveSettings = (url: string) => {
    setWebAppUrl(url);
    const configured = url.trim().length > 0;
    setIsConfigured(configured);
    if (!configured) {
      handleLogout();
    }
  };

  const handleAdminUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPassError(null);
    const STAGE_1_CODES = ['1122', 'أستاذ2026', 'teacher2026'];
    if (STAGE_1_CODES.includes(adminInputPassword.trim())) {
      setIsAdminUnlocked(true);
      localStorage.setItem('isAdminUnlocked', 'true');
      setAdminInputPassword('');
      setIsAdminPanelOpen(true); // Open admin panel directly upon unlock
    } else {
      setAdminPassError('رمز المرور الإداري غير صحيح! يرجى المحاولة مرة أخرى.');
    }
  };

  const getStudentShareUrl = () => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      return `${origin}${pathname}?page=student`;
    }
    return '';
  };

  const copyStudentLink = () => {
    navigator.clipboard.writeText(getStudentShareUrl());
    setCopiedStudentUrl(true);
    setTimeout(() => setCopiedStudentUrl(false), 2500);
  };

  return (
    <div className="bg-gradient-to-br from-[#faf7f2] via-[#f5efe5] to-[#ebf3ed] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-100 min-h-screen flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-800 transition-colors duration-300">
      
      {/* ----------------- TOP BANNER HEADER ----------------- */}
      <header className="bg-[#fefdfa]/90 dark:bg-slate-900/90 border-b border-amber-100/60 dark:border-slate-800 sticky top-0 z-40 backdrop-blur-md px-3 py-2.5 sm:px-6 sm:py-3.5 shadow-sm transition-colors duration-300">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
          
          {/* Row 1 on mobile: Logo + Title + Subtitle in a single horizontal row */}
          <div className="flex flex-row items-center gap-2.5 sm:gap-3 text-right w-full sm:w-auto justify-start">
            {headerConfig?.logoUrl ? (
              <img
                src={headerConfig.logoUrl}
                alt="Logo"
                className="w-10 h-10 sm:w-10 sm:h-10 rounded-2xl object-cover shadow-md border border-amber-200/60 dark:border-slate-700/80 bg-white dark:bg-slate-800 shrink-0"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className={`w-10 h-10 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center text-xl sm:text-xl font-bold shadow-md shrink-0 ${
                pageMode === 'admin' 
                  ? 'bg-gradient-to-tr from-purple-500 via-indigo-500 to-indigo-600 shadow-purple-200' 
                  : 'bg-gradient-to-tr from-amber-400 via-orange-400 to-amber-500 shadow-amber-200'
              }`}>
                {pageMode === 'admin' ? '⚡' : '📸'}
              </div>
            )}
            <div className="flex flex-col items-start text-right min-w-0 flex-1">
              <h1 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center justify-start gap-1.5 truncate w-full">
                <span className="truncate">
                  {pageMode === 'admin'
                    ? (headerConfig?.title ? `${headerConfig.title} - الإدارة` : 'بوابة التحكم الإداري وقاعدة البيانات')
                    : (headerConfig?.title || 'ملتقط الوسائط للطلاب')}
                </span>
                {pageMode === 'admin' ? (
                  <span className="text-[10px] px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 rounded-full font-bold shrink-0">
                    ?page=admin
                  </span>
                ) : (
                  <Sparkles className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
                )}
              </h1>
              <p className="text-[11px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5 truncate w-full">
                {pageMode === 'admin'
                  ? 'إدارة الشيت، الأسئلة، وإعدادات الربط'
                  : (headerConfig?.subtitle || 'نظام القراءة والواجبات المطور')}
              </p>
            </div>
          </div>

          {/* Row 2 on mobile: Quick Controls & Dynamic Buttons underneath in row 2 */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center sm:justify-end w-full sm:w-auto pt-1 sm:pt-0 border-t border-amber-100/40 sm:border-t-0 dark:border-slate-800/40">
            {/* Dynamic Buttons from header sheet */}
            {headerConfig?.buttons && headerConfig.buttons.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-end">
                {headerConfig.buttons.map((btn, idx) => (
                  <a
                    key={idx}
                    href={btn.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 dark:from-indigo-600 dark:to-purple-600 dark:hover:from-indigo-700 dark:hover:to-purple-700 text-white font-extrabold rounded-2xl text-xs transition-all shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer whitespace-nowrap"
                    title={btn.label}
                  >
                    <span>{btn.label}</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>
                ))}
              </div>
            )}

            {/* Language Switcher Dropdown/Button */}
            <LanguageSelector />

            {/* Night Mode Toggle Button */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-sky-100 dark:border-slate-700 text-amber-500 dark:text-amber-300 rounded-2xl cursor-pointer transition-all active:scale-95 shadow-sm"
              title={darkMode ? "الوضع النهاري" : "الوضع الليلي"}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* In Admin Mode */}
            {pageMode === 'admin' ? (
              <>
                {/* Switch to Student Page */}
                <button
                  onClick={() => navigateToPage('student')}
                  className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 border border-amber-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl cursor-pointer transition-all active:scale-95 shadow-sm flex items-center gap-1.5 text-xs font-extrabold"
                  title="الانتقال إلى واجهة الطلاب"
                >
                  <ExternalLink className="w-4 h-4 text-amber-500" />
                  <span>صفحة الطلاب 🎓</span>
                </button>

                {isAdminUnlocked && (
                  <button
                    onClick={() => {
                      setIsAdminUnlocked(false);
                      setIsSettingsOpen(false);
                      setIsAdminPanelOpen(false);
                      localStorage.removeItem('isAdminUnlocked');
                    }}
                    className="px-3 py-2.5 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/80 dark:hover:bg-rose-950/40 border border-rose-100/60 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 rounded-2xl cursor-pointer transition-all active:scale-95 shadow-sm flex items-center gap-1.5 text-xs font-bold"
                    title="الخروج من وضع الإدارة"
                  >
                    <Lock className="w-4 h-4" />
                    <span>قفل الإدارة</span>
                  </button>
                )}
              </>
            ) : (
              /* In Student Mode */
              <>
                {student && (
                  <button
                    onClick={handleRefreshList}
                    disabled={loadingLessons}
                    className="p-2.5 bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 border border-sky-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 rounded-2xl cursor-pointer transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                    title="تحديث البيانات"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingLessons ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* ----------------- MAIN CONTENT AREA ----------------- */}
      <main className="flex-grow flex flex-col relative py-6">
        {error && pageMode === 'student' && (
          <div className="max-w-md mx-auto w-full px-4 mb-4" dir="rtl">
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs flex items-start gap-2.5 shadow-lg">
              <Database className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">خطأ في الاتصال:</p>
                <p className="mt-1 leading-relaxed text-slate-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- PAGE MODE 1: ADMIN PAGE (?page=admin) ---------------- */}
        {pageMode === 'admin' ? (
          <div className="max-w-4xl mx-auto w-full px-4 py-4" dir="rtl">
            {!isAdminUnlocked ? (
              /* Admin Password Verification Portal */
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl text-center relative overflow-hidden"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 mb-4 shadow-inner">
                  <ShieldCheck className="w-8 h-8" />
                </div>

                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">
                  بوابة دخول قسم الإدارة ⚡
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed font-semibold">
                  يرجى إدخال رمز المرور الإداري الأول للوصول إلى لوحة التحكم، ورقة الأسئلة، وإعدادات قاعدة البيانات.
                </p>

                <form onSubmit={handleAdminUnlockSubmit} className="mt-6 space-y-4 text-right">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
                      رمز المرور الإداري:
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={adminInputPassword}
                        onChange={(e) => setAdminInputPassword(e.target.value)}
                        placeholder="أدخل الرمز الإداري الأول (مثل 1122)..."
                        className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-slate-800 dark:text-slate-100 rounded-2xl placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all pr-12 text-sm font-bold"
                      />
                      <KeyRound className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    </div>
                  </div>

                  {adminPassError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs font-bold flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>{adminPassError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-purple-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    <span>دخول لوحة التحكم الإدارية</span>
                  </button>
                </form>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={() => navigateToPage('student')}
                    className="text-xs text-slate-400 hover:text-amber-500 font-bold transition-all flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                  >
                    <span>العودة لصفحة الطلاب 🎓</span>
                  </button>
                </div>
              </motion.div>
            ) : (
              /* Unlocked Admin Workspace Hub */
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                {/* Admin Status Header Banner */}
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

                  <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-purple-600/20">
                      <ShieldCheck className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-black text-slate-100">لوحة التحكم المركزية والإعدادات</h2>
                        <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-extrabold rounded-full">
                          نشط ⚡
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">أنت الآن في وضع الإدارة المباشر عبر الرابط <code className="text-amber-400 font-mono">?page=admin</code></p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 w-full md:w-auto">
                    <button
                      onClick={() => setIsAdminPanelOpen(true)}
                      className="flex-1 md:flex-initial px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>فتح قسم الأسئلة والشيت 📋</span>
                    </button>

                    <button
                      onClick={() => setShowSecondPassModal(true)}
                      className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-2xl active:scale-95 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-amber-400" />
                      <span>إعدادات قاعدة البيانات ⚙️</span>
                    </button>
                  </div>
                </div>

                {/* Dashboard Tools Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Card 1: Admin Panel Control */}
                  <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-lg flex flex-col justify-between space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-100">قسم التحكم بالأسئلة والنتائج</h3>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          التحكم المباشر في ورقة الأسئلة (Questions)، استعراض ورقة إجابات الطلاب (Answers)، وإعادة جدولة الدروس تلقائياً.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsAdminPanelOpen(true)}
                      className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-amber-400 border border-slate-700 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>عرض وتعديل أسئلة الشيت 📋</span>
                    </button>
                  </div>

                  {/* Card 2: Database Settings */}
                  <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-lg flex flex-col justify-between space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
                        <Database className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-100">إعدادات قاعدة البيانات (Google Sheet)</h3>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          ضبط رابط خادم Apps Script WebApp، اختبار حالة الاتصال بالقاعدة، ونسخ كود السكريبت.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowSecondPassModal(true)}
                      className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-indigo-400 border border-slate-700 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Settings className="w-4 h-4" />
                      <span>تعديل رابط الاتصال بالشيت ⚙️</span>
                    </button>
                  </div>
                </div>

                {/* Card 3: Student Direct Share Link Box */}
                <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <UserCheck className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-sm font-black text-slate-100">رابط بوابة الطلاب المباشر</h3>
                    </div>
                    {copiedStudentUrl && (
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                        تم نسخ الرابط بنجاح! 👍
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    يمكنك مشاركة هذا الرابط المباشر مع الطلاب لفتح بوابة تسجيل الدخول واستعراض الدروس دون الوصول لقسم الإدارة:
                  </p>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={getStudentShareUrl()}
                      className="flex-grow px-4 py-3 bg-slate-950 border border-slate-800 text-amber-400 text-xs font-mono rounded-2xl outline-none"
                    />
                    <button
                      onClick={copyStudentLink}
                      className="px-4 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                    >
                      <Copy className="w-4 h-4" />
                      <span>نسخ</span>
                    </button>
                    <button
                      onClick={() => navigateToPage('student')}
                      className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                    >
                      <ExternalLink className="w-4 h-4 text-sky-400" />
                      <span>فتح</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        ) : (
          /* ---------------- PAGE MODE 2: STUDENT PAGE (?page=student or default) ---------------- */
          <AnimatePresence mode="wait">
            {/* 1. Login View */}
            {!student ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex-grow flex flex-col"
              >
                <StudentLogin
                  headerConfig={headerConfig}
                  onLoginSuccess={handleLoginSuccess}
                  onOpenSettings={() => setShowSecondPassModal(true)}
                  isConfigured={isConfigured}
                  isAdminUnlocked={isAdminUnlocked}
                  onUnlockAdmin={() => navigateToPage('admin')}
                />
              </motion.div>
            ) : currentLessonIdx === null ? (
              /* 2. Lesson List View */
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <LessonList
                  username={student.username}
                  sheetNumber={student.sheetNumber}
                  lessons={lessons}
                  onSelectLesson={handleSelectLesson}
                  onLogout={handleLogout}
                  onRefresh={handleRefreshList}
                  loading={loadingLessons}
                />
              </motion.div>
            ) : (
              /* 3. Lesson Detail Terminal */
              <motion.div
                key="detail"
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.25 }}
                className="w-full"
              >
                <LessonDetail
                  student={student}
                  lesson={lessons[currentLessonIdx]}
                  lessonIndex={currentLessonIdx}
                  isReset={isReset}
                  onBack={() => {
                    setCurrentLessonIdx(null);
                    setIsReset(false);
                    handleRefreshList();
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* ----------------- FOOTER ----------------- */}
      <footer className="bg-[#fefdfa]/90 dark:bg-slate-900/90 border-t border-amber-100/60 dark:border-slate-800 py-6 text-center text-slate-500 dark:text-slate-400 text-xs select-none shadow-inner transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Social Links if configured */}
          <div className="flex items-center gap-2.5 flex-wrap justify-center">
            {headerConfig?.socials?.facebook && (
              <a
                href={headerConfig.socials.facebook}
                target="_blank"
                rel="noopener noreferrer"
                title="فيس بوك"
                className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-2xl transition-all shadow-sm hover:scale-110 active:scale-95"
              >
                <Facebook className="w-5 h-5 text-blue-600" />
              </a>
            )}

            {headerConfig?.socials?.instagram && (
              <a
                href={headerConfig.socials.instagram}
                target="_blank"
                rel="noopener noreferrer"
                title="انستغرام"
                className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/50 rounded-2xl transition-all shadow-sm hover:scale-110 active:scale-95"
              >
                <Instagram className="w-5 h-5 text-pink-600" />
              </a>
            )}

            {headerConfig?.socials?.youtube && (
              <a
                href={headerConfig.socials.youtube}
                target="_blank"
                rel="noopener noreferrer"
                title="يوتيوب"
                className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-2xl transition-all shadow-sm hover:scale-110 active:scale-95"
              >
                <Youtube className="w-5 h-5 text-red-600" />
              </a>
            )}

            {headerConfig?.socials?.line && (
              <a
                href={headerConfig.socials.line}
                target="_blank"
                rel="noopener noreferrer"
                title="تطبيق لاين"
                className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-2xl transition-all shadow-sm hover:scale-110 active:scale-95"
              >
                <LineIcon className="w-5 h-5 text-emerald-500" />
              </a>
            )}
          </div>

          <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 font-bold">
            © 2026 سليمان ادم الخطاط
          </p>
        </div>
      </footer>

      {/* ----------------- MODALS & OVERLAYS ----------------- */}
      <AnimatePresence>
        {isAdminPanelOpen && (
          <AdminPanel onClose={() => setIsAdminPanelOpen(false)} />
        )}

        {isSettingsOpen && (
          <SettingsPanel
            onClose={() => setIsSettingsOpen(false)}
            onSave={handleSaveSettings}
          />
        )}

        {showFirstPassModal && (
          <AdminPasswordModal
            stage={1}
            onClose={() => setShowFirstPassModal(false)}
            onSuccess={() => {
              setIsAdminUnlocked(true);
              localStorage.setItem('isAdminUnlocked', 'true');
            }}
          />
        )}

        {showSecondPassModal && (
          <AdminPasswordModal
            stage={2}
            onClose={() => setShowSecondPassModal(false)}
            onSuccess={() => {
              setIsSettingsOpen(true);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

