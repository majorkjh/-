import {
  CaseItem,
  CategoryType,
  GenerateAnswerResult,
  LawItem,
  ReferenceCitation,
} from './types';

/**
 * 한국어 질문 텍스트에서 키워드 추출
 */
export function extractKeywords(text: string): string[] {
  const cleaned = text
    .replace(/[^\w가-힣\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);

  const stripped = cleaned.map((word) =>
    word.replace(/(은|는|이|가|을|를|에서|으로|로|에게|께|의|과|와|도|만)$/, '')
  );

  const stopWords = new Set([
    '경우',
    '어떻게',
    '무엇',
    '있나요',
    '되나요',
    '하나요',
    '대한',
    '관련',
    '문의',
    '질문',
    '궁금합니다',
    '공무원',
    '해당',
    '여부',
    '기준',
    '대해',
  ]);

  return Array.from(
    new Set(stripped.filter((w) => w.length >= 2 && !stopWords.has(w)))
  );
}

/**
 * 과거 유사 사례 검색 (키워드 + 카테고리 가중치)
 */
export function findSimilarCases(
  question: string,
  category: CategoryType,
  allCases: CaseItem[],
  maxResults = 3
): CaseItem[] {
  if (!allCases || allCases.length === 0) return [];

  const keywords = extractKeywords(question);

  const scored = allCases.map((item) => {
    let score = 0;

    if (item.category === category) {
      score += 3;
    }

    const targetText = `${item.question} ${item.answer} ${item.references}`;
    for (const kw of keywords) {
      if (item.question.includes(kw)) {
        score += 4;
      } else if (targetText.includes(kw)) {
        score += 2;
      }
    }

    return { item, score };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime();
    })
    .slice(0, maxResults)
    .map((entry) => entry.item);
}

/**
 * 등록된 법령에서 질문과 관련된 조문 단락 및 구조화된 Citation 목록을 추출합니다.
 */
export function findMatchingCitations(
  question: string,
  category: CategoryType,
  laws: LawItem[]
): { citations: ReferenceCitation[]; lawSnippets: string[] } {
  const keywords = extractKeywords(question);
  const citations: ReferenceCitation[] = [];
  const lawSnippets: string[] = [];

  const categoryKeywordMap: Record<CategoryType, string[]> = {
    임용: ['신규채용', '시보', '전보', '필수보직기간', '임용'],
    승진: ['승진', '승진소요최저연수', '승진임용', '제한', '육아휴직'],
    징계: ['징계', '감봉', '정직', '강등', '견책', '파면', '해임'],
    교육훈련: ['교육훈련', '필요교육훈련시간', '상시학습', '자기개발'],
    '휴가·복무': ['연가', '병가', '공가', '특별휴가', '진단서', '출산휴가', '난임치료'],
    기타: ['휴직', '복무', '보수'],
  };

  const searchTerms = Array.from(
    new Set([...keywords, ...(categoryKeywordMap[category] || [])])
  );

  for (const law of laws) {
    const lines = law.text.split('\n');
    let currentArticleTitle = '';
    let currentArticleText: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const articleMatch = line.match(/^제\d+조(?:의\d+)?\([^)]+\)|^제\d+조(?:의\d+)?/);

      if (articleMatch) {
        if (currentArticleTitle && currentArticleText.length > 0) {
          const joined = currentArticleText.join(' ');
          let matchScore = 0;
          for (const term of searchTerms) {
            if (joined.includes(term)) matchScore++;
          }
          if (matchScore > 0) {
            const articleLabel = currentArticleTitle.split('\n')[0].trim();
            citations.push({
              id: `cit-${law.id}-${citations.length + 1}`,
              lawTitle: law.title,
              articleLabel,
              fullCitation: `${law.title} ${articleLabel}`,
              matchedText: joined.slice(0, 300),
              lawId: law.id,
            });
            lawSnippets.push(`[${law.title} ${articleLabel}]\n${joined.slice(0, 400)}`);
          }
        }
        currentArticleTitle = line.trim();
        currentArticleText = [line];
      } else if (currentArticleTitle) {
        currentArticleText.push(line);
      }
    }

    // 마지막 조문 검사
    if (currentArticleTitle && currentArticleText.length > 0) {
      const joined = currentArticleText.join(' ');
      let matchScore = 0;
      for (const term of searchTerms) {
        if (joined.includes(term)) matchScore++;
      }
      if (matchScore > 0) {
        const articleLabel = currentArticleTitle.split('\n')[0].trim();
        citations.push({
          id: `cit-${law.id}-${citations.length + 1}`,
          lawTitle: law.title,
          articleLabel,
          fullCitation: `${law.title} ${articleLabel}`,
          matchedText: joined.slice(0, 300),
          lawId: law.id,
        });
        lawSnippets.push(`[${law.title} ${articleLabel}]\n${joined.slice(0, 400)}`);
      }
    }
  }

  return { citations: citations.slice(0, 4), lawSnippets: lawSnippets.slice(0, 3) };
}

