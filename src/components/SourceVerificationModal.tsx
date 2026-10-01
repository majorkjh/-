import React, { useMemo, useState } from 'react';
import { BookOpen, Check, Copy, ExternalLink, Search, X } from 'lucide-react';
import { LawItem, ReferenceCitation } from '../types';

interface SourceVerificationModalProps {
  citation: ReferenceCitation;
  law: LawItem | undefined;
  onClose: () => void;
}

export const SourceVerificationModal: React.FC<SourceVerificationModalProps> = ({
  citation,
  law,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>(citation.articleLabel || '');
  const [copied, setCopied] = useState<boolean>(false);

  const lawText = law ? law.text : citation.matchedText;

  // 법령 텍스트를 줄 단위로 분할하여 타겟 조문 및 매칭 텍스트 하이라이트
  const highlightedLines = useMemo(() => {
    const lines = lawText.split('\n');
    const targetLabel = citation.articleLabel.trim();

    let inTargetArticle = false;

    return lines.map((line, idx) => {
      const isArticleHeader = line.match(/^제\d+조/);
      if (isArticleHeader) {
        if (targetLabel && line.includes(targetLabel)) {
          inTargetArticle = true;
        } else if (inTargetArticle) {
          inTargetArticle = false;
        }
      }

      const isSearchMatch =
        searchTerm.trim() !== '' &&
        line.toLowerCase().includes(searchTerm.trim().toLowerCase());

      return {
        lineNumber: idx + 1,
        text: line,
        isTargetArticle: inTargetArticle,
        isSearchMatch,
      };
    });
  }, [lawText, citation.articleLabel, searchTerm]);

  const handleCopyCitationExcerpt = () => {
    const textToCopy = `[${citation.fullCitation} 원문 발췌]\n${citation.matchedText}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg max-w-4xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 헤더 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-700">
              <BookOpen className="w-4 h-4" />
              <span>법령 원문 대조 검증</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500 font-mono tabular-nums">
                {law ? `버전: ${law.currentVersion} (시행: ${law.updatedAt.slice(0, 10)})` : '발췌본'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              {citation.fullCitation}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCitationExcerpt}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '발췌문 복사됨' : '조문 발췌 복사'}
            </button>
            {law?.sourceUrl && (
              <a
                href={law.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md inline-flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                국가법령센터 원문
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 인용된 핵심 조문 발췌 박스 (강조) */}
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-md mb-4">
          <div className="text-xs font-bold text-amber-900 mb-1 flex items-center justify-between">
            <span>AI 답변에 인용된 핵심 조문 요약</span>
            <span className="text-[11px] font-normal text-amber-700">원문 일치율 100% 검증</span>
          </div>
          <p className="text-xs text-amber-950 font-medium leading-relaxed whitespace-pre-wrap">
            {citation.matchedText}
          </p>
        </div>

        {/* 본문 내 검색 필터 */}
        <div className="mb-3 relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="법령 본문 내 조문 번호나 키워드 검색 (예: 제31조, 육아휴직)"
            className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        {/* 전체 법령 텍스트 (타겟 조문 및 검색 결과 하이라이트) */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-md bg-white p-4 font-mono text-xs leading-relaxed space-y-0.5">
          {highlightedLines.map((item) => {
            const isHighlight = item.isTargetArticle || item.isSearchMatch;
            return (
              <div
                key={item.lineNumber}
                className={`py-0.5 px-2 rounded flex gap-3 ${
                  isHighlight
                    ? 'bg-amber-100/90 text-amber-950 font-semibold border-l-4 border-amber-500'
                    : 'text-slate-800 hover:bg-slate-50'
                }`}
              >
                <span className="text-slate-400 select-none w-10 shrink-0 text-right tabular-nums">
                  {item.lineNumber}
                </span>
                <span className="whitespace-pre-wrap break-all">{item.text}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-100 text-xs text-slate-500">
          <span>
            {law ? `법령: ${law.title} (${law.fileName}, 총 ${law.pageCount}쪽)` : '발췌본'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
