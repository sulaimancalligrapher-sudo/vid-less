import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, KeyRound, CheckCircle2, X, Lock, Unlock } from 'lucide-react';

interface AdminPasswordModalProps {
  stage: 1 | 2; // 1: Reveal settings, 2: Open settings panel
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdminPasswordModal({ stage, onClose, onSuccess }: AdminPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Hardcoded Static Codes
  // Stage 1 correct codes (Arabic and English variants)
  const STAGE_1_CODES = ['1122', 'أستاذ2026', 'teacher2026'];
  // Stage 2 correct codes (Arabic and English variants)
  const STAGE_2_CODES = ['3344', 'إدارة2026', 'admin2026'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const inputClean = password.trim();

    if (stage === 1) {
      if (STAGE_1_CODES.includes(inputClean)) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setError('الرمز الإداري الأول غير صحيح! يرجى المحاولة مرة أخرى.');
      }
    } else {
      if (STAGE_2_CODES.includes(inputClean)) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setError('الرمز الإداري الثاني غير صحيح! يرجى المحاولة مرة أخرى.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-md bg-[#fefcf8] dark:bg-slate-900 border border-amber-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative text-right"
        dir="rtl"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon and Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 dark:text-amber-400 mb-4 shadow-inner">
            {success ? (
              <Unlock className="w-7 h-7 text-emerald-500 animate-bounce" />
            ) : (
              <Lock className="w-7 h-7 text-amber-500" />
            )}
          </div>
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
            {stage === 1 ? 'التحقق الإداري (المستوى الأول)' : 'التحقق الأمني (المستوى الثاني)'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            {stage === 1
              ? 'يرجى إدخال رمز المرور الإداري الأول لتفعيل وضع الإدارة وإظهار زر إعدادات قاعدة البيانات.'
              : 'يرجى إدخال رمز المرور الإداري الثاني للتمكن من فتح وتعديل لوحة إعدادات الاتصال بالشيت.'}
          </p>
        </div>

        {success ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl text-xs flex items-center justify-center gap-2.5 font-bold mb-2"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>تم التحقق بنجاح! جاري الانتقال...</span>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
                {stage === 1 ? 'رمز المرور الأول:' : 'رمز المرور الثاني:'}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  required
                  className="w-full px-4 py-3.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-100 rounded-2xl placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all pr-12 text-sm text-center font-mono font-bold tracking-widest"
                />
                <KeyRound className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs flex items-center gap-2"
              >
                <ShieldAlert className="w-4.5 h-4.5 shrink-0 text-rose-500" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              className="w-full bg-slate-900 dark:bg-amber-400 dark:text-slate-900 text-white font-extrabold py-3.5 rounded-2xl shadow-lg hover:bg-slate-800 dark:hover:bg-amber-500 transition-all text-xs flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
            >
              <span>تحقق وتأكيد الدخول</span>
            </button>
          </form>
        )}

        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
            هذه المنطقة محمية بكلمة مرور مشفرة خاصة بالمعلم والإدارة فقط.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
