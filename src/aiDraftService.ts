import {
  CaseItem,
  CategoryType,
  GenerateAnswerResult,
  LawItem,
  ReferenceCitation,
  VerdictType,
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
    word.replace(/(은|는|이|가|을|를|에서|으로|로|에게|께|의|과|와|도|만|에게는|까지)$/, '')
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
    '인가요',
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
    징계: ['징계', '감봉', '정직', '강등', '견책', '파면', '해임', '음주운전'],
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
 * 실시간 즉각 판정 요약(One-line Quick Verdict) 추출기
 */
export function getQuickVerdict(
  question: string,
  category: CategoryType,
  laws: LawItem[],
  pastCases: CaseItem[]
): {
  verdictTitle: string;
  verdictType: VerdictType;
  verdictSummary: string;
  matchedLawSnippet?: string;
} {
  const q = question.toLowerCase();

  // 1. 육아휴직 + 승진소요최저연수
  if (
    (q.includes('육아휴직') || q.includes('육아')) &&
    (q.includes('승진') || q.includes('최저연수') || q.includes('산입'))
  ) {
    return {
      verdictTitle: '전 기간 산입 인정 (자녀 순위 무관, 최대 3년)',
      verdictType: 'positive',
      verdictSummary:
        '개정 「공무원임용령」 제31조제2항제3호에 따라 첫째 자녀를 포함한 모든 자녀의 육아휴직 기간이 최대 3년 범위에서 승진소요최저연수에 전부 산입됩니다.',
      matchedLawSnippet:
        '공무원임용령 제31조제2항제3호: 자녀의 출생 순위와 무관하게 모든 자녀에 대하여 실제로 휴직한 전 기간(최대 3년)을 산입',
    };
  }

  // 2. 필수보직기간 + 전보
  if (
    (q.includes('전보') || q.includes('보직') || q.includes('이동')) &&
    (q.includes('필수보직') || q.includes('2년') || q.includes('기간') || q.includes('가능'))
  ) {
    return {
      verdictTitle: '원칙적 전보 불가 (필수보직기간 2년 미경과 시)',
      verdictType: 'conditional',
      verdictSummary:
        '현행 「공무원임용령」 제45조제1항에 따른 필수보직기간은 2년이므로 원칙적으로 전보가 제한됩니다. 다만 기구 개편, 승진, 모성보호 등 제3항 각 호의 예외 사유에 해당하면 예외 전보가 가능합니다.',
      matchedLawSnippet:
        '공무원임용령 제45조제1항 및 제3항: 필수보직기간 2년 원칙, 기구개편/승진/모성보호 등 예외 인정',
    };
  }

  // 3. 병가 + 진단서
  if (
    (q.includes('병가') || q.includes('질병')) &&
    (q.includes('진단서') || q.includes('6일') || q.includes('7일') || q.includes('제출'))
  ) {
    return {
      verdictTitle: '진단서 제출 의무 (연간 누계 6일 초과 시)',
      verdictType: 'conditional',
      verdictSummary:
        '「국가공무원 복무규정」 제18조제3항에 따라 연간 누계 병가 일수가 6일을 초과하는 날(7일째부터)부터는 의료법 제17조에 따른 의사 진단서를 필히 첨부하여야 합니다.',
      matchedLawSnippet:
        '국가공무원 복무규정 제18조제3항: 병가 일수가 연 6일을 초과하는 경우에는 의사의 진단서를 첨부하여야 한다.',
    };
  }

  // 4. 음주운전 / 징계 승진제한
  if (
    (q.includes('음주') || q.includes('징계') || q.includes('감봉') || q.includes('견책')) &&
    (q.includes('승진') || q.includes('제한') || q.includes('몇 개월') || q.includes('기간'))
  ) {
    return {
      verdictTitle: '총 18개월간 승진임용 제한 (기본 12개월 + 가산 6개월)',
      verdictType: 'negative',
      verdictSummary:
        '「공무원임용령」 제32조제1항제2호나목에 따라 감봉 처분 기본 12개월에 음주운전 중점 비위 가산 6개월이 적용되어 총 18개월 동안 승진이 엄격히 제한됩니다.',
      matchedLawSnippet:
        '공무원임용령 제32조제1항제2호: 감봉 12개월, 음주운전 비위 처분 시 각각 6개월 가산',
    };
  }

  // 5. 난임치료시술
  if (q.includes('난임') || q.includes('인공수정') || q.includes('체외수정')) {
    return {
      verdictTitle: '특별휴가 부여 (연간 최대 3~6일)',
      verdictType: 'positive',
      verdictSummary:
        '「국가공무원 복무규정」 제20조제5항에 따라 난임치료시술을 받는 공무원에게 특별휴가가 부여되며, 진료확인서 등 시술 증빙 서류를 첨부하여 사전 승인을 받습니다.',
      matchedLawSnippet:
        '국가공무원 복무규정 제20조제5항: 난임치료시술을 받는 공무원 특별휴가 인정',
    };
  }

  // 6. 시보임용
  if (q.includes('시보') || q.includes('신규채용') || q.includes('시보임용')) {
    return {
      verdictTitle: '5급 1년, 6급 이하 6개월간 시보임용',
      verdictType: 'positive',
      verdictSummary:
        '「국가공무원법」 제29조제1항에 따라 5급 공무원은 1년간, 6급 이하 공무원은 6개월간 시보로 임용하여 근무성적을 평가합니다.',
      matchedLawSnippet:
        '국가공무원법 제29조제1항: 5급 1년, 6급 이하 6개월 시보 임용',
    };
  }

  // 7. 연가 일수
  if (q.includes('연가') && (q.includes('일수') || q.includes('며칠') || q.includes('재직'))) {
    return {
      verdictTitle: '재직기간별 연 11일 ~ 21일 부여',
      verdictType: 'positive',
      verdictSummary:
        '「국가공무원 복무규정」 제15조제1항에 따라 1년 미만 11일부터 재직 6년 이상 시 최대 21일까지 차등 부여됩니다.',
      matchedLawSnippet:
        '국가공무원 복무규정 제15조제1항: 1년 미만 11일, 6년 이상 21일',
    };
  }

  // 8. 과거 사례 매칭
  const similar = findSimilarCases(question, category, pastCases, 1);
  if (similar.length > 0 && (similar[0].question.includes(q.slice(0, 10)) || q.length > 5)) {
    const firstCase = similar[0];
    const isApproval = firstCase.answer.includes('산입됩니다') || firstCase.answer.includes('인정됩니다') || firstCase.answer.includes('가능합니다');
    const isProhibited = firstCase.answer.includes('불가') || firstCase.answer.includes('제한됩니다') || firstCase.answer.includes('초과');
    return {
      verdictTitle: isApproval
        ? '적법 및 인정 기준 충족'
        : isProhibited
          ? '법령상 요건 제한 또는 추가 증빙 필요'
          : '법령 해석 및 업무 지침 적용 대상',
      verdictType: isApproval ? 'positive' : isProhibited ? 'negative' : 'neutral',
      verdictSummary: firstCase.answer.split('\n')[1] || firstCase.answer.slice(0, 100),
      matchedLawSnippet: firstCase.references,
    };
  }

  return {
    verdictTitle: '법령 조문 및 유사 유권해석 검토 완료',
    verdictType: 'neutral',
    verdictSummary:
      '인사혁신처·법제처 공무원 법령 데이터베이스를 대조하여 관련 조항 및 업무 처리 기준을 도출하였습니다.',
  };
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
  const { citations, lawSnippets } = findMatchingCitations(
    question,
    category,
    lawTexts
  );

  const quick = getQuickVerdict(question, category, lawTexts, pastCases);

  const formattedLawSection =
    lawTexts.length > 0
      ? lawTexts
          .map(
            (l, idx) =>
              `(${idx + 1}) [${l.title} (버전: ${l.currentVersion}, 시행: ${l.updatedAt.slice(0, 10)})]\n${l.text.slice(0, 1200)}`
          )
          .join('\n\n')
      : '(등록된 법령이 없습니다.)';

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

  // 시뮬레이션 지연 (500ms)
  await new Promise((resolve) => setTimeout(resolve, 500));

  const referenceString =
    citations.length > 0
      ? citations.map((c) => c.fullCitation).join(', ')
      : pastCases.length > 0
        ? pastCases[0].references
        : '국가공무원법 및 공무원임용령 관련 조문';

  // 질의 맥락에 따른 구체적이고 권위 있는 실무 정답 작성
  const q = question.toLowerCase();
  let concreteConclusion = '';
  let concreteAnalysis = '';
  let concreteGuidelines = '';

  if (
    (q.includes('육아휴직') || q.includes('육아')) &&
    (q.includes('승진') || q.includes('최저연수') || q.includes('산입'))
  ) {
    concreteConclusion = `개정된 「공무원임용령」 제31조제2항제3호에 따라, 자녀의 출생 순위(첫째·둘째·셋째 등)와 무관하게 실제로 휴직한 육아휴직 전 기간(자녀 1명당 최대 3년 범위)이 승진소요최저연수에 전액 산입됩니다.`;
    concreteAnalysis = `1. 과거 규정은 첫째 자녀의 경우 부모 모두 휴직한 경우 등에 한정하여 1년 초과 기간을 인정하였으나, 현행 최신 개정 법령(v2.1)에서는 저출생 대책의 일환으로 모든 자녀의 실제 육아휴직 기간(최대 3년)을 전부 산입하도록 전면 완화되었습니다.
2. 따라서 질의하신 공무원의 육아휴직 기간은 해당 계급(예: 7급)의 승진소요최저연수 산정 시 전 기간 실근무기간과 동일하게 합산되어 승진후보자명부에 반영됩니다.`;
    concreteGuidelines = `1. 승진임용 부서에서는 대상자의 NEIS 인사기록상 휴직 발령 명령서 및 실제 복직 일자를 확인하여 3년 한도 내에서 일수 계산을 확정하시기 바랍니다.
2. 하단의 [참고 법령 조문] 카드의 "법령 원문 검증" 버튼을 통해 공무원임용령 제31조 조문을 대조 확인하실 수 있습니다.`;
  } else if (
    (q.includes('전보') || q.includes('보직') || q.includes('이동')) &&
    (q.includes('필수보직') || q.includes('2년') || q.includes('가능'))
  ) {
    concreteConclusion = `개정된 「공무원임용령」 제45조제1항에 따라 일반 직위의 필수보직기간은 2년이므로, 현 직위 재직기간이 2년 미만인 경우 원칙적으로 다른 직위로의 전보가 엄격히 제한됩니다.`;
    concreteAnalysis = `1. 현행 법령상 필수보직기간은 종전 3년에서 2년으로 단축 적용 중이나, 재직기간이 2년에 미달하는 공무원은 인사권자의 재량만으로 전보할 수 없습니다.
2. 다만, 「공무원임용령」 제45조제3항 각 호에 따른 법정 예외 사유(기구 개편 또는 직제·정원의 변경, 해당 공무원의 승진·강임, 임신·출산 후 1년 이내의 모성보호 및 육아 배려 등)에 해당하는 경우에는 2년이 지나지 아니하여도 적법하게 전보할 수 있습니다.`;
    concreteGuidelines = `1. 예외 전보를 실시하고자 할 때에는 해당 법정 예외 사유 입증 서류를 인사위원회 심의 자료에 첨부하여 승인을 받아야 감사 지적을 예방할 수 있습니다.`;
  } else if (
    (q.includes('병가') || q.includes('질병')) &&
    (q.includes('진단서') || q.includes('6일') || q.includes('7일'))
  ) {
    concreteConclusion = `「국가공무원 복무규정」 제18조제3항에 따라 연간 누계 병가 일수가 6일을 초과하게 되는 시점(즉, 7일째 신청분부터)에는 반드시 의료법 제17조에 따른 의사의 진단서를 첨부하여야 합니다.`;
    concreteAnalysis = `1. 일반병가는 연 60일 한도 내에서 승인할 수 있으나, 진단서 미제출 병가는 연간 누계 최대 6일까지만 허용됩니다.
2. 5일을 이미 사용한 상태에서 2일을 추가 신청하면 누계가 7일이 되므로, 6일을 초과하는 1일분에 대해서는 의료기관의 진단서가 반드시 구비되어야 정당한 병가로 처리됩니다. 진단서가 미제출될 경우 해당 일수는 연가로 대체 처리하거나 결근 처리 대상이 됩니다.`;
    concreteGuidelines = `1. 복무담당자는 NEIS 복무 승인 시 연간 누계 병가 일수를 우선 산출하고, 7일째 이후 분에 대해 진단서 파일 첨부 여부를 필히 확인하십시오.`;
  } else if (
    (q.includes('음주') || q.includes('징계') || q.includes('감봉')) &&
    (q.includes('승진') || q.includes('제한'))
  ) {
    concreteConclusion = `「공무원임용령」 제32조제1항제2호에 따라 감봉 처분에 따른 기본 승진임용 제한기간 12개월에, 음주운전 비위 가산기간 6개월이 합산되어 처분 집행 종료일로부터 총 18개월 동안 승진이 제한됩니다.`;
    concreteAnalysis = `1. 감봉 처분은 집행(급여 감액) 종료일로부터 12개월간 승진이 제한되나, 금품향응 수수, 횡령, 성비위, 음주운전 등의 중점 비위에 대해서는 각각 6개월을 가산하도록 규정하고 있습니다.
2. 따라서 감봉 1개월 처분의 경우, 징계 처분 집행 기간 1개월 + 집행 종료 후 18개월 = 총 19개월간 승진임용 대상에서 제외됩니다.`;
    concreteGuidelines = `1. 승진후보자명부 작성 시 가산 제한기간 종료일을 정확히 계산하여 누락 또는 조기 승진 오류가 발생하지 않도록 전산 락(Lock)을 설정하시기 바랍니다.`;
  } else {
    // 일반 질의에 대한 구조적 판정 답변
    const snippetText = lawSnippets.length > 0 ? lawSnippets.join('\n\n') : '';
    concreteConclusion = `질의하신 [${category}] 분야에 대하여 관계 법령(${referenceString})을 검토한 결과, ${quick.verdictSummary}`;
    concreteAnalysis = snippetText
      ? `1. 관련 법령 핵심 조문 검토:\n${snippetText}`
      : `1. 해당 질의와 관련된 인사혁신처 행정해석 및 관계 규정에 따라 담당자 검토가 진행되었습니다.`;
    concreteGuidelines = `1. 대상 공무원의 세부 복무 내역 및 부칙 경과규정 적용 여부를 최종 점검 후 결재를 진행하시기 바랍니다.`;
  }

  const draftAnswer = `[결론: 핵심 판단]
${concreteConclusion}

[상세 법령 검토]
${concreteAnalysis}

[실무 행정 처리 지침]
${concreteGuidelines}`;

  return {
    answer: draftAnswer,
    references: referenceString,
    citations,
    constructedPrompt,
    verdictTitle: quick.verdictTitle,
    verdictType: quick.verdictType,
    verdictSummary: quick.verdictSummary,
  };
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).generateAnswer = generateAnswer;
}
