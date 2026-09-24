import React, { useState } from 'react';
import { motion } from 'motion/react';
import { HelpCircle, Check, AlertCircle, Send, CheckCircle2, ArrowLeft, RotateCcw, X } from 'lucide-react';
import { Question } from '../types';
import { useLanguage } from '../translations';

interface QuestionModalProps {
  question: Question;
  onClose: () => void;
  onSubmit: (answer: string, isCorrect: boolean | null) => void;
  showResult: 'نعم' | 'لا';
  onRewatch?: () => void;
  rewatchType?: 'video' | 'audio';
}

interface ResultModalState {
  text: string;
  success: boolean | null;
  correctLabel?: string;
  answer: string;
  isCorrect: boolean | null;
}

function getGoogleDriveFileId(url: string): string | null {
  if (!url) return null;
  const fileDMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) return fileDMatch[1];

  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];

  const ucMatch = url.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (ucMatch && ucMatch[1]) return ucMatch[1];

  return null;
}

function getPlayableImageUrl(url?: string): string {
  if (!url) return '';
  const driveId = getGoogleDriveFileId(url);
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`;
  }
  return url;
}

export default function QuestionModal({
  question,
  onClose,
  onSubmit,
  showResult,
  onRewatch,
  rewatchType,
}: QuestionModalProps) {
  const { t } = useLanguage();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultModal, setResultModal] = useState<ResultModalState | null>(null);

  const rawOptions = Array.isArray(question.options) ? question.options : [];
  const validOptions = rawOptions.map(o => String(o ?? '')).filter(o => o.trim().length > 0);
  const isMultipleChoice = validOptions.length > 0;
  const isButtonEnabled = isMultipleChoice ? selectedOption !== null : textAnswer.trim().length > 0;

  const handleSubmit = async () => {
    if (!isButtonEnabled || isSubmitting) return;
    setIsSubmitting(true);

    const answer = isMultipleChoice ? selectedOption! : textAnswer.trim();
    let isCorrect: boolean | null = null;

    if (isMultipleChoice) {
      // Correct answer can be 1-based index string (e.g. "1" or "2") or the option text itself
      const numAnswer = parseInt(question.correctAnswer);
      if (!isNaN(numAnswer) && numAnswer >= 1 && numAnswer <= validOptions.length) {
        const correctText = validOptions[numAnswer - 1];
        isCorrect = answer === correctText;
      } else {
        isCorrect = answer === question.correctAnswer || answer.trim() === String(question.correctAnswer || '').trim();
      }
    } else {
      // Text answers evaluate if there's a strict correct answer, else they are open-ended (null)
      if (question.correctAnswer) {
        isCorrect = answer.toLowerCase() === question.correctAnswer.toLowerCase();
      }
    }

    if (showResult === 'نعم') {
      let text = '';
      let correctLabel: string | undefined = undefined;

      if (isCorrect === null) {
        text = t('question_result_recorded_title');
      } else if (isCorrect) {
        text = t('question_result_correct_title');
      } else {
        text = t('question_result_wrong_title');
        const numAnswer = parseInt(question.correctAnswer);
        correctLabel = (!isNaN(numAnswer) && numAnswer >= 1 && numAnswer <= validOptions.length)
          ? validOptions[numAnswer - 1]
          : question.correctAnswer;
      }

      setResultModal({
        text,
        success: isCorrect,
        correctLabel,
        answer,
        isCorrect
      });
    } else {
      // Submit immediately
      onSubmit(answer, isCorrect);
    }
  };

  const handleConfirmResult = () => {
    if (resultModal) {
      const { answer, isCorrect } = resultModal;
      setResultModal(null);
      onSubmit(answer, isCorrect);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto overscroll-contain">
      {/* Result Popup Modal (When showResult is 'نعم' and answer is submitted) */}
      {resultModal ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-md max-h-[92vh] overflow-y-auto my-auto bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl relative text-center z-10 overscroll-contain"
        >
          {/* Background glow */}
          <div className={`absolute top-0 right-1/2 translate-x-1/2 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
            resultModal.success === true ? 'bg-emerald-500/10' : resultModal.success === false ? 'bg-rose-500/10' : 'bg-blue-500/10'
          }`} />

          {/* Header Icon */}
          <div className="flex justify-center mb-4 sm:mb-5">
            <div className={`p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border shadow-lg ${
              resultModal.success === true
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : resultModal.success === false
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                : 'bg-blue-500/20 border-blue-500/40 text-blue-400'
            }`}>
              {resultModal.success === true ? (
                <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12" />
              ) : resultModal.success === false ? (
                <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12" />
              ) : (
                <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12" />
              )}
            </div>
          </div>

          {/* Title */}
          <h3 className={`text-lg sm:text-xl font-black mb-3 ${
            resultModal.success === true
              ? 'text-emerald-400'
              : resultModal.success === false
              ? 'text-rose-400'
              : 'text-blue-400'
          }`}>
            {resultModal.success === true
              ? t('question_result_correct_title')
              : resultModal.success === false
              ? t('question_result_wrong_title')
              : t('question_result_recorded_title')}
          </h3>

          {/* Message / Details */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 sm:p-4 mb-4 sm:mb-6 text-right">
            <p className="text-xs sm:text-sm font-semibold text-slate-200 leading-relaxed text-center">
              {resultModal.text}
            </p>

            {resultModal.correctLabel && (
              <div className="mt-2.5 pt-2.5 sm:mt-3 sm:pt-3 border-t border-slate-800/80 text-center">
                <span className="text-[11px] sm:text-xs text-slate-400 block mb-1">{t('question_correct_label')}</span>
                <span className="text-xs sm:text-sm font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl inline-block mt-0.5">
                  {resultModal.correctLabel}
                </span>
              </div>
            )}
          </div>

          {/* Close & Continue Button */}
          <button
            onClick={handleConfirmResult}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black py-3 sm:py-3.5 px-6 rounded-xl sm:rounded-2xl shadow-lg shadow-amber-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
          >
            <span>{t('question_close_continue')}</span>
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </motion.div>
      ) : (
        /* Standard Question Modal */
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-lg max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl relative overflow-hidden text-right my-auto"
        >
          {/* Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Fixed Header */}
          <div className="shrink-0 flex items-center justify-between border-b border-slate-800 p-3 sm:p-4 bg-slate-900/95 z-10">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-100">{t('question_interactive_title')}</h3>
                <p className="text-[9px] sm:text-[10px] text-slate-400">{t('question_interactive_sub')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 overscroll-contain min-h-0">
            {/* Question Image if present */}
            {question.image && (
              <div className="aspect-video max-h-48 sm:max-h-56 w-full rounded-xl sm:rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 mx-auto">
                <img
                  src={getPlayableImageUrl(question.image)}
                  className="w-full h-full object-contain cursor-zoom-in"
                  alt="Question Visual"
                  onClick={() => window.open(getPlayableImageUrl(question.image), '_blank')}
                />
              </div>
            )}

            {/* Question Text */}
            <h4 className="text-sm sm:text-base font-bold text-slate-200 leading-relaxed">
              {question.question || t('question_interactive_title')}
            </h4>

            {/* Answer Selection */}
            <div className="space-y-2.5 pt-1">
              {isMultipleChoice ? (
                validOptions.map((opt, idx) => {
                  const isSelected = selectedOption === opt;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedOption(opt)}
                      disabled={isSubmitting}
                      className={`w-full px-3.5 py-3 rounded-xl sm:rounded-2xl text-xs font-bold text-right border transition-all cursor-pointer flex items-center justify-between group active:scale-99 ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-amber-400'
                          : 'bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="leading-snug">{opt}</span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0 mr-2 ${
                          isSelected ? 'bg-amber-400 border-amber-400' : 'border-slate-700'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })
              ) : (
                <input
                  type="text"
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  placeholder={t('question_placeholder')}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-850 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-200 rounded-xl sm:rounded-2xl placeholder-slate-600 outline-none transition-all text-xs text-right"
                />
              )}
            </div>
          </div>

          {/* Fixed Footer with Action button */}
          <div className="shrink-0 p-3 sm:p-4 border-t border-slate-800 bg-slate-900/95 z-10 flex flex-col sm:flex-row gap-2 sm:gap-3">
            {onRewatch && (
              <button
                type="button"
                onClick={onRewatch}
                disabled={isSubmitting}
                className="flex-1 bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-750 hover:border-slate-700 font-bold py-2.5 sm:py-3 px-4 rounded-xl sm:rounded-2xl transition-all flex items-center justify-center gap-2 text-[11px] cursor-pointer active:scale-98 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 animate-spin-slow" />
                <span>
                  {rewatchType === 'audio' ? t('question_rewatch_audio') : t('question_rewatch_video')}
                </span>
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={!isButtonEnabled || isSubmitting}
              className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-2.5 sm:py-3 rounded-xl sm:rounded-2xl shadow-lg shadow-amber-500/10 active:scale-98 transition-all flex items-center justify-center gap-2 text-[11px] cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{t('question_submit_btn')}</span>
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
