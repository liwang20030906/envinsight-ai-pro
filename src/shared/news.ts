import { buildLocalPaperNewsDigest, generatePaperNewsDigest } from "./ai";

export type RealNewsFetchOptions = {
  category: string;
  limit?: number;
  openAccessOnly?: boolean;
  minCitations?: number;
  publishedWithinDays?: number;
  sort?: "latest" | "cited";
};

type OpenAlexAuthor = {
  author?: {
    display_name?: string;
  };
};

type OpenAlexLocation = {
  landing_page_url?: string | null;
  pdf_url?: string | null;
  source?: {
    display_name?: string | null;
  } | null;
};

type OpenAlexWork = {
  id?: string;
  title?: string;
  publication_date?: string | null;
  publication_year?: number | null;
  doi?: string | null;
  cited_by_count?: number;
  primary_location?: OpenAlexLocation | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  authorships?: OpenAlexAuthor[];
  primary_topic?: {
    display_name?: string;
  } | null;
  open_access?: {
    is_oa?: boolean | null;
  } | null;
};

type GoogleScholarResult = {
  title: string;
  link: string;
  snippet: string;
  meta: string;
  year?: number;
};

type NewsSeed = {
  id: string;
  title: string;
  oneSentenceSummary: string;
  conceptImageUrl: string;
  plainTextContent: string;
  translatedAbstract: string;
  sourceLink: string;
  sourceJournal: string;
  paperTitle?: string;
  publishDate: string;
  category: string;
  likes: number;
  comments: Array<{ id: string; user: string; text: string; date: string }>;
  authors?: string[];
  citedByCount?: number;
  doi?: string | null;
  explainers?: {
    translatedTitle?: string;
    plainLanguageSummary?: string;
    whyItMatters: string;
    howStudyWorked: string;
    keyFindings: string[];
    limitations: string[];
    everydayMeaning: string;
    readerActions: string[];
    publicCautions?: string[];
  };
  isOpenAccess?: boolean;
  publicationYear?: number;
  discoverySource?: "google-scholar" | "openalex";
  scholarLink?: string;
};

type NewsIdentityShape = Pick<
  NewsSeed,
  "id" | "title" | "paperTitle" | "sourceLink" | "sourceJournal" | "publishDate" | "doi"
>;

const OPEN_ALEX_BASE = "https://api.openalex.org/works";
const GOOGLE_SCHOLAR_BASE = "https://scholar.google.com/scholar";
const DEFAULT_RECENT_DAYS = 365;
const DEFAULT_HIGH_CITATION_THRESHOLD = 25;

const CATEGORY_QUERY: Record<string, string> = {
  空气质量: "environmental health air pollution PM2.5 respiratory cardiovascular",
  气候变化: "environmental health climate change heatwave health",
  流行病学: "environmental health epidemiology exposure cohort health outcome",
  政策解读: "environmental health policy regulation public health",
  饮用水: "environmental health drinking water contamination health",
  全部: "environmental health pollution climate drinking water epidemiology",
};

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeIdentityText(value?: string | null): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^https?:\/\/openalex\.org\//, "")
    .replace(/[\s\-_:./]+/g, "");
}

function normalizeHeadlineText(value?: string | null): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[“”"'‘’]/g, "")
    .replace(/[，。！？；：、,.!?;:\-()[\]{}]/g, "")
    .replace(/\s+/g, "");
}

function trimConclusionTail(value: string): string {
  return value
    .replace(/，?(但|不过|仍需|仍应|还需|还应|需要继续|值得继续|建议继续).*/u, "")
    .replace(/[。！？；]+$/u, "")
    .trim();
}

const EXPOSURE_KEYWORDS: Array<[RegExp, string]> = [
  [/\bpm2\.?5\b/u, "PM2.5"],
  [/\bpm10\b/u, "PM10"],
  [/\bair pollution\b/u, "空气污染"],
  [/\bozone\b/u, "臭氧暴露"],
  [/\bnitrogen dioxide\b|\bno2\b/u, "二氧化氮暴露"],
  [/\bheatwave\b|\bextreme heat\b/u, "极端高温"],
  [/\btemperature\b/u, "气温变化"],
  [/\bclimate change\b|\bglobal warming\b/u, "气候变化"],
  [/\bdrinking water\b|\bwater contamination\b|\bgroundwater\b/u, "饮用水污染"],
  [/\bmicroplastic[s]?\b/u, "微塑料暴露"],
  [/\barsenic\b/u, "砷暴露"],
  [/\blead\b/u, "铅暴露"],
  [/\bnoise\b/u, "噪声暴露"],
  [/\bgreen space\b|\bgreenspace\b/u, "城市绿地"],
  [/\bwildfire smoke\b/u, "野火烟雾"],
  [/\bhumidity\b/u, "湿度变化"],
  [/\bcarbon tax\b/u, "碳税政策"],
];

