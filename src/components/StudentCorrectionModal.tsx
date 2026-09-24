import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, RefreshCw, Image as ImageIcon, Mic, Film, Award, Volume2, VolumeX, Play, Pause, RotateCcw, ExternalLink
} from 'lucide-react';
import { StudentCorrection, AdminAnswerRow } from '../types';
import { fetchStudentCorrections, fetchAdminAnswers } from '../api';
import { useLanguage } from '../translations';

interface StudentCorrectionModalProps {
  username: string;
  sheetNumber: string;
  onClose: () => void;
  selectedLessonTitle?: string;
}

export default function StudentCorrectionModal({
  username,
  sheetNumber,
  onClose,
  selectedLessonTitle
}: StudentCorrectionModalProps) {
  const { t } = useLanguage();
  const [corrections, setCorrections] = useState<StudentCorrection[]>([]);
  const [answers, setAnswers] = useState<AdminAnswerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'image' | 'audio' | 'focus'>('image');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Media Modal state for viewing images, videos or listening to audio
  const [activeMedia, setActiveMedia] = useState<{
    type: 'image' | 'video' | 'audio';
    urls: string[];
    activeIndex: number;
    title: string;
  } | null>(null);

  // State to track image load failures and fallback to Drive Preview
  const [imgError, setImgError] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [corrData, answersData] = await Promise.all([
        fetchStudentCorrections(username, sheetNumber),
        fetchAdminAnswers()
      ]);
      setCorrections(corrData || []);

      if (Array.isArray(answersData)) {
        const studentAnswers = answersData.filter(a => {
          const matchSheet = a.sheetNumber && String(a.sheetNumber).trim() === String(sheetNumber).trim();
          const matchUser = a.username && String(a.username).trim().toLowerCase() === String(username).trim().toLowerCase();
          return matchSheet || matchUser;
        });
        setAnswers(studentAnswers);
      }
    } catch (err) {
      console.error('Failed to load corrections or answers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [username, sheetNumber]);

  // Reset image error state whenever activeMedia or activeIndex changes
  useEffect(() => {
    setImgError(false);
  }, [activeMedia?.activeIndex, activeMedia?.type]);

  // Clean date formatter (fixes ISO, Chinese locale, and Apps Script GMT strings)
  const formatDate = (raw?: string) => {
    if (!raw) return '-';
    const str = String(raw).trim();
    if (!str || str === '-' || str === 'null' || str === 'undefined') return '-';

    // Normalize Chinese date format e.g. 2026年8月10日 -> 2026/8/10
    const normalized = str.replace(/[年月]/g, '/').replace(/日/g, '').trim();

    const matchIso = normalized.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (matchIso) {
      const yyyy = matchIso[1];
      const mm = matchIso[2].padStart(2, '0');
      const dd = matchIso[3].padStart(2, '0');
      return `${yyyy}/${mm}/${dd}`;
    }

    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}/${mm}/${dd}`;
      }
    } catch (err) {
      // ignore
    }

    return normalized.split('T')[0].split('GMT')[0].trim() || str;
  };

  // Helper to parse multiple URLs separated by |||, ||, |, newlines, commas, or semicolons
  const parseUrls = (raw?: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.flatMap(r => parseUrls(r)).filter(Boolean);
    }
    const str = String(raw).trim();
    if (!str || str === '-' || str === 'null' || str === 'undefined') return [];

    return str
      .split(/(?:\|\|\||\|\||\||\r?\n|,|;)+/)
      .map(s => s.trim())
      .filter(s => s.length > 5 && (s.startsWith('http') || s.includes('drive.google.com')));
  };

  // Extract Google Drive File ID
  const getDriveFileId = (url?: string): string | null => {
    if (!url) return null;
    const str = String(url).trim();

    // Match /file/d/ID or /folders/d/ID or /d/ID
    const matchFile = str.match(/\/(?:file\/|folders\/)?d\/([a-zA-Z0-9_-]+)/);
    if (matchFile && matchFile[1]) return matchFile[1];

    // Match ?id=ID or &id=ID or open?id=ID or uc?id=ID
    const matchId = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchId && matchId[1]) return matchId[1];

    // Any query param with id=... if url contains google
    if (str.includes('google.com') || str.includes('googleusercontent.com')) {
      const matchAny = str.match(/id=([a-zA-Z0-9_-]+)/);
      if (matchAny && matchAny[1]) return matchAny[1];
    }

    return null;
  };

  // Get direct image URL from Google Drive
  const getDriveImageUrl = (url: string): string => {
    if (!url) return '';
    const fileId = getDriveFileId(url);
    if (fileId) {
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
    return url;
  };

  // Filter corrections if user searches for a lesson title
  const filteredCorrections = corrections.filter(c => {
    if (!searchTerm.trim()) return true;
    return c.lessonTitle.toLowerCase().includes(searchTerm.toLowerCase().trim());
  });

  // Filter answers for Focus Scores tab
  const filteredAnswers = answers.filter(a => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.trim().toLowerCase();
    const topic = (a.comment || a.username || '').toLowerCase();
    return topic.includes(term);
  });

  // Format formula (AM) and result (AN) cleanly with fallbacks
  const getDisplayFormulaAndResult = (row: AdminAnswerRow) => {
    let rawFormula = (row.finalFormula || '').toString().trim();
    let rawResult = (row.finalResult || '').toString().trim();

    // Clean formula if it starts with '='
    if (rawFormula.startsWith('=')) {
      rawFormula = rawFormula.substring(1).trim();
    }

    // Handle legacy GAS response where Column AM was mapped to `finalResult` and `finalFormula` was missing
    if (!rawFormula && rawResult) {
      // If rawResult looks like a formula (e.g., contains "+", "=", or multi-score like "15/15 + 2/2")
      if (rawResult.includes('+') || rawResult.includes('=') || (rawResult.includes('/') && rawResult.length > 7)) {
        rawFormula = rawResult;
        rawResult = ''; // reset so real result (AN) can be derived or extracted below
      }
    }

    // If formula (AM) is still missing, build clean readable fallback formula from video (U) and audio (Z) answers
    if (!rawFormula) {
      const v = row.videoAnswersResult?.trim();
      const a = row.audioAnswersResult?.trim();
      if (v && a) {
        rawFormula = `${v} + ${a}`;
      } else if (v) {
        rawFormula = v;
      } else if (a) {
        rawFormula = a;
      }
    }

    // If result (AN) is missing, extract from formula if it contains "=" or compute percentage from U and Z
    if (!rawResult) {
      if (rawFormula.includes('=')) {
        const parts = rawFormula.split('=');
        rawResult = parts[parts.length - 1].trim();
      } else {
        const parseFrac = (s?: string) => {
          if (!s || !s.includes('/')) return { num: 0, den: 0 };
          const parts = s.split('/');
          return { num: parseFloat(parts[0]) || 0, den: parseFloat(parts[1]) || 0 };
        };
        const vf = parseFrac(row.videoAnswersResult);
        const af = parseFrac(row.audioAnswersResult);
        const totNum = vf.num + af.num;
        const totDen = vf.den + af.den;

        if (totDen > 0) {
          const pct = Math.round((totNum / totDen) * 100);
          rawResult = `${pct}%`;
        }
      }
    }

    // Format rawResult as a percentage if it's a decimal (e.g., 0.4 -> 40%, 1 -> 100%), fraction, or numeric
    let formattedResult = rawResult;
    if (formattedResult && formattedResult !== '-') {
      const cleanStr = formattedResult.replace('=', '').trim();
      if (cleanStr.includes('%')) {
        formattedResult = cleanStr;
      } else if (cleanStr.includes('/')) {
        const parts = cleanStr.split('/');
        const num = parseFloat(parts[0]);
        const den = parseFloat(parts[1]);
        if (!isNaN(num) && !isNaN(den) && den > 0) {
          formattedResult = `${Math.round((num / den) * 100)}%`;
        }
      } else {
        const numVal = parseFloat(cleanStr);
        if (!isNaN(numVal)) {
          if (numVal <= 1 && numVal >= 0) {
            // Decimal fraction from Google Sheets like 0.4, 0.95, 1 -> 40%, 95%, 100%
            formattedResult = `${Math.round(numVal * 100)}%`;
          } else if (numVal <= 100) {
            formattedResult = `${Math.round(numVal)}%`;
          } else {
            formattedResult = `${numVal}%`;
          }
        }
      }
    }

    return {
      formula: rawFormula || '-',
      result: formattedResult || '-'
    };
  };

  // Calculate 10-star rating and encouraging text from final score/formula
  const calculateRatingAndMessage = (finalResultStr?: string, formulaStr?: string, videoScore?: string, audioScore?: string) => {
    const str = String(finalResultStr || formulaStr || '').trim();

    if (!str || str === '-' || str === '0' || str === 'null' || str === 'undefined') {
      if (videoScore || audioScore) {
        return {
          starsCount: 5,
          text: t('rating_calculating', 'جاري احتساب النتيجة النهائية... ⏳'),
          color: 'text-amber-300',
          percentage: 50
        };
      }
      return {
        starsCount: 0,
        text: t('rating_pending', 'في انتظار الإكمال والتقييم ⏳'),
        color: 'text-slate-500',
        percentage: 0
      };
    }

    let percentage = 0;

    if (str.includes('%')) {
      const val = parseFloat(str.replace('%', '').trim());
      if (!isNaN(val)) percentage = val;
    } else if (str.includes('/')) {
      const parts = str.split('/');
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (!isNaN(num) && !isNaN(den) && den > 0) {
        percentage = (num / den) * 100;
      }
    } else {
      const val = parseFloat(str);
      if (!isNaN(val)) {
        if (val <= 1 && val >= 0) {
          percentage = Math.round(val * 100);
        } else if (val <= 100) {
          percentage = val;
        }
      }
    }

    const starsCount = Math.min(10, Math.max(0, Math.round((percentage / 100) * 10)));

    let text = '';
    let color = 'text-amber-400';

    if (percentage >= 95) {
      text = t('rating_excellent_plus', 'ممتاز جداً! أداء أسطوري ورائع 🌟👏');
      color = 'text-emerald-400';
    } else if (percentage >= 80) {
      text = t('rating_excellent', 'ممتاز! استمر في هذا التفوق الباهر ⭐👍');
      color = 'text-emerald-300';
    } else if (percentage >= 65) {
      text = t('rating_very_good', 'جيد جداً! عمل رائع وبإمكانك التطلع للقمة 💪✨');
      color = 'text-amber-300';
    } else if (percentage >= 50) {
      text = t('rating_good', 'جيد! واصل التدريب والمراجعة لتحقيق الأفضل 📚🎯');
      color = 'text-amber-400';
    } else if (percentage > 0) {
      text = t('rating_try_again', 'حاول مرة أخرى! بالتركيز والممارسة ستصل للأفضل 🚀🌱');
      color = 'text-rose-400';
    } else {
      text = t('rating_pending', 'في انتظار الإكمال والتقييم ⏳');
      color = 'text-slate-400';
    }

    return { starsCount, text, color, percentage };
  };

  // Audio Player Component (Reliable Google Drive Iframe + Direct Native Fallback + Protected Download)
  const AudioPlayerView = ({
    url,
    driveId,
    title
  }: {
    url: string;
    driveId: string | null;
    title: string;
    key?: React.Key;
  }) => {
    const isGoogleDrive = Boolean(driveId || url.includes('drive.google.com') || url.includes('docs.google.com') || url.includes('googleusercontent.com'));
    const embedPreviewUrl = driveId 
      ? `https://drive.google.com/file/d/${driveId}/preview`
      : url.replace(/\/(view|edit|open)\b.*/, '/preview');

    const sources = driveId ? [
      `https://lh3.googleusercontent.com/d/${driveId}`,
      `https://docs.google.com/uc?export=open&id=${driveId}`,
      `https://docs.google.com/uc?export=download&id=${driveId}`,
      url
    ] : [url];

    return (
      <div className="w-full max-w-xl p-4 sm:p-5 bg-slate-950 rounded-3xl border border-slate-800/90 shadow-2xl flex flex-col gap-4 text-slate-100 my-2">
        {/* Header Title */}
        <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl shrink-0">
            <Volume2 className="w-6 h-6 animate-pulse" />
          </div>
          <div className="text-right flex-1 min-w-0">
            <h4 className="text-xs font-bold text-slate-200 truncate">{title}</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">{t('corr_modal_audio_explanation_player_desc', 'مشغل الشرح الصوتي الخاص بالواجب')}</p>
          </div>
        </div>

        {/* 1. Primary Google Drive Preview Player (Guaranteed to work for Drive Audio) */}
        {isGoogleDrive && (
          <div className="space-y-1.5 text-right">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>{t('corr_modal_direct_gdrive_player', 'مشغل Google Drive المباشر')}</span>
              </span>
            </div>
            
            {/* Cropped Google Drive Player Container: -mt-12 crops the top header bar (popout icon & title) completely out of view */}
            <div className="relative w-full h-36 sm:h-40 rounded-2xl border border-slate-800/90 overflow-hidden bg-slate-900 shadow-inner">
              <div className="-mt-12 w-full h-[calc(100%+48px)] relative">
                <iframe
                  src={embedPreviewUrl}
                  title={t('corr_modal_audio_player_title', 'مشغل الصوت')}
                  className="w-full h-full border-0"
                  allow="autoplay"
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. Direct HTML5 Native Audio Player */}
        <div className="space-y-1.5 text-right">
          <span className="text-[11px] font-bold text-slate-400">{t('corr_modal_browser_direct_player', 'المشغل المباشر للمتصفح:')}</span>
          <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800">
            <audio
              key={url}
              controls
              autoPlay={!isGoogleDrive}
              controlsList="nodownload"
              onContextMenu={(e) => e.preventDefault()}
              className="w-full h-10 accent-emerald-500"
            >
              {sources.map((src, i) => (
                <source key={i} src={src} type="audio/mpeg" />
              ))}
              متصفحك لا يدعم تشغيل هذا الصوت مباشرة.
            </audio>
          </div>
        </div>
      </div>
    );
  };

  // Render Video Modal Embed / Player
  const renderVideoEmbed = (url: string) => {
    if (!url) return null;

    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let embedUrl = url;
      const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      if (ytMatch && ytMatch[1]) {
        embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
      }
      return (
        <iframe
          src={embedUrl}
          title={t('corr_modal_col_correction_video', 'فيديو التصحيح')}
          className="w-full aspect-video max-h-[65vh] rounded-2xl border border-slate-700 shadow-lg"
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      );
    }

    // Google Drive Video
    const driveId = getDriveFileId(url);
    if (driveId) {
      const previewUrl = `https://drive.google.com/file/d/${driveId}/preview`;
      return (
        <div className="relative w-full aspect-video max-h-[65vh] rounded-2xl border border-slate-700 shadow-lg overflow-hidden bg-slate-950">
          <iframe
            src={previewUrl}
            title={t('corr_modal_col_correction_video', 'فيديو التصحيح')}
            className="w-full h-full"
            allow="autoplay"
          />
          {/* Transparent overlays to block ONLY top-right and top-left popout/external buttons in Google Drive iframe */}
          <div 
            className="absolute top-0 right-0 w-16 h-11 z-20 cursor-default" 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          />
          <div 
            className="absolute top-0 left-0 w-16 h-11 z-20 cursor-default" 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          />
        </div>
      );
    }

    // Direct MP4 / Cloudinary / standard video (With download button disabled)
    return (
      <video 
        src={url} 
        controls 
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        autoPlay 
        playsInline
        className="w-full max-h-[65vh] rounded-2xl border border-slate-700 shadow-lg" 
      />
    );
  };

  // Render Icon-Only Trigger Button for Table Cells
  const renderMediaCellButton = (
    type: 'image' | 'video' | 'audio', 
    rawData?: any, 
    title: string = ''
  ) => {
    const validUrls = parseUrls(rawData);
    if (validUrls.length === 0) return <span className="text-slate-600 text-[11px]">-</span>;

    let Icon = ImageIcon;
    let btnStyle = "bg-slate-800/90 hover:bg-slate-700 text-amber-400 border-slate-700 hover:border-amber-500/50";

    if (type === 'video') {
      Icon = Film;
      btnStyle = "bg-purple-950/70 hover:bg-purple-900 text-purple-300 border-purple-800/80 hover:border-purple-500/50";
    } else if (type === 'audio') {
      Icon = Volume2;
      btnStyle = "bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border-emerald-800/80 hover:border-emerald-500/50";
    }

    return (
      <div className="flex items-center justify-center">
        <button
          onClick={() => setActiveMedia({
            type,
            urls: validUrls,
            activeIndex: 0,
            title: title || (type === 'image' ? t('corr_modal_preview_images', 'معاينة الصور') : type === 'video' ? t('corr_modal_video_player', 'مشغل الفيديو') : t('corr_modal_audio_recording', 'التسجيل الصوتي'))
          })}
          className={`relative p-2 border rounded-xl transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 ${btnStyle}`}
          title={validUrls.length > 1 ? t('corr_modal_attachments_count_title', 'يوجد {count} ملحقات - انقر للمعاينة').replace('{count}', String(validUrls.length)) : t('corr_modal_click_to_preview', 'انقر للمعاينة')}
        >
          <Icon className="w-4 h-4" />
          {validUrls.length > 1 && (
            <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 bg-amber-500 text-slate-950 font-extrabold text-[10px] rounded-full shadow-md border border-slate-900">
              {validUrls.length}
            </span>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="relative w-full max-w-7xl bg-slate-900 border border-slate-700/80 rounded-3xl p-4 sm:p-6 shadow-2xl max-h-[94vh] overflow-hidden text-slate-100 flex flex-col"
        dir="rtl"
      >
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-100 flex items-center gap-2">
                <span>{t('corr_modal_header', 'جدول تصحيحات الأستاذ وملاحظات الواجبات')}</span>
              </h2>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                {t('corr_modal_student', 'الطالب:')} <span className="text-amber-400">{username}</span> | {t('corr_modal_sheet', 'ورقة رقم')} #{sheetNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={loadData}
              disabled={loading}
              title={t('refresh_data', 'تحديث البيانات')}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all border border-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Section Switcher Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2 p-1 bg-slate-950 border border-slate-800 rounded-2xl w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab('image')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
                activeTab === 'image'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>{t('corr_modal_tab_image', '1. تصحيح واجب الصورة')}</span>
            </button>

            <button
              onClick={() => setActiveTab('audio')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
                activeTab === 'audio'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>{t('corr_modal_tab_audio', '2. تصحيح واجب الصوت')}</span>
            </button>

            <button
              onClick={() => setActiveTab('focus')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
                activeTab === 'focus'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>{t('corr_modal_tab_focus', '3. درجات التركيز في الدرس')}</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="w-full sm:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('corr_modal_search', 'تصفية بالموضوع/الدرس...')}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500 transition-all"
            />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-grow overflow-y-auto py-3 space-y-4">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400 font-semibold">{t('corr_modal_loading', 'جاري جلب جدول التصحيحات من شيت الأستاذ...')}</p>
            </div>
          ) : activeTab === 'focus' ? (
            /* Focus Scores Table View */
            filteredAnswers.length === 0 ? (
              <div className="py-16 text-center space-y-3 bg-slate-950/40 rounded-3xl border border-slate-800">
                <div className="w-14 h-14 bg-slate-800 text-amber-400 rounded-2xl flex items-center justify-center mx-auto text-xl">
                  🏆
                </div>
                <h3 className="text-sm font-bold text-slate-200">{t('corr_modal_no_focus_title', 'لا توجد درجات تركيز مطابقة')}</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {searchTerm ? t('corr_modal_no_search_results', 'لم يتم العثور على دروس تطابق كلمة البحث.') : t('corr_modal_no_focus_recorded', 'لم يتم رصد نتائج درجات التركيز لهذا الطالب بعد.')}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 shadow-inner">
                <table className="w-full text-right text-xs border-collapse min-w-[950px]">
                  <thead>
                    <tr className="bg-slate-800/90 text-amber-400 font-extrabold border-b border-slate-700/80 sticky top-0 z-10 backdrop-blur-sm">
                      <th className="p-3 bg-sky-950/90 text-sky-300 border-l border-sky-800/60 min-w-[160px]">{t('corr_modal_col_topic', 'الموضوع')}</th>
                      <th className="p-3 border-l border-slate-700/60 text-center min-w-[140px]">{t('corr_modal_col_video_score', 'درجات إجابة أسئلة الفيديو')}</th>
                      <th className="p-3 border-l border-slate-700/60 text-center min-w-[140px]">{t('corr_modal_col_audio_score', 'درجات إجابة أسئلة الصوت')}</th>
                      <th className="p-3 border-l border-slate-700/60 text-center min-w-[160px]">{t('corr_modal_col_full_formula', 'المعادلة الكاملة')}</th>
                      <th className="p-3 border-l border-slate-700/60 text-center min-w-[120px]">{t('corr_modal_col_final_result', 'النتيجة النهائية')}</th>
                      <th className="p-3 text-center min-w-[240px]">{t('corr_modal_col_evaluation', 'التقييم والتشجيع')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredAnswers.map((row, idx) => {
                      const { formula, result } = getDisplayFormulaAndResult(row);
                      const rating = calculateRatingAndMessage(result, formula, row.videoAnswersResult, row.audioAnswersResult);
                      const topicName = row.comment || row.username || 'بدون عنوان';
                      const isSelected = selectedLessonTitle && topicName.trim().toLowerCase() === selectedLessonTitle.trim().toLowerCase();

                      return (
                        <tr
                          key={idx}
                          className={`transition-colors hover:bg-slate-800/40 ${
                            isSelected ? 'bg-amber-500/10 border-amber-500/30' : idx % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-900/70'
                          }`}
                        >
                          {/* 1. Subject (Column C) */}
                          <td className="p-3 font-extrabold text-slate-100 bg-sky-950/20 border-l border-slate-800">
                            <span className="flex items-center gap-1.5">
                              {isSelected && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
                              <span>{topicName}</span>
                            </span>
                          </td>

                          {/* 2. Video Questions Score (Column U) */}
                          <td className="p-3 text-center border-l border-slate-800">
                            {row.videoAnswersResult ? (
                              <span className="inline-block px-3 py-1 bg-sky-500/10 border border-sky-500/30 text-sky-300 rounded-xl font-mono font-black text-sm">
                                {row.videoAnswersResult}
                              </span>
                            ) : (
                              <span className="text-slate-600 text-xs">-</span>
                            )}
                          </td>

                          {/* 3. Audio Questions Score (Column Z) */}
                          <td className="p-3 text-center border-l border-slate-800">
                            {row.audioAnswersResult ? (
                              <span className="inline-block px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 rounded-xl font-mono font-black text-sm">
                                {row.audioAnswersResult}
                              </span>
                            ) : (
                              <span className="text-slate-600 text-xs">-</span>
                            )}
                          </td>

                          {/* 4. Full Formula (Column AM) */}
                          <td className="p-3 text-center border-l border-slate-800">
                            {formula !== '-' ? (
                              <span className="inline-block px-3 py-1.5 bg-slate-900 border border-slate-700/80 text-amber-200/90 rounded-xl font-mono text-xs sm:text-sm font-extrabold tracking-wider dir-ltr shadow-inner">
                                {formula}
                              </span>
                            ) : (
                              <span className="text-slate-600 text-xs">-</span>
                            )}
                          </td>

                          {/* 5. Final Result (Column AN) */}
                          <td className="p-3 text-center border-l border-slate-800">
                            {result !== '-' ? (
                              <span className="inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-amber-500/20 border-2 border-amber-400/60 text-amber-300 font-black text-base sm:text-lg rounded-2xl shadow-lg shadow-amber-500/10 tracking-widest font-mono">
                                {result}
                              </span>
                            ) : (
                              <span className="text-slate-600 text-xs">-</span>
                            )}
                          </td>

                          {/* 6. Rating (10 Stars + Encouraging Text) */}
                          <td className="p-3 text-center">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <div className="flex items-center gap-0.5 dir-ltr" title={`${rating.starsCount} من 10 نجوم`}>
                                {Array.from({ length: 10 }).map((_, starIdx) => {
                                  const isFilled = starIdx < rating.starsCount;
                                  return (
                                    <span
                                      key={starIdx}
                                      className={`text-sm sm:text-base transition-transform ${
                                        isFilled ? 'text-amber-400 drop-shadow-[0_0_3px_rgba(251,191,36,0.6)] scale-110' : 'text-slate-700/80'
                                      }`}
                                    >
                                      ★
                                    </span>
                                  );
                                })}
                              </div>
                              <span className={`text-[11px] font-bold ${rating.color}`}>
                                {rating.text}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredCorrections.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-slate-950/40 rounded-3xl border border-slate-800">
              <div className="w-14 h-14 bg-slate-800 text-amber-400 rounded-2xl flex items-center justify-center mx-auto text-xl">
                📝
              </div>
              <h3 className="text-sm font-bold text-slate-200">{t('corr_modal_no_records_title', 'لا توجد سجلات تصحيح مطابقة')}</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchTerm ? t('corr_modal_no_search_results', 'لم يتم العثور على دروس تطابق كلمة البحث.') : t('corr_modal_no_corrections_recorded', 'لم يقم الأستاذ بإضافة تصحيحات مسجلة لهذه الورقة بعد.')}
              </p>
            </div>
          ) : (
            /* Structured Table View */
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 shadow-inner">
              <table className="w-full text-right text-xs border-collapse min-w-[1100px]">
                <thead>
                  <tr className="bg-slate-800/90 text-amber-400 font-extrabold border-b border-slate-700/80 sticky top-0 z-10 backdrop-blur-sm">
                    {activeTab === 'image' ? (
                      <>
                        <th className="p-3 bg-sky-950/90 text-sky-300 border-l border-sky-800/60 w-32">{t('corr_modal_col_topic', 'الموضوع')}</th>
                        <th className="p-3 bg-sky-950/90 text-sky-300 border-l border-sky-800/60 text-center w-28">{t('corr_modal_col_image_send_count', 'عدد إرسال الصورة')}</th>
                        <th className="p-3 bg-sky-950/90 text-sky-300 border-l-2 border-sky-500/60 text-center w-28">{t('corr_modal_col_image_assignment', 'واجب الصورة')}</th>
                        <th className="p-3 border-l border-slate-700/60 text-center w-24">{t('corr_modal_col_score', 'الدرجة')}</th>
                        <th className="p-3 border-l border-slate-700/60 text-center w-28">{t('corr_modal_col_correction_image', 'صورة التصحيح')}</th>
                        <th className="p-3 border-l border-slate-700/60 text-center w-28">{t('corr_modal_col_additional_images', 'صور إضافية')}</th>
                        <th className="p-3 border-l border-slate-700/60 text-center w-28">{t('corr_modal_col_correction_video', 'فيديو التصحيح')}</th>
                        <th className="p-3 border-l border-slate-700/60 text-center w-28">{t('corr_modal_col_audio_explanation', 'شرح بالصوت')}</th>
                        <th className="p-3 border-l border-slate-700/60 text-center w-28">{t('corr_modal_col_correction_date', 'تاريخ التصحيح')}</th>
                        <th className="p-3 border-l border-slate-700/60 text-center w-24">{t('corr_modal_col_send_count', 'عدد الإرسال')}</th>
                        <th className="p-3 min-w-[200px]">{t('corr_modal_col_teacher_notes', 'ملاحظات الأستاذ')}</th>
                      </>
                    ) : (
                      <>
                        <th className="p-3 bg-sky-950/90 text-sky-300 border-l border-sky-800/60 w-32">{t('corr_modal_col_topic', 'الموضوع')}</th>
                        <th className="p-3 bg-sky-950/90 text-sky-300 border-l border-sky-800/60 text-center w-28">{t('corr_modal_col_audio_send_count', 'عدد إرسال الصوت')}</th>
                        <th className="p-3 bg-sky-950/90 text-sky-300 border-l-2 border-sky-500/60 text-center w-28">{t('corr_modal_col_audio_assignment', 'واجب الصوت')}</th>
                        <th className="p-3 border-l border-slate-700/60 text-center w-24">{t('corr_modal_col_score', 'الدرجة')}</th>
                        <th className="p-3 border-l border-slate-700/60 text-center w-28">{t('corr_modal_col_audio_notes_image', 'صورة ملاحظات الصوت')}</th>
                        <th className="p-3 border-l border-slate-700/60 text-center w-28">{t('corr_modal_col_audio_explanation', 'شرح بالصوت')}</th>
                        <th className="p-3 border-l border-slate-700/60 text-center w-28">{t('corr_modal_col_additional_images', 'صور إضافية')}</th>
                        <th className="p-3 border-l border-slate-700/60 text-center w-28">{t('corr_modal_col_correction_video', 'فيديو التصحيح')}</th>
                        <th className="p-3 border-l border-slate-700/60 text-center w-28">{t('corr_modal_col_correction_date', 'تاريخ التصحيح')}</th>
                        <th className="p-3 border-l border-slate-700/60 text-center w-24">{t('corr_modal_col_send_count', 'عدد الإرسال')}</th>
                        <th className="p-3 min-w-[200px]">{t('corr_modal_col_teacher_notes', 'ملاحظات الأستاذ')}</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredCorrections.map((row, idx) => {
                    const isSelectedLesson = selectedLessonTitle && row.lessonTitle.trim().toLowerCase() === selectedLessonTitle.trim().toLowerCase();
                    const sec = activeTab === 'image' ? row.imageCorrection : row.audioCorrection;

                    return (
                      <tr
                        key={idx}
                        className={`transition-colors hover:bg-slate-800/40 ${
                          isSelectedLesson ? 'bg-amber-500/10 border-amber-500/30' : idx % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-900/70'
                        }`}
                      >
                        {activeTab === 'image' ? (
                          <>
                            {/* 1. Subject (Student Data) */}
                            <td className="p-3 font-extrabold text-slate-100 bg-sky-950/20 border-l border-slate-800">
                              <span className="flex items-center gap-1.5">
                                {isSelectedLesson && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
                                <span>{row.lessonTitle || 'بدون عنوان'}</span>
                              </span>
                            </td>

                            {/* 2. Image Send Count (Student Data) */}
                            <td className="p-3 text-center bg-sky-950/20 border-l border-slate-800">
                              <span className="px-2.5 py-0.5 bg-slate-800/90 text-sky-300 border border-sky-800/50 rounded-lg font-mono font-bold text-[11px]">
                                {row.imageSendCount || '0'}
                              </span>
                            </td>

                            {/* 3. Image Assignment (Student Data) */}
                            <td className="p-3 text-center bg-sky-950/20 border-l-2 border-sky-500/50">
                              {renderMediaCellButton('image', row.imageAssignment, t('corr_modal_col_student_image_homework', 'واجب الصورة للطالب'))}
                            </td>

                            {/* 4. Score */}
                            <td className="p-3 text-center border-l border-slate-800">
                              {sec?.score ? (
                                <span className="inline-block px-3 py-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-xl font-black text-sm sm:text-base tracking-wide shadow-md">
                                  {sec.score}
                                </span>
                              ) : (
                                <span className="text-slate-600 text-[11px]">-</span>
                              )}
                            </td>

                            {/* 5. Main Correction Image */}
                            <td className="p-3 text-center border-l border-slate-800">
                              {renderMediaCellButton('image', sec?.mainImage, t('corr_modal_col_correction_image', 'صورة التصحيح'))}
                            </td>

                            {/* 6. Additional Images */}
                            <td className="p-3 text-center border-l border-slate-800">
                              {renderMediaCellButton('image', sec?.additionalImages, t('corr_modal_col_additional_images_corr', 'صور إضافية للتصحيح'))}
                            </td>

                            {/* 7. Videos */}
                            <td className="p-3 text-center border-l border-slate-800">
                              {renderMediaCellButton('video', sec?.videos, t('corr_modal_col_correction_video', 'فيديو التصحيح'))}
                            </td>

                            {/* 8. Audio Explanations */}
                            <td className="p-3 text-center border-l border-slate-800">
                              {renderMediaCellButton('audio', sec?.audioExplanations, t('corr_modal_col_teacher_audio_explanation', 'الشرح الصوتي للأستاذ'))}
                            </td>

                            {/* 9. Correction Date */}
                            <td className="p-3 text-center border-l border-slate-800 text-slate-300 font-mono text-[11px]">
                              {formatDate(sec?.date)}
                            </td>

                            {/* 10. Send Count */}
                            <td className="p-3 text-center border-l border-slate-800">
                              {sec?.sendCount ? (
                                <span className="px-2 py-0.5 bg-sky-950 text-sky-300 rounded-lg font-mono font-bold text-[11px]">
                                  {sec.sendCount}
                                </span>
                              ) : (
                                <span className="text-slate-600 text-[11px]">-</span>
                              )}
                            </td>

                            {/* 11. Notes */}
                            <td className="p-3 text-slate-200 leading-relaxed whitespace-pre-line text-[11px] font-sans max-w-[280px]">
                              {sec?.notes || <span className="text-slate-600">-</span>}
                            </td>
                          </>
                        ) : (
                          <>
                            {/* 1. Subject (Student Data) */}
                            <td className="p-3 font-extrabold text-slate-100 bg-sky-950/20 border-l border-slate-800">
                              <span className="flex items-center gap-1.5">
                                {isSelectedLesson && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
                                <span>{row.lessonTitle || 'بدون عنوان'}</span>
                              </span>
                            </td>

                            {/* 2. Audio Send Count (Student Data) */}
                            <td className="p-3 text-center bg-sky-950/20 border-l border-slate-800">
                              <span className="px-2.5 py-0.5 bg-slate-800/90 text-sky-300 border border-sky-800/50 rounded-lg font-mono font-bold text-[11px]">
                                {row.audioSendCount || '0'}
                              </span>
                            </td>

                            {/* 3. Audio Assignment (Student Data) */}
                            <td className="p-3 text-center bg-sky-950/20 border-l-2 border-sky-500/50">
                              {renderMediaCellButton('audio', row.audioAssignment, t('corr_modal_col_student_audio_homework', 'واجب الصوت للطالب'))}
                            </td>

                            {/* 4. Score */}
                            <td className="p-3 text-center border-l border-slate-800">
                              {sec?.score ? (
                                <span className="inline-block px-3 py-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-xl font-black text-sm sm:text-base tracking-wide shadow-md">
                                  {sec.score}
                                </span>
                              ) : (
                                <span className="text-slate-600 text-[11px]">-</span>
                              )}
                            </td>

                            {/* 5. Audio Notes Image (S) */}
                            <td className="p-3 text-center border-l border-slate-800">
                              {renderMediaCellButton('image', sec?.mainImage, t('corr_modal_col_audio_notes_image', 'صورة ملاحظات الصوت'))}
                            </td>

                            {/* 6. Audio Explanations (T) */}
                            <td className="p-3 text-center border-l border-slate-800">
                              {renderMediaCellButton('audio', sec?.audioExplanations, t('corr_modal_col_teacher_audio_explanation', 'الشرح الصوتي للأستاذ'))}
                            </td>

                            {/* 7. Additional Images (U) */}
                            <td className="p-3 text-center border-l border-slate-800">
                              {renderMediaCellButton('image', sec?.additionalImages, t('corr_modal_col_additional_images', 'صور إضافية'))}
                            </td>

                            {/* 8. Videos (V) */}
                            <td className="p-3 text-center border-l border-slate-800">
                              {renderMediaCellButton('video', sec?.videos, t('corr_modal_col_correction_video', 'فيديو التصحيح'))}
                            </td>

                            {/* 9. Correction Date (W) */}
                            <td className="p-3 text-center border-l border-slate-800 text-slate-300 font-mono text-[11px]">
                              {formatDate(sec?.date)}
                            </td>

                            {/* 10. Send Count (X) */}
                            <td className="p-3 text-center border-l border-slate-800">
                              {sec?.sendCount ? (
                                <span className="px-2 py-0.5 bg-sky-950 text-sky-300 rounded-lg font-mono font-bold text-[11px]">
                                  {sec.sendCount}
                                </span>
                              ) : (
                                <span className="text-slate-600 text-[11px]">-</span>
                              )}
                            </td>

                            {/* 11. Notes (Y) */}
                            <td className="p-3 text-slate-200 leading-relaxed whitespace-pre-line text-[11px] font-sans max-w-[280px]">
                              {sec?.notes || <span className="text-slate-600">-</span>}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Media Lightbox / Video / Audio Viewer Modal */}
        <AnimatePresence>
          {activeMedia && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveMedia(null)}
              className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 cursor-pointer"
            >
              <div 
                onClick={(e) => e.stopPropagation()} 
                className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 p-4 sm:p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 cursor-default"
              >
                {/* Modal Title & Number Switcher Bar */}
                <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-amber-400">{activeMedia.title || t('corr_modal_preview_attachment', 'معاينة المرفق')}</h3>
                  </div>

                  {/* Numbered Toggle Buttons if multiple links exist */}
                  {activeMedia.urls.length > 1 && (
                    <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 font-bold px-2">{t('corr_modal_select_link', 'اختر الرابط:')}</span>
                      {activeMedia.urls.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveMedia(prev => prev ? { ...prev, activeIndex: idx } : null)}
                          className={`min-w-[32px] h-8 px-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            activeMedia.activeIndex === idx
                              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <span>{t('corr_modal_link_num', 'رابط')} {idx + 1}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setActiveMedia(null)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all cursor-pointer mr-auto sm:mr-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Main Media Player / Content View */}
                <div className="w-full flex flex-col items-center justify-center min-h-[220px] max-h-[72vh] overflow-y-auto rounded-2xl bg-slate-950/80 p-3 border border-slate-800/80">
                  {/* IMAGE VIEWER */}
                  {activeMedia.type === 'image' && (() => {
                    const currentUrl = activeMedia.urls[activeMedia.activeIndex];
                    const fileId = getDriveFileId(currentUrl);

                    if (imgError && fileId) {
                      return (
                        <iframe
                          src={`https://drive.google.com/file/d/${fileId}/preview`}
                          title={t('corr_modal_preview_image', 'معاينة الصورة')}
                          className="w-full h-[65vh] rounded-xl border border-slate-800 shadow-md"
                        />
                      );
                    }

                    return (
                      <div className="flex flex-col items-center gap-3 w-full">
                        <img
                          src={getDriveImageUrl(currentUrl)}
                          alt={t('corr_modal_preview_image', 'معاينة الصورة')}
                          referrerPolicy="no-referrer"
                          onError={() => setImgError(true)}
                          className="max-w-full max-h-[62vh] object-contain rounded-xl border border-slate-800 shadow-md"
                        />
                        <a
                          href={currentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                          <span>{t('corr_modal_open_image_window', 'فتح الصورة في نافذة خاصة')}</span>
                        </a>
                      </div>
                    );
                  })()}

                  {/* VIDEO PLAYER */}
                  {activeMedia.type === 'video' && renderVideoEmbed(activeMedia.urls[activeMedia.activeIndex])}

                  {/* AUDIO PLAYER */}
                  {activeMedia.type === 'audio' && (() => {
                    const currentUrl = activeMedia.urls[activeMedia.activeIndex];
                    const driveId = getDriveFileId(currentUrl);

                    return (
                      <AudioPlayerView
                        key={currentUrl}
                        url={currentUrl}
                        driveId={driveId}
                        title={`${activeMedia.title} (${activeMedia.activeIndex + 1} ${t('corr_modal_of_count', 'من')} ${activeMedia.urls.length})`}
                      />
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
