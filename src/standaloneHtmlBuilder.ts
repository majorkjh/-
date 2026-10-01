import { DataSchema } from './types';

/**
 * 단일 HTML 파일 내보내기 빌더
 */
export function buildStandaloneHtml(currentData: DataSchema): string {
  const serializedData = JSON.stringify(currentData, null, 2).replace(
    /<\/script>/gi,
    '<\\/script>'
  );

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>인사교육 법령 Q&A 도우미</title>
  <link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script>
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  </script>
  <style>
    :root {
      --primary: #9333ea;
      --primary-hover: #7e22ce;
      --bg: #f8fafc;
      --card: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --muted: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Pretendard Variable", -apple-system, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
    header { background: var(--card); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 20; }
    .header-inner { max-width: 1320px; margin: 0 auto; height: 60px; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; }
    .brand { font-size: 18px; font-weight: 700; color: var(--text); }
    .nav { display: flex; gap: 20px; }
    .nav-btn { background: none; border: none; font-size: 14px; font-weight: 600; color: var(--muted); cursor: pointer; padding: 18px 0; border-bottom: 2px solid transparent; }
    .nav-btn.active { color: var(--primary); border-bottom-color: var(--primary); }
    main { max-width: 1320px; margin: 0 auto; padding: 24px 20px; }
    .panel { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .btn { padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-outline { background: #fff; border-color: var(--border); color: var(--text); }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid var(--border); text-align: left; }
    th { background: #f8fafc; color: var(--muted); }
  </style>
</head>
<body>
  <header>
    <div class="header-inner">
      <div class="brand">인사교육 법령 Q&amp;A 도우미</div>
      <nav class="nav">
        <button class="nav-btn active" onclick="switchTab('qna')">질문-답변 작성</button>
        <button class="nav-btn" onclick="switchTab('cases')">사례 DB</button>
        <button class="nav-btn" onclick="switchTab('laws')">법령 관리</button>
      </nav>
      <div>
        <button class="btn btn-outline" onclick="exportCases()">사례 JSON 내보내기</button>
      </div>
    </div>
  </header>
  <main>
    <div class="panel">
      <h3>국가공무원 인사교육 법령 Q&amp;A 및 개정 법령 버전 관리 시스템</h3>
      <p style="font-size:13px; color:var(--muted); margin-top:4px;">
        법제처 및 인사혁신처 연계 법령 데이터와 사례 DB를 통합 관리합니다.
      </p>
    </div>
  </main>
  <script>
    const INITIAL_DATA = ${serializedData};
    function switchTab(t) { alert('탭 전환: ' + t); }
    function exportCases() {
      const blob = new Blob([JSON.stringify(INITIAL_DATA.cases, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '인사교육_사례DB.json';
      a.click();
    }
  </script>
</body>
</html>`;
}
