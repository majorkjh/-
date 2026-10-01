import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Check, History, RotateCcw, X } from 'lucide-react';
import { LawItem, LawVersion } from '../types';
import { computeTextDiff } from '../diffUtils';

interface VersionDiffModalProps {
  law: LawItem;
  onClose: () => void;
  onRestoreVersion?: (lawId: string, version: LawVersion) => void;
  onApplyPendingUpdate?: (lawId: string) => void;
}

export const VersionDiffModal: React.FC<VersionDiffModalProps> = ({
  law,
  onClose,
  onRestoreVersion,
  onApplyPendingUpdate,
}) => {
  // 사용 가능한 버전 목록 (과거 버전들 + 현재 버전 + 보류 중인 개정안이 있다면 포함)
  const allAvailableVersions = useMemo(() => {
    const list: Array<{ id: string; label: string; text: string; versionObj?: LawVersion; isPending?: boolean }> = [];

    // 보류 중인 신규 개정안
    if (law.hasPendingUpdate && law.pendingUpdateInfo) {
      list.push({
        id: 'pending-update',
        label: `[신규 개정안] ${law.pendingUpdateInfo.versionNumber} (시행: ${law.pendingUpdateInfo.effectiveDate})`,
        text: law.pendingUpdateInfo.text,
        isPending: true,
      });
    }

    // 현재 활성 버전
    list.push({
      id: 'current-active',
      label: `[현재 시행] ${law.currentVersion} (${law.updatedAt.slice(0, 10)})`,
      text: law.text,
    });

    // 과거 이력 버전들
    for (const v of law.versions) {
      if (v.versionNumber !== law.currentVersion) {
        list.push({
          id: v.versionId,
          label: `${v.versionNumber} (시행: ${v.effectiveDate}) - ${v.summaryOfChanges.slice(0, 30)}...`,
          text: v.text,
          versionObj: v,
        });
      }
    }

    return list;
  }, [law]);

  // 기본 비교: 이전 버전(또는 현재 버전) vs 최신/개정 버전
  const [oldVersionId, setOldVersionId] = useState<string>(() => {
    if (allAvailableVersions.length > 1) {
      return allAvailableVersions[allAvailableVersions.length - 1].id;
    }
    return allAvailableVersions[0]?.id || '';
  });

  const [newVersionId, setNewVersionId] = useState<string>(() => {
    return allAvailableVersions[0]?.id || '';
  });

  const [filterClause, setFilterClause] = useState<string>('');

  const oldEntry = allAvailableVersions.find((v) => v.id === oldVersionId) || allAvailableVersions[0];
  const newEntry = allAvailableVersions.find((v) => v.id === newVersionId) || allAvailableVersions[0];

  const diffResult = useMemo(() => {
    if (!oldEntry || !newEntry) {
      return { lines: [], additionsCount: 0, deletionsCount: 0, changedClauses: [] };
    }
    return computeTextDiff(oldEntry.text, newEntry.text);
  }, [oldEntry, newEntry]);

  const filteredLines = useMemo(() => {
    if (!filterClause) return diffResult.lines;
    return diffResult.lines.filter((l) => l.text.includes(filterClause));
  }, [diffResult.lines, filterClause]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg max-w-5xl w-full p-6 shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 헤더 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
              <History className="w-4 h-4" />
              <span>법령 개정 이력 및 버전 비교 (Version Control Diff)</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              {law.title} 개정 사항 대조표
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {law.hasPendingUpdate && onApplyPendingUpdate && (
              <button
                type="button"
                onClick={() => {
                  onApplyPendingUpdate(law.id);
                  onClose();
                }}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors cursor-pointer"
              >
                신규 개정안 즉시 적용
              </button>
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

        {/* 버전 선택 드롭다운 영역 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-md mb-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              기준 버전 (이전 / 구법)
            </label>
            <select
              value={oldVersionId}
              onChange={(e) => setOldVersionId(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-300 rounded-md text-slate-800"
            >
              {allAvailableVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              비교 대상 버전 (신규 / 개정안)
            </label>
            <select
              value={newVersionId}
              onChange={(e) => setNewVersionId(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-300 rounded-md text-slate-800"
            >
              {allAvailableVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 변경 요약 통계 배너 */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-700">개정 통계:</span>
            <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded font-mono tabular-nums font-semibold">
              + {diffResult.additionsCount}행 추가/수정
            </span>
            <span className="text-red-700 bg-red-50 px-2.5 py-0.5 rounded font-mono tabular-nums font-semibold">
              - {diffResult.deletionsCount}행 삭제/개정전
            </span>
          </div>

          {/* 변경된 조문 빠른 필터 태그 */}
          {diffResult.changedClauses.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-500">개정 조문:</span>
              <button
                type="button"
                onClick={() => setFilterClause('')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  filterClause === '' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                전체 보기
              </button>
              {diffResult.changedClauses.map((clause) => (
                <button
                  key={clause}
                  type="button"
                  onClick={() => setFilterClause(clause)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    filterClause === clause ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  {clause}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Diff 결과 뷰어 */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-md bg-white p-3 font-mono text-xs leading-relaxed space-y-0.5">
          {filteredLines.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              선택한 두 버전 간에 텍스트 차이가 없거나 필터와 일치하는 조문이 없습니다.
            </div>
          ) : (
            filteredLines.map((line, idx) => {
              if (line.type === 'added') {
                return (
                  <div
                    key={idx}
                    className="py-1 px-2.5 rounded bg-emerald-50 text-emerald-950 border-l-4 border-emerald-500 flex gap-3"
                  >
                    <span className="text-emerald-600 select-none w-12 shrink-0 font-bold">
                      +{line.newLineNumber || ''}
                    </span>
                    <span className="whitespace-pre-wrap break-all">{line.text}</span>
                  </div>
                );
              }
              if (line.type === 'removed') {
                return (
                  <div
                    key={idx}
                    className="py-1 px-2.5 rounded bg-red-50 text-red-950 border-l-4 border-red-500 flex gap-3 line-through opacity-80"
                  >
                    <span className="text-red-500 select-none w-12 shrink-0 font-bold">
                      -{line.oldLineNumber || ''}
                    </span>
                    <span className="whitespace-pre-wrap break-all">{line.text}</span>
                  </div>
                );
              }
              return (
                <div key={idx} className="py-0.5 px-2.5 rounded text-slate-700 flex gap-3 hover:bg-slate-50">
                  <span className="text-slate-400 select-none w-12 shrink-0 tabular-nums">
                    {line.newLineNumber || line.oldLineNumber || ''}
                  </span>
                  <span className="whitespace-pre-wrap break-all">{line.text}</span>
                </div>
              );
            })
          )}
        </div>

        {/* 하단 제어 버튼 및 복원 기능 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-3 border-t border-slate-100 text-xs text-slate-500">
          <div>
            <span>
              과거 버전 복원 시 해당 시점의 법령 텍스트로 즉시 활성화되어 AI 답변 생성에 반영됩니다.
            </span>
          </div>
          <div className="flex items-center gap-2">
            {oldEntry?.versionObj && onRestoreVersion && (
              <button
                type="button"
                onClick={() => {
                  onRestoreVersion(law.id, oldEntry.versionObj!);
                  onClose();
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {oldEntry.versionObj.versionNumber} 시점으로 법령 복원
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
