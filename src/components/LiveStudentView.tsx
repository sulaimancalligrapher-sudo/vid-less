import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, Sparkles, CheckCircle2, XCircle, Clock, Send, 
  User, Hash, LogOut, ArrowRight, Volume2, HelpCircle, 
  Award, ShieldAlert, Wifi, WifiOff, Loader2,
  KeyRound, ShieldCheck, Camera, QrCode, X, MessageSquare, Hand, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  LiveSessionState, LiveQuestionItem, evaluateLiveAnswer, LiveStudentMessage
} from '../types';
import { 
  getLiveSessionState, joinLiveSession, pingLiveSession, leaveLiveSession, submitLiveAnswer, 
  formatDriveImageUrl, subscribeToLiveSession, sendStudentMessage, replyToStudentMessage, deleteStudentMessage, clearAllStudentMessages, toggleShowChatInRoom
} from '../api';
import LiveChatModal from './LiveChatModal';
import { useLanguage } from '../translations';

interface LiveStudentViewProps {
  onBackToMain?: () => void;
}

const OPTION_COLORS = [
  'from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border-blue-400/30 text-white shadow-blue-500/20',
  'from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-emerald-400/30 text-white shadow-emerald-500/20',
  'from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 border-amber-400/30 text-white shadow-amber-500/20',
  'from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 border-purple-400/30 text-white shadow-purple-500/20',
  'from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 border-rose-400/30 text-white shadow-rose-500/20',
  'from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 border-cyan-400/30 text-white shadow-cyan-500/20',
];

const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