/**
 * AI 답변 초안 생성 (법령 조문 대조 및 하이라이트 링크용 Citation 메타데이터 포함)
 */
export async function generateAnswer(
  question: string,
  category: CategoryType,
  lawTexts: LawItem[],
  pastCases: CaseItem[]
): Promise<GenerateAnswerResult> {
  // Gemini API 연동 시 이 부분을 교체하세요
  // TODO: 실제 Gemini API 호출로 교체
  // lawTexts: 업로드된 법령 객체 배열 (버전 관리 및 최신 텍스트 포함)
  // pastCases: 유사 과거 사례 배열

  const { citations, lawSnippets } = findMatchingCitations(
    question,
    category,
    lawTexts
  );

  const formattedLawSection =
    lawTexts.length > 0
      ? lawTexts
          .map(
            (l, idx) =>
              `(${idx + 1}) [${l.title} (버전: ${l.currentVersion}, 시행: ${l.updatedAt.slice(0, 10)})]\n${l.text.slice(0, 1200)}`
          )
          .join('\n\n')
      : '(등록된 법령이 없습니다. 법령 관리 탭에서 PDF를 업로드하거나 자동 업데이트를 실행하세요.)';

  const formattedCaseSection =
    pastCases.length > 0
      ? pastCases
          .map(
            (c, idx) =>
              `[사례 ${idx + 1}] (${c.category})\n- 질문: ${c.question}\n- 답변: ${c.answer.slice(0, 300)}\n- 근거: ${c.references}`
          )
          .join('\n\n')
      : '(유사 과거 사례가 없습니다.)';

  const constructedPrompt = `당신은 대한민국 국가공무원 인사교육 법령 전문가입니다.
아래 법령 텍스트(최신 버전)와 과거 사례를 참고하여 질문에 답변해주세요.
답변에는 반드시 근거 조문(법령명, 조·항·호)을 인용하고, 사용자가 검증할 수 있도록 조문 명칭을 명시해주세요.

[출력 형식]
1. 답변 본문: [결론], [상세 검토], [실무 유의사항] 순서로 작성
2. 근거 조문: 관련 법령명 제○조 제○항 형식으로 명시

[법령 텍스트 (최신 버전)]
${formattedLawSection}

[과거 유사 사례]
${formattedCaseSection}

[질문]
- 분야: ${category}
- 질의 내용: ${question}`;

  // 시뮬레이션 지연 (750ms)
  await new Promise((resolve) => setTimeout(resolve, 750));

  const referenceString =
    citations.length > 0
      ? citations.map((c) => c.fullCitation).join(', ')
      : pastCases.length > 0
        ? pastCases[0].references
        : '국가공무원법 및 공무원임용령 관련 조문';

  const snippetsFormatted =
    lawSnippets.length > 0
      ? lawSnippets.map((s, i) => `${i + 1}. ${s}`).join('\n\n')
      : '1. 등록된 법령 중 질의 키워드와 직접 매칭되는 조문을 확인하시기 바랍니다.';

  const pastCaseRefSummary =
    pastCases.length > 0
      ? `\n\n[과거 유사 사례 처리 기준 참고]\n- "${pastCases[0].question.slice(0, 50)}..." 건의 해석 기준(${pastCases[0].references})과 법령 일관성을 유지할 수 있습니다.`
      : '';

  const draftAnswer = `[결론]
질의하신 [${category}] 분야 "${question.slice(0, 45)}${question.length > 45 ? '...' : ''}" 건에 대하여 현행 최신 법령(${referenceString})을 검토한 결과입니다.

[상세 법령 검토]
${snippetsFormatted}${pastCaseRefSummary}

[실무 유의사항]
1. 인사발령 및 복무 승인 시 대상자의 실제 재직기간 및 부칙 경과규정 적용 여부를 최종 점검하시기 바랍니다.
2. 아래 [참고 법령 조문] 카드의 "법령 원문 검증" 버튼을 클릭하여 실제 법령 텍스트의 조항 위치와 하이라이트 내용을 즉시 확인하실 수 있습니다.`;

  return {
    answer: draftAnswer,
    references: referenceString,
    citations,
    constructedPrompt,
  };
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).generateAnswer = generateAnswer;
}
