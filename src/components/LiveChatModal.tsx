import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Send, Hand, ThumbsUp, ThumbsDown, 
  Sparkles, CheckCircle2, Clock, Trash2, Reply, Eye, 
  EyeOff, Volume2, User, X, Check, Lock, Globe, AlertCircle
} from 'lucide-react';
import { LiveStudentMessage } from '../types';

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
  isTeacher?: boolean; // True for Admin / Teacher Room
}

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
  isTeacher = false,
}: LiveChatModalProps) {
  const [selectedMessage, setSelectedMessage] = useState<LiveStudentMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyType, setReplyType] = useState<'private' | 'public'>('private');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'questions' | 'reactions'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isOpen]);

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

  const getReactionBadge = (msg: LiveStudentMessage) => {
    switch (msg.type) {
      case 'hand':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
            <Hand className="w-3.5 h-3.5 text-amber-400" />
            <span>رفع اليد ✋</span>
          </span>
        );
      case 'agree':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
            <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>موافق 👍</span>
          </span>
        );
      case 'disagree':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold">
            <ThumbsDown className="w-3.5 h-3.5 text-rose-400" />
            <span>غير موافق 👎</span>
          </span>
        );
      case 'clap':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>تصفيق وتشجيع 👏</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-bold">
            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
            <span>سؤال / استفسار 💬</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-inner">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-100">
                  {isTeacher ? 'محادثة وتفاعل الطلاب المباشر' : 'محادثتي مع الأستاذ'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-mono font-bold">
                  {filteredMessages.length} رسالة
                </span>
              </div>
              <p className="text-xs text-slate-400 font-semibold">
                {isTeacher
                  ? 'استقبل أسئلة الطلاب، تفاعلاتهم (رفع اليد، موافق/معارض)، وأجبهم بشكل خاص أو عام على الشاشة.'
                  : 'اطرح سؤالك أو استفسارك وتلقَّ رد المعلم أثناء الحصة.'}
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
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
                className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-all border border-rose-500/20"
                title="مسح جميع الرسائل"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-750 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Pills (All / Questions / Reactions) */}
        <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800 flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-bold ml-1">التصنيف:</span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            الكل ({messages.length})
          </button>
          <button
            onClick={() => setFilterType('questions')}
            className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              filterType === 'questions'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            الأسئلة فقط 💬 ({messages.filter(m => m.type === 'question').length})
          </button>
          <button
            onClick={() => setFilterType('reactions')}
            className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              filterType === 'reactions'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            التفاعلات (يد / موافق) ✋ ({messages.filter(m => m.type !== 'question').length})
          </button>
        </div>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 min-h-[300px]">
          {filteredMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 text-slate-500">
              <div className="w-16 h-16 rounded-3xl bg-slate-800/60 border border-slate-800 flex items-center justify-center">
                <MessageSquare className="w-8 h-8 opacity-40 text-indigo-400" />
              </div>
              <h4 className="text-sm font-bold text-slate-400">لا توجد رسائل أو تفاعلات حالياً</h4>
              <p className="text-xs max-w-xs leading-relaxed text-slate-500">
                {isTeacher
                  ? 'عندما يرسل أحد الطلاب استفساراً أو يرفع يده أو يبدي موافقة أثناء الدرس ستظهر هنا مباشرة مع تنبيه صوتي.'
                  : 'يمكنك استخدام الأزرار أدناه لطرح سؤال على الأستاذ أو رفع اليد.'}
              </p>
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const isMine = currentUserName && msg.senderName.trim().toLowerCase() === currentUserName.trim().toLowerCase();
              const hasReply = Boolean(msg.reply?.text);

              return (
                <div
                  key={msg.id}
                  className={`p-4 rounded-2xl border transition-all ${
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
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="w-7 h-7 rounded-xl bg-slate-800 border border-slate-700 text-indigo-400 flex items-center justify-center font-bold text-xs">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-black text-sm text-slate-100">
                        {msg.senderName}
                      </span>
                      {msg.sheetNumber && (
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-750">
                          #{msg.sheetNumber}
                        </span>
                      )}
                      {getReactionBadge(msg)}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
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
                    <p className="text-sm font-semibold text-slate-200 mt-1 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                      {msg.text}
                    </p>
                  )}

                  {/* Teacher Reply Section */}
                  {hasReply && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-1.5 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-black text-indigo-400">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>رد الأستاذ ({msg.reply?.repliedBy || 'المعلم'}):</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                          msg.reply?.type === 'public'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {msg.reply?.type === 'public' ? (
                            <>
                              <Globe className="w-3 h-3" />
                              <span>إجابة عامة (تظهر للجميع)</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>إجابة خاصة للسائل فقط</span>
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
                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMessage(msg);
                          setReplyText(msg.reply?.text || '');
                          setReplyType(msg.reply?.type || 'private');
                        }}
                        className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-indigo-500/40 transition-all cursor-pointer"
                      >
                        <Reply className="w-3.5 h-3.5" />
                        <span>{hasReply ? 'تعديل الرد' : 'إرسال رد للطالب'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Teacher Reply Form Drawer */}
        {isTeacher && selectedMessage && (
          <div className="p-4 bg-slate-950 border-t border-indigo-500/40 space-y-3 animate-in slide-in-from-bottom-2">
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
              <span className="text-xs text-slate-400 font-bold">نوع الإجابة:</span>
              <button
                type="button"
                onClick={() => setReplyType('private')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
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
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
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
                className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-750 focus:border-indigo-400 rounded-xl text-slate-100 text-xs font-bold outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSendReply}
                disabled={!replyText.trim() || isSubmittingReply}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>إرسال الرد</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
