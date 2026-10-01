export interface ExtractedPdfResult {
  text: string;
  pageCount: number;
  suggestedTitle: string;
}

interface PdfJsPage {
  getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
}

interface PdfJsDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
}

interface PdfJsLib {
  getDocument: (params: { data: ArrayBuffer }) => { promise: Promise<PdfJsDocument> };
}

/**
 * PDF.js (CDN)를 사용하여 업로드된 PDF 파일에서 전체 텍스트와 페이지 수를 추출합니다.
 */
export async function extractTextFromPdfFile(
  file: File,
  onProgress?: (currentPage: number, totalPages: number) => void
): Promise<ExtractedPdfResult> {
  const suggestedTitle = file.name.replace(/\.pdf$/i, '').trim();
  const arrayBuffer = await file.arrayBuffer();

  const pdfjsLib = (window as unknown as { pdfjsLib?: PdfJsLib }).pdfjsLib;
  if (!pdfjsLib) {
    throw new Error('PDF.js 라이브러리를 불러오지 못했습니다. 네트워크 연결을 확인해주세요.');
  }

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    if (onProgress) {
      onProgress(pageNum, numPages);
    }
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageStr = textContent.items
      .map((item) => item.str || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (pageStr) {
      pageTexts.push(`[${pageNum}페이지]\n${pageStr}`);
    }
  }

  const fullText =
    pageTexts.length > 0
      ? pageTexts.join('\n\n')
      : '[알림: 스캔 이미지 기반 PDF이거나 텍스트 레이어가 없는 문서입니다.]';

  return {
    text: fullText,
    pageCount: numPages,
    suggestedTitle,
  };
}
