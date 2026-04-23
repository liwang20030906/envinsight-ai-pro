import test from "node:test";
import assert from "node:assert/strict";
import { buildDataProfile } from "../src/shared/profiling";

test("buildDataProfile identifies regression-friendly datasets", () => {
  const records = [
    { pm25: 10, disease_rate: 1.0, city: "A" },
    { pm25: 20, disease_rate: 1.4, city: "B" },
    { pm25: 30, disease_rate: 2.0, city: "C" },
  ];

  const profile = buildDataProfile(records, ["pm25", "disease_rate", "city"]);

  assert.equal(profile.datasetShape, "regression");
  assert.ok(profile.recommendedModels.some((model) => model.id === "ols"));
  assert.ok(profile.columns.some((column) => column.name === "city" && column.type === "categorical"));
});

test("buildDataProfile identifies time-series datasets", () => {
  const records = [
    { date: "2026-01-01", pm25: 10 },
    { date: "2026-01-02", pm25: 12 },
    { date: "2026-01-03", pm25: 9 },
  ];

  const profile = buildDataProfile(records, ["date", "pm25"]);

  assert.equal(profile.datasetShape, "time-series");
  assert.ok(profile.recommendedModels.some((model) => model.id === "trend"));
});
