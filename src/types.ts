export type CategoryType = '임용' | '승진' | '징계' | '교육훈련' | '휴가·복무' | '기타';

export const CATEGORIES: CategoryType[] = [
  '임용',
  '승진',
  '징계',
  '교육훈련',
  '휴가·복무',
  '기타',
];

export interface LawVersion {
  versionId: string;
  versionNumber: string; // e.g. "v1.0", "v1.1", "v2.0"
  effectiveDate: string; // 시행일자
  createdAt: string;
  summaryOfChanges: string;
  source: string; // e.g. "국가법령정보센터", "인사혁신처 고시 제2026-42호"
  text: string;
  pageCount: number;
  changedArticles?: string[]; // e.g. ["제31조", "제45조"]
}

export interface LawItem {
  id: string;
  title: string;
  fileName: string;
  currentVersion: string;
  text: string; // current active text
  pageCount: number;
  createdAt: string;
  updatedAt: string;
  autoUpdateEnabled: boolean;
  sourceUrl?: string;
  lastCheckedAt?: string;
  hasPendingUpdate?: boolean;
  pendingUpdateInfo?: {
    versionNumber: string;
    summary: string;
    effectiveDate: string;
    text: string;
    pageCount: number;
    changedArticles: string[];
  };
  versions: LawVersion[];
}

export interface PredefinedLawSource {
  sourceId: string;
  name: string;
  provider: string;
  checkUrl: string;
  lastSyncAt: string;
  status: '정상 연결' | '동기화 중' | '점검 필요';
  availableUpdatesCount: number;
}

export interface AnswerFeedback {
  id: string;
  caseId?: string;
  question: string;
  rating: number; // 1 ~ 5
  tags: string[];
  comment: string;
  submittedAt: string;
  reviewer: string;
}

export interface ReferenceCitation {
  id: string;
  lawTitle: string;
  articleLabel: string; // e.g. "제31조(승진소요최저연수)"
  fullCitation: string; // e.g. "공무원임용령 제31조제2항제3호"
  matchedText: string;
  lawId?: string;
}

export interface CaseItem {
  id: string;
  category: CategoryType;
  question: string;
  answer: string;
  references: string;
  citations?: ReferenceCitation[];
  feedback?: AnswerFeedback;
  createdAt: string;
  updatedAt?: string;
}

export interface DataSchema {
  laws: LawItem[];
  cases: CaseItem[];
  feedbacks: AnswerFeedback[];
  autoUpdateSettings: {
    enabled: boolean;
    frequencyHours: number;
    lastCheckedAt: string;
    notifyOnNewVersion: boolean;
  };
}

export type VerdictType = 'positive' | 'negative' | 'conditional' | 'neutral';

export interface GenerateAnswerResult {
  answer: string;
  references: string;
  citations: ReferenceCitation[];
  constructedPrompt?: string;
  verdictTitle?: string;
  verdictType?: VerdictType;
  verdictSummary?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
