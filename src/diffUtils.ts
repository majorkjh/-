export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffResult {
  lines: DiffLine[];
  additionsCount: number;
  deletionsCount: number;
  changedClauses: string[];
}

/**
 * 간단하고 신뢰할 수 있는 LCS(Longest Common Subsequence) 기반 라인 단위 텍스트 비교 알고리즘
 */
export function computeTextDiff(oldText: string, newText: string): DiffResult {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const oldLen = oldLines.length;
  const newLen = newLines.length;

  // 1000줄 이상의 대용량 텍스트의 경우 성능 최적화: 블록/문단 기반 분할
  const maxMatrixSize = 1500;
  if (oldLen > maxMatrixSize || newLen > maxMatrixSize) {
    return computeSimpleFastDiff(oldLines, newLines);
  }

  // 2D DP 테이블 생성
  const dp: number[][] = Array.from({ length: oldLen + 1 }, () =>
    new Array(newLen + 1).fill(0)
  );

  for (let i = 0; i < oldLen; i++) {
    for (let j = 0; j < newLen; j++) {
      if (oldLines[i].trim() === newLines[j].trim()) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // 백트래킹으로 Diff 라인 복원
  const diffLines: DiffLine[] = [];
  let i = oldLen;
  let j = newLen;
  let oldNum = oldLen;
  let newNum = newLen;

  const tempLines: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1].trim() === newLines[j - 1].trim()) {
      tempLines.push({
        type: 'unchanged',
        text: oldLines[i - 1],
        oldLineNumber: oldNum,
        newLineNumber: newNum,
      });
      i--;
      j--;
      oldNum--;
      newNum--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tempLines.push({
        type: 'added',
        text: newLines[j - 1],
        newLineNumber: newNum,
      });
      j--;
      newNum--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      tempLines.push({
        type: 'removed',
        text: oldLines[i - 1],
        oldLineNumber: oldNum,
      });
      i--;
      oldNum--;
    }
  }

  tempLines.reverse();

  let additionsCount = 0;
  let deletionsCount = 0;
  const changedClausesSet = new Set<string>();

  for (const line of tempLines) {
    if (line.type === 'added') {
      additionsCount++;
      const match = line.text.match(/제\d+조(?:의\d+)?/);
      if (match) changedClausesSet.add(match[0]);
    } else if (line.type === 'removed') {
      deletionsCount++;
      const match = line.text.match(/제\d+조(?:의\d+)?/);
      if (match) changedClausesSet.add(match[0]);
    }
  }

  return {
    lines: tempLines,
    additionsCount,
    deletionsCount,
    changedClauses: Array.from(changedClausesSet),
  };
}

function computeSimpleFastDiff(oldLines: string[], newLines: string[]): DiffResult {
  const lines: DiffLine[] = [];
  let additionsCount = 0;
  let deletionsCount = 0;
  const changedClausesSet = new Set<string>();

  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let idx = 0; idx < maxLen; idx++) {
    const oldLine = oldLines[idx];
    const newLine = newLines[idx];

    if (oldLine === undefined) {
      lines.push({ type: 'added', text: newLine, newLineNumber: idx + 1 });
      additionsCount++;
    } else if (newLine === undefined) {
      lines.push({ type: 'removed', text: oldLine, oldLineNumber: idx + 1 });
      deletionsCount++;
    } else if (oldLine.trim() === newLine.trim()) {
      lines.push({
        type: 'unchanged',
        text: oldLine,
        oldLineNumber: idx + 1,
        newLineNumber: idx + 1,
      });
    } else {
      lines.push({ type: 'removed', text: oldLine, oldLineNumber: idx + 1 });
      lines.push({ type: 'added', text: newLine, newLineNumber: idx + 1 });
      deletionsCount++;
      additionsCount++;
      const match = (oldLine + newLine).match(/제\d+조(?:의\d+)?/);
      if (match) changedClausesSet.add(match[0]);
    }
  }

  return {
    lines,
    additionsCount,
    deletionsCount,
    changedClauses: Array.from(changedClausesSet),
  };
}