const OUTCOME_KEYWORDS: Array<[RegExp, string]> = [
  [/\brespiratory\b.*\b(admission|hospitali[sz]ation|visit)s?\b/u, "呼吸系统就诊风险"],
  [/\bcardiovascular\b|\bheart\b/u, "心血管风险"],
  [/\bkidney\b|\brenal\b/u, "肾脏健康风险"],
  [/\bmental health\b|\bdepression\b|\banxiety\b/u, "心理健康风险"],
  [/\bcognitive\b|\bcognition\b/u, "认知表现"],
  [/\bsleep\b|\binsomnia\b/u, "睡眠质量"],
  [/\bcancer\b|\bcarcinoma\b/u, "癌症风险"],
  [/\basthma\b/u, "哮喘风险"],
  [/\bmortality\b|\bdeath\b/u, "死亡风险"],
  [/\bdiabetes\b/u, "糖尿病风险"],
  [/\bimmune\b|\binflammation\b/u, "免疫健康风险"],
  [/\bblood pressure\b|\bhypertension\b/u, "血压异常风险"],
  [/\bbirth\b|\bpreterm\b|\bprenatal\b/u, "出生结局风险"],
];

function pickKeywordLabel(source: string, dictionary: Array<[RegExp, string]>): string | null {
  for (const [pattern, label] of dictionary) {
    if (pattern.test(source)) {
      return label;
    }
  }
  return null;
}

function buildHeuristicPaperConclusion(title: string, category: string): string {
  const source = title.toLowerCase();
  const exposure = pickKeywordLabel(source, EXPOSURE_KEYWORDS);
  const outcome = pickKeywordLabel(source, OUTCOME_KEYWORDS);
  const risePattern = /\b(increase|higher|elevated|raise|worsen|risk)\b/u;
  const dropPattern = /\b(decrease|lower|reduc|improv|protect)\w*\b/u;

  if (exposure && outcome) {
    if (risePattern.test(source)) {
      return `${exposure}可能伴随${outcome}上升`;
    }
    if (dropPattern.test(source)) {
      return `${exposure}可能伴随${outcome}下降`;
    }
    return `${exposure}可能影响${outcome}`;
  }

  if (exposure) {
    return `${exposure}可能带来新的健康风险线索`;
  }

  if (outcome) {
    return `${outcome}可能受到环境因素影响`;
  }

  return `${category}变化可能影响健康风险`;
}

function isOverGenericConclusionTitle(title: string, category: string): boolean {
  const normalized = title.replace(/\s+/g, "");
  return (
    normalized === `${category}变化可能影响健康风险` ||
    /^(空气质量|气候变化|流行病学|政策解读|饮用水)变化可能影响健康风险$/u.test(normalized)
  );
}

export function formatCoreConclusionTitle(candidate: string, fallback: string): string {
  const cleaned = trimConclusionTail(
    candidate
      .trim()
      .replace(/^先说结论[:：]?/u, "")
      .replace(/^这篇发表于[^：:]{0,120}的研究用大白话来说是[:：]?/u, "")
      .replace(/^这篇发表于[^，。:：]{0,120}的研究想提醒大家[，,:：]?/u, "")
      .replace(/^这(项|篇)研究(发现|提示|显示|表明)[:：]?/u, "")
      .replace(/^(研究|结果)(发现|提示|显示|表明)[:：]?/u, "")
      .replace(/^(一句话结论|一句大白话|核心结论|大白话|通俗说法)[:：]?/u, "")
      .replace(/^(最新研究|研究速读|研究快讯)[:：]?/u, "")
      .replace(/^(后续分析|最新分析)(提示|显示)?[:：]?/u, "")
      .replace(/^(空气质量|气候变化|流行病学|政策解读|饮用水)后续分析提示[:：]?/u, "")
      .replace(/可能会/g, "可能")
      .replace(/真实健康或暴露结果/g, "健康风险")
      .replace(/，(?=可能)/g, "")
      .replace(/\s+/g, ""),
  );

  if (!cleaned || !/[\u4e00-\u9fa5]/u.test(cleaned)) {
    return fallback;
  }

  return cleaned;
}

