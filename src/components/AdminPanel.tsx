import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Search, Plus, Edit, BookOpen, GraduationCap, Save, 
  RefreshCw, CheckCircle2, AlertCircle, Video, Volume2, 
  Mic, Image as ImageIcon, ShieldCheck, Lock,
  Trash2, ChevronDown, ChevronUp, Link as LinkIcon, Settings as SettingsIcon,
  HelpCircle, MessageSquare, Calendar, Clock, Eye, EyeOff,
  UserCheck, Users, UserPlus, User, ChevronLeft, Edit3, Sparkles, Globe, Send, Bot,
  FileSpreadsheet
} from 'lucide-react';
import { AdminQuestionRow, AdminAnswerRow, AdminQuestionItem } from '../types';
import TranslationEditor from './TranslationEditor';
import TelegramManager from './TelegramManager';
import { 
  fetchAdminQuestions, saveAdminQuestion, deleteAdminQuestion, fetchAdminAnswers, 
  updateAdminAnswer, saveBatchAdminQuestions,
  getStudentCustomSchedulesMap, saveStudentCustomSchedule, deleteStudentCustomSchedule,
  getGeneralAutoScheduleConfig, saveGeneralAutoScheduleConfig,
  StudentCustomScheduleData, sanitizeQuestions, sanitizeLessonQuestions,
  fetchSettingsStudentsFromSheet
} from '../api';

