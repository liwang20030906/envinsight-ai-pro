import type { AnalysisHistoryEntry } from '../types';

export type AnalysisHistoryShapeFilter = 'all' | 'regression' | 'classification' | 'time-series' | 'mixed';

export function filterAnalysisHistory(
  entries: AnalysisHistoryEntry[],
  query: string,
  shapeFilter: AnalysisHistoryShapeFilter,
): AnalysisHistoryEntry[] {
  const normalizedQuery = query.trim().toLowerCase();

  return entries.filter((entry) => {
    if (shapeFilter !== 'all' && entry.datasetShape !== shapeFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      entry.title,
      entry.headline,
      entry.bestModelName || '',
      entry.sourceLabel,
      entry.snapshot.importedLead?.title || '',
      entry.snapshot.result.columns.x,
      entry.snapshot.result.columns.y,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function formatHistoryShapeLabel(shape?: AnalysisHistoryEntry['datasetShape']): string {
  if (shape === 'regression') return '回归';
  if (shape === 'classification') return '分类';
  if (shape === 'time-series') return '时间序列';
  if (shape === 'mixed') return '混合';
  return '未识别';
}
