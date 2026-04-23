import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNewsItemFromOpenAlexWork,
  deriveCategory,
  matchesNewsFilters,
  reconstructAbstract,
} from "../src/shared/news";

test("reconstructAbstract rebuilds the abstract from OpenAlex index", () => {
  const abstract = reconstructAbstract({
    Exposure: [0],
    to: [1],
    "PM2.5": [2],
    increases: [3],
    risk: [4],
    ".": [5],
  });

  assert.equal(abstract, "Exposure to PM2.5 increases risk.");
});

test("deriveCategory maps water studies to 饮用水", () => {
  assert.equal(deriveCategory("Drinking water contamination and child health", null), "饮用水");
});

test("buildNewsItemFromOpenAlexWork transforms a real work shape into a news item", async () => {
  const item = await buildNewsItemFromOpenAlexWork({
    id: "https://openalex.org/W123",
    title: "PM2.5 exposure and respiratory admissions",
    publication_date: "2026-01-01",
    doi: "https://doi.org/10.1000/example",
    cited_by_count: 20,
    publication_year: 2026,
    open_access: {
      is_oa: true,
    },
    primary_location: {
      landing_page_url: "https://doi.org/10.1000/example",
      source: {
        display_name: "Environmental Health",
      },
    },
    authorships: [
      { author: { display_name: "Alice" } },
      { author: { display_name: "Bob" } },
    ],
    abstract_inverted_index: {
      This: [0],
      study: [1],
      examined: [2],
      "PM2.5": [3],
      exposure: [4],
      and: [5],
      respiratory: [6],
      admissions: [7],
      ".": [8],
    },
  });

  assert.ok(item);
  assert.equal(item?.sourceJournal, "Environmental Health");
  assert.equal(item?.authors?.[0], "Alice");
  assert.equal(item?.isOpenAccess, true);
  assert.equal(item?.publicationYear, 2026);
  assert.match(item?.title || "", /空气质量|健康|影响|风险|研究/);
  assert.notEqual(item?.title, item?.oneSentenceSummary);
  assert.ok(item?.paperTitle);
  assert.ok(item?.explainers?.plainLanguageSummary);
  assert.ok(item?.explainers?.publicCautions?.length);
  assert.ok(item?.explainers?.keyFindings.length);
});

test("matchesNewsFilters applies OA, citation and recency rules", () => {
  const item = {
    category: "空气质量",
    citedByCount: 40,
    publishDate: new Date().toISOString().slice(0, 10),
    isOpenAccess: true,
  };

  assert.equal(
    matchesNewsFilters(item, {
      category: "空气质量",
      openAccessOnly: true,
      minCitations: 25,
      publishedWithinDays: 365,
    }),
    true,
  );
  assert.equal(matchesNewsFilters({ ...item, isOpenAccess: false }, { openAccessOnly: true }), false);
  assert.equal(matchesNewsFilters({ ...item, citedByCount: 5 }, { minCitations: 25 }), false);
});