function buildOpenAlexWorkKey(work: OpenAlexWork): string {
  const doi = normalizeIdentityText(work.doi);
  if (doi) {
    return `doi:${doi}`;
  }

  const openAlexId = normalizeIdentityText(work.id);
  if (openAlexId) {
    return `openalex:${openAlexId}`;
  }

  const title = normalizeHeadlineText(work.title);
  const date = normalizeIdentityText(work.publication_date);
  return `title:${title}|${date}`;
}

export function getNewsIdentityKey(item: NewsIdentityShape): string {
  const id = String(item.id || "");
  if (/^workbench_news_/u.test(id)) {
    return `workbench:${id}`;
  }

  if (/openalex\.org/u.test(id)) {
    return `openalex:${normalizeIdentityText(id)}`;
  }

  const doi = normalizeIdentityText(item.doi);
  if (doi) {
    return `doi:${doi}`;
  }

  const sourceLink = String(item.sourceLink || "");
  if (/openalex\.org|doi\.org/u.test(sourceLink)) {
    return `source:${normalizeIdentityText(sourceLink)}`;
  }

  const paperTitle = normalizeHeadlineText(item.paperTitle);
  const journal = normalizeHeadlineText(item.sourceJournal);
  if (paperTitle && journal) {
    return `paper:${paperTitle}|${journal}`;
  }

  if (paperTitle) {
    return `paper:${paperTitle}|${normalizeIdentityText(item.publishDate)}`;
  }

  const title = normalizeHeadlineText(item.title);
  if (title && id) {
    return `seed:${id}|${title}`;
  }
  if (title) {
    return `title:${title}|${normalizeIdentityText(item.publishDate)}`;
  }

  return `id:${id || sourceLink || "unknown"}`;
}

export function dedupeNewsItems<T extends NewsIdentityShape>(items: T[]): T[] {
  const merged = new Map<string, T>();
  for (const item of items) {
    const key = getNewsIdentityKey(item);
    if (!merged.has(key)) {
      merged.set(key, item);
    }
  }
  return [...merged.values()];
}

function normalizeFetchOptions(categoryOrOptions: string | RealNewsFetchOptions, limit = 8): Required<RealNewsFetchOptions> {
  const base = typeof categoryOrOptions === "string" ? { category: categoryOrOptions, limit } : categoryOrOptions;
  return {
    category: base.category || "全部",
    limit: Math.max(1, base.limit || limit || 8),
    openAccessOnly: Boolean(base.openAccessOnly),
    minCitations: Math.max(0, base.minCitations || 0),
    publishedWithinDays: Math.max(0, base.publishedWithinDays || 0),
    sort: base.sort === "cited" ? "cited" : "latest",
  };
}

function formatDateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

function stripHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function normalizeScholarTitle(value: string): string {
  return stripHtml(value)
    .replace(/^\[[A-Z]+\]\s*/u, "")
    .replace(/\s+-\s+Google Scholar$/u, "")
    .trim();
}

export function parseGoogleScholarResults(html: string): GoogleScholarResult[] {
  const results: GoogleScholarResult[] = [];
  const blocks = html.match(/<div class="gs_ri">[\s\S]*?(?=<div class="gs_ri">|<div id="gs_res_ccl_bot"|$)/g) || [];

  for (const block of blocks) {
    const titleMatch = block.match(/<h3 class="gs_rt">([\s\S]*?)<\/h3>/);
    if (!titleMatch) {
      continue;
    }

    const linkMatch = titleMatch[1].match(/<a[^>]+href="([^"]+)"/);
    const title = normalizeScholarTitle(titleMatch[1]);
    const link = decodeHtml(linkMatch?.[1] || "");
    const snippet = stripHtml(block.match(/<div class="gs_rs">([\s\S]*?)<\/div>/)?.[1] || "");
    const meta = stripHtml(block.match(/<div class="gs_a">([\s\S]*?)<\/div>/)?.[1] || "");
    const year = Number(meta.match(/\b(19|20)\d{2}\b/)?.[0]) || undefined;

    if (title && link && !/^citation$/iu.test(title)) {
      results.push({ title, link, snippet, meta, year });
    }
  }

  return results;
}

