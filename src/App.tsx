import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Database,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  FolderOpen,
  History,
  Info,
  Layers,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sliders,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  CATEGORIES,
  AnswerFeedback,
  CaseItem,
  CategoryType,
  DataSchema,
  LawItem,
  LawVersion,
  ReferenceCitation,
  ToastMessage,
} from './types';
import { INITIAL_DATA, SAMPLE_QUESTIONS, STORAGE_KEY } from './initialData';
import { findSimilarCases, generateAnswer } from './aiDraftService';
import { extractTextFromPdfFile } from './pdfExtractor';
import { buildStandaloneHtml } from './standaloneHtmlBuilder';
import { SourceVerificationModal } from './components/SourceVerificationModal';
import { VersionDiffModal } from './components/VersionDiffModal';
import { FeedbackModal } from './components/FeedbackModal';
import { AutoUpdateDrawer } from './components/AutoUpdateDrawer';

type ActiveTab = 'qna' | 'cases' | 'laws';

const CASES_PER_PAGE = 6;

export default function App() {
  // ---------------------------------------------------------------------------
  // 1. 상태 관리: localStorage 기반 영구 저장
  // ---------------------------------------------------------------------------
  const [data, setData] = useState<DataSchema>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.laws) && Array.isArray(parsed.cases)) {
          return parsed;
        }
      }
    } catch {
      // 파싱 실패 시 기본 데이터 로드
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DATA));
    return INITIAL_DATA;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      showToast('저장공간(localStorage) 용량이 부족하여 저장에 실패했습니다.', 'error');
    }
  }, [data]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('qna');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: ToastMessage['type'] = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // ---------------------------------------------------------------------------
  // 2. 탭 1 (질문-답변 작성) 상태
  // ---------------------------------------------------------------------------
  const [question, setQuestion] = useState<string>('');
  const [category, setCategory] = useState<CategoryType>('승진');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [answerDraft, setAnswerDraft] = useState<string>('');
  const [referencesDraft, setReferencesDraft] = useState<string>('');
  const [citationsDraft, setCitationsDraft] = useState<ReferenceCitation[]>([]);
  const [constructedPrompt, setConstructedPrompt] = useState<string>('');
  const [showPromptPreview, setShowPromptPreview] = useState<boolean>(false);

  // 답변 피드백 상태
  const [activeFeedbackModalCase, setActiveFeedbackModalCase] = useState<{
    question: string;
    existingFeedback?: AnswerFeedback;
    caseId?: string;
  } | null>(null);

  // 법령 원문 검증 모달 상태 (직접 링크 및 하이라이트 확인)
  const [selectedCitationForVerify, setSelectedCitationForVerify] =
    useState<ReferenceCitation | null>(null);

  // 유사 사례 참고 패널 상태
  const [similarCases, setSimilarCases] = useState<CaseItem[]>(() =>
    findSimilarCases('', '승진', INITIAL_DATA.cases, 3)
  );
  const [selectedSimilarCase, setSelectedSimilarCase] = useState<CaseItem | null>(null);
  const [isSimilarPanelOpenMobile, setIsSimilarPanelOpenMobile] = useState<boolean>(true);

  // ---------------------------------------------------------------------------
  // 3. 탭 2 (사례 DB) 상태
  // ---------------------------------------------------------------------------
  const [searchKeywordInput, setSearchKeywordInput] = useState<string>('');
  const [searchCategoryInput, setSearchCategoryInput] = useState<string>('전체');
  const [appliedKeyword, setAppliedKeyword] = useState<string>('');
  const [appliedCategory, setAppliedCategory] = useState<string>('전체');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [activeCaseId, setActiveCaseId] = useState<string | null>(
    INITIAL_DATA.cases[0]?.id || null
  );
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<CategoryType>('임용');
  const [editQuestion, setEditQuestion] = useState<string>('');
  const [editAnswer, setEditAnswer] = useState<string>('');
  const [editReferences, setEditReferences] = useState<string>('');

  const jsonImportInputRef = useRef<HTMLInputElement | null>(null);

  // ---------------------------------------------------------------------------
  // 4. 탭 3 (법령 관리) 및 버전 관리 상태
  // ---------------------------------------------------------------------------
  const [isDraggingPdf, setIsDraggingPdf] = useState<boolean>(false);
  const [isExtractingPdf, setIsExtractingPdf] = useState<boolean>(false);
  const [pdfProgressText, setPdfProgressText] = useState<string>('');
  const [lawTitleInput, setLawTitleInput] = useState<string>('');
  const [pendingPdfFileName, setPendingPdfFileName] = useState<string>('');
  const [pendingPdfText, setPendingPdfText] = useState<string>('');
  const [pendingPdfPageCount, setPendingPdfPageCount] = useState<number>(0);
  const [selectedLawForPreview, setSelectedLawForPreview] = useState<LawItem | null>(null);
  const [lawPreviewSearch, setLawPreviewSearch] = useState<string>('');

  const pdfFileInputRef = useRef<HTMLInputElement | null>(null);

  // 버전 비교 Diff 모달 상태
  const [lawForDiffModal, setLawForDiffModal] = useState<LawItem | null>(null);

  // 자동 업데이트 드로어 상태
  const [showAutoUpdateDrawer, setShowAutoUpdateDrawer] = useState<boolean>(false);

  // 삭제 확인 모달 상태
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'case' | 'law';
    id: string;
    title: string;
  } | null>(null);

  // 단일 HTML 소스 보기 모달
  const [showStandaloneHtmlModal, setShowStandaloneHtmlModal] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // 5. 통계 및 계산된 값
  // ---------------------------------------------------------------------------
  const pendingUpdatesCount = useMemo(
    () => data.laws.filter((l) => l.hasPendingUpdate).length,
    [data.laws]
  );

  const averageFeedbackRating = useMemo(() => {
    const list = data.cases.filter((c) => c.feedback).map((c) => c.feedback!.rating);
    if (list.length === 0) return 0;
    const sum = list.reduce((a, b) => a + b, 0);
    return Number((sum / list.length).toFixed(1));
  }, [data.cases]);

  const storageStats = useMemo(() => {
    try {
      const serialized = JSON.stringify(data);
      const bytes = new Blob([serialized]).size;
      const mb = bytes / (1024 * 1024);
      return {
        bytes,
        mbFormatted: mb < 0.01 && bytes > 0 ? '0.01' : mb.toFixed(2),
        maxFormatted: '5.00',
        percent: Math.min(100, (mb / 5.0) * 100),
      };
    } catch {
      return { bytes: 0, mbFormatted: '0.00', maxFormatted: '5.00', percent: 0 };
    }
  }, [data]);

  // ---------------------------------------------------------------------------
  // 6. 핸들러: AI 초안 생성, 피드백, 사례 저장
  // ---------------------------------------------------------------------------
  const handleGenerateDraft = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      showToast('질문 내용을 먼저 입력해주세요.', 'error');
      return;
    }

    setIsGenerating(true);

    const matchedCases = findSimilarCases(trimmedQuestion, category, data.cases, 3);
    setSimilarCases(matchedCases);

    try {
      const result = await generateAnswer(
        trimmedQuestion,
        category,
        data.laws,
        matchedCases
      );

      setAnswerDraft(result.answer);
      setReferencesDraft(result.references);
      setCitationsDraft(result.citations);
      if (result.constructedPrompt) {
        setConstructedPrompt(result.constructedPrompt);
      }
      showToast('최신 법령과 유사 사례를 참조하여 AI 답변 초안이 생성되었습니다.', 'success');
    } catch {
      showToast('AI 초안 생성 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveNewCase = () => {
    const trimmedQuestion = question.trim();
    const trimmedAnswer = answerDraft.trim();
    const trimmedReferences = referencesDraft.trim();

    if (!trimmedQuestion || !trimmedAnswer) {
      showToast('질문과 답변 내용을 먼저 작성하거나 AI 초안을 생성해주세요.', 'error');
      return;
    }

    const nowIso = new Date().toISOString().slice(0, 19);
    const newCase: CaseItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `case-${Date.now()}`,
      category,
      question: trimmedQuestion,
      answer: trimmedAnswer,
      references: trimmedReferences || '관련 법령 조문 참조',
      citations: citationsDraft,
      createdAt: nowIso,
    };

    setData((prev) => ({
      ...prev,
      cases: [newCase, ...prev.cases],
    }));

    setActiveCaseId(newCase.id);
    showToast('질문과 답변이 사례 DB에 저장되었습니다.', 'success');
  };

  const handleSaveFeedback = (feedback: AnswerFeedback) => {
    setData((prev) => {
      const updatedFeedbacks = [feedback, ...prev.feedbacks.filter((f) => f.id !== feedback.id)];

      // 현재 선택된 사례 또는 대상 질문과 일치하는 사례에 피드백 바인딩
      const updatedCases = prev.cases.map((c) => {
        if (
          c.id === feedback.caseId ||
          c.question.slice(0, 50) === feedback.question.slice(0, 50)
        ) {
          return { ...c, feedback };
        }
        return c;
      });

      return {
        ...prev,
        feedbacks: updatedFeedbacks,
        cases: updatedCases,
      };
    });

    showToast(`평점 ${feedback.rating}점 및 피드백이 등록되었습니다.`, 'success');
  };

  // ---------------------------------------------------------------------------
  // 7. 법령 자동 갱신 및 버전 관리 핸들러
  // ---------------------------------------------------------------------------
  const handleCheckUpdatesNow = async () => {
    // 공공 법령 정보 출처 연동 확인 시뮬레이션
    await new Promise((r) => setTimeout(r, 900));

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

    setData((prev) => ({
      ...prev,
      autoUpdateSettings: {
        ...prev.autoUpdateSettings,
        lastCheckedAt: nowStr,
      },
    }));

    showToast('국가법령정보센터 및 인사혁신처 연계 개정안 조회가 완료되었습니다.', 'info');
  };

  const handleApplyPendingUpdate = (lawId: string) => {
    setData((prev) => ({
      ...prev,
      laws: prev.laws.map((l) => {
        if (l.id !== lawId || !l.hasPendingUpdate || !l.pendingUpdateInfo) return l;

        const info = l.pendingUpdateInfo;
        const newVersionObj: LawVersion = {
          versionId: `${l.id}-${info.versionNumber.replace(/\s+/g, '')}`,
          versionNumber: info.versionNumber,
          effectiveDate: info.effectiveDate,
          createdAt: new Date().toISOString(),
          summaryOfChanges: info.summary,
          source: '국가법령정보센터 자동 연계 개정령 고시',
          text: info.text,
          pageCount: info.pageCount,
          changedArticles: info.changedArticles,
        };

        return {
          ...l,
          currentVersion: info.versionNumber,
          text: info.text,
          pageCount: info.pageCount,
          updatedAt: new Date().toISOString().slice(0, 19),
          hasPendingUpdate: false,
          pendingUpdateInfo: undefined,
          versions: [newVersionObj, ...l.versions],
        };
      }),
    }));

    showToast('신규 개정 법령이 반영되어 최신 버전으로 승격되었습니다.', 'success');
  };

  const handleRestoreVersion = (lawId: string, versionToRestore: LawVersion) => {
    setData((prev) => ({
      ...prev,
      laws: prev.laws.map((l) => {
        if (l.id !== lawId) return l;
        return {
          ...l,
          currentVersion: versionToRestore.versionNumber,
          text: versionToRestore.text,
          pageCount: versionToRestore.pageCount,
          updatedAt: new Date().toISOString().slice(0, 19),
        };
      }),
    }));

    showToast(`${versionToRestore.versionNumber} 시점의 법령 텍스트로 복원되었습니다.`, 'info');
  };

  // ---------------------------------------------------------------------------
  // 8. 사례 검색, 인라인 수정, JSON 입출력
  // ---------------------------------------------------------------------------
  const filteredCases = useMemo(() => {
    const kw = appliedKeyword.trim().toLowerCase();
    return data.cases.filter((c) => {
      const categoryMatch =
        appliedCategory === '전체' || c.category === appliedCategory;
      const keywordMatch =
        !kw ||
        c.question.toLowerCase().includes(kw) ||
        c.answer.toLowerCase().includes(kw) ||
        c.references.toLowerCase().includes(kw);
      return categoryMatch && keywordMatch;
    });
  }, [data.cases, appliedCategory, appliedKeyword]);

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / CASES_PER_PAGE));
  const paginatedCases = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * CASES_PER_PAGE;
    return filteredCases.slice(start, start + CASES_PER_PAGE);
  }, [filteredCases, currentPage, totalPages]);

  const selectedCaseDetail = useMemo(
    () => data.cases.find((c) => c.id === activeCaseId) || null,
    [data.cases, activeCaseId]
  );

  const handleExportCasesJson = () => {
    const exportPayload = JSON.stringify(data.cases, null, 2);
    const blob = new Blob([exportPayload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `인사교육_사례DB_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`사례 DB ${data.cases.length}건을 JSON 파일로 내보냈습니다.`, 'success');
  };

  const handleImportCasesJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const rawList = Array.isArray(parsed)
          ? parsed
          : parsed && Array.isArray(parsed.cases)
            ? parsed.cases
            : [];

        if (rawList.length === 0) {
          showToast('사례 데이터가 파일에 없습니다.', 'error');
          return;
        }

        const validCases: CaseItem[] = rawList
          .filter(
            (it: unknown): it is Record<string, unknown> =>
              typeof it === 'object' &&
              it !== null &&
              typeof (it as Record<string, unknown>).question === 'string' &&
              typeof (it as Record<string, unknown>).answer === 'string'
          )
          .map((it: Record<string, unknown>, idx: number) => ({
            id: `case-${Date.now()}-${idx}`,
            category: (CATEGORIES.includes(it.category as CategoryType)
              ? it.category
              : '기타') as CategoryType,
            question: String(it.question).trim(),
            answer: String(it.answer).trim(),
            references: String(it.references || '관련 법령 참조').trim(),
            createdAt: String(it.createdAt || new Date().toISOString().slice(0, 19)),
          }));

        setData((prev) => ({
          ...prev,
          cases: [...validCases, ...prev.cases],
        }));
        showToast(`${validCases.length}건의 사례를 가져왔습니다.`, 'success');
      } catch {
        showToast('유효한 JSON 파일이 아닙니다.', 'error');
      } finally {
        if (jsonImportInputRef.current) jsonImportInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // ---------------------------------------------------------------------------
  // 9. 법령 PDF 업로드(PDF.js) 및 신규 등록
  // ---------------------------------------------------------------------------
  const processPdfFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showToast('PDF 파일(.pdf)만 업로드할 수 있습니다.', 'error');
      return;
    }
    setIsExtractingPdf(true);
    setPdfProgressText(`'${file.name}' 텍스트 추출 중...`);

    try {
      const res = await extractTextFromPdfFile(file, (curr, total) => {
        setPdfProgressText(`PDF 텍스트 추출 중... (${curr} / ${total} 페이지)`);
      });

      setLawTitleInput(res.suggestedTitle);
      setPendingPdfFileName(file.name);
      setPendingPdfText(res.text);
      setPendingPdfPageCount(res.pageCount);
      setPdfProgressText(`추출 완료: ${file.name} (총 ${res.pageCount}쪽)`);
      showToast(`'${file.name}'에서 텍스트를 추출했습니다. [등록]을 눌러 저장하세요.`, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'PDF 추출 실패', 'error');
      setPdfProgressText('');
    } finally {
      setIsExtractingPdf(false);
    }
  };

  const handleRegisterLaw = () => {
    const title = lawTitleInput.trim();
    if (!title || !pendingPdfText.trim()) {
      showToast('법령 제목과 추출된 텍스트가 필요합니다.', 'error');
      return;
    }

    const nowIso = new Date().toISOString().slice(0, 19);
    const newVersion: LawVersion = {
      versionId: `v-${Date.now()}`,
      versionNumber: 'v1.0',
      effectiveDate: nowIso.slice(0, 10),
      createdAt: nowIso,
      summaryOfChanges: '초기 법령 등록',
      source: '사용자 PDF 업로드 추출본',
      text: pendingPdfText.trim(),
      pageCount: pendingPdfPageCount || 1,
    };

    const newLaw: LawItem = {
      id: `law-${Date.now()}`,
      title,
      fileName: pendingPdfFileName || `${title}.pdf`,
      currentVersion: 'v1.0',
      text: pendingPdfText.trim(),
      pageCount: pendingPdfPageCount || 1,
      createdAt: nowIso,
      updatedAt: nowIso,
      autoUpdateEnabled: true,
      versions: [newVersion],
    };

    setData((prev) => ({
      ...prev,
      laws: [newLaw, ...prev.laws],
    }));

    setLawTitleInput('');
    setPendingPdfFileName('');
    setPendingPdfText('');
    setPendingPdfPageCount(0);
    setPdfProgressText('');
    showToast(`'${newLaw.title}' 법령이 등록되었습니다.`, 'success');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* =====================================================================
          우상단 토스트 알림
          ===================================================================== */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-lg shadow-md border text-sm font-medium transition-opacity ${
              t.type === 'error'
                ? 'bg-red-950 text-white border-red-800'
                : t.type === 'info'
                  ? 'bg-slate-900 text-white border-slate-700'
                  : 'bg-purple-950 text-white border-purple-800'
            }`}
          >
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="text-slate-300 hover:text-white shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* =====================================================================
          헤더 (Top Bar Contract: 1 Row, 3 Zones)
          ===================================================================== */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('qna');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            인사교육 법령 Q&amp;A 도우미
          </a>

          {/* Zone 2: 3개 탭 네비게이션 */}
          <nav className="flex items-center gap-6 sm:gap-8 h-full overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('qna')}
              className={`h-full inline-flex items-center border-b-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'qna'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              질문-답변 작성
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cases')}
              className={`h-full inline-flex items-center border-b-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'cases'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              사례 DB ({data.cases.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('laws')}
              className={`h-full inline-flex items-center border-b-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === 'laws'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              법령 관리 ({data.laws.length})
            </button>
          </nav>

          {/* Zone 3: Actions (자동 업데이트 관리 & 단일 HTML) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAutoUpdateDrawer(true)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                pendingUpdatesCount > 0
                  ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 font-bold'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>개정 모니터링</span>
              {pendingUpdatesCount > 0 && (
                <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {pendingUpdatesCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowStandaloneHtmlModal(true)}
              className="hidden lg:inline-flex px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap items-center gap-1.5 cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5 text-slate-500" />
              단일 HTML
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================================
          메인 본문
          ===================================================================== */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* ===================================================================
            탭 1: 질문-답변 작성 (메인 화면)
            =================================================================== */}
        {activeTab === 'qna' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* 좌측: 질문 폼 및 답변 초안 (8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* 질문 입력 패널 */}
              <section className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-100">
                  <div>
                    <h1 className="text-lg font-bold text-slate-900">
                      질문 입력 및 AI 초안 생성
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                      공무원 인사교육 법령 최신 버전과 과거 사례를 대조하여 근거 조문과 답변 초안을 작성합니다.
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    참조 법령 {data.laws.length}건 · 평균 정확도 ⭐ {averageFeedbackRating || '5.0'} / 5.0
                  </div>
                </div>

                {/* 빠른 질문 샘플 */}
                <div className="mb-5">
                  <div className="text-xs font-semibold text-slate-600 mb-2">
                    자주 묻는 인사교육 질의 예시 (클릭 시 자동 입력)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SAMPLE_QUESTIONS.map((sq) => (
                      <button
                        key={sq.label}
                        type="button"
                        onClick={() => {
                          setCategory(sq.category);
                          setQuestion(sq.question);
                          setSimilarCases(
                            findSimilarCases(sq.question, sq.category, data.cases, 3)
                          );
                        }}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                      >
                        [{sq.category}] {sq.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 카테고리 선택 및 질문 본문 */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      카테고리 선택
                    </label>
                    <select
                      value={category}
                      onChange={(e) => {
                        const nextCat = e.target.value as CategoryType;
                        setCategory(nextCat);
                        setSimilarCases(
                          findSimilarCases(question, nextCat, data.cases, 3)
                        );
                      }}
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3 flex items-end">
                    <p className="text-xs text-slate-500 pb-2">
                      카테고리별 전문 법령(임용령, 복무규정, 징계령 등) 조문과 과거 유사 사례를 우선 대조합니다.
                    </p>
                  </div>
                </div>

                <div className="mb-5">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    질문 내용
                  </label>
                  <textarea
                    rows={4}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="인사교육 관련 질문을 입력하세요"
                    className="w-full p-3.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600 leading-relaxed"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQuestion('');
                      setAnswerDraft('');
                      setReferencesDraft('');
                      setCitationsDraft([]);
                      setConstructedPrompt('');
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                  >
                    입력 초기화
                  </button>

                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={handleGenerateDraft}
                    className="px-5 py-2.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-md transition-colors inline-flex items-center gap-2 cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        법령 조문 대조 및 AI 초안 작성 중...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        AI 초안 생성
                      </>
                    )}
                  </button>
                </div>
              </section>

              {/* AI 답변 표시 및 편집 영역 */}
              <section className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      AI 답변 초안 및 근거 조문 검증
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      참고 법령 조문의 [원문 검증하기]를 클릭하여 법령 원문과 하이라이트 문구를 즉시 확인할 수 있습니다.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {answerDraft && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveFeedbackModalCase({
                            question,
                            caseId: activeCaseId || undefined,
                          })
                        }
                        className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Star className="w-3.5 h-3.5 fill-purple-600 text-purple-600" />
                        답변 정확도 평가·피드백
                      </button>
                    )}
                  </div>
                </div>

                {isGenerating ? (
                  <div className="py-14 flex flex-col items-center justify-center text-center">
                    <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-3" />
                    <p className="text-sm font-semibold text-slate-800">
                      최신 개정 법령 조문과 유사 업무 사례를 대조 분석 중입니다...
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      공무원임용령, 복무규정 등의 최신 버전을 기반으로 답변을 생성합니다.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* 답변 본문 textarea */}
                    <div className="mb-5">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        AI 답변 초안 (편집 가능)
                      </label>
                      <textarea
                        rows={11}
                        value={answerDraft}
                        onChange={(e) => setAnswerDraft(e.target.value)}
                        placeholder="상단의 [AI 초안 생성]을 클릭하면 최신 법령 조항을 인용한 답변 초안이 생성됩니다."
                        className="w-full p-4 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600 leading-relaxed"
                      />
                    </div>

                    {/* 향상된 참고 법령 조문 영역 (직접 링크 및 하이라이트 검증) */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-md mb-5">
                      <div className="flex items-center justify-between mb-2.5">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                          참고 법령 조문 (원문 링크 및 하이라이트 대조)
                        </label>
                        <span className="text-[11px] text-slate-500">
                          버튼 클릭 시 해당 법령 원문 조항으로 즉시 이동
                        </span>
                      </div>

                      {/* 스마트 조문 인용 카드 목록 */}
                      {citationsDraft.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
                          {citationsDraft.map((cit) => (
                            <div
                              key={cit.id}
                              className="p-3 bg-white border border-slate-200 rounded-md shadow-2xs hover:border-purple-400 transition-colors flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between text-xs font-bold text-slate-900 mb-1">
                                  <span>{cit.fullCitation}</span>
                                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono">
                                    원문 일치
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                  {cit.matchedText}
                                </p>
                              </div>
                              <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-end">
                                <button
                                  type="button"
                                  onClick={() => setSelectedCitationForVerify(cit)}
                                  className="text-xs font-bold text-purple-600 hover:text-purple-800 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  법령 원문 검증하기
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <textarea
                        rows={2}
                        value={referencesDraft}
                        onChange={(e) => setReferencesDraft(e.target.value)}
                        placeholder="근거 조문(예: 공무원임용령 제31조제2항제3호)이 여기에 표시됩니다."
                        className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600"
                      />
                    </div>

                    {/* 프롬프트 미리보기 토글 */}
                    {constructedPrompt && (
                      <div className="mb-5 border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          onClick={() => setShowPromptPreview((prev) => !prev)}
                          className="text-xs font-semibold text-slate-600 hover:text-purple-600 inline-flex items-center gap-1 cursor-pointer"
                        >
                          {showPromptPreview ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          AI 초안 생성 프롬프트 및 참조 데이터 구조 확인
                        </button>
                        {showPromptPreview && (
                          <pre className="mt-2 p-3 bg-slate-900 text-slate-100 text-xs rounded-md overflow-x-auto whitespace-pre-wrap font-mono">
                            {constructedPrompt}
                          </pre>
                        )}
                      </div>
                    )}

                    {/* 저장 버튼 및 피드백 바로가기 */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                      <p className="text-xs text-slate-500">
                        저장 시 질문, 수정된 답변, 원문 대조 조문이 사례 DB에 영구 기록됩니다.
                      </p>
                      <div className="flex items-center gap-2">
                        {answerDraft && (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveFeedbackModalCase({
                                question,
                                caseId: activeCaseId || undefined,
                              })
                            }
                            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <MessageSquarePlus className="w-3.5 h-3.5 text-slate-500" />
                            정확도 평가
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleSaveNewCase}
                          className="px-5 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-md inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          사례 저장
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </div>

            {/* 우측: 유사 사례 참고 패널 (4 cols) */}
            <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-6">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    유사 사례 참고 패널
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    사례 DB에서 키워드와 카테고리가 매칭된 과거 사례
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSimilarPanelOpenMobile((prev) => !prev)}
                  className="lg:hidden text-xs font-semibold text-purple-600 cursor-pointer"
                >
                  {isSimilarPanelOpenMobile ? '접기' : '펼치기'}
                </button>
              </div>

              {isSimilarPanelOpenMobile && (
                <div className="divide-y divide-slate-100">
                  {similarCases.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-xs">
                      일치하는 유사 사례가 없습니다.
                    </div>
                  ) : (
                    similarCases.map((item, idx) => (
                      <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                          <span className="font-semibold text-purple-700">
                            {item.category}
                          </span>
                          <span className="font-mono tabular-nums">
                            {item.createdAt.slice(0, 10)}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">
                          Q. {item.question}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-3 leading-relaxed">
                          {item.answer}
                        </p>
                        <div className="flex items-center justify-between mt-2.5">
                          <span className="text-[11px] text-slate-500 truncate max-w-[180px]">
                            {item.references}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAnswerDraft(item.answer);
                              setReferencesDraft(item.references);
                              showToast('유사 사례 답변을 편집창에 불러왔습니다.', 'info');
                            }}
                            className="text-xs font-semibold text-purple-600 hover:text-purple-800 cursor-pointer"
                          >
                            답변란에 적용
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </aside>
          </div>
        )}

        {/* ===================================================================
            탭 2: 사례 DB
            =================================================================== */}
        {activeTab === 'cases' && (
          <div className="flex flex-col gap-6">
            {/* 검색 및 백업 액션 바 */}
            <section className="bg-white border border-slate-200 rounded-lg p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-100">
                <div>
                  <h1 className="text-lg font-bold text-slate-900">
                    인사교육 법령 질의·답변 사례 DB
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    업무 질의 사례 검색, 담당자 정확도 평가 피드백 및 법령 조문 검증 이력을 관리합니다.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCasesJson}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    전체 내보내기(JSON)
                  </button>
                  <button
                    type="button"
                    onClick={() => jsonImportInputRef.current?.click()}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    사례 가져오기(JSON)
                  </button>
                  <input
                    ref={jsonImportInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportCasesJson}
                    className="hidden"
                  />
                </div>
              </div>

              {/* 검색 폼 */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setAppliedKeyword(searchKeywordInput);
                  setAppliedCategory(searchCategoryInput);
                  setCurrentPage(1);
                }}
                className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
              >
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    카테고리 필터
                  </label>
                  <select
                    value={searchCategoryInput}
                    onChange={(e) => {
                      setSearchCategoryInput(e.target.value);
                      setAppliedCategory(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600"
                  >
                    <option value="전체">전체</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    키워드 검색
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchKeywordInput}
                      onChange={(e) => setSearchKeywordInput(e.target.value)}
                      placeholder="질문, 답변 본문, 근거 법령 조문 키워드로 검색"
                      className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div className="sm:col-span-3 flex items-center gap-2">
                  <button
                    type="submit"
                    className="flex-1 h-10 px-4 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors cursor-pointer"
                  >
                    검색
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchKeywordInput('');
                      setSearchCategoryInput('전체');
                      setAppliedKeyword('');
                      setAppliedCategory('전체');
                      setCurrentPage(1);
                    }}
                    className="h-10 px-3 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                  >
                    초기화
                  </button>
                </div>
              </form>
            </section>

            {/* 사례 테이블 + 상세 보기 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* 좌측: 목록 테이블 (7 cols) */}
              <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">
                    사례 목록 ({filteredCases.length}건)
                  </h2>
                  <span className="text-xs text-slate-500">
                    행 클릭 시 상세 전문 및 피드백 표시
                  </span>
                </div>

                {filteredCases.length === 0 ? (
                  <div className="py-16 text-center text-slate-500 text-sm">
                    조회된 사례가 없습니다.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                            <th className="py-3 px-4 w-14">번호</th>
                            <th className="py-3 px-4 w-20">카테고리</th>
                            <th className="py-3 px-4">질문 요약 (앞 50자)</th>
                            <th className="py-3 px-4 w-20 text-center">평점</th>
                            <th className="py-3 px-4 w-24 text-right">작성일</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {paginatedCases.map((item, idx) => {
                            const displayNumber =
                              filteredCases.length -
                              ((currentPage - 1) * CASES_PER_PAGE + idx);
                            const isSelected = item.id === activeCaseId;
                            return (
                              <tr
                                key={item.id}
                                onClick={() => {
                                  setActiveCaseId(item.id);
                                  setEditingCaseId(null);
                                }}
                                className={`cursor-pointer transition-colors ${
                                  isSelected ? 'bg-purple-50/70' : 'hover:bg-slate-50'
                                }`}
                              >
                                <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-500">
                                  {displayNumber}
                                </td>
                                <td className="py-3.5 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">
                                  {item.category}
                                </td>
                                <td className="py-3.5 px-4 text-slate-900 font-medium">
                                  {item.question.length > 50
                                    ? `${item.question.slice(0, 50)}...`
                                    : item.question}
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  {item.feedback ? (
                                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-600">
                                      <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                                      {item.feedback.rating}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 text-xs">-</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-500 text-right whitespace-nowrap">
                                  {item.createdAt.slice(0, 10)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* 페이지네이션 */}
                    {totalPages > 1 && (
                      <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-mono tabular-nums">
                          페이지 {currentPage} / {totalPages}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className="px-2.5 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                          >
                            이전
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setCurrentPage(p)}
                              className={`px-2.5 py-1 rounded font-mono tabular-nums cursor-pointer ${
                                p === currentPage
                                  ? 'bg-purple-600 text-white font-semibold'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                          <button
                            type="button"
                            disabled={currentPage >= totalPages}
                            onClick={() =>
                              setCurrentPage((p) => Math.min(totalPages, p + 1))
                            }
                            className="px-2.5 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                          >
                            다음
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* 우측: 상세 보기 및 피드백/조문 검증 (5 cols) */}
              <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6">
                {!selectedCaseDetail ? (
                  <div className="py-16 text-center text-slate-500 text-sm">
                    사례 목록에서 행을 선택하세요.
                  </div>
                ) : editingCaseId === selectedCaseDetail.id ? (
                  /* 인라인 편집 모드 */
                  <div className="space-y-4">
                    <h2 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
                      사례 인라인 수정
                    </h2>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        카테고리
                      </label>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as CategoryType)}
                        className="w-full h-9 px-3 text-sm bg-white border border-slate-300 rounded-md"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        질문
                      </label>
                      <textarea
                        rows={3}
                        value={editQuestion}
                        onChange={(e) => setEditQuestion(e.target.value)}
                        className="w-full p-2.5 text-sm bg-white border border-slate-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        답변
                      </label>
                      <textarea
                        rows={8}
                        value={editAnswer}
                        onChange={(e) => setEditAnswer(e.target.value)}
                        className="w-full p-2.5 text-sm bg-white border border-slate-300 rounded-md"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingCaseId(null)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-md cursor-pointer"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setData((prev) => ({
                            ...prev,
                            cases: prev.cases.map((c) =>
                              c.id === editingCaseId
                                ? {
                                    ...c,
                                    category: editCategory,
                                    question: editQuestion.trim(),
                                    answer: editAnswer.trim(),
                                    references: editReferences.trim(),
                                  }
                                : c
                            ),
                          }));
                          setEditingCaseId(null);
                          showToast('사례가 수정되었습니다.', 'success');
                        }}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 rounded-md cursor-pointer"
                      >
                        수정 완료
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 사례 상세 보기 */
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="text-xs text-slate-500">
                        <span className="font-bold text-purple-700">
                          {selectedCaseDetail.category}
                        </span>
                        <span className="mx-1.5">·</span>
                        <span className="font-mono tabular-nums">
                          {selectedCaseDetail.createdAt.replace('T', ' ').slice(0, 16)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCaseId(selectedCaseDetail.id);
                            setEditCategory(selectedCaseDetail.category);
                            setEditQuestion(selectedCaseDetail.question);
                            setEditAnswer(selectedCaseDetail.answer);
                            setEditReferences(selectedCaseDetail.references);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded cursor-pointer"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDelete({
                              type: 'case',
                              id: selectedCaseDetail.id,
                              title: selectedCaseDetail.question.slice(0, 30),
                            })
                          }
                          className="px-2.5 py-1 text-xs font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded cursor-pointer"
                        >
                          삭제
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">
                        질문 내용
                      </div>
                      <p className="text-sm font-bold text-slate-900 leading-relaxed">
                        Q. {selectedCaseDetail.question}
                      </p>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-500 mb-1">
                        답변 내용
                      </div>
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {selectedCaseDetail.answer}
                      </div>
                    </div>

                    {/* 스마트 조문 링크 */}
                    {selectedCaseDetail.citations && selectedCaseDetail.citations.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-700 mb-2">
                          연계된 법령 원문 조항 ({selectedCaseDetail.citations.length}건)
                        </div>
                        <div className="space-y-1.5">
                          {selectedCaseDetail.citations.map((cit) => (
                            <div
                              key={cit.id}
                              className="p-2.5 bg-white border border-slate-200 rounded flex items-center justify-between text-xs"
                            >
                              <span className="font-semibold text-slate-800">
                                {cit.fullCitation}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedCitationForVerify(cit)}
                                className="text-purple-600 hover:text-purple-800 font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                원문 검증
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 피드백 상태 배너 */}
                    <div className="pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-700">
                          AI 답변 정확도 평가 피드백
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveFeedbackModalCase({
                              question: selectedCaseDetail.question,
                              caseId: selectedCaseDetail.id,
                              existingFeedback: selectedCaseDetail.feedback,
                            })
                          }
                          className="text-xs font-bold text-purple-600 hover:text-purple-800 cursor-pointer"
                        >
                          {selectedCaseDetail.feedback ? '피드백 수정' : '+ 평가 등록'}
                        </button>
                      </div>

                      {selectedCaseDetail.feedback ? (
                        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-md text-xs">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1 font-bold text-amber-900">
                              <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                              <span>{selectedCaseDetail.feedback.rating} / 5점</span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {selectedCaseDetail.feedback.submittedAt}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {selectedCaseDetail.feedback.tags.map((t) => (
                              <span
                                key={t}
                                className="bg-amber-100/90 text-amber-800 px-2 py-0.5 rounded text-[11px]"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                          {selectedCaseDetail.feedback.comment && (
                            <p className="text-slate-700 leading-relaxed">
                              &ldquo;{selectedCaseDetail.feedback.comment}&rdquo;
                            </p>
                          )}
                          <div className="mt-1 text-[11px] text-slate-500 text-right">
                            검토자: {selectedCaseDetail.feedback.reviewer}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          아직 등록된 담당자 정확도 평가 피드백이 없습니다.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* ===================================================================
            탭 3: 법령 관리 (버전 관리 & 변경 이력 Diff & 자동 업데이트)
            =================================================================== */}
        {activeTab === 'laws' && (
          <div className="flex flex-col gap-6">
            {/* 상단 안내 배너 + 자동 업데이트 현황 */}
            <div className="bg-purple-50/80 border-l-4 border-purple-600 p-4 rounded-r-md flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Info className="w-4.5 h-4.5 text-purple-600" />
                  <span>
                    국가법령정보센터 및 인사혁신처 고시 연계 자동 업데이트 지원
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  HWP 파일은 PDF로 변환 후 업로드해주세요. 법령이 개정되면 버전 이력(Diff)을 통해 이전 법령과의 차이를 한눈에 대조할 수 있습니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAutoUpdateDrawer(true)}
                  className="px-3.5 py-1.5 text-xs font-bold text-purple-700 bg-white border border-purple-200 hover:bg-purple-50 rounded-md inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  개정 확인 설정
                </button>
              </div>
            </div>

            {/* 신규 법령 업로드 패널 */}
            <section className="bg-white border border-slate-200 rounded-lg p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-100">
                <div>
                  <h1 className="text-lg font-bold text-slate-900">
                    법령 PDF 업로드 및 신규 버전 등록
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    PDF 문서를 업로드하면 PDF.js를 통해 조문 텍스트를 자동 추출하고 버전 관리를 시작합니다.
                  </p>
                </div>
              </div>

              {/* 드래그앤드롭 영역 */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingPdf(true);
                }}
                onDragLeave={() => setIsDraggingPdf(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingPdf(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) processPdfFile(file);
                }}
                onClick={() => pdfFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-7 text-center transition-colors cursor-pointer ${
                  isDraggingPdf
                    ? 'border-purple-600 bg-purple-50/60'
                    : 'border-slate-300 bg-slate-50/60 hover:border-purple-500'
                }`}
              >
                <input
                  ref={pdfFileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processPdfFile(file);
                  }}
                  className="hidden"
                />
                {isExtractingPdf ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-2" />
                    <p className="text-sm font-semibold text-slate-800">
                      {pdfProgressText}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="w-8 h-8 text-purple-600 mb-2" />
                    <p className="text-sm font-semibold text-slate-800">
                      법령 PDF 파일을 이곳에 드래그하거나 클릭하여 파일을 선택하세요
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      PDF(.pdf)만 허용 · 업로드 즉시 조문 텍스트 자동 추출
                    </p>
                    {pdfProgressText && (
                      <p className="mt-2 text-xs font-semibold text-purple-700">
                        {pdfProgressText}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 제목 입력 및 등록 버튼 */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-9">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    법령 제목
                  </label>
                  <input
                    type="text"
                    value={lawTitleInput}
                    onChange={(e) => setLawTitleInput(e.target.value)}
                    placeholder="예: 공무원 징계령, 국가공무원 복무규정"
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>
                <div className="sm:col-span-3">
                  <button
                    type="button"
                    disabled={isExtractingPdf}
                    onClick={handleRegisterLaw}
                    className="w-full h-10 px-4 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-md transition-colors cursor-pointer"
                  >
                    등록
                  </button>
                </div>
              </div>
            </section>

            {/* 등록된 법령 목록 및 버전 관리 테이블 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* 좌측: 법령 목록 및 버전 이력 액션 (7 cols) */}
              <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">
                    등록된 법령 및 버전 관리 ({data.laws.length}건)
                  </h2>
                  <span className="text-xs text-slate-500">
                    행 클릭 시 조문 미리보기 / 개정 이력 대조
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                        <th className="py-3 px-4">법령명</th>
                        <th className="py-3 px-4 w-28">현재 버전</th>
                        <th className="py-3 px-4 w-28 text-center">개정 이력</th>
                        <th className="py-3 px-4 w-24 text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {data.laws.map((law) => {
                        const isSelected = selectedLawForPreview?.id === law.id;
                        return (
                          <tr
                            key={law.id}
                            onClick={() => {
                              setSelectedLawForPreview(law);
                              setLawPreviewSearch('');
                            }}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-purple-50/70' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900">
                                  {law.title}
                                </span>
                                {law.hasPendingUpdate && (
                                  <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap">
                                    개정안 감지
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {law.fileName} · 시행 {law.updatedAt.slice(0, 10)}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs text-purple-700 font-bold whitespace-nowrap">
                              {law.currentVersion}
                            </td>
                            <td
                              className="py-3.5 px-4 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => setLawForDiffModal(law)}
                                className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              >
                                <History className="w-3.5 h-3.5 text-slate-500" />
                                <span>이력 비교 ({law.versions.length}판)</span>
                              </button>
                            </td>
                            <td
                              className="py-3.5 px-4 text-right whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDelete({
                                    type: 'law',
                                    id: law.id,
                                    title: law.title,
                                  })
                                }
                                className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded cursor-pointer"
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 하단 저장공간 게이지 */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 text-xs">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-semibold text-slate-700 font-mono tabular-nums">
                      저장공간: {storageStats.mbFormatted} MB / {storageStats.maxFormatted} MB
                    </span>
                    <span className="text-slate-500">
                      브라우저 localStorage 기준 ({storageStats.bytes.toLocaleString()} Bytes)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        storageStats.percent > 80 ? 'bg-red-600' : 'bg-purple-600'
                      }`}
                      style={{ width: `${Math.max(2, storageStats.percent)}%` }}
                    />
                  </div>
                </div>
              </section>

              {/* 우측: 법령 텍스트 미리보기 및 조문 검색 (5 cols) */}
              <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6">
                {!selectedLawForPreview ? (
                  <div className="py-16 text-center text-slate-500 text-sm">
                    법령 행을 클릭하면 추출된 조문 텍스트를 미리봅니다.
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          {selectedLawForPreview.title}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                          버전 {selectedLawForPreview.currentVersion} · 총 {selectedLawForPreview.pageCount}쪽
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLawForDiffModal(selectedLawForPreview)}
                        className="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded inline-flex items-center gap-1 cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5" />
                        개정 이력 Diff
                      </button>
                    </div>

                    <div className="mb-3 relative">
                      <input
                        type="text"
                        value={lawPreviewSearch}
                        onChange={(e) => setLawPreviewSearch(e.target.value)}
                        placeholder="이 법령 본문 내 조문 번호나 단어 검색 (예: 제31조, 육아휴직)"
                        className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>

                    <div className="max-h-[420px] overflow-y-auto p-3.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 whitespace-pre-wrap font-mono leading-relaxed">
                      {lawPreviewSearch.trim()
                        ? selectedLawForPreview.text
                            .split('\n')
                            .filter((line) =>
                              line.toLowerCase().includes(lawPreviewSearch.trim().toLowerCase())
                            )
                            .join('\n\n') || `"${lawPreviewSearch}" 일치 문구가 없습니다.`
                        : selectedLawForPreview.text}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </main>

      {/* =====================================================================
          모달 컴포넌트들
          ===================================================================== */}
      {/* 1. 법령 원문 대조 검증 모달 (조문 직접 링크 & 하이라이트) */}
      {selectedCitationForVerify && (
        <SourceVerificationModal
          citation={selectedCitationForVerify}
          law={data.laws.find(
            (l) =>
              l.id === selectedCitationForVerify.lawId ||
              l.title === selectedCitationForVerify.lawTitle
          )}
          onClose={() => setSelectedCitationForVerify(null)}
        />
      )}

      {/* 2. 버전 이력 비교(Diff) 모달 */}
      {lawForDiffModal && (
        <VersionDiffModal
          law={lawForDiffModal}
          onClose={() => setLawForDiffModal(null)}
          onRestoreVersion={handleRestoreVersion}
          onApplyPendingUpdate={handleApplyPendingUpdate}
        />
      )}

      {/* 3. AI 답변 정확도 평가 & 피드백 모달 */}
      {activeFeedbackModalCase && (
        <FeedbackModal
          question={activeFeedbackModalCase.question}
          initialFeedback={activeFeedbackModalCase.existingFeedback}
          onSaveFeedback={handleSaveFeedback}
          onClose={() => setActiveFeedbackModalCase(null)}
        />
      )}

      {/* 4. 자동 업데이트 및 공공 법령 피드 연계 관리 드로어 */}
      {showAutoUpdateDrawer && (
        <AutoUpdateDrawer
          data={data}
          onUpdateSettings={(newSettings) =>
            setData((prev) => ({ ...prev, autoUpdateSettings: newSettings }))
          }
          onApplyUpdate={handleApplyPendingUpdate}
          onCheckUpdatesNow={handleCheckUpdatesNow}
          onOpenDiffModal={(law) => setLawForDiffModal(law)}
          onClose={() => setShowAutoUpdateDrawer(false)}
        />
      )}

      {/* 5. 삭제 확인 모달 */}
      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900 mb-2">
              {confirmDelete.type === 'case' ? '사례 삭제 확인' : '법령 삭제 확인'}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              &ldquo;{confirmDelete.title}&rdquo; 항목을 삭제하시겠습니까?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmDelete.type === 'case') {
                    setData((prev) => ({
                      ...prev,
                      cases: prev.cases.filter((c) => c.id !== confirmDelete.id),
                    }));
                  } else {
                    setData((prev) => ({
                      ...prev,
                      laws: prev.laws.filter((l) => l.id !== confirmDelete.id),
                    }));
                  }
                  setConfirmDelete(null);
                  showToast('삭제되었습니다.', 'info');
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded cursor-pointer"
              >
                삭제 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. 단일 HTML 파일 소스 모달 */}
      {showStandaloneHtmlModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          onClick={() => setShowStandaloneHtmlModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-lg max-w-4xl w-full p-6 shadow-xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                단일 HTML 소스코드 (독립 실행형)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(buildStandaloneHtml(data));
                    showToast('클립보드에 복사되었습니다.', 'info');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer inline-flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  코드 복사
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([buildStandaloneHtml(data)], {
                      type: 'text/html;charset=utf-8',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = '인사교육_법령_QnA_도우미.html';
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast('HTML 파일이 다운로드되었습니다.', 'success');
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded cursor-pointer inline-flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  .html 파일 다운로드
                </button>
                <button
                  type="button"
                  onClick={() => setShowStandaloneHtmlModal(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto p-4 bg-slate-900 text-slate-100 text-xs rounded-md font-mono">
              {buildStandaloneHtml(data)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
