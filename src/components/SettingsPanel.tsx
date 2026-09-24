import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Settings, Check, AlertCircle, Copy, CheckCircle2, HelpCircle, ExternalLink, Globe } from 'lucide-react';
import { getWebAppUrl } from '../api';

interface SettingsPanelProps {
  onClose: () => void;
  onSave: (url: string) => void;
}

export default function SettingsPanel({ onClose, onSave }: SettingsPanelProps) {
  const [url, setUrl] = useState(getWebAppUrl());
  const [corrSheetId, setCorrSheetId] = useState(() => localStorage.getItem('correctionSheetId') || '1F3hDUfjgBEkUAIOaF66634EWQQ8XZSdyKjlTzrVA25k');
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSave = () => {
    localStorage.setItem('webAppUrl', url);
    localStorage.setItem('correctionSheetId', corrSheetId.trim());
    onSave(url);
    onClose();
  };

  const handleTestConnection = async () => {
    if (!url.trim()) {
      setTestResult({ success: false, message: 'يرجى إدخال رابط صالح أولاً.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`${url.trim()}?action=getWords&sheetName=test_dummy_nonexistent`, {
        method: 'GET',
        redirect: 'follow',
      });
      // Since dummy sheet name might fail or return empty, any JSON response means server is alive!
      const data = await response.json();
      setTestResult({
        success: true,
        message: 'تم الاتصال بالخادم بنجاح! خادم Apps Script نشط ومستعد.',
      });
    } catch (err: any) {
      // Even if it returns error, if we get any CORS redirect response it's good, but let's be realistic:
      console.error('Test connection error:', err);
      setTestResult({
        success: false,
        message: 'فشل الاتصال. يرجى التأكد من نشر الكود كـ Web App بصلاحيات "Anyone" وإتاحة الوصول.',
      });
    } finally {
      setTesting(false);
    }
  };

  const copyCodeToClipboard = () => {
    const code = getFullAppsScriptCode();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="settings-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/60 rounded-3xl p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">إعدادات الاتصال بقاعدة البيانات</h2>
              <p className="text-xs text-slate-400 mt-0.5">اربط تطبيق الويب بجدول بيانات Google Sheets الخاص بك</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-2 hover:bg-slate-800/60 rounded-xl transition-all"
          >
            ✕
          </button>
        </div>

        {/* Input Fields */}
        <div className="space-y-4 mb-6 text-right" dir="rtl">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">رابط تطبيق Google Apps Script (Web App URL):</label>
            <div className="relative">
              <input
                type="url"
                dir="ltr"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-4 py-3.5 bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-200 rounded-xl placeholder-slate-600 outline-none transition-all pr-12 text-sm"
              />
              <Globe className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              معرّف شيت التصحيح الخارجي (Correction Sheet ID):
            </label>
            <div className="relative">
              <input
                type="text"
                dir="ltr"
                value={corrSheetId}
                onChange={(e) => setCorrSheetId(e.target.value)}
                placeholder="1F3hDUfjgBEkUAIOaF66634EWQQ8XZSdyKjlTzrVA25k"
                className="w-full px-4 py-3.5 bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-200 rounded-xl placeholder-slate-600 outline-none transition-all pr-12 text-sm font-mono"
              />
              <Settings className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              يقرأ التطبيق بيانات تصحيح الأستاذ وملاحظات الصوت والصورة من هذا الشيت (ورقة A1).
            </p>
          </div>

          {/* Test & Save Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg shadow-amber-500/10 active:scale-98 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <Check className="w-4.5 h-4.5" />
              <span>حفظ الإعدادات وتطبيق</span>
            </button>
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-slate-200 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
            >
              {testing ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <HelpCircle className="w-4.5 h-4.5 text-amber-400" />
              )}
              <span>فحص الاتصال</span>
            </button>
          </div>

          {/* Test Feedback */}
          {testResult && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl flex items-start gap-3 border ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              )}
              <span className="text-xs font-medium leading-relaxed">{testResult.message}</span>
            </motion.div>
          )}
        </div>

        {/* Detailed Guide */}
        <div className="border-t border-slate-800/80 pt-6 text-right" dir="rtl">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
            <HelpCircle className="w-4.5 h-4.5 text-amber-400" />
            <span>كيف تقوم بإعداد وربط جدول البيانات (Google Sheet)؟</span>
          </h3>

          <ol className="list-decimal list-inside space-y-2.5 text-xs text-slate-400 leading-relaxed pr-1 mb-6">
            <li>أنشئ ملف Google Sheet جديد في حسابك.</li>
            <li>قم بتسمية الصفحات الداخلية بنفس الأسماء الأصلية: <code className="bg-slate-950 text-amber-400 px-1.5 py-0.5 rounded border border-slate-800 font-mono">Profile</code> و <code className="bg-slate-950 text-amber-400 px-1.5 py-0.5 rounded border border-slate-800 font-mono">Contact</code> و <code className="bg-slate-950 text-amber-400 px-1.5 py-0.5 rounded border border-slate-800 font-mono">About</code> و <code className="bg-slate-950 text-amber-400 px-1.5 py-0.5 rounded border border-slate-800 font-mono">Settings</code> و <code className="bg-slate-950 text-amber-400 px-1.5 py-0.5 rounded border border-slate-800 font-mono">Answers</code> بالإضافة لصفحات أرقام الشيتات للدروس.</li>
            <li>من القائمة العلوية لـ Google Sheet، اختر <span className="text-slate-200 font-semibold">Extensions</span> ثم <span className="text-slate-200 font-semibold">Apps Script</span>.</li>
            <li>احذف أي كود موجود هناك، ثم اضغط على الزر أدناه لنسخ كود Apps Script المطور بالكامل، وألصقه في المحرر.</li>
            <li>قم بتغيير معرف الـ Spreadsheet ID في السطر رقم 14 في كود Apps Script ليتطابق مع رابط ملف الشيت الخاص بك.</li>
            <li>اضغط على زر <span className="text-slate-200 font-semibold">Deploy</span> ثم <span className="text-slate-200 font-semibold">New Deployment</span>.</li>
            <li>اختر نوع المشروع <span className="text-slate-200 font-semibold">Web App</span>، واجعل صلاحية الوصول <span className="text-amber-400 font-semibold">"Anyone"</span> لكي يتمكن الطلاب من التسجيل، ثم اضغط Deploy.</li>
            <li>انسخ رابط الـ Web App URL الناتج وضعه في المربع المخصص في أعلى هذه النافذة ثم اضغط حفظ!</li>
          </ol>

          {/* Copy Code Section */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-900 rounded-xl text-amber-400">
                <Copy className="w-4.5 h-4.5" />
              </div>
              <div className="text-right">
                <h4 className="text-xs font-bold text-slate-200">كود Apps Script المطور بالكامل</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">جاهز للنسخ المباشر ويدعم الـ React API بالكامل</p>
              </div>
            </div>
            <button
              onClick={copyCodeToClipboard}
              className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500 text-slate-950 hover:bg-amber-600 active:scale-95'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>تم نسخ الكود!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>نسخ الكود بالكامل</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Full Upgraded Apps Script Code compiled for easy user setup
function getFullAppsScriptCode(): string {
  return `/**
 * Google Apps Script - كود الخلفية المطور لقاعدة بيانات الطلاب والدروس التفاعلية
 * يدعم الاستدعاء كـ API كامل لصفحة الـ React الخارجية بدون مشاكل CORS وبأقصى درجات الحماية والأمان.
 */

var SPREADSHEET_ID = '1967wIJrB-0hVLHxH6rdkZbscO2S7GwxlHObtsmWFnFU'; // معرف جدول البيانات الاحتياطي
var CORRECTION_SPREADSHEET_ID = '1F3hDUfjgBEkUAIOaF66634EWQQ8XZSdyKjlTzrVA25k'; // معرف شيت تصحيح الأستاذ
var DEFAULT_BOT_TOKEN = '8748182366:AAHKxOlInR7aIeS7kP-_KfhpQk4D65dtegY';
var DEFAULT_BOT_USERNAME = 'Httat_bot';
var DEFAULT_TEACHER_CHAT_ID = ''; // معرف الأستاذ الافتراضي (يمكن تركه فارغاً أو تحديده هنا)

// دالة مساعدة لفتح جدول البيانات الحالي تلقائياً دون الاعتماد على المعرف الثابت فقط
function getSpreadsheet() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}
  try {
    if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID) {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    }
  } catch (e2) {}
  return SpreadsheetApp.getActive();
}

// =========================================================================
// دوال الاختبار والتنفيذ اليدوي والمشغلات المباشرة من شريط أدوات Apps Script
// =========================================================================

// 1. إنشاء وتهيئة أوراق التلغرام الأربعة في الشيت بنقرة واحدة
function RUN_SETUP_TELEGRAM_SHEETS() {
  var res = setupTelegramSheets();
  Logger.log('نتيجة التهيئة: ' + JSON.stringify(res));
  return res;
}

// 2. اختبار ربط طالب (شيت #222) مباشرة في الشيت بنقرة واحدة
function TEST_BIND_STUDENT_222() {
  var res = bindTelegramUser({
    studentName: 'حنين',
    sheetNumber: '222',
    chatId: '999888777',
    language: 'ar'
  });
  Logger.log('نتيجة ربط الطالب: ' + JSON.stringify(res));
  return res;
}

function doGet(e) {
  var action = (e && e.parameter) ? e.parameter.action : '';
  var response;
  
  try {
    if (action === 'getWords') {
      var sheetName = e.parameter.sheetName;
      var username = e.parameter.username;
      response = getWords(sheetName, username);
    } else if (action === 'getCorrections') {
      response = getStudentCorrections(e.parameter.username, e.parameter.sheetNumber, e.parameter.corrSheetId || e.parameter.correctionSheetId);
    } else if (action === 'getFullAudioScore') {
      response = { score: getFullAudioScore(e.parameter.comment, e.parameter.sheet_number, e.parameter.username, e.parameter.word) };
    } else if (action === 'getLetterListenScore') {
      response = { score: getLetterListenScore(e.parameter.comment, e.parameter.sheet_number, e.parameter.username, e.parameter.word) };
    } else if (action === 'getRecordingLink') {
      response = { link: getRecordingLink(e.parameter.comment, e.parameter.sheet_number, e.parameter.username, e.parameter.word) };
    } else if (action === 'getImageLink') {
      response = { link: getImageLink(e.parameter.comment, e.parameter.sheet_number, e.parameter.username, e.parameter.word) };
    } else if (action === 'getHeaderConfig' || action === 'getHeader') {
      response = getHeaderConfig();
    } else if (action === 'getAdminQuestions') {
      response = getAdminQuestions();
    } else if (action === 'getAdminAnswers') {
      response = getAdminAnswers();
    } else if (action === 'getTelegramConfig') {
      response = getTelegramConfig();
    } else if (action === 'getTelegramTemplates') {
      response = getTelegramTemplates();
    } else if (action === 'getTelegramUsers') {
      response = getTelegramUsers();
    } else if (action === 'getAllSettingsStudents') {
      response = getAllSettingsStudents();
    } else if (action === 'setupTelegramSheets') {
      response = setupTelegramSheets();
    } else if (action === 'simulateTelegramWebhook') {
      var sheetNum = (e.parameter && e.parameter.sheetNumber) ? e.parameter.sheetNumber : '222';
      var simUpdate = {
        update_id: 123456,
        message: {
          chat: { id: 999888777, first_name: 'طالب تجريبي' },
          from: { id: 999888777, first_name: 'طالب تجريبي' },
          text: '/start S' + sheetNum + '_ar'
        }
      };
      handleTelegramWebhookUpdate(simUpdate);
      response = { success: true, message: 'تمت معالجة محاكاة التلغرام للطالب رقم ' + sheetNum + ' بنجاح ✅' };
    } else {
      // افتراضي: إرجاع البيانات العامة لصفحة الواجهة
      response = getData();
    }
    
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var response;
  try {
    var rawContents = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var payload = JSON.parse(rawContents);

    // --- إذا كان الطلب قادماً من Telegram Webhook مباشرة ---
    if (payload.update_id || payload.message || payload.callback_query) {
      handleTelegramWebhookUpdate(payload);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, success: true, message: 'تمت معالجة التحديث بنجاح' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : payload.action;
    
    if (action === 'simulateTelegramWebhook' || action === 'telegramWebhook') {
      var tgUpdate = payload.update || payload;
      handleTelegramWebhookUpdate(tgUpdate);
      response = { success: true, message: 'تمت معالجة محاكاة التلغرام وحفظ الطالب في الشيت بنجاح' };
    } else if (action === 'loginUser') {
      response = loginUser(payload.username, payload.sheet_number, payload.deviceId, payload.lat, payload.lng);
    } else if (action === 'saveAnswer') {
      response = saveAnswer(payload);
    } else if (action === 'saveFullAudioScore') {
      response = saveFullAudioScore(payload.sheet_number, payload.username, payload.word, payload.score, payload.timestamp, payload.comment);
    } else if (action === 'saveLetterListenScore') {
      response = saveLetterListenScore(payload.sheet_number, payload.username, payload.word, payload.score, payload.timestamp, payload.comment);
    } else if (action === 'uploadImageFromBase64') {
      var link = uploadImageFromBase64(payload.base64Data, payload.mimeType, payload.word, payload.username, payload.sheet_number, payload.comment);
      response = { success: true, link: link };
    } else if (action === 'uploadRecordingFromBase64') {
      var link = uploadRecordingFromBase64(payload.base64Data, payload.mimeType, payload.word, payload.username, payload.sheet_number, payload.comment);
      response = { success: true, link: link };
    } else if (action === 'saveImageLink') {
      saveImageLink(payload.sheet_number, payload.username, payload.comment, payload.link, payload.timestamp, payload.word);
      response = { success: true };
    } else if (action === 'saveRecordingLink') {
      saveRecordingLink(payload.sheet_number, payload.username, payload.comment, payload.link, payload.timestamp, payload.word);
      response = { success: true };
    } else if (action === 'markLessonCompleted') {
      markLessonCompleted(payload.sheetName, payload.lessonIndex, payload.username, payload.comment, payload.word);
      response = { success: true };
    } else if (action === 'unmarkLessonCompleted') {
      unmarkLessonCompleted(payload.sheetName, payload.lessonIndex, payload.username, payload.comment, payload.word);
      response = { success: true };
    } else if (action === 'resetToCompleted') {
      resetToCompleted(payload.sheetName, payload.lessonIndex, payload.username, payload.comment, payload.word);
      response = { success: true };
    } else if (action === 'decrementRetryCount') {
      decrementRetryCount(payload.sheetName, payload.lessonIndex, payload.username, payload.comment, payload.word);
      response = { success: true };
    } else if (action === 'saveAdminQuestion') {
      response = saveAdminQuestion(payload);
    } else if (action === 'deleteAdminQuestion') {
      response = deleteAdminQuestion(payload);
    } else if (action === 'updateAdminAnswer') {
      response = updateAdminAnswer(payload);
    } else if (action === 'saveTelegramConfig') {
      response = saveTelegramConfig(payload);
    } else if (action === 'saveTelegramTemplate' || action === 'saveTelegramTemplates') {
      response = saveTelegramTemplate(payload);
    } else if (action === 'bindTelegramUser') {
      response = bindTelegramUser(payload);
    } else if (action === 'sendTelegramNotification') {
      response = sendTelegramNotification(payload);
    } else if (action === 'setupTelegramSheets') {
      response = setupTelegramSheets();
    } else if (action === 'getAllSettingsStudents') {
      response = getAllSettingsStudents();
    } else {
      response = { success: false, message: 'الإجراء المطلوب غير معروف' };
    }
  } catch (error) {
    response = { success: false, message: error.message };
  }
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ------------------- دوال استدعاء وقراءة البيانات -------------------

function getData() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var profileSheet = ss.getSheetByName('Profile');
  var contactSheet = ss.getSheetByName('Contact');
  var aboutSheet = ss.getSheetByName('About');
  
  var profileData = profileSheet ? profileSheet.getDataRange().getValues() : [];
  var contactData = contactSheet ? contactSheet.getDataRange().getValues() : [];
  var aboutData = aboutSheet ? aboutSheet.getDataRange().getValues() : [];
  
  var buttonsData = [];
  for (var i = 11; i <= 15; i++) {
    if (profileData[i]) {
      buttonsData.push({
        buttonText: profileData[i][1] ? profileData[i][1].toString().trim() : 'زر بدون نص',
        buttonUrl: profileData[i][2] ? profileData[i][2].toString().trim() : '#'
      });
    }
  }
  
  var headerData = {
    logoUrl: profileData[9] && profileData[9][2] ? profileData[9][2].toString().trim() : '',
    mainTitle: profileData[9] && profileData[9][1] ? profileData[9][1].toString().trim() : '',
    description: profileData[10] && profileData[10][1] ? profileData[10][1].toString().trim() : '',
    buttons: buttonsData
  };
  
  return {
    profile: profileData.slice(1),
    contact: contactData.slice(1),
    about: aboutData.slice(1),
    header: headerData
  };
}

function getHeaderConfig() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('header') || ss.getSheetByName('Header');
  if (!sheet) return { title: '', subtitle: '', logoUrl: '', loginLogoUrl: '', buttons: [], socials: {} };
  var data = sheet.getDataRange().getValues();
  if (!data || data.length === 0) return { title: '', subtitle: '', logoUrl: '', loginLogoUrl: '', buttons: [], socials: {} };

  var title = (data.length > 1 && data[1].length > 1 && data[1][1]) ? data[1][1].toString().trim() : '';
  var logoUrl = (data.length > 1 && data[1].length > 2 && data[1][2]) ? data[1][2].toString().trim() : '';
  var loginLogoUrl = (data.length > 1 && data[1].length > 3 && data[1][3]) ? data[1][3].toString().trim() : '';
  var subtitle = (data.length > 2 && data[2].length > 1 && data[2][1]) ? data[2][1].toString().trim() : '';

  // Socials row 2 (index 1): E2 (col 4), F2 (col 5), G2 (col 6), H2 (col 7)
  var facebook = (data.length > 1 && data[1].length > 4 && data[1][4]) ? data[1][4].toString().trim() : '';
  var instagram = (data.length > 1 && data[1].length > 5 && data[1][5]) ? data[1][5].toString().trim() : '';
  var youtube = (data.length > 1 && data[1].length > 6 && data[1][6]) ? data[1][6].toString().trim() : '';
  var line = (data.length > 1 && data[1].length > 7 && data[1][7]) ? data[1][7].toString().trim() : '';

  var buttons = [];
  for (var r = 3; r <= 7 && r < data.length; r++) {
    var btnLabel = (data[r].length > 1 && data[r][1]) ? data[r][1].toString().trim() : 'رابط';
    var btnUrl = (data[r].length > 2 && data[r][2]) ? data[r][2].toString().trim() : '';
    if (btnUrl && btnUrl.length > 0 && btnUrl.toLowerCase() !== 'undefined' && btnUrl.toLowerCase() !== 'null') {
      buttons.push({ label: btnLabel, url: btnUrl });
    }
  }

  return {
    title: title,
    subtitle: subtitle,
    logoUrl: logoUrl,
    loginLogoUrl: loginLogoUrl,
    buttons: buttons,
    socials: {
      facebook: facebook,
      instagram: instagram,
      youtube: youtube,
      line: line
    }
  };
}

function loginUser(username, sheet_number, deviceId, lat, lng) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var settingsSheet = ss.getSheetByName('Settings');
    if (!settingsSheet) return { success: false, message: 'ورقة الإعدادات Settings غير موجودة' };
    var data = settingsSheet.getDataRange().getValues();
    var userRow = -1;
    for (var r = 1; r < data.length; r++) {
      var user = data[r][25] ? data[r][25].toString().trim() : '';
      var sheetNum = data[r][26] ? data[r][26].toString().trim() : '';
      if (user === username && sheetNum === sheet_number) {
        userRow = r + 1;
        break;
      }
    }
    if (userRow === -1) {
      return { success: false, message: 'اسم الطالب أو رقم الورقة غير صحيح' };
    }
    var status = data[userRow - 1][27] ? data[userRow - 1][27].toString().trim() : 'نعم';
    if (status === 'لا') {
      return { success: false, message: 'تم منع الدخول لهذا المستخدم' };
    }
    
    var deviceColumns = [
      {locationCol: 31, deviceCol: 32},
      {locationCol: 33, deviceCol: 34},
      {locationCol: 35, deviceCol: 36},
      {locationCol: 37, deviceCol: 38},
      {locationCol: 39, deviceCol: 40},
      {locationCol: 41, deviceCol: 42},
      {locationCol: 43, deviceCol: 44},
      {locationCol: 45, deviceCol: 46},
      {locationCol: 47, deviceCol: 48},
      {locationCol: 49, deviceCol: 50}
    ];
    var allowedDevices = parseInt(data[userRow - 1][28]) || 1;
    allowedDevices = Math.min(allowedDevices, 10);
    var deviceIndex = -1;
    for (var j = 0; j < allowedDevices; j++) {
      var currentDeviceId = data[userRow - 1][deviceColumns[j].deviceCol - 1] ? data[userRow - 1][deviceColumns[j].deviceCol - 1].toString().trim() : '';
      if (currentDeviceId === deviceId) {
        deviceIndex = j;
        break;
      }
    }
    var registeredCount = 0;
    for (var j = 0; j < allowedDevices; j++) {
      var currentDeviceId = data[userRow - 1][deviceColumns[j].deviceCol - 1] ? data[userRow - 1][deviceColumns[j].deviceCol - 1].toString().trim() : '';
      if (currentDeviceId !== '') {
        registeredCount++;
      }
    }
    if (deviceIndex === -1) {
      if (registeredCount >= allowedDevices) {
        return { success: false, message: 'تم تجاوز عدد الأجهزة المسموحة' };
      }
      for (var j = 0; j < allowedDevices; j++) {
        if (data[userRow - 1][deviceColumns[j].deviceCol - 1] === '') {
          deviceIndex = j;
          break;
        }
      }
    }
    var location = 'غير متاح';
    if (lat && lng) {
      try {
        var geocoder = Maps.newGeocoder().reverseGeocode(lat, lng);
        if (geocoder.results && geocoder.results.length > 0) {
          location = geocoder.results[0].formatted_address;
        }
      } catch (geoErr) {
        location = lat + ',' + lng;
      }
    }
    if (deviceIndex !== -1) {
      settingsSheet.getRange(userRow, deviceColumns[deviceIndex].locationCol).setValue(location);
      settingsSheet.getRange(userRow, deviceColumns[deviceIndex].deviceCol).setValue(deviceId);
    } else {
      return { success: false, message: 'خطأ في تسجيل الجهاز' };
    }
    
    var questionsSheet = ss.getSheetByName('Questions');
    if (!questionsSheet) {
      return { success: false, message: 'ورقة الأسئلة Questions غير موجودة في جدول البيانات' };
    }
    return { success: true, sheetName: sheet_number };
  } catch (e) {
    return { success: false, message: 'خطأ في الدخول: ' + e.message };
  }
}

function formatDriveImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  url = url.trim();
  if (!url) return '';

  var fileId = null;
  var fileDMatch = url.match(new RegExp('/file/d/([a-zA-Z0-9_-]+)'));
  if (fileDMatch && fileDMatch[1]) {
    fileId = fileDMatch[1];
  } else {
    var idMatch = url.match(new RegExp('[?&]id=([a-zA-Z0-9_-]+)'));
    if (idMatch && idMatch[1]) {
      fileId = idMatch[1];
    } else {
      var ucMatch = url.match(new RegExp('googleusercontent\\\\.com/d/([a-zA-Z0-9_-]+)'));
      if (ucMatch && ucMatch[1]) {
        fileId = ucMatch[1];
      }
    }
  }

  if (fileId) {
    return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200';
  }

  return url;
}

function getWords(sheetName, username) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var questionsSheet = ss.getSheetByName('Questions');
  if (!questionsSheet) return [];
  
  var answersSheet = ss.getSheetByName('Answers');
  var answersData = answersSheet ? answersSheet.getDataRange().getValues() : [];
  
  var fullData = questionsSheet.getDataRange().getValues();
  var result = [];
  
  for (var rowIndex = 1; rowIndex < fullData.length; rowIndex++) {
    var row = fullData[rowIndex];
    if (row[0]) {
      var word = row[0].toString().trim(); // A (1)
      var rawLinks = row[1] ? row[1].toString() : ''; // B (2)
      var fullSound = row[2] ? row[2].toString().trim() : ''; // C (3)
      var comment = row[3] ? row[3].toString().trim() : ''; // D (4) - المعرف الربطي للدرس
      var image = row[4] ? formatDriveImageUrl(row[4].toString().trim()) : ''; // E (5)
      var explainSound = row[5] ? row[5].toString().trim() : ''; // F (6)
      var youtubeUrl = row[6] ? row[6].toString().trim() : ''; // G (7)
      var showResult = row[7] ? row[7].toString().trim() : 'نعم'; // H (8)
      var totalQuestionsCount = row[8] ? (parseInt(row[8].toString().trim()) || 0) : 0; // I (9)

      // الإعدادات والمحددات المتقدمة للدرس من ورقة Questions
      var instruction = row[94] ? row[94].toString().trim() : ''; // CQ (95)
      var allowRecording = row[95] ? row[95].toString().trim() : ''; // CR (96)
      var maxRecordingTime = row[97] ? (parseInt(row[97].toString().trim()) || 0) : 0; // CT (98)
      var retryCount = row[98] ? (parseInt(row[98].toString().trim()) || 0) : 0; // CU (99)
      var showPrevButton = row[100] ? row[100].toString().trim() : ''; // CW (101)
      var allowUpload = row[102] ? row[102].toString().trim() : ''; // CY (103)
      var defaultRetryResetCount = row[104] ? (parseInt(row[104].toString().trim()) || 0) : 0; // DA (105)
      var startDate = row[105] ? (row[105] instanceof Date ? Utilities.formatDate(row[105], Session.getScriptTimeZone() || "GMT", "yyyy-MM-dd HH:mm") : row[105].toString().trim()) : ''; // DB (106)
      var endDate = row[106] ? (row[106] instanceof Date ? Utilities.formatDate(row[106], Session.getScriptTimeZone() || "GMT", "yyyy-MM-dd HH:mm") : row[106].toString().trim()) : ''; // DC (107)
      var expireAfterDays = row[107] ? (parseInt(row[107].toString().trim()) || '') : ''; // DD (108)

      // قراءة حالة إكمال الدرس وعدد الإعادات المتبقية للطالب المنسوب من ورقة Answers (العمود AO / Column 41 / index 40 و العمود AP / Column 42 / index 41)
      var completed = '';
      var studentRetryResetCount = null;
      if (answersData.length > 1 && comment) {
        for (var a = 1; a < answersData.length; a++) {
          var aSheetNum = answersData[a][0] ? answersData[a][0].toString().trim() : '';
          var aUser = answersData[a][1] ? answersData[a][1].toString().trim() : '';
          var aComment = answersData[a][2] ? answersData[a][2].toString().trim() : '';
          
          if ((!sheetName || aSheetNum === sheetName.toString().trim()) &&
              (!username || aUser === username.toString().trim()) &&
              aComment === comment) {
            completed = answersData[a][40] ? answersData[a][40].toString().trim() : ''; // العمود AO (41)
            if (answersData[a][41] !== undefined && answersData[a][41] !== null && answersData[a][41] !== '') {
              studentRetryResetCount = parseInt(answersData[a][41].toString().trim());
            }
            break;
          }
        }
      }

      var retryResetCount = (studentRetryResetCount !== null && !isNaN(studentRetryResetCount)) ? studentRetryResetCount : defaultRetryResetCount;

      var letterSounds = rawLinks
        .split(/[,،]\\s*/)
        .map(function(s) { return s.trim(); })
        .filter(function(s) { return s.indexOf('http') === 0; });

      // أسئلة الفيديو (الأعمدة J إلى CF - index 9 إلى 83 - 15 سؤالاً، كل سؤال 5 أعمدة)
      var questions = [];
      var videoSlot = 0;
      for (var j = 9; j < row.length && videoSlot < 15; j += 5, videoSlot++) {
        if (row[j] !== undefined && row[j] !== null && row[j].toString().trim() !== '') {
          var time = parseFloat(row[j].toString().trim());
          if (isNaN(time)) time = 0;
          var questionImage = row[j + 1] ? formatDriveImageUrl(row[j + 1].toString().trim()) : '';
          var questionText = row[j + 2] ? row[j + 2].toString().trim() : '';
          var optionsStr = row[j + 3] ? row[j + 3].toString().trim() : '';
          var correctAnswer = row[j + 4] ? row[j + 4].toString().trim() : '';

          if (questionText !== '' || questionImage !== '') {
            var options = [];
            if (optionsStr && optionsStr !== 'نص') {
              options = optionsStr.split(',');
            }
            questions.push({
              slotIndex: videoSlot,
              time: time,
              image: questionImage,
              question: questionText,
              options: options.map(function(opt) { return opt.trim(); }),
              correctAnswer: correctAnswer
            });
          }
        }
      }

      // أسئلة الصوت والاستماع (الأعمدة CG إلى CP - index 84 إلى 93 - سؤالان)
      var audioQuestions = [];
      var audioSlot = 0;
      for (var j = 84; j < row.length && audioSlot < 2; j += 5, audioSlot++) {
        if (row[j] !== undefined && row[j] !== null && row[j].toString().trim() !== '') {
          var time = parseFloat(row[j].toString().trim());
          if (isNaN(time)) time = 0;
          var questionImage = row[j + 1] ? formatDriveImageUrl(row[j + 1].toString().trim()) : '';
          var questionText = row[j + 2] ? row[j + 2].toString().trim() : '';
          var optionsStr = row[j + 3] ? row[j + 3].toString().trim() : '';
          var correctAnswer = row[j + 4] ? row[j + 4].toString().trim() : '';

          if (questionText !== '' || questionImage !== '') {
            var options = [];
            if (optionsStr && optionsStr !== 'نص') {
              options = optionsStr.split(',');
            }
            audioQuestions.push({
              slotIndex: audioSlot,
              time: time,
              image: questionImage,
              question: questionText,
              options: options.map(function(opt) { return opt.trim(); }),
              correctAnswer: correctAnswer
            });
          }
        }
      }

      result.push({
        word: word,
        fullSound: fullSound,
        letterSounds: letterSounds,
        image: image,
        comment: comment,
        explainSound: explainSound,
        youtubeUrl: youtubeUrl,
        questions: questions,
        audioQuestions: audioQuestions,
        showResult: showResult,
        instruction: instruction,
        allowRecording: allowRecording,
        maxRecordingTime: maxRecordingTime,
        retryCount: retryCount,
        completed: completed,
        showPrevButton: showPrevButton,
        allowUpload: allowUpload,
        retryResetCount: retryResetCount,
        totalQuestionsCount: totalQuestionsCount,
        startDate: startDate,
        endDate: endDate,
        expireAfterDays: expireAfterDays
      });
    }
  }
  return result;
}

// ------------------- دوال مساعدة للبحث وإنشاء الصفوف -------------------

function findOrCreateAnswersRow(sheet, sheet_number, username, comment, word, youtubeUrl, explainSound) {
  var data = sheet.getDataRange().getValues();
  var rowNum = -1;
  
  var cleanSheetNum = sheet_number ? sheet_number.toString().trim() : '';
  var cleanUser = username ? username.toString().trim() : '';
  var cleanComment = comment ? comment.toString().trim() : '';
  var cleanWord = word ? word.toString().trim() : '';

  for (var r = 1; r < data.length; r++) {
    var aSheet = data[r][0] ? data[r][0].toString().trim() : '';
    var aUser = data[r][1] ? data[r][1].toString().trim() : '';
    var aComment = data[r][2] ? data[r][2].toString().trim() : '';
    var aWord = data[r][26] ? data[r][26].toString().trim() : ''; // العمود AA (27)

    if ((!cleanSheetNum || aSheet === cleanSheetNum) && (!cleanUser || aUser === cleanUser)) {
      var match = false;
      if (cleanComment !== '' && aComment === cleanComment) {
        match = true;
      } else if (cleanWord !== '' && (aComment === cleanWord || aWord === cleanWord)) {
        match = true;
      } else if (cleanComment !== '' && aWord === cleanComment) {
        match = true;
      }
      
      if (match) {
        rowNum = r + 1;
        if (cleanComment !== '' && aComment !== cleanComment) {
          sheet.getRange(rowNum, 3).setValue(cleanComment);
        }
        if (cleanWord !== '' && aWord !== cleanWord) {
          sheet.getRange(rowNum, 27).setValue(cleanWord);
        }
        break;
      }
    }
  }

  if (rowNum === -1) {
    var newRow = [cleanSheetNum, cleanUser, cleanComment, youtubeUrl ? youtubeUrl.toString().trim() : ''];
    for (var i = 0; i < 15; i++) newRow.push('');
    newRow.push('', '', explainSound ? explainSound.toString().trim() : '');
    for (var i = 0; i < 2; i++) newRow.push('');
    newRow.push('', '', cleanWord, '', '', '', '', '', '', '', 0, 0, 0, 0, '', '', '');
    sheet.appendRow(newRow);
    rowNum = sheet.getLastRow();
  }

  return rowNum;
}

function findAnswersRowOnly(sheet, sheet_number, username, comment, word) {
  var data = sheet.getDataRange().getValues();
  var cleanSheetNum = sheet_number ? sheet_number.toString().trim() : '';
  var cleanUser = username ? username.toString().trim() : '';
  var cleanComment = comment ? comment.toString().trim() : '';
  var cleanWord = word ? word.toString().trim() : '';

  for (var r = 1; r < data.length; r++) {
    var aSheet = data[r][0] ? data[r][0].toString().trim() : '';
    var aUser = data[r][1] ? data[r][1].toString().trim() : '';
    var aComment = data[r][2] ? data[r][2].toString().trim() : '';
    var aWord = data[r][26] ? data[r][26].toString().trim() : '';

    if ((!cleanSheetNum || aSheet === cleanSheetNum) && (!cleanUser || aUser === cleanUser)) {
      if (cleanComment !== '' && aComment === cleanComment) return r + 1;
      if (cleanWord !== '' && (aComment === cleanWord || aWord === cleanWord)) return r + 1;
      if (cleanComment !== '' && aWord === cleanComment) return r + 1;
    }
  }
  return -1;
}

// ------------------- دوال حفظ الأداء والإجابات -------------------

function saveAnswer(payload) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheetName = 'Answers';
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = ['رقم الطالب', 'اسم الطالب', 'الموضوع', 'رابط الفيديو'];
    for (var i = 1; i <= 15; i++) { headers.push('النتيجة ' + i); }
    headers.push('التوقيت', 'فراغ', 'رابط الصوت');
    for (var i = 1; i <= 2; i++) { headers.push('النتيجة ' + i); }
    headers.push('التوقيت', 'فراغ', 'موضوع الصوت', 'درجة الاستماع', 'درجة استماع الحروف', 'رابط التسجيل', 'تاريخ الإرسال', 'فراغ', 'رابط الصورة', 'تاريخ إرسال الصورة', 'عدد إرسال فيديو', 'عدد إرسال صوت', 'عدد إرسال تسجيل', 'عدد إرسال صورة', 'النتيجة الكلية', 'الدرجة النهائية', 'حالة الدرس');
    sheet.appendRow(headers);
  }

  var rowNum = findOrCreateAnswersRow(sheet, payload.sheet_number, payload.username, payload.comment, payload.word, payload.youtubeUrl, payload.explainSound);
  
  if (payload.youtubeUrl && payload.youtubeUrl.trim()) {
    sheet.getRange(rowNum, 4).setValue(payload.youtubeUrl.trim());
  }
  if (payload.explainSound && payload.explainSound.trim()) {
    sheet.getRange(rowNum, 22).setValue(payload.explainSound.trim());
  }

  var result = '';
  if (payload.isCorrect === null) {
    result = payload.selectedAnswer.trim();
  } else {
    result = payload.isCorrect ? 'صح' : 'خطأ';
  }
  
  if (payload.type === 'video') {
    var col = 5 + payload.questionIndex;
    sheet.getRange(rowNum, col).setValue(result);
    if (payload.questionIndex === 0) {
      sheet.getRange(rowNum, 20).setValue(payload.timestamp);
      var currentVideoCount = sheet.getRange(rowNum, 35).getValue() || 0;
      sheet.getRange(rowNum, 35).setValue(currentVideoCount + 1);
    }
    calculateResults(payload.sheet_number, payload.comment, rowNum);
  } else if (payload.type === 'audio') {
    var col = 23 + payload.questionIndex;
    sheet.getRange(rowNum, col).setValue(result);
    if (payload.questionIndex === 0) {
      sheet.getRange(rowNum, 25).setValue(payload.timestamp);
      var currentAudioCount = sheet.getRange(rowNum, 36).getValue() || 0;
      sheet.getRange(rowNum, 36).setValue(currentAudioCount + 1);
    }
    calculateSectionTwo(payload.sheet_number, payload.comment, rowNum);
  }
  return { success: true };
}

function calculateResults(sheet_number, comment, rowNum) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var questionsSheet = ss.getSheetByName('Questions');
  var answersSheet = ss.getSheetByName('Answers');
  if (!answersSheet) return;

  var totalQuestions = 0;
  if (questionsSheet && comment) {
    var qData = questionsSheet.getDataRange().getValues();
    for (var r = 1; r < qData.length; r++) {
      if (qData[r][3] && qData[r][3].toString().trim() === comment.toString().trim()) {
        totalQuestions = parseInt(qData[r][8]) || 0; // العمود I (9)
        break;
      }
    }
  }

  var answersRow = answersSheet.getRange(rowNum, 5, 1, 15).getValues()[0];
  var correct = 0;
  var wrong = 0;
  var answeredCount = 0;

  for (var col = 0; col < 15; col++) {
    var value = (answersRow[col] || "").toString().trim().toLowerCase();
    if (value === "") continue;
    answeredCount++;
    if (value === "صح" || value === "صحيح" || value === "true" || value === "✓") {
      correct++;
    } else if (value === "خطأ" || value === "خاطئ" || value === "false" || value === "✗") {
      wrong++;
    }
  }

  if (totalQuestions <= 0) {
    totalQuestions = answeredCount > 0 ? answeredCount : 15;
  }

  var noAnswer = totalQuestions - (correct + wrong);
  if (noAnswer < 0) noAnswer = 0;
  var percentage = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;

  var resultText = "عدد الأسئلة " + totalQuestions + " - الصحيحة " + correct + " والخاطئة " + wrong;
  if (noAnswer > 0) {
    resultText += " و " + noAnswer + " لا يوجد إجابة";
  }
  resultText += " وحصلت على " + percentage + "%";

  answersSheet.getRange(rowNum, 21).setValue(resultText); // العمود U (21)
  calculatePercentages(answersSheet, rowNum);
}

function calculateSectionTwo(sheet_number, comment, rowNum) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var answersSheet = ss.getSheetByName('Answers');
  if (!answersSheet) return;
  var answersRow = answersSheet.getRange(rowNum, 23, 1, 2).getValues()[0];
  var w = (answersRow[0] || "").toString().trim().toLowerCase();
  var x = (answersRow[1] || "").toString().trim().toLowerCase();
  var wStatus = getStatus(w);
  var xStatus = getStatus(x);
  var score = 0;
  var total = 2;
  var resultText = "";
  
  if (wStatus === "text" || xStatus === "text") {
    total = 1;
    if (wStatus === "correct" || xStatus === "correct") {
      score = 1;
      resultText = "1 صح = 100%";
    } else if (wStatus === "wrong" || xStatus === "wrong") {
      score = 0;
      resultText = "1 خطأ = 0%";
    } else {
      score = 0;
      resultText = "0%";
    }
  } else {
    if (wStatus === "correct") score += 0.5;
    if (xStatus === "correct") score += 0.5;
    if (score === 1) {
      resultText = "2 صح = 100%";
    } else if (score === 0.5) {
      resultText = "1 صح و 1 خطأ = 50%";
    } else {
      resultText = "0%";
    }
  }
  if (w === "" && x === "") {
    resultText = "";
  }
  answersSheet.getRange(rowNum, 26).setValue(resultText);
  calculatePercentages(answersSheet, rowNum);
}

function getStatus(value) {
  if (value === "") return "empty";
  if (value === "صح" || value === "صحيح" || value === "true" || value === "✓") return "correct";
  if (value === "خطأ" || value === "خاطئ" || value === "false" || value === "✗") return "wrong";
  return "text";
}

function getFullAudioScore(comment, sheet_number, username, word) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Answers');
  if (!sheet) return 0;
  var rowNum = findAnswersRowOnly(sheet, sheet_number, username, comment, word);
  if (rowNum !== -1) {
    var scoreStr = sheet.getRange(rowNum, 28).getValue(); // Column AB (28)
    if (scoreStr) {
      var score = parseFloat(scoreStr.toString().replace('%', ''));
      return isNaN(score) ? 0 : score;
    }
  }
  return 0;
}

function saveFullAudioScore(sheet_number, username, word, score, timestamp, comment) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Answers');
  if (!sheet) return { success: false };

  var rowNum = findOrCreateAnswersRow(sheet, sheet_number, username, comment, word);

  sheet.getRange(rowNum, 27).setValue(word ? word.trim() : '');
  sheet.getRange(rowNum, 28).setValue(score + '%');
  calculatePercentages(sheet, rowNum);
  return { success: true };
}

function getLetterListenScore(comment, sheet_number, username, word) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Answers');
  if (!sheet) return 0;
  var rowNum = findAnswersRowOnly(sheet, sheet_number, username, comment, word);
  if (rowNum !== -1) {
    var scoreStr = sheet.getRange(rowNum, 29).getValue(); // Column AC (29)
    if (scoreStr) {
      scoreStr = arabicToWestern(scoreStr.toString());
      scoreStr = scoreStr.replace(/%|٪/g, '').trim();
      var score = parseFloat(scoreStr);
      return isNaN(score) ? 0 : score;
    }
  }
  return 0;
}

function saveLetterListenScore(sheet_number, username, word, score, timestamp, comment) {
  if (score !== 100) return { success: false };
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Answers');
  if (!sheet) return { success: false };

  var rowNum = findOrCreateAnswersRow(sheet, sheet_number, username, comment, word);

  sheet.getRange(rowNum, 29).setValue(score + '%');
  calculatePercentages(sheet, rowNum);
  return { success: true };
}

function getRecordingLink(comment, sheet_number, username, word) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Answers');
  if (!sheet) return '';
  var rowNum = findAnswersRowOnly(sheet, sheet_number, username, comment, word);
  if (rowNum !== -1) {
    return sheet.getRange(rowNum, 30).getValue() ? sheet.getRange(rowNum, 30).getValue().toString().trim() : ''; // Column AD (30)
  }
  return '';
}

function getImageLink(comment, sheet_number, username, word) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Answers');
  if (!sheet) return '';
  var rowNum = findAnswersRowOnly(sheet, sheet_number, username, comment, word);
  if (rowNum !== -1) {
    return sheet.getRange(rowNum, 32).getValue() ? sheet.getRange(rowNum, 32).getValue().toString().trim() : ''; // Column AF (32)
  }
  return '';
}

// ------------------- دوال رفع ملفات الوسائط -------------------

function uploadImageFromBase64(base64Data, mimeType, word, username, sheet_number, comment) {
  try {
    var folderId = '1XRSjYZMT8j_0t5U9Jtdr8JNN1B2P2iL5';
    var actualMime = mimeType || 'image/jpeg';
    var actualWord = word || 'صورة';
    var actualUsername = username || 'طالب';
    var actualSheetNumber = sheet_number || '1';
    var actualComment = comment || getCommentForWord(actualSheetNumber, actualWord);
    
    var timestamp = new Date().toISOString().replace(/:/g, '-');
    var filename = 'صورة_' + actualUsername + '_' + actualSheetNumber + '_' + actualWord + '_' + timestamp + '.jpg';
    
    var decodedBytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decodedBytes, actualMime, filename);
    
    var folder = DriveApp.getFolderById(folderId);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    saveImageLink(actualSheetNumber, actualUsername, actualComment, file.getUrl(), new Date().toLocaleString(), actualWord);
    
    return file.getUrl();
  } catch (e) {
    throw new Error("فشل رفع الصورة إلى جوجل درايف: " + e.message);
  }
}

function uploadRecordingFromBase64(base64Data, mimeType, word, username, sheet_number, comment) {
  try {
    var folderId = '1XRSjYZMT8j_0t5U9Jtdr8JNN1B2P2iL5';
    var actualMime = mimeType || 'audio/webm';
    var actualWord = word || 'واجب';
    var actualUsername = username || 'طالب';
    var actualSheetNumber = sheet_number || '1';
    var actualComment = comment || getCommentForWord(actualSheetNumber, actualWord);
    
    var timestamp = new Date().toISOString().replace(/:/g, '-');
    var ext = 'webm';
    if (actualMime.indexOf('mp4') !== -1 || actualMime.indexOf('m4a') !== -1 || actualMime.indexOf('aac') !== -1) ext = 'm4a';
    else if (actualMime.indexOf('wav') !== -1) ext = 'wav';
    else if (actualMime.indexOf('ogg') !== -1) ext = 'ogg';
    else if (actualMime.indexOf('mpeg') !== -1 || actualMime.indexOf('mp3') !== -1) ext = 'mp3';
    
    var filename = 'تسجيل_' + actualUsername + '_' + actualSheetNumber + '_' + actualWord + '_' + timestamp + '.' + ext;
    var decodedBytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decodedBytes, actualMime, filename);
    
    var folder = DriveApp.getFolderById(folderId);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    saveRecordingLink(actualSheetNumber, actualUsername, actualComment, file.getUrl(), new Date().toLocaleString(), actualWord);
    
    return file.getUrl();
  } catch (e) {
    throw new Error("فشل رفع التسجيل الصوتي إلى جوجل درايف: " + e.message);
  }
}

function saveImageLink(sheet_number, username, comment, link, timestamp, word) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Answers');
  if (!sheet) return;
  
  var rowNum = findOrCreateAnswersRow(sheet, sheet_number, username, comment, word);
  
  sheet.getRange(rowNum, 32).setValue(link.trim());
  sheet.getRange(rowNum, 33).setValue(timestamp);
  var currentImageCount = sheet.getRange(rowNum, 38).getValue() || 0;
  var newCount = currentImageCount + 1;
  sheet.getRange(rowNum, 38).setValue(newCount);
  calculatePercentages(sheet, rowNum);

  // إشعار التعديل يُرسل فقط إذا كان هذا إعادة رفع للواجب بعد تصحيحه (إعادة)، أما في التسليم الأول فينتظر اكتمال الدرس كاملاً (AO = 'تم')
  var currentAO = (sheet.getRange(rowNum, 41).getValue() || '').toString().trim();
  if (newCount > 1 && (currentAO === 'اعادة' || currentAO === 'إعادة' || currentAO === 'تم')) {
    notifyOnHomeworkSubmission(sheet, rowNum, true, 'image');
  }
}

function saveRecordingLink(sheet_number, username, comment, link, timestamp, word) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Answers');
  if (!sheet) return;
  
  var rowNum = findOrCreateAnswersRow(sheet, sheet_number, username, comment, word);
  
  sheet.getRange(rowNum, 30).setValue(link.trim());
  sheet.getRange(rowNum, 31).setValue(timestamp);
  var currentRecordingCount = sheet.getRange(rowNum, 37).getValue() || 0;
  var newCount = currentRecordingCount + 1;
  sheet.getRange(rowNum, 37).setValue(newCount);
  calculatePercentages(sheet, rowNum);

  // إشعار التعديل يُرسل فقط إذا كان هذا إعادة رفع للتسجيل بعد تصحيحه (إعادة)، أما في التسليم الأول فينتظر اكتمال الدرس كاملاً (AO = 'تم')
  var currentAO = (sheet.getRange(rowNum, 41).getValue() || '').toString().trim();
  if (newCount > 1 && (currentAO === 'اعادة' || currentAO === 'إعادة' || currentAO === 'تم')) {
    notifyOnHomeworkSubmission(sheet, rowNum, true, 'sound');
  }
}

// ------------------- تتبع اكتمال الدروس ودرجات الطالب -------------------

function markLessonCompleted(sheetName, lessonIndex, username, comment, word) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var answersSheet = ss.getSheetByName('Answers');
  if (!answersSheet) return;

  var rowNum = findOrCreateAnswersRow(answersSheet, sheetName, username, comment, word);

  var defaultCount = 0;
  var questionsSheet = ss.getSheetByName('Questions');
  if (questionsSheet && comment) {
    var qData = questionsSheet.getDataRange().getValues();
    for (var q = 1; q < qData.length; q++) {
      if (qData[q][3] && qData[q][3].toString().trim() === comment.toString().trim()) {
        defaultCount = parseInt(qData[q][104]) || 0; // العمود DA (105)
        break;
      }
    }
  }

  if (rowNum !== -1) {
    answersSheet.getRange(rowNum, 41).setValue('تم'); // العمود AO (41)

    var currentAp = answersSheet.getRange(rowNum, 42).getValue();
    if (currentAp === '' || currentAp === null || currentAp === undefined) {
      answersSheet.getRange(rowNum, 42).setValue(defaultCount); // العمود AP (42)
    }

    // إرسال إشعار التلغرام عند اكتمال وحفظ الدرس (العمود AO أصبح 'تم')
    var imgCount = parseInt(answersSheet.getRange(rowNum, 38).getValue()) || 0;
    var recCount = parseInt(answersSheet.getRange(rowNum, 37).getValue()) || 0;
    var isResubmission = (imgCount > 1 || recCount > 1);
    notifyOnHomeworkSubmission(answersSheet, rowNum, isResubmission);
  }
}

function unmarkLessonCompleted(sheetName, lessonIndex, username, comment, word) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var answersSheet = ss.getSheetByName('Answers');
  if (!answersSheet) return;

  var rowNum = findAnswersRowOnly(answersSheet, sheetName, username, comment, word);

  if (rowNum !== -1) {
    answersSheet.getRange(rowNum, 41).setValue('اعادة'); // العمود AO (41)
  }
}

function resetToCompleted(sheetName, lessonIndex, username, comment, word) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var answersSheet = ss.getSheetByName('Answers');
  if (!answersSheet) return;

  var rowNum = findAnswersRowOnly(answersSheet, sheetName, username, comment, word);
  if (rowNum !== -1) {
    var currentValue = answersSheet.getRange(rowNum, 41).getValue().toString().trim();
    if (currentValue === 'اعادة' || currentValue === 'إعادة') {
      answersSheet.getRange(rowNum, 41).setValue('تم');
    }
  }
}

function decrementRetryCount(sheetName, lessonIndex, username, comment, word) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var answersSheet = ss.getSheetByName('Answers');
  if (!answersSheet) return;

  var rowNum = findOrCreateAnswersRow(answersSheet, sheetName, username, comment, word);

  var defaultCount = 0;
  var questionsSheet = ss.getSheetByName('Questions');
  if (questionsSheet && comment) {
    var qData = questionsSheet.getDataRange().getValues();
    for (var q = 1; q < qData.length; q++) {
      if (qData[q][3] && qData[q][3].toString().trim() === comment.toString().trim()) {
        defaultCount = parseInt(qData[q][104]) || 0; // العمود DA (105)
        break;
      }
    }
  }

  if (rowNum !== -1) {
    var currentAp = answersSheet.getRange(rowNum, 42).getValue();
    var currentVal = (currentAp !== '' && currentAp !== null && currentAp !== undefined) ? parseInt(currentAp) : defaultCount;
    if (isNaN(currentVal)) currentVal = defaultCount;

    var newVal = Math.max(0, currentVal - 1);
    answersSheet.getRange(rowNum, 42).setValue(newVal); // العمود AP (42) في ورقة Answers
  }
}

// ------------------- دوال التحكم الإداري (قسم الإدارة) -------------------

function getAdminQuestions() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Questions');
  if (!sheet) return [];
  var fullData = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < fullData.length; i++) {
    var row = fullData[i];
    if (row[0] || row[3]) {
      // أسئلة الفيديو (الأعمدة J إلى CF - index 9 إلى 83 - 15 سؤالاً، كل سؤال 5 أعمدة)
      var questions = [];
      var count = 0;
      for (var j = 9; j < row.length && count < 15; j += 5) {
        if (row[j] !== undefined && row[j] !== null && row[j] !== '' && row[j + 2]) {
          var time = parseFloat(row[j].toString().trim()) || 0;
          var questionImage = row[j + 1] ? formatDriveImageUrl(row[j + 1].toString().trim()) : '';
          var questionText = row[j + 2] ? row[j + 2].toString().trim() : '';
          var optionsStr = row[j + 3] ? row[j + 3].toString().trim() : 'نص';
          var correctAnswer = row[j + 4] ? row[j + 4].toString().trim() : '';
          questions.push({
            time: time,
            image: questionImage,
            question: questionText,
            options: optionsStr,
            correctAnswer: correctAnswer
          });
          count++;
        }
      }

      // أسئلة الصوت والاستماع (الأعمدة CG إلى CP - index 84 إلى 93 - سؤالان)
      var audioQuestions = [];
      count = 0;
      for (var j = 84; j < row.length && count < 2; j += 5) {
        if (row[j] !== undefined && row[j] !== null && row[j] !== '' && row[j + 2]) {
          var time = parseFloat(row[j].toString().trim()) || 0;
          var questionImage = row[j + 1] ? formatDriveImageUrl(row[j + 1].toString().trim()) : '';
          var questionText = row[j + 2] ? row[j + 2].toString().trim() : '';
          var optionsStr = row[j + 3] ? row[j + 3].toString().trim() : 'نص';
          var correctAnswer = row[j + 4] ? row[j + 4].toString().trim() : '';
          audioQuestions.push({
            time: time,
            image: questionImage,
            question: questionText,
            options: optionsStr,
            correctAnswer: correctAnswer
          });
          count++;
        }
      }

      result.push({
        rowIndex: i + 1,
        word: row[0] ? row[0].toString().trim() : '',
        rawLinks: row[1] ? row[1].toString().trim() : '',
        fullSound: row[2] ? row[2].toString().trim() : '',
        comment: row[3] ? row[3].toString().trim() : '',
        image: row[4] ? formatDriveImageUrl(row[4].toString().trim()) : '',
        explainSound: row[5] ? row[5].toString().trim() : '',
        youtubeUrl: row[6] ? row[6].toString().trim() : '',
        showResult: row[7] ? row[7].toString().trim() : 'نعم',
        totalQuestionsCount: row[8] ? (parseInt(row[8].toString().trim()) || 0) : 0,
        questions: questions,
        audioQuestions: audioQuestions,
        instruction: row[94] ? row[94].toString().trim() : '',
        allowRecording: row[95] ? row[95].toString().trim() : '',
        maxRecordingTime: row[97] ? (parseInt(row[97].toString().trim()) || 0) : 0,
        retryCount: row[98] ? (parseInt(row[98].toString().trim()) || 0) : 0,
        showPrevButton: row[100] ? row[100].toString().trim() : '',
        allowUpload: row[102] ? row[102].toString().trim() : '',
        defaultRetryResetCount: row[104] ? (parseInt(row[104].toString().trim()) || 0) : 0,
        startDate: row[105] ? (row[105] instanceof Date ? Utilities.formatDate(row[105], Session.getScriptTimeZone() || "GMT", "yyyy-MM-dd HH:mm") : row[105].toString().trim()) : '',
        endDate: row[106] ? (row[106] instanceof Date ? Utilities.formatDate(row[106], Session.getScriptTimeZone() || "GMT", "yyyy-MM-dd HH:mm") : row[106].toString().trim()) : '',
        expireAfterDays: row[107] ? (parseInt(row[107].toString().trim()) || '') : ''
      });
    }
  }
  return result;
}

function saveAdminQuestion(payload) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Questions');
  if (!sheet) return { success: false, message: 'ورقة الأسئلة غير موجودة' };

  var data = sheet.getDataRange().getValues();
  var rowIndex = payload.rowIndex;
  var targetRow = -1;

  if (rowIndex && rowIndex > 1) {
    targetRow = rowIndex;
  }

  if (targetRow === -1 && payload.comment) {
    var searchComment = payload.comment.toString().trim();
    if (searchComment) {
      for (var r = 1; r < data.length; r++) {
        if (data[r][3] && data[r][3].toString().trim() === searchComment) {
          targetRow = r + 1;
          break;
        }
      }
    }
  }

  if (targetRow === -1) {
    var lastOccupiedRow = 1;
    for (var i = data.length - 1; i >= 0; i--) {
      var rData = data[i];
      if ((rData[0] !== undefined && rData[0] !== null && rData[0].toString().trim() !== '') ||
          (rData[3] !== undefined && rData[3] !== null && rData[3].toString().trim() !== '')) {
        lastOccupiedRow = i + 1;
        break;
      }
    }
    targetRow = lastOccupiedRow + 1;
  }

  var rowValues = [];
  for (var k = 0; k < 108; k++) {
    rowValues.push('');
  }

  if (targetRow <= data.length && data[targetRow - 1]) {
    var existingRow = data[targetRow - 1];
    for (var k = 0; k < Math.min(existingRow.length, 108); k++) {
      rowValues[k] = existingRow[k];
    }
  }

  rowValues[0] = payload.word || ''; // A
  rowValues[1] = payload.rawLinks || ''; // B
  rowValues[2] = payload.fullSound || ''; // C
  rowValues[3] = payload.comment || ''; // D
  rowValues[4] = payload.image || ''; // E
  rowValues[5] = payload.explainSound || ''; // F
  rowValues[6] = payload.youtubeUrl || ''; // G
  rowValues[7] = payload.showResult || 'نعم'; // H
  rowValues[8] = payload.totalQuestionsCount || 0; // I

  for (var vIdx = 9; vIdx <= 83; vIdx++) {
    rowValues[vIdx] = '';
  }
  if (payload.questions && payload.questions.length > 0) {
    for (var qIdx = 0; qIdx < Math.min(payload.questions.length, 15); qIdx++) {
      var q = payload.questions[qIdx];
      var startIdx = 9 + (qIdx * 5);
      rowValues[startIdx] = q.time !== undefined ? q.time : 0;
      rowValues[startIdx + 1] = q.image || '';
      rowValues[startIdx + 2] = q.question || '';
      rowValues[startIdx + 3] = q.options || 'نص';
      rowValues[startIdx + 4] = q.correctAnswer || '';
    }
  }

  for (var aIdx = 84; aIdx <= 93; aIdx++) {
    rowValues[aIdx] = '';
  }
  if (payload.audioQuestions && payload.audioQuestions.length > 0) {
    for (var aIdx = 0; aIdx < Math.min(payload.audioQuestions.length, 2); aIdx++) {
      var aq = payload.audioQuestions[aIdx];
      var startIdx = 84 + (aIdx * 5);
      rowValues[startIdx] = aq.time !== undefined ? aq.time : 0;
      rowValues[startIdx + 1] = aq.image || '';
      rowValues[startIdx + 2] = aq.question || '';
      rowValues[startIdx + 3] = aq.options || 'نص';
      rowValues[startIdx + 4] = aq.correctAnswer || '';
    }
  }

  rowValues[94] = payload.instruction || ''; // CQ (95)
  rowValues[95] = payload.allowRecording || ''; // CR (96)
  rowValues[97] = payload.maxRecordingTime || 0; // CT (98)
  rowValues[98] = payload.retryCount || 0; // CU (99)
  rowValues[100] = payload.showPrevButton || ''; // CW (101)
  rowValues[102] = payload.allowUpload || ''; // CY (103)
  rowValues[104] = payload.defaultRetryResetCount || 0; // DA (105)
  rowValues[105] = payload.startDate || ''; // DB (106)
  rowValues[106] = payload.endDate || ''; // DC (107)
  rowValues[107] = payload.expireAfterDays !== undefined && payload.expireAfterDays !== null ? payload.expireAfterDays : ''; // DD (108)

  sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);

  return { success: true, rowIndex: targetRow };
}

function deleteAdminQuestion(payload) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Questions');
  if (!sheet) return { success: false, message: 'ورقة الأسئلة غير موجودة' };

  var comment = payload.comment ? payload.comment.toString().trim() : '';
  if (comment) {
    var data = sheet.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      if (data[r][3] && data[r][3].toString().trim() === comment) {
        sheet.deleteRow(r + 1);
        return { success: true };
      }
    }
  }

  var rowIndex = parseInt(payload.rowIndex);
  if (!isNaN(rowIndex) && rowIndex > 1) {
    sheet.deleteRow(rowIndex);
    return { success: true };
  }

  return { success: false, message: 'لم يتم العثور على الدرس المراد حذفه' };
}

function getAdminAnswers() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Answers');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[0] || row[1] || row[2]) {
      result.push({
        rowIndex: i + 1,
        sheetNumber: row[0] ? row[0].toString().trim() : '',
        username: row[1] ? row[1].toString().trim() : '',
        comment: row[2] ? row[2].toString().trim() : '',
        youtubeUrl: row[3] ? row[3].toString().trim() : '',
        videoAnswersResult: row[20] ? row[20].toString().trim() : '',
        audioAnswersResult: row[25] ? row[25].toString().trim() : '',
        fullAudioScore: row[27] ? row[27].toString().trim() : '0',
        letterListenScore: row[28] ? row[28].toString().trim() : '0',
        recordingLink: row[29] ? row[29].toString().trim() : '',
        imageLink: row[32] ? row[32].toString().trim() : '',
        audioUploadCount: (row[36] !== undefined && row[36] !== null && row[36] !== '') ? parseInt(row[36].toString().trim()) : 0,
        imageUploadCount: (row[37] !== undefined && row[37] !== null && row[37] !== '') ? parseInt(row[37].toString().trim()) : 0,
        finalFormula: row[38] ? row[38].toString().trim() : '',
        finalResult: (function() {
          var val = row[39];
          if (val === undefined || val === null || val === '') return '';
          if (typeof val === 'number') {
            if (val <= 1 && val >= 0) return Math.round(val * 100) + '%';
            if (val <= 100) return Math.round(val) + '%';
          }
          var s = val.toString().trim();
          var num = parseFloat(s);
          if (!isNaN(num) && !s.includes('%') && !s.includes('/')) {
            if (num <= 1 && num >= 0) return Math.round(num * 100) + '%';
            if (num <= 100) return Math.round(num) + '%';
          }
          return s;
        })(),
        completed: row[40] ? row[40].toString().trim() : '',
        retryResetCount: (row[41] !== undefined && row[41] !== null && row[41] !== '') ? parseInt(row[41].toString().trim()) : null
      });
    }
  }
  return result;
}

function updateAdminAnswer(payload) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Answers');
  if (!sheet) return { success: false, message: 'ورقة الإجابات غير موجودة' };

  var rowIndex = payload.rowIndex;
  if (!rowIndex || rowIndex <= 1) {
    return { success: false, message: 'رقم الصف غير صحيح' };
  }

  if (payload.sheetNumber !== undefined) sheet.getRange(rowIndex, 1).setValue(payload.sheetNumber);
  if (payload.username !== undefined) sheet.getRange(rowIndex, 2).setValue(payload.username);
  if (payload.comment !== undefined) sheet.getRange(rowIndex, 3).setValue(payload.comment);
  if (payload.audioUploadCount !== undefined && payload.audioUploadCount !== null) {
    sheet.getRange(rowIndex, 37).setValue(payload.audioUploadCount); // العمود AK (37)
  }
  if (payload.imageUploadCount !== undefined && payload.imageUploadCount !== null) {
    sheet.getRange(rowIndex, 38).setValue(payload.imageUploadCount); // العمود AL (38)
  }
  if (payload.finalFormula !== undefined) {
    sheet.getRange(rowIndex, 39).setValue(payload.finalFormula); // العمود AM (39)
  }
  if (payload.finalResult !== undefined) {
    sheet.getRange(rowIndex, 40).setValue(payload.finalResult); // العمود AN (40)
  }
  if (payload.completed !== undefined) {
    sheet.getRange(rowIndex, 41).setValue(payload.completed); // العمود AO (41)
  }
  if (payload.retryResetCount !== undefined && payload.retryResetCount !== null) {
    sheet.getRange(rowIndex, 42).setValue(payload.retryResetCount); // العمود AP (42)
  }

  return { success: true };
}

// ------------------- دوال مساعدة لحساب النسب الكلية والوزن النسبي -------------------

function calculatePercentages(sheet, row) {
  var uValue = sheet.getRange(row, 21).getValue().toString().trim();
  var zValue = sheet.getRange(row, 26).getValue().toString().trim();
  var abValue = sheet.getRange(row, 28).getValue().toString().trim();
  var acValue = sheet.getRange(row, 29).getValue().toString().trim();
  
  var u = getPercent(uValue);
  var z = getPercent(zValue);
  var ab = getPercent(abValue);
  var ac = getPercent(acValue);
  
  var weights = {u: 0, z: 0, ab: 0, ac: 0};
  var uP = u.present;
  var zP = z.present;
  var abP = ab.present;
  var acP = ac.present;
  
  var main = '';
  var mainWeight = 60;
  var remaining = 40;
  
  if (uP) {
    main = 'u';
  } else if (zP) {
    main = 'z';
  } else {
    main = 'none';
    mainWeight = 0;
    remaining = 100;
  }
  
  if (main !== 'none') {
    weights[main] = mainWeight;
    var zShare = 0;
    if (zP && main !== 'z') {
      zShare = 20;
      weights.z = zShare;
    }
    remaining -= zShare;
    var abAcPresent = [];
    if (abP) abAcPresent.push('ab');
    if (acP) abAcPresent.push('ac');
    var abAcCount = abAcPresent.length;
    if (abAcCount > 0) {
      var share = remaining / abAcCount;
      for (var i = 0; i < abAcPresent.length; i++) {
        weights[abAcPresent[i]] = share;
      }
    }
    if (remaining > 0 && abAcCount === 0) {
      if (zP && main !== 'z') {
        weights.z += remaining;
      } else {
        weights[main] += remaining;
      }
    }
  } else {
    var abAcPresent = [];
    if (abP) abAcPresent.push('ab');
    if (acP) abAcPresent.push('ac');
    var abAcCount = abAcPresent.length;
    if (abAcCount > 0) {
      var share = 100 / abAcCount;
      for (var i = 0; i < abAcPresent.length; i++) {
        weights[abAcPresent[i]] = share;
      }
    }
  }
  
  var contribU = uP ? Math.round(weights.u * (u.percent / 100)) + '%' : null;
  var contribZ = zP ? Math.round(weights.z * (z.percent / 100)) + '%' : null;
  var contribAB = abP ? Math.round(weights.ab * (ab.percent / 100)) + '%' : null;
  var contribAC = acP ? Math.round(weights.ac * (ac.percent / 100)) + '%' : null;
  
  var finalScore = 0;
  if (uP) finalScore += weights.u * (u.percent / 100);
  if (zP) finalScore += weights.z * (z.percent / 100);
  if (abP) finalScore += weights.ab * (ab.percent / 100);
  if (acP) finalScore += weights.ac * (ac.percent / 100);
  finalScore = Math.round(finalScore);
  
  var parts = [];
  if (uP) parts.push(contribU);
  if (zP) parts.push(contribZ);
  if (abP) parts.push(contribAB);
  if (acP) parts.push(contribAC);
  
  var finalResult = '';
  if (parts.length > 0) {
    finalResult = parts.join(' + ') + ' = ' + finalScore + '%';
  } else {
    finalResult = '0%';
  }
  
  sheet.getRange(row, 39).setValue(finalResult);
  sheet.getRange(row, 40).setValue(finalScore + '%');
}

function getPercent(text) {
  if (text === '') return {present: false, percent: 0};
  var regex = new RegExp('(\\\\d+)%', 'g');
  var matches = text.match(regex);
  if (matches && matches.length > 0) {
    var last = matches[matches.length - 1];
    return {present: true, percent: parseInt(last)};
  } else {
    var num = parseFloat(text);
    if (!isNaN(num)) {
      var p = num <= 1 ? Math.round(num * 100) : Math.round(num);
      return {present: true, percent: p};
    } else {
      return {present: false, percent: 0};
    }
  }
}

function arabicToWestern(numStr) {
  var arabicNums = '٠١٢٣٤٥٦٧٨٩';
  var westernNums = '0123456789';
  return numStr.replace(/[٠-٩]/g, function(d) {
    return westernNums[arabicNums.indexOf(d)];
  });
}

function getCommentForWord(sheetName, word) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Questions');
    if (!sheet) return word;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim() === word.trim()) {
        return data[i][3] ? data[i][3].toString().trim() : word;
      }
    }
  } catch(err) {
    // ignore
  }
  return word;
}

function getStudentCorrections(username, sheetNumber, customCorrId) {
  var corrId = customCorrId || CORRECTION_SPREADSHEET_ID;
  var targetSs;
  if (corrId && corrId.toString().trim().length > 0) {
    try {
      targetSs = SpreadsheetApp.openById(corrId.toString().trim());
    } catch(err) {
      targetSs = SpreadsheetApp.getActiveSpreadsheet();
    }
  } else {
    targetSs = SpreadsheetApp.getActiveSpreadsheet();
  }

  var sheet = targetSs.getSheetByName('A1') || targetSs.getSheetByName('a1');
  if (!sheet) {
    return { success: false, message: 'ورقة A1 غير موجودة في شيت التصحيح' };
  }

  var data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return { success: true, corrections: [] };
  }

  var reqStudent = (username || '').toString().trim().toLowerCase();
  var reqSheetNum = (sheetNumber || '').toString().trim().toLowerCase();

  var results = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var sNum = (row[0] || '').toString().trim().toLowerCase();
    var sName = (row[1] || '').toString().trim().toLowerCase();

    var matchSheet = !reqSheetNum || (sNum === reqSheetNum);
    var matchName = !reqStudent || (sName === reqStudent || sName.indexOf(reqStudent) !== -1 || reqStudent.indexOf(sName) !== -1);

    if (matchSheet && matchName) {
      results.push({
        sheetNumber: row[0] ? row[0].toString().trim() : '',
        studentName: row[1] ? row[1].toString().trim() : '',
        lessonTitle: row[2] ? row[2].toString().trim() : '',
        imageSendCount: row[3] ? row[3].toString().trim() : '',
        imageAssignment: row[4] ? row[4].toString().trim() : '',
        audioSendCount: row[5] ? row[5].toString().trim() : '',
        audioAssignment: row[6] ? row[6].toString().trim() : '',

        imageCorrection: {
          status: row[7] ? row[7].toString().trim() : '',
          score: row[8] ? row[8].toString().trim() : '',
          mainImage: row[9] ? row[9].toString().trim() : '',
          additionalImages: row[10] ? row[10].toString().trim() : '',
          videos: row[11] ? row[11].toString().trim() : '',
          audioExplanations: row[12] ? row[12].toString().trim() : '',
          date: row[13] ? row[13].toString().trim() : '',
          sendCount: row[14] ? row[14].toString().trim() : '',
          notes: row[15] ? row[15].toString().trim() : ''
        },

        audioCorrection: {
          status: row[16] ? row[16].toString().trim() : '',
          score: row[17] ? row[17].toString().trim() : '',
          mainImage: row[18] ? row[18].toString().trim() : '',
          audioExplanations: row[19] ? row[19].toString().trim() : '',
          additionalImages: row[20] ? row[20].toString().trim() : '',
          videos: row[21] ? row[21].toString().trim() : '',
          date: row[22] ? row[22].toString().trim() : '',
          sendCount: row[23] ? row[23].toString().trim() : '',
          notes: row[24] ? row[24].toString().trim() : ''
        }
      });
    }
  }

  return { success: true, corrections: results };
}

// ------------------- دوال إدارة التلغرام والإشعارات التلقائية -------------------

function setupTelegramSheets() {
  try {
    var ss = getSpreadsheet();
    if (!ss) return { success: false, message: 'تعذر فتح جدول البيانات' };
    
    // 1. ورقة المستخدمين Telegram_Users
    var uSheet = ss.getSheetByName('Telegram_Users');
    if (!uSheet) {
      uSheet = ss.insertSheet('Telegram_Users');
      uSheet.appendRow(['اسم الطالب', 'رقم الشيت', 'Telegram Chat ID', 'اللغة', 'تاريخ الربط']);
      uSheet.getRange(1, 1, 1, 5).setBackground('#2563EB').setFontColor('#FFFFFF').setFontWeight('bold');
    }
    
    // 2. ورقة الإعدادات Telegram_Config
    var cSheet = ss.getSheetByName('Telegram_Config');
    if (!cSheet) {
      cSheet = ss.insertSheet('Telegram_Config');
      cSheet.appendRow(['المفتاح (Key)', 'القيمة (Value)', 'الوصف (Description)']);
      cSheet.getRange(1, 1, 1, 3).setBackground('#059669').setFontColor('#FFFFFF').setFontWeight('bold');
      var defToken = typeof DEFAULT_BOT_TOKEN !== 'undefined' ? DEFAULT_BOT_TOKEN : '';
      var defUser = typeof DEFAULT_BOT_USERNAME !== 'undefined' ? DEFAULT_BOT_USERNAME : 'Httat_bot';
      cSheet.appendRow(['botToken', defToken, 'توكن البوت']);
      cSheet.appendRow(['botUsername', defUser, 'معرف البوت']);
      cSheet.appendRow(['teacherChatId', '', 'معرف الأستاذ الخاص']);
      cSheet.appendRow(['groupChatId', '', 'معرف قروب الأساتذة']);
      cSheet.appendRow(['notifyTeacherOnSubmit', 'true', 'إشعار الأستاذ عند التسليم']);
      cSheet.appendRow(['notifyGroupOnSubmit', 'true', 'إشعار القروب عند التسليم']);
      cSheet.appendRow(['notifyStudentOnScore', 'true', 'إشعار الطالب بالدرجة']);
      cSheet.appendRow(['notifyStudentOnRedo', 'true', 'إشعار الطالب بطلب الإعادة']);
    }
    
    // 3. ورقة القوالب Telegram_Templates
    var tSheet = ss.getSheetByName('Telegram_Templates');
    if (!tSheet) {
      tSheet = ss.insertSheet('Telegram_Templates');
      tSheet.appendRow(['Template Key', 'Title', 'Text Arabic', 'Text Thai', 'Text English', 'Button Text AR', 'Button Text TH', 'Button Text EN', 'Button URL']);
      tSheet.getRange(1, 1, 1, 9).setBackground('#D97706').setFontColor('#FFFFFF').setFontWeight('bold');
      tSheet.appendRow([
        'homework_received',
        'تأكيد استلام الواجب (للطالب)',
        '✅ تم استلام واجبك بنجاح يا {student}!\\n📚 الدرس: {lesson}\\nتم إرسال إجاباتك وملفاتك إلى الأستاذ، وسيصلك إشعار التصحيح فور اعتماده 🌸',
        '✅ ได้รับการบ้านเรียบร้อยแล้ว คุณ {student}!\\n📚 บทเรียน: {lesson}\\nส่งคำตอบและไฟล์ไปยังอาจารย์แล้ว และจะแจ้งผลการตรวจทันทีที่เสร็จสิ้น 🌸',
        '✅ Your homework for: 📚 {lesson} has been received, {student}!\\nYour answers and files have been sent to the teacher. You will be notified once reviewed 🌸',
        '🔗 فتح ملف الواجب',
        '🔗 เปิดไฟล์การบ้าน',
        '🔗 View Homework File',
        ''
      ]);
      tSheet.appendRow([
        'new_homework_teacher',
        'إشعار تسليم واجب جديد (للأستاذ والقروب)',
        '📝 تسليم واجب جديد\\n👤 الطالب: {student}\\n🔢 رقم الطالب/الشيت: #{sheet}\\n📚 الموضوع: {lesson}\\n📊 النتيجة الكلية: {score}',
        '📝 ส่งการบ้านใหม่\\n👤 นักเรียน: {student}\\n🔢 ชีท: #{sheet}\\n📚 บทเรียน: {lesson}\\n📊 คะแนนรวม: {score}',
        '📝 New Homework Submission\\n👤 Student: {student}\\n🔢 Sheet: #{sheet}\\n📚 Lesson: {lesson}\\n📊 Total Score: {score}',
        '', '', '', ''
      ]);
      tSheet.appendRow([
        'resubmit_homework_teacher',
        'إشعار إعادة تسليم / تعديل واجب (للأستاذ والقروب)',
        '🔄 تنبيه: إعادة تسليم واجب\\n👤 الطالب: {student}\\n🔢 رقم الطالب/الشيت: #{sheet}\\n📚 الموضوع: {lesson}\\n⚠️ نوع التحديث: {type}\\n📊 النتيجة الكلية: {score}',
        '🔄 มีการส่งการบ้านซ้ำ/แก้ไข\\n👤 นักเรียน: {student}\\n🔢 ชีท: #{sheet}\\n📚 บทเรียน: {lesson}\\n⚠️ ประเภทการอัปเดต: {type}\\n📊 คะแนนรวม: {score}',
        '🔄 Homework Resubmission / Update\\n👤 Student: {student}\\n🔢 Sheet: #{sheet}\\n📚 Lesson: {lesson}\\n⚠️ Update Type: {type}\\n📊 Total Score: {score}',
        '', '', '', ''
      ]);
    }

    // 4. ورقة سجلات الأحداث Telegram_Logs
    var lSheet = ss.getSheetByName('Telegram_Logs');
    if (!lSheet) {
      lSheet = ss.insertSheet('Telegram_Logs');
      lSheet.appendRow(['التاريخ والوقت', 'نص الرسالة الواردة', 'Chat ID', 'رقم الشيت المستخرج', 'اسم الطالب', 'الحالة والنتيجة']);
      lSheet.getRange(1, 1, 1, 6).setBackground('#2563EB').setFontColor('#FFFFFF').setFontWeight('bold');
    }
    
    return { success: true, message: 'تم إنشاء وتهيئة جميع أوراق التلغرام بنجاح في جدول البيانات!' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function normalizeLanguage(lang) {
  if (!lang) return 'ar';
  var str = lang.toString().trim().toLowerCase();
  if (
    str === 'th' || str === 'thai' || str === 'thailand' ||
    str.indexOf('ไทย') !== -1 || str.indexOf('ภาษาไทย') !== -1 ||
    str.indexOf('تايلاند') !== -1 || str.indexOf('تايلند') !== -1 ||
    str.indexOf('🇹🇭') !== -1
  ) {
    return 'th';
  }
  if (
    str === 'en' || str === 'eng' || str === 'english' ||
    str.indexOf('انجليز') !== -1 || str.indexOf('إنجليز') !== -1 ||
    str.indexOf('انكليز') !== -1 || str.indexOf('إنكليز') !== -1 ||
    str.indexOf('🇬🇧') !== -1 || str.indexOf('🇺🇸') !== -1
  ) {
    return 'en';
  }
  return 'ar';
}

function getTelegramTemplateInfo(templateKey, lang, defaultText, defaultBtnText, defaultBtnUrl) {
  try {
    var ss = getSpreadsheet();
    if (!ss) return { text: defaultText, buttonText: defaultBtnText || '', buttonUrl: defaultBtnUrl || '' };
    var sheet = ss.getSheetByName('Telegram_Templates');
    if (!sheet) return { text: defaultText, buttonText: defaultBtnText || '', buttonUrl: defaultBtnUrl || '' };
    var data = sheet.getDataRange().getValues();
    var normLang = normalizeLanguage(lang);
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim() === templateKey.trim()) {
        var txt = defaultText;
        if (normLang === 'th' && data[i][3]) txt = data[i][3].toString();
        else if (normLang === 'en' && data[i][4]) txt = data[i][4].toString();
        else if (data[i][2]) txt = data[i][2].toString();

        var btnText = '';
        if (normLang === 'th' && data[i][6]) btnText = data[i][6].toString();
        else if (normLang === 'en' && data[i][7]) btnText = data[i][7].toString();
        else if (data[i][5]) btnText = data[i][5].toString();
        else btnText = (defaultBtnText || '');

        var btnUrl = data[i][8] ? data[i][8].toString().trim() : (defaultBtnUrl || '');
        return { text: txt, buttonText: btnText, buttonUrl: btnUrl };
      }
    }
    return { text: defaultText, buttonText: defaultBtnText || '', buttonUrl: defaultBtnUrl || '' };
  } catch (e) {
    return { text: defaultText, buttonText: defaultBtnText || '', buttonUrl: defaultBtnUrl || '' };
  }
}

function getTelegramTemplateText(templateKey, lang, defaultText) {
  return getTelegramTemplateInfo(templateKey, lang, defaultText).text;
}

function renderTemplate(template, vars) {
  var res = template || '';
  for (var k in vars) {
    var regex = new RegExp('\\{' + k + '\\}', 'g');
    res = res.replace(regex, vars[k] !== undefined && vars[k] !== null ? vars[k] : '');
  }
  return res;
}

function logTelegramEvent(rawText, chatId, sheetNumber, studentName, status) {
  try {
    var ss = getSpreadsheet();
    if (!ss) return;
    var logSheet = ss.getSheetByName('Telegram_Logs');
    if (!logSheet) {
      logSheet = ss.insertSheet('Telegram_Logs');
      logSheet.appendRow(['التاريخ والوقت', 'نص الرسالة الواردة', 'Chat ID', 'رقم الشيت المستخرج', 'اسم الطالب', 'الحالة والنتيجة']);
    }
    logSheet.appendRow([
      new Date().toLocaleString('ar-SA'),
      String(rawText || ''),
      String(chatId || ''),
      String(sheetNumber || ''),
      String(studentName || ''),
      String(status || '')
    ]);
  } catch (eLog) {}
}

function getTelegramConfig() {
  try {
    var ss = getSpreadsheet();
    var defConfig = {
      botToken: typeof DEFAULT_BOT_TOKEN !== 'undefined' ? DEFAULT_BOT_TOKEN : '',
      botUsername: typeof DEFAULT_BOT_USERNAME !== 'undefined' ? DEFAULT_BOT_USERNAME : '',
      teacherChatId: typeof DEFAULT_TEACHER_CHAT_ID !== 'undefined' ? DEFAULT_TEACHER_CHAT_ID : '',
      groupChatId: '',
      notifyTeacherOnSubmit: true,
      notifyGroupOnSubmit: true,
      notifyStudentOnScore: true,
      notifyStudentOnRedo: true
    };
    if (!ss) return defConfig;
    var sheet = ss.getSheetByName('Telegram_Config');
    if (!sheet) return defConfig;
    var data = sheet.getDataRange().getValues();
    var config = {
      botToken: typeof DEFAULT_BOT_TOKEN !== 'undefined' ? DEFAULT_BOT_TOKEN : '',
      botUsername: typeof DEFAULT_BOT_USERNAME !== 'undefined' ? DEFAULT_BOT_USERNAME : '',
      teacherChatId: typeof DEFAULT_TEACHER_CHAT_ID !== 'undefined' ? DEFAULT_TEACHER_CHAT_ID : '',
      groupChatId: '',
      notifyTeacherOnSubmit: true,
      notifyGroupOnSubmit: true,
      notifyStudentOnScore: true,
      notifyStudentOnRedo: true
    };
    for (var i = 1; i < data.length; i++) {
      var key = data[i][0] ? data[i][0].toString().trim() : '';
      var val = (data[i][1] !== undefined && data[i][1] !== null) ? data[i][1].toString().trim() : '';
      if (key === 'botToken' || key === 'bot_token' || key === 'توكن البوت') config.botToken = val;
      if (key === 'botUsername' || key === 'bot_username' || key === 'معرف البوت') config.botUsername = val;
      if (key === 'teacherChatId' || key === 'teacher_chat_id' || key === 'معرف الأستاذ' || key === 'معرف الاستاذ') config.teacherChatId = val;
      if (key === 'groupChatId' || key === 'group_chat_id' || key === 'معرف القروب' || key === 'معرف قروب الأساتذة') config.groupChatId = val;
      if (key === 'notifyTeacherOnSubmit' || key === 'إشعار الأستاذ عند التسليم' || key === 'إشعار الأستاذ') config.notifyTeacherOnSubmit = (val === '' || val === 'true' || val === 'نعم' || val === 'TRUE');
      if (key === 'notifyGroupOnSubmit' || key === 'إشعار القروب عند التسليم' || key === 'إشعار القروب') config.notifyGroupOnSubmit = (val === 'true' || val === 'نعم' || val === 'TRUE');
      if (key === 'notifyStudentOnScore' || key === 'إشعار الطالب بالدرجة') config.notifyStudentOnScore = (val === '' || val === 'true' || val === 'نعم' || val === 'TRUE');
      if (key === 'notifyStudentOnRedo' || key === 'إشعار الطالب بطلب الإعادة') config.notifyStudentOnRedo = (val === '' || val === 'true' || val === 'نعم' || val === 'TRUE');
    }
    return config;
  } catch (err) {
    return { botToken: typeof DEFAULT_BOT_TOKEN !== 'undefined' ? DEFAULT_BOT_TOKEN : '', botUsername: typeof DEFAULT_BOT_USERNAME !== 'undefined' ? DEFAULT_BOT_USERNAME : '', teacherChatId: typeof DEFAULT_TEACHER_CHAT_ID !== 'undefined' ? DEFAULT_TEACHER_CHAT_ID : '', groupChatId: '', notifyTeacherOnSubmit: true, notifyGroupOnSubmit: true, notifyStudentOnScore: true, notifyStudentOnRedo: true };
  }
}

function saveTelegramConfig(config) {
  try {
    var ss = getSpreadsheet();
    if (!ss) return { success: false, message: 'تعذر فتح جدول البيانات' };
    var sheet = ss.getSheetByName('Telegram_Config');
    if (!sheet) {
      sheet = ss.insertSheet('Telegram_Config');
    }
    var keys = [
      ['botToken', (config.botToken || '').toString().trim(), 'توكن البوت'],
      ['botUsername', (config.botUsername || '').toString().trim(), 'معرف البوت'],
      ['teacherChatId', (config.teacherChatId || '').toString().trim(), 'معرف الأستاذ'],
      ['groupChatId', (config.groupChatId || '').toString().trim(), 'معرف قروب الأساتذة'],
      ['notifyTeacherOnSubmit', (config.notifyTeacherOnSubmit !== false && config.enableTeacherPrivate !== false) ? 'true' : 'false', 'إشعار الأستاذ عند التسليم'],
      ['notifyGroupOnSubmit', (config.notifyGroupOnSubmit === true || config.enableGroupNotify === true) ? 'true' : 'false', 'إشعار القروب عند التسليم'],
      ['notifyStudentOnScore', (config.notifyStudentOnScore !== false && config.enableStudentPrivate !== false) ? 'true' : 'false', 'إشعار الطالب بالدرجة'],
      ['notifyStudentOnRedo', (config.notifyStudentOnRedo !== false && config.enableStudentPrivate !== false) ? 'true' : 'false', 'إشعار الطالب بطلب الإعادة']
    ];
    sheet.clear();
    sheet.appendRow(['المفتاح (Key)', 'القيمة (Value)', 'الوصف (Description)']);
    sheet.getRange(1, 1, 1, 3).setBackground('#059669').setFontColor('#FFFFFF').setFontWeight('bold');
    for (var k = 0; k < keys.length; k++) {
      sheet.appendRow(keys[k]);
    }
    return { success: true, message: 'تم حفظ وتحديث إعدادات التلغرام ومعرف الأستاذ في Google Sheets بنجاح' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getTelegramTemplates() {
  try {
    var ss = getSpreadsheet();
    if (!ss) return [];
    var sheet = ss.getSheetByName('Telegram_Templates');
    if (!sheet) return [];
    var data = sheet.getDataRange().getDisplayValues();
    var list = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) {
        list.push({
          key: data[i][0].toString().trim(),
          title: data[i][1] ? data[i][1].toString().trim() : '',
          text_ar: data[i][2] ? data[i][2].toString().trim() : '',
          text_th: data[i][3] ? data[i][3].toString().trim() : '',
          text_en: data[i][4] ? data[i][4].toString().trim() : '',
          button_text_ar: data[i][5] ? data[i][5].toString().trim() : '',
          button_text_th: data[i][6] ? data[i][6].toString().trim() : '',
          button_text_en: data[i][7] ? data[i][7].toString().trim() : '',
          button_url: data[i][8] ? data[i][8].toString().trim() : ''
        });
      }
    }
    return list;
  } catch (err) {
    return [];
  }
}

function saveTelegramTemplate(payload) {
  try {
    var ss = getSpreadsheet();
    if (!ss) return { success: false, message: 'تعذر فتح جدول البيانات' };
    var sheet = ss.getSheetByName('Telegram_Templates');
    if (!sheet) {
      sheet = ss.insertSheet('Telegram_Templates');
      sheet.appendRow(['Template Key', 'Title', 'Text Arabic', 'Text Thai', 'Text English', 'Button Text AR', 'Button Text TH', 'Button Text EN', 'Button URL']);
      sheet.getRange(1, 1, 1, 9).setBackground('#D97706').setFontColor('#FFFFFF').setFontWeight('bold');
    }
    
    // إذا كانت الحمولة تحتوي على مصفوفة قوالب متعددة templates
    if (payload && payload.templates && Array.isArray(payload.templates)) {
      sheet.clear();
      sheet.appendRow(['Template Key', 'Title', 'Text Arabic', 'Text Thai', 'Text English', 'Button Text AR', 'Button Text TH', 'Button Text EN', 'Button URL']);
      sheet.getRange(1, 1, 1, 9).setBackground('#D97706').setFontColor('#FFFFFF').setFontWeight('bold');
      for (var t = 0; t < payload.templates.length; t++) {
        var item = payload.templates[t];
        sheet.appendRow([
          item.key || '',
          item.title || item.key || '',
          item.ar || item.text_ar || '',
          item.th || item.text_th || '',
          item.en || item.text_en || '',
          item.buttonTextAr || item.button_text_ar || '',
          item.buttonTextTh || item.button_text_th || '',
          item.buttonTextEn || item.button_text_en || '',
          item.buttonUrl || item.button_url || ''
        ]);
      }
      return { success: true, message: 'تم حفظ وتحديث جميع القوالب في الشيت بنجاح' };
    }

    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim() === (payload.key || '').trim()) {
        rowIndex = i + 1;
        break;
      }
    }
    var rowData = [
      payload.key,
      payload.title || '',
      payload.text_ar || payload.ar || '',
      payload.text_th || payload.th || '',
      payload.text_en || payload.en || '',
      payload.buttonTextAr || payload.button_text_ar || '',
      payload.buttonTextTh || payload.button_text_th || '',
      payload.buttonTextEn || payload.button_text_en || '',
      payload.buttonUrl || payload.button_url || ''
    ];
    if (rowIndex !== -1) {
      sheet.getRange(rowIndex, 1, 1, 9).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getTelegramUsers() {
  try {
    var ss = getSpreadsheet();
    if (!ss) return {};
    var sheet = ss.getSheetByName('Telegram_Users');
    if (!sheet) return {};
    // استخدام getDisplayValues لضمان قراءة القيم الناتجة من معادلات IMPORTRANGE و QUERY الخارجية
    var data = sheet.getDataRange().getDisplayValues();
    var bindings = {};
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row || row.length === 0) continue;

      var sName = '';
      var sSheet = '';
      var chatId = '';
      var rawLang = 'ar';
      var linkedAt = '';

      // فحص إذا كان العمود الأول يبدأ برقم معرف الدردشة Chat ID (مثل 6291827419)
      if (row[0] && /^\d{5,}$/.test(row[0].toString().trim())) {
        chatId = row[0].toString().trim();
        sName = row[2] ? row[2].toString().trim() : (row[1] ? row[1].toString().trim() : '');
        sSheet = row[3] ? row[3].toString().trim() : '';
        rawLang = row[5] ? row[5].toString().trim() : (row[4] ? row[4].toString().trim() : 'ar');
        linkedAt = row[4] ? row[4].toString() : '';
      } else {
        // النمط القياسي: اسم الطالب (0)، رقم الشيت (1)، Chat ID (2)، اللغة (3)
        sName = row[0] ? row[0].toString().trim() : '';
        sSheet = row[1] ? row[1].toString().trim() : '';
        chatId = row[2] ? row[2].toString().trim() : '';
        rawLang = row[3] ? row[3].toString().trim() : 'ar';
        linkedAt = row[4] ? row[4].toString() : '';
      }

      var normLang = normalizeLanguage(rawLang);

      if (sSheet || chatId || sName) {
        var key = ((sName || 'student') + '__' + (sSheet || chatId)).toLowerCase();
        bindings[key] = {
          studentName: sName,
          sheetNumber: sSheet,
          chatId: chatId,
          language: normLang,
          rawLanguage: rawLang,
          linkedAt: linkedAt
        };
      }
    }
    return bindings;
  } catch (err) {
    return {};
  }
}

function findStudentNameBySheetNumber(sheetNumber) {
  try {
    if (!sheetNumber) return '';
    var sStr = sheetNumber.toString().trim();
    var ss = getSpreadsheet();
    if (!ss) return '';

    // 1) فحص ورقة Telegram_Users
    var usersSheet = ss.getSheetByName('Telegram_Users');
    if (usersSheet) {
      var uData = usersSheet.getDataRange().getValues();
      for (var u = 1; u < uData.length; u++) {
        var uRow = uData[u];
        // العمود الثاني (index 1) أو العمود الرابع (index 3)
        if (uRow[1] && uRow[1].toString().trim() === sStr && uRow[0]) {
          return uRow[0].toString().trim();
        }
        if (uRow[3] && uRow[3].toString().trim() === sStr && uRow[2]) {
          return uRow[2].toString().trim();
        }
      }
    }

    // 2) فحص ورقة Settings
    var settingsSheet = ss.getSheetByName('Settings');
    if (settingsSheet) {
      var data = settingsSheet.getDataRange().getValues();
      for (var r = 1; r < data.length; r++) {
        var sNumB = data[r][1] ? data[r][1].toString().trim() : '';
        var userC = data[r][2] ? data[r][2].toString().trim() : '';
        if (sNumB === sStr && userC) {
          return userC;
        }
        var userZ = data[r][25] ? data[r][25].toString().trim() : '';
        var sNumAA = data[r][26] ? data[r][26].toString().trim() : '';
        if (sNumAA === sStr && userZ) {
          return userZ;
        }
      }
    }
    return '';
  } catch (err) {
    return '';
  }
}

function bindTelegramUser(payload) {
  try {
    var ss = getSpreadsheet();
    if (!ss) return { success: false, message: 'تعذر فتح جدول البيانات' };
    var sheet = ss.getSheetByName('Telegram_Users');
    if (!sheet) {
      sheet = ss.insertSheet('Telegram_Users');
      sheet.appendRow(['اسم الطالب', 'رقم الشيت', 'Telegram Chat ID', 'اللغة', 'تاريخ الربط']);
    }
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      var n = data[i][0] ? data[i][0].toString().trim().toLowerCase() : '';
      var s = data[i][1] ? data[i][1].toString().trim() : '';
      var c = data[i][2] ? data[i][2].toString().trim() : '';
      if ((s && s === (payload.sheetNumber || '').toString().trim()) || (c && c === (payload.chatId || '').toString().trim()) || (n && n === (payload.studentName || '').trim().toLowerCase())) {
        rowIndex = i + 1;
        break;
      }
    }
    var row = [
      payload.studentName,
      payload.sheetNumber,
      payload.chatId,
      payload.language || 'ar',
      new Date().toLocaleString('ar-SA')
    ];
    if (rowIndex !== -1) {
      sheet.getRange(rowIndex, 1, 1, 5).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function sendTelegramNotification(payload) {
  try {
    var config = getTelegramConfig();
    var botToken = payload.botToken || config.botToken || (typeof DEFAULT_BOT_TOKEN !== 'undefined' ? DEFAULT_BOT_TOKEN : '');
    if (!botToken) {
      return { success: false, message: 'لم يتم تعيين توكن البوت Bot Token' };
    }

    var chatId = payload.chatId;
    if (!chatId) {
      if (payload.target === 'teacher') chatId = config.teacherChatId;
      else if (payload.target === 'group') chatId = config.groupChatId;
    }

    if (!chatId) {
      return { success: false, message: 'معرف الدردشة غير محدد' };
    }

    var replyMarkup = undefined;
    if (payload.inline_keyboard && payload.inline_keyboard.length > 0) {
      replyMarkup = { inline_keyboard: payload.inline_keyboard };
    } else if (payload.buttons && payload.buttons.length > 0) {
      var rowBtn = [];
      for (var b = 0; b < payload.buttons.length; b++) {
        if (payload.buttons[b] && payload.buttons[b].text && payload.buttons[b].url) {
          rowBtn.push({ text: payload.buttons[b].text, url: payload.buttons[b].url });
        }
      }
      if (rowBtn.length > 0) {
        replyMarkup = { inline_keyboard: [rowBtn] };
      }
    } else if (payload.buttonLabel && payload.buttonUrl) {
      replyMarkup = {
        inline_keyboard: [[
          { text: payload.buttonLabel, url: payload.buttonUrl }
        ]]
      };
    }

    // فحص ما إذا كان هناك طلب لإرسال صورة مباشرة (sendPhoto)
    var photoUrl = payload.photo || payload.imageUrl;
    var directImg = '';
    if (photoUrl && typeof photoUrl === 'string' && (photoUrl.indexOf('http://') === 0 || photoUrl.indexOf('https://') === 0)) {
      directImg = getDirectImageUrl(photoUrl);
    }

    // 1) محاولة إرسال كصورة مع Caption إذا توفر رابط صورة مباشر
    if (directImg) {
      try {
        var photoBody = {
          chat_id: chatId,
          photo: directImg,
          caption: (payload.caption || payload.text || '').substring(0, 1024)
        };
        if (payload.parse_mode) photoBody.parse_mode = payload.parse_mode;
        if (replyMarkup) photoBody.reply_markup = replyMarkup;

        var pUrl = 'https://api.telegram.org/bot' + botToken + '/sendPhoto';
        var pResp = UrlFetchApp.fetch(pUrl, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(photoBody),
          muteHttpExceptions: true
        });
        var pResult = JSON.parse(pResp.getContentText());
        if (pResult && pResult.ok) {
          return { success: true, result: pResult };
        }
      } catch (errP) {
        // في حال تعذر الإرسال كـ Photo، ننتقل تلقائياً للـ sendMessage
      }
    }

    // 2) الإرسال الافتراضي كنص عادي (sendMessage)
    var body = {
      chat_id: chatId,
      text: payload.text || 'إشعار جديد'
    };

    if (payload.parse_mode) {
      body.parse_mode = payload.parse_mode;
    }

    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    var url = 'https://api.telegram.org/bot' + botToken + '/sendMessage';
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    });

    var result = JSON.parse(response.getContentText());
    return { success: result && result.ok, result: result };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// دالة مساعدة لتحويل روابط Google Drive أو Cloudinary إلى روابط صور قابلة للعرض المباشر في تلغرام
function getDirectImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  var clean = rawUrl.trim();
  var fileId = '';
  if (clean.indexOf('drive.google.com/file/d/') !== -1) {
    var match = clean.match(new RegExp('/file/d/([a-zA-Z0-9_-]+)'));
    if (match && match[1]) fileId = match[1];
  } else if (clean.indexOf('drive.google.com/open?id=') !== -1 || clean.indexOf('drive.google.com/uc?id=') !== -1 || clean.indexOf('drive.google.com/uc?') !== -1) {
    var matchId = clean.match(new RegExp('[?&]id=([a-zA-Z0-9_-]+)'));
    if (matchId && matchId[1]) fileId = matchId[1];
  } else if (clean.indexOf('googleusercontent.com/d/') !== -1) {
    var matchG = clean.match(new RegExp('googleusercontent\\.com/d/([a-zA-Z0-9_-]+)'));
    if (matchG && matchG[1]) fileId = matchG[1];
  }
  
  if (fileId) {
    return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200';
  }
  if (clean.indexOf('http://') === 0 || clean.indexOf('https://') === 0) {
    return clean;
  }
  return '';
}

// ------------------- دالة مركزية موحدة لمعالجة وإرسال إشعارات تسليم الواجبات (جديد / إعادة) -------------------

function notifyOnHomeworkSubmission(sheet, rowNum, isResubmission, updateType) {
  try {
    var rowValues = sheet.getRange(rowNum, 1, 1, 45).getValues()[0];
    var sheetNumber = rowValues[0] ? rowValues[0].toString().trim() : ''; // العمود A (1)
    var studentName = rowValues[1] ? rowValues[1].toString().trim() : ''; // العمود B (2)
    var lessonTitle = rowValues[2] ? rowValues[2].toString().trim() : ''; // العمود C (3)
    var soundUrl = rowValues[29] ? rowValues[29].toString().trim() : ''; // العمود AD (30) - الصوت
    var imageUrl = rowValues[31] ? rowValues[31].toString().trim() : ''; // العمود AF (32) - الصورة
    var totalScore = rowValues[38] ? rowValues[38].toString().trim() : (rowValues[39] ? rowValues[39].toString().trim() : ''); // العمود AM (39) - النتيجة الكلية
    var aoStatus = (rowValues[40] !== undefined && rowValues[40] !== null) ? rowValues[40].toString().trim() : (sheet.getRange(rowNum, 41).getValue() || '').toString().trim(); // العمود AO (41) - حالة الإكمال

    // الشرط الأساسي: إرسال الرسالة فقط عند اكتمال الواجب كاملاً (العمود AO = 'تم') أو في حال إعادة التسليم الصريحة
    var isRedo = isResubmission === true && (aoStatus === 'اعادة' || aoStatus === 'إعادة' || aoStatus === 'تم');
    if (aoStatus !== 'تم' && !isRedo) {
      logTelegramEvent('فحص حالة الإكمال AO', '', sheetNumber, studentName, 'تم تخطي الإرسال لأن الدرس لم يكتمل بعد (حالة العمود AO الحالية: "' + aoStatus + '" وليست "تم")');
      return;
    }

    if (!studentName && sheetNumber) {
      studentName = findStudentNameBySheetNumber(sheetNumber) || ('طالب #' + sheetNumber);
    }

    var imgCount = parseInt(rowValues[37]) || 0;
    var recCount = parseInt(rowValues[36]) || 0;
    if (isResubmission === undefined || isResubmission === null) {
      isResubmission = (imgCount > 1 || recCount > 1);
    } else {
      isResubmission = isResubmission || (imgCount > 1 || recCount > 1);
    }

    // تحديد نوع التعديل المُعاد بدقة إن لم يُمرر صراحة
    if (isResubmission && !updateType) {
      if (imgCount > 1 && recCount <= 1) updateType = 'image';
      else if (recCount > 1 && imgCount <= 1) updateType = 'sound';
      else if (imgCount > 1 && recCount > 1) updateType = 'both';
      else updateType = 'all';
    }

    // --- منع تكرار الإرسال المزدوج لنفس العملية خلال 20 ثانية (Anti-duplicate Cache Lock) ---
    var dedupeKey = 'hw_notif_' + String(sheetNumber) + '_' + String(rowNum) + '_' + (isResubmission ? ('redo_' + (updateType || 'all')) : 'new');
    var cache = CacheService.getScriptCache();
    if (cache && cache.get(dedupeKey)) {
      return; // تم إرسال الإشعار بالفعل قبل قليل، تخطي التكرار بنجاح
    }
    if (cache) {
      cache.put(dedupeKey, '1', 20); // قفل لمدة 20 ثانية
    }

    var config = getTelegramConfig();
    var botToken = config.botToken || (typeof DEFAULT_BOT_TOKEN !== 'undefined' ? DEFAULT_BOT_TOKEN : '');
    if (!botToken) {
      logTelegramEvent('تسليم واجب', '', sheetNumber, studentName, 'تعذر الإرسال: Bot Token غير مسجل في الإعدادات');
      return;
    }

    var nl = String.fromCharCode(10);

    // 1) بناء رسالة الأستاذ / القروب وقائمة الأزرار التفاعلية المخصصة من القالب Telegram_Templates
    var teacherMsg = '';
    var actionButtons = [];
    var photoToSend = imageUrl;
    var formattedScore = totalScore ? (totalScore.toString().indexOf('%') !== -1 ? totalScore : (totalScore + '%')) : 'قيد الاحتساب';

    if (isResubmission) {
      var updateTypeDesc = 'إعادة إرسال وتحديث الواجب 🔄';
      if (updateType === 'image') {
        updateTypeDesc = 'تحديث صورة الواجب فقط 🖼️';
        if (imageUrl) actionButtons.push({ text: '🖼️ فتح الصورة المحدثة', url: imageUrl });
      } else if (updateType === 'sound') {
        updateTypeDesc = 'تحديث التسجيل الصوتي فقط 🎙️';
        if (soundUrl) actionButtons.push({ text: '🎙️ تشغيل الصوت المحدث', url: soundUrl });
      } else {
        updateTypeDesc = 'تحديث بيانات وملفات الواجب 📦';
        if (imageUrl) actionButtons.push({ text: '🖼️ الصورة المحدثة', url: imageUrl });
        if (soundUrl) actionButtons.push({ text: '🎙️ الصوت المحدث', url: soundUrl });
      }

      var defaultResubmitTeacherTmpl = '🔄 تنبيه: إعادة تسليم واجب\\n👤 الطالب: {student}\\n🔢 رقم الطالب/الشيت: #{sheet}\\n📚 الموضوع: {lesson}\\n⚠️ نوع التحديث: {type}\\n📊 النتيجة الكلية: {score}';
      var resubmitTmpl = getTelegramTemplateText('resubmit_homework_teacher', 'ar', defaultResubmitTeacherTmpl);
      teacherMsg = renderTemplate(resubmitTmpl, {
        student: studentName,
        sheet: sheetNumber,
        lesson: lessonTitle || 'تمرين الخط',
        score: formattedScore,
        type: updateTypeDesc
      });
    } else {
      if (imageUrl) actionButtons.push({ text: '🖼️ فتح الصورة', url: imageUrl });
      if (soundUrl) actionButtons.push({ text: '🎙️ تشغيل الصوت', url: soundUrl });

      var defaultNewTeacherTmpl = '📝 تسليم واجب جديد\\n👤 الطالب: {student}\\n🔢 رقم الطالب/الشيت: #{sheet}\\n📚 الموضوع: {lesson}\\n📊 النتيجة الكلية: {score}';
      var newTmpl = getTelegramTemplateText('new_homework_teacher', 'ar', defaultNewTeacherTmpl);
      teacherMsg = renderTemplate(newTmpl, {
        student: studentName,
        sheet: sheetNumber,
        lesson: lessonTitle || 'تمرين الخط',
        score: formattedScore
      });
    }

    var teacherTargetId = config.teacherChatId || (typeof DEFAULT_TEACHER_CHAT_ID !== 'undefined' ? DEFAULT_TEACHER_CHAT_ID : '');

    // إرسال للأستاذ الخاص
    if (config.notifyTeacherOnSubmit && teacherTargetId) {
      var tRes = sendTelegramNotification({
        botToken: botToken,
        chatId: teacherTargetId,
        text: teacherMsg,
        photo: photoToSend,
        buttons: actionButtons
      });
      logTelegramEvent(teacherMsg, teacherTargetId, sheetNumber, studentName, (tRes && tRes.success) ? 'تم إرسال إشعار الأستاذ بنجاح ✅' : ('فشل إرسال إشعار الأستاذ: ' + (tRes.message || JSON.stringify(tRes))));
    } else {
      logTelegramEvent(teacherMsg, 'فارغ', sheetNumber, studentName, 'لم يتم إرسال إشعار للأستاذ (معرف الأستاذ غير مسجل أو الإشعار معطل)');
    }

    // إرسال لقروب الأساتذة (إن وجد ومفعل)
    if (config.notifyGroupOnSubmit && config.groupChatId) {
      var gRes = sendTelegramNotification({
        botToken: botToken,
        chatId: config.groupChatId,
        text: teacherMsg,
        photo: photoToSend,
        buttons: actionButtons
      });
      logTelegramEvent(teacherMsg, config.groupChatId, sheetNumber, studentName, (gRes && gRes.success) ? 'تم إرسال إشعار القروب بنجاح ✅' : ('فشل إرسال القروب: ' + (gRes.message || '')));
    }

    // 2) إرسال رسالة التلغرام التلقائية للطالب عند اكتمال الواجب (بناءً على لغته وقالب homework_received)
    if (sheetNumber || studentName) {
      var users = getTelegramUsers();
      var studentBinding = null;
      for (var k in users) {
        if (users[k] && users[k].sheetNumber && String(users[k].sheetNumber).trim() === String(sheetNumber).trim()) {
          studentBinding = users[k];
          break;
        }
      }
      if (!studentBinding && studentName) {
        for (var k2 in users) {
          if (users[k2] && users[k2].studentName && String(users[k2].studentName).trim().toLowerCase() === String(studentName).trim().toLowerCase()) {
            studentBinding = users[k2];
            break;
          }
        }
      }

      if (studentBinding && studentBinding.chatId) {
        var studentLang = normalizeLanguage(studentBinding.language || studentBinding.rawLanguage || 'ar');
        var defaultStudentMsgAr = '✅ تم استلام واجبك بنجاح يا {student}!\\n📚 الدرس: {lesson}\\nتم إرسال إجاباتك وملفاتك إلى الأستاذ، وسيصلك إشعار التصحيح فور اعتماده 🌸';
        var defaultStudentMsgTh = '✅ ได้รับการบ้านเรียบร้อยแล้ว คุณ {student}!\\n📚 บทเรียน: {lesson}\\nส่งคำตอบและไฟล์ไปยังอาจารย์แล้ว และจะแจ้งผลการตรวจทันทีที่เสร็จสิ้น 🌸';
        var defaultStudentMsgEn = '✅ Your homework for: 📚 {lesson} has been received, {student}!\\nYour answers and files have been sent to the teacher. You will be notified once reviewed 🌸';

        var defaultStudentMsg = studentLang === 'th' ? defaultStudentMsgTh : (studentLang === 'en' ? defaultStudentMsgEn : defaultStudentMsgAr);
        var tmplInfo = getTelegramTemplateInfo('homework_received', studentLang, defaultStudentMsg, '', '');
        var studentMsg = renderTemplate(tmplInfo.text, {
          student: studentName,
          lesson: lessonTitle || 'تمرين الخط',
          sheet: sheetNumber,
          score: formattedScore
        });

        var studentButtons = [];
        if (tmplInfo.buttonUrl) {
          var renderedBtnUrl = renderTemplate(tmplInfo.buttonUrl, {
            student: studentName,
            lesson: lessonTitle || '',
            sheet: sheetNumber,
            score: formattedScore
          });
          var defaultBtnLbl = studentLang === 'th' ? '🔗 เปิดลิงก์' : (studentLang === 'en' ? '🔗 Open Link' : '🔗 فتح الرابط');
          var renderedBtnText = renderTemplate(tmplInfo.buttonText || defaultBtnLbl, {
            student: studentName,
            lesson: lessonTitle || '',
            sheet: sheetNumber,
            score: formattedScore
          });
          if (renderedBtnUrl && renderedBtnUrl.toString().trim()) {
            studentButtons.push({ text: renderedBtnText, url: renderedBtnUrl.toString().trim() });
          }
        }

        var sRes = sendTelegramNotification({
          botToken: botToken,
          chatId: studentBinding.chatId,
          text: studentMsg,
          buttons: studentButtons.length > 0 ? studentButtons : null
        });
        logTelegramEvent(studentMsg, studentBinding.chatId, sheetNumber, studentName, (sRes && sRes.success) ? 'تم إرسال تأكيد الاستلام للطالب بنجاح ✅' : ('فشل إرسال تأكيد الطالب: ' + (sRes.message || '')));
      }
    }
  } catch (errNotify) {
    try {
      logTelegramEvent('خطأ استثناء أثناء إرسال إشعار التسليم', '', '', '', 'السبب: ' + errNotify.message);
    } catch(e) {}
  }
}

function getAllSettingsStudents() {
  try {
    var ss = getSpreadsheet();
    if (!ss) return [];
    var settingsSheet = ss.getSheetByName('Settings');
    if (!settingsSheet) return [];
    var data = settingsSheet.getDataRange().getValues();
    var list = [];
    var seen = {};

    for (var r = 1; r < data.length; r++) {
      // 1) قراءة العمود B (رقم الطالب، index 1) والعمود C (اسم الطالب، index 2)
      var sNumB = (data[r][1] !== undefined && data[r][1] !== null) ? data[r][1].toString().trim() : '';
      var userC = (data[r][2] !== undefined && data[r][2] !== null) ? data[r][2].toString().trim() : '';
      if (userC || sNumB) {
        var studentName = userC || ('طالب رقم ' + sNumB);
        var studentSheet = sNumB || String(r);
        var key = (studentName + '__' + studentSheet).toLowerCase();
        if (!seen[key]) {
          seen[key] = true;
          list.push({ name: studentName, sheet: studentSheet });
        }
      }

      // 2) فحص إضافي للأعمدة Z و AA
      var userZ = (data[r][25] !== undefined && data[r][25] !== null) ? data[r][25].toString().trim() : '';
      var sNumAA = (data[r][26] !== undefined && data[r][26] !== null) ? data[r][26].toString().trim() : '';
      if (userZ || sNumAA) {
        var studentNameZ = userZ || ('طالب رقم ' + sNumAA);
        var studentSheetAA = sNumAA || String(r);
        var keyZ = (studentNameZ + '__' + studentSheetAA).toLowerCase();
        if (!seen[keyZ]) {
          seen[keyZ] = true;
          list.push({ name: studentNameZ, sheet: studentSheetAA });
        }
      }
    }
    return list;
  } catch (err) {
    return [];
  }
}

// ------------------- معالج Webhook المخصص للإشعارات واللغات فقط (بدون تسجيل آلي في التيليجرام) -------------------

function handleTelegramWebhookUpdate(update) {
  try {
    var msg = update.message || update.edited_message || (update.callback_query ? update.callback_query.message : null);
    if (!msg) return;

    var chatId = msg.chat ? msg.chat.id : null;
    if (!chatId && update.callback_query && update.callback_query.from) {
      chatId = update.callback_query.from.id;
    }
    if (!chatId) return;

    // منع تكرار المعالجة إذا أعاد Telegram إرسال نفس التحديث (Idempotency Cache)
    var updateId = update.update_id ? String(update.update_id) : (msg.message_id ? String(msg.message_id) : '');
    if (updateId) {
      var cache = CacheService.getScriptCache();
      var cacheKey = 'tg_upd_' + updateId;
      if (cache && cache.get(cacheKey)) {
        return;
      }
      if (cache) cache.put(cacheKey, '1', 600);
    }

    var config = getTelegramConfig();
    var botToken = config.botToken || (typeof DEFAULT_BOT_TOKEN !== 'undefined' ? DEFAULT_BOT_TOKEN : '');
    if (!botToken) return;

    // في حال النقر على أزرار التفاعل (Callback Query) يتم الرد السريع لإغلاق دائرة التحميل
    if (update.callback_query && update.callback_query.id) {
      var cbData = (update.callback_query.data || '').toString().trim();
      
      // إذا كان النقر لتغيير لغة الإشعارات لطالب مسجل مسبقاً
      if (cbData.indexOf('setlang_') === 0) {
        var selectedLang = cbData.replace('setlang_', '').toLowerCase();
        if (selectedLang !== 'ar' && selectedLang !== 'th' && selectedLang !== 'en') selectedLang = 'ar';

        var usersSheet = getTelegramSheet('Telegram_Users');
        if (usersSheet) {
          var uData = usersSheet.getDataRange().getValues();
          for (var i = 1; i < uData.length; i++) {
            if (uData[i][2] && uData[i][2].toString().trim() === String(chatId).trim()) {
              usersSheet.getRange(i + 1, 4).setValue(selectedLang);
            }
          }
        }
      }

      UrlFetchApp.fetch('https://api.telegram.org/bot' + botToken + '/answerCallbackQuery', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ callback_query_id: update.callback_query.id }),
        muteHttpExceptions: true
      });
    }
  } catch (err) {
    try {
      logTelegramEvent('خطأ أثناء استقبال التحديث', '', '', '', 'السبب: ' + err.message);
    } catch(e) {}
  }
}
`;
}
