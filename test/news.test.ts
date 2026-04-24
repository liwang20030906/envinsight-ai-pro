import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNewsItemFromOpenAlexWork,
  dedupeNewsItems,
  deriveCategory,
  formatCoreConclusionTitle,
  getNewsIdentityKey,
  matchesNewsFilters,
  parseGoogleScholarResults,
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

test("parseGoogleScholarResults extracts real paper candidates from Scholar HTML", () => {
  const results = parseGoogleScholarResults(`
    <div class="gs_ri">
      <h3 class="gs_rt"><a href="https://example.org/paper">PM2.5 exposure and respiratory admissions</a></h3>
      <div class="gs_a">A Researcher, B Author - Environmental Health, 2025</div>
      <div class="gs_rs">This cohort study examined air pollution and hospital admissions.</div>
    </div>
  `);

  assert.equal(results.length, 1);
  assert.equal(results[0].title, "PM2.5 exposure and respiratory admissions");
  assert.equal(results[0].link, "https://example.org/paper");
  assert.equal(results[0].year, 2025);
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
  assert.equal(item?.discoverySource, "openalex");
  assert.match(item?.title || "", /空气质量|健康风险|PM2\.5|呼吸系统/);
  assert.notEqual(item?.title, item?.oneSentenceSummary);
  assert.ok(item?.paperTitle);
  assert.ok(item?.explainers?.plainLanguageSummary);
  assert.ok(item?.explainers?.publicCautions?.length);
  assert.ok(item?.explainers?.keyFindings.length);
  assert.doesNotMatch(item?.title || "", /研究|提示|大白话|发表于|空气质量变化可能影响健康风险/);
});



test("buildNewsItemFromOpenAlexWork produces concrete method-style titles for assessment papers", async () => {
  const item = await buildNewsItemFromOpenAlexWork({
    id: "https://openalex.org/W456",
    title: "Water Quality Assessment in the Northern Part of the Romanian Black Sea Coastal Area Using an Integrated Index",
    publication_date: "2026-01-01",
    doi: "https://doi.org/10.1000/water-example",
    cited_by_count: 8,
    publication_year: 2026,
    open_access: {
      is_oa: true,
    },
    primary_location: {
      landing_page_url: "https://doi.org/10.1000/water-example",
      source: {
        display_name: "Applied Sciences",
      },
    },
    authorships: [{ author: { display_name: "Alice" } }],
    abstract_inverted_index: {
      This: [0],
      study: [1],
      proposes: [2],
      an: [3],
      integrated: [4],
      water: [5],
      quality: [6],
      index: [7],
      for: [8],
      bathing: [9],
      safety: [10],
      assessment: [11],
      across: [12],
      2022: [13],
      2024: [14],
      scenarios: [15],
      '.': [16],
    },
  });

  assert.ok(item);
  assert.match(item?.title || "", /评估方法|监测|预警|水质变化/);
  assert.doesNotMatch(item?.title || "", /健康风险有关|饮用水变化可能/);
  assert.match(item?.paperTitle || "", /水质评估|研究/);
});

test("dedupeNewsItems merges the same paper even when sourceLink changes", () => {
  const items = dedupeNewsItems([
    {
      id: "https://openalex.org/W123",
      title: "PM2.5 升高可能伴随呼吸风险上升",
      paperTitle: "空气污染与呼吸系统就诊",
      sourceJournal: "Environmental Health",
      sourceLink: "https://example.com/paper-a",
      publishDate: "2026-01-01",
      doi: null,
    },
    {
      id: "https://openalex.org/W123",
      title: "PM2.5 升高可能伴随呼吸风险上升",
      paperTitle: "空气污染与呼吸系统就诊",
      sourceJournal: "Environmental Health",
      sourceLink: "https://doi.org/10.1000/example",
      publishDate: "2026-01-01",
      doi: "https://doi.org/10.1000/example",
    },
  ]);

  assert.equal(items.length, 1);
  assert.match(getNewsIdentityKey(items[0]), /doi:|openalex:/);
});

test("formatCoreConclusionTitle strips framing words and keeps only the conclusion", () => {
  assert.equal(
    formatCoreConclusionTitle(
      "这篇发表于Environmental Health的研究用大白话来说是：空气质量变化，可能会影响真实健康或暴露结果。",
      "空气质量变化可能影响健康风险",
    ),
    "空气质量变化可能影响健康风险",
  );
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
