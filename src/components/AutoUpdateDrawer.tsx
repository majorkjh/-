import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import { DataSchema, LawItem, PredefinedLawSource } from '../types';
import { PREDEFINED_LAW_SOURCES } from '../initialData';

interface AutoUpdateDrawerProps {
  data: DataSchema;
  onUpdateSettings: (settings: DataSchema['autoUpdateSettings']) => void;
  onApplyUpdate: (lawId: string) => void;
  onCheckUpdatesNow: () => Promise<void>;
  onOpenDiffModal: (law: LawItem) => void;
  onClose: () => void;
}

export const AutoUpdateDrawer: React.FC<AutoUpdateDrawerProps> = ({
  data,
  onUpdateSettings,
  onApplyUpdate,
  onCheckUpdatesNow,
  onOpenDiffModal,
  onClose,
}) => {
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [sources] = useState<PredefinedLawSource[]>(PREDEFINED_LAW_SOURCES);

  const pendingLaws = data.laws.filter((l) => l.hasPendingUpdate);

  const handleManualCheck = async () => {
    setIsChecking(true);
    await onCheckUpdatesNow();
    setIsChecking(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-700">
              <RefreshCw className="w-4 h-4" />
              <span>자동 법령 업데이트 및 공공 법령 피드 연계 관리</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-0.5">
              법령 자동 갱신 및 개정안 모니터링
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

        <div className="overflow-y-auto space-y-5 pr-1 flex-1">
          {/* 자동 업데이트 주기 설정 박스 */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-slate-800">
                  자동 업데이트 주기 및 백그라운드 확인 설정
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.autoUpdateSettings.enabled}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...data.autoUpdateSettings,
                      enabled: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                <span className="ml-2 text-xs font-semibold text-slate-700">
                  {data.autoUpdateSettings.enabled ? '자동 점검 활성화' : '수동 점검만 사용'}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">
                  법령 개정 확인 주기
                </label>
                <select
                  value={data.autoUpdateSettings.frequencyHours}
                  disabled={!data.autoUpdateSettings.enabled}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...data.autoUpdateSettings,
                      frequencyHours: Number(e.target.value),
                    })
                  }
                  className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-slate-800 disabled:opacity-50"
                >
                  <option value={1}>매 1시간마다 확인</option>
                  <option value={6}>매 6시간마다 확인 (권장)</option>
                  <option value={12}>매 12시간마다 확인</option>
                  <option value={24}>매 24시간(1일)마다 확인</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">
                  최근 개정 여부 확인 일시
                </label>
                <div className="flex items-center justify-between h-8 px-2.5 bg-white border border-slate-300 rounded text-slate-700 font-mono tabular-nums">
                  <span>{data.autoUpdateSettings.lastCheckedAt}</span>
                  <button
                    type="button"
                    disabled={isChecking}
                    onClick={handleManualCheck}
                    className="text-xs font-semibold text-purple-600 hover:text-purple-800 disabled:text-slate-400 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {isChecking ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        확인 중...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        즉시 확인
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 적용 가능한 신규 법령 개정안 알림 (Pending Updates) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                신규 개정안 감지 내역 ({pendingLaws.length}건)
              </span>
              <span className="text-[11px] text-slate-500">
                개정안 내용을 대조(Diff)한 뒤 원클릭으로 버전을 승격할 수 있습니다.
              </span>
            </div>

            {pendingLaws.length === 0 ? (
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-md text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  현재 등록된 모든 법령이 공식 정부 출처의 최신 시행 버전과 일치합니다.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingLaws.map((law) => (
                  <div
                    key={law.id}
                    className="p-4 bg-amber-50/70 border border-amber-200 rounded-md text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {law.title}
                        </span>
                        <span className="text-slate-500 font-mono">
                          현재: {law.currentVersion} →
                        </span>
                        <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                          {law.pendingUpdateInfo?.versionNumber}
                        </span>
                      </div>
                      <span className="font-mono text-slate-500 tabular-nums">
                        시행 예정일: {law.pendingUpdateInfo?.effectiveDate}
                      </span>
                    </div>

                    <p className="text-slate-700 mb-3 leading-relaxed">
                      <strong>개정 요약:</strong> {law.pendingUpdateInfo?.summary}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-amber-200/60">
                      <div className="text-[11px] text-slate-500">
                        영향 조문: {law.pendingUpdateInfo?.changedArticles.join(', ')}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenDiffModal(law);
                            onClose();
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded inline-flex items-center gap-1 cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5" />
                          개정 사항 대조(Diff)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onApplyUpdate(law.id);
                            onClose();
                          }}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          개정안 적용하기
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 사전 정의된 공공 법령 정보 출처 목록 (Predefined Sources) */}
          <div>
            <div className="text-xs font-bold text-slate-900 mb-2">
              사전 연계된 공공 법령 출처 (Predefined Sources)
            </div>
            <div className="border border-slate-200 rounded-md overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                  <tr>
                    <th className="py-2.5 px-3">연계 소스명</th>
                    <th className="py-2.5 px-3">제공 기관</th>
                    <th className="py-2.5 px-3">최근 동기화</th>
                    <th className="py-2.5 px-3 text-right">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sources.map((src) => (
                    <tr key={src.sourceId} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {src.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{src.provider}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500">
                        {src.lastSyncAt}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {src.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end pt-4 mt-3 border-t border-slate-100">
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
  );
};
