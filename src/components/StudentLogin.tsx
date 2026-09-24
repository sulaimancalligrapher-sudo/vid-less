import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, FileSpreadsheet, KeyRound, AlertCircle, Loader2, QrCode, Camera, X, CheckCircle2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { loginStudent, formatDriveImageUrl } from '../api';
import { useLanguage } from '../translations';
import { HeaderConfig } from '../types';

interface StudentLoginProps {
  headerConfig?: HeaderConfig | null;
  onLoginSuccess: (username: string, sheetNumber: string, sheetName: string) => void;
  onOpenSettings: () => void;
  isConfigured: boolean;
  isAdminUnlocked: boolean;
  onUnlockAdmin: () => void;
}

export default function StudentLogin({ 
  headerConfig,
  onLoginSuccess, 
  onOpenSettings, 
  isConfigured, 
  isAdminUnlocked, 
  onUnlockAdmin 
}: StudentLoginProps) {
  const { t } = useLanguage();
  const [username, setUsername] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlUser = params.get('username') || params.get('name') || params.get('user') || params.get('student') || params.get('student_name');
      if (urlUser) return urlUser.trim();
    }
    return localStorage.getItem('loggedInUsername') || '';
  });

  const [sheetNumber, setSheetNumber] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlSheet = params.get('sheet_number') || params.get('sheetNumber') || params.get('number') || params.get('sheet') || params.get('num') || params.get('id');
      if (urlSheet) return urlSheet.trim();
    }
    return localStorage.getItem('loggedInSheetNumber') || '';
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoAttempted, setAutoAttempted] = useState(false);

  // QR Code Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [qrSuccessMsg, setQrSuccessMsg] = useState<string | null>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);

  // Default fallback logo given by user
  const defaultDriveLogo = 'https://lh3.googleusercontent.com/d/15i8enIJFkPI0ZjBca0wfq4fHkFIwIY0y';
  const logoUrlToDisplay = formatDriveImageUrl(headerConfig?.loginLogoUrl) || formatDriveImageUrl(headerConfig?.logoUrl) || defaultDriveLogo;

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const stopScanner = async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
        html5QrcodeRef.current.clear();
      } catch (err) {
        console.warn("Scanner cleanup notice:", err);
      }
      html5QrcodeRef.current = null;
    }
    setIsScanning(false);
  };

  const parseQrData = (decodedText: string): { username?: string; sheetNumber?: string } | null => {
    if (!decodedText) return null;
    const text = decodedText.trim();

    // 1. JSON Format e.g. {"username": "سليمان", "sheetNumber": "1"}
    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('%7B') && text.endsWith('%7D'))) {
      try {
        const decodedStr = text.startsWith('%7B') ? decodeURIComponent(text) : text;
        const obj = JSON.parse(decodedStr);
        const user = obj.username || obj.name || obj.user || obj.student || obj.student_name || obj.u || '';
        const sheet = obj.sheet_number || obj.sheetNumber || obj.number || obj.sheet || obj.num || obj.id || obj.s || '';
        if (user || sheet) {
          return { username: String(user).trim(), sheetNumber: String(sheet).trim() };
        }
      } catch (e) {}
    }

    // 2. URL format e.g. https://...?username=سليمان&sheet_number=1
    if (text.includes('http://') || text.includes('https://') || text.includes('?')) {
      try {
        const urlStr = text.startsWith('http') ? text : `https://dummy.com/${text}`;
        const urlObj = new URL(urlStr);
        const params = urlObj.searchParams;
        const user = params.get('username') || params.get('name') || params.get('user') || params.get('student') || params.get('student_name');
        const sheet = params.get('sheet_number') || params.get('sheetNumber') || params.get('number') || params.get('sheet') || params.get('num') || params.get('id');
        if (user || sheet) {
          return { username: user ? user.trim() : undefined, sheetNumber: sheet ? sheet.trim() : undefined };
        }
      } catch (e) {}
    }

    // 3. Separator Formats: "اسم الطالب,1" or "اسم الطالب|1"
    const delimiters = [',', '|', ':', '\n', ';', '-'];
    for (const delim of delimiters) {
      if (text.includes(delim)) {
        const parts = text.split(delim).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          let user = parts[0];
          let sheet = parts[1];
          if (!isNaN(Number(parts[0])) && isNaN(Number(parts[1]))) {
            sheet = parts[0];
            user = parts[1];
          }
          return { username: user, sheetNumber: sheet };
        }
      }
    }

    // 4. Plain text fallback: treat as username
    return { username: text, sheetNumber: '' };
  };

  const handleScanSuccess = async (decodedText: string) => {
    const parsed = parseQrData(decodedText);
    await stopScanner();

    if (parsed && (parsed.username || parsed.sheetNumber)) {
      const newUsername = parsed.username || username;
      const newSheetNumber = parsed.sheetNumber || sheetNumber;

      if (parsed.username) setUsername(parsed.username);
      if (parsed.sheetNumber) setSheetNumber(parsed.sheetNumber);

      setQrSuccessMsg(`تم قراءة الكيوركود بنجاح: ${newUsername} ${newSheetNumber ? `(رقم الورقة: ${newSheetNumber})` : ''}`);
      setError(null);

      // Play success audio beep
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, audioCtx.currentTime);
          gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.18);
        }
      } catch (e) {}

      // Auto-trigger login if both username and sheet number are present
      if (newUsername && newSheetNumber) {
        setTimeout(() => {
          executeLogin(newUsername, newSheetNumber);
        }, 500);
      }
    } else {
      setError('رمز الكيو ار الذي تم مسحه لا يحتوي على بيانات طالب صالحة.');
    }
  };

  const startScanner = () => {
    setScannerError(null);
    setQrSuccessMsg(null);
    setError(null);
    setIsScanning(true);

    setTimeout(async () => {
      const qrElem = document.getElementById('qr-reader');
      if (!qrElem) return;

      try {
        const html5QrCode = new Html5Qrcode('qr-reader');
        html5QrcodeRef.current = html5QrCode;

        const config = { fps: 10, qrbox: { width: 220, height: 220 } };

        try {
          await html5QrCode.start(
            { facingMode: 'environment' },
            config,
            (decodedText) => handleScanSuccess(decodedText),
            () => {}
          );
        } catch (camErr) {
          await html5QrCode.start(
            { facingMode: 'user' },
            config,
            (decodedText) => handleScanSuccess(decodedText),
            () => {}
          );
        }
      } catch (err: any) {
        console.error('Camera QR start error:', err);
        setScannerError('تعذر فتح الكاميرا لمسح الكيو ار. يرجى السماح باستخدام الكاميرا في إعدادات المتصفح.');
      }
    }, 250);
  };

  const executeLogin = async (userVal: string, sheetVal: string) => {
    if (!isConfigured) {
      setError('يرجى تهيئة رابط اتصال قاعدة البيانات (Google Sheet) أولاً من الإعدادات ⚙️.');
      return;
    }

    if (!userVal.trim() || !sheetVal.trim()) {
      setError(t('login_error_missing'));
      return;
    }

    setLoading(true);
    setError(null);

    // Get Device ID
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('deviceId', deviceId);
    }

    // Attempt Geolocation
    let coords: { lat: number | null; lng: number | null } = { lat: null, lng: null };
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
      });
      coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
    } catch (err) {
      console.warn('Geolocation permission denied or timed out. Proceeding without coordinates.');
    }

    try {
      const result = await loginStudent(userVal.trim(), sheetVal.trim(), deviceId, coords);
      if (result && result.success) {
        // Save in localStorage
        localStorage.setItem('loggedInUsername', userVal.trim());
        localStorage.setItem('loggedInSheetNumber', sheetVal.trim());
        onLoginSuccess(userVal.trim(), sheetVal.trim(), result.sheetName);
      } else {
        setError(result?.message || 'اسم الطالب أو رقم الورقة غير صحيح، أو تم منع هذا المستخدم.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول. يرجى مراجعة إعدادات الرابط والاتصال بالإنترنت.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    executeLogin(username, sheetNumber);
  };

  // Auto-login if URL parameters exist
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlUser = params.get('username') || params.get('name') || params.get('user') || params.get('student') || params.get('student_name');
    const urlSheet = params.get('sheet_number') || params.get('sheetNumber') || params.get('number') || params.get('sheet') || params.get('num') || params.get('id');

    if (urlUser) setUsername(urlUser.trim());
    if (urlSheet) setSheetNumber(urlSheet.trim());

    if (urlUser && urlSheet && isConfigured && !autoAttempted) {
      setAutoAttempted(true);
      executeLogin(urlUser.trim(), urlSheet.trim());
    }
  }, [isConfigured, autoAttempted]);

  return (
    <div className="flex-grow flex items-center justify-center p-4">

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md bg-[#fefcf8] dark:bg-slate-900 border border-amber-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-md shadow-amber-100/30 dark:shadow-none relative overflow-hidden"
      >
        {/* Glow Effects */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Custom Logo & Title Header */}
        <div className="text-center mb-6 relative">
          {logoUrlToDisplay ? (
            <div className="mb-4 flex justify-center">
              <img
                src={logoUrlToDisplay}
                alt="شعار"
                referrerPolicy="no-referrer"
                className="max-h-24 max-w-[200px] object-contain rounded-2xl shadow-sm border border-amber-100/50 dark:border-slate-800 p-1.5 bg-white dark:bg-slate-950 transition-all hover:scale-105"
                onError={(e) => {
                  // Fallback to emoji if image fails to load
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <span className="text-5xl">🎓</span>
          )}
          <h1 className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2">{t('login_title')}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">{t('login_subtitle')}</p>
        </div>

        {/* QR Code Scan Quick Button */}
        <div className="mb-6">
          <button
            type="button"
            onClick={startScanner}
            disabled={loading || isScanning}
            className="w-full bg-indigo-50 dark:bg-slate-800/80 hover:bg-indigo-100/80 dark:hover:bg-slate-800 border border-indigo-200/80 dark:border-slate-700 text-indigo-700 dark:text-indigo-300 font-bold py-3 px-4 rounded-2xl transition-all flex items-center justify-center gap-2.5 text-xs cursor-pointer shadow-sm active:scale-98"
          >
            <QrCode className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
            <span>مسح كيو ار كود (QR Code) لاسم الطالب وركمه 📷</span>
          </button>
        </div>

        {/* QR Scanner Camera Modal Overlay */}
        <AnimatePresence>
          {isScanning && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full text-center text-slate-100 shadow-2xl relative overflow-hidden" dir="rtl">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <Camera className="w-5 h-5" />
                    <span>قارئ الكيو ار (QR Code)</span>
                  </div>
                  <button
                    onClick={stopScanner}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-slate-400 mb-3">
                  وجّه كاميرا الهاتف نحو رمز الـ QR الخاص بطاقتك أو رقمك
                </p>

                {/* QR Camera Reader Container */}
                <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-dashed border-amber-500/50 min-h-[250px] flex items-center justify-center">
                  <div id="qr-reader" className="w-full h-full" />
                </div>

                {scannerError && (
                  <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2 text-right">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{scannerError}</span>
                  </div>
                )}

                <button
                  onClick={stopScanner}
                  className="mt-4 w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs transition-all cursor-pointer"
                >
                  إلغاء مسح الكاميرا
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Warning if Sheet connection is not configured */}
        {!isConfigured && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-600 text-xs flex items-start gap-3 text-right"
            dir="rtl"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-bold">تنبيه للمعلم / مدير الموقع:</p>
              <p className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
                يرجى الضغط على زر <span className="font-bold text-amber-500">"إعدادات الاتصال بالشيت"</span> في الأعلى لتوصيل الصفحة بملف Google Sheet الخاص بك وتفعيل نظام الدخول واستدعاء الدروس بنجاح.
              </p>
            </div>
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5 text-right">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">{t('login_username_label')}</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('login_username_placeholder')}
                disabled={loading}
                className="w-full px-4 py-3.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-100 rounded-2xl placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all pr-12 text-sm disabled:opacity-50 font-medium"
              />
              <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">{t('login_sheet_label')}</label>
            <div className="relative">
              <input
                type="text"
                value={sheetNumber}
                onChange={(e) => setSheetNumber(e.target.value)}
                placeholder={t('login_sheet_placeholder')}
                disabled={loading}
                className="w-full px-4 py-3.5 bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-100 rounded-2xl placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all pr-12 text-sm disabled:opacity-50 font-medium"
              />
              <FileSpreadsheet className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
          </div>

          {/* Success QR Scanned Notice */}
          {qrSuccessMsg && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs flex items-center gap-2.5 font-bold"
            >
              <CheckCircle2 className="w-4.5 h-4.5 shrink-0 text-emerald-500" />
              <span>{qrSuccessMsg}</span>
            </motion.div>
          )}

          {/* Feedback message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs flex items-center gap-2.5"
            >
              <AlertCircle className="w-4.5 h-4.5 shrink-0 text-rose-500" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Login button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-900 font-extrabold py-4 rounded-2xl shadow-md shadow-amber-200/25 dark:shadow-none active:scale-98 transition-all flex items-center justify-center gap-2.5 text-sm cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t('login_loading')}</span>
              </>
            ) : (
              <>
                <KeyRound className="w-5 h-5" />
                <span>{t('login_btn')}</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}


