import React, { useState } from 'react';
import { useLanguage, TranslationItem, LANGUAGES } from '../translations';
import { Search, Save, RotateCcw, Globe, CheckCircle2, Filter, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TranslationEditorProps {
  onClose?: () => void;
}

export default function TranslationEditor({ onClose }: TranslationEditorProps) {
  const { translationList, saveAllTranslations, resetTranslationsToDefault, t } = useLanguage();

  const [items, setItems] = useState<TranslationItem[]>(() => JSON.parse(JSON.stringify(translationList)));
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [showResetToast, setShowResetToast] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const categories = [
    { id: 'all', label: 'جميع الأقسام' },
    { id: 'app', label: 'الترويسة والرئيسية (App Header)' },
    { id: 'login', label: 'تسجيل دخول الطالب (Login)' },
    { id: 'lessons', label: 'قائمة الدروس (Lesson List)' },
    { id: 'detail', label: 'صفحة الدرس والتسجيل (Lesson Detail)' },
    { id: 'admin', label: 'لوحة التحكم والإدارة (Admin Portal)' },
  ];

  const handleTextChange = (key: string, lang: 'ar' | 'th' | 'en', newText: string) => {
    setItems(prev =>
      prev.map(item => {
        if (item.key === key) {
          return { ...item, [lang]: newText };
        }
        return item;
      })
    );
  };

  const handleSave = () => {
    saveAllTranslations(items);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
  };

  const handleConfirmReset = () => {
    resetTranslationsToDefault();
    setItems(JSON.parse(JSON.stringify(translationList)));
    setIsResetConfirmOpen(false);
    setShowResetToast(true);
    setTimeout(() => setShowResetToast(false), 3000);
  };

  const filteredItems = items.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      !searchTerm ||
      item.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.ar.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.th.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.en.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-800 rounded-3xl p-4 md:p-6 shadow-xl text-right font-sans" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-amber-400 via-orange-400 to-amber-500 text-slate-950 rounded-2xl shadow-md shadow-amber-200/50">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>{t('translation_editor_title')}</span>
              <span className="text-[10px] px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full font-bold">
                3 لغات (AR / TH / EN)
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
              {t('translation_editor_desc')}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => setIsResetConfirmOpen(true)}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-600 dark:text-slate-300 hover:text-rose-600 border border-slate-200 dark:border-slate-700 font-bold rounded-2xl text-xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
          >
            <RotateCcw className="w-4 h-4 text-amber-500" />
            <span>{t('reset_translations_btn')}</span>
          </button>

          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black rounded-2xl text-xs transition-all cursor-pointer flex items-center gap-2 active:scale-95 shadow-md shadow-amber-200/50"
          >
            <Save className="w-4 h-4" />
            <span>{t('save_translations_btn')}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      <AnimatePresence>
        {showSavedToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span>{t('saved_success_toast')}</span>
          </motion.div>
        )}
        {showResetToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm"
          >
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span>{t('reset_success_toast')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter & Search Bar */}
      <div className="mt-5 flex flex-col sm:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-grow w-full">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={t('search_translation_placeholder')}
            className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder-slate-400"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
        </div>

        {/* Category Dropdown */}
        <div className="relative w-full sm:w-auto shrink-0">
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 cursor-pointer"
          >
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Translations Table List */}
      <div className="mt-5 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/30">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-right border-collapse">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 z-10 border-b border-slate-200 dark:border-slate-800 text-xs font-black text-slate-700 dark:text-slate-300 shadow-sm">
              <tr>
                <th className="px-4 py-3 min-w-[180px]">الوصف والرمز (Key)</th>
                <th className="px-4 py-3 min-w-[220px]">🇸🇦 العربية (Arabic)</th>
                <th className="px-4 py-3 min-w-[220px]">🇹🇭 ไทย (Thai)</th>
                <th className="px-4 py-3 min-w-[220px]">🇬🇧 English</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-xs font-bold">
                    لا توجد جمل تطابق البحث المحدد.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.key} className="hover:bg-amber-50/20 dark:hover:bg-slate-800/30 transition-colors">
                    {/* Key Info */}
                    <td className="px-4 py-3 text-xs align-top">
                      <div className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                        {item.description}
                      </div>
                      <code className="text-[10px] text-amber-600 dark:text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded">
                        {item.key}
                      </code>
                    </td>

                    {/* Arabic AR */}
                    <td className="px-3 py-2 align-top">
                      <textarea
                        rows={2}
                        value={item.ar}
                        onChange={e => handleTextChange(item.key, 'ar', e.target.value)}
                        dir="rtl"
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-amber-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all resize-y"
                      />
                    </td>

                    {/* Thai TH */}
                    <td className="px-3 py-2 align-top">
                      <textarea
                        rows={2}
                        value={item.th}
                        onChange={e => handleTextChange(item.key, 'th', e.target.value)}
                        dir="ltr"
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-amber-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all resize-y"
                      />
                    </td>

                    {/* English EN */}
                    <td className="px-3 py-2 align-top">
                      <textarea
                        rows={2}
                        value={item.en}
                        onChange={e => handleTextChange(item.key, 'en', e.target.value)}
                        dir="ltr"
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-amber-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all resize-y"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Save Row */}
      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
        <p className="text-[11px] text-slate-400 font-semibold">
          * يمكنك حفظ تعديلاتك لتطبيقها فوراً على جميع شاشات التطبيق لجميع الطلاب.
        </p>
        <button
          onClick={handleSave}
          className="px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black rounded-2xl text-xs transition-all cursor-pointer flex items-center gap-2 active:scale-95 shadow-md shadow-amber-200/50"
        >
          <Save className="w-4 h-4" />
          <span>حفظ كافة التغييرات 💾</span>
        </button>
      </div>

      {/* Confirmation Reset Modal */}
      <AnimatePresence>
        {isResetConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-right"
            >
              <div className="flex items-center gap-3 text-amber-500 mb-3">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                    تأكيد استعادة النصوص الافتراضية
                  </h3>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                    إعادة ضبط المصنع للترجمات
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed my-4">
                هل أنت متأكد من رغبتك في إلغاء كافة التعديلات واستعادة القاموس المدمج الأصلي باللغات الثلاث؟
              </p>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsResetConfirmOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleConfirmReset}
                  className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>نعم، استعد الافتراضي</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
