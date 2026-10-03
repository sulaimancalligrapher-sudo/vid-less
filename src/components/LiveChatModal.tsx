import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Send, Hand, ThumbsUp, ThumbsDown, 
  Sparkles, CheckCircle2, Clock, Trash2, Reply, Eye, 
  EyeOff, User, X, Lock, Globe, AlertCircle, Smile, 
  Users, Megaphone
} from 'lucide-react';
import { LiveStudentMessage, LiveConnectedStudent } from '../types';

interface LiveChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: LiveStudentMessage[];
  onReply: (messageId: string, replyText: string, replyType: 'private' | 'public') => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onClearAll: () => Promise<void>;
  showChatInRoom: boolean;
  onToggleShowInRoom: (show: boolean) => Promise<void>;
  currentUserName?: string; // If student is viewing, their name
  currentUserSheet?: string; // If student is viewing, their sheet #
  isTeacher?: boolean; // True for Admin / Teacher Room
  connectedStudents?: LiveConnectedStudent[]; // Connected students list for teacher to message individually
  onSendStudentMessage?: (type: 'question' | 'hand' | 'agree' | 'disagree' | 'clap', text?: string) => Promise<void>;
  onSendTeacherBroadcast?: (text: string, recipientStudent?: string, recipientSheet?: string) => Promise<void>;
}

const COMMON_EMOJIS = ['😊', '👏', '👍', '🌟', '🎯', '💯', '✨', ' ممتاز!', 'بارك الله فيك', 'أحسنت', 'أعد التفكير', 'سؤال رائع 💡'];

