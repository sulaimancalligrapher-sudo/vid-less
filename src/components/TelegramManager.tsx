import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, Bot, MessageSquare, Users, Settings as SettingsIcon,
  CheckCircle2, AlertCircle, RefreshCw, Copy, ExternalLink,
  HelpCircle, ShieldCheck, Sparkles, User, Globe, Link as LinkIcon,
  FileText, Check, Phone, Info, Radio, Zap, Trash2
} from 'lucide-react';
import { 
  TelegramConfig, TelegramTemplateItem, TelegramBroadcastMessage, TelegramUserBinding, AdminAnswerRow 
} from '../types';
import { 
  getTelegramConfig, saveTelegramConfig, saveTelegramConfigToSheet, fetchTelegramConfigFromSheet, getTelegramTemplates, saveTelegramTemplates,
  saveTelegramTemplatesToSheet, fetchTelegramTemplatesFromSheet,
  getLinkedTelegramStudents, saveLinkedTelegramStudent, removeLinkedTelegramStudent,
  generateStudentTelegramLink, testTelegramBotToken, getTelegramRecentUpdates,
  sendTelegramMessageDirect, setTelegramWebhook, deleteTelegramWebhook, getTelegramWebhookInfo, getWebAppUrl,
  fetchLinkedTelegramUsersFromSheet, fetchSettingsStudentsFromSheet, setupTelegramSheetsInGas, simulateTelegramWebhookInGas, bindTelegramUserInGas,
  normalizeLanguage, formatLanguageBadge,
  DEFAULT_TELEGRAM_TEMPLATES
} from '../api';

interface TelegramManagerProps {
  answers: AdminAnswerRow[];
  onNotify: (text: string, type: 'success' | 'error') => void;
}

