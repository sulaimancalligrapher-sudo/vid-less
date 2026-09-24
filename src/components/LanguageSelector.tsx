import React from 'react';
import { useLanguage, LANGUAGES, Language } from '../translations';
import { Globe, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LanguageSelectorProps {
  variant?: 'compact' | 'full' | 'dropdown';
  className?: string;
}

export default function LanguageSelector({ variant = 'dropdown', className = '' }: LanguageSelectorProps) {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const currentInfo = LANGUAGES[language];

  // Close dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (variant === 'full') {
    return (
      <div className={`flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 ${className}`}>
        {(Object.keys(LANGUAGES) as Language[]).map((langKey) => {
          const info = LANGUAGES[langKey];
          const isActive = language === langKey;
          return (
            <button
              key={langKey}
              onClick={() => setLanguage(langKey)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm border border-amber-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span className="text-sm">{info.flag}</span>
              <span>{info.nativeName}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl cursor-pointer transition-all active:scale-95 shadow-sm flex items-center gap-2 text-xs font-extrabold"
        title="تغيير اللغة / Change Language / เปลี่ยนภาษา"
      >
        <Globe className="w-4 h-4 text-amber-500 animate-pulse" />
        <span className="text-base">{currentInfo.flag}</span>
        <span className="hidden sm:inline">{currentInfo.nativeName}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 sm:right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-1.5 overflow-hidden"
          >
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/80 mb-1">
              اختر لغة الواجهة / Select Language
            </div>
            {(Object.keys(LANGUAGES) as Language[]).map((langKey) => {
              const info = LANGUAGES[langKey];
              const isActive = language === langKey;
              return (
                <button
                  key={langKey}
                  onClick={() => {
                    setLanguage(langKey);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer my-0.5 ${
                    isActive
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-extrabold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{info.flag}</span>
                    <div className="text-right">
                      <div className="text-xs font-extrabold">{info.nativeName}</div>
                      <div className="text-[9px] text-slate-400 font-normal">{info.name}</div>
                    </div>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-amber-500" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
