import test from "node:test";
import assert from "node:assert/strict";
import { calculateRegressionSummary, twoTailedPValueFromTStatistic } from "../src/shared/statistics";

test("twoTailedPValueFromTStatistic returns 1 for zero t-statistic", () => {
  assert.equal(twoTailedPValueFromTStatistic(0, 8), 1);
});

test("twoTailedPValueFromTStatistic trends toward zero for large t-statistics", () => {
  const pValue = twoTailedPValueFromTStatistic(12, 10);
  assert.ok(pValue !== null);
  assert.ok(pValue! < 1e-6);
});

test("calculateRegressionSummary returns a real p-value for non-trivial data", () => {
  const summary = calculateRegressionSummary([
    [10, 1.0],
    [20, 1.4],
    [30, 2.1],
    [40, 2.6],
    [50, 3.1],
    [60, 3.8],
  ]);

  assert.equal(summary.n, 6);
  assert.equal(summary.pValueMethod, "student-t");
  assert.ok(summary.pValue !== null);
  assert.ok(summary.pValue! < 0.01);
  assert.ok(summary.rSquared > 0.9);
});

test("calculateRegressionSummary leaves p-value unavailable when too few rows exist", () => {
  const summary = calculateRegressionSummary([
    [10, 1],
    [20, 2],
  ]);

  assert.equal(summary.n, 2);
  assert.equal(summary.pValue, null);
  assert.equal(summary.pValueMethod, "unavailable");
});