export default function LiveStudentView({ onBackToMain }: LiveStudentViewProps) {
  const { t } = useLanguage();

  // Student credentials - persisted across tabs and accidental closes
  const [username, setUsername] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('username') || p.get('name') || sessionStorage.getItem('liveStudentUsername') || localStorage.getItem('liveStudentUsername') || '';
    }
    return '';
  });

  const [sheetNumber, setSheetNumber] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('sheetNumber') || p.get('sheet') || p.get('id') || sessionStorage.getItem('liveStudentSheet') || localStorage.getItem('liveStudentSheet') || '';
    }
    return '';
  });

  const [isJoined, setIsJoined] = useState(false);
  const [sessionState, setSessionState] = useState<LiveSessionState | null>(null);
  const [connected, setConnected] = useState(false);
  const [studentPin, setStudentPin] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('pin') || sessionStorage.getItem('liveStudentPin') || localStorage.getItem('liveStudentPin') || '';
    }
    return '';
  });
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedAnswer, setSubmittedAnswer] = useState<string | null>(null);
  const [currentQuestionKey, setCurrentQuestionKey] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Auto-join only if valid credentials AND pin are present in URL
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const urlUser = p.get('username') || p.get('name');
    const urlPin = p.get('pin');
    const effectivePin = urlPin ? urlPin.trim() : studentPin.trim();
    if (urlUser && urlUser.trim() && effectivePin) {
      handleJoin(urlUser.trim(), sheetNumber.trim(), effectivePin);
    }
  }, []);

  // Firebase real-time subscription for live updates
  useEffect(() => {
    if (!isJoined || !isPinVerified) return;

    setConnected(true);
    const unsubscribe = subscribeToLiveSession(
      (state) => {
        setConnected(true);
        if (state.status === 'program_ended') {
          setIsJoined(false);
          setIsPinVerified(false);
          setSubmittedAnswer(null);
          setJoinError('تم إنهاء البرنامج والحصة التفاعلية بنجاح 🎓 شكراً لتفاعلكم!');
          sessionStorage.removeItem('liveStudentUsername');
          sessionStorage.removeItem('liveStudentSheet');
          sessionStorage.removeItem('liveStudentPin');
          localStorage.removeItem('liveStudentPin');
          return;
        }

        // Check if teacher regenerated or changed the PIN
        if (state.sessionPin && studentPin.trim() && state.sessionPin.trim() !== studentPin.trim()) {
          setIsJoined(false);
          setIsPinVerified(false);
          setJoinError('قام المعلم بتحديث رمز الحضور في الفصل. يرجى إدخال الرمز الجديد المعروض على الشاشة.');
          sessionStorage.removeItem('liveStudentPin');
          localStorage.removeItem('liveStudentPin');
          return;
        }

        // Check if student is still enrolled in connected students
        const currentCleanUser = username.trim().toLowerCase();
        const isStillEnrolled = (state.connectedStudents || []).some(
          s => String(s.username || '').trim().toLowerCase() === currentCleanUser && s.pinVerified
        );
        if (!isStillEnrolled && state.status !== 'idle' && state.isProgramActive) {
          setIsJoined(false);
          setIsPinVerified(false);
          setJoinError('يرجى إعادة تسجيل الدخول برمز الحضور الصحيح.');
          return;
        }

        setSessionState(state);
      },
      (err) => {
        console.warn('Live subscription error:', err);
        setConnected(false);
      }
    );

    // Ping session periodically to keep student active in teacher's list
    const pingTimer = setInterval(() => {
      pingLiveSession(username, sheetNumber);
    }, 10000);

    const handleBeforeUnload = () => {
      leaveLiveSession(username, sheetNumber);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribe();
      clearInterval(pingTimer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isJoined, isPinVerified, username, sheetNumber, studentPin]);

  // Handle active question change & timer
  useEffect(() => {
    if (!sessionState) return;

    const q = sessionState.currentQuestion;
    const qKey = q ? `${sessionState.currentQuestionIndex}_${q.question}` : null;

    if (qKey !== currentQuestionKey) {
      setCurrentQuestionKey(qKey);
      // New question arrived!
      setSelectedOption(null);
      setTextAnswer('');
      setSubmittedAnswer(null);

      // Check if student already submitted for this specific active question (restore state if page reloaded)
      const u = username.trim().toLowerCase();
      const s = sheetNumber.trim();
      const studentKey = s ? `${username.trim()}_${s}` : username.trim();

      const prevSub = 
        Object.values(sessionState.answersForCurrentQuestion || {}).find(
          sub => String(sub.username || '').trim().toLowerCase() === u
        ) ||
        sessionState.answersForCurrentQuestion?.[studentKey] ||
        sessionState.answersForCurrentQuestion?.[username.trim()];

      if (prevSub) {
        const prev = typeof prevSub === 'object' ? prevSub.answer : String(prevSub);
        setSubmittedAnswer(prev);
        setSelectedOption(prev);
        setTextAnswer(prev);
      }

      // Calculate time left
      if (sessionState.status === 'question_active' && sessionState.questionTriggeredAt) {
        const elapsed = Math.floor((Date.now() - sessionState.questionTriggeredAt) / 1000);
        const rem = Math.max(0, (sessionState.timeLimit || 30) - elapsed);
        setTimeLeft(rem);
      }
    }
  }, [sessionState, currentQuestionKey, username, sheetNumber]);

  // Local Countdown ticker
  useEffect(() => {
    if (sessionState?.status !== 'question_active') return;
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionState?.status, timeLeft]);

  // Camera QR Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scanSuccessMsg, setScanSuccessMsg] = useState<string | null>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);

  // Student Question & Reaction modal state
  const [showAskModal, setShowAskModal] = useState(false);
  const [studentQuestionInput, setStudentQuestionInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageSuccessBanner, setMessageSuccessBanner] = useState<string | null>(null);
  const [showChatHistoryModal, setShowChatHistoryModal] = useState(false);

  // Track previous message count for audio alert & new notification badge
  const prevMessagesCountRef = useRef<number>(0);
  const [hasUnreadReplies, setHasUnreadReplies] = useState(false);

  // Stop & cleanup QR scanner
  const stopScanner = async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
        html5QrcodeRef.current.clear();
      } catch (err) {
        console.warn('Scanner cleanup notice:', err);
      }
      html5QrcodeRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  // Smart parser for both Classroom QR (with PIN) and Student Identity Badges (Name & Sheet)
  const parseStudentQrData = (decodedText: string): { username?: string; sheetNumber?: string; pin?: string } | null => {
    if (!decodedText) return null;
    const text = decodedText.trim();
    const result: { username?: string; sheetNumber?: string; pin?: string } = {};

    // 1. JSON Format e.g. {"username": "سليمان", "sheetNumber": "12", "pin": "5821"}
    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('%7B') && text.endsWith('%7D'))) {
      try {
        const decodedStr = text.startsWith('%7B') ? decodeURIComponent(text) : text;
        const obj = JSON.parse(decodedStr);
        const user = obj.username || obj.name || obj.user || obj.student || obj.student_name || obj.u || '';
        const sheet = obj.sheet_number || obj.sheetNumber || obj.number || obj.sheet || obj.num || obj.id || obj.s || '';
        const p = obj.pin || obj.code || obj.pass || '';
        if (user) result.username = String(user).trim();
        if (sheet) result.sheetNumber = String(sheet).trim();
        if (p) result.pin = String(p).trim();
        if (result.username || result.sheetNumber || result.pin) return result;
      } catch (e) {}
    }

    // 2. URL Format e.g. https://.../?page=live-student&pin=5821&username=سليمان&sheetNumber=12
    if (text.includes('http://') || text.includes('https://') || text.includes('?')) {
      try {
        const urlStr = text.startsWith('http') ? text : `https://dummy.com/${text}`;
        const urlObj = new URL(urlStr);
        const p = urlObj.searchParams;
        const user = p.get('username') || p.get('name') || p.get('user') || p.get('student') || p.get('student_name');
        const sheet = p.get('sheet_number') || p.get('sheetNumber') || p.get('number') || p.get('sheet') || p.get('num') || p.get('id');
        const pinVal = p.get('pin') || p.get('code') || p.get('p');
        if (user) result.username = user.trim();
        if (sheet) result.sheetNumber = sheet.trim();
        if (pinVal) result.pin = pinVal.trim();
        if (result.username || result.sheetNumber || result.pin) return result;
      } catch (e) {}
    }

    // 3. Raw Numeric PIN (4 to 6 digits, e.g. "5821")
    if (/^\d{4,6}$/.test(text)) {
      return { pin: text };
    }

    // 4. Formatted labels e.g. "الاسم: سليمان | الرقم: 12"
    if (text.includes('الاسم') || text.includes('اسم') || text.includes('رقم') || text.includes('pin') || text.includes('رمز')) {
      const pinMatch = text.match(/(?:pin|رمز|كود)[:=\s]+(\d{4,6})/i);
      const nameMatch = text.match(/(?:الاسم|اسم|الطالب|المشترك)[:=\s]+([^\n,|;]+)/i);
      const sheetMatch = text.match(/(?:الرقم|رقم|شيت|الشيت)[:=\s]+([^\n,|;]+)/i);
      if (pinMatch) result.pin = pinMatch[1].trim();
      if (nameMatch) result.username = nameMatch[1].trim();
      if (sheetMatch) result.sheetNumber = sheetMatch[1].trim();
      if (result.username || result.sheetNumber || result.pin) return result;
    }

    // 5. Delimiters e.g. "سليمان, 12" or "سليمان - 12" or "12 - سليمان"
    const delimiters = [',', '|', ':', '\n', ';', '-'];
    for (const delim of delimiters) {
      if (text.includes(delim)) {
        const parts = text.split(delim).map(s => s.trim()).filter(Boolean);
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

    // 6. Plain text fallback: assume username
    return { username: text };
  };

  const handleScanSuccess = async (decodedText: string) => {
    const parsed = parseStudentQrData(decodedText);
    await stopScanner();

    if (!parsed || (!parsed.username && !parsed.sheetNumber && !parsed.pin)) {
      setScannerError('رمز QR لا يحتوي على بيانات طالب أو رمز حضور صالح.');
      return;
    }

    let updatedUser = username;
    let updatedSheet = sheetNumber;
    let updatedPin = studentPin;

    const msgs: string[] = [];

    if (parsed.username) {
      updatedUser = parsed.username;
      setUsername(parsed.username);
      msgs.push(`الاسم: ${parsed.username}`);
    }
    if (parsed.sheetNumber) {
      updatedSheet = parsed.sheetNumber;
      setSheetNumber(parsed.sheetNumber);
      msgs.push(`رقم المشترك: ${parsed.sheetNumber}`);
    }
    if (parsed.pin) {
      updatedPin = parsed.pin;
      setStudentPin(parsed.pin);
      msgs.push(`رمز الحضور (PIN): ${parsed.pin}`);
    }

    setScanSuccessMsg(`✅ تم مسح الكود بنجاح: ${msgs.join(' • ')}`);
    setJoinError(null);

    // Audio beep confirmation
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      }
    } catch {}

    // Auto-join if both username and pin are now filled
    if (updatedUser.trim() && updatedPin.trim()) {
      setTimeout(() => {
        handleJoin(updatedUser.trim(), updatedSheet.trim(), updatedPin.trim());
      }, 700);
    }
  };

  const startScanner = () => {
    setScannerError(null);
    setScanSuccessMsg(null);
    setJoinError(null);
    setIsScanning(true);

    setTimeout(async () => {
      const elem = document.getElementById('live-student-qr-reader');
      if (!elem) return;

      try {
        const html5QrCode = new Html5Qrcode('live-student-qr-reader');
        html5QrcodeRef.current = html5QrCode;
        const config = { fps: 10, qrbox: { width: 220, height: 220 } };

        try {
          await html5QrCode.start(
            { facingMode: 'environment' },
            config,
            (decodedText) => handleScanSuccess(decodedText),
            () => {}
          );
        } catch (e) {
          await html5QrCode.start(
            { facingMode: 'user' },
            config,
            (decodedText) => handleScanSuccess(decodedText),
            () => {}
          );
        }
      } catch (err: any) {
        console.error('Camera QR start error:', err);
        setScannerError('تعذر فتح الكاميرا. يرجى التأكد من السماح بالوصول للكاميرا.');
      }
    }, 250);
  };

  // Join Classroom
  const handleJoin = async (nameToJoin: string, sheetToJoin: string, pinToJoin?: string) => {
    if (!nameToJoin.trim()) {
      setJoinError('يرجى إدخال اسم الطالب');
      return;
    }
    const cleanUser = nameToJoin.trim();
    const cleanSheet = sheetToJoin.trim();
    const cleanPin = (pinToJoin || '').trim();

    setJoinError(null);
    try {
      setUsername(cleanUser);
      setSheetNumber(cleanSheet);
      setStudentPin(cleanPin);

      const res = await joinLiveSession(cleanUser, cleanSheet, cleanPin || undefined);
      if (res.success && res.state && res.pinVerified) {
        setSessionState(res.state);
        setIsJoined(true);
        setIsPinVerified(true);
        setConnected(true);
        setJoinError(null);

        // Store credentials only upon successful verified join!
        sessionStorage.setItem('liveStudentUsername', cleanUser);
        sessionStorage.setItem('liveStudentSheet', cleanSheet);
        if (cleanPin) {
          sessionStorage.setItem('liveStudentPin', cleanPin);
          localStorage.setItem('liveStudentPin', cleanPin);
        }
        localStorage.setItem('liveStudentUsername', cleanUser);
        localStorage.setItem('liveStudentSheet', cleanSheet);
        localStorage.setItem('loggedInUsername', cleanUser);
        localStorage.setItem('loggedInSheetNumber', cleanSheet);
      } else {
        // REJECT AND DO NOT ENTER!
        setIsJoined(false);
        setIsPinVerified(false);
        setConnected(false);
        setJoinError(res?.error || 'رمز الدخول غير صحيح! يرجى إدخال الرمز المعروض على شاشة الفصل.');
        sessionStorage.removeItem('liveStudentPin');
        localStorage.removeItem('liveStudentPin');
      }
    } catch (err: any) {
      setIsJoined(false);
      setIsPinVerified(false);
      setConnected(false);
      setJoinError(err?.message || 'تعذر الاتصال بالجلسة');
      sessionStorage.removeItem('liveStudentPin');
      localStorage.removeItem('liveStudentPin');
    }
  };

  // Submit Student Answer (Multiple Choice or Text Input)
  const handleSendAnswer = async (answerVal: string) => {
    if (submittedAnswer || isSubmitting || sessionState?.status !== 'question_active' || !answerVal.trim()) return;

    setSelectedOption(answerVal.trim());
    setIsSubmitting(true);

    try {
      const currentQ = sessionState.currentQuestion;
      const qIndex = sessionState.currentQuestionIndex ?? 0;
      const evalResult = currentQ ? evaluateLiveAnswer(currentQ, answerVal.trim()) : { isCorrect: null };

      // Submit answer directly to live hub
      await submitLiveAnswer({
        username: username.trim(),
        sheetNumber: sheetNumber.trim(),
        answer: answerVal.trim(),
        questionIndex: qIndex,
        isCorrect: evalResult.isCorrect
      });

      setSubmittedAnswer(answerVal.trim());
    } catch (err) {
      console.error('Error submitting answer:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Play subtle notification tone for replies
  const playReplySound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {}
  };

  // Check for new teacher replies targeted at this student
  useEffect(() => {
    if (!sessionState?.messages || !isJoined) return;
    const myCleanName = username.trim().toLowerCase();
    const myMessages = sessionState.messages.filter(
      (m) => m.senderName.trim().toLowerCase() === myCleanName
    );
    const hasAnyReply = myMessages.some((m) => m.reply?.text);
    if (hasAnyReply && prevMessagesCountRef.current < sessionState.messages.length) {
      // New reply or message received
      playReplySound();
      setHasUnreadReplies(true);
    }
    prevMessagesCountRef.current = sessionState.messages.length;
  }, [sessionState?.messages, isJoined, username]);

  // Send Student Message or Reaction
  const handleSendStudentReaction = async (
    type: 'question' | 'hand' | 'agree' | 'disagree' | 'clap',
    text?: string
  ) => {
    if (!username.trim()) return;
    try {
      setIsSendingMessage(true);
      await sendStudentMessage({
        senderName: username.trim(),
        sheetNumber: sheetNumber.trim(),
        type,
        text: text?.trim() || undefined,
      });

      let label = 'تم إرسال رسالتك للأستاذ بنجاح! 📨';
      if (type === 'hand') label = 'تم رفع يدك للأستاذ بنجاح ✋';
      if (type === 'agree') label = 'تم تسجيل موافقتك بنجاح 👍';
      if (type === 'disagree') label = 'تم تسجيل عدم موافقتك بنجاح 👎';
      if (type === 'clap') label = 'تم إرسال تشجيع وتصفيق للأستاذ 👏';

      setMessageSuccessBanner(label);
      setTimeout(() => setMessageSuccessBanner(null), 4000);
      setStudentQuestionInput('');
      setShowAskModal(false);
    } catch (err: any) {
      console.error('Error sending student message:', err);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // 1. Join Screen (if not logged in or PIN not verified)
  if (!isJoined || !isPinVerified) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
        >
          {/* Header Glow */}
          <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-500" />

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-3xl mx-auto flex items-center justify-center mb-3 shadow-inner">
              <Tv className="w-8 h-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-100">
              بوابة الطالب للحصة التفاعلية 📱
            </h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed font-semibold">
              سجل اسمك ورمز الحضور المعروض على الشاشة للإجابة على الأسئلة من جهازك مباشرة!
            </p>
          </div>

          {/* Accidental Exit Recovery Banner */}
          {username.trim().length > 0 && studentPin.trim().length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-indigo-950/60 border border-indigo-500/30 rounded-2xl p-4 mb-5 text-right relative overflow-hidden"
            >
              <div className="flex items-center gap-2 mb-1.5 text-amber-400 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>مرحباً بك مجدداً يا {username}! 👋</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed mb-3 font-medium">
                إذا أغلقت الصفحة بالخطأ، يمكنك النقر على الزر أدناه للعودة واستئناف الحصة فوراً بدون فقدان إجاباتك السابقة.
              </p>
              <button
                type="button"
                onClick={() => handleJoin(username, sheetNumber, studentPin)}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-900/30 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة للحصة المباشرة فوراً 🚀</span>
              </button>
            </motion.div>
          )}

          {/* زر مسح رمز QR بالكاميرا */}
          <button
            type="button"
            onClick={startScanner}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-900/60 via-purple-900/50 to-indigo-900/60 hover:from-indigo-850 hover:to-purple-850 border border-indigo-500/40 hover:border-indigo-400 text-indigo-200 font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-950/40 mb-4 active:scale-98"
          >
            <Camera className="w-4 h-4 text-indigo-400" />
            <span>مسح رمز QR بالكاميرا (بيانات الطالب أو رمز الحضور) 📷</span>
          </button>

          {/* رسالة نجاح مسح الكود */}
          {scanSuccessMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2 mb-4 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="leading-relaxed">{scanSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleJoin(username, sheetNumber, studentPin); }} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                اسم الطالب:
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسمك الكريم..."
                  className="w-full px-4 py-3.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 rounded-2xl outline-none text-sm font-bold pr-11"
                />
                <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                رقم الطالب / الشيت (اختياري):
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={sheetNumber}
                  onChange={(e) => setSheetNumber(e.target.value)}
                  placeholder="مثال: 12 أو A1..."
                  className="w-full px-4 py-3.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 rounded-2xl outline-none text-sm font-mono pr-11"
                />
                <Hash className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-amber-300">
                  رمز تسجيل حصة الحضور (PIN):
                </label>
                <span className="text-[10px] text-amber-400/80 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  معروض على شاشة الفيديو
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  value={studentPin}
                  onChange={(e) => setStudentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="أدخل الرمز المكوّن من 4 أرقام (مثال: 5824)..."
                  className="w-full px-4 py-3.5 bg-slate-950 border-2 border-amber-500/40 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-amber-300 placeholder:text-slate-600 rounded-2xl outline-none text-base font-black font-mono tracking-widest text-center pr-11"
                />
                <KeyRound className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400" />
              </div>
            </div>

            {joinError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{joinError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-600/20 active:scale-98 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <Sparkles className="w-5 h-5" />
              <span>دخول الحصة المباشرة 🚀</span>
            </button>
          </form>

          {onBackToMain && (
            <button
              type="button"
              onClick={onBackToMain}
              className="w-full mt-4 text-xs text-slate-400 hover:text-slate-200 font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة للصفحة الرئيسية</span>
            </button>
          )}
        </motion.div>

        {/* QR Scanner Camera Modal */}
        <AnimatePresence>
          {isScanning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
            >
              <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl relative space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                    <Camera className="w-4 h-4" />
                    <span>مسح رمز QR بالكاميرا</span>
                  </div>
                  <button
                    type="button"
                    onClick={stopScanner}
                    className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="relative rounded-2xl overflow-hidden bg-black aspect-square flex items-center justify-center border border-slate-800">
                  <div id="live-student-qr-reader" className="w-full h-full" />
                </div>

                <p className="text-center text-xs text-slate-400 font-semibold leading-relaxed">
                  وجه الكاميرا نحو <b>رمز QR المعروض على الشاشة</b> لقراءة رمز الدخول (PIN)، أو نحو <b>بطاقة المشترك</b> لقراءة الاسم ورقم المشترك.
                </p>

                {scannerError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold text-center">
                    {scannerError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={stopScanner}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  إلغاء وإدخال يدوي
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 2. Active Classroom Remote Screen (Zero Video Overhead)
  const currentQ = sessionState?.currentQuestion;
  const isQuestionActive = sessionState?.status === 'question_active' && currentQ;
  const isRevealed = sessionState?.status === 'revealed' && currentQ;
  const validOptions = (currentQ?.options || []).map(o => String(o || '').trim()).filter(Boolean);
  const isMultipleChoice = Boolean(currentQ && validOptions.length > 0 && !currentQ.isTextAnswer);
  
  const evalResult = (isRevealed && submittedAnswer && currentQ)
    ? evaluateLiveAnswer(currentQ, submittedAnswer)
    : null;
  const isCorrectAnswer = evalResult?.isCorrect ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500/30">
      {/* Top Header Bar */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 sticky top-0 z-20">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">
              <Tv className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                <span>{sessionState?.lessonTitle || 'الحصة التفاعلية المباشرة'}</span>
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              </div>
              <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5">
                <span>الطالب:</span>
                <span className="text-indigo-400 font-bold">{username}</span>
                {sheetNumber && <span className="text-slate-500 font-mono">({sheetNumber})</span>}
                {isPinVerified && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold flex items-center gap-0.5">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    <span>حضور مؤكد</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await leaveLiveSession(username, sheetNumber);
                sessionStorage.removeItem('liveStudentUsername');
                sessionStorage.removeItem('liveStudentSheet');
                setIsJoined(false);
                setIsPinVerified(false);
                setSubmittedAnswer(null);
              }}
              title="تسجيل خروج أو تغيير اسم الطالب"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline">تبديل الطالب</span>
            </button>
            {onBackToMain && (
              <button
                onClick={async () => {
                  await leaveLiveSession(username, sheetNumber);
                  onBackToMain();
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                الرئيسية
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Dynamic Interactive Body */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 flex flex-col justify-center relative">
        {/* Success toast after sending question or reaction */}
        <AnimatePresence>
          {messageSuccessBanner && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-2 left-4 right-4 z-30 p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xl backdrop-blur-md"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{messageSuccessBanner}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* CASE A: Active Question Mode */}
          {isQuestionActive ? (
            <motion.div
              key={`q-${sessionState.currentQuestionIndex}`}
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.98 }}
              className="w-full space-y-4"
            >
              {/* Question Header & Timer */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                    السؤال {(sessionState.currentQuestionIndex ?? 0) + 1}
                  </span>
                  
                  {/* Timer Badge */}
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black font-mono border ${
                    timeLeft <= 5 
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 animate-bounce' 
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}>
                    <Clock className="w-3.5 h-3.5" />
                    <span>{timeLeft} ثانية</span>
                  </div>
                </div>

                {/* Optional Question Image */}
                {currentQ.image && (
                  <div className="aspect-video max-h-48 w-full rounded-2xl overflow-hidden border border-slate-800 mb-3 bg-slate-950">
                    <img 
                      src={formatDriveImageUrl(currentQ.image)} 
                      alt="Question Visual" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                <h3 className="text-base sm:text-lg font-black text-slate-100 leading-relaxed text-right">
                  {currentQ.question}
                </h3>
              </div>

              {/* Sub-case 1: Multiple Choice Options */}
              {isMultipleChoice ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentQ.options.map((opt, idx) => {
                    const isSelected = selectedOption === opt;
                    const letter = OPTION_LETTERS[idx] || `${idx + 1}`;
                    const colorGradient = OPTION_COLORS[idx % OPTION_COLORS.length];

                    return (
                      <motion.button
                        key={idx}
                        whileTap={{ scale: 0.97 }}
                        disabled={Boolean(submittedAnswer) || isSubmitting}
                        onClick={() => handleSendAnswer(opt)}
                        className={`relative p-4 rounded-2xl border text-right font-bold transition-all flex items-center justify-between cursor-pointer shadow-md ${
                          isSelected 
                            ? 'ring-4 ring-amber-400 bg-indigo-600 text-white border-white scale-[1.02]' 
                            : submittedAnswer 
                              ? 'opacity-50 bg-slate-900 border-slate-800 text-slate-400 cursor-not-allowed'
                              : `bg-gradient-to-r ${colorGradient}`
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="w-8 h-8 rounded-xl bg-black/20 border border-white/20 flex items-center justify-center font-black text-sm shrink-0">
                            {letter}
                          </span>
                          <span className="text-sm sm:text-base leading-snug break-words">
                            {opt}
                          </span>
                        </div>

                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-white text-indigo-700 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-5 h-5 fill-white text-indigo-600" />
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                /* Sub-case 2: Written Text Question (Column F is 'نص' or no options) */
                <div className="space-y-3 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
                  <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold mb-1">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span>أجب كتابياً على السؤال:</span>
                  </div>
                  <textarea
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    disabled={Boolean(submittedAnswer) || isSubmitting}
                    placeholder="اكتب إجابتك هنا بدقة..."
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-2xl text-slate-100 text-sm font-bold outline-none resize-none transition-all placeholder:text-slate-600"
                  />
                  {!submittedAnswer && (
                    <button
                      onClick={() => handleSendAnswer(textAnswer.trim())}
                      disabled={!textAnswer.trim() || isSubmitting}
                      className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all disabled:opacity-40 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>إرسال الإجابة 🚀</span>
                    </button>
                  )}
                </div>
              )}

              {/* Submission State Banner */}
              {submittedAnswer && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-1"
                >
                  <div className="flex items-center justify-center gap-2 text-emerald-400 font-black text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>تم استلام إجابتك بنجاح!</span>
                  </div>
                  <p className="text-xs text-amber-300 font-bold max-w-sm mx-auto truncate" dir="auto">
                    «{submittedAnswer}»
                  </p>
                  <p className="text-xs text-slate-400 font-semibold pt-1">
                    انتظر حتى يكشف الأستاذ الإجابة على شاشة العرض 🌟
                  </p>
                </motion.div>
              )}
            </motion.div>
          ) : isRevealed ? (
            /* CASE B: Question Answer Revealed Mode */
            <motion.div
              key="revealed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl"
            >
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mx-auto shadow-inner">
                {isCorrectAnswer === true ? (
                  <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center animate-bounce">
                    <Award className="w-10 h-10" />
                  </div>
                ) : isCorrectAnswer === false ? (
                  <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                    <XCircle className="w-10 h-10" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-3xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-100">
                  {isCorrectAnswer === true 
                    ? '🎉 إجابة صحيحة وممتازة يا بطل!' 
                    : isCorrectAnswer === false 
                      ? 'حظاً أوفر في السؤال القادم!' 
                      : 'تم تسجيل إجابتك بنجاح! 📝'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-semibold">
                  السؤال: {currentQ.question}
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-right space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>الإجابة النموذجية:</span>
                  <span className="text-emerald-400 font-extrabold text-sm bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20 font-mono">
                    {evalResult?.correctLabel || currentQ.correctAnswer || 'إجابة حرة (بدون تقييم صح/خطأ)'}
                  </span>
                </div>
                {submittedAnswer && (
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>إجابتك أنت:</span>
                    <span className={`font-extrabold text-sm px-3 py-1 rounded-xl border ${
                      isCorrectAnswer === true
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                        : isCorrectAnswer === false
                        ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                        : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
                    }`}>
                      {submittedAnswer}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-indigo-400 font-bold animate-pulse">
                شاهد الشاشة الكبيرة لمتابعة شرح الأستاذ ومواصلة الدرس 👨‍🏫
              </p>
            </motion.div>
          ) : (
            /* CASE C: Watching / Listening State (Video Playing on Projector) */
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl relative overflow-hidden"
            >
              {/* Glowing decorative orb */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-600/30 to-amber-500/30 border border-indigo-500/30 mx-auto flex items-center justify-center shadow-lg relative">
                  <div className="absolute inset-0 rounded-full border border-indigo-400/40 animate-ping opacity-30" />
                  <Volume2 className="w-10 h-10 text-amber-400 animate-pulse" />
                </div>
              </div>

              <div className="space-y-2 relative">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                  {sessionState?.status === 'playing' ? '🔴 الفيديو يعمل على الشاشة الآن' : 'في انتظار بدء العرض'}
                </span>
                <h3 className="text-lg sm:text-xl font-black text-slate-100">
                  استمع وركز مع الأستاذ 👨‍🏫
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed font-semibold">
                  الفيديو يُعرض أمامكم على الشاشة الكبيرة. عندما يصل الفيديو إلى سؤال تفاعلي، ستظهر الخيارات هنا على جوالك تلقائياً لتجيب عنها فوراً!
                </p>
              </div>

              {/* Status footer pill */}
              <div className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 bg-slate-950 border border-slate-800/80 rounded-2xl text-[11px] text-slate-400 font-mono font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>أنت متصل بالقاعة وجاهز للإجابة 👍</span>
                {isPinVerified && (
                  <span className="text-emerald-400 font-bold flex items-center gap-1 border-r border-slate-800 pr-2 mr-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>تم تأكيد الحضور</span>
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Student Floating Interactive Action Bar (اسأل المعلم + رفع اليد + موافق/غير موافق) */}
      <div className="sticky bottom-0 z-30 p-3 bg-slate-900/95 backdrop-blur-md border-t border-slate-800">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-2">
          {/* Quick Reaction Icons: Hand, Agree, Disagree */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSendStudentReaction('hand')}
              disabled={isSendingMessage}
              title="رفع اليد لطلب الكلمة أو الاستفسار ✋"
              className="p-2.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 text-xs font-bold shadow-sm"
            >
              <Hand className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">رفع اليد</span>
            </button>

            <button
              type="button"
              onClick={() => handleSendStudentReaction('agree')}
              disabled={isSendingMessage}
              title="أوافق الأستاذ على النقطة المطروحة 👍"
              className="p-2.5 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 text-xs font-bold shadow-sm"
            >
              <ThumbsUp className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">موافق</span>
            </button>

            <button
              type="button"
              onClick={() => handleSendStudentReaction('disagree')}
              disabled={isSendingMessage}
              title="غير موافق أو غير واضح 👎"
              className="p-2.5 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 text-xs font-bold shadow-sm"
            >
              <ThumbsDown className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline">غير موافق</span>
            </button>

            <button
              type="button"
              onClick={() => handleSendStudentReaction('clap')}
              disabled={isSendingMessage}
              title="تصفيق وتشجيع 👏"
              className="p-2.5 rounded-2xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 transition-all cursor-pointer active:scale-95 flex items-center text-xs font-bold shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </button>
          </div>

          {/* Main Action: Ask Teacher Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowChatHistoryModal(true);
                setHasUnreadReplies(false);
              }}
              title="عرض سجل المحادثة وردود الأستاذ"
              className={`p-2.5 rounded-2xl border transition-all cursor-pointer relative ${
                hasUnreadReplies
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              {hasUnreadReplies && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-ping" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowAskModal(true)}
              className="py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
              <span>اسأل المعلم 💬</span>
            </button>
          </div>
        </div>
      </div>

      {/* Ask Teacher Small Dialog Window (نافذة صغيرة لكتابة سؤاله أو استفساره) */}
      <AnimatePresence>
        {showAskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-md bg-slate-900 border border-indigo-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-right"
              dir="rtl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5 text-indigo-400 font-black text-sm">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <span>اسأل المعلم أثناء الحصة 💬</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAskModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Reaction Icons Inside Modal */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">
                  أو اختر تفاعلاً سريعاً بنقرة واحدة:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSendStudentReaction('hand')}
                    className="p-2.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer"
                  >
                    <Hand className="w-5 h-5 text-amber-400" />
                    <span>رفع اليد ✋</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendStudentReaction('agree')}
                    className="p-2.5 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer"
                  >
                    <ThumbsUp className="w-5 h-5 text-emerald-400" />
                    <span>موافق 👍</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendStudentReaction('disagree')}
                    className="p-2.5 rounded-2xl bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer"
                  >
                    <ThumbsDown className="w-5 h-5 text-rose-400" />
                    <span>معارض 👎</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendStudentReaction('clap')}
                    className="p-2.5 rounded-2xl bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    <span>تشجيع 👏</span>
                  </button>
                </div>
              </div>

              {/* Text Input for question */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  اكتب سؤالك أو استفسارك للأستاذ:
                </label>
                <textarea
                  value={studentQuestionInput}
                  onChange={(e) => setStudentQuestionInput(e.target.value)}
                  placeholder="مثال: يا أستاذ هل يمكن إعادة توضيح النقطة السابقة؟"
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-750 focus:border-indigo-400 rounded-2xl text-slate-100 text-xs font-bold outline-none resize-none transition-all placeholder:text-slate-600"
                  autoFocus
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAskModal(false)}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-slate-400 rounded-2xl text-xs font-bold cursor-pointer transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => handleSendStudentReaction('question', studentQuestionInput)}
                  disabled={!studentQuestionInput.trim() || isSendingMessage}
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSendingMessage ? 'جارٍ الإرسال...' : 'إرسال السؤال للأستاذ 🚀'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student Chat History and Teacher Replies Modal */}
      <LiveChatModal
        isOpen={showChatHistoryModal}
        onClose={() => setShowChatHistoryModal(false)}
        messages={sessionState?.messages || []}
        onReply={async () => {}}
        onDeleteMessage={async () => {}}
        onClearAll={async () => {}}
        showChatInRoom={Boolean(sessionState?.showChatInRoom)}
        onToggleShowInRoom={async () => {}}
        currentUserName={username}
        isTeacher={false}
      />

      {/* Footer Info */}
      <footer className="p-2.5 text-center text-[10px] text-slate-600 font-mono border-t border-slate-900">
        نظام الحصص التفاعلية الحية • متزامن لحظياً عبر السحابة
      </footer>
    </div>
  );
}
