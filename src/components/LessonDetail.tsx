import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WordData, Question, Student } from '../types';
import {
  ArrowRight, Image as ImageIcon, Video, Mic, Upload, Volume2,
  Play, Pause, RefreshCw, CheckCircle2, ChevronRight, X, AlertTriangle, Sparkles, AlertCircle, Maximize, Minimize, Award,
  Camera, FlipHorizontal, Zap, Sun
} from 'lucide-react';
import {
  saveQuestionAnswer,
  getFullAudioListeningScore,
  saveFullAudioListeningScore,
  getLetterListeningScore,
  saveLetterListeningScore,
  getSavedRecordingLink,
  getSavedImageLink,
  uploadImage,
  uploadRecording,
  markLessonCompleted
} from '../api';
import QuestionModal from './QuestionModal';
import StudentCorrectionModal from './StudentCorrectionModal';
import { useLanguage } from '../translations';

// Helper to group Arabic base characters with their combining diacritics and elongation (Tatweel/Kashida ـ)
function groupArabicLetters(word: string): string[] {
  if (!word) return [];
  const parts: string[] = [];
  const chars = word.split('');
  let current = '';

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const code = char.charCodeAt(0);
    // Arabic combining diacritics range from 0x064B to 0x065F, plus 0x0670 (superscript alef)
    // Tatweel / Kashida (ـ) is 0x0640 or 'ـ'
    const isDiacriticOrTatweel = (code >= 0x064B && code <= 0x065F) || code === 0x0670 || code === 0x0640 || char === 'ـ';

    if (isDiacriticOrTatweel) {
      if (current !== '') {
        current += char;
      } else if (parts.length > 0) {
        parts[parts.length - 1] += char;
      } else {
        current = char;
      }
    } else {
      // Base character
      if (current !== '' && /^[\u0640\u064B-\u065F\u0670ـ]+$/.test(current)) {
        current += char;
      } else {
        if (current !== '') {
          parts.push(current);
        }
        current = char;
      }
    }
  }
  if (current !== '') {
    parts.push(current);
  }
  return parts;
}

// Extracted Google Drive File ID helper
function getGoogleDriveFileId(url: string): string | null {
  if (!url) return null;
  // Match standard drive pattern /file/d/FILE_ID/
  const fileDMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) return fileDMatch[1];

  // Match query parameter ?id=FILE_ID or &id=FILE_ID or /uc?id=FILE_ID
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];

  // Match googleusercontent.com/d/FILE_ID
  const ucMatch = url.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (ucMatch && ucMatch[1]) return ucMatch[1];

  return null;
}

