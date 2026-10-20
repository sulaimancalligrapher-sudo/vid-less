import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, CheckCircle2, ShieldCheck, Zap, Sparkles, UserCheck, Flame, BarChart3, QrCode } from 'lucide-react';
import { LiveConnectedStudent } from '../types';

interface LiveAttendanceChartProps {
  students: LiveConnectedStudent[] | Array<{ username: string; sheetNumber?: string; studentName?: string; isReady?: boolean }>;
  title?: string;
  subtitle?: string;
  showLaunchButton?: boolean;
  onLaunch?: () => void;
  launchLabel?: string;
  roomPin?: string;
  isPresenter?: boolean;
  readyCount?: number;
  totalSessionCount?: number;
}

const AVATAR_GRADIENTS = [
  'from-amber-500 to-orange-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-purple-500 to-indigo-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-teal-600',
  'from-fuchsia-500 to-purple-600',
  'from-yellow-400 to-amber-600',
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  const idx = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[idx];
}

export default function LiveAttendanceChart({
  students = [],
  title = 'لوحة حضور وجاهزية الطلاب للمسابقة',
  subtitle = 'شاشة العرض المباشرة ترصد تفاعل ودخول الطلاب لحظة بلحظة ⚡',
  showLaunchButton = false,
  onLaunch,
  launchLabel = 'ابدأ المسابقة والتحدي الآن 🚀',
  roomPin,
  isPresenter = false,
  readyCount,
  totalSessionCount,
}: LiveAttendanceChartProps) {
  const totalCount = totalSessionCount !== undefined ? totalSessionCount : students.length;
  const verifiedCount = students.filter(s => (s as any).pinVerified).length;
  const actualReadyCount = readyCount !== undefined ? readyCount : students.filter(s => (s as any).isReady !== false).length;
  const readinessPercent = totalCount > 0 ? Math.min(100, Math.round((actualReadyCount / Math.max(totalCount, 1)) * 100)) : 0;

  // Distribution by sheet number (grouping)
  const sheetGroups: Record<string, number> = {};
  students.forEach((s) => {
    const sheet = String(s.sheetNumber || 'عام').trim();
    sheetGroups[sheet] = (sheetGroups[sheet] || 0) + 1;
  });
  const groupEntries = Object.entries(sheetGroups).slice(0, 6);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 select-none text-right" dir="rtl">
      {/* Top Header Card */}
      <div className="relative p-6 sm:p-8 bg-gradient-to-r from-slate-900/95 via-indigo-950/80 to-slate-900/95 border border-indigo-500/30 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden">
        <div className="absolute top-0 left-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-right flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
              <Sparkles className="w-4 h-4 text-amber-400 animate-spin-slow" />
              <span>قاعة الانتظار والاستعداد الحي ⚡</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-100 tracking-tight leading-tight">
              {title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              {subtitle}
            </p>
          </div>

          {/* Quick Counter Badge */}
          <div className="flex items-center gap-3 bg-slate-950/70 border border-slate-800 p-3 sm:p-4 rounded-2xl shadow-inner shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg shadow-amber-500/25">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold">جاهزية الطلاب للتحدي</div>
              <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                {actualReadyCount}
                <span className="text-xs text-slate-400 font-sans font-bold mr-1.5">/ {totalCount} ({readinessPercent}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Presenter Launch Action Button */}
        {showLaunchButton && onLaunch && (
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>القاعة في وضع الاستعداد • يمكنك إطلاق الأسئلة في أي لحظة</span>
            </div>
            <button
              onClick={onLaunch}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-amber-500/30 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 animate-pulse"
            >
              <Zap className="w-5 h-5 fill-slate-950 text-slate-950" />
              <span>{launchLabel} ({actualReadyCount} جاهز)</span>
            </button>
          </div>
        )}
      </div>

      {/* STATS & VISUAL CHART ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Readiness Card */}
        <div className="p-5 bg-slate-900/80 border border-slate-800/80 rounded-2xl backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>نسبة الجاهزية للتحدي</span>
            </span>
            <span className="font-mono text-emerald-300 font-black">{readinessPercent}%</span>
          </div>
          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${readinessPercent}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>الطلاب المستعدون للتحدي:</span>
            <span className="font-mono text-emerald-400 font-bold">{actualReadyCount} / {totalCount} طالب</span>
          </div>
        </div>

        {/* Metric 2: Visual Comparison Bars */}
        <div className="p-5 bg-slate-900/80 border border-slate-800/80 rounded-2xl backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span className="flex items-center gap-1.5 text-sky-400">
              <BarChart3 className="w-4 h-4" />
              <span>مؤشرات القاعة اللحظية</span>
            </span>
            <span className="text-[10px] text-slate-500">مباشر ⚡</span>
          </div>
          {/* Mini dynamic bar comparison */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-20 text-slate-400 truncate">المتصلون</span>
              <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-400 rounded-full" 
                  style={{ width: `${Math.min(100, (totalCount / Math.max(totalCount, 5)) * 100)}%` }} 
                />
              </div>
              <span className="font-mono text-slate-200 font-bold w-6 text-left">{totalCount}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-20 text-slate-400 truncate">المؤكدون</span>
              <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-400 rounded-full" 
                  style={{ width: `${totalCount > 0 ? Math.min(100, (verifiedCount / totalCount) * 100) : 0}%` }} 
                />
              </div>
              <span className="font-mono text-slate-200 font-bold w-6 text-left">{verifiedCount}</span>
            </div>
          </div>
        </div>

        {/* Metric 3: PIN / Access Code or Challenge Status */}
        <div className="p-5 bg-slate-900/80 border border-slate-800/80 rounded-2xl backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-2">
            <span className="flex items-center gap-1.5 text-amber-400">
              <ShieldCheck className="w-4 h-4" />
              <span>{roomPin ? 'رمز دخول القاعة' : 'حالة المسابقة'}</span>
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-center py-1">
            <div className="text-2xl font-black font-mono tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
              {roomPin ? roomPin : `${totalCount} مستعد`}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {roomPin
                ? 'يُدخل الطالب هذا الرمز عند الانضمام لتأكيد حضوره'
                : 'الطلاب جاهزون لبدء المنافسة فور إشارة المعلم ⚡'}
            </div>
          </div>
        </div>
      </div>

      {/* CONNECTED STUDENTS WALL */}
      <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-3xl backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-amber-400" />
            <h3 className="font-black text-sm text-slate-200">
              جدار الطلاب الحاضرين في القاعة ({totalCount})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            يتم تحديث الأسماء فورياً عند دخول أي طالب للشاشة 🎯
          </span>
        </div>

        {totalCount === 0 ? (
          /* Empty Waiting State */
          <div className="py-14 text-center space-y-4">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-ping" />
              <div className="relative w-20 h-20 rounded-3xl bg-slate-800/80 border border-slate-700/80 text-amber-400 flex items-center justify-center shadow-inner">
                <Users className="w-10 h-10 animate-pulse text-amber-400" />
              </div>
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-200">
                في انتظار انضمام الطلاب للقاعة...
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                اطلب من الطلاب فتح الرابط وإدخال الاسم ورقم الشيت للظهور فوراً على هذه الشاشة.
              </p>
            </div>
          </div>
        ) : (
          /* Realtime Floating Students Grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-96 overflow-y-auto p-1">
            <AnimatePresence>
              {students.map((student, idx) => {
                const name = (student as any).studentName || student.username || 'طالب';
                const sheet = student.sheetNumber || '';
                const gradient = getAvatarGradient(name);
                const firstLetter = name.trim().charAt(0) || 'ط';

                return (
                  <motion.div
                    key={`${name}_${sheet}_${idx}`}
                    initial={{ opacity: 0, scale: 0.8, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 280 }}
                    className={`p-3 rounded-2xl flex items-center gap-2.5 shadow-md hover:scale-[1.02] transition-all group border ${
                      (student as any).isReady !== false
                        ? 'bg-slate-950/90 border-emerald-500/40 shadow-emerald-500/10'
                        : 'bg-slate-950/50 border-slate-800/80 border-dashed opacity-75'
                    }`}
                  >
                    {/* Student Avatar */}
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${gradient} flex items-center justify-center text-white font-black text-xs shadow-md shrink-0`}>
                      {firstLetter}
                    </div>

                    {/* Student Info */}
                    <div className="min-w-0 flex-1 text-right">
                      <div className="text-xs font-black text-slate-100 truncate group-hover:text-amber-300 transition-colors">
                        {name}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        {sheet && <span className="font-mono text-amber-400">#{sheet}</span>}
                        {(student as any).isReady !== false ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-emerald-400 font-bold">مستعد ⚡</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                            <span className="text-amber-400 font-bold">في الانتظار...</span>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