interface AdminPanelProps {
  onClose: () => void;
}

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'questions' | 'answers' | 'translations' | 'telegram'>('questions');

  // Questions state
  const [questions, setQuestions] = useState<AdminQuestionRow[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionSearch, setQuestionSearch] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<AdminQuestionRow | null>(null);
  const [modalSubTab, setModalSubTab] = useState<'links' | 'schedule' | 'settings' | 'questions'>('links');
  const [expandedVideoIndex, setExpandedVideoIndex] = useState<number | null>(0);
  const [expandedAudioIndex, setExpandedAudioIndex] = useState<number | null>(0);
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Answers state
  const [answers, setAnswers] = useState<AdminAnswerRow[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [answerSearch, setAnswerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [editingAnswer, setEditingAnswer] = useState<AdminAnswerRow | null>(null);
  const [savingAnswer, setSavingAnswer] = useState(false);

  // Global notice state
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Delete modal state
  const [deletingQuestionRow, setDeletingQuestionRow] = useState<AdminQuestionRow | null>(null);

  // Auto Schedule Generator state
  const savedGeneralConfig = getGeneralAutoScheduleConfig();
  const [showAutoScheduleModal, setShowAutoScheduleModal] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>(() => {
    return savedGeneralConfig?.selectedDays || [1, 3, 5];
  });
  const [autoStartDate, setAutoStartDate] = useState<string>(() => {
    if (savedGeneralConfig?.autoStartDate) return savedGeneralConfig.autoStartDate;
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day} 08:00`;
  });
  const [lessonsPerDay, setLessonsPerDay] = useState<number>(() => {
    return savedGeneralConfig?.lessonsPerDay !== undefined ? savedGeneralConfig.lessonsPerDay : 2;
  });
  const [autoHideMode, setAutoHideMode] = useState<'days' | 'unifiedDate' | 'none'>(() => {
    return savedGeneralConfig?.autoHideMode || 'days';
  });
  const [autoExpireAfterDays, setAutoExpireAfterDays] = useState<number | string>(() => {
    return savedGeneralConfig?.autoExpireAfterDays !== undefined ? savedGeneralConfig.autoExpireAfterDays : 4;
  });
  const [autoUnifiedEndDate, setAutoUnifiedEndDate] = useState<string>(() => {
    return savedGeneralConfig?.autoUnifiedEndDate || '';
  });
  const [applyingAutoSchedule, setApplyingAutoSchedule] = useState(false);

  // Student Custom Schedule Generator State
  const [showStudentCustomScheduleModal, setShowStudentCustomScheduleModal] = useState(false);
  const [selectedStudentForSchedule, setSelectedStudentForSchedule] = useState<string | null>(null);
  const [selectedStudentSheetForSchedule, setSelectedStudentSheetForSchedule] = useState<string>('');
  const [studentScheduleSearch, setStudentScheduleSearch] = useState('');
  const [manualStudentInput, setManualStudentInput] = useState('');
  const [manualStudentSheetInput, setManualStudentSheetInput] = useState('');
  const [settingsStudents, setSettingsStudents] = useState<Array<{ name: string; sheet: string }>>(() => {
    try {
      const cached = localStorage.getItem('cached_settings_students');
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    } catch (e) {
      return [];
    }
  });
  const [loadingSettingsStudents, setLoadingSettingsStudents] = useState(false);
  const [studentSelectedDays, setStudentSelectedDays] = useState<number[]>([1, 3, 5]);
  const [studentStartDate, setStudentStartDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day} 08:00`;
  });
  const [studentLessonsPerDay, setStudentLessonsPerDay] = useState<number>(2);
  const [studentAutoHideMode, setStudentAutoHideMode] = useState<'days' | 'unifiedDate' | 'none'>('days');
  const [studentAutoExpireAfterDays, setStudentAutoExpireAfterDays] = useState<number | string>(4);
  const [studentAutoUnifiedEndDate, setStudentAutoUnifiedEndDate] = useState<string>('');
  const [customSchedulesMap, setCustomSchedulesMap] = useState<Record<string, StudentCustomScheduleData>>(() => getStudentCustomSchedulesMap());

  const refreshCustomSchedulesMap = () => {
    setCustomSchedulesMap(getStudentCustomSchedulesMap());
  };

  const loadSettingsStudentsList = async () => {
    setLoadingSettingsStudents(true);
    try {
      const res = await fetchSettingsStudentsFromSheet();
      if (res.success && res.students && res.students.length > 0) {
        setSettingsStudents(res.students);
      }
    } catch (err) {
      console.error('Error loading settings students:', err);
    } finally {
      setLoadingSettingsStudents(false);
    }
  };

  useEffect(() => {
    if (showStudentCustomScheduleModal) {
      loadSettingsStudentsList();
    }
  }, [showStudentCustomScheduleModal]);

  // Combine all students prioritizing Settings sheet (Column B: رقم الطالب, Column C: اسم الطالب)
  const allKnownStudents = (() => {
    const map = new Map<string, { name: string; sheet: string }>();

    // 1) Primary and authoritative source: Settings Sheet (Column B: رقم الطالب, Column C: اسم الطالب)
    if (Array.isArray(settingsStudents)) {
      settingsStudents.forEach(st => {
        if (!st) return;
        const name = (st.name || '').trim();
        const sheet = (st.sheet || '').trim();
        if (name || sheet) {
          const key = `${name.toLowerCase()}__${sheet.toLowerCase()}`;
          map.set(key, { name: name || `طالب (${sheet})`, sheet });
        }
      });
    }

    // 2) Existing custom schedules
    if (customSchedulesMap && typeof customSchedulesMap === 'object') {
      Object.keys(customSchedulesMap).forEach(k => {
        const c = customSchedulesMap[k];
        if (c && (c.username || c.sheetNumber)) {
          const name = (c.username || '').trim();
          const sheet = (c.sheetNumber || '').trim();
          const key = `${name.toLowerCase()}__${sheet.toLowerCase()}`;
          if (!map.has(key)) {
            map.set(key, { name: name || `طالب (${sheet})`, sheet });
          }
        }
      });
    }

    // 3) Answers (if any not already in settings)
    if (Array.isArray(answers)) {
      answers.forEach(a => {
        if (!a) return;
        const name = (a.username || '').trim();
        const sheet = (a.sheetNumber || '').trim();
        if (name || sheet) {
          const key = `${name.toLowerCase()}__${sheet.toLowerCase()}`;
          if (!map.has(key)) {
            map.set(key, { name: name || `طالب (${sheet})`, sheet });
          }
        }
      });
    }

    return Array.from(map.values());
  })();

  const handleSelectStudentForSchedule = (username: string, sheetNum?: string) => {
    const cleanName = username.trim();
    let cleanSheet = sheetNum ? sheetNum.trim() : '';
    if (!cleanName && !cleanSheet) return;

    if (!cleanSheet) {
      const found = allKnownStudents.find(s => s.name.trim().toLowerCase() === cleanName.toLowerCase());
      if (found) cleanSheet = found.sheet.trim();
    }

    const displayName = cleanName || `طالب رقم ${cleanSheet}`;
    setSelectedStudentForSchedule(displayName);
    setSelectedStudentSheetForSchedule(cleanSheet);

    const existing = (cleanName ? customSchedulesMap[cleanName.toLowerCase()] : undefined) ||
                     (cleanSheet ? customSchedulesMap[cleanSheet.toLowerCase()] : undefined);

    if (existing && existing.config) {
      setStudentSelectedDays(existing.config.selectedDays || [1, 3, 5]);
      setStudentStartDate(existing.config.startDate || autoStartDate);
      setStudentLessonsPerDay(existing.config.lessonsPerDay || 2);
      setStudentAutoHideMode(existing.config.autoHideMode || 'days');
      setStudentAutoExpireAfterDays(existing.config.autoExpireAfterDays !== undefined ? existing.config.autoExpireAfterDays : 4);
      setStudentAutoUnifiedEndDate(existing.config.autoUnifiedEndDate || '');
    } else {
      setStudentSelectedDays([1, 3, 5]);
      setStudentStartDate(autoStartDate);
      setStudentLessonsPerDay(2);
      setStudentAutoHideMode('days');
      setStudentAutoExpireAfterDays(4);
      setStudentAutoUnifiedEndDate('');
    }
  };

  const calculateStudentAutoSchedule = (): AdminQuestionRow[] => {
    if (!questions || questions.length === 0) return [];
    const activeDays = studentSelectedDays.length > 0 ? studentSelectedDays : [0, 1, 2, 3, 4, 5, 6];

    let baseDate = new Date();
    if (studentStartDate && studentStartDate.trim()) {
      const parsed = new Date(studentStartDate.replace(' ', 'T'));
      if (!isNaN(parsed.getTime())) {
        baseDate = parsed;
      }
    }

    let hh = String(baseDate.getHours()).padStart(2, '0');
    let mm = String(baseDate.getMinutes()).padStart(2, '0');

    let currentDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    while (!activeDays.includes(currentDate.getDay())) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const perDay = Math.max(1, studentLessonsPerDay || 1);
    const updatedList: AdminQuestionRow[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      if (i > 0 && i % perDay === 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        while (!activeDays.includes(currentDate.getDay())) {
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      const y = currentDate.getFullYear();
      const m = String(currentDate.getMonth() + 1).padStart(2, '0');
      const d = String(currentDate.getDate()).padStart(2, '0');
      const computedStart = `${y}-${m}-${d} ${hh}:${mm}`;

      let computedExpireDays: number | string = '';
      let computedEnd = '';

      if (studentAutoHideMode === 'days') {
        computedExpireDays = studentAutoExpireAfterDays !== '' ? studentAutoExpireAfterDays : '';
        computedEnd = '';
      } else if (studentAutoHideMode === 'unifiedDate') {
        computedExpireDays = '';
        computedEnd = studentAutoUnifiedEndDate;
      } else {
        computedExpireDays = '';
        computedEnd = '';
      }

      updatedList.push({
        ...q,
        startDate: computedStart,
        endDate: computedEnd,
        expireAfterDays: computedExpireDays
      });
    }

    return updatedList;
  };

  const handleSaveStudentCustomSchedule = () => {
    if (!selectedStudentForSchedule) return;
    if (studentSelectedDays.length === 0) {
      alert('يرجى اختيار يوم واحد على الأقل من أيام الأسبوع.');
      return;
    }
    const calculated = calculateStudentAutoSchedule();
    const scheduleItems = calculated.map(q => ({
      word: q.word,
      comment: q.comment,
      startDate: q.startDate || '',
      endDate: q.endDate || '',
      expireAfterDays: q.expireAfterDays !== undefined ? q.expireAfterDays : ''
    }));

    const data: StudentCustomScheduleData = {
      username: selectedStudentForSchedule,
      sheetNumber: selectedStudentSheetForSchedule,
      updatedAt: new Date().toISOString(),
      config: {
        selectedDays: studentSelectedDays,
        startDate: studentStartDate,
        lessonsPerDay: studentLessonsPerDay,
        autoHideMode: studentAutoHideMode,
        autoExpireAfterDays: studentAutoExpireAfterDays,
        autoUnifiedEndDate: studentAutoUnifiedEndDate
      },
      schedule: scheduleItems
    };

    saveStudentCustomSchedule(selectedStudentForSchedule, data);
    refreshCustomSchedulesMap();
    setNotice({
      text: `تم حفظ وتفعيل الجدول الخاص للطالب (${selectedStudentForSchedule}${selectedStudentSheetForSchedule ? ` - رقم ${selectedStudentSheetForSchedule}` : ''}) لـ ${scheduleItems.length} درس بنجاح! ⚡`,
      type: 'success'
    });
    setSelectedStudentForSchedule(null);
    setSelectedStudentSheetForSchedule('');
  };

  const handleDeleteStudentCustomSchedule = (username: string, sheetNum?: string) => {
    deleteStudentCustomSchedule(username, sheetNum);
    refreshCustomSchedulesMap();
    setNotice({
      text: `تم إلغاء الجدول الخاص للطالب (${username}) وإعادته للجدول العام.`,
      type: 'success'
    });
  };

  // Days list for UI selection
  const DAYS_LIST = [
    { id: 0, name: 'الأحد', short: 'أحد' },
    { id: 1, name: 'الإثنين', short: 'إثنين' },
    { id: 2, name: 'الثلاثاء', short: 'ثلاثاء' },
    { id: 3, name: 'الأربعاء', short: 'أربعاء' },
    { id: 4, name: 'الخميس', short: 'خميس' },
    { id: 5, name: 'الجمعة', short: 'جمعة' },
    { id: 6, name: 'السبت', short: 'سبت' },
  ];

  // Calculation logic for Auto Schedule
  const calculateAutoSchedule = (): AdminQuestionRow[] => {
    if (!questions || questions.length === 0) return [];
    const activeDays = selectedDays.length > 0 ? selectedDays : [0, 1, 2, 3, 4, 5, 6];

    let baseDate = new Date();
    if (autoStartDate && autoStartDate.trim()) {
      const parsed = new Date(autoStartDate.replace(' ', 'T'));
      if (!isNaN(parsed.getTime())) {
        baseDate = parsed;
      }
    }

    let hh = String(baseDate.getHours()).padStart(2, '0');
    let mm = String(baseDate.getMinutes()).padStart(2, '0');

    let currentDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    // Move currentDate to the first active day starting on or after baseDate
    while (!activeDays.includes(currentDate.getDay())) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const perDay = Math.max(1, lessonsPerDay || 1);
    const updatedList: AdminQuestionRow[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      if (i > 0 && i % perDay === 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        while (!activeDays.includes(currentDate.getDay())) {
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      const y = currentDate.getFullYear();
      const m = String(currentDate.getMonth() + 1).padStart(2, '0');
      const d = String(currentDate.getDate()).padStart(2, '0');
      const computedStart = `${y}-${m}-${d} ${hh}:${mm}`;

      let computedExpireDays: number | string = '';
      let computedEnd = '';

      if (autoHideMode === 'days') {
        computedExpireDays = autoExpireAfterDays !== '' ? autoExpireAfterDays : '';
        computedEnd = '';
      } else if (autoHideMode === 'unifiedDate') {
        computedExpireDays = '';
        computedEnd = autoUnifiedEndDate;
      } else {
        computedExpireDays = '';
        computedEnd = '';
      }

      const { cleanQuestions, cleanAudioQuestions } = sanitizeLessonQuestions(q.questions, q.audioQuestions);

      updatedList.push({
        ...q,
        questions: cleanQuestions,
        audioQuestions: cleanAudioQuestions,
        startDate: computedStart,
        endDate: computedEnd,
        expireAfterDays: computedExpireDays
      });
    }

    return updatedList;
  };

  // Handler to apply schedule to all lessons
  const handleApplyAutoSchedule = async () => {
    if (selectedDays.length === 0) {
      setNotice({ text: 'يرجى اختيار يوم واحد على الأقل من أيام الأسبوع.', type: 'error' });
      return;
    }
    const updatedList = calculateAutoSchedule();
    if (updatedList.length === 0) {
      setNotice({ text: 'لا توجد دروس حالياً لبرمجتها.', type: 'error' });
      return;
    }

    setApplyingAutoSchedule(true);
    try {
      saveGeneralAutoScheduleConfig({
        selectedDays,
        autoStartDate,
        lessonsPerDay,
        autoHideMode,
        autoExpireAfterDays,
        autoUnifiedEndDate
      });
      await saveBatchAdminQuestions(updatedList);
      setQuestions(updatedList);
      setNotice({
        text: `تم تطبيق وحفظ جدول المواعيد التلقائي على جميع الدروس (${updatedList.length} درس) بنجاح! 🎉`,
        type: 'success'
      });
      setShowAutoScheduleModal(false);
      setConfirmingClear(false);
    } catch (err: any) {
      console.error(err);
      setNotice({ text: 'خطأ أثناء تطبيق جدول المواعيد: ' + (err.message || ''), type: 'error' });
    } finally {
      setApplyingAutoSchedule(false);
    }
  };

  // Handler to clear all schedules (dates DB:DD) for all lessons
  const handleClearAllSchedules = async () => {
    if (questions.length === 0) return;

    const clearedList: AdminQuestionRow[] = questions.map(q => ({
      ...q,
      startDate: '',
      endDate: '',
      expireAfterDays: ''
    }));

    setApplyingAutoSchedule(true);
    try {
      await saveBatchAdminQuestions(clearedList);
      setQuestions(clearedList);
      setNotice({
        text: `تم مسح وإزالة جميع مواعيد الدروس العامة (${clearedList.length} درس) بنجاح! 🗑️`,
        type: 'success'
      });
      setShowAutoScheduleModal(false);
      setConfirmingClear(false);
    } catch (err: any) {
      console.error(err);
      setNotice({ text: 'خطأ أثناء مسح مواعيد الدروس: ' + (err.message || ''), type: 'error' });
    } finally {
      setApplyingAutoSchedule(false);
    }
  };

  useEffect(() => {
    loadQuestionsData();
    loadAnswersData();
  }, []);

  const loadQuestionsData = async () => {
    setLoadingQuestions(true);
    try {
      const data = await fetchAdminQuestions();
      setQuestions(data);
    } catch (err: any) {
      console.error(err);
      setNotice({ text: 'فشل تحميل بيانات ورقة الأسئلة Questions', type: 'error' });
    } finally {
      setLoadingQuestions(false);
    }
  };

  const loadAnswersData = async () => {
    setLoadingAnswers(true);
    try {
      const data = await fetchAdminAnswers();
      setAnswers(data);
    } catch (err: any) {
      console.error(err);
      setNotice({ text: 'فشل تحميل بيانات ورقة الإجابات Answers', type: 'error' });
    } finally {
      setLoadingAnswers(false);
    }
  };

  // Filtered Questions
  const filteredQuestions = questions.filter(q => {
    const query = questionSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      (q.word && q.word.toLowerCase().includes(query)) ||
      (q.comment && q.comment.toLowerCase().includes(query))
    );
  });

  // Filtered Answers
  const filteredAnswers = answers.filter(a => {
    const query = answerSearch.trim().toLowerCase();
    const matchesQuery = !query || (
      (a.username && a.username.toLowerCase().includes(query)) ||
      (a.sheetNumber && a.sheetNumber.toLowerCase().includes(query)) ||
      (a.comment && a.comment.toLowerCase().includes(query))
    );

    const matchesStatus = 
      statusFilter === 'all' ? true :
      statusFilter === 'completed' ? (a.completed === 'تم') :
      (a.completed !== 'تم');

    return matchesQuery && matchesStatus;
  });

  // Handle Save Question
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;

    if (!editingQuestion.comment.trim() || !editingQuestion.word.trim()) {
      alert('يرجى كتابة عنوان الدرس (الكلمة) والمعرف الربطي للدرس على الأقل.');
      return;
    }

    setSavingQuestion(true);
    try {
      await saveAdminQuestion(editingQuestion);
      setNotice({ text: 'تم حفظ بيانات الدرس والأسئلة بنجاح في ورقة Questions! 🎉', type: 'success' });
      setEditingQuestion(null);
      await loadQuestionsData();
    } catch (err: any) {
      console.error(err);
      setNotice({ text: 'خطأ أثناء حفظ الدرس: ' + (err.message || ''), type: 'error' });
    } finally {
      setSavingQuestion(false);
    }
  };

  // Handle Delete Question Topic
  const handleDeleteQuestion = (q: AdminQuestionRow) => {
    setDeletingQuestionRow(q);
  };

  const confirmDeleteQuestion = async () => {
    if (!deletingQuestionRow) return;
    const q = deletingQuestionRow;
    setDeletingQuestionRow(null);
    setLoadingQuestions(true);
    try {
      await deleteAdminQuestion({ rowIndex: q.rowIndex, comment: q.comment });
      setNotice({ text: `تم حذف الدرس (${q.comment || q.word}) بنجاح! 🎉`, type: 'success' });
      await loadQuestionsData();
    } catch (err: any) {
      console.error(err);
      setNotice({ text: 'خطأ أثناء حذف الدرس: ' + (err.message || ''), type: 'error' });
      setLoadingQuestions(false);
    }
  };

  // Handle Save Answer Update
  const handleSaveAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnswer) return;

    setSavingAnswer(true);
    try {
      await updateAdminAnswer({
        rowIndex: editingAnswer.rowIndex,
        sheetNumber: editingAnswer.sheetNumber,
        username: editingAnswer.username,
        comment: editingAnswer.comment,
        videoAnswersResult: editingAnswer.videoAnswersResult,
        audioAnswersResult: editingAnswer.audioAnswersResult,
        finalResult: editingAnswer.finalResult,
        audioUploadCount: editingAnswer.audioUploadCount,
        imageUploadCount: editingAnswer.imageUploadCount,
        completed: editingAnswer.completed,
        retryResetCount: editingAnswer.retryResetCount,
      });
      setNotice({ text: 'تم تحديث بيانات الطالب بنجاح! 🎉', type: 'success' });
      setEditingAnswer(null);
      await loadAnswersData();
    } catch (err: any) {
      console.error(err);
      setNotice({ text: 'خطأ أثناء تحديث بيانات الطالب: ' + (err.message || ''), type: 'error' });
    } finally {
      setSavingAnswer(false);
    }
  };

  const handleCreateNewQuestion = () => {
    setEditingQuestion({
      word: '',
      comment: '',
      youtubeUrl: '',
      explainSound: '',
      fullSound: '',
      rawLinks: '',
      image: '',
      totalQuestionsCount: 15,
      showResult: 'نعم',
      instruction: '',
      allowRecording: 'لا',
      maxRecordingTime: 10,
      retryCount: 1,
      allowUpload: 'لا',
      defaultRetryResetCount: 1,
      startDate: '',
      endDate: '',
      expireAfterDays: '',
      questions: [],
      audioQuestions: [],
    });
    setModalSubTab('links');
  };

  // Question manipulation helpers
  const addVideoQuestion = () => {
    if (!editingQuestion) return;
    const current = editingQuestion.questions || [];
    if (current.length >= 15) {
      alert('الحد الأقصى لأسئلة الفيديو هو 15 سؤالاً.');
      return;
    }
    const newQ: AdminQuestionItem = {
      time: 0,
      image: '',
      question: '',
      options: 'نص',
      correctAnswer: '',
    };
    const updated = [...current, newQ];
    setEditingQuestion({ ...editingQuestion, questions: updated });
    setExpandedVideoIndex(updated.length - 1);
  };

  const removeVideoQuestion = (idx: number) => {
    if (!editingQuestion) return;
    const current = editingQuestion.questions || [];
    const updated = current.filter((_, i) => i !== idx);
    setEditingQuestion({ ...editingQuestion, questions: updated });
  };

  const updateVideoQuestion = (idx: number, field: keyof AdminQuestionItem, value: any) => {
    if (!editingQuestion) return;
    const current = editingQuestion.questions || [];
    const updated = [...current];
    updated[idx] = { ...updated[idx], [field]: value };
    setEditingQuestion({ ...editingQuestion, questions: updated });
  };

  const addAudioQuestion = () => {
    if (!editingQuestion) return;
    const current = editingQuestion.audioQuestions || [];
    if (current.length >= 2) {
      alert('الحد الأقصى لأسئلة الصوت هو سؤالان فقط.');
      return;
    }
    const newQ: AdminQuestionItem = {
      time: 0,
      image: '',
      question: '',
      options: 'نص',
      correctAnswer: '',
    };
    const updated = [...current, newQ];
    setEditingQuestion({ ...editingQuestion, audioQuestions: updated });
    setExpandedAudioIndex(updated.length - 1);
  };

  const removeAudioQuestion = (idx: number) => {
    if (!editingQuestion) return;
    const current = editingQuestion.audioQuestions || [];
    const updated = current.filter((_, i) => i !== idx);
    setEditingQuestion({ ...editingQuestion, audioQuestions: updated });
  };

  const updateAudioQuestion = (idx: number, field: keyof AdminQuestionItem, value: any) => {
    if (!editingQuestion) return;
    const current = editingQuestion.audioQuestions || [];
    const updated = [...current];
    updated[idx] = { ...updated[idx], [field]: value };
    setEditingQuestion({ ...editingQuestion, audioQuestions: updated });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="w-full max-w-5xl h-[92vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden relative text-slate-100"
      >
        {/* Top Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
                <span>قسم التحكم الإداري</span>
                <span className="text-xs px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-full font-bold">إدارة الشيت</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">التحكم المباشر في ورقة الأسئلة (Questions) وورقة إجابات الطلاب (Answers)</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl transition-all cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Notice Alert */}
        {notice && (
          <div className="p-3 px-6 shrink-0">
            <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
              notice.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span className="font-bold">{notice.text}</span>
              </div>
              <button onClick={() => setNotice(null)} className="text-xs underline cursor-pointer">إغلاق</button>
            </div>
          </div>
        )}

        {/* Tab Switcher Header */}
        <div className="px-4 sm:px-6 pt-3 bg-slate-950/30 border-b border-slate-800 flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-5 py-3 rounded-t-2xl font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'questions'
                ? 'bg-slate-900 text-amber-400 border-amber-500 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>ورقة الأسئلة (Questions)</span>
            <span className="px-2 py-0.5 text-[10px] bg-slate-800 rounded-full font-mono">{questions.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('answers')}
            className={`px-5 py-3 rounded-t-2xl font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'answers'
                ? 'bg-slate-900 text-amber-400 border-amber-500 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>ورقة الإجابات والطلاب (Answers)</span>
            <span className="px-2 py-0.5 text-[10px] bg-slate-800 rounded-full font-mono">{answers.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('translations')}
            className={`px-5 py-3 rounded-t-2xl font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'translations'
                ? 'bg-slate-900 text-amber-400 border-amber-500 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>محرر نصوص الواجهة والترجمة 🇸🇦🇹🇭🇬🇧</span>
          </button>

          <button
            onClick={() => setActiveTab('telegram')}
            className={`px-5 py-3 rounded-t-2xl font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'telegram'
                ? 'bg-slate-900 text-amber-400 border-amber-500 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Send className="w-4 h-4 text-sky-400" />
            <span>ربط التلغرام والإشعارات ✈️</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-grow overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {/* TAB 1: QUESTIONS SHEET */}
          {activeTab === 'questions' && (
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                {/* Search */}
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                    placeholder="بحث بعنوان الدرس أو المعرف الربطي..."
                    className="w-full pr-10 pl-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500/50"
                  />
                </div>

                {/* Refresh, Auto Schedule, Custom Student Schedule, and Add button */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={loadQuestionsData}
                    disabled={loadingQuestions}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                    title="تحديث القائمة"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingQuestions ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    onClick={() => setShowAutoScheduleModal(true)}
                    className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 cursor-pointer transition-all active:scale-98"
                    title="برمجة تواريخ ظهور وإخفاء جميع الدروس تلقائياً لجميع الطلاب بحسب أيام الأسبوع"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>مولّد جدول الدروس التلقائي (عام)</span>
                  </button>

                  <button
                    onClick={() => {
                      refreshCustomSchedulesMap();
                      setSelectedStudentForSchedule(null);
                      setShowStudentCustomScheduleModal(true);
                    }}
                    className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-purple-600/20 cursor-pointer transition-all active:scale-98"
                    title="تخصيص جدول دروس خاص بطالب معين دون التأثير على باقي الطلاب"
                  >
                    <UserCheck className="w-4 h-4 text-purple-200" />
                    <span>مولّد جدول خاص لطالب ⚡</span>
                  </button>

                  <button
                    onClick={handleCreateNewQuestion}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-amber-500/10 cursor-pointer transition-all active:scale-98"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة درس / سؤال جديد</span>
                  </button>
                </div>
              </div>

              {/* Questions List */}
              {loadingQuestions ? (
                <div className="py-20 text-center">
                  <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
                  <p className="text-xs text-slate-400 font-bold">جاري تحميل بيانات ورقة Questions...</p>
                </div>
              ) : filteredQuestions.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
                  <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-400">لا توجد دروس أو أسئلة مطابقة للبحث</p>
                </div>
              ) : (
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold">
                        <tr>
                          <th className="py-3 px-4 w-16 text-center"># (الصف)</th>
                          <th className="py-3 px-4">الموضوع / العنوان (العمود A)</th>
                          <th className="py-3 px-4">المعرف الربطي (العمود D)</th>
                          <th className="py-3 px-4">فترة الظهور والإخفاء (DB / DC)</th>
                          <th className="py-3 px-4 text-center w-48">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {filteredQuestions.map((q, idx) => (
                          <tr key={q.rowIndex || idx} className="hover:bg-slate-900/60 transition-colors">
                            <td className="py-3.5 px-4 text-center text-slate-500 font-mono">
                              {q.rowIndex || idx + 1}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-200">
                              {q.word || 'بدون عنوان'}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-amber-400 font-mono dir-ltr text-right">
                              <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs inline-block">
                                {q.comment || 'بدون معرف'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-400">
                              <div className="flex flex-col gap-1 text-[11px] font-mono">
                                <span className="flex items-center gap-1.5 text-emerald-400">
                                  <Calendar className="w-3 h-3" />
                                  <span>ظهور (DB): {q.startDate ? q.startDate : 'دائم'}</span>
                                </span>
                                {q.endDate ? (
                                  <span className="flex items-center gap-1.5 text-rose-400">
                                    <Clock className="w-3 h-3" />
                                    <span>إخفاء (DC): {q.endDate}</span>
                                  </span>
                                ) : q.expireAfterDays ? (
                                  <span className="flex items-center gap-1.5 text-amber-400">
                                    <Clock className="w-3 h-3" />
                                    <span>إخفاء (DD): بعد {q.expireAfterDays} أيام من الظهور</span>
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5 text-slate-500">
                                    <Clock className="w-3 h-3" />
                                    <span>إخفاء: دائم</span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditingQuestion({
                                      ...q,
                                      questions: sanitizeQuestions(q.questions),
                                      audioQuestions: sanitizeQuestions(q.audioQuestions)
                                    });
                                    setModalSubTab('links');
                                  }}
                                  className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500 hover:text-slate-950 text-amber-300 font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                                  title="تعديل تفاصيل الدرس"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  <span>تعديل</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteQuestion(q)}
                                  className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500 hover:text-white text-rose-400 font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                                  title="حذف الدرس"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>حذف</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ANSWERS SHEET */}
          {activeTab === 'answers' && (
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                {/* Search */}
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={answerSearch}
                    onChange={(e) => setAnswerSearch(e.target.value)}
                    placeholder="بحث باسم الطالب أو الصف أو الدرس..."
                    className="w-full pr-10 pl-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500/50"
                  />
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${statusFilter === 'all' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      الكل
                    </button>
                    <button
                      onClick={() => setStatusFilter('completed')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${statusFilter === 'completed' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      تم الإكمال
                    </button>
                    <button
                      onClick={() => setStatusFilter('pending')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${statusFilter === 'pending' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      غير مكتمل
                    </button>
                  </div>

                  <button
                    onClick={loadAnswersData}
                    disabled={loadingAnswers}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                    title="تحديث البيانات"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingAnswers ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Answers List */}
              {loadingAnswers ? (
                <div className="py-20 text-center">
                  <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
                  <p className="text-xs text-slate-400 font-bold">جاري تحميل إجابات الطلاب من ورقة Answers...</p>
                </div>
              ) : filteredAnswers.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
                  <GraduationCap className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-400">لا توجد سجلات طلاب مطابقة للبحث</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950/50">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-3 w-16 text-center"># (الصف)</th>
                        <th className="p-3">اسم الطالب (العمود B)</th>
                        <th className="p-3">رقم الطالب / الصف (العمود A)</th>
                        <th className="p-3">معرف الدرس (العمود C)</th>
                        <th className="p-3 text-center w-36">التفاصيل والتعديل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {filteredAnswers.map((a) => (
                        <tr
                          key={a.rowIndex}
                          onClick={() => setEditingAnswer({ ...a })}
                          className="hover:bg-amber-500/5 cursor-pointer transition-colors group"
                        >
                          <td className="p-3 text-center font-mono text-slate-500 font-bold">{a.rowIndex}</td>
                          <td className="p-3 font-extrabold text-slate-100 group-hover:text-amber-300 transition-colors">
                            {a.username}
                          </td>
                          <td className="p-3 font-semibold text-slate-300">{a.sheetNumber}</td>
                          <td className="p-3 text-amber-400 font-mono font-bold">{a.comment}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingAnswer({ ...a });
                              }}
                              className="px-3 py-1.5 bg-amber-500/15 group-hover:bg-amber-500 group-hover:text-slate-950 text-amber-300 font-bold rounded-lg transition-all text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>عرض التفاصيل</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TRANSLATION & TEXT EDITOR */}
          {activeTab === 'translations' && (
            <div className="py-2">
              <TranslationEditor />
            </div>
          )}

          {/* TAB 4: TELEGRAM INTEGRATION & NOTIFICATIONS */}
          {activeTab === 'telegram' && (
            <div className="py-2">
              <TelegramManager 
                answers={answers} 
                onNotify={(text, type) => setNotice({ text, type })} 
              />
            </div>
          )}
        </div>

        {/* MODAL: EDIT QUESTION / LESSON */}
        <AnimatePresence>
          {editingQuestion && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md" dir="rtl">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-3xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col overflow-hidden text-right relative"
              >
                {/* Modal Title */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0">
                  <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-amber-400" />
                    <span>{editingQuestion.rowIndex ? `تعديل درس صف #${editingQuestion.rowIndex}` : 'إضافة درس / سؤال جديد'}</span>
                  </h3>
                  <button onClick={() => setEditingQuestion(null)} className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800 rounded-xl cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Sub-tabs for Modal (4 Sections) */}
                <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 mb-4 shrink-0 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setModalSubTab('links')}
                    className={`flex-1 min-w-[110px] py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      modalSubTab === 'links'
                        ? 'bg-amber-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>1- قسم الروابط</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalSubTab('schedule')}
                    className={`flex-1 min-w-[110px] py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      modalSubTab === 'schedule'
                        ? 'bg-amber-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>2- مواعيد الدروس</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalSubTab('settings')}
                    className={`flex-1 min-w-[110px] py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      modalSubTab === 'settings'
                        ? 'bg-amber-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <SettingsIcon className="w-3.5 h-3.5" />
                    <span>3- إعدادات الدروس</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalSubTab('questions')}
                    className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      modalSubTab === 'questions'
                        ? 'bg-amber-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>4- أسئلة الفيديو والصوت</span>
                    <span className="px-1.5 py-0.2 bg-slate-900/40 text-[10px] rounded-full font-mono">
                      {(editingQuestion.questions?.length || 0) + (editingQuestion.audioQuestions?.length || 0)}
                    </span>
                  </button>
                </div>

                <form onSubmit={handleSaveQuestion} className="flex-grow overflow-y-auto space-y-4 pr-1 text-xs custom-scrollbar">
                  {/* SECTION 1: LINKS */}
                  {modalSubTab === 'links' && (
                    <div className="space-y-3.5">
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl font-semibold text-xs">
                        قسم الروابط: يحتوي على العناوين والروابط الأساسية للميديا والدرس
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-300 font-bold mb-1">الكلمة / عنوان الدرس (العمود A):</label>
                          <input
                            type="text"
                            value={editingQuestion.word}
                            onChange={(e) => setEditingQuestion({ ...editingQuestion, word: e.target.value })}
                            placeholder="مثال: درس القراءة والأحرف"
                            required
                            className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-300 font-bold mb-1">المعرف الربطي للدرس (العمود D):</label>
                          <input
                            type="text"
                            value={editingQuestion.comment}
                            onChange={(e) => setEditingQuestion({ ...editingQuestion, comment: e.target.value })}
                            placeholder="مثال: L1 أو Word_01"
                            required
                            className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500 dir-ltr"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1">فيديو الدرس (العمود G):</label>
                        <input
                          type="text"
                          value={editingQuestion.youtubeUrl || ''}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, youtubeUrl: e.target.value })}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500 dir-ltr"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1">درس صوتي / الشرح الصوتي (العمود F):</label>
                        <input
                          type="text"
                          value={editingQuestion.explainSound || ''}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, explainSound: e.target.value })}
                          placeholder="https://drive.google.com/..."
                          className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500 dir-ltr"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1">درس استماع / الصوت الكلي (العمود C):</label>
                        <input
                          type="text"
                          value={editingQuestion.fullSound || ''}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, fullSound: e.target.value })}
                          placeholder="رابط الصوت الكامل للكلمة"
                          className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500 dir-ltr"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1">درس استماع حروف - مقسمة بفاصلة (العمود B):</label>
                        <textarea
                          value={editingQuestion.rawLinks || ''}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, rawLinks: e.target.value })}
                          placeholder="https://link1.mp3, https://link2.mp3"
                          rows={2}
                          className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500 dir-ltr"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1">صورة توضيحية (العمود E):</label>
                        <input
                          type="text"
                          value={editingQuestion.image || ''}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, image: e.target.value })}
                          placeholder="رابط الصورة التوضيحية للدرس"
                          className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500 dir-ltr"
                        />
                      </div>
                    </div>
                  )}

                  {/* SECTION 2: SCHEDULE */}
                  {modalSubTab === 'schedule' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl font-semibold text-xs flex items-center gap-2">
                        <Calendar className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>قسم مواعيد الدروس: التحكم في تاريخ ظهور وإخفاء الدرس أو إخفائه التلقائي بعد عدد من الأيام</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Start Date DB */}
                        <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-2">
                          <label className="block text-slate-200 font-bold text-xs flex items-center justify-between">
                            <span>تاريخ ظهور الدرس (العمود DB):</span>
                            <span className="text-[10px] text-emerald-400 font-mono">Column 106</span>
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editingQuestion.startDate || ''}
                              onChange={(e) => setEditingQuestion({ ...editingQuestion, startDate: e.target.value })}
                              placeholder="مثال: 2026-08-01 08:00"
                              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500 font-mono text-xs"
                            />
                            <input
                              type="datetime-local"
                              onChange={(e) => {
                                if (e.target.value) {
                                  setEditingQuestion({ ...editingQuestion, startDate: e.target.value.replace('T', ' ') });
                                }
                              }}
                              className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 cursor-pointer text-xs shrink-0 hover:border-amber-500"
                              title="اختر من التقويم"
                            />
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            تاريخ ووقت بدء ظهور الدرس للطلاب. إذا تُرِك فارغاً، يظهر الدرس فوراً بدون قيود زمنية.
                          </p>
                        </div>

                        {/* End Date DC */}
                        <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-2">
                          <label className="block text-slate-200 font-bold text-xs flex items-center justify-between">
                            <span>تاريخ إخفاء الدرس المباشر (العمود DC):</span>
                            <span className="text-[10px] text-rose-400 font-mono">Column 107</span>
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editingQuestion.endDate || ''}
                              onChange={(e) => setEditingQuestion({ ...editingQuestion, endDate: e.target.value })}
                              placeholder="مثال: 2026-08-10 23:59"
                              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500 font-mono text-xs"
                            />
                            <input
                              type="datetime-local"
                              onChange={(e) => {
                                if (e.target.value) {
                                  setEditingQuestion({ ...editingQuestion, endDate: e.target.value.replace('T', ' ') });
                                }
                              }}
                              className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 cursor-pointer text-xs shrink-0 hover:border-amber-500"
                              title="اختر من التقويم"
                            />
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            تاريخ ووقت محدد لإخفاء الدرس. يتم اعتماده إذا كان مدخلاً بشكل مباشر.
                          </p>
                        </div>
                      </div>

                      {/* Expire After Days DD */}
                      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-amber-300 font-extrabold text-xs flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-400" />
                            <span>إخفاء الدرس بالأيام بعد تاريخ الظهور (العمود DD):</span>
                          </label>
                          <span className="text-[10px] text-amber-400 font-mono font-bold">Column 108</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min="1"
                            placeholder="مثال: 4"
                            value={editingQuestion.expireAfterDays !== undefined ? editingQuestion.expireAfterDays : ''}
                            onChange={(e) => setEditingQuestion({ ...editingQuestion, expireAfterDays: e.target.value })}
                            className="w-36 p-2.5 bg-slate-950 border border-amber-500/40 rounded-xl text-amber-300 font-mono font-bold text-center outline-none focus:border-amber-400 text-sm"
                          />
                          <span className="text-xs text-slate-200 font-bold">أيام (عدد أيام إخفاء الدرس بعد تاريخ الظهور)</span>
                        </div>

                        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1">
                          <p className="font-semibold text-amber-300">💡 كيف تعمل هذه الميزة؟</p>
                          <p>
                            عند وضع رقم (مثلاً <span className="text-amber-400 font-mono font-bold">4</span>) في العمود <span className="text-amber-400 font-mono">DD</span>، فسيختفي هذا الدرس تلقائياً عن الطلاب بعد <span className="text-amber-400 font-bold">4 أيام</span> من تاريخ ظهوره المسجل في العمود <span className="text-emerald-400 font-mono font-bold">DB</span>.
                          </p>
                          {editingQuestion.startDate && editingQuestion.expireAfterDays && !isNaN(parseFloat(String(editingQuestion.expireAfterDays))) && (
                            <p className="text-emerald-400 font-mono mt-2 pt-1 border-t border-slate-800">
                              ✓ النتيجة المحسوبة: سيظهر الدرس في <span className="font-bold">{editingQuestion.startDate}</span> ويختفي تلقائياً بعد <span className="font-bold">{editingQuestion.expireAfterDays}</span> أيام.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SECTION 3: SETTINGS */}
                  {modalSubTab === 'settings' && (
                    <div className="space-y-3.5">
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl font-semibold text-xs">
                        قسم إعدادات الدروس: التحكم في عدد الأسئلة ومحددات الإجابات وتفضيلات الواجبات وتسجيل الصوت
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-300 font-bold mb-1">عدد الأسئلة لأسئلة الفيديو (العمود I):</label>
                          <input
                            type="number"
                            min="0"
                            value={editingQuestion.totalQuestionsCount ?? 15}
                            onChange={(e) => setEditingQuestion({ ...editingQuestion, totalQuestionsCount: parseInt(e.target.value) || 0 })}
                            className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-300 font-bold mb-1">إظهار الإجابة الصحيحة (العمود H):</label>
                          <select
                            value={editingQuestion.showResult || 'نعم'}
                            onChange={(e) => setEditingQuestion({ ...editingQuestion, showResult: e.target.value })}
                            className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500"
                          >
                            <option value="نعم">نعم (إظهار النتيجة فوراً)</option>
                            <option value="لا">لا (إخفاء النتيجة)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1">نص فوق درس الاستماع (العمود CQ):</label>
                        <input
                          type="text"
                          value={editingQuestion.instruction || ''}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, instruction: e.target.value })}
                          placeholder="مثال: يرجى الاستماع جيداً للحروف ثم الإجابة"
                          className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-300 font-bold mb-1">إتاحة تسجيل الصوت (العمود CR):</label>
                          <select
                            value={editingQuestion.allowRecording || 'لا'}
                            onChange={(e) => setEditingQuestion({ ...editingQuestion, allowRecording: e.target.value })}
                            className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500"
                          >
                            <option value="نعم">نعم (مطلوب تسليم واجبي صوتاً)</option>
                            <option value="لا">لا (غير مطلوب)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-300 font-bold mb-1">أقصى وقت تسجيل بالثواني (العمود CT):</label>
                          <input
                            type="number"
                            min="5"
                            value={editingQuestion.maxRecordingTime ?? 10}
                            onChange={(e) => setEditingQuestion({ ...editingQuestion, maxRecordingTime: parseInt(e.target.value) || 10 })}
                            className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-300 font-bold mb-1">إعادة تسجيل صوت / عدد المحاولات (العمود CU):</label>
                          <input
                            type="number"
                            min="0"
                            value={editingQuestion.retryCount ?? 1}
                            onChange={(e) => setEditingQuestion({ ...editingQuestion, retryCount: parseInt(e.target.value) || 0 })}
                            className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-300 font-bold mb-1">إتاحة رفع صورة (العمود CY):</label>
                          <select
                            value={editingQuestion.allowUpload || 'لا'}
                            onChange={(e) => setEditingQuestion({ ...editingQuestion, allowUpload: e.target.value })}
                            className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500"
                          >
                            <option value="نعم">نعم (مطلوب رفع صورة واجبي)</option>
                            <option value="لا">لا (غير مطلوب)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1">عدد إعادة إرسال الإجابة من جديد (العمود DA):</label>
                        <input
                          type="number"
                          min="0"
                          value={editingQuestion.defaultRetryResetCount ?? 1}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, defaultRetryResetCount: parseInt(e.target.value) || 0 })}
                          className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* SECTION 3: INTERACTIVE QUESTIONS */}
                  {modalSubTab === 'questions' && (
                    <div className="space-y-5">
                      {/* Section Add Buttons */}
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                        <span className="font-bold text-xs text-slate-300">إضافة أسئلة تفاعلية للفيديو والصوت:</span>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              if (!editingQuestion) return;
                              setEditingQuestion({
                                ...editingQuestion,
                                questions: sanitizeQuestions(editingQuestion.questions),
                                audioQuestions: sanitizeQuestions(editingQuestion.audioQuestions)
                              });
                            }}
                            className="px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                            title="حذف أي أسئلة مكررة أو فارغة ناتجة عن التكرار"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                            <span>تنظيف وتصفية التكرارات</span>
                          </button>

                          <button
                            type="button"
                            onClick={addVideoQuestion}
                            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>إضافة سؤال فيديو (حتى 15)</span>
                          </button>

                          <button
                            type="button"
                            onClick={addAudioQuestion}
                            className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>إضافة سؤال صوتي (سؤالان)</span>
                          </button>
                        </div>
                      </div>

                      {/* Video Questions Accordion List */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-amber-400 flex items-center gap-2">
                          <Video className="w-4 h-4" />
                          <span>أسئلة الفيديو (الأعمدة J إلى CF) - الإجمالي: {(editingQuestion.questions || []).length}/15</span>
                        </h4>

                        {(!editingQuestion.questions || editingQuestion.questions.length === 0) ? (
                          <div className="p-4 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-xs">
                            لا توجد أسئلة فيديو مضافة لهذا الدرس بعد. انقر فوق "إضافة سؤال فيديو" للأعلى.
                          </div>
                        ) : (
                          editingQuestion.questions.map((q, qIdx) => {
                            const isExpanded = expandedVideoIndex === qIdx;
                            return (
                              <div key={qIdx} className="border border-slate-800 rounded-2xl bg-slate-950/80 overflow-hidden transition-all">
                                {/* Accordion Header */}
                                <div
                                  onClick={() => setExpandedVideoIndex(isExpanded ? null : qIdx)}
                                  className="p-3 bg-slate-900/90 hover:bg-slate-850 flex items-center justify-between gap-3 cursor-pointer select-none"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span className="w-6 h-6 bg-amber-500/20 text-amber-300 font-bold font-mono text-xs rounded-lg flex items-center justify-center border border-amber-500/30">
                                      {qIdx + 1}
                                    </span>
                                    <div>
                                      <span className="font-bold text-xs text-slate-200">
                                        {q.question.trim() ? q.question : `سؤال فيديو #${qIdx + 1}`}
                                      </span>
                                      <span className="text-[10px] text-slate-500 mr-2 font-mono">({q.time} ثانية)</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeVideoQuestion(qIdx);
                                      }}
                                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                      title="حذف السؤال"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                  </div>
                                </div>

                                {/* Accordion Body */}
                                {isExpanded && (
                                  <div className="p-3.5 space-y-3 bg-slate-950 border-t border-slate-800/80 text-xs">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-slate-400 font-bold mb-1">توقيت ظهور السؤال بالفيديو بالثواني (time):</label>
                                        <input
                                          type="number"
                                          step="0.1"
                                          value={q.time}
                                          onChange={(e) => updateVideoQuestion(qIdx, 'time', parseFloat(e.target.value) || 0)}
                                          className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-slate-400 font-bold mb-1">رابط صورة السؤال (questionImage):</label>
                                        <input
                                          type="text"
                                          value={q.image || ''}
                                          onChange={(e) => updateVideoQuestion(qIdx, 'image', e.target.value)}
                                          placeholder="https://..."
                                          className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500 dir-ltr"
                                        />
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block text-slate-400 font-bold mb-1">نص السؤال (questionText):</label>
                                      <input
                                        type="text"
                                        value={q.question}
                                        onChange={(e) => updateVideoQuestion(qIdx, 'question', e.target.value)}
                                        placeholder="اكتب نص السؤال هنا..."
                                        className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500"
                                      />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-slate-400 font-bold mb-1">الخيارات مقسمة بفاصلة أو كلمة "نص" (options):</label>
                                        <input
                                          type="text"
                                          value={q.options}
                                          onChange={(e) => updateVideoQuestion(qIdx, 'options', e.target.value)}
                                          placeholder="خيار1,خيار2,خيار3 أو كلمة نص"
                                          className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-slate-400 font-bold mb-1">الإجابة الصحيحة (correctAnswer):</label>
                                        <input
                                          type="text"
                                          value={q.correctAnswer}
                                          onChange={(e) => updateVideoQuestion(qIdx, 'correctAnswer', e.target.value)}
                                          placeholder="الإجابة الصحيحة بالضبط"
                                          className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Audio Questions Accordion List */}
                      <div className="space-y-2 pt-3 border-t border-slate-800">
                        <h4 className="text-xs font-black text-sky-400 flex items-center gap-2">
                          <Volume2 className="w-4 h-4" />
                          <span>أسئلة الصوت الاستماعية (الأعمدة CG إلى CP) - الإجمالي: {(editingQuestion.audioQuestions || []).length}/2</span>
                        </h4>

                        {(!editingQuestion.audioQuestions || editingQuestion.audioQuestions.length === 0) ? (
                          <div className="p-4 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-xs">
                            لا توجد أسئلة صوت مضافة لهذه الكلمة بعد. انقر فوق "إضافة سؤال صوتي" للأعلى.
                          </div>
                        ) : (
                          editingQuestion.audioQuestions.map((aq, aqIdx) => {
                            const isExpanded = expandedAudioIndex === aqIdx;
                            return (
                              <div key={aqIdx} className="border border-slate-800 rounded-2xl bg-slate-950/80 overflow-hidden transition-all">
                                {/* Accordion Header */}
                                <div
                                  onClick={() => setExpandedAudioIndex(isExpanded ? null : aqIdx)}
                                  className="p-3 bg-slate-900/90 hover:bg-slate-850 flex items-center justify-between gap-3 cursor-pointer select-none"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span className="w-6 h-6 bg-sky-500/20 text-sky-300 font-bold font-mono text-xs rounded-lg flex items-center justify-center border border-sky-500/30">
                                      {aqIdx + 1}
                                    </span>
                                    <div>
                                      <span className="font-bold text-xs text-slate-200">
                                        {aq.question.trim() ? aq.question : `سؤال صوتي #${aqIdx + 1}`}
                                      </span>
                                      <span className="text-[10px] text-slate-500 mr-2 font-mono">({aq.time} ثانية)</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeAudioQuestion(aqIdx);
                                      }}
                                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                      title="حذف السؤال"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                  </div>
                                </div>

                                {/* Accordion Body */}
                                {isExpanded && (
                                  <div className="p-3.5 space-y-3 bg-slate-950 border-t border-slate-800/80 text-xs">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-slate-400 font-bold mb-1">توقيت ظهور السؤال بالثواني (time):</label>
                                        <input
                                          type="number"
                                          step="0.1"
                                          value={aq.time}
                                          onChange={(e) => updateAudioQuestion(aqIdx, 'time', parseFloat(e.target.value) || 0)}
                                          className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-slate-400 font-bold mb-1">رابط صورة السؤال (questionImage):</label>
                                        <input
                                          type="text"
                                          value={aq.image || ''}
                                          onChange={(e) => updateAudioQuestion(aqIdx, 'image', e.target.value)}
                                          placeholder="https://..."
                                          className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500 dir-ltr"
                                        />
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block text-slate-400 font-bold mb-1">نص السؤال (questionText):</label>
                                      <input
                                        type="text"
                                        value={aq.question}
                                        onChange={(e) => updateAudioQuestion(aqIdx, 'question', e.target.value)}
                                        placeholder="اكتب نص السؤال هنا..."
                                        className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500"
                                      />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-slate-400 font-bold mb-1">الخيارات مقسمة بفاصلة أو كلمة "نص" (options):</label>
                                        <input
                                          type="text"
                                          value={aq.options}
                                          onChange={(e) => updateAudioQuestion(aqIdx, 'options', e.target.value)}
                                          placeholder="خيار1,خيار2,خيار3 أو كلمة نص"
                                          className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-slate-400 font-bold mb-1">الإجابة الصحيحة (correctAnswer):</label>
                                        <input
                                          type="text"
                                          value={aq.correctAnswer}
                                          onChange={(e) => updateAudioQuestion(aqIdx, 'correctAnswer', e.target.value)}
                                          placeholder="الإجابة الصحيحة بالضبط"
                                          className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* Form Footer Buttons */}
                  <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingQuestion(null)}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                    >
                      إلغاء
                    </button>

                    <button
                      type="submit"
                      disabled={savingQuestion}
                      className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {savingQuestion ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>حفظ الدرس والأسئلة</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL: VIEW DETAILS & EDIT STUDENT ANSWER */}
        <AnimatePresence>
          {editingAnswer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md" dir="rtl">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col overflow-y-auto custom-scrollbar text-right"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-100">تفاصيل الدرس للطالب (صف #{editingAnswer.rowIndex})</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">عرض السجلات وحالة الدرس وإجراء التعديلات المطلوبة</p>
                    </div>
                  </div>
                  <button onClick={() => setEditingAnswer(null)} className="p-2 text-slate-400 hover:text-slate-100 bg-slate-800 rounded-xl cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* SECTION 1: READ-ONLY INFORMATION (بيانات لا يمكن التعديل عليها) */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <h4 className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-amber-500" />
                      <span>بيانات لا يمكن التعديل عليها (عرض فقط):</span>
                    </h4>
                    <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded-md font-bold border border-slate-800">
                      محمية التعديل
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* 1. اسم الطالب (العمود B) */}
                    <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3">
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">اسم الطالب (العمود B)</span>
                      <span className="font-extrabold text-slate-100 text-sm block truncate">
                        {editingAnswer.username || 'بدون اسم'}
                      </span>
                    </div>

                    {/* 2. رقم الطالب / الصف (العمود A) */}
                    <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3">
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">رقم الطالب / الصف (العمود A)</span>
                      <span className="font-extrabold text-slate-200 text-xs block font-mono">
                        {editingAnswer.sheetNumber || 'غير محدد'}
                      </span>
                    </div>

                    {/* 3. معرف الدرس (العمود C) */}
                    <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3">
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">معرف الدرس (العمود C)</span>
                      <span className="font-extrabold text-amber-400 font-mono text-xs block dir-ltr text-right">
                        {editingAnswer.comment || 'غير محدد'}
                      </span>
                    </div>

                    {/* 4. نتائج إجابات الفيديو (العمود U) */}
                    <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3">
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">نتائج إجابات الفيديو (العمود U)</span>
                      <span className="font-extrabold text-emerald-400 font-mono text-xs block">
                        {editingAnswer.videoAnswersResult || editingAnswer.fullAudioScore || 'لا توجد إجابات'}
                      </span>
                    </div>

                    {/* 5. نتائج إجابات الصوت (العمود Z) */}
                    <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3">
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">نتائج إجابات الصوت (العمود Z)</span>
                      <span className="font-extrabold text-sky-400 font-mono text-xs block">
                        {editingAnswer.audioAnswersResult || editingAnswer.letterListenScore || 'لا توجد إجابات'}
                      </span>
                    </div>

                    {/* 6. المعادلة الكاملة (العمود AM) */}
                    <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3">
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">المعادلة الكاملة (العمود AM)</span>
                      <span className="font-extrabold text-amber-200 font-mono text-xs block dir-ltr text-right">
                        {editingAnswer.finalFormula || 'غير مسجلة'}
                      </span>
                    </div>

                    {/* 7. النتيجة النهائية (العمود AN) */}
                    <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3">
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">النتيجة النهائية (العمود AN)</span>
                      <span className="font-extrabold text-amber-300 font-mono text-xs block">
                        {editingAnswer.finalResult || 'غير مسجلة'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: EDITABLE FIELDS FORM (حقول يمكن تعديلها) */}
                <form onSubmit={handleSaveAnswer} className="space-y-4 text-xs">
                  <div className="border-t border-slate-800 pt-3">
                    <h4 className="text-xs font-black text-amber-400 mb-3 flex items-center gap-1.5">
                      <Edit className="w-4 h-4 text-amber-400" />
                      <span>حقول قابلة للتعديل والتحكم:</span>
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* عدد إرسال ملف الصوت (العمود AK) */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">عدد إرسال ملف الصوت (العمود AK):</label>
                      <input
                        type="number"
                        min="0"
                        value={editingAnswer.audioUploadCount ?? 0}
                        onChange={(e) => setEditingAnswer({ ...editingAnswer, audioUploadCount: parseInt(e.target.value) || 0 })}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500 font-mono font-bold"
                      />
                    </div>

                    {/* عدد إرسال ملف الصورة (العمود AL) */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">عدد إرسال ملف الصورة (العمود AL):</label>
                      <input
                        type="number"
                        min="0"
                        value={editingAnswer.imageUploadCount ?? 0}
                        onChange={(e) => setEditingAnswer({ ...editingAnswer, imageUploadCount: parseInt(e.target.value) || 0 })}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* الحالة (AO) : تم / اعادة / فراغ */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">الحالة (العمود AO):</label>
                      <select
                        value={editingAnswer.completed || ''}
                        onChange={(e) => setEditingAnswer({ ...editingAnswer, completed: e.target.value })}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500 font-bold text-amber-300"
                      >
                        <option value="تم">تم</option>
                        <option value="اعادة">اعادة</option>
                        <option value="">فراغ (لا شيء)</option>
                      </select>
                    </div>

                    {/* عدد الإعادات المتبقية (العمود AP) */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">عدد الإعادات المتبقية (العمود AP):</label>
                      <input
                        type="number"
                        min="0"
                        value={editingAnswer.retryResetCount ?? 0}
                        onChange={(e) => setEditingAnswer({ ...editingAnswer, retryResetCount: parseInt(e.target.value) || 0 })}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500 font-mono font-bold text-amber-400"
                      />
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingAnswer(null)}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                    >
                      إلغاء
                    </button>

                    <button
                      type="submit"
                      disabled={savingAnswer}
                      className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-amber-500/10"
                    >
                      {savingAnswer ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>حفظ التعديلات</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
          {/* Delete Confirmation Modal */}
          {deletingQuestionRow && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl dir-rtl text-slate-100"
              >
                <div className="flex items-center gap-3 text-rose-400 mb-4">
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">تأكيد حذف الدرس</h3>
                    <p className="text-xs text-slate-400 mt-0.5">عملية الحذف نهائية من ورقة الأسئلة</p>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed mb-6">
                  هل أنت متأكد من حذف الموضوع / الدرس (<span className="font-bold text-amber-400">{deletingQuestionRow.comment || deletingQuestionRow.word}</span>) بالكامل من ورقة الأسئلة؟
                </p>

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setDeletingQuestionRow(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={confirmDeleteQuestion}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs cursor-pointer flex items-center gap-2 shadow-lg shadow-rose-600/20"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>تأكيد الحذف النهائي</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* MODAL: AUTO SCHEDULE GENERATOR */}
          {showAutoScheduleModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md" dir="rtl">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base sm:text-lg text-slate-100 flex items-center gap-2">
                        <span>مولّد جدول مواعيد الدروس التلقائي</span>
                        <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] rounded-full font-mono">
                          {questions.length} درس
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        برمجة وتنسيق تواريخ الظهور والإخفاء لجميع الدروس تلقائياً بناءً على أيام الأسبوع
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowAutoScheduleModal(false)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body Content - Scrollable */}
                <div className="flex-grow overflow-y-auto py-5 space-y-6 custom-scrollbar pr-1">
                  
                  {/* 1. Days Selection */}
                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-slate-200 font-extrabold text-xs flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-mono text-[11px]">1</span>
                        <span>اختر أيام الدراسة في الأسبوع (أيام ظهور الدروس):</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])}
                          className="text-[11px] text-indigo-400 hover:underline cursor-pointer"
                        >
                          تحديد الكل
                        </button>
                        <span className="text-slate-600 text-xs">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedDays([0, 1, 2, 3, 4])}
                          className="text-[11px] text-indigo-400 hover:underline cursor-pointer"
                        >
                          أيام العمل (أحد-خميس)
                        </button>
                        <span className="text-slate-600 text-xs">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedDays([])}
                          className="text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          مسح
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                      {DAYS_LIST.map((day) => {
                        const isSelected = selectedDays.includes(day.id);
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedDays(selectedDays.filter(id => id !== day.id));
                              } else {
                                setSelectedDays([...selectedDays, day.id].sort((a, b) => a - b));
                              }
                            }}
                            className={`p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 border border-indigo-400 ring-2 ring-indigo-500/30'
                                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                            }`}
                          >
                            <span>{day.name}</span>
                            {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Program Start Date & Lessons Per Day */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* First Day Start Date */}
                    <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
                      <label className="text-slate-200 font-extrabold text-xs flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-mono text-[11px]">2</span>
                        <span>تاريخ بداية أول يوم في البرنامج (الظهور):</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={autoStartDate}
                          onChange={(e) => setAutoStartDate(e.target.value)}
                          placeholder="مثال: 2026-08-03 08:00"
                          className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-indigo-500 font-mono text-xs"
                        />
                        <input
                          type="datetime-local"
                          onChange={(e) => {
                            if (e.target.value) {
                              setAutoStartDate(e.target.value.replace('T', ' '));
                            }
                          }}
                          className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 cursor-pointer text-xs shrink-0 hover:border-indigo-500"
                          title="اختر من التقويم"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">
                        تاريخ أول يوم يبدأ فيه البرنامج. إذا لم يصادف يوماً من الأيام المحددة أعلاه، سيبدأ التوليد من أول يوم محدد يليه.
                      </p>
                    </div>

                    {/* Lessons per day */}
                    <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
                      <label className="text-slate-200 font-extrabold text-xs flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-mono text-[11px]">3</span>
                        <span>عدد الدروس التي تظهر في اليوم الواحد:</span>
                      </label>
                      <div className="flex items-center gap-3 pt-1">
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={lessonsPerDay}
                          onChange={(e) => setLessonsPerDay(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-28 p-2.5 bg-slate-900 border border-indigo-500/30 rounded-xl text-indigo-300 font-mono font-extrabold text-center text-sm outline-none focus:border-indigo-500"
                        />
                        <span className="text-xs text-slate-300 font-bold">
                          {lessonsPerDay === 1 ? 'درس واحد كل يوم محدد' : `${lessonsPerDay} دروس في نفس اليوم المحدد`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        مثال: اختيار 2 يعني إظهار درَسين اثنين في كل يوم دراسي محدد بنفس تاريخ الظهور.
                      </p>
                    </div>
                  </div>

                  {/* 3. Hide Options */}
                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                    <label className="text-slate-200 font-extrabold text-xs flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-mono text-[11px]">4</span>
                      <span>طريقة إخفاء الدروس للطلاب:</span>
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      {/* Mode A: Expire after X Days */}
                      <div
                        onClick={() => setAutoHideMode('days')}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                          autoHideMode === 'days'
                            ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs text-amber-300 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>إخفاء حسب عدد الأيام (DD)</span>
                          </span>
                          <input
                            type="radio"
                            checked={autoHideMode === 'days'}
                            onChange={() => setAutoHideMode('days')}
                            className="accent-amber-500 cursor-pointer"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          يختفي كل درس تلقائياً بعد مرور عدد معين من الأيام تحسب من بداية تاريخ ظهوره الخاص.
                        </p>
                        {autoHideMode === 'days' && (
                          <div className="pt-2 border-t border-amber-500/20 flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              placeholder="4"
                              value={autoExpireAfterDays}
                              onChange={(e) => setAutoExpireAfterDays(e.target.value)}
                              className="w-20 p-2 bg-slate-950 border border-amber-500/40 rounded-xl text-amber-300 font-mono font-bold text-center text-xs outline-none"
                            />
                            <span className="text-[11px] text-amber-200 font-bold">أيام إخفاء بعد الظهور</span>
                          </div>
                        )}
                      </div>

                      {/* Mode B: Unified End Date */}
                      <div
                        onClick={() => setAutoHideMode('unifiedDate')}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                          autoHideMode === 'unifiedDate'
                            ? 'bg-rose-500/10 border-rose-500/50 ring-1 ring-rose-500/30'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs text-rose-300 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-rose-400" />
                            <span>تاريخ إخفاء موحد (DC)</span>
                          </span>
                          <input
                            type="radio"
                            checked={autoHideMode === 'unifiedDate'}
                            onChange={() => setAutoHideMode('unifiedDate')}
                            className="accent-rose-500 cursor-pointer"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          تحديد تاريخ وتوقيت نهائي موحد يختفي فيه جميع دروس البرنامج دفعة واحدة (انتهاء الكورس).
                        </p>
                        {autoHideMode === 'unifiedDate' && (
                          <div className="pt-2 border-t border-rose-500/20 space-y-1">
                            <input
                              type="text"
                              placeholder="2026-08-30 23:59"
                              value={autoUnifiedEndDate}
                              onChange={(e) => setAutoUnifiedEndDate(e.target.value)}
                              className="w-full p-2 bg-slate-950 border border-rose-500/40 rounded-xl text-rose-300 font-mono text-xs outline-none"
                            />
                          </div>
                        )}
                      </div>

                      {/* Mode C: Permanent */}
                      <div
                        onClick={() => setAutoHideMode('none')}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                          autoHideMode === 'none'
                            ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs text-emerald-300 flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5 text-emerald-400" />
                            <span>دائم بدون إخفاء</span>
                          </span>
                          <input
                            type="radio"
                            checked={autoHideMode === 'none'}
                            onChange={() => setAutoHideMode('none')}
                            className="accent-emerald-500 cursor-pointer"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          ستبقى جميع الدروس ظاهرة بشكل مستمر بدون تاريخ إخفاء بعد تاريخ ظهورها.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 4. Real-time Calculation Preview Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="font-extrabold text-xs text-slate-200 flex items-center gap-2">
                        <span>معاينة الجدول المحسوب للدروس ({questions.length} درس):</span>
                      </h4>
                      <span className="text-[11px] text-indigo-400 font-semibold">
                        يتم التحديث فوراً عند تغيير أي خيار
                      </span>
                    </div>

                    <div className="border border-slate-800 rounded-2xl bg-slate-950 overflow-hidden shadow-inner max-h-60 overflow-y-auto custom-scrollbar">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-900 text-slate-400 font-bold sticky top-0 border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3 w-12 text-center">#</th>
                            <th className="py-2.5 px-3">عنوان الدرس (الكلمة / المعرف)</th>
                            <th className="py-2.5 px-3">اليوم المحسوب</th>
                            <th className="py-2.5 px-3">تاريخ الظهور المحسوب (DB)</th>
                            <th className="py-2.5 px-3">شرط الإخفاء (DC / DD)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {calculateAutoSchedule().map((q, idx) => {
                            const dateObj = new Date(q.startDate ? q.startDate.replace(' ', 'T') : '');
                            const DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                            const dayName = !isNaN(dateObj.getTime()) ? DAY_NAMES[dateObj.getDay()] : '—';

                            return (
                              <tr key={idx} className="hover:bg-indigo-500/5 transition-colors">
                                <td className="py-2 px-3 text-center text-slate-500 font-bold">{idx + 1}</td>
                                <td className="py-2 px-3 text-slate-200 font-sans font-extrabold">
                                  {q.word} <span className="text-slate-500 text-[10px] font-mono">({q.comment})</span>
                                </td>
                                <td className="py-2 px-3 text-indigo-400 font-bold font-sans">
                                  {dayName}
                                </td>
                                <td className="py-2 px-3 text-emerald-400 font-bold">
                                  {q.startDate}
                                </td>
                                <td className="py-2 px-3 text-amber-300">
                                  {q.endDate ? (
                                    <span className="text-rose-400">إخفاء موحد: {q.endDate}</span>
                                  ) : q.expireAfterDays ? (
                                    <span className="text-amber-400">إخفاء بعد {q.expireAfterDays} أيام</span>
                                  ) : (
                                    <span className="text-slate-500 font-sans">دائم</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

                {/* Footer Action Buttons */}
                <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAutoScheduleModal(false);
                        setConfirmingClear(false);
                      }}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                    >
                      إلغاء
                    </button>

                    {confirmingClear ? (
                      <div className="flex items-center gap-2 p-1 bg-rose-500/15 border border-rose-500/40 rounded-xl">
                        <span className="text-[11px] text-rose-200 font-extrabold px-1">
                          تأكيد مسح كافة المواعيد العامة؟
                        </span>
                        <button
                          type="button"
                          onClick={handleClearAllSchedules}
                          disabled={applyingAutoSchedule}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-lg shadow cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                        >
                          {applyingAutoSchedule ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          <span>نعم، مسح الآن</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingClear(false)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingClear(true)}
                        disabled={applyingAutoSchedule || questions.length === 0}
                        className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                        title="مسح وإصدار أمر مسح لجميع التواريخ (DB:DD) في كل الدروس العامة"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" />
                        <span>مسح وإزالة جميع المواعيد العامة</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyAutoSchedule}
                    disabled={applyingAutoSchedule || selectedDays.length === 0}
                    className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/25 cursor-pointer disabled:opacity-50 transition-all active:scale-98"
                  >
                    {applyingAutoSchedule ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>تطبيق وحفظ الجدول التلقائي على جميع الدروس ({questions.length} درس)</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* MODAL: STUDENT CUSTOM SCHEDULE GENERATOR */}
          {showStudentCustomScheduleModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md" dir="rtl">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-4xl bg-slate-900 border border-purple-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
                      <UserCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base sm:text-lg text-slate-100 flex items-center gap-2">
                        <span>مولّد جدول خاص لطالب ⚡</span>
                        {selectedStudentForSchedule && (
                          <span className="px-3 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs rounded-full font-bold">
                            الطالب: {selectedStudentForSchedule}
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {selectedStudentForSchedule 
                          ? `ضبط الأيام والمواعيد الخاصة للطالب (${selectedStudentForSchedule}) دون التأثير على الجدول العام للطلاب الأخرين.`
                          : 'اختر أو أدخل اسم الطالب لضبط جدول مواعيد مخصص له.'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowStudentCustomScheduleModal(false);
                      setSelectedStudentForSchedule(null);
                    }}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body Content */}
                <div className="flex-grow overflow-y-auto py-5 space-y-6 custom-scrollbar pr-1">
                  
                  {/* INTERACTIVE DROPDOWN SELECTOR (FROM SETTINGS SHEET: COL B: ID, COL C: NAME) */}
                  <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-2xl space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-slate-200 font-extrabold text-xs flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>اختيار الطالب من القائمة المنسدلة (المعتمدة من ورقة Settings: العمود B رقم الطالب | العمود C اسم الطالب):</span>
                      </label>
                      <button
                        type="button"
                        onClick={loadSettingsStudentsList}
                        disabled={loadingSettingsStudents}
                        className="text-[11px] text-purple-300 hover:text-purple-200 bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-auto"
                        title="إعادة جلب وتحديث قائمة الطلاب من ورقة Settings"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingSettingsStudents ? 'animate-spin text-purple-400' : ''}`} />
                        <span>{loadingSettingsStudents ? 'جاري القراءة...' : 'تحديث من شيت Settings'}</span>
                      </button>
                    </div>

                    <div className="relative">
                      <select
                        value={
                          selectedStudentForSchedule
                            ? `${selectedStudentForSchedule}__${selectedStudentSheetForSchedule}`
                            : ''
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) {
                            setSelectedStudentForSchedule(null);
                            setSelectedStudentSheetForSchedule('');
                            return;
                          }
                          const [namePart, sheetPart] = val.split('__');
                          handleSelectStudentForSchedule(namePart, sheetPart);
                        }}
                        className="w-full px-4 py-3 bg-slate-950 border-2 border-purple-500/50 hover:border-purple-400 focus:border-purple-400 text-slate-100 font-bold text-xs sm:text-sm rounded-xl outline-none cursor-pointer shadow-lg transition-all"
                      >
                        <option value="" className="bg-slate-900 text-slate-400">
                          👇 انقر هنا لاختيار أي طالب (رقم الطالب - اسم الطالب) لفتح إعداداته الخاصة...
                        </option>
                        {allKnownStudents.map((st, idx) => {
                          const keyName = st.name.toLowerCase();
                          const keySheet = (st.sheet || '').toLowerCase();
                          const hasCustom = !!(
                            (keyName && customSchedulesMap[keyName]?.schedule?.length) ||
                            (keySheet && customSchedulesMap[keySheet]?.schedule?.length)
                          );

                          return (
                            <option
                              key={`${st.sheet}_${st.name}_${idx}`}
                              value={`${st.name}__${st.sheet}`}
                              className="bg-slate-900 text-slate-200 py-1 font-sans"
                            >
                              {st.sheet ? `[رقم الطالب: ${st.sheet}]` : '[رقم الطالب: —]'} — {st.name} {hasCustom ? '⚡ (له جدول خاص مفعل)' : ' (جدول عام)'}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 px-1 pt-1 gap-2">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>مصدر الأسماء المعتمد: ورقة <strong className="text-emerald-400">Settings</strong> (العمود B: رقم الطالب | العمود C: اسم الطالب)</span>
                      </span>
                      <span className="font-mono text-purple-300">
                        عدد الطلاب المتاحين: {allKnownStudents.length} طالب
                      </span>
                    </div>
                  </div>

                  {/* STEP 1: SELECT STUDENT IF NOT YET SELECTED */}
                  {!selectedStudentForSchedule ? (
                    <div className="space-y-5">
                      {/* Search or Add Student */}
                      <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-4">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                          <label className="text-slate-200 font-extrabold text-xs flex items-center gap-2">
                            <Users className="w-4 h-4 text-purple-400" />
                            <span>البحث في قائمة الطلاب أو إدخال طالب يدوياً:</span>
                          </label>
                          <div className="relative w-full sm:w-64">
                            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-500" />
                            <input
                              type="text"
                              value={studentScheduleSearch}
                              onChange={(e) => setStudentScheduleSearch(e.target.value)}
                              placeholder="بحث باسم أو رقم الطالب..."
                              className="w-full pr-9 pl-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>

                        {/* Manual add input */}
                        <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-center gap-2">
                          <input
                            type="text"
                            value={manualStudentInput}
                            onChange={(e) => setManualStudentInput(e.target.value)}
                            placeholder="اسم الطالب (العمود C)..."
                            className="w-full sm:flex-grow p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-purple-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && manualStudentInput.trim()) {
                                handleSelectStudentForSchedule(manualStudentInput, manualStudentSheetInput);
                                setManualStudentInput('');
                                setManualStudentSheetInput('');
                              }
                            }}
                          />
                          <input
                            type="text"
                            value={manualStudentSheetInput}
                            onChange={(e) => setManualStudentSheetInput(e.target.value)}
                            placeholder="رقم الطالب (العمود B - اختياري)..."
                            className="w-full sm:w-44 p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-purple-500 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (manualStudentInput.trim() || manualStudentSheetInput.trim()) {
                                handleSelectStudentForSchedule(manualStudentInput, manualStudentSheetInput);
                                setManualStudentInput('');
                                setManualStudentSheetInput('');
                              } else {
                                alert('يرجى كتابة اسم الطالب أو رقمه أولاً.');
                              }
                            }}
                            className="w-full sm:w-auto px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-md shadow-purple-600/20 transition-all active:scale-95"
                          >
                            <UserPlus className="w-4 h-4" />
                            <span>تخصيص جدول</span>
                          </button>
                        </div>
                      </div>

                      {/* Students List Grid */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                          <span className="flex items-center gap-2">
                            <span>بطاقات الطلاب المسجلين (ورقة Settings):</span>
                            <span className="text-slate-500 font-normal text-[11px]">(انقر على أي طالب لعرض وتخصيص إعداداته)</span>
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            المعروض: {
                              allKnownStudents.filter(s => {
                                const q = studentScheduleSearch.trim().toLowerCase();
                                if (!q) return true;
                                return s.name.toLowerCase().includes(q) || s.sheet.toLowerCase().includes(q);
                              }).length
                            } / {allKnownStudents.length}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto custom-scrollbar p-1">
                          {(() => {
                            const filtered = allKnownStudents.filter(s => {
                              const q = studentScheduleSearch.trim().toLowerCase();
                              if (!q) return true;
                              return s.name.toLowerCase().includes(q) || s.sheet.toLowerCase().includes(q);
                            });

                            if (filtered.length === 0) {
                              return (
                                <div className="col-span-2 p-8 text-center bg-slate-950 border border-slate-800 rounded-2xl text-slate-500 text-xs">
                                  لا يوجد طلاب مطابقون للبحث. يمكنك اختيار الطالب من القائمة المنسدلة أعلاه أو الضغط على "تحديث من شيت Settings".
                                </div>
                              );
                            }

                            return filtered.map((st, idx) => {
                              const keyName = st.name.toLowerCase();
                              const keySheet = (st.sheet || '').toLowerCase();
                              const existingSchedule = (keyName && customSchedulesMap[keyName]) || (keySheet && customSchedulesMap[keySheet]);
                              const hasCustom = !!(existingSchedule && existingSchedule.schedule && existingSchedule.schedule.length > 0);

                              return (
                                <div
                                  key={`${st.sheet}_${st.name}_${idx}`}
                                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                    hasCustom
                                      ? 'bg-purple-950/20 border-purple-500/40 ring-1 ring-purple-500/20'
                                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 overflow-hidden">
                                    <div className={`p-2 rounded-xl shrink-0 ${hasCustom ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'}`}>
                                      <User className="w-4 h-4" />
                                    </div>
                                    <div className="truncate">
                                      <div className="font-extrabold text-xs text-slate-200 truncate flex items-center gap-1.5">
                                        <span>{st.name}</span>
                                        {st.sheet && (
                                          <span className="px-1.5 py-0.2 bg-slate-800 text-emerald-400 border border-slate-700 font-mono text-[10px] rounded">
                                            #{st.sheet}
                                          </span>
                                        )}
                                      </div>
                                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                        {hasCustom ? (
                                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] rounded-full font-bold inline-flex items-center gap-1">
                                            <span>⚡ جدول خاص ({existingSchedule.schedule.length} درس)</span>
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 text-[10px] rounded-full">
                                            جدول عام (افتراضي)
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleSelectStudentForSchedule(st.name, st.sheet)}
                                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-md shadow-purple-600/20 transition-all cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      <span>{hasCustom ? 'تعديل' : 'تخصيص'}</span>
                                    </button>

                                    {hasCustom && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteStudentCustomSchedule(st.name, st.sheet)}
                                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl transition-all cursor-pointer"
                                        title="إلغاء الجدول الخاص وإعادته للجدول العام"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* STEP 2: CUSTOM SCHEDULE GENERATOR FOR SELECTED STUDENT */
                    <div className="space-y-6">
                      {/* Top banner of selected student */}
                      <div className="p-3.5 bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border border-purple-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-500/20 text-purple-300 rounded-xl border border-purple-500/30">
                            <UserCheck className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-sm text-slate-100">
                                {selectedStudentForSchedule}
                              </span>
                              {selectedStudentSheetForSchedule && (
                                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full font-mono text-xs font-bold">
                                  رقم الطالب (العمود B): {selectedStudentSheetForSchedule}
                                </span>
                              )}
                              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full text-xs font-bold">
                                {(selectedStudentForSchedule && customSchedulesMap[selectedStudentForSchedule.toLowerCase()]?.schedule?.length) ||
                                 (selectedStudentSheetForSchedule && customSchedulesMap[selectedStudentSheetForSchedule.toLowerCase()]?.schedule?.length)
                                  ? '⚡ جدول خاص مفعل'
                                  : 'جدول عام (افتراضي)'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                              تظهر الآن الإعدادات الخاصة بهذا الطالب فقط، وحفظها يطبق الجدول عليه وحده دون بقية الطلاب.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {((selectedStudentForSchedule && customSchedulesMap[selectedStudentForSchedule.toLowerCase()]?.schedule?.length) ||
                            (selectedStudentSheetForSchedule && customSchedulesMap[selectedStudentSheetForSchedule.toLowerCase()]?.schedule?.length)) ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteStudentCustomSchedule(selectedStudentForSchedule, selectedStudentSheetForSchedule)}
                              className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                              title="إلغاء الجدول الخاص لهذا الطالب وإعادته للجدول العام"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                              <span>إلغاء الجدول الخاص</span>
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => setSelectedStudentForSchedule(null)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
                            <span>العودة لقائمة الطلاب</span>
                          </button>
                        </div>
                      </div>

                      {/* 1. Student Days Selection */}
                      <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="text-slate-200 font-extrabold text-xs flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-mono text-[11px]">1</span>
                            <span>اختر أيام الدراسة الخاصة بهذا الطالب:</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setStudentSelectedDays([0, 1, 2, 3, 4, 5, 6])}
                              className="text-[11px] text-purple-400 hover:underline cursor-pointer"
                            >
                              تحديد الكل
                            </button>
                            <span className="text-slate-600 text-xs">|</span>
                            <button
                              type="button"
                              onClick={() => setStudentSelectedDays([0, 1, 2, 3, 4])}
                              className="text-[11px] text-purple-400 hover:underline cursor-pointer"
                            >
                              أيام العمل
                            </button>
                            <span className="text-slate-600 text-xs">|</span>
                            <button
                              type="button"
                              onClick={() => setStudentSelectedDays([])}
                              className="text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer"
                            >
                              مسح
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                          {DAYS_LIST.map((day) => {
                            const isSelected = studentSelectedDays.includes(day.id);
                            return (
                              <button
                                key={day.id}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setStudentSelectedDays(studentSelectedDays.filter(id => id !== day.id));
                                  } else {
                                    setStudentSelectedDays([...studentSelectedDays, day.id].sort((a, b) => a - b));
                                  }
                                }}
                                className={`p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                                  isSelected
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25 border border-purple-400 ring-2 ring-purple-500/30'
                                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                                }`}
                              >
                                <span>{day.name}</span>
                                {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Program Start Date & Lessons Per Day */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Student Start Date */}
                        <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
                          <label className="text-slate-200 font-extrabold text-xs flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-mono text-[11px]">2</span>
                            <span>تاريخ بداية أول يوم لهذا الطالب:</span>
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={studentStartDate}
                              onChange={(e) => setStudentStartDate(e.target.value)}
                              placeholder="مثال: 2026-08-03 08:00"
                              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-purple-500 font-mono text-xs"
                            />
                            <input
                              type="datetime-local"
                              onChange={(e) => {
                                if (e.target.value) {
                                  setStudentStartDate(e.target.value.replace('T', ' '));
                                }
                              }}
                              className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 cursor-pointer text-xs shrink-0 hover:border-purple-500"
                              title="اختر من التقويم"
                            />
                          </div>
                        </div>

                        {/* Lessons per day for student */}
                        <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
                          <label className="text-slate-200 font-extrabold text-xs flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-mono text-[11px]">3</span>
                            <span>عدد الدروس اليومية لهذا الطالب:</span>
                          </label>
                          <div className="flex items-center gap-3 pt-1">
                            <input
                              type="number"
                              min="1"
                              max="20"
                              value={studentLessonsPerDay}
                              onChange={(e) => setStudentLessonsPerDay(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-28 p-2.5 bg-slate-900 border border-purple-500/30 rounded-xl text-purple-300 font-mono font-extrabold text-center text-sm outline-none focus:border-purple-500"
                            />
                            <span className="text-xs text-slate-300 font-bold">
                              {studentLessonsPerDay === 1 ? 'درس واحد في كل يوم محدد' : `${studentLessonsPerDay} دروس في نفس اليوم المحدد`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 3. Hide Options for Student */}
                      <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                        <label className="text-slate-200 font-extrabold text-xs flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-mono text-[11px]">4</span>
                          <span>طريقة إخفاء الدروس لهذا الطالب:</span>
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                          {/* Mode A: Expire after X Days */}
                          <div
                            onClick={() => setStudentAutoHideMode('days')}
                            className={`p-3.5 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                              studentAutoHideMode === 'days'
                                ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-xs text-amber-300 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                <span>إخفاء حسب عدد الأيام (DD)</span>
                              </span>
                              <input
                                type="radio"
                                checked={studentAutoHideMode === 'days'}
                                onChange={() => setStudentAutoHideMode('days')}
                                className="accent-amber-500 cursor-pointer"
                              />
                            </div>
                            <p className="text-[11px] text-slate-400">
                              يختفي كل درس لهذا الطالب تلقائياً بعد مرور عدد معين من الأيام تحسب من بداية ظهور كل درس.
                            </p>
                            {studentAutoHideMode === 'days' && (
                              <div className="pt-2 border-t border-amber-500/20 flex items-center gap-2">
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="4"
                                  value={studentAutoExpireAfterDays}
                                  onChange={(e) => setStudentAutoExpireAfterDays(e.target.value)}
                                  className="w-20 p-2 bg-slate-950 border border-amber-500/40 rounded-xl text-amber-300 font-mono font-bold text-center text-xs outline-none"
                                />
                                <span className="text-[11px] text-amber-200 font-bold">أيام إخفاء بعد الظهور</span>
                              </div>
                            )}
                          </div>

                          {/* Mode B: Unified End Date */}
                          <div
                            onClick={() => setStudentAutoHideMode('unifiedDate')}
                            className={`p-3.5 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                              studentAutoHideMode === 'unifiedDate'
                                ? 'bg-rose-500/10 border-rose-500/50 ring-1 ring-rose-500/30'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-xs text-rose-300 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-rose-400" />
                                <span>تاريخ إخفاء موحد (DC)</span>
                              </span>
                              <input
                                type="radio"
                                checked={studentAutoHideMode === 'unifiedDate'}
                                onChange={() => setStudentAutoHideMode('unifiedDate')}
                                className="accent-rose-500 cursor-pointer"
                              />
                            </div>
                            <p className="text-[11px] text-slate-400">
                              تاريخ وتوقيت موحد يختفي فيه جميع الدروس لهذا الطالب.
                            </p>
                            {studentAutoHideMode === 'unifiedDate' && (
                              <div className="pt-2 border-t border-rose-500/20 space-y-1">
                                <input
                                  type="text"
                                  placeholder="2026-08-30 23:59"
                                  value={studentAutoUnifiedEndDate}
                                  onChange={(e) => setStudentAutoUnifiedEndDate(e.target.value)}
                                  className="w-full p-2 bg-slate-950 border border-rose-500/40 rounded-xl text-rose-300 font-mono text-xs outline-none"
                                />
                              </div>
                            )}
                          </div>

                          {/* Mode C: Permanent */}
                          <div
                            onClick={() => setStudentAutoHideMode('none')}
                            className={`p-3.5 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                              studentAutoHideMode === 'none'
                                ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-xs text-emerald-300 flex items-center gap-1.5">
                                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                <span>دائم بدون إخفاء</span>
                              </span>
                              <input
                                type="radio"
                                checked={studentAutoHideMode === 'none'}
                                onChange={() => setStudentAutoHideMode('none')}
                                className="accent-emerald-500 cursor-pointer"
                              />
                            </div>
                            <p className="text-[11px] text-slate-400">
                              تبقى جميع دروس هذا الطالب ظاهرة باستمرار.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 4. Real-time Preview Table for Student */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <h4 className="font-extrabold text-xs text-slate-200 flex items-center gap-2">
                            <span>معاينة الجدول المحسوب للطالب ({selectedStudentForSchedule}):</span>
                          </h4>
                          <span className="text-[11px] text-purple-400 font-semibold">
                            محدث تلقائياً بحسب الخيارات أعلاه
                          </span>
                        </div>

                        <div className="border border-slate-800 rounded-2xl bg-slate-950 overflow-hidden shadow-inner max-h-56 overflow-y-auto custom-scrollbar">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-900 text-slate-400 font-bold sticky top-0 border-b border-slate-800">
                              <tr>
                                <th className="py-2.5 px-3 w-12 text-center">#</th>
                                <th className="py-2.5 px-3">عنوان الدرس</th>
                                <th className="py-2.5 px-3">اليوم المحسوب</th>
                                <th className="py-2.5 px-3">تاريخ الظهور (DB)</th>
                                <th className="py-2.5 px-3">شرط الإخفاء (DC / DD)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-mono">
                              {calculateStudentAutoSchedule().map((q, idx) => {
                                const dateObj = new Date(q.startDate ? q.startDate.replace(' ', 'T') : '');
                                const DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                                const dayName = !isNaN(dateObj.getTime()) ? DAY_NAMES[dateObj.getDay()] : '—';

                                return (
                                  <tr key={idx} className="hover:bg-purple-500/5 transition-colors">
                                    <td className="py-2 px-3 text-center text-slate-500 font-bold">{idx + 1}</td>
                                    <td className="py-2 px-3 text-slate-200 font-sans font-extrabold">
                                      {q.word} <span className="text-slate-500 text-[10px] font-mono">({q.comment})</span>
                                    </td>
                                    <td className="py-2 px-3 text-purple-300 font-bold font-sans">
                                      {dayName}
                                    </td>
                                    <td className="py-2 px-3 text-emerald-400 font-bold">
                                      {q.startDate}
                                    </td>
                                    <td className="py-2 px-3 text-amber-300">
                                      {q.endDate ? (
                                        <span className="text-rose-400">إخفاء موحد: {q.endDate}</span>
                                      ) : q.expireAfterDays ? (
                                        <span className="text-amber-400">إخفاء بعد {q.expireAfterDays} أيام</span>
                                      ) : (
                                        <span className="text-slate-500 font-sans">دائم</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Footer Action Buttons */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedStudentForSchedule) {
                        setSelectedStudentForSchedule(null);
                      } else {
                        setShowStudentCustomScheduleModal(false);
                      }
                    }}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                  >
                    {selectedStudentForSchedule ? 'العودة لقائمة الطلاب' : 'إغلاق'}
                  </button>

                  {selectedStudentForSchedule && (
                    <button
                      type="button"
                      onClick={handleSaveStudentCustomSchedule}
                      disabled={studentSelectedDays.length === 0}
                      className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-purple-600/25 cursor-pointer disabled:opacity-50 transition-all active:scale-98"
                    >
                      <Save className="w-4 h-4" />
                      <span>حفظ وتفعيل الجدول الخاص للطالب ({selectedStudentForSchedule}{selectedStudentSheetForSchedule ? ` - رقم ${selectedStudentSheetForSchedule}` : ''})</span>
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