// Convert image url to drive thumbnail if it's a google drive file
function getPlayableImageUrl(url: string): string {
  if (!url) return '';
  const driveId = getGoogleDriveFileId(url);
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`;
  }
  return url;
}

// Convert audio/video url to a direct stream link if it's a google drive file
function getPlayableMediaUrl(url: string): string {
  if (!url) return '';
  const driveId = getGoogleDriveFileId(url);
  if (driveId) {
    return `/api/proxy-drive?id=${driveId}`;
  }
  return url;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface LessonDetailProps {
  student: Student;
  lesson: WordData;
  lessonIndex: number;
  isReset: boolean;
  onBack: () => void;
}

export default function LessonDetail({
  student,
  lesson,
  lessonIndex,
  isReset: initialIsReset,
  onBack,
}: LessonDetailProps) {
  const { t } = useLanguage();
  const [isReset, setIsReset] = useState(initialIsReset);
  const [activeTab, setActiveTab] = useState<'study' | 'assignment'>('study');
  const groupedLetters = groupArabicLetters(lesson.word);

  const studentRef = useRef(student);
  const lessonRef = useRef(lesson);
  studentRef.current = student;
  lessonRef.current = lesson;
  
  // Image Lightbox
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  // YouTube State
  const [ytReady, setYtReady] = useState(false);
  const [ytPlaying, setYtPlaying] = useState(false);
  const [ytProgress, setYtProgress] = useState(0);
  const [ytVolume, setYtVolume] = useState(40);
  const ytPlayerRef = useRef<any>(null);
  const ytTimerRef = useRef<number | null>(null);
  const [videoAnswered, setVideoAnswered] = useState<Set<string>>(new Set());
  const [videoSeekError, setVideoSeekError] = useState('');
  
  const isYtVideo = !!(lesson.youtubeUrl && (lesson.youtubeUrl.includes('youtube.com') || lesson.youtubeUrl.includes('youtu.be')));
  const html5VideoRef = useRef<HTMLVideoElement | null>(null);
  const [html5Duration, setHtml5Duration] = useState(0);
  const [html5Loading, setHtml5Loading] = useState(false);
  const videoAnsweredRef = useRef<Set<string>>(new Set());
  const [ytFullscreen, setYtFullscreen] = useState(false);
  const videoCardRef = useRef<HTMLDivElement | null>(null);

  // Explanation Audio State
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioTimeStr, setAudioTimeStr] = useState('00:00 / 00:00');
  const [audioVolume, setAudioVolume] = useState(40);
  const audioObjRef = useRef<HTMLAudioElement | null>(null);
  const [audioAnswered, setAudioAnswered] = useState<Set<string>>(new Set());
  const audioAnsweredRef = useRef<Set<string>>(new Set());

  // Full Lesson Audio State
  const [fullAudioPlaying, setFullAudioPlaying] = useState(false);
  const [fullAudioLoading, setFullAudioLoading] = useState(false);
  const [fullAudioProgress, setFullAudioProgress] = useState(0);
  const [fullAudioDuration, setFullAudioDuration] = useState(0);
  const [fullAudioTimeStr, setFullAudioTimeStr] = useState('00:00 / 00:00');
  const [fullAudioVolume, setFullAudioVolume] = useState(40);
  const [fullAudioScore, setFullAudioScore] = useState(0);
  const [fullAudioCompleted, setFullAudioCompleted] = useState(false);
  const [fullAudioMessage, setFullAudioMessage] = useState<{ text: string; success: boolean } | null>(null);
  const fullAudioObjRef = useRef<HTMLAudioElement | null>(null);
  const fullMaxPercentRef = useRef(0);

  // Letter Sounds State
  const [letterAudios, setLetterAudios] = useState<(HTMLAudioElement | null)[]>([]);
  const [listenedLetters, setListenedLetters] = useState<Set<number>>(new Set());
  const [letterVolume, setLetterVolume] = useState(40);
  const [letterMsg, setLetterMsg] = useState('');
  const [activeLetterIdx, setActiveLetterIdx] = useState<number | null>(null);

  // Integrated Recording State
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [savedRecordingLink, setSavedRecordingLink] = useState('');
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [audioUploadSuccess, setAudioUploadSuccess] = useState(false);
  const [audioUploadError, setAudioUploadError] = useState('');
  const [remainingRetries, setRemainingRetries] = useState(lesson.retryCount);
  const recordingTimerRef = useRef<number | null>(null);

  // Integrated Camera State
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraBrightness, setCameraBrightness] = useState<'boost' | 'high' | 'normal'>('high');
  const [torchActive, setTorchActive] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [capturedImageBase64, setCapturedImageBase64] = useState<string | null>(null);
  const [capturedImagePreview, setCapturedImagePreview] = useState<string | null>(null);
  const [savedImageLink, setSavedImageLink] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadSuccess, setImageUploadSuccess] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const videoStreamRef = useRef<HTMLVideoElement | null>(null);

  // Active Overlay Question
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentQuestionType, setCurrentQuestionType] = useState<'video' | 'audio' | null>(null);
  const currentQuestionRef = useRef<Question | null>(null);
  currentQuestionRef.current = currentQuestion;

  const triggeredVideoKeysRef = useRef<Set<string>>(new Set());
  const triggeredAudioKeysRef = useRef<Set<string>>(new Set());

  const getQuestionId = (q: Question, idx: number) => {
    const slot = q.slotIndex !== undefined ? q.slotIndex : idx;
    const qText = (q.question || '').trim();
    if (qText !== '') return qText;
    return `q_slot_${slot}_time_${q.time}`;
  };

  // Exit Validation State
  const [exitValidationMsg, setExitValidationMsg] = useState<string | null>(null);
  const [finalCompleting, setFinalCompleting] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  const hasLetterSounds = lesson.letterSounds.length > 0 && lesson.letterSounds.some(sound => sound && sound.startsWith('http'));
  const isReviewOnly = lesson.completed === 'تم' && !isReset;

  // Formatter helper
  const formatTime = (sec: number) => {
    if (!isFinite(sec)) return '00:00';
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ------------------- INITIALIZATION & SCORE DATA LOADING -------------------
  useEffect(() => {
    // Load existing scores from Sheet
    const loadScores = async () => {
      try {
        if (lesson.fullSound) {
          const score = await getFullAudioListeningScore(lesson.comment, student.sheetNumber, student.username, lesson.word);
          setFullAudioScore(score);
          if (score === 100 || isReset) {
            setFullAudioCompleted(true);
            setFullAudioMessage({ text: 'رائع! درجة الاستماع لهذا الدرس: 100%', success: true });
          }
        }
        if (hasLetterSounds) {
          const score = await getLetterListeningScore(lesson.comment, student.sheetNumber, student.username, lesson.word);
          if (score === 100 || isReset) {
            const completedSet = new Set<number>();
            for (let i = 0; i < groupedLetters.length; i++) completedSet.add(i);
            setListenedLetters(completedSet);
          }
        }
        // Load assignment status
        const recLink = await getSavedRecordingLink(lesson.comment, student.sheetNumber, student.username, lesson.word);
        if (recLink) {
          setSavedRecordingLink(recLink);
          if (!isReset) {
            setAudioUploadSuccess(true);
          }
        }
        const imgLink = await getSavedImageLink(lesson.comment, student.sheetNumber, student.username, lesson.word);
        if (imgLink) {
          setSavedImageLink(imgLink);
          if (!isReset) {
            setImageUploadSuccess(true);
          }
        }
      } catch (err) {
        console.error('Failed to load student scores:', err);
      }
    };
    loadScores();

    // Setup message listener for external media capture popup
    const handleMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (data && data.type === 'MEDIA_CAPTURED') {
        if (data.mediaType === 'image') {
          // Display the preview instantly
          const dataUrl = `data:${data.mimeType || 'image/jpeg'};base64,${data.base64}`;
          setCapturedImagePreview(dataUrl);
          setCapturedImageBase64(data.base64);

          setUploadingImage(true);
          setImageUploadError('');
          try {
            const uploadResult = await uploadImage({
              base64Data: data.base64,
              mimeType: data.mimeType || 'image/jpeg',
              word: lessonRef.current.word,
              username: studentRef.current.username,
              sheet_number: studentRef.current.sheetNumber,
              comment: lessonRef.current.comment,
            });

            if (uploadResult && uploadResult.success) {
              const driveUrl = uploadResult.link;
              setSavedImageLink(driveUrl);
              setImageUploadSuccess(true);
            } else {
              throw new Error('فشل الرفع إلى جوجل درايف.');
            }
          } catch (err: any) {
            console.error('Failed to upload image from popup:', err);
            setImageUploadError(err.message || 'فشل رفع ملف الصورة.');
          } finally {
            setUploadingImage(false);
          }
        } else if (data.mediaType === 'audio') {
          // Display preview instantly
          const dataUrl = `data:${data.mimeType || 'audio/webm'};base64,${data.base64}`;
          setRecordedAudioUrl(dataUrl);

          setUploadingAudio(true);
          setAudioUploadError('');
          try {
            const uploadResult = await uploadRecording({
              base64Data: data.base64,
              mimeType: data.mimeType || 'audio/webm',
              word: lessonRef.current.word,
              username: studentRef.current.username,
              sheet_number: studentRef.current.sheetNumber,
              comment: lessonRef.current.comment,
            });

            if (uploadResult && uploadResult.success) {
              const driveUrl = uploadResult.link;
              setSavedRecordingLink(driveUrl);
              setAudioUploadSuccess(true);
            } else {
              throw new Error('فشل الرفع إلى جوجل درايف.');
            }
          } catch (err: any) {
            console.error('Failed to upload audio from popup:', err);
            setAudioUploadError(err.message || 'فشل رفع ملف الصوت.');
          } finally {
            setUploadingAudio(false);
          }
        }
      }
    };
    window.addEventListener('message', handleMessage);

    // Setup fullscreen change event listener
    const handleFullscreenChange = () => {
      setYtFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Clean up streams on unmount
    return () => {
      stopAllStreams();
      if (ytTimerRef.current) clearInterval(ytTimerRef.current);
      if (audioObjRef.current) audioObjRef.current.pause();
      if (fullAudioObjRef.current) fullAudioObjRef.current.pause();
      if (html5VideoRef.current) html5VideoRef.current.pause();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Connect and play camera stream inline
  useEffect(() => {
    if (cameraActive && cameraStream && videoStreamRef.current) {
      const video = videoStreamRef.current;
      video.srcObject = cameraStream;
      video.play().catch(err => {
        console.error('Failed to autoplay camera stream:', err);
      });
    }
  }, [cameraActive, cameraStream]);

  const stopAllStreams = () => {
    if (micStream) micStream.getTracks().forEach(t => t.stop());
    if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
  };

  // ------------------- YOUTUBE PLAYER CONFIG -------------------
  const initYtPlayer = () => {
    if (!isYtVideo) return;
    try {
      const videoId = lesson.youtubeUrl.match(/(?:youtube\.com\/(?:.*v=|embed\/)|youtu\.be\/)([^?&"'>]+)/)?.[1];
      if (!videoId) return;

      ytPlayerRef.current = new window.YT.Player('yt-player-frame', {
        videoId: videoId,
        playerVars: {
          controls: 0,
          rel: 0,
          showinfo: 0,
          disablekb: 1,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            setYtReady(true);
            ytPlayerRef.current.setVolume(ytVolume);
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setYtPlaying(true);
              // Pause explanation/full audio if playing
              pauseExplanationAudio();
              pauseFullAudio();
              startXyTimer();
            } else {
              setYtPlaying(false);
              stopXyTimer();
            }
          },
        },
      });
    } catch (err) {
      console.error('Failed to init YT player:', err);
    }
  };

  // Re-initialize or handle YouTube Player dynamically on Tab Swapping or Mount
  useEffect(() => {
    if (activeTab === 'study' && lesson.youtubeUrl) {
      if (isYtVideo) {
        if (!window.YT) {
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          const firstScriptTag = document.getElementsByTagName('script')[0];
          firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        }

        const checkAndInitYt = () => {
          const container = document.getElementById('yt-player-frame');
          if (container && window.YT && window.YT.Player) {
            initYtPlayer();
          } else if (activeTab === 'study') {
            setTimeout(checkAndInitYt, 250);
          }
        };

        // Slight delay to ensure DOM state is completely mounted and rendering tab panel
        const timeoutId = setTimeout(checkAndInitYt, 150);
        return () => clearTimeout(timeoutId);
      }
    } else {
      // Clean up when switching away from the study tab
      stopXyTimer();
      setYtReady(false);
      setYtPlaying(false);
      if (html5VideoRef.current) {
        html5VideoRef.current.pause();
      }
    }
  }, [activeTab, lesson.youtubeUrl]);

  const handleToggleFullscreen = () => {
    if (!videoCardRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoCardRef.current.requestFullscreen().catch((err) => {
        console.error('Failed to enter fullscreen:', err);
      });
    }
  };

  const startXyTimer = () => {
    if (ytTimerRef.current) clearInterval(ytTimerRef.current);
    ytTimerRef.current = window.setInterval(() => {
      if (ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
        const curr = ytPlayerRef.current.getCurrentTime();
        const duration = ytPlayerRef.current.getDuration();
        const pct = duration ? (curr / duration) * 100 : 0;
        setYtProgress(pct);

        // Check for interactive questions
        if ((lesson.completed !== 'تم' || isReset) && !currentQuestionRef.current) {
          for (let idx = 0; idx < lesson.questions.length; idx++) {
            const q = lesson.questions[idx];
            const qId = getQuestionId(q, idx);
            const hasContent = (q.question && q.question.trim() !== '') || (q.image && q.image.trim() !== '');

            if (hasContent && !videoAnsweredRef.current.has(qId) && Math.abs(q.time - curr) < 1.2) {
              if (ytPlayerRef.current?.pauseVideo) {
                ytPlayerRef.current.pauseVideo();
              }
              currentQuestionRef.current = q;
              setCurrentQuestion(q);
              setCurrentQuestionType('video');
              break;
            }
          }
        }
      }
    }, 500);
  };

  const stopXyTimer = () => {
    if (ytTimerRef.current) clearInterval(ytTimerRef.current);
  };

  const handleYtPlay = () => {
    if (isYtVideo) {
      if (ytPlayerRef.current && ytReady) {
        ytPlayerRef.current.playVideo();
      }
    } else {
      pauseExplanationAudio();
      pauseFullAudio();
      if (html5VideoRef.current) {
        html5VideoRef.current.play().catch(() => {});
        setYtPlaying(true);
      }
    }
  };

  const handleYtPause = () => {
    if (isYtVideo) {
      if (ytPlayerRef.current && ytReady) {
        ytPlayerRef.current.pauseVideo();
      }
    } else {
      if (html5VideoRef.current) {
        html5VideoRef.current.pause();
        setYtPlaying(false);
      }
    }
  };

  const handleYtVolumeChange = (vol: number) => {
    setYtVolume(vol);
    if (isYtVideo) {
      if (ytPlayerRef.current && ytReady) {
        ytPlayerRef.current.setVolume(vol);
      }
    } else {
      if (html5VideoRef.current) {
        html5VideoRef.current.volume = vol / 100;
      }
    }
  };

  const handleYtSeekBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Check if seeking is allowed (lesson already completed, no questions, or all questions answered)
    const isSeekingAllowed =
      (lesson.completed === 'تم' && !isReset) ||
      (lesson.questions.length === 0) ||
      (lesson.questions.every((q, idx) => {
        const qId = getQuestionId(q, idx);
        return videoAnswered.has(qId) || (q.question && videoAnswered.has(q.question.trim()));
      }));

    if (!isSeekingAllowed) {
      setVideoSeekError('تنبيه: لا يمكن تقديم أو تأخير الفيديو في المشاهدة الأولى. يجب مشاهدة الفيديو والإجابة على جميع الأسئلة أولاً ⛔.');
      setTimeout(() => setVideoSeekError(''), 4500);
      return;
    }

    if (isYtVideo) {
      if (ytPlayerRef.current && ytReady) {
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        const duration = ytPlayerRef.current.getDuration();
        ytPlayerRef.current.seekTo(pct * duration, true);
      }
    } else {
      if (html5VideoRef.current && html5Duration) {
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        html5VideoRef.current.currentTime = pct * html5Duration;
      }
    }
  };

  const handleHtml5TimeUpdate = () => {
    if (!html5VideoRef.current) return;
    const curr = html5VideoRef.current.currentTime;
    const dur = html5VideoRef.current.duration || 1;
    setHtml5Duration(dur);
    setYtProgress((curr / dur) * 100);

    // Check for interactive questions
    if ((lesson.completed !== 'تم' || isReset) && !currentQuestionRef.current) {
      for (let idx = 0; idx < lesson.questions.length; idx++) {
        const q = lesson.questions[idx];
        const qId = getQuestionId(q, idx);
        const hasContent = (q.question && q.question.trim() !== '') || (q.image && q.image.trim() !== '');

        if (hasContent && !videoAnsweredRef.current.has(qId) && Math.abs(q.time - curr) < 1.2) {
          html5VideoRef.current.pause();
          setYtPlaying(false);
          currentQuestionRef.current = q;
          setCurrentQuestion(q);
          setCurrentQuestionType('video');
          break;
        }
      }
    }
  };

  const handleHtml5LoadedMetadata = () => {
    if (html5VideoRef.current) {
      html5VideoRef.current.volume = ytVolume / 100;
      setHtml5Duration(html5VideoRef.current.duration || 0);
    }
  };

  // ------------------- EXPLANATION AUDIO CONFIG -------------------
  const playExplanationAudio = () => {
    // Pause other medias
    handleYtPause();
    pauseFullAudio();

    if (!audioObjRef.current) {
      audioObjRef.current = new Audio(getPlayableMediaUrl(lesson.explainSound));
      audioObjRef.current.volume = audioVolume / 100;

      audioObjRef.current.addEventListener('loadstart', () => setAudioLoading(true));
      audioObjRef.current.addEventListener('waiting', () => setAudioLoading(true));
      audioObjRef.current.addEventListener('canplay', () => setAudioLoading(false));
      audioObjRef.current.addEventListener('playing', () => setAudioLoading(false));
      audioObjRef.current.addEventListener('seeking', () => setAudioLoading(true));
      audioObjRef.current.addEventListener('seeked', () => setAudioLoading(false));
      audioObjRef.current.addEventListener('error', () => setAudioLoading(false));

      audioObjRef.current.addEventListener('loadedmetadata', () => {
        setAudioDuration(audioObjRef.current?.duration || 0);
      });

      audioObjRef.current.addEventListener('timeupdate', () => {
        if (!audioObjRef.current) return;
        const curr = audioObjRef.current.currentTime;
        const dur = audioObjRef.current.duration || 1;
        setAudioProgress((curr / dur) * 100);
        setAudioTimeStr(`${formatTime(curr)} / ${formatTime(dur)}`);

        // Check for questions
        if ((lesson.completed !== 'تم' || isReset) && !currentQuestionRef.current) {
          for (let idx = 0; idx < lesson.audioQuestions.length; idx++) {
            const q = lesson.audioQuestions[idx];
            const qId = getQuestionId(q, idx);
            const hasContent = (q.question && q.question.trim() !== '') || (q.image && q.image.trim() !== '');

            if (hasContent && !audioAnsweredRef.current.has(qId) && Math.abs(q.time - curr) < 1.2) {
              if (audioObjRef.current) {
                audioObjRef.current.pause();
                setAudioPlaying(false);
              }
              currentQuestionRef.current = q;
              setCurrentQuestion(q);
              setCurrentQuestionType('audio');
              break;
            }
          }
        }
      });

      audioObjRef.current.addEventListener('ended', () => {
        setAudioPlaying(false);
      });
    }

    audioObjRef.current.play();
    setAudioPlaying(true);
  };

  const pauseExplanationAudio = () => {
    if (audioObjRef.current) {
      audioObjRef.current.pause();
      setAudioPlaying(false);
    }
  };

  const handleAudioVolumeChange = (vol: number) => {
    setAudioVolume(vol);
    if (audioObjRef.current) {
      audioObjRef.current.volume = vol / 100;
    }
  };

  const handleAudioSeekBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioObjRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      audioObjRef.current.currentTime = pct * audioDuration;
    }
  };

  // ------------------- FULL LESSON AUDIO CONFIG -------------------
  const playFullAudio = () => {
    // Pause other medias
    handleYtPause();
    pauseExplanationAudio();

    if (!fullAudioObjRef.current) {
      fullAudioObjRef.current = new Audio(getPlayableMediaUrl(lesson.fullSound));
      fullAudioObjRef.current.volume = fullAudioVolume / 100;

      fullAudioObjRef.current.addEventListener('loadstart', () => setFullAudioLoading(true));
      fullAudioObjRef.current.addEventListener('waiting', () => setFullAudioLoading(true));
      fullAudioObjRef.current.addEventListener('canplay', () => setFullAudioLoading(false));
      fullAudioObjRef.current.addEventListener('playing', () => setFullAudioLoading(false));
      fullAudioObjRef.current.addEventListener('seeking', () => setFullAudioLoading(true));
      fullAudioObjRef.current.addEventListener('seeked', () => setFullAudioLoading(false));
      fullAudioObjRef.current.addEventListener('error', () => setFullAudioLoading(false));

      fullAudioObjRef.current.addEventListener('loadedmetadata', () => {
        setFullAudioDuration(fullAudioObjRef.current?.duration || 0);
      });

      fullAudioObjRef.current.addEventListener('timeupdate', () => {
        if (!fullAudioObjRef.current) return;
        const curr = fullAudioObjRef.current.currentTime;
        const dur = fullAudioObjRef.current.duration || 1;
        const pct = Math.floor((curr / dur) * 100);
        fullMaxPercentRef.current = Math.max(fullMaxPercentRef.current, pct);
        setFullAudioProgress(pct);
        setFullAudioTimeStr(`${formatTime(curr)} / ${formatTime(dur)}`);
      });

      fullAudioObjRef.current.addEventListener('pause', () => {
        setFullAudioPlaying(false);
        const maxPct = fullMaxPercentRef.current;
        if (lesson.completed !== 'تم' && !isReset) {
          saveFullAudioScoreBackend(maxPct);
        }
      });

      fullAudioObjRef.current.addEventListener('ended', () => {
        setFullAudioPlaying(false);
        setFullAudioCompleted(true);
        setFullAudioMessage({ text: 'رائع! درجة الاستماع لهذا الدرس: 100%', success: true });
        if (lesson.completed !== 'تم' && !isReset) {
          saveFullAudioScoreBackend(100);
        }
      });
    }

    // Clear message on replay
    setFullAudioMessage(null);
    fullAudioObjRef.current.play();
    setFullAudioPlaying(true);
  };

  const pauseFullAudio = () => {
    if (fullAudioObjRef.current) {
      fullAudioObjRef.current.pause();
      setFullAudioPlaying(false);
    }
  };

  const saveFullAudioScoreBackend = async (score: number) => {
    if (score > fullAudioScore) {
      setFullAudioScore(score);
      try {
        await saveFullAudioListeningScore({
          sheet_number: student.sheetNumber,
          username: student.username,
          word: lesson.word,
          score,
          timestamp: new Date().toLocaleString(),
          comment: lesson.comment,
        });
      } catch (err) {
        console.error('Failed to save full audio progress:', err);
      }
    }

    if (score < 100) {
      setFullAudioMessage({
        text: `لقد استمعت إلى ${score}% من الدرس الصوتي. يرجى الاستماع بالكامل حتى 100% لإكماله.`,
        success: false,
      });
    } else {
      setFullAudioCompleted(true);
      setFullAudioMessage({ text: 'رائع! درجة الاستماع لهذا الدرس: 100%', success: true });
    }
  };

  const handleFullAudioVolumeChange = (vol: number) => {
    setFullAudioVolume(vol);
    if (fullAudioObjRef.current) {
      fullAudioObjRef.current.volume = vol / 100;
    }
  };

  // ------------------- CLICKABLE LETTER SOUNDS CONFIG -------------------
  const playLetter = (url: string, index: number) => {
    // Check if full audio listening is completed first (unless already completed)
    if (lesson.completed !== 'تم' && !isReset && lesson.fullSound && !fullAudioCompleted) {
      setLetterMsg('تنبيه: يجب إكمال الاستماع للدرس الصوتي بالكامل (100%) أولاً قبل البدء بتدريب نطق الحروف 🎙️.');
      setTimeout(() => setLetterMsg(''), 4500);
      return;
    }

    // Pause other background sounds
    handleYtPause();
    pauseExplanationAudio();
    pauseFullAudio();

    if (letterAudios[index]) {
      letterAudios[index]?.pause();
    }

    const audio = new Audio(getPlayableMediaUrl(url));
    audio.volume = letterVolume / 100;
    setActiveLetterIdx(index);
    setLetterMsg('جاري تحميل صوت الحرف...');

    audio.oncanplay = () => {
      setLetterMsg('');
      audio.play();
    };

    audio.onended = () => {
      setActiveLetterIdx(null);
      
      // Track listening progress
      if (lesson.completed !== 'تم' && !isReset && !listenedLetters.has(index)) {
        const nextListened = new Set(listenedLetters);
        nextListened.add(index);
        setListenedLetters(nextListened);

        // Calculate and save listening percentage
        const pct = Math.floor((nextListened.size / groupedLetters.length) * 100);
        try {
          saveLetterListeningScore({
            sheet_number: student.sheetNumber,
            username: student.username,
            word: lesson.word,
            score: pct,
            timestamp: new Date().toLocaleString(),
            comment: lesson.comment,
          });
        } catch (err) {
          console.error('Failed to save letter sound listening score:', err);
        }
      }
    };

    audio.onerror = () => {
      setActiveLetterIdx(null);
      setLetterMsg('خطأ في تحميل صوت هذا الحرف.');
      setTimeout(() => setLetterMsg(''), 3000);
    };

    const newAudios = [...letterAudios];
    newAudios[index] = audio;
    setLetterAudios(newAudios);
  };

  const handleLetterVolumeChange = (vol: number) => {
    setLetterVolume(vol);
    letterAudios.forEach(audio => {
      if (audio) audio.volume = vol / 100;
    });
  };

  const getPreviousQuestionTime = (type: 'video' | 'audio', currentQ: Question): number => {
    const questionsList = type === 'video' ? lesson.questions : lesson.audioQuestions;
    const sorted = [...questionsList].sort((a, b) => a.time - b.time);
    const currIdx = sorted.findIndex(q => q.question === currentQ.question);
    if (currIdx <= 0) {
      return 0;
    }
    return sorted[currIdx - 1].time;
  };

  // ------------------- OVERLAY QUESTIONS FEEDBACK -------------------
  const handleQuestionSubmit = async (answer: string, isCorrect: boolean | null) => {
    if (!currentQuestion) return;

    const type = currentQuestionType || 'video';
    const qList = type === 'video' ? lesson.questions : lesson.audioQuestions;
    const qIndex = qList.findIndex(q => q === currentQuestion || (q.time === currentQuestion.time && q.question === currentQuestion.question));
    const actualIndex = qIndex >= 0 ? qIndex : 0;
    const targetQ = qList[actualIndex] || currentQuestion;
    const qSlotIndex = targetQ.slotIndex !== undefined ? targetQ.slotIndex : actualIndex;
    const qText = (targetQ.question || '').trim();
    const qId = getQuestionId(targetQ, actualIndex);

    // Mark it as answered immediately in refs and state (sync)
    if (type === 'video') {
      videoAnsweredRef.current.add(qId);
      if (qText) videoAnsweredRef.current.add(qText);
      setVideoAnswered(prev => {
        const next = new Set(prev);
        next.add(qId);
        if (qText) next.add(qText);
        return next;
      });
    } else {
      audioAnsweredRef.current.add(qId);
      if (qText) audioAnsweredRef.current.add(qText);
      setAudioAnswered(prev => {
        const next = new Set(prev);
        next.add(qId);
        if (qText) next.add(qText);
        return next;
      });
    }

    // Close Question Modal and resume media immediately so user doesn't wait
    currentQuestionRef.current = null;
    setCurrentQuestion(null);
    setCurrentQuestionType(null);

    if (type === 'video') {
      if (isYtVideo && ytPlayerRef.current?.playVideo) {
        ytPlayerRef.current.playVideo();
      } else if (html5VideoRef.current) {
        html5VideoRef.current.play().catch(() => {});
        setYtPlaying(true);
      }
    } else if (type === 'audio' && audioObjRef.current) {
      audioObjRef.current.play().catch(() => {});
      setAudioPlaying(true);
    }

    try {
      await saveQuestionAnswer({
        sheet_number: student.sheetNumber,
        username: student.username,
        word: lesson.word,
        youtubeUrl: lesson.youtubeUrl,
        question: qText || `سؤال ${type} #${qSlotIndex + 1}`,
        selectedAnswer: answer,
        isCorrect: isCorrect,
        timestamp: new Date().toLocaleString(),
        type: type,
        questionIndex: qSlotIndex,
        comment: lesson.comment,
        explainSound: lesson.explainSound,
      });
    } catch (err) {
      console.error('Failed to save question answer to sheet:', err);
    }
  };

  // ------------------- IN-PAGE MICROPHONE RECORDER -------------------
  const startRecording = async () => {
    setAudioUploadError('');
    setRecordedAudioUrl(null);
    setRecordedBlob(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);

      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        setRecordedBlob(audioBlob);
        setRecordedAudioUrl(URL.createObjectURL(audioBlob));
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds(prev => {
          if (lesson.maxRecordingTime && prev >= lesson.maxRecordingTime) {
            stopRecording(recorder);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      setAudioUploadError('تنبيه: لم نتمكن من الوصول للميكروفون. تأكد من تفعيل صلاحية المايك في متصفحك.');
    }
  };

  const stopRecording = (activeRecorder?: MediaRecorder) => {
    const rec = activeRecorder || mediaRecorder;
    if (rec && rec.state !== 'inactive') {
      rec.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setRecording(false);
    if (micStream) {
      micStream.getTracks().forEach(t => t.stop());
    }
  };

  const handleUploadAudio = async () => {
    if (!recordedBlob) return;
    setUploadingAudio(true);
    setAudioUploadError('');

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = (reader.result as string).split(',')[1];
          resolve(res);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(recordedBlob);
      });

      const uploadResult = await uploadRecording({
        base64Data: base64,
        mimeType: recordedBlob.type || 'audio/webm',
        word: lesson.word,
        username: student.username,
        sheet_number: student.sheetNumber,
        comment: lesson.comment,
      });

      if (uploadResult && uploadResult.success) {
        const driveUrl = uploadResult.link;
        setSavedRecordingLink(driveUrl);
        setAudioUploadSuccess(true);
      } else {
        throw new Error('فشل الرفع من الخادم.');
      }
    } catch (err: any) {
      setAudioUploadError(err.message || 'حدث خطأ أثناء رفع ملف الصوت إلى Google Drive.');
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleManualAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioUploadError('');
    setRecordedBlob(file);
    setRecordedAudioUrl(URL.createObjectURL(file));
    setAudioUploadSuccess(false);
  };

  // ------------------- IN-PAGE CAMERA GRABBER -------------------
  const startCamera = async (targetFacing?: 'environment' | 'user') => {
    setCapturedImagePreview(null);
    setCapturedImageBase64(null);
    setImageUploadError('');

    const facing = targetFacing || cameraFacingMode;

    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
      }

      let stream: MediaStream;
      try {
        // Request high-definition rectangular stream (1080p/1440p) with 16:9 aspect ratio
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 2560, min: 1280 },
            height: { ideal: 1440, min: 720 },
            aspectRatio: { ideal: 16 / 9 },
            frameRate: { ideal: 30, min: 15 }
          },
          audio: false,
        });
      } catch (inner1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facing },
              width: { ideal: 1920, min: 640 },
              height: { ideal: 1080, min: 480 }
            },
            audio: false,
          });
        } catch (inner2) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      // Check if the video track supports torch/flash
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities: any = typeof (track as any).getCapabilities === 'function' ? (track as any).getCapabilities() : {};
        setHasTorch(Boolean(capabilities.torch));
      } else {
        setHasTorch(false);
      }

      setTorchActive(false);
      setCameraStream(stream);
      setCameraActive(true);
    } catch (err: any) {
      console.error('Camera access failed:', err);
      setImageUploadError('خطأ: لم نتمكن من تفعيل الكاميرا. يرجى تفعيل أذونات الكاميرا في جهازك أو المتصفح.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
    }
    setCameraActive(false);
    setTorchActive(false);
  };

  const toggleCameraFacing = async () => {
    const nextFacing = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextFacing);
    await startCamera(nextFacing);
  };

  const toggleTorch = async () => {
    if (!cameraStream) return;
    const track = cameraStream.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !torchActive;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }]
      });
      setTorchActive(nextState);
    } catch (e) {
      console.error('Torch toggle failed:', e);
    }
  };

  const capturePhoto = () => {
    if (!videoStreamRef.current) return;
    const video = videoStreamRef.current;
    
    const canvas = document.createElement('canvas');
    const videoWidth = video.videoWidth || 1920;
    const videoHeight = video.videoHeight || 1080;
    
    // Natural high-resolution rectangular dimension
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Apply brightness, contrast, and clarity enhancement filter
    if (cameraBrightness === 'boost') {
      context.filter = 'brightness(1.25) contrast(1.18) saturate(1.05)';
    } else if (cameraBrightness === 'high') {
      context.filter = 'brightness(1.15) contrast(1.12) saturate(1.03)';
    } else {
      context.filter = 'brightness(1.05) contrast(1.05)';
    }

    // Draw directly without mirror flip so paper/documents are not reversed and clearly readable
    context.drawImage(video, 0, 0, videoWidth, videoHeight);

    // DRAW WATERMARK
    try {
      const bannerHeight = Math.max(34, Math.floor(canvas.height * 0.065));
      const fontSize = Math.max(12, Math.floor(bannerHeight * 0.38));

      context.filter = 'none'; // reset filter for watermark text
      context.fillStyle = 'rgba(15, 23, 42, 0.82)';
      context.fillRect(0, canvas.height - bannerHeight, canvas.width, bannerHeight);

      context.fillStyle = '#FFFFFF';
      context.font = `bold ${fontSize}px 'Cairo', sans-serif`;
      context.textAlign = 'right';
      context.textBaseline = 'middle';
      context.direction = 'rtl';

      let dateStr = '';
      try {
        dateStr = new Date().toLocaleString('ar-EG', {
          year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
      } catch (e) {
        dateStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
      }

      const overlayParts = [
        student.username,
        `ID: ${student.sheetNumber}`,
        `درس: ${lesson.word}`,
        dateStr
      ].filter(Boolean);

      const overlayText = overlayParts.join(' - ');
      context.fillText(overlayText, canvas.width - 20, canvas.height - (bannerHeight / 2));
    } catch (err) {
      console.error('Failed to embed camera watermark:', err);
    }

    // High quality JPEG (0.95 quality)
    const base64 = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImagePreview(base64);
    setCapturedImageBase64(base64.split(',')[1]);
    stopCamera();
  };

  const handleUploadPhoto = async () => {
    if (!capturedImageBase64) return;
    setUploadingImage(true);
    setImageUploadError('');

    try {
      const uploadResult = await uploadImage({
        base64Data: capturedImageBase64,
        mimeType: 'image/jpeg',
        word: lesson.word,
        username: student.username,
        sheet_number: student.sheetNumber,
        comment: lesson.comment,
      });

      if (uploadResult && uploadResult.success) {
        const driveUrl = uploadResult.link;
        setSavedImageLink(driveUrl);
        setImageUploadSuccess(true);
      } else {
        throw new Error('فشل الرفع إلى جوجل درايف.');
      }
    } catch (err: any) {
      setImageUploadError(err.message || 'حدث خطأ أثناء رفع الصورة.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleManualImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setImageUploadError('');

    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        const maxSize = 1024;
        let w = img.width;
        let h = img.height;

        if (w > h) {
          if (w > maxSize) {
            h = Math.round((maxSize * h) / w);
            w = maxSize;
          }
        } else {
          if (h > maxSize) {
            w = Math.round((maxSize * w) / h);
            h = maxSize;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const context = canvas.getContext('2d');
        if (!context) return;
        context.drawImage(img, 0, 0, w, h);

        const bannerHeight = Math.max(25, Math.floor(canvas.height * 0.06));
        const fontSize = Math.max(9, Math.floor(bannerHeight * 0.30));

        context.fillStyle = 'rgba(15, 23, 42, 0.75)';
        context.fillRect(0, canvas.height - bannerHeight, canvas.width, bannerHeight);

        context.fillStyle = '#FFFFFF';
        context.font = `bold ${fontSize}px 'Cairo', sans-serif`;
        context.textAlign = 'right';
        context.textBaseline = 'middle';
        context.direction = 'rtl';

        let dateStr = new Date().toLocaleString('ar-EG', {
          year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const overlayText = [student.username, `ID: ${student.sheetNumber}`, `درس: ${lesson.word}`, dateStr].join(' - ');
        context.fillText(overlayText, canvas.width - 15, canvas.height - (bannerHeight / 2));

        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImagePreview(base64);
        const base64Clean = base64.split(',')[1];

        const uploadResult = await uploadImage({
          base64Data: base64Clean,
          mimeType: 'image/jpeg',
          word: lesson.word,
          username: student.username,
          sheet_number: student.sheetNumber,
          comment: lesson.comment,
        });

        if (uploadResult && uploadResult.success) {
          const driveUrl = uploadResult.link;
          setSavedImageLink(driveUrl);
          setImageUploadSuccess(true);
        } else {
          throw new Error('فشل الرفع.');
        }
      } catch (err: any) {
        setImageUploadError(err.message || 'فشل معالجة ورفع الصورة.');
      } finally {
        setUploadingImage(false);
      }
    };
  };

  // ------------------- EXIT FLOW VALIDATION -------------------
  const handleExitLesson = async () => {
    setExitValidationMsg(null);
    pauseExplanationAudio();
    pauseFullAudio();
    handleYtPause();

    if (lesson.completed === 'تم' && !isReset) {
      // In review mode, navigate back directly
      onBack();
      return;
    }

    setFinalCompleting(true);

    if (isReset) {
      // In Reset Mode (الإعادة):
      // Check if student answered ANY question or uploaded/recorded any file or listened to letters
      const hasInteracted =
        videoAnswered.size > 0 ||
        audioAnswered.size > 0 ||
        audioUploadSuccess ||
        imageUploadSuccess ||
        listenedLetters.size > 0 ||
        fullAudioCompleted;

      if (!hasInteracted) {
        setExitValidationMsg('تنبيه: يمكنك حفظ التقدم والرجوع بعد الإجابة على أي سؤال أو تسجيل/رفع أي واجب.');
        setFinalCompleting(false);
        setTimeout(() => setExitValidationMsg(null), 6000);
        return;
      }
    } else {
      // In First Time Mode: Check strict completeness requirements
      const checkRecording = lesson.allowRecording === 'نعم';
      const checkUpload = lesson.allowUpload === 'نعم';

      const errors: string[] = [];

      // Interactive video questions check (only if video URL exists in Column G / index 6)
      const hasVideo = !!(lesson.youtubeUrl && lesson.youtubeUrl.trim().length > 0);
      if (hasVideo && lesson.questions && lesson.questions.length > 0) {
        const answeredCount = lesson.questions.filter((q, idx) => {
          const qId = getQuestionId(q, idx);
          return videoAnswered.has(qId) || (q.question && videoAnswered.has(q.question.trim()));
        }).length;
        if (answeredCount < lesson.questions.length) {
          errors.push(`تنبيه: يجب الإجابة على جميع الأسئلة التفاعلية للفيديو أولاً (${answeredCount}/${lesson.questions.length}).`);
        }
      }

      // Interactive audio questions check (only if audio URL exists in Column F / index 5)
      const hasAudio = !!(lesson.explainSound && lesson.explainSound.trim().length > 0);
      if (hasAudio && lesson.audioQuestions && lesson.audioQuestions.length > 0) {
        const answeredCount = lesson.audioQuestions.filter((q, idx) => {
          const qId = getQuestionId(q, idx);
          return audioAnswered.has(qId) || (q.question && audioAnswered.has(q.question.trim()));
        }).length;
        if (answeredCount < lesson.audioQuestions.length) {
          errors.push(`تنبيه: يجب الإجابة على جميع الأسئلة التفاعلية للصوتي أولاً (${answeredCount}/${lesson.audioQuestions.length}).`);
        }
      }

      // Check clickable letters (only if letter sounds exist in Column B / index 1 or Column C / index 2)
      if (hasLetterSounds && listenedLetters.size !== groupedLetters.length) {
        errors.push('تنبيه: أنت لم تستمع إلى نطق جميع الحروف المكونة للكلمة.');
      }

      // Check microphone recording (only if allowRecording === 'نعم' in Column CR / index 95)
      if (checkRecording && !audioUploadSuccess) {
        errors.push('تنبيه: يرجى تسجيل وإرسال الواجب الصوتي الخاص بك أولاً.');
      }

      // Check photo upload (only if allowUpload === 'نعم' in Column CY / index 102)
      if (checkUpload && !imageUploadSuccess) {
        errors.push('تنبيه: يرجى التقاط أو رفع الصورة المطلوبة للدرس أولاً.');
      }

      if (errors.length > 0) {
        setExitValidationMsg(errors.join(' '));
        setFinalCompleting(false);
        setTimeout(() => setExitValidationMsg(null), 6000);
        return;
      }
    }

    // Perfect! Save everything and submit to sheet
    try {
      await markLessonCompleted(student.sheetNumber, lessonIndex, student.username, lesson.comment);
      onBack();
    } catch (err) {
      console.error(err);
      setExitValidationMsg('فشل حفظ تقدم الدرس على خادم Google Sheet. تحقق من اتصالك بالإنترنت وأعد المحاولة.');
      setFinalCompleting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-2 py-3 sm:p-4 md:p-6 text-right font-sans" dir="rtl">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
        <button
          onClick={handleExitLesson}
          disabled={finalCompleting}
          className="px-4 sm:px-5 py-2.5 sm:py-3 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-sky-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 rounded-2xl cursor-pointer text-xs font-extrabold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm disabled:opacity-50"
        >
          <ArrowRight className="w-4 h-4" />
          <span>{t('save_and_back')}</span>
        </button>

        <button
          onClick={() => setShowCorrectionModal(true)}
          className="px-3.5 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold rounded-2xl cursor-pointer text-xs transition-all flex items-center gap-1.5 active:scale-95 shadow-md shadow-amber-500/10"
        >
          <Award className="w-4 h-4" />
          <span>تصحيح هذا الدرس 📝</span>
        </button>
      </div>

      {/* Header Info */}
      <div className="bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-lg shadow-sky-100/40 dark:shadow-none relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <span className="text-amber-600 text-xs font-bold block mb-1">{t('active_lesson')} #{lessonIndex + 1}</span>
            <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-800 dark:text-slate-100">{lesson.comment || 'درس غير معنون'}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1.5">
              {t('written_word')} <span className="text-indigo-600 dark:text-indigo-400 font-extrabold bg-indigo-50/70 dark:bg-indigo-950/40 px-3 py-1 rounded-xl text-sm border border-indigo-100/50 dark:border-indigo-900/50">{lesson.word}</span>
            </p>
          </div>
          {isReviewOnly && (
            <div className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl text-indigo-600 dark:text-indigo-400 text-xs font-extrabold shadow-sm self-start sm:self-auto">
              {t('review_mode_badge')}
            </div>
          )}
        </div>
      </div>

      {/* Validation Banner */}
      <AnimatePresence>
        {exitValidationMsg && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -5 }}
            className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-600 text-xs flex items-start gap-3 shadow-md"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
            <div>
              <p className="font-bold text-rose-700">{t('requirements_not_met')}</p>
              <p className="mt-1 leading-relaxed text-slate-600 font-bold">{exitValidationMsg}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-sky-100 dark:border-slate-800 pb-px">
        <button
          onClick={() => setActiveTab('study')}
          className={`px-5 py-3 text-xs font-extrabold transition-all relative cursor-pointer ${
            activeTab === 'study' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <span>{t('study_tab')}</span>
          {activeTab === 'study' && (
            <motion.div layoutId="tab-line" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 dark:bg-indigo-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('assignment')}
          className={`px-5 py-3 text-xs font-extrabold transition-all relative cursor-pointer ${
            activeTab === 'assignment' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <span>{t('assignment_tab')}</span>
          {activeTab === 'assignment' && (
            <motion.div layoutId="tab-line" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 dark:bg-indigo-500 rounded-full" />
          )}
        </button>
      </div>

      {/* TAB CONTENT: STUDY */}
      {activeTab === 'study' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Image or Video */}
            <div className="space-y-6">
              {/* Image Preview Card */}
              {lesson.image && (
                <div className="bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-3xl p-5 shadow-lg shadow-sky-100/40 dark:shadow-none text-center">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3.5 flex items-center gap-1.5 justify-center">
                    <ImageIcon className="w-5 h-5 text-indigo-500" />
                    <span>{t('illustration_photo')}</span>
                  </h3>
                  <div
                    onClick={() => setLightboxImg(getPlayableImageUrl(lesson.image))}
                    className="relative aspect-video rounded-2xl overflow-hidden border border-sky-100 dark:border-slate-800 cursor-zoom-in group shadow-inner"
                  >
                    <img src={getPlayableImageUrl(lesson.image)} className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300" alt="Lesson Visual" />
                    <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors" />
                  </div>
                </div>
              )}

              {/* YouTube Video Card */}
              {lesson.youtubeUrl && (
                <div
                  ref={videoCardRef}
                  className={
                    ytFullscreen
                      ? 'fixed inset-0 z-50 w-screen h-screen bg-slate-950 p-0 m-0 rounded-none border-none flex flex-col justify-between overflow-hidden'
                      : 'bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-1.5 sm:p-5 shadow-lg shadow-sky-100/40 dark:shadow-none flex flex-col relative transition-all'
                  }
                >
                  {ytFullscreen ? (
                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800/80 text-xs font-bold text-slate-200 shrink-0 z-10">
                      <div className="flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="truncate max-w-[200px] sm:max-w-md">{lesson.comment || t('interactive_video')}</span>
                      </div>
                      <button
                        onClick={handleToggleFullscreen}
                        className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="تصغير الشاشة"
                      >
                        <Minimize className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2 sm:mb-3.5 flex items-center gap-1.5 justify-center">
                      <Video className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 animate-pulse" />
                      <span>{t('interactive_video')}</span>
                    </h3>
                  )}
                  
                  {/* Aspect video player frame wrapper */}
                  <div className={`relative ${ytFullscreen ? 'flex-1 min-h-0 w-full mb-0 rounded-none' : 'aspect-video w-full mb-2 sm:mb-3.5 rounded-xl sm:rounded-2xl border border-sky-100 dark:border-slate-800'} overflow-hidden bg-slate-950`}>
                    {isYtVideo ? (
                      <div id="yt-player-frame" className="w-full h-full" />
                    ) : (
                      <>
                        <video
                          ref={html5VideoRef}
                          src={getPlayableMediaUrl(lesson.youtubeUrl)}
                          className="w-full h-full object-contain"
                          onTimeUpdate={handleHtml5TimeUpdate}
                          onLoadedMetadata={handleHtml5LoadedMetadata}
                          onLoadStart={() => setHtml5Loading(true)}
                          onWaiting={() => setHtml5Loading(true)}
                          onSeeking={() => setHtml5Loading(true)}
                          onCanPlay={() => setHtml5Loading(false)}
                          onPlaying={() => setHtml5Loading(false)}
                          onSeeked={() => setHtml5Loading(false)}
                          onError={() => setHtml5Loading(false)}
                          playsInline
                        />
                        {html5Loading && (
                          <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center gap-3 z-10 pointer-events-none">
                            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs text-indigo-300 font-medium">جاري تحميل الفيديو...</span>
                          </div>
                        )}
                      </>
                    )}
                    {/* Transparent overlay blocks skipping on the YouTube iframe */}
                    <div 
                      onClick={ytPlaying ? handleYtPause : handleYtPlay}
                      className="absolute inset-0 bg-transparent z-20 pointer-events-auto cursor-pointer" 
                    />
                  </div>

                  {/* Seekbar Warning Alert */}
                  <AnimatePresence>
                    {videoSeekError && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="mb-2 sm:mb-3 p-2.5 sm:p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-bold text-center leading-relaxed"
                      >
                        {videoSeekError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Custom Controls */}
                  <div className={`flex items-center justify-between gap-1.5 sm:gap-4 ${
                    ytFullscreen 
                      ? 'p-2 sm:p-2.5 bg-slate-950/95 border-t border-slate-800/90 rounded-none shrink-0' 
                      : 'p-1.5 sm:p-3 bg-indigo-50/70 dark:bg-slate-950 border border-indigo-100/50 dark:border-slate-800 rounded-xl sm:rounded-2xl shadow-inner'
                  } w-full`}>
                    <button
                      onClick={ytPlaying ? handleYtPause : handleYtPlay}
                      className="p-2 sm:p-3 bg-indigo-600 text-white rounded-lg sm:rounded-xl hover:bg-indigo-700 transition-all active:scale-90 cursor-pointer shadow-md shadow-indigo-600/20 shrink-0"
                    >
                      {ytPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                    </button>

                    {/* Progress Bar */}
                    <div
                      onClick={handleYtSeekBarClick}
                      className="flex-grow h-2.5 sm:h-3 bg-indigo-100 dark:bg-indigo-950 rounded-full cursor-pointer relative shadow-inner overflow-hidden"
                    >
                      <div
                        style={{ width: `${ytProgress}%` }}
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                      />
                    </div>

                    {/* Volume */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={ytVolume}
                        onChange={(e) => handleYtVolumeChange(Number(e.target.value))}
                        className="w-12 sm:w-16 h-1 bg-indigo-200 dark:bg-indigo-900 accent-indigo-600 rounded-lg cursor-pointer appearance-none"
                      />
                    </div>

                    {/* Fullscreen Button */}
                    <button
                      onClick={handleToggleFullscreen}
                      className="p-2 sm:p-3 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-sky-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 rounded-lg sm:rounded-xl transition-all active:scale-90 cursor-pointer shadow-sm shrink-0"
                      title={ytFullscreen ? 'تصغير الشاشة' : 'تكبير الشاشة'}
                    >
                      {ytFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Render QuestionModal inside fullscreen container so it overlays the video when in fullscreen */}
                  <AnimatePresence>
                    {currentQuestion && currentQuestionType === 'video' && (
                      <QuestionModal
                        question={currentQuestion}
                        onClose={() => {
                          currentQuestionRef.current = null;
                          setCurrentQuestion(null);
                          if (isYtVideo) {
                            if (ytPlayerRef.current) {
                              ytPlayerRef.current.playVideo();
                            }
                          } else {
                            if (html5VideoRef.current) {
                              html5VideoRef.current.play().catch(() => {});
                              setYtPlaying(true);
                            }
                          }
                          setCurrentQuestionType(null);
                        }}
                        onSubmit={handleQuestionSubmit}
                        showResult={lesson.showResult}
                        rewatchType="video"
                        onRewatch={() => {
                          const prevTime = getPreviousQuestionTime('video', currentQuestion);
                          if (isYtVideo) {
                            if (ytPlayerRef.current && ytPlayerRef.current.seekTo) {
                              ytPlayerRef.current.seekTo(prevTime, true);
                              ytPlayerRef.current.playVideo();
                            }
                          } else {
                            if (html5VideoRef.current) {
                              html5VideoRef.current.currentTime = prevTime;
                              html5VideoRef.current.play().catch(() => {});
                              setYtPlaying(true);
                            }
                          }
                          currentQuestionRef.current = null;
                          setCurrentQuestion(null);
                          setCurrentQuestionType(null);
                        }}
                      />
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Right Column: Interactive Pronunciation & Custom Audios */}
            <div className="space-y-6">
              {/* Explanation Audio Card */}
              {lesson.explainSound && (
                <div className="bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-3xl p-5 shadow-lg shadow-sky-100/40 dark:shadow-none text-center">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3.5 flex items-center gap-1.5 justify-center">
                    <Volume2 className="w-5 h-5 text-indigo-500 animate-pulse" />
                    <span>{t('audio_explanation')}</span>
                  </h3>

                  {/* custom controller panel */}
                  <div className="flex items-center justify-between gap-4 p-3 bg-indigo-50/70 dark:bg-slate-950 border border-indigo-100/50 dark:border-slate-800 rounded-2xl mb-3 shadow-inner">
                    <button
                      onClick={audioPlaying ? pauseExplanationAudio : playExplanationAudio}
                      disabled={audioLoading}
                      className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-90 transition-all cursor-pointer shadow-md shadow-indigo-600/20 disabled:opacity-85"
                    >
                      {audioLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : audioPlaying ? (
                        <Pause className="w-4 h-4 fill-white" />
                      ) : (
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      )}
                    </button>

                    <div
                      onClick={handleAudioSeekBarClick}
                      className="flex-grow h-3 bg-indigo-100 dark:bg-indigo-950 rounded-full cursor-pointer relative shadow-inner overflow-hidden"
                    >
                      <div
                        style={{ width: `${audioProgress}%` }}
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                      />
                    </div>

                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold select-none">{audioTimeStr}</span>
                  </div>

                  {/* volume bar */}
                  <div className="flex items-center gap-2 justify-end px-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-indigo-500" />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={audioVolume}
                      onChange={(e) => handleAudioVolumeChange(Number(e.target.value))}
                      className="w-20 h-1 bg-indigo-200 dark:bg-indigo-900 accent-indigo-600 rounded-lg cursor-pointer appearance-none"
                    />
                  </div>
                </div>
              )}

              {/* Full Lesson Audio Listening Score Card */}
              {lesson.fullSound && (
                <div className="bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-3xl p-5 shadow-lg shadow-sky-100/40 dark:shadow-none text-center">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-1.5 justify-center">
                    <Sparkles className="w-5 h-5 text-amber-500 animate-bounce" />
                    <span>{t('guided_audio_listening')}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-4 max-w-xs mx-auto font-medium">
                    {lesson.instruction || 'يرجى الاستماع بالكامل للدرس الصوتي لتثبيت الفهم والحصول على العلامة التامة.'}
                  </p>

                  <div className="flex flex-col items-center gap-3 bg-indigo-50/70 dark:bg-slate-950 border border-indigo-100/50 dark:border-slate-800 p-4 rounded-2xl shadow-inner">
                    <button
                      onClick={fullAudioPlaying ? pauseFullAudio : playFullAudio}
                      disabled={fullAudioLoading}
                      className="w-14 h-14 bg-gradient-to-tr from-amber-400 to-amber-50 text-slate-950 hover:from-amber-500 hover:to-amber-600 rounded-full flex items-center justify-center cursor-pointer shadow-lg shadow-amber-400/20 active:scale-95 transition-all disabled:opacity-85 animate-none"
                    >
                      {fullAudioLoading ? (
                        <div className="w-6 h-6 border-4 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      ) : fullAudioPlaying ? (
                        <Pause className="w-6 h-6 fill-slate-950" />
                      ) : (
                        <Play className="w-6 h-6 fill-slate-950 ml-1" />
                      )}
                    </button>

                    <span className="text-xs font-mono text-indigo-950 dark:text-indigo-200 select-none font-extrabold">{fullAudioTimeStr}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Volume2 className="w-3.5 h-3.5 text-indigo-500" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={fullAudioVolume}
                        onChange={(e) => handleFullAudioVolumeChange(Number(e.target.value))}
                        className="w-20 h-1 bg-indigo-200 dark:bg-indigo-900 accent-indigo-600 rounded-lg cursor-pointer appearance-none"
                      />
                    </div>
                  </div>

                  {/* Percentage score results alert */}
                  {fullAudioMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mt-4 p-3 rounded-xl border text-xs leading-relaxed ${
                        fullAudioMessage.success
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-700'
                          : 'bg-rose-50/70 border-rose-200 text-rose-700'
                      }`}
                    >
                      {fullAudioMessage.text}
                    </motion.div>
                  )}
                </div>
              )}

              {/* Target Word Interactive Pronunciation Card */}
              {hasLetterSounds && (
                <div className="bg-[#fefcf8] dark:bg-slate-900 border border-amber-100 dark:border-slate-800 rounded-3xl p-6 shadow-md shadow-amber-100/25 dark:shadow-none text-center flex flex-col items-center transition-colors duration-300">
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5 justify-center">
                    <Volume2 className="w-5 h-5 text-amber-500 animate-pulse" />
                    <span>{t('letters_click_instruction')}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mb-4">
                    {t('letters_shape_note')}
                  </p>

                  {/* Word Box */}
                  <div className="px-4 sm:px-8 py-5 sm:py-8 bg-[#fffbf4] dark:bg-slate-950 border border-amber-100/50 dark:border-slate-800/80 rounded-3xl relative min-w-[240px] mb-4 w-full shadow-inner transition-colors duration-300">
                    <div className="text-center py-4 sm:py-6 select-none w-full overflow-x-auto" dir="rtl">
                      <div className="inline-block text-5xl sm:text-6xl md:text-8xl font-bold tracking-normal leading-relaxed text-slate-800 dark:text-slate-100 bg-[#faf6ed] dark:bg-slate-900 px-6 sm:px-12 py-3.5 sm:py-6 rounded-3xl border border-amber-100/40 dark:border-slate-800/60 shadow-sm whitespace-nowrap transition-colors duration-300">
                        {groupedLetters.map((char, index) => {
                          const isListened = listenedLetters.has(index);
                          const isActive = activeLetterIdx === index;
                          return (
                            <span
                              key={index}
                              onClick={() => playLetter(lesson.letterSounds[index], index)}
                              className={`cursor-pointer select-none transition-colors duration-150 ${
                                isActive
                                  ? 'text-amber-500 dark:text-amber-400 underline decoration-amber-500 dark:decoration-amber-400 decoration-4 underline-offset-8'
                                  : isListened
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-800 dark:text-slate-100 hover:text-amber-500 dark:hover:text-amber-400'
                              }`}
                              title={`اضغط للاستماع لصوت الحرف`}
                            >
                              {char}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-row-reverse items-center justify-center gap-2 sm:gap-3 mt-5 flex-wrap" dir="rtl">
                      {groupedLetters.map((char, index) => {
                        const isListened = listenedLetters.has(index);
                        const isActive = activeLetterIdx === index;
                        return (
                          <button
                            key={index}
                            type="button"
                            onClick={() => playLetter(lesson.letterSounds[index], index)}
                            className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl transition-all cursor-pointer active:scale-95 border ${
                              isActive
                                ? 'bg-amber-100/80 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700/80 shadow-sm'
                                : isListened
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60'
                                : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/70 dark:border-slate-800 hover:border-amber-200'
                            }`}
                            title={`استمع لصوت الحرف: ${char}`}
                          >
                            <span className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                              isActive
                                ? 'bg-amber-500 dark:bg-amber-400 ring-4 ring-amber-100 dark:ring-amber-950/50 scale-125'
                                : isListened
                                ? 'bg-emerald-500 dark:bg-emerald-400 shadow-sm'
                                : 'bg-slate-300 dark:bg-slate-700'
                            }`} />
                            <span className={`text-xs font-extrabold select-none transition-colors ${
                              isActive
                                ? 'text-amber-700 dark:text-amber-300'
                                : isListened
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}>{char}</span>
                          </button>
                        );
                      })}
                    </div>

                    {letterMsg && (
                      <p className="text-xs text-amber-700 font-extrabold mt-5 leading-relaxed max-w-xs mx-auto bg-amber-50/50 px-4 py-2 rounded-2xl border border-amber-100/40">
                        {letterMsg}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 bg-amber-50/30 px-4 py-2.5 rounded-xl border border-amber-100/40 w-full max-w-xs justify-center">
                    <span className="text-[11px] text-slate-500 font-bold">{t('letters_volume')}</span>
                    <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={letterVolume}
                      onChange={(e) => handleLetterVolumeChange(Number(e.target.value))}
                      className="w-24 h-1 bg-slate-200 accent-amber-500 rounded-lg cursor-pointer appearance-none"
                    />
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ASSIGNMENT */}
      {activeTab === 'assignment' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Voice Recorder assignment */}
            {(lesson.allowRecording === 'نعم' || lesson.allowRecording === '') && (
              <div className="bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-3xl p-5 shadow-lg shadow-sky-100/40 dark:shadow-none text-center flex flex-col items-center">
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 text-rose-500 dark:text-rose-400 mb-3.5 shadow-sm">
                  <Mic className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-850 dark:text-slate-100">{t('student_reading_hw')}</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-1 max-w-xs mx-auto mb-4">
                  {t('rec_section_title')} ({lesson.word})
                </p>

                {/* Lock Badge if audio is already submitted & saved */}
                {audioUploadSuccess || isReviewOnly ? (
                  <div className="w-full p-5 bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-sm">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                    <span className="text-xs text-emerald-800 dark:text-emerald-300 font-extrabold">
                      {t('audio_locked_success')}
                    </span>
                    {savedRecordingLink && (
                      <a
                        href={savedRecordingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 dark:text-indigo-400 underline font-extrabold mt-1 hover:text-indigo-800"
                      >
                        {t('listen_sent_recording')}
                      </a>
                    )}
                    {isReset && (
                      <button
                        onClick={() => {
                          setAudioUploadSuccess(false);
                          setRecordedAudioUrl(null);
                          setRecordedBlob(null);
                        }}
                        className="mt-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold cursor-pointer transition-all active:scale-95 shadow-sm"
                      >
                        {t('re_record_new')}
                      </button>
                    )}
                  </div>
                ) : (
                  /* Recorder Console Dashboard */
                  <div className="w-full bg-slate-50 dark:bg-slate-950 border border-sky-100/80 dark:border-slate-850 rounded-2xl p-4 flex flex-col items-center mb-4 shadow-inner">
                    {/* Status Indicator / Loader */}
                    {uploadingAudio ? (
                      <div className="flex flex-col items-center gap-2 py-4">
                        <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
                        <span className="text-xs text-indigo-500 font-extrabold">{t('rec_uploading')}</span>
                      </div>
                    ) : (
                      <div className="h-12 flex items-center justify-center text-slate-500 dark:text-slate-400 text-xs mb-3 font-bold">
                        {recording ? (
                          <div className="flex items-center gap-1.5 h-12">
                            <span className="w-1.5 h-6 bg-red-500 rounded-full animate-bounce" />
                            <span className="w-1.5 h-10 bg-red-500 rounded-full animate-bounce [animation-delay:0.15s]" />
                            <span className="w-1.5 h-12 bg-red-500 rounded-full animate-bounce [animation-delay:0.3s]" />
                            <span className="w-1.5 h-7 bg-red-500 rounded-full animate-bounce [animation-delay:0.45s]" />
                            <span className="w-1.5 h-4 bg-red-500 rounded-full animate-bounce [animation-delay:0.6s]" />
                          </div>
                        ) : recordedAudioUrl ? (
                          t('preview_before_sending')
                        ) : (
                          t('mic_ready')
                        )}
                      </div>
                    )}

                    {/* Timer Display when recording */}
                    {recording && (
                      <span className="text-red-500 text-xs font-extrabold block mb-4 animate-pulse">
                        {formatTime(recordingSeconds)}
                      </span>
                    )}

                    {/* Local Preview Audio Player */}
                    {recordedAudioUrl && !recording && !uploadingAudio && (
                      <audio src={recordedAudioUrl} controls className="w-full max-w-[280px] mb-4 accent-indigo-500" />
                    )}

                    {/* Controls Row */}
                    {!uploadingAudio && (
                      <div className="flex items-center justify-center gap-3 flex-wrap">
                        {recording ? (
                          <button
                            onClick={() => stopRecording()}
                            className="px-5 py-3 bg-amber-400 hover:bg-amber-500 text-slate-900 border border-amber-500/20 font-extrabold rounded-xl transition-all flex items-center gap-1.5 text-xs active:scale-95 cursor-pointer shadow-md shadow-amber-400/20"
                          >
                            <span>{t('stop_and_preview')}</span>
                          </button>
                        ) : recordedAudioUrl ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleUploadAudio}
                              disabled={uploadingAudio}
                              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-xl transition-all flex items-center gap-1 text-xs disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-500/15"
                            >
                              <span>{t('confirm_send_hw')}</span>
                            </button>
                            <button
                              onClick={() => {
                                setRecordedAudioUrl(null);
                                setRecordedBlob(null);
                              }}
                              className="px-3 py-2.5 bg-white dark:bg-slate-900 text-slate-600 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-extrabold"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={startRecording}
                              className="px-5 py-3 bg-red-500 hover:bg-red-600 text-white font-extrabold rounded-xl transition-all flex items-center gap-1.5 text-xs active:scale-95 cursor-pointer shadow-md shadow-red-500/15"
                            >
                              <span className="w-2 bg-white h-2 rounded-full animate-ping" />
                              <span>{t('start_recording_hw')}</span>
                            </button>
                            {/* Custom local file picker */}
                            <label className="px-4 py-3 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-slate-800 border border-sky-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold rounded-xl transition-all flex items-center gap-1.5 text-xs active:scale-95 cursor-pointer shadow-sm">
                              <Upload className="w-4 h-4 text-indigo-500" />
                              <span>{t('select_file')}</span>
                              <input
                                type="file"
                                accept="audio/*"
                                onChange={handleManualAudioUpload}
                                className="hidden"
                              />
                            </label>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {audioUploadError && (
                  <p className="text-[11px] text-rose-500 leading-relaxed font-extrabold mt-2">{audioUploadError}</p>
                )}
              </div>
            )}

            {/* Right Column: Photo assignment */}
            {(lesson.allowUpload === 'نعم' || lesson.allowUpload === '') && (
              <div className="bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-3xl p-5 shadow-lg shadow-sky-100/40 dark:shadow-none text-center flex flex-col items-center">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 text-indigo-500 dark:text-indigo-400 mb-3.5 shadow-sm">
                  <ImageIcon className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-850 dark:text-slate-100">{lesson.uploadTitle || t('photo_hw_title')}</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-1 max-w-xs mx-auto mb-4">
                  {t('photo_section_title')}
                </p>

                {/* Lock Badge if image is already submitted & saved */}
                {imageUploadSuccess || isReviewOnly ? (
                  <div className="w-full p-5 bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-sm">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                    <span className="text-xs text-emerald-800 dark:text-emerald-300 font-extrabold">
                      {t('photo_locked_success')}
                    </span>
                    {savedImageLink && (
                      <a
                        href={savedImageLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 dark:text-indigo-400 underline font-extrabold mt-1 hover:text-indigo-800"
                      >
                        {t('view_sent_photo')}
                      </a>
                    )}
                    {isReset && (
                      <button
                        onClick={() => {
                          setImageUploadSuccess(false);
                          setCapturedImagePreview(null);
                          setCapturedImageBase64(null);
                        }}
                        className="mt-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold cursor-pointer transition-all active:scale-95 shadow-sm"
                      >
                        {t('re_capture_new')}
                      </button>
                    )}
                  </div>
                ) : (
                  /* Camera Console Dashboard */
                  <div className="w-full bg-slate-50 dark:bg-slate-950 border border-sky-100/80 dark:border-slate-850 rounded-2xl p-4 flex flex-col items-center mb-4 min-h-[160px] justify-center shadow-inner">
                    {/* Status Indicator / Loader */}
                    {uploadingImage ? (
                      <div className="flex flex-col items-center gap-2 py-4">
                        <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
                        <span className="text-xs text-indigo-500 font-extrabold">{t('photo_uploading')}</span>
                      </div>
                    ) : (
                      <div className="h-10 flex items-center justify-center text-slate-500 dark:text-slate-400 text-xs mb-2 font-bold">
                        {cameraActive ? t('camera_live') : capturedImagePreview ? t('photo_captured') : t('camera_ready')}
                      </div>
                    )}

                    {/* Video Stream Preview */}
                    {cameraActive && !uploadingImage && (
                      <div className="w-full max-w-2xl mx-auto flex flex-col items-center mb-4">
                        {/* Camera Quick Control Toolbar (Lighting, Flip, Torch) */}
                        <div className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-900 text-white rounded-t-2xl border-x-2 border-t-2 border-indigo-500 text-xs flex-wrap">
                          <div className="flex items-center gap-1.5 font-bold text-amber-300">
                            <Camera className="w-4 h-4 text-amber-400" />
                            <span>كاميرا مستطيلة واضحة (HD)</span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Lighting Selector */}
                            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                              <button
                                type="button"
                                onClick={() => setCameraBrightness('boost')}
                                className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                                  cameraBrightness === 'boost'
                                    ? 'bg-amber-400 text-slate-950 shadow'
                                    : 'text-slate-300 hover:text-white'
                                }`}
                                title="إضاءة قوية جداً مناسبة للأوراق والخطوط الضعيفة"
                              >
                                💡 ساطعة جداً
                              </button>
                              <button
                                type="button"
                                onClick={() => setCameraBrightness('high')}
                                className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                                  cameraBrightness === 'high'
                                    ? 'bg-indigo-500 text-white shadow'
                                    : 'text-slate-300 hover:text-white'
                                }`}
                                title="إضاءة محسنة تلقائياً مناسبة للدفاتر والواجبات"
                              >
                                ✨ منورة للدفتر
                              </button>
                              <button
                                type="button"
                                onClick={() => setCameraBrightness('normal')}
                                className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                                  cameraBrightness === 'normal'
                                    ? 'bg-slate-600 text-white shadow'
                                    : 'text-slate-300 hover:text-white'
                                }`}
                                title="إضاءة طبيعية"
                              >
                                ☀️ عادية
                              </button>
                            </div>

                            {/* Flip Camera Button */}
                            <button
                              type="button"
                              onClick={toggleCameraFacing}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                              title="تبديل الكاميرا (أمامية / خلفية)"
                            >
                              <FlipHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                              <span>{cameraFacingMode === 'environment' ? 'خلفية' : 'أمامية'}</span>
                            </button>

                            {/* Flash / Torch Button */}
                            {hasTorch && (
                              <button
                                type="button"
                                onClick={toggleTorch}
                                className={`px-2.5 py-1 border rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                                  torchActive
                                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                                }`}
                                title="تشغيل كشاف الفلاش"
                              >
                                <Zap className="w-3.5 h-3.5 text-amber-400" />
                                <span>{torchActive ? 'الكشاف شغال' : 'كشاف'}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Rectangular Live Video Container */}
                        <div className="relative aspect-[4/3] sm:aspect-[16/9] w-full rounded-b-2xl overflow-hidden border-x-2 border-b-2 border-indigo-500 bg-black shadow-2xl flex items-center justify-center">
                          <video
                            ref={videoStreamRef}
                            autoPlay
                            playsInline
                            muted
                            style={{
                              filter:
                                cameraBrightness === 'boost'
                                  ? 'brightness(1.25) contrast(1.18) saturate(1.05)'
                                  : cameraBrightness === 'high'
                                  ? 'brightness(1.15) contrast(1.12) saturate(1.03)'
                                  : 'brightness(1.05) contrast(1.05)',
                            }}
                            className="w-full h-full object-contain bg-black"
                          />
                        </div>
                      </div>
                    )}

                    {/* Captured Photo Preview */}
                    {capturedImagePreview && !cameraActive && !uploadingImage && (
                      <div className="w-full max-w-2xl mx-auto flex flex-col items-center mb-4">
                        <div className="w-full flex items-center justify-between px-3 py-1.5 bg-emerald-950 text-emerald-300 rounded-t-2xl border-x-2 border-t-2 border-emerald-500 text-xs font-bold">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            معاينة الصورة الملتقطة (جاهزة للإرسال)
                          </span>
                          <span className="text-[11px] bg-emerald-800/60 text-white px-2 py-0.5 rounded">عالية الوضوح مستطيلة</span>
                        </div>
                        <div className="relative aspect-[4/3] sm:aspect-[16/9] w-full rounded-b-2xl overflow-hidden border-x-2 border-b-2 border-emerald-500 bg-black shadow-2xl flex items-center justify-center">
                          <img src={capturedImagePreview} className="w-full h-full object-contain bg-black" alt="Captured" />
                        </div>
                      </div>
                    )}

                    {/* Control Actions */}
                    {!uploadingImage && (
                      <div className="flex items-center justify-center gap-3 flex-wrap">
                        {cameraActive ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={capturePhoto}
                              className="px-5 py-3 bg-amber-400 hover:bg-amber-500 text-slate-900 border border-amber-500/20 font-extrabold rounded-xl transition-all flex items-center gap-1.5 text-xs active:scale-95 cursor-pointer shadow-md shadow-amber-400/20"
                            >
                              <span>{t('capture_crop')}</span>
                            </button>
                            <button
                              onClick={stopCamera}
                              className="px-4 py-3 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-slate-800 border border-sky-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 rounded-xl text-xs font-extrabold cursor-pointer shadow-sm"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : capturedImagePreview ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleUploadPhoto}
                              disabled={uploadingImage}
                              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-xl transition-all flex items-center gap-1 text-xs disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-500/15"
                            >
                              <span>{t('confirm_send_photo')}</span>
                            </button>
                            <button
                              onClick={() => {
                                setCapturedImagePreview(null);
                                setCapturedImageBase64(null);
                                startCamera();
                              }}
                              className="px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-slate-800 border border-sky-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 font-extrabold rounded-xl transition-all text-xs cursor-pointer shadow-sm"
                            >
                              {t('re_take_photo')}
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => startCamera()}
                              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl transition-all flex items-center gap-1.5 text-xs active:scale-95 cursor-pointer shadow-md shadow-indigo-600/15"
                            >
                              <span>{t('capture_with_camera')}</span>
                            </button>
                            <label className="px-4 py-3 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-slate-800 border border-sky-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold rounded-xl transition-all flex items-center gap-1.5 text-xs active:scale-95 cursor-pointer shadow-sm">
                              <Upload className="w-4 h-4 text-indigo-500" />
                              <span>{t('select_file')}</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleManualImageUpload}
                                className="hidden"
                              />
                            </label>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {imageUploadError && (
                  <p className="text-[11px] text-rose-500 leading-relaxed font-extrabold mt-2">{imageUploadError}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* LIGHTBOX FOR IMAGE PREVIEW */}
      <AnimatePresence>
        {lightboxImg && (
          <div
            onClick={() => setLightboxImg(null)}
            className="fixed inset-0 z-50 bg-slate-950/95 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-full max-h-full"
            >
              <img src={lightboxImg} className="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain border border-slate-800" alt="Enlarged view" />
              <button
                onClick={() => setLightboxImg(null)}
                className="absolute -top-12 left-0 p-2.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-full hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY INTERACTIVE QUESTIONS (AUDIO ONLY) */}
      <AnimatePresence>
        {currentQuestion && currentQuestionType === 'audio' && (
          <QuestionModal
            question={currentQuestion}
            onClose={() => {
              currentQuestionRef.current = null;
              setCurrentQuestion(null);
              if (audioObjRef.current) {
                audioObjRef.current.play();
                setAudioPlaying(true);
              }
              setCurrentQuestionType(null);
            }}
            onSubmit={handleQuestionSubmit}
            showResult={lesson.showResult}
            rewatchType="audio"
            onRewatch={() => {
              const prevTime = getPreviousQuestionTime('audio', currentQuestion);
              if (audioObjRef.current) {
                audioObjRef.current.currentTime = prevTime;
                audioObjRef.current.play();
                setAudioPlaying(true);
              }
              currentQuestionRef.current = null;
              setCurrentQuestion(null);
              setCurrentQuestionType(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* SAVING PROGRESS OVERLAY (NON-CLICKABLE) */}
      <AnimatePresence>
        {finalCompleting && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none pointer-events-auto" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center flex flex-col items-center gap-4"
            >
              <div className="relative">
                <div className="w-16 h-16 border-4 border-amber-200 dark:border-slate-800 border-t-amber-500 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-xl">
                  ⏳
                </div>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">{t('saving_progress_overlay_title')}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-2 leading-relaxed">
                  {t('saving_progress_overlay_sub')}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student Correction Modal */}
      <AnimatePresence>
        {showCorrectionModal && (
          <StudentCorrectionModal
            username={student.username}
            sheetNumber={student.sheetNumber}
            selectedLessonTitle={lesson.comment || lesson.word}
            onClose={() => setShowCorrectionModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
