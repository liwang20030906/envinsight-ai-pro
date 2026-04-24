import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAnalysisHistory, formatHistoryShapeLabel } from '../src/shared/history';
import type { AnalysisHistoryEntry } from '../src/types';

const baseEntry: AnalysisHistoryEntry = {
  id: 'history-1',
  title: 'PM2.5 与住院风险',
  headline: 'PM2.5 升高可能伴随呼吸系统住院风险上升',
  sourceLabel: 'pm25.csv',
  createdAt: '2026-04-24T00:00:00.000Z',
  updatedAt: '2026-04-24T00:00:00.000Z',
  datasetShape: 'regression',
  bestModelName: 'OLS 回归',
  hasReport: true,
  hasPaperDraft: false,
  hasCollaboration: false,
  snapshot: {
    aiResponse: 'demo',
    fileName: 'pm25.csv',
    importedLead: null,
    report: null,
    paperDraft: null,
    result: {
      summary: {
        coefficients: { intercept: 0, pm25: 0.1 },
        rSquared: 0.8,
        pValue: 0.01,
        pValueMethod: 'student-t',
        n: 20,
      },
      data: [{ x: 1, y: 2 }],
      columns: { x: 'pm25', y: 'admissions' },
    },
  },
};

test('filterAnalysisHistory filters by query and dataset shape', () => {
  const entries: AnalysisHistoryEntry[] = [
    baseEntry,
    {
      ...baseEntry,
      id: 'history-2',
      title: '高温与门诊量',
      headline: '极端高温可能推高门诊量',
      sourceLabel: 'heatwave.csv',
      datasetShape: 'time-series',
      bestModelName: '时间序列趋势模型',
      snapshot: {
        ...baseEntry.snapshot,
        fileName: 'heatwave.csv',
        result: {
          ...baseEntry.snapshot.result,
          columns: { x: 'temperature', y: 'outpatient_visits' },
        },
      },
    },
  ];

  assert.equal(filterAnalysisHistory(entries, 'PM2.5', 'all').length, 1);
  assert.equal(filterAnalysisHistory(entries, '', 'time-series').length, 1);
  assert.equal(filterAnalysisHistory(entries, '时间序列', 'time-series').length, 1);
});

test('formatHistoryShapeLabel returns readable Chinese labels', () => {
  assert.equal(formatHistoryShapeLabel('regression'), '回归');
  assert.equal(formatHistoryShapeLabel('classification'), '分类');
  assert.equal(formatHistoryShapeLabel('time-series'), '时间序列');
  assert.equal(formatHistoryShapeLabel('mixed'), '混合');
  assert.equal(formatHistoryShapeLabel(undefined), '未识别');
});