export default function LiveChatModal({
  isOpen,
  onClose,
  messages,
  onReply,
  onDeleteMessage,
  onClearAll,
  showChatInRoom,
  onToggleShowInRoom,
  currentUserName,
  currentUserSheet,
  isTeacher = false,
  connectedStudents = [],
  onSendStudentMessage,
  onSendTeacherBroadcast,
}: LiveChatModalProps) {
  const [selectedMessage, setSelectedMessage] = useState<LiveStudentMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyType, setReplyType] = useState<'private' | 'public'>('private');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'questions' | 'reactions'>('all');
  
  // Student Composer State (Embedded inside the chat modal)
  const [studentInputText, setStudentInputText] = useState('');
  const [isSendingStudentMsg, setIsSendingStudentMsg] = useState(false);
  const [studentSuccessNotice, setStudentSuccessNotice] = useState<string | null>(null);

  // 1. Teacher Public Broadcast State (رسالة عامة للجميع منفصلة)
  const [teacherPublicText, setTeacherPublicText] = useState('');
  const [showPublicEmojiPicker, setShowPublicEmojiPicker] = useState(false);
  const [isSendingPublic, setIsSendingPublic] = useState(false);

  // 2. Teacher Direct Student Private Message State (رسالة خاصة لطالب منفصلة)
  const [teacherPrivateText, setTeacherPrivateText] = useState('');
  const [selectedStudentTarget, setSelectedStudentTarget] = useState<string>(''); // username
  const [showPrivateEmojiPicker, setShowPrivateEmojiPicker] = useState(false);
  const [isSendingPrivate, setIsSendingPrivate] = useState(false);

  // Common notification banner
  const [teacherNotice, setTeacherNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isOpen]);

  // Build combined list of students from connectedStudents + any past messages
  const availableStudents = useMemo(() => {
    const map = new Map<string, { username: string; sheetNumber?: string }>();
    (connectedStudents || []).forEach(s => {
      const u = String(s.username || '').trim();
      if (u) map.set(u.toLowerCase(), { username: u, sheetNumber: s.sheetNumber });
    });
    (messages || []).forEach(m => {
      const u = String(m.senderName || '').trim();
      if (u && !map.has(u.toLowerCase())) {
        map.set(u.toLowerCase(), { username: u, sheetNumber: m.sheetNumber });
      }
    });
    return Array.from(map.values());
  }, [connectedStudents, messages]);

  if (!isOpen) return null;

  // Filter messages
  const filteredMessages = messages.filter((m) => {
    if (!isTeacher && currentUserName) {
      // For student: can see their own messages, OR public replies/questions
      const isMine = m.senderName.trim().toLowerCase() === currentUserName.trim().toLowerCase();
      const isPublic = m.reply?.type === 'public';
      if (!isMine && !isPublic) return false;
    }
    if (filterType === 'questions') return m.type === 'question';
    if (filterType === 'reactions') return m.type !== 'question';
    return true;
  });

  const handleSendReply = async () => {
    if (!selectedMessage || !replyText.trim() || isSubmittingReply) return;
    try {
      setIsSubmittingReply(true);
      await onReply(selectedMessage.id, replyText.trim(), replyType);
      setReplyText('');
      setSelectedMessage(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleStudentSubmit = async (
    type: 'question' | 'hand' | 'agree' | 'disagree' | 'clap',
    text?: string
  ) => {
    if (!onSendStudentMessage || isSendingStudentMsg) return;
    try {
      setIsSendingStudentMsg(true);
      await onSendStudentMessage(type, text);
      setStudentInputText('');
      let banner = 'تم إرسال سؤالك للأستاذ بنجاح 📨';
      if (type === 'hand') banner = 'تم رفع يدك للأستاذ ✋';
      if (type === 'agree') banner = 'تم تسجيل موافقتك 👍';
      if (type === 'disagree') banner = 'تم تسجيل عدم موافقتك 👎';
      if (type === 'clap') banner = 'تم إرسال تشجيع وتصفيق 👏';
      setStudentSuccessNotice(banner);
      setTimeout(() => setStudentSuccessNotice(null), 3500);
    } catch (err) {
      console.error('Failed to send student message:', err);
    } finally {
      setIsSendingStudentMsg(false);
    }
  };

  const handleSendPublicBroadcast = async () => {
    if (!onSendTeacherBroadcast || !teacherPublicText.trim() || isSendingPublic) return;
    try {
      setIsSendingPublic(true);
      await onSendTeacherBroadcast(teacherPublicText.trim(), undefined, undefined);
      setTeacherPublicText('');
      setShowPublicEmojiPicker(false);
      setTeacherNotice('تم نشر الرسالة العامة لجميع الطلاب وعلى الشاشة بنجاح 🌐');
      setTimeout(() => setTeacherNotice(null), 3500);
    } catch (err) {
      console.error('Failed to send public broadcast:', err);
    } finally {
      setIsSendingPublic(false);
    }
  };

  const handleSendPrivateToStudent = async () => {
    if (!onSendTeacherBroadcast || !teacherPrivateText.trim() || !selectedStudentTarget || isSendingPrivate) return;
    try {
      setIsSendingPrivate(true);
      const targetStudent = availableStudents.find(s => s.username === selectedStudentTarget);
      await onSendTeacherBroadcast(
        teacherPrivateText.trim(),
        selectedStudentTarget,
        targetStudent?.sheetNumber
      );
      setTeacherPrivateText('');
      setShowPrivateEmojiPicker(false);
      setTeacherNotice(`تم إرسال الرسالة الخاصة للمشترك (${selectedStudentTarget}) بنجاح 🔒`);
      setTimeout(() => setTeacherNotice(null), 3500);
    } catch (err) {
      console.error('Failed to send private message to student:', err);
    } finally {
      setIsSendingPrivate(false);
    }
  };

  const getReactionBadge = (msg: LiveStudentMessage) => {
    switch (msg.type) {
      case 'hand':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
            <Hand className="w-3 h-3 text-amber-400" />
            <span>رفع اليد ✋</span>
          </span>
        );
      case 'agree':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
            <ThumbsUp className="w-3 h-3 text-emerald-400" />
            <span>موافق 👍</span>
          </span>
        );
      case 'disagree':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold">
            <ThumbsDown className="w-3 h-3 text-rose-400" />
            <span>غير موافق 👎</span>
          </span>
        );
      case 'clap':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>تشجيع وتصفيق 👏</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] font-bold">
            <MessageSquare className="w-3 h-3 text-sky-400" />
            <span>سؤال / استفسار 💬</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-inner">
              <MessageSquare className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-slate-100">
                  {isTeacher ? 'محادثة وتفاعل الطلاب المباشر' : 'محادثة مع الأستاذ 💬'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-mono font-bold">
                  {filteredMessages.length} رسالة
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold hidden sm:block">
                {isTeacher
                  ? 'إرسال رسائل عامة أو خاصة لكل طالب، ومتابعة أسئلة وتفاعلات الطلاب لحظياً.'
                  : 'اطرح سؤالك أو تفاعل بالأيقونات وتلقَّ رد المعلم أثناء الحصة.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Teacher Projector Toggle button */}
            {isTeacher && (
              <button
                type="button"
                onClick={() => onToggleShowInRoom(!showChatInRoom)}
                title={showChatInRoom ? 'إخفاء المحادثة من شاشة العرض الكبيرة' : 'إظهار المحادثة على شاشة العرض الكبيرة'}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  showChatInRoom
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border-slate-700'
                }`}
              >
                {showChatInRoom ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">
                  {showChatInRoom ? 'معروض بالشاشة' : 'مخفي من الشاشة'}
                </span>
              </button>
            )}

            {/* Clear All Messages (Teacher Only) */}
            {isTeacher && messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('هل أنت متأكد من مسح جميع رسائل وتفاعلات الطلاب الحالية؟')) {
                    onClearAll();
                  }
                }}
                className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-all border border-rose-500/20"
                title="مسح جميع الرسائل"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-750 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Pills (All / Questions / Reactions) */}
        <div className="px-3 py-1.5 bg-slate-950/40 border-b border-slate-800 flex items-center gap-2 text-xs shrink-0">
          <span className="text-slate-400 font-bold text-[11px] ml-1">عرض:</span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            الكل ({filteredMessages.length})
          </button>
          <button
            onClick={() => setFilterType('questions')}
            className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterType === 'questions'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            الأسئلة 💬 ({filteredMessages.filter(m => m.type === 'question').length})
          </button>
          <button
            onClick={() => setFilterType('reactions')}
            className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterType === 'reactions'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            التفاعلات ✋ ({filteredMessages.filter(m => m.type !== 'question').length})
          </button>
        </div>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 min-h-[180px]">
          {filteredMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-500">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-800 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 opacity-40 text-indigo-400" />
              </div>
              <h4 className="text-xs font-bold text-slate-400">لا توجد رسائل حالياً</h4>
              <p className="text-[11px] max-w-xs leading-relaxed text-slate-500">
                {isTeacher
                  ? 'يمكنك إرسال رسالة عامة للجميع أو اختيار طالب معين وإرسال رسالة خاصة له عبر الصندوق أدناه.'
                  : 'يمكنك كتابة سؤالك في الحقل أدناه أو اختيار أيقونة سريعة مثل رفع اليد.'}
              </p>
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const isMine = currentUserName && msg.senderName.trim().toLowerCase() === currentUserName.trim().toLowerCase();
              const hasReply = Boolean(msg.reply?.text);

              return (
                <div
                  key={msg.id}
                  className={`p-3 rounded-2xl border transition-all ${
                    msg.type === 'hand'
                      ? 'bg-amber-950/20 border-amber-500/30'
                      : msg.type === 'agree'
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : msg.type === 'disagree'
                      ? 'bg-rose-950/20 border-rose-500/30'
                      : isMine
                      ? 'bg-indigo-950/30 border-indigo-500/40'
                      : 'bg-slate-850 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 text-indigo-400 flex items-center justify-center font-bold text-xs">
                        <User className="w-3 h-3" />
                      </div>
                      <span className="font-black text-xs sm:text-sm text-slate-100">
                        {isMine ? `أنت (${msg.senderName})` : msg.senderName}
                      </span>
                      {msg.sheetNumber && (
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-750">
                          #{msg.sheetNumber}
                        </span>
                      )}
                      {getReactionBadge(msg)}
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{new Date(msg.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                      {isTeacher && (
                        <button
                          type="button"
                          onClick={() => onDeleteMessage(msg.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 transition-colors ml-1"
                          title="حذف الرسالة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Message Text Content */}
                  {msg.text && (
                    <p className="text-xs sm:text-sm font-semibold text-slate-200 mt-1 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                      {msg.text}
                    </p>
                  )}

                  {/* Teacher Reply Section */}
                  {hasReply && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-1 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-indigo-400">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>رد الأستاذ ({msg.reply?.repliedBy || 'المعلم'}):</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-1 ${
                          msg.reply?.type === 'public'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {msg.reply?.type === 'public' ? (
                            <>
                              <Globe className="w-2.5 h-2.5" />
                              <span>إجابة عامة</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-2.5 h-2.5" />
                              <span>خاصة للسائل</span>
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-slate-100 leading-relaxed pr-2">
                        {msg.reply?.text}
                      </p>
                    </div>
                  )}

                  {/* Teacher Reply Trigger Button */}
                  {isTeacher && (
                    <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMessage(msg);
                          setReplyText(msg.reply?.text || '');
                          setReplyType(msg.reply?.type || 'private');
                        }}
                        className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-[11px] font-bold flex items-center gap-1 border border-indigo-500/40 transition-all cursor-pointer"
                      >
                        <Reply className="w-3 h-3" />
                        <span>{hasReply ? 'تعديل الرد' : 'إرسال رد'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 1. TEACHER COMPOSER DRAWER (نافذة رسائل الإدارة: رسالة عامة منفصلة + رسالة خاصة لمشترك منفصلة) */}
        {isTeacher && onSendTeacherBroadcast && (
          <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-3 shrink-0">
            {/* Notification alert banner */}
            {teacherNotice && (
              <div className="p-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{teacherNotice}</span>
              </div>
            )}

            {/* القسم الأول: رسالة عامة للجميع وعلى الشاشة (منفصلة وظاهرة) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-emerald-400 flex items-center gap-1.5">
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>رسالة عامة للجميع (تظهر على الشاشة وللطلاب) 🌐</span>
                </span>
                <span className="text-[10px] text-slate-500 font-bold">عامة</span>
              </div>

              <div className="flex items-center gap-2 relative">
                {/* زر خاص بالأيقونات والابتسامات السريعة */}
                <button
                  type="button"
                  onClick={() => setShowPublicEmojiPicker(!showPublicEmojiPicker)}
                  title="إدراج أيقونات وعبارات تشجيعية"
                  className={`p-2 rounded-xl border transition-all cursor-pointer shrink-0 ${
                    showPublicEmojiPicker
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-950 border-slate-750 text-slate-400 hover:text-amber-400'
                  }`}
                >
                  <Smile className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={teacherPublicText}
                  onChange={(e) => setTeacherPublicText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendPublicBroadcast();
                  }}
                  placeholder="اكتب إعلاناً أو رسالة عامة للجميع على الشاشة..."
                  className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-750 focus:border-emerald-400 rounded-xl text-slate-100 text-xs font-bold outline-none placeholder:text-slate-500"
                />

                <button
                  type="button"
                  onClick={handleSendPublicBroadcast}
                  disabled={!teacherPublicText.trim() || isSendingPublic}
                  className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md disabled:opacity-40 cursor-pointer active:scale-95 transition-all shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال للجميع 🌐</span>
                </button>
              </div>

              {/* القائمة المنبثقة للأيقونات والابتسامات السريعة للرسالة العامة */}
              <AnimatePresence>
                {showPublicEmojiPicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-2 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center gap-1.5 overflow-hidden"
                  >
                    <span className="text-[10px] text-slate-400 font-bold ml-1">أيقونات وعبارات:</span>
                    {COMMON_EMOJIS.map((em, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTeacherPublicText(prev => prev ? `${prev} ${em}` : em)}
                        className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 text-xs font-bold transition-all cursor-pointer"
                      >
                        {em}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* القسم الثاني: إرسال رسالة خاصة لمشترك محدد (خاصة للإدارة) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-amber-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>إرسال رسالة خاصة لمشترك (للإدارة فقط) 🔒</span>
                </span>
                <span className="text-[10px] text-amber-500/80 font-mono font-bold">
                  {availableStudents.length > 0 ? `${availableStudents.length} مشترك متاح` : 'لا يوجد مشتركين متصلين'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* قائمة أسماء المشتركين */}
                <div className="sm:w-1/3 min-w-[170px]">
                  <select
                    value={selectedStudentTarget}
                    onChange={(e) => setSelectedStudentTarget(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-950 border border-amber-500/40 focus:border-amber-400 rounded-xl text-amber-200 text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="">-- اختر المشترك لإرسال خاص --</option>
                    {availableStudents.map((st, i) => (
                      <option key={i} value={st.username}>
                        {st.username} {st.sheetNumber ? `(#${st.sheetNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* حقل نص الرسالة الخاصة */}
                <div className="flex-1 flex items-center gap-2 relative">
                  <button
                    type="button"
                    onClick={() => setShowPrivateEmojiPicker(!showPrivateEmojiPicker)}
                    title="إدراج أيقونات سريعة"
                    className={`p-2 rounded-xl border transition-all cursor-pointer shrink-0 ${
                      showPrivateEmojiPicker
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-950 border-slate-750 text-slate-400 hover:text-amber-400'
                    }`}
                  >
                    <Smile className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={teacherPrivateText}
                    onChange={(e) => setTeacherPrivateText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendPrivateToStudent();
                    }}
                    placeholder={
                      selectedStudentTarget
                        ? `اكتب رسالة خاصة لـ (${selectedStudentTarget})...`
                        : 'اختر مشتركاً أولاً لكتابة رسالة خاصة له...'
                    }
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-750 focus:border-amber-400 rounded-xl text-slate-100 text-xs font-bold outline-none placeholder:text-slate-500"
                  />

                  <button
                    type="button"
                    onClick={handleSendPrivateToStudent}
                    disabled={!teacherPrivateText.trim() || !selectedStudentTarget || isSendingPrivate}
                    className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md disabled:opacity-40 cursor-pointer active:scale-95 transition-all shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>إرسال خاص 🔒</span>
                  </button>
                </div>
              </div>

              {/* القائمة المنبثقة للأيقونات للرسالة الخاصة */}
              <AnimatePresence>
                {showPrivateEmojiPicker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-2 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center gap-1.5 overflow-hidden"
                  >
                    <span className="text-[10px] text-slate-400 font-bold ml-1">أيقونات:</span>
                    {COMMON_EMOJIS.map((em, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTeacherPrivateText(prev => prev ? `${prev} ${em}` : em)}
                        className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 text-xs font-bold transition-all cursor-pointer"
                      >
                        {em}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* 2. STUDENT COMPOSER DRAWER */}
        {!isTeacher && onSendStudentMessage && (
          <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2 shrink-0">
            {/* Quick Reactions inside the window */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">تفاعل سريع:</span>
              <div className="flex items-center gap-1.5 flex-1 overflow-x-auto py-0.5">
                <button
                  type="button"
                  onClick={() => handleStudentSubmit('hand')}
                  disabled={isSendingStudentMsg}
                  className="px-2 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                  title="رفع اليد"
                >
                  <Hand className="w-3.5 h-3.5 text-amber-400" />
                  <span>رفع اليد ✋</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStudentSubmit('agree')}
                  disabled={isSendingStudentMsg}
                  className="px-2 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                  title="موافق"
                >
                  <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>موافق 👍</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStudentSubmit('disagree')}
                  disabled={isSendingStudentMsg}
                  className="px-2 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                  title="غير موافق"
                >
                  <ThumbsDown className="w-3.5 h-3.5 text-rose-400" />
                  <span>غير موافق 👎</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStudentSubmit('clap')}
                  disabled={isSendingStudentMsg}
                  className="px-2 py-1 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                  title="تشجيع وتصفيق"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>تصفيق 👏</span>
                </button>
              </div>
            </div>

            {/* Notification alert banner */}
            {studentSuccessNotice && (
              <div className="p-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{studentSuccessNotice}</span>
              </div>
            )}

            {/* Question Text Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={studentInputText}
                onChange={(e) => setStudentInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && studentInputText.trim()) {
                    handleStudentSubmit('question', studentInputText.trim());
                  }
                }}
                placeholder="اكتب سؤالك أو استفسارك للأستاذ هنا..."
                className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-750 focus:border-indigo-400 rounded-xl text-slate-100 text-xs font-bold outline-none placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => handleStudentSubmit('question', studentInputText.trim())}
                disabled={!studentInputText.trim() || isSendingStudentMsg}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md disabled:opacity-40 cursor-pointer active:scale-95 transition-all shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إرسال</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. TEACHER REPLY MODAL (عند الرد المباشر على رسالة طالب سابقة) */}
        {isTeacher && selectedMessage && (
          <div className="p-3.5 bg-slate-950 border-t border-indigo-500/40 space-y-2.5 shrink-0 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-indigo-300 flex items-center gap-1.5">
                <Reply className="w-4 h-4 text-indigo-400" />
                <span>الرد على: {selectedMessage.senderName} ({selectedMessage.text || getReactionBadge(selectedMessage)})</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="text-slate-400 hover:text-white"
              >
                إلغاء
              </button>
            </div>

            {/* Answer Visibility Mode: Private vs Public */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-bold">نوع الإجابة:</span>
              <button
                type="button"
                onClick={() => setReplyType('private')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                  replyType === 'private'
                    ? 'bg-amber-600 text-white border-amber-400 shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>إجابة خاصة (للسائل فقط) 🔒</span>
              </button>

              <button
                type="button"
                onClick={() => setReplyType('public')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                  replyType === 'public'
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>إجابة عامة (على الشاشة وللجميع) 🌐</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendReply();
                }}
                placeholder={replyType === 'private' ? 'اكتب إجابتك الخاصة للطالب...' : 'اكتب إجابتك العامة التي ستظهر للجميع...'}
                className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-750 focus:border-indigo-400 rounded-xl text-slate-100 text-xs font-bold outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSendReply}
                disabled={!replyText.trim() || isSubmittingReply}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إرسال الرد</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
