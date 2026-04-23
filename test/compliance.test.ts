import test from "node:test";
import assert from "node:assert/strict";
import { reviewCompliance } from "../src/shared/compliance";

test("reviewCompliance blocks direct identifiers", () => {
  const review = reviewCompliance(
    ["name", "email", "pm25", "disease_rate"],
    [{ name: "Alice", email: "alice@example.com", pm25: 10, disease_rate: 1.2 }],
  );

  assert.equal(review.status, "blocked");
  assert.equal(review.riskLevel, "high");
  assert.ok(review.findings.some((finding) => finding.field === "email"));
});

test("reviewCompliance warns on copyright-sensitive text columns", () => {
  const review = reviewCompliance(
    ["abstract", "pm25", "disease_rate"],
    [{ abstract: "long text", pm25: 12, disease_rate: 1.3 }],
  );

  assert.equal(review.status, "warning");
  assert.ok(review.suggestions.some((item) => item.includes("开放获取许可") || item.includes("版权")));
});

test("reviewCompliance does not mistake ISO dates for phone numbers", () => {
  const review = reviewCompliance(
    ["date", "pm25", "clinic_visits"],
    [
      { date: "2026-01-01", pm25: 20, clinic_visits: 12 },
      { date: "2026-01-02", pm25: 24, clinic_visits: 13 },
    ],
  );

  assert.equal(review.status, "passed");
});
