import React, { useState } from 'react';
import { MessageSquarePlus, Star, X } from 'lucide-react';
import { AnswerFeedback } from '../types';

interface FeedbackModalProps {
  question: string;
  initialFeedback?: AnswerFeedback;
  onSaveFeedback: (feedback: AnswerFeedback) => void;
  onClose: () => void;
}

const RATING_DESCRIPTIONS: Record<number, string> = {
  1: '1점 - 부정확함 (조문 인용 또는 해석 오류)',
  2: '2점 - 다소 미흡 (주요 요건 또는 예외 누락)',
  3: '3점 - 보통 (기본적인 법령 내용은 부합)',
  4: '4점 - 정확하고 실무에 유용함',
  5: '5점 - 매우 정확하고 즉시 공문 작성에 활용 가능',
};

const SUGGESTED_TAGS = [
  '근거 조문 인용 정확함',
  '최신 개정 법령 즉시 반영됨',
  '답변 결론 명확함',
  '예외 요건 안내 충실',
  '법령 조문 번호 오류',
  '최신 개정 내용 미반영',
  '추가 사실관계 검토 필요',
  '경과규정 확인 필요',
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  question,
  initialFeedback,
  onSaveFeedback,
  onClose,
}) => {
  const [rating, setRating] = useState<number>(initialFeedback?.rating || 5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    initialFeedback?.tags || ['근거 조문 인용 정확함']
  );
  const [comment, setComment] = useState<string>(initialFeedback?.comment || '');
  const [reviewer, setReviewer] = useState<string>(
    initialFeedback?.reviewer || '인사담당 주무관'
  );

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newFeedback: AnswerFeedback = {
      id: initialFeedback?.id || `fb-${Date.now()}`,
      question: question.slice(0, 100),
      rating,
      tags: selectedTags,
      comment: comment.trim(),
      reviewer: reviewer.trim() || '인사담당 주무관',
      submittedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };
    onSaveFeedback(newFeedback);
    onClose();
  };

  const activeRating = hoverRating || rating;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg max-w-xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-purple-600" />
            <h2 className="text-base font-bold text-slate-900">
              AI 답변 정확도 평가 및 피드백
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto space-y-4 pr-1">
          {/* 평가 대상 질문 요약 */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700">
            <span className="font-semibold text-slate-900">평가 대상 질의: </span>
            <span>{question}</span>
          </div>

          {/* 5점 별점 평가 */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              1. AI 답변 정확도 평점 (1~5점)
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  onClick={() => setRating(star)}
                  className="p-1 cursor-pointer transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= activeRating
                        ? 'fill-amber-400 text-amber-500'
                        : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-semibold text-slate-700 ml-2 font-mono tabular-nums">
                {activeRating} / 5
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {RATING_DESCRIPTIONS[activeRating]}
            </p>
          </div>

          {/* 구체적 평가 태그 선택 */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              2. 세부 평가 항목 선택 (다중 선택 가능)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-purple-50 border-purple-300 text-purple-700 font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {isSelected ? '✓ ' : ''}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 세부 검토 의견 입력란 */}
          <div>
            <label
              htmlFor="feedback-comment"
              className="block text-xs font-bold text-slate-800 mb-1.5"
            >
              3. 담당자 세부 검토 의견 및 보완사항
            </label>
            <textarea
              id="feedback-comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="예: 근거 조문 인용이 정확하여 실무 결재 시 바로 인용 가능함. 단, 부칙 경과규정 적용 대상 여부에 대한 추가 언급이 있으면 더 좋겠습니다."
              className="w-full p-3 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600 leading-relaxed"
            />
          </div>

          {/* 검토자 소속/직급 */}
          <div>
            <label
              htmlFor="reviewer-role"
              className="block text-xs font-bold text-slate-800 mb-1"
            >
              검토자 명의 (직책/부서)
            </label>
            <input
              id="reviewer-role"
              type="text"
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors cursor-pointer"
            >
              피드백 등록 완료
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
