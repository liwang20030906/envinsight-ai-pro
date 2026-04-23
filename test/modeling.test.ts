import test from "node:test";
import assert from "node:assert/strict";
import { buildModelComparison, pickRegressionViewData } from "../src/shared/modeling";
import { buildDataProfile } from "../src/shared/profiling";

test("buildModelComparison recommends regression models for numeric datasets", () => {
  const records = [
    { exposure: 10, outcome: 1.0, covar: 5 },
    { exposure: 20, outcome: 1.5, covar: 4 },
    { exposure: 30, outcome: 2.1, covar: 6 },
    { exposure: 40, outcome: 2.7, covar: 7 },
    { exposure: 50, outcome: 3.2, covar: 8 },
    { exposure: 60, outcome: 3.9, covar: 9 },
  ];

  const profile = buildDataProfile(records, ["exposure", "outcome", "covar"]);
  const comparison = buildModelComparison(records, profile);

  assert.equal(comparison.datasetShape, "regression");
  assert.ok(comparison.runs.length >= 3);
  assert.ok(comparison.bestModelName.length > 0);
});

test("buildModelComparison recommends classification models for binary targets", () => {
  const records = [
    { biomarker: 1.2, admitted: 0 },
    { biomarker: 1.4, admitted: 0 },
    { biomarker: 2.3, admitted: 1 },
    { biomarker: 2.6, admitted: 1 },
    { biomarker: 2.9, admitted: 1 },
  ];

  const profile = buildDataProfile(records, ["biomarker", "admitted"]);
  const comparison = buildModelComparison(records, profile);

  assert.equal(comparison.datasetShape, "classification");
  assert.ok(comparison.runs.some((run) => run.id === "decision_stump"));
});

test("pickRegressionViewData uses recommended fields when available", () => {
  const records = [
    { exposure: 10, outcome: 1.0, extra: 2 },
    { exposure: 20, outcome: 1.5, extra: 3 },
    { exposure: 30, outcome: 2.1, extra: 4 },
    { exposure: 40, outcome: 2.7, extra: 5 },
    { exposure: 50, outcome: 3.2, extra: 6 },
  ];

  const profile = buildDataProfile(records, ["exposure", "outcome", "extra"]);
  const comparison = buildModelComparison(records, profile);
  const view = pickRegressionViewData(records, profile, comparison);

  assert.ok(view);
  assert.equal(view?.numericRows.length, 5);
});

test("buildModelComparison recommends time-series models for dated datasets", () => {
  const records = [
    { date: "2026-01-01", pm25: 22 },
    { date: "2026-01-02", pm25: 24 },
    { date: "2026-01-03", pm25: 27 },
    { date: "2026-01-04", pm25: 25 },
    { date: "2026-01-05", pm25: 30 },
    { date: "2026-01-06", pm25: 33 },
  ];

  const profile = buildDataProfile(records, ["date", "pm25"]);
  const comparison = buildModelComparison(records, profile);

  assert.equal(comparison.datasetShape, "time-series");
  assert.ok(comparison.runs.some((run) => run.id === "trend_regression"));
});