function buildGoogleScholarUrl(options: Required<RealNewsFetchOptions>): string {
  const params = new URLSearchParams({
    q: `${CATEGORY_QUERY[options.category] || CATEGORY_QUERY["全部"]} authoritative journal article`,
    hl: "en",
    as_sdt: "0,5",
  });

  if (options.publishedWithinDays > 0) {
    params.set("as_ylo", String(new Date(formatDateDaysAgo(options.publishedWithinDays)).getUTCFullYear()));
  }

  return `${GOOGLE_SCHOLAR_BASE}?${params.toString()}`;
}

export async function fetchGoogleScholarResults(
  categoryOrOptions: string | RealNewsFetchOptions,
  limit = 8,
): Promise<GoogleScholarResult[]> {
  const options = normalizeFetchOptions(categoryOrOptions, limit);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  const response = await fetch(buildGoogleScholarUrl(options), {
    signal: controller.signal,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`Google Scholar request failed with status ${response.status}`);
  }

  const html = await response.text();
  return parseGoogleScholarResults(html).slice(0, options.limit);
}

export function reconstructAbstract(abstractIndex?: Record<string, number[]> | null): string {
  if (!abstractIndex) {
    return "";
  }

  const positions: Array<{ word: string; index: number }> = [];
  for (const [word, indexes] of Object.entries(abstractIndex)) {
    for (const index of indexes) {
      positions.push({ word, index });
    }
  }

  return positions
    .sort((a, b) => a.index - b.index)
    .map((item) => item.word)
    .join(" ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

export function deriveCategory(title: string, topic?: string | null): string {
  const haystack = `${title} ${topic || ""}`.toLowerCase();
  if (/water|drinking|wastewater|microplastic|aquatic/.test(haystack)) {
    return "饮用水";
  }
  if (/policy|tax|regulation|law|governance/.test(haystack)) {
    return "政策解读";
  }
  if (/climate|heat|heatwave|warming|carbon|storm/.test(haystack)) {
    return "气候变化";
  }
  if (/air|pm2\.?5|pm10|ozone|no2|smoke|aqi|particulate|indoor air/.test(haystack)) {
    return "空气质量";
  }
  if (/epidemiology|cohort|mortality|incidence/.test(haystack)) {
    return "流行病学";
  }
  return "流行病学";
}

export function matchesNewsFilters(
  item: Pick<NewsSeed, "category" | "citedByCount" | "publishDate" | "isOpenAccess">,
  options?: Partial<RealNewsFetchOptions>,
): boolean {
  if (!options) {
    return true;
  }

  if (options.category && options.category !== "全部" && item.category !== options.category) {
    return false;
  }
  if (options.openAccessOnly && !item.isOpenAccess) {
    return false;
  }
  if (options.minCitations && (item.citedByCount || 0) < options.minCitations) {
    return false;
  }
  if (options.publishedWithinDays) {
    const threshold = formatDateDaysAgo(options.publishedWithinDays);
    if (!item.publishDate || item.publishDate < threshold) {
      return false;
    }
  }
  return true;
}

function buildOpenAlexUrl(options: Required<RealNewsFetchOptions>): string {
  const filters = [
    "has_abstract:true",
    "is_paratext:false",
    "type:article",
    "language:en",
  ];

  if (options.openAccessOnly) {
    filters.push("open_access.is_oa:true");
  }
  if (options.minCitations > 0) {
    filters.push(`cited_by_count:>${options.minCitations - 1}`);
  }
  if (options.publishedWithinDays > 0) {
    filters.push(`from_publication_date:${formatDateDaysAgo(options.publishedWithinDays)}`);
  }

  const params = new URLSearchParams({
    search: CATEGORY_QUERY[options.category] || CATEGORY_QUERY["全部"],
    filter: filters.join(","),
    sort: options.sort === "cited" ? "cited_by_count:desc" : "publication_date:desc",
    "per-page": String(options.limit),
  });

  return `${OPEN_ALEX_BASE}?${params.toString()}`;
}

function buildOpenAlexSearchUrl(search: string, options: Required<RealNewsFetchOptions>, limit: number): string {
  const filters = ["has_abstract:true", "is_paratext:false", "type:article", "language:en"];
  if (options.openAccessOnly) {
    filters.push("open_access.is_oa:true");
  }
  if (options.minCitations > 0) {
    filters.push(`cited_by_count:>${options.minCitations - 1}`);
  }
  if (options.publishedWithinDays > 0) {
    filters.push(`from_publication_date:${formatDateDaysAgo(options.publishedWithinDays)}`);
  }

  const params = new URLSearchParams({
    search,
    filter: filters.join(","),
    sort: options.sort === "cited" ? "cited_by_count:desc" : "relevance_score:desc",
    "per-page": String(Math.max(1, limit)),
  });

  return `${OPEN_ALEX_BASE}?${params.toString()}`;
}

export async function fetchOpenAlexWorks(categoryOrOptions: string | RealNewsFetchOptions, limit = 8): Promise<OpenAlexWork[]> {
  const options = normalizeFetchOptions(categoryOrOptions, limit);
  const response = await fetch(buildOpenAlexUrl(options), {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`OpenAlex request failed with status ${response.status}`);
  }

  const data = (await response.json()) as { results?: OpenAlexWork[] };
  const deduped = new Map<string, OpenAlexWork>();
  for (const item of data.results || []) {
    if (!item.title || !reconstructAbstract(item.abstract_inverted_index)) {
      continue;
    }
    const key = buildOpenAlexWorkKey(item);
    if (!deduped.has(key)) {
      deduped.set(key, item);
    }
  }
  return [...deduped.values()];
}

async function fetchOpenAlexWorksBySearch(
  search: string,
  categoryOrOptions: string | RealNewsFetchOptions,
  limit = 3,
): Promise<OpenAlexWork[]> {
  const options = normalizeFetchOptions(categoryOrOptions, limit);
  const response = await fetch(buildOpenAlexSearchUrl(search, options, limit), {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`OpenAlex enrichment request failed with status ${response.status}`);
  }

  const data = (await response.json()) as { results?: OpenAlexWork[] };
  const deduped = new Map<string, OpenAlexWork>();
  for (const item of data.results || []) {
    if (!item.title || !reconstructAbstract(item.abstract_inverted_index)) {
      continue;
    }
    const key = buildOpenAlexWorkKey(item);
    if (!deduped.has(key)) {
      deduped.set(key, item);
    }
  }
  return [...deduped.values()];
}

function titleSimilarity(a: string, b: string): number {
  const aTokens = new Set(
    a
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
  const bTokens = new Set(
    b
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
  if (aTokens.size === 0 || bTokens.size === 0) {
    return 0;
  }
  const overlap = [...aTokens].filter((token) => bTokens.has(token)).length;
  return overlap / Math.max(aTokens.size, bTokens.size);
}

async function enrichScholarResultWithOpenAlex(
  result: GoogleScholarResult,
  options: Required<RealNewsFetchOptions>,
): Promise<OpenAlexWork | null> {
  const candidates = await fetchOpenAlexWorksBySearch(result.title, options, 3);
  return candidates.find((work) => titleSimilarity(result.title, work.title || "") >= 0.45) || candidates[0] || null;
}

export async function buildNewsItemFromOpenAlexWork(work: OpenAlexWork): Promise<NewsSeed | null> {
  const title = work.title?.trim();
  const abstract = reconstructAbstract(work.abstract_inverted_index);
  if (!title || !abstract) {
    return null;
  }

  const category = deriveCategory(title, work.primary_topic?.display_name || null);
  const journal = work.primary_location?.source?.display_name || "OpenAlex";
  const sourceLink =
    work.primary_location?.landing_page_url ||
    work.primary_location?.pdf_url ||
    work.doi ||
    work.id ||
    "https://api.openalex.org";
  const digestInput = {
    title,
    abstract,
    journal,
    publicationDate: work.publication_date || undefined,
    citedByCount: work.cited_by_count,
    category,
  };
  const useAIDigest = process.env.NODE_ENV !== "test" && process.env.DISABLE_NEWS_AI_SUMMARY !== "true";
  const digest =
    useAIDigest
      ? await generatePaperNewsDigest(digestInput)
      : { provider: "local-fallback" as const, result: buildLocalPaperNewsDigest(digestInput) };
  const heuristicTitle = buildHeuristicPaperConclusion(title, category);
  const fallbackTitle = formatCoreConclusionTitle(digest.result.plainLanguageSummary || digest.result.whyItMatters || "", heuristicTitle);
  const cleanedTitle = formatCoreConclusionTitle(digest.result.oneSentenceSummary, fallbackTitle);
  const publicTitle = isOverGenericConclusionTitle(cleanedTitle, category) ? heuristicTitle : cleanedTitle;
  if (isOverGenericConclusionTitle(publicTitle, category)) {
    return null;
  }

  return {
    id: work.id || createId("paper"),
    title: publicTitle,
    oneSentenceSummary: digest.result.plainLanguageSummary || digest.result.whyItMatters,
    conceptImageUrl: `https://picsum.photos/seed/${encodeURIComponent(title.slice(0, 32))}/1200/675`,
    plainTextContent: digest.result.plainTextContent,
    translatedAbstract: digest.result.translatedAbstract,
    sourceLink,
    sourceJournal: journal,
    paperTitle: digest.result.translatedTitle || "论文标题已转为中文说明",
    publishDate: work.publication_date || new Date().toISOString().slice(0, 10),
    category,
    likes: 0,
    comments: [],
    authors: (work.authorships || [])
      .map((item) => item.author?.display_name)
      .filter((value): value is string => Boolean(value))
      .slice(0, 5),
    citedByCount: work.cited_by_count,
    doi: work.doi || null,
    explainers: {
      translatedTitle: digest.result.translatedTitle,
      plainLanguageSummary: digest.result.plainLanguageSummary,
      whyItMatters: digest.result.whyItMatters,
      howStudyWorked: digest.result.howStudyWorked,
      keyFindings: digest.result.keyFindings,
      limitations: digest.result.limitations,
      everydayMeaning: digest.result.everydayMeaning,
      readerActions: digest.result.readerActions,
      publicCautions: digest.result.publicCautions,
    },
    isOpenAccess: Boolean(work.open_access?.is_oa),
    publicationYear: work.publication_year || undefined,
    discoverySource: "openalex",
  };
}

async function buildNewsItemFromScholarResult(
  result: GoogleScholarResult,
  options: Required<RealNewsFetchOptions>,
): Promise<NewsSeed | null> {
  const work = await enrichScholarResultWithOpenAlex(result, options);
  if (!work) {
    return null;
  }

  const item = await buildNewsItemFromOpenAlexWork(work);
  if (!item) {
    return null;
  }

  return {
    ...item,
    id: work.id || `google_scholar_${normalizeIdentityText(result.link || result.title)}`,
    sourceLink: item.sourceLink || result.link,
    scholarLink: `https://scholar.google.com/scholar?q=${encodeURIComponent(result.title)}`,
    discoverySource: "google-scholar",
    publicationYear: item.publicationYear || result.year,
  };
}

export async function fetchRealNews(categoryOrOptions: string | RealNewsFetchOptions, limit = 8): Promise<NewsSeed[]> {
  const options = normalizeFetchOptions(categoryOrOptions, limit);
  const effectiveOptions = {
    ...options,
    publishedWithinDays:
      options.publishedWithinDays || (options.category === "全部" && options.minCitations === 0 ? DEFAULT_RECENT_DAYS : 0),
    minCitations: options.minCitations || (options.sort === "cited" ? DEFAULT_HIGH_CITATION_THRESHOLD : 0),
  };
  let scholarItems: NewsSeed[] = [];
  try {
    const scholarResults = await fetchGoogleScholarResults(effectiveOptions, effectiveOptions.limit);
    const enriched = await Promise.all(scholarResults.map((result) => buildNewsItemFromScholarResult(result, effectiveOptions)));
    scholarItems = enriched.filter((item): item is NewsSeed => Boolean(item));
  } catch (error) {
    console.error("[News] Google Scholar discovery failed, falling back to OpenAlex metadata.", error);
  }

  if (scholarItems.length >= Math.min(3, effectiveOptions.limit)) {
    return dedupeNewsItems(scholarItems).filter((item) => matchesNewsFilters(item, effectiveOptions)).slice(0, effectiveOptions.limit);
  }

  const works = await fetchOpenAlexWorks(effectiveOptions, effectiveOptions.limit);
  const openAlexItems = await Promise.all(works.map((work) => buildNewsItemFromOpenAlexWork(work)));
  return dedupeNewsItems([...scholarItems, ...openAlexItems.filter((item): item is NewsSeed => Boolean(item))])
    .filter((item) => matchesNewsFilters(item, effectiveOptions))
    .slice(0, effectiveOptions.limit);
}

export { DEFAULT_HIGH_CITATION_THRESHOLD, DEFAULT_RECENT_DAYS };