export default function TelegramManager({ answers, onNotify }: TelegramManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'config' | 'broadcast' | 'templates' | 'users' | 'guide'>('config');

  // Config State
  const [config, setConfig] = useState<TelegramConfig>(getTelegramConfig());
  const [botTestResult, setBotTestResult] = useState<{ success: boolean; data?: any; error?: string } | null>(null);
  const [testingBot, setTestingBot] = useState(false);
  const [fetchingUpdates, setFetchingUpdates] = useState(false);
  const [recentChats, setRecentChats] = useState<Array<{ id: number | string; title: string; type: string; date: string }> | null>(null);
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [testingTeacherMsg, setTestingTeacherMsg] = useState(false);

  // Templates State
  const [templates, setTemplates] = useState<TelegramTemplateItem[]>(getTelegramTemplates());
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(templates[0]?.key || 'homework_received');
  const [savingTemplates, setSavingTemplates] = useState(false);

  // Linked Students & Settings Students State
  const [linkedStudents, setLinkedStudents] = useState<Record<string, TelegramUserBinding>>(getLinkedTelegramStudents());
  const [settingsStudents, setSettingsStudents] = useState<Array<{ name: string; sheet: string }>>([]);
  const [searchStudent, setSearchStudent] = useState('');
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  // Broadcast Message State
  const [broadcastRecipient, setBroadcastRecipient] = useState<'all' | 'specific_student' | 'teacher' | 'group'>('teacher');
  const [targetStudentKey, setTargetStudentKey] = useState('');
  const [broadcastType, setBroadcastType] = useState<'text' | 'photo' | 'voice' | 'link'>('text');
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastMediaUrl, setBroadcastMediaUrl] = useState('');
  const [broadcastBtnLabel, setBroadcastBtnLabel] = useState('');
  const [broadcastBtnUrl, setBroadcastBtnUrl] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncingSheetStudents, setSyncingSheetStudents] = useState(false);
  const [simulatingWebhook, setSimulatingWebhook] = useState(false);
  const [settingUpSheets, setSettingUpSheets] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Extract unique students list from Settings sheet (primary), answers, and linkedStudents
  const uniqueStudents = React.useMemo(() => {
    const map = new Map<string, { name: string; sheet: string }>();

    // 1) Add all students from Settings sheet (Columns B & C)
    settingsStudents.forEach(s => {
      if (s.name && s.sheet) {
        const key = `${s.name.trim()}__${s.sheet.trim()}`;
        map.set(key, { name: s.name.trim(), sheet: s.sheet.trim() });
      }
    });

    // 2) Add students from answers
    answers.forEach(a => {
      const name = a.username ? a.username.trim() : '';
      const sheet = a.sheetNumber ? String(a.sheetNumber).trim() : '1';
      if (name && !map.has(`${name}__${sheet}`)) {
        map.set(`${name}__${sheet}`, { name, sheet });
      }
    });

    // 3) Also include any students found in linkedStudents that might not have answers yet
    Object.values(linkedStudents).forEach((binding: TelegramUserBinding) => {
      if (binding && binding.studentName && binding.sheetNumber) {
        const key = `${binding.studentName.trim()}__${binding.sheetNumber.trim()}`;
        if (!map.has(key)) {
          map.set(key, { name: binding.studentName.trim(), sheet: binding.sheetNumber.trim() });
        }
      }
    });

    return Array.from(map.values());
  }, [settingsStudents, answers, linkedStudents]);

  const syncStudentsData = React.useCallback(async (silent: boolean = false) => {
    if (silent) {
      setIsAutoSyncing(true);
    } else {
      setSyncingSheetStudents(true);
    }
    try {
      // 1) Sync Telegram linked users from Telegram_Users sheet
      const resUsers = await fetchLinkedTelegramUsersFromSheet();
      let linkedCount = 0;
      if (resUsers.success && resUsers.users) {
        setLinkedStudents(resUsers.users);
        linkedCount = Object.keys(resUsers.users).length;
      }

      // 2) Sync all registered students in Settings sheet (Columns B & C)
      const resSettings = await fetchSettingsStudentsFromSheet();
      let totalStudentsCount = 0;
      if (resSettings.success && resSettings.students && resSettings.students.length > 0) {
        setSettingsStudents(resSettings.students);
        totalStudentsCount = resSettings.students.length;
      }

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSyncedTime(nowStr);

      if (!silent) {
        onNotify(`تمت المزامنة بنجاح! تم جلب ${totalStudentsCount || uniqueStudents.length} طالب من ورقة Settings، و ${linkedCount} طالب مربوط في التلغرام 🔄 (${nowStr})`, 'success');
      }
    } catch (err: any) {
      if (!silent) {
        onNotify('تعذر مزامنة بيانات الطلاب: ' + (err.message || ''), 'error');
      }
    } finally {
      if (silent) {
        setIsAutoSyncing(false);
      } else {
        setSyncingSheetStudents(false);
      }
    }
  }, [onNotify, uniqueStudents.length]);

  const handleSyncStudentsFromSheet = async () => {
    await syncStudentsData(false);
  };

  const handleSetupSheets = async () => {
    setSettingUpSheets(true);
    try {
      const res = await setupTelegramSheetsInGas();
      if (res.success) {
        onNotify(res.message || 'تم إنشاء وتهيئة أوراق التلغرام الأربعة في Google Sheets بنجاح! 📑', 'success');
        await handleSyncStudentsFromSheet();
      } else {
        onNotify(res.message || 'تعذر تهيئة الأوراق في Google Sheets.', 'error');
      }
    } catch (err: any) {
      onNotify('خطأ أثناء تهيئة الأوراق: ' + err.message, 'error');
    } finally {
      setSettingUpSheets(false);
    }
  };

  const handleSimulateWebhook = async (sheetNum: string, studentName: string) => {
    setSimulatingWebhook(true);
    try {
      const res = await simulateTelegramWebhookInGas(sheetNum, studentName);
      if (res.success) {
        onNotify(`تم إرسال محاكاة ربط الطالب (#${sheetNum}) بنجاح! ${res.message || ''}`, 'success');
        await handleSyncStudentsFromSheet();
      } else {
        onNotify('استجابة السكربت: ' + (res.message || 'فشلت المحاكاة'), 'error');
      }
    } catch (err: any) {
      onNotify('فشل محاكاة الإرسال: ' + err.message, 'error');
    } finally {
      setSimulatingWebhook(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await saveTelegramConfigToSheet(config);
      if (res.success) {
        onNotify('تم حفظ وتحديث إعدادات التلغرام ومعرف الأستاذ في Google Sheets بنجاح! 💾✈️', 'success');
      } else {
        onNotify('تم الحفظ محلياً (تحذير: ' + (res.message || 'فشلت المزامنة مع الشيت') + ')', 'warning' as any);
      }
    } catch (err: any) {
      onNotify('تم الحفظ محلياً: ' + (err.message || ''), 'warning' as any);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestBot = async () => {
    if (!config.botToken.trim()) {
      onNotify('يرجى إدخال Bot Token أولاً.', 'error');
      return;
    }
    setTestingBot(true);
    setBotTestResult(null);
    try {
      const res = await testTelegramBotToken(config.botToken);
      setBotTestResult(res);
      if (res.success && res.data?.username) {
        if (!config.botUsername) {
          const updated = { ...config, botUsername: res.data.username };
          setConfig(updated);
          saveTelegramConfig(updated);
        }
        onNotify(`البوت متصل بنجاح: @${res.data.username} 🤖`, 'success');
      } else {
        onNotify('فشل التحقق من البوت: ' + (res.error || ''), 'error');
      }
    } finally {
      setTestingBot(false);
    }
  };

  const handleTestTeacherMsg = async () => {
    if (!config.botToken.trim()) {
      onNotify('يرجى إدخال Bot Token أولاً.', 'error');
      return;
    }
    const targetChatId = config.teacherChatId.trim();
    if (!targetChatId) {
      onNotify('يرجى إدخال معرّف الأستاذ (Teacher Chat ID) أولاً.', 'error');
      return;
    }

    setTestingTeacherMsg(true);
    try {
      const testMsg = '📝 تجربة إرسال واجب الطالب (اسم تجريبي)\n📚 الموضوع: تمرين الخط\n📊 النتيجة الكلية: 100%';
      const res = await sendTelegramMessageDirect({
        botToken: config.botToken.trim(),
        chatId: targetChatId,
        text: testMsg,
        buttons: [
          { text: '🖼️ فتح صورة الواجب (تجريبي)', url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600' },
          { text: '🎙️ تشغيل الصوت (تجريبي)', url: 'https://www.google.com' }
        ],
        parseMode: undefined as any
      });

      if (res.success) {
        onNotify('تم إرسال الرسالة التجريبية مع الأزرار التفاعلية للأستاذ بنجاح! 📨✨', 'success');
      } else {
        onNotify('فشل إرسال رسالة الأستاذ: ' + (res.error || 'تأكد من إرسال /start للبوت من حساب الأستاذ أولاً'), 'error');
      }
    } catch (err: any) {
      onNotify('خطأ أثناء الإرسال: ' + err.message, 'error');
    } finally {
      setTestingTeacherMsg(false);
    }
  };

  const handleFetchRecentChats = async () => {
    if (!config.botToken.trim()) {
      onNotify('يرجى إدخال Bot Token أولاً.', 'error');
      return;
    }
    setFetchingUpdates(true);
    try {
      const res = await getTelegramRecentUpdates(config.botToken);
      if (res.success && res.chats) {
        setRecentChats(res.chats);
        if (res.chats.length === 0) {
          onNotify('لم يتم العثور على رسائل حديثة. أرسل رسالة /start للبوت من حسابك ثم أعد المحاولة.', 'error');
        } else {
          onNotify(`تم العثور على ${res.chats.length} محادثات حديثة.`, 'success');
        }
      } else {
        onNotify(res.error || 'تعذر جلب التحديثات.', 'error');
      }
    } finally {
      setFetchingUpdates(false);
    }
  };

  const handleSetWebhook = async () => {
    if (!config.botToken.trim()) {
      onNotify('يرجى إدخال Bot Token أولاً.', 'error');
      return;
    }
    const webAppUrl = getWebAppUrl();
    if (!webAppUrl || !webAppUrl.startsWith('http')) {
      onNotify('يرجى التأكد من حفظ رابط Google Apps Script Web App URL في الإعدادات أولاً.', 'error');
      return;
    }

    setSettingWebhook(true);
    try {
      const res = await setTelegramWebhook(config.botToken, webAppUrl);
      if (res.success) {
        onNotify('تم تفعيل Webhook بنجاح! الآن البوت سيرد تلقائياً عند ضغط الطالب Start 🚀', 'success');
        const info = await getTelegramWebhookInfo(config.botToken);
        if (info.success) setWebhookInfo(info.data);
      } else {
        onNotify(res.error || 'تعذر تفعيل Webhook.', 'error');
      }
    } finally {
      setSettingWebhook(false);
    }
  };

  const handleCheckWebhook = async () => {
    if (!config.botToken.trim()) return;
    const res = await getTelegramWebhookInfo(config.botToken);
    if (res.success) {
      setWebhookInfo(res.data);
      onNotify('تم جلب حالة Webhook الحالية بنجاح.', 'success');
    } else {
      onNotify(res.error || 'تعذر فحص Webhook.', 'error');
    }
  };

  const handleStopWebhook = async () => {
    if (!config.botToken.trim()) {
      onNotify('يرجى إدخال Bot Token أولاً.', 'error');
      return;
    }
    setSettingWebhook(true);
    try {
      const res = await deleteTelegramWebhook(config.botToken);
      if (res.success) {
        onNotify('تم إيقاف Webhook فوراً ومسح كافة الرسائل المعلقة بنجاح 🛑🧹', 'success');
        const info = await getTelegramWebhookInfo(config.botToken);
        if (info.success) setWebhookInfo(info.data);
      } else {
        onNotify(res.error || 'تعذر إيقاف Webhook.', 'error');
      }
    } catch (err: any) {
      onNotify('خطأ: ' + err.message, 'error');
    } finally {
      setSettingWebhook(false);
    }
  };

  const handleClearPendingQueue = async () => {
    if (!config.botToken.trim()) {
      onNotify('يرجى إدخال Bot Token أولاً.', 'error');
      return;
    }
    const webAppUrl = getWebAppUrl();
    setSettingWebhook(true);
    try {
      // 1. Delete webhook with drop_pending_updates
      await deleteTelegramWebhook(config.botToken);
      // 2. If webAppUrl exists, re-register webhook with clean queue
      if (webAppUrl && webAppUrl.startsWith('http')) {
        await setTelegramWebhook(config.botToken, webAppUrl);
        onNotify('تم تفريغ طابور التلغرام ومسح الرسائل المتكررة بنجاح وإعادة تفعيل Webhook! 🧹✨', 'success');
      } else {
        onNotify('تم تفريغ طابور رسائل تلغرام المعلقة بنجاح! 🧹', 'success');
      }
      const info = await getTelegramWebhookInfo(config.botToken);
      if (info.success) setWebhookInfo(info.data);
    } catch (err: any) {
      onNotify('خطأ أثناء تفريغ الطابور: ' + err.message, 'error');
    } finally {
      setSettingWebhook(false);
    }
  };

  const handleSaveTemplates = async () => {
    setSavingTemplates(true);
    try {
      const res = await saveTelegramTemplatesToSheet(templates);
      if (res.success) {
        onNotify('تم حفظ قوالب رسائل التلغرام وتحديثها في Google Sheets بنجاح! 📝💾', 'success');
      } else {
        onNotify('تم الحفظ محلياً: ' + (res.message || ''), 'warning' as any);
      }
    } catch (err: any) {
      onNotify('تم الحفظ محلياً: ' + (err.message || ''), 'warning' as any);
    } finally {
      setSavingTemplates(false);
    }
  };

  const handleResetTemplates = async () => {
    if (confirm('هل أنت متأكد من إعادة ضبط قوالب الرسائل إلى النصوص الافتراضية؟')) {
      setTemplates(DEFAULT_TELEGRAM_TEMPLATES);
      setSavingTemplates(true);
      try {
        await saveTelegramTemplatesToSheet(DEFAULT_TELEGRAM_TEMPLATES);
        onNotify('تمت استعادة قوالب الرسائل الافتراضية وتحديث الشيت بنجاح.', 'success');
      } catch {
        onNotify('تمت استعادة القوالب الافتراضية محلياً.', 'success');
      } finally {
        setSavingTemplates(false);
      }
    }
  };

  const updateTemplateField = (
    key: string,
    field: 'ar' | 'th' | 'en' | 'buttonTextAr' | 'buttonTextTh' | 'buttonTextEn' | 'buttonUrl',
    val: string
  ) => {
    const updated = templates.map(t => t.key === key ? { ...t, [field]: val } : t);
    setTemplates(updated);
  };

  const handleSendBroadcast = async () => {
    if (!config.botToken.trim()) {
      onNotify('يرجى ضبط Bot Token في قسم الإعدادات أولاً.', 'error');
      return;
    }

    if (!broadcastText.trim()) {
      onNotify('يرجى كتابة نص الرسالة أولاً.', 'error');
      return;
    }

    setSendingBroadcast(true);
    setBroadcastResult(null);

    try {
      let targetChatId = '';

      if (broadcastRecipient === 'teacher') {
        targetChatId = config.teacherChatId.trim();
        if (!targetChatId) throw new Error('معرف الأستاذ (Teacher Chat ID) غير محدد في الإعدادات.');
      } else if (broadcastRecipient === 'group') {
        targetChatId = config.groupChatId.trim();
        if (!targetChatId) throw new Error('معرف قروب الأساتذة (Group Chat ID) غير محدد في الإعدادات.');
      } else if (broadcastRecipient === 'specific_student') {
        const binding = linkedStudents[targetStudentKey.toLowerCase()];
        if (!binding || !binding.chatId) {
          throw new Error('هذا الطالب لم يقم بربط حسابه بالتليجرام بعد (لا يوجد Chat ID).');
        }
        targetChatId = binding.chatId;
      } else if (broadcastRecipient === 'all') {
        // Broadcast to all linked students
        const allLinked = (Object.values(linkedStudents) as TelegramUserBinding[]).filter(s => s.chatId);
        if (allLinked.length === 0) {
          throw new Error('لا يوجد أي طلاب قاموا بربط حساباتهم بالتليجرام حتى الآن.');
        }

        let sentCount = 0;
        for (const s of allLinked) {
          await sendTelegramMessageDirect({
            botToken: config.botToken,
            chatId: s.chatId,
            text: broadcastText.replace('{student}', s.studentName),
            buttonLabel: broadcastBtnLabel || undefined,
            buttonUrl: broadcastBtnUrl || undefined
          });
          sentCount++;
        }

        setBroadcastResult({
          success: true,
          message: `تم إرسال الرسالة بنجاح إلى جميع الطلاب المرتبطين (${sentCount} طالب) 🎉`
        });
        onNotify(`تم الإرسال لـ ${sentCount} طالب!`, 'success');
        return;
      }

      // Single send
      const res = await sendTelegramMessageDirect({
        botToken: config.botToken,
        chatId: targetChatId,
        text: broadcastText,
        buttonLabel: broadcastBtnLabel || undefined,
        buttonUrl: broadcastBtnUrl || undefined
      });

      if (res.success) {
        setBroadcastResult({
          success: true,
          message: 'تم إرسال الرسالة عبر تلغرام بنجاح! 🚀'
        });
        onNotify('تم إرسال الرسالة بنجاح!', 'success');
      } else {
        throw new Error(res.error || 'فشل إرسال الرسالة.');
      }
    } catch (err: any) {
      setBroadcastResult({
        success: false,
        message: err.message || 'خطأ غير متوقع أثناء الإرسال.'
      });
      onNotify(err.message || 'فشل الإرسال', 'error');
    } finally {
      setSendingBroadcast(false);
    }
  };

  const activeTemplate = templates.find(t => t.key === selectedTemplateKey) || templates[0];

  return (
    <div className="space-y-6 text-slate-100" dir="rtl">
      {/* Sub-Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-950/70 border border-slate-800 rounded-2xl">
        <button
          onClick={() => setActiveSubTab('config')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'config'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>إعدادات البوت والربط</span>
        </button>

        <button
          onClick={() => setActiveSubTab('broadcast')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'broadcast'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>إرسال رسائل وتنبيهات</span>
        </button>

        <button
          onClick={() => setActiveSubTab('templates')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'templates'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>قوالب الرسائل واللغات 🇸🇦🇹🇭🇬🇧</span>
        </button>

        <button
          onClick={() => setActiveSubTab('users')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'users'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>دليل الطلاب وحالة ربط التلغرام</span>
        </button>

        <button
          onClick={() => setActiveSubTab('guide')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'guide'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>هيكل الشيت والكود البرمجي 📋</span>
        </button>
      </div>

      {/* 1. CONFIG SUB-TAB */}
      {activeSubTab === 'config' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Main Bot Credential Box */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-2xl border border-sky-500/20">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">بيانات ومعرفات بوت التلغرام (Telegram Bot)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">اربط تطبيق التلغرام عبر توكن البوت الرسمي (Bot Token)</p>
                </div>
              </div>

              {botTestResult?.success && (
                <div className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>متصل: @{botTestResult.data?.username}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  توكن البوت السري (Bot Token): <span className="text-rose-400">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    dir="ltr"
                    value={config.botToken}
                    onChange={e => setConfig({ ...config, botToken: e.target.value })}
                    placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                    className="flex-1 px-4 py-3 bg-slate-900 border border-slate-800 focus:border-amber-500 text-slate-100 rounded-xl outline-none font-mono text-xs"
                  />
                  <button
                    onClick={handleTestBot}
                    disabled={testingBot || !config.botToken}
                    className="px-4 py-3 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {testingBot ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    <span>فحص البوت</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  تحصل عليه مجاناً بإنشاء بوت عبر التلغرام من <b>@BotFather</b>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  اسم مستخدم البوت (Bot Username):
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={config.botUsername || ''}
                  onChange={e => setConfig({ ...config, botUsername: e.target.value })}
                  placeholder="MySchool_Bot"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 focus:border-amber-500 text-slate-100 rounded-xl outline-none font-mono text-xs"
                />
                <p className="text-[11px] text-slate-500 mt-1">يُستخدم لتوليد روابط الاشتراك السريعة للطلاب.</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    معرّف الأستاذ الخاص (Teacher Chat ID):
                  </label>
                  {config.teacherChatId && (
                    <button
                      onClick={handleTestTeacherMsg}
                      disabled={testingTeacherMsg || !config.botToken}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="إرسال رسالة تجريبية نصية مبسطة لمعرف الأستاذ مباشرة"
                    >
                      {testingTeacherMsg ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      <span>تجربة إرسال رسالة الأستاذ 📨</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  dir="ltr"
                  value={config.teacherChatId}
                  onChange={e => setConfig({ ...config, teacherChatId: e.target.value })}
                  placeholder="123456789"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 focus:border-amber-500 text-slate-100 rounded-xl outline-none font-mono text-xs"
                />
                <p className="text-[11px] text-slate-500 mt-1">رقم الدردشة الخاص بالأستاذ لاستلام إشعارات الواجبات فوراً.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  معرّف قروب الأساتذة (Group Chat ID):
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={config.groupChatId}
                  onChange={e => setConfig({ ...config, groupChatId: e.target.value })}
                  placeholder="-1001234567890"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 focus:border-amber-500 text-slate-100 rounded-xl outline-none font-mono text-xs"
                />
                <p className="text-[11px] text-slate-500 mt-1">معرّف قروب التلغرام (يبدأ عادة بإشارة سالب مثل -100).</p>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleFetchRecentChats}
                  disabled={fetchingUpdates || !config.botToken}
                  className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {fetchingUpdates ? <RefreshCw className="w-4 h-4 animate-spin" /> : <HelpCircle className="w-4 h-4 text-amber-400" />}
                  <span>جلب معرفات الدردشة الأخيرة (Get Chat IDs)</span>
                </button>
              </div>
            </div>

            {/* Discovered Recent Chats Assistant */}
            {recentChats && recentChats.length > 0 && (
              <div className="p-4 bg-slate-900/90 border border-amber-500/30 rounded-2xl space-y-2">
                <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>المحادثات المكتشفة مؤخراً (انقر لنسخ المعرف أو تعيينه):</span>
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {recentChats.map((c, i) => (
                    <div key={i} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-bold text-slate-200">{c.title}</span>
                        <span className="text-[10px] text-slate-400 mr-2">({c.type})</span>
                        <span className="text-[10px] font-mono text-amber-400 mr-2">ID: {c.id}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            setConfig({ ...config, teacherChatId: String(c.id) });
                            onNotify(`تم تعيين معرف الأستاذ: ${c.id}`, 'success');
                          }}
                          className="px-2 py-1 bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 rounded-lg text-[10px] font-bold"
                        >
                          تعيين كأستاذ
                        </button>
                        <button
                          onClick={() => {
                            setConfig({ ...config, groupChatId: String(c.id) });
                            onNotify(`تم تعيين معرف القروب: ${c.id}`, 'success');
                          }}
                          className="px-2 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 rounded-lg text-[10px] font-bold"
                        >
                          تعيين كقروب
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* One-Click Sheets Setup Banner */}
            <div className="p-4 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-extrabold text-emerald-400 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>تهيئة أوراق التلغرام الأربعة في Google Sheets:</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  ينشئ تلقائياً أوراق (<b>Telegram_Users</b>، <b>Telegram_Config</b>، <b>Telegram_Templates</b>، <b>Telegram_Logs</b>) بألوانها وأعمدتها النموذجية.
                </p>
              </div>
              <button
                onClick={handleSetupSheets}
                disabled={settingUpSheets}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-900/30 flex items-center gap-2 disabled:opacity-50 cursor-pointer shrink-0"
              >
                {settingUpSheets ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{settingUpSheets ? 'جاري التهيئة...' : 'إنشاء وتهيئة أوراق التلغرام في الشيت 📑'}</span>
              </button>
            </div>

            {/* Webhook Auto-Responder Section (CRITICAL FOR STUDENT START) */}
            <div className="p-4 bg-gradient-to-r from-sky-950/40 via-slate-900 to-indigo-950/40 border border-sky-500/30 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-extrabold text-sky-400 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-sky-400" />
                    <span>تفعيل استقبال الطلاب التلقائي (Telegram Webhook):</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    هذا الخيار يربط البوت مباشرة بسكربت Google Apps Script ليرد على الطلاب فوراً عند ضغط <b>Start</b> وحفظهم في الشيت تلقائياً.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSetWebhook}
                    disabled={settingWebhook || !config.botToken}
                    className="px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {settingWebhook ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    <span>تفعيل / تحديث Webhook 🚀</span>
                  </button>
                  <button
                    onClick={handleStopWebhook}
                    disabled={settingWebhook || !config.botToken}
                    className="px-3.5 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold rounded-xl border border-rose-500/30 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    title="إيقاف Webhook فوراً ومسح طابور التلغرام لإيقاف الرسائل المتكررة تماماً"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span>إيقاف الـ Webhook ومسح الطابور 🛑</span>
                  </button>
                  <button
                    onClick={handleCheckWebhook}
                    disabled={!config.botToken}
                    className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 disabled:opacity-50 cursor-pointer"
                    title="فحص حالة الـ Webhook"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Webhook Details & URL Comparison */}
              {webhookInfo && (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <div><b>حالة Webhook في تلغرام:</b> {webhookInfo.url ? <span className="text-emerald-400">مفعل ✅</span> : <span className="text-amber-400">متوقف (تم مسحه بالكامل) 🛑</span>}</div>
                    {webhookInfo.pending_update_count !== undefined && (
                      <span className={`px-2 py-0.5 rounded text-[10px] ${webhookInfo.pending_update_count > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                        الرسائل المعلقة في الطابور: {webhookInfo.pending_update_count}
                      </span>
                    )}
                  </div>

                  {webhookInfo.url && (
                    <div className="text-[10px] space-y-1">
                      <div className="flex items-start gap-1">
                        <span className="text-slate-400 shrink-0">رابط Webhook المسجل:</span>
                        <span className="text-slate-300 break-all">{webhookInfo.url}</span>
                      </div>
                      {getWebAppUrl() && webhookInfo.url !== getWebAppUrl() && (
                        <div className="p-2 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-sans">
                          ⚠️ <b>تنبيه:</b> رابط Webhook المسجل في تلغرام يختلف عن رابط الـ Web App الحالي في المنصة! اضغط زر <b>(تفعيل / تحديث Webhook 🚀)</b> لتوجيه البوت للرابط الصحيح.
                        </div>
                      )}
                    </div>
                  )}

                  {webhookInfo.last_error_message && (
                    <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-lg text-xs font-sans space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-rose-400">
                        <AlertCircle className="w-4 h-4" />
                        <span>آخر خطأ من تلغرام: {webhookInfo.last_error_message}</span>
                      </div>
                      {webhookInfo.last_error_message.includes('302') && (
                        <p className="text-[11px] text-rose-200/90 leading-relaxed pt-1 border-t border-rose-500/20">
                          💡 <b>سبب الخطأ 302 وحله:</b> خادم Apps Script يطلب إذناً بالدخول أو تم نشره بصلاحية خاصة. لحله: في صفحة Google Apps Script اضغط <b>Deploy</b> ⬅️ <b>Manage deployments</b> ⬅️ اختر تعديل وتأكد أن <b>Who has access</b> مضبوط على <b>Anyone (أي شخص)</b>، ثم أنشئ نسحة نشر جديدة وضع رابطها في إعدادات المنصة.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Simulation Test Button */}
                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 font-sans">
                    <span className="text-[11px] text-slate-400">فحص استجابة السكربت لمحاكاة الطالب:</span>
                    <button
                      onClick={() => handleSimulateWebhook('222', 'حنين')}
                      disabled={simulatingWebhook}
                      className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{simulatingWebhook ? 'جاري المحاكاة...' : 'محاكاة تسجيل طالب (شيت #222) تجريبياً'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Toggles / Switches Section */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <span>مفاتيح تحكم الإشعارات والتنبيهات (Notification Toggles)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">إشعار الأستاذ الخاص</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">إرسال إشعار فوري في خاص الأستاذ عند تسليم أي واجب.</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.enableTeacherPrivate}
                  onChange={e => setConfig({ ...config, enableTeacherPrivate: e.target.checked })}
                  className="w-5 h-5 accent-amber-500 cursor-pointer rounded"
                />
              </div>

              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">إشعار الطالب الخاص</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">إرسال تأكيد تسليم ونتيجة التصحيح والملاحظات للطالب.</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.enableStudentPrivate}
                  onChange={e => setConfig({ ...config, enableStudentPrivate: e.target.checked })}
                  className="w-5 h-5 accent-amber-500 cursor-pointer rounded"
                />
              </div>

              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">إشعار قروب الأساتذة</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">إرسال ملخص تسليم الواجبات في قروب الأساتذة العام.</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.enableGroupNotify}
                  onChange={e => setConfig({ ...config, enableGroupNotify: e.target.checked })}
                  className="w-5 h-5 accent-amber-500 cursor-pointer rounded"
                />
              </div>

              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">إرسال ملفات الوسائط المباشرة</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">إرسال التسجيل الصوتي والصور كملفات مباشرة في تلغرام.</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.sendMediaFiles}
                  onChange={e => setConfig({ ...config, sendMediaFiles: e.target.checked })}
                  className="w-5 h-5 accent-amber-500 cursor-pointer rounded"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {savingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>{savingConfig ? 'جاري الحفظ والمزامنة السحابية...' : 'حفظ وتطبيق إعدادات التلغرام في الشيت 💾'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* 2. BROADCAST SUB-TAB */}
      {activeSubTab === 'broadcast' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
                  <Send className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">لوحة إرسال الرسائل والتنبيهات المخصصة</h3>
                  <p className="text-xs text-slate-400 mt-0.5">أرسل رسالة فورية لطالب محدد، أو للأستاذ، أو لجميع الطلاب دفعة واحدة</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Recipient Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">تحديد المستلم (Recipient):</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setBroadcastRecipient('teacher')}
                    className={`p-3 rounded-2xl border text-xs font-bold transition-all text-center cursor-pointer ${
                      broadcastRecipient === 'teacher'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    👤 خاص الأستاذ
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastRecipient('group')}
                    className={`p-3 rounded-2xl border text-xs font-bold transition-all text-center cursor-pointer ${
                      broadcastRecipient === 'group'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    👥 قروب الأساتذة
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastRecipient('specific_student')}
                    className={`p-3 rounded-2xl border text-xs font-bold transition-all text-center cursor-pointer ${
                      broadcastRecipient === 'specific_student'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    🎓 طالب محدد
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastRecipient('all')}
                    className={`p-3 rounded-2xl border text-xs font-bold transition-all text-center cursor-pointer ${
                      broadcastRecipient === 'all'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    📢 جميع الطلاب
                  </button>
                </div>
              </div>

              {/* Student Dropdown if specific student selected */}
              {broadcastRecipient === 'specific_student' && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">اختر الطالب المستهدف:</label>
                  <select
                    value={targetStudentKey}
                    onChange={e => setTargetStudentKey(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl outline-none text-xs"
                  >
                    <option value="">-- اختر طالباً من القائمة --</option>
                    {uniqueStudents.map((s, idx) => {
                      const key = `${s.name.toLowerCase()}__${s.sheet}`;
                      const isLinked = !!linkedStudents[key]?.chatId;
                      return (
                        <option key={idx} value={key}>
                          {s.name} (شيت #{s.sheet}) {isLinked ? '✅ مرتبط بالتليجرام' : '⚠️ غير مرتبط'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Message Text Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">نص الرسالة أو الشرح:</label>
                <textarea
                  rows={4}
                  value={broadcastText}
                  onChange={e => setBroadcastText(e.target.value)}
                  placeholder="اكتب نص الرسالة هنا... (يمكنك استخدام {student} ليتم استبداله باسم الطالب)"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 focus:border-amber-500 text-slate-100 rounded-xl outline-none text-xs leading-relaxed"
                />
              </div>

              {/* Optional Interactive Button */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">نص الزر التفاعلي (اختياري):</label>
                  <input
                    type="text"
                    value={broadcastBtnLabel}
                    onChange={e => setBroadcastBtnLabel(e.target.value)}
                    placeholder="مثال: 📝 فتح صفحة الدروس"
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">رابط الزر (URL):</label>
                  <input
                    type="url"
                    dir="ltr"
                    value={broadcastBtnUrl}
                    onChange={e => setBroadcastBtnUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl text-xs outline-none font-mono"
                  />
                </div>
              </div>

              {/* Send Button & Result */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <button
                  onClick={handleSendBroadcast}
                  disabled={sendingBroadcast}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {sendingBroadcast ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>إرسال الرسالة عبر التلغرام الآن 🚀</span>
                </button>
              </div>

              {broadcastResult && (
                <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
                  broadcastResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  {broadcastResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{broadcastResult.message}</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* 3. TEMPLATES SUB-TAB */}
      {activeSubTab === 'templates' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">محرر قوالب رسائل التلغرام والترجمة</h3>
                  <p className="text-xs text-slate-400 mt-0.5">خصص نصوص الرسائل التلقائية باللغات العربية والتايلاندية والإنجليزية</p>
                </div>
              </div>

              <button
                onClick={handleResetTemplates}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded-xl border border-slate-700"
              >
                استعادة الافتراضي
              </button>
            </div>

            {/* Template Selector Bar */}
            <div className="flex flex-wrap gap-2">
              {templates.map(tmpl => (
                <button
                  key={tmpl.key}
                  onClick={() => setSelectedTemplateKey(tmpl.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedTemplateKey === tmpl.key
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {tmpl.title}
                </button>
              ))}
            </div>

            {/* Active Template Editor */}
            {activeTemplate && (
              <div className="space-y-4 p-5 bg-slate-900/60 border border-slate-800 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-amber-400">{activeTemplate.title}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{activeTemplate.description}</p>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    المتغيرات المتاحة: {activeTemplate.variables.join(' ، ')}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                      <span>🇸🇦 النص باللغة العربية (Arabic):</span>
                    </label>
                    <textarea
                      rows={4}
                      value={activeTemplate.ar}
                      onChange={e => updateTemplateField(activeTemplate.key, 'ar', e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl text-xs outline-none leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                      <span>🇹🇭 النص باللغة التايلاندية (Thai):</span>
                    </label>
                    <textarea
                      rows={4}
                      value={activeTemplate.th}
                      onChange={e => updateTemplateField(activeTemplate.key, 'th', e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl text-xs outline-none leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                      <span>🇬🇧 النص باللغة الإنجليزية (English):</span>
                    </label>
                    <textarea
                      rows={4}
                      value={activeTemplate.en}
                      onChange={e => updateTemplateField(activeTemplate.key, 'en', e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl text-xs outline-none leading-relaxed"
                    />
                  </div>
                </div>

                {/* Optional Interactive Button Configuration */}
                <div className="p-4 bg-slate-950 border border-amber-500/25 rounded-xl space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <LinkIcon className="w-4 h-4" />
                      <span>زر تفاعلي مدمج في الرسالة (Inline Button URL):</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      اختياري • يدعم المتغيرات مثل &#123;sheet&#125;
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      رابط الزر (URL) — اتركه فارغاً إذا كنت لا تريد إرفاق زر:
                    </label>
                    <input
                      type="url"
                      value={activeTemplate.buttonUrl || ''}
                      onChange={e => updateTemplateField(activeTemplate.key, 'buttonUrl', e.target.value)}
                      placeholder="مثال: https://docs.google.com/spreadsheets/d/.../edit أو https://mysite.com?sheet={sheet}"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl text-xs outline-none font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        🇸🇦 نص الزر (بالعربية):
                      </label>
                      <input
                        type="text"
                        value={activeTemplate.buttonTextAr || ''}
                        onChange={e => updateTemplateField(activeTemplate.key, 'buttonTextAr', e.target.value)}
                        placeholder="🔗 فتح ملف الواجب"
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-200 rounded-xl text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        🇹🇭 نص الزر (بالتايلاندية):
                      </label>
                      <input
                        type="text"
                        value={activeTemplate.buttonTextTh || ''}
                        onChange={e => updateTemplateField(activeTemplate.key, 'buttonTextTh', e.target.value)}
                        placeholder="🔗 เปิดไฟล์การบ้าน"
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-200 rounded-xl text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        🇬🇧 نص الزر (بالإنجليزية):
                      </label>
                      <input
                        type="text"
                        value={activeTemplate.buttonTextEn || ''}
                        onChange={e => updateTemplateField(activeTemplate.key, 'buttonTextEn', e.target.value)}
                        placeholder="🔗 View Homework File"
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-200 rounded-xl text-xs outline-none"
                      />
                    </div>
                  </div>

                  {activeTemplate.buttonUrl && (
                    <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-200">
                      <span>معاينة الزر:</span>
                      <span className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg shadow-sm">
                        {activeTemplate.buttonTextAr || activeTemplate.buttonTextEn || '🔗 فتح الرابط'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSaveTemplates}
                    disabled={savingTemplates}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {savingTemplates ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{savingTemplates ? 'جاري الحفظ في الشيت...' : 'حفظ ومزامنة القوالب مع Google Sheets 💾'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* 4. USERS & LINKING DIRECTORY SUB-TAB */}
      {activeSubTab === 'users' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-2xl border border-sky-500/20">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">دليل الطلاب وحالة ربط التلغرام</h3>
                  <p className="text-xs text-slate-400 mt-0.5">قائمة بجميع الطلاب المسجلين وحالة ربط حساباتهم بالتلغرام واللغة المحددة للإشعارات</p>
                </div>
              </div>
            </div>

            {/* Students List Table */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-300">قائمة الطلاب وحالة ربط التلغرام:</h4>
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full text-[10px]">
                    {uniqueStudents.length} طالب
                  </span>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[10px] text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>مزامنة حية نشطة</span>
                    {lastSyncedTime && (
                      <span className="text-slate-400 text-[9px] mr-1">({lastSyncedTime})</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSyncStudentsFromSheet}
                    disabled={syncingSheetStudents || isAutoSyncing}
                    className="px-3 py-1.5 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingSheetStudents || isAutoSyncing ? 'animate-spin' : ''}`} />
                    <span>مزامنة فورية 🔄</span>
                  </button>
                  <input
                    type="text"
                    value={searchStudent}
                    onChange={e => setSearchStudent(e.target.value)}
                    placeholder="بحث عن طالب..."
                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl outline-none w-44"
                  />
                </div>
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">اسم الطالب</th>
                      <th className="p-3 text-center">رقم الشيت</th>
                      <th className="p-3 text-center">معرّف التليجرام (Chat ID)</th>
                      <th className="p-3 text-center">اللغة المفعلة</th>
                      <th className="p-3 text-center">حالة الربط</th>
                      <th className="p-3 text-center">إجراءات واختبارات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/60">
                    {uniqueStudents
                      .filter(s => !searchStudent || s.name.toLowerCase().includes(searchStudent.toLowerCase()))
                      .map((s, idx) => {
                        const key = `${s.name.toLowerCase()}__${s.sheet}`;
                        const binding = linkedStudents[key];
                        return (
                          <tr key={idx} className="hover:bg-slate-900/50">
                            <td className="p-3 font-bold text-slate-200">{s.name}</td>
                            <td className="p-3 text-center font-mono text-slate-400">#{s.sheet}</td>
                            <td className="p-3 text-center font-mono text-slate-300">
                              {binding?.chatId || <span className="text-slate-600">-</span>}
                            </td>
                            <td className="p-3 text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-900 border border-slate-800 text-slate-200 shadow-sm">
                                {formatLanguageBadge(binding?.language || (binding as any)?.rawLanguage || 'ar')}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {binding?.chatId ? (
                                <span className="px-2.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-full font-bold text-[10px]">
                                  مفعل ✅
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 bg-slate-800 text-slate-400 rounded-full text-[10px]">
                                  بانتظار الاشتراك
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleSimulateWebhook(s.sheet, s.name)}
                                  disabled={simulatingWebhook}
                                  className="px-2 py-1 bg-sky-600/20 hover:bg-sky-600/35 text-sky-300 border border-sky-500/30 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  title="إرسال محاكاة فورية لتسجيل هذا الطالب إلى السكربت والشيت"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>محاكاة ربط</span>
                                </button>
                                {binding?.chatId && (
                                  <button
                                    onClick={async () => {
                                      removeLinkedTelegramStudent(s.name, s.sheet);
                                      setLinkedStudents(getLinkedTelegramStudents());
                                      onNotify(`تم إلغاء ربط ${s.name}`, 'success');
                                    }}
                                    className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 rounded-lg text-[10px] font-bold cursor-pointer"
                                    title="إلغاء ربط الطالب"
                                  >
                                    إلغاء
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 5. GUIDE & BACKEND CODE SUB-TAB */}
      {activeSubTab === 'guide' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">هيكل الأوراق وشرح الربط في Google Sheets</h3>
                  <p className="text-xs text-slate-400 mt-0.5">تفاصيل أسماء أوراق العمل وكيفية عمل سكربت التلغرام البرمجي</p>
                </div>
              </div>
            </div>

            {/* Sheets Structure Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-400 font-mono text-sm">1. Telegram_Config</span>
                  <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">الإعدادات العامة</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  ورقة مفاتيح التشغيل: تتضمن <code>BOT_TOKEN</code>، <code>TEACHER_CHAT_ID</code>، <code>GROUP_CHAT_ID</code>، ومفاتيح التفعيل (نعم/لا).
                </p>
              </div>

              <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-400 font-mono text-sm">2. Telegram_Users</span>
                  <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">دليل الطلاب</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  يتم حفظ معرف الطالب <code>Telegram Chat ID</code>، اسمه، رقم الشيت، ولغته تلقائياً عند ضغطه على رابط البوت.
                </p>
              </div>

              <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-400 font-mono text-sm">3. Telegram_Templates</span>
                  <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">قوالب الرسائل</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  نصوص الرسائل التلقائية بثلاث لغات (العربية، التايلاندية، الإنجليزية) مع المتغيرات الديناميكية <code>{'{student}'}</code> و <code>{'{lesson}'}</code>.
                </p>
              </div>

              <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-400 font-mono text-sm">4. Telegram_Broadcast</span>
                  <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">لوحة الإرسال</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  إرسال رسائل خاصة أو جماعية مع أزرار وروابط تفاعلية من داخل الشيت أو من المنصة مباشرة.
                </p>
              </div>
            </div>

            {/* Quick Steps Checklist */}
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>خطوات تطبيق وتجربة الربط بالتفصيل:</span>
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300 leading-relaxed">
                <li>افتح تطبيق تلغرام وابحث عن <b>@BotFather</b> وأرسل أمر <code>/newbot</code> ثم انسخ الـ <b>Bot Token</b>.</li>
                <li>ضع التوكن في تبويب <b>إعدادات البوت والربط</b> واضغط <b>فحص البوت</b>.</li>
                <li>افتح محادثة مع البوت الخاص بك واضغط <b>Start</b> أو أرسل كلمة ترحيبية.</li>
                <li>اضغط على زر <b>جلب معرفات الدردشة الأخيرة</b> ليظهر لك معرفك <code>Chat ID</code> واضغط <b>تعيين كأستاذ</b>.</li>
                <li>(اختياري للقروب): أضف البوت كعضو في قروب الأساتذة، ثم اضغط جلب المعرفات واختر <b>تعيين كقروب</b>.</li>
                <li>لتجربة الإرسال: اذهب إلى تبويب <b>إرسال رسائل وتنبيهات</b>، اكتب نصاً واضغط إرسال وستصلك فوراً على هاتفك! 🚀</li>
              </ol>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
