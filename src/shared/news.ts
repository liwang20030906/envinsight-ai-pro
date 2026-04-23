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
};

const OPEN_ALEX_BASE = "https://api.openalex.org/works";
const DEFAULT_RECENT_DAYS = 365;
const DEFAULT_HIGH_CITATION_THRESHOLD = 25;

const CATEGORY_QUERY: Record<string, string> = {
  空气质量: "air pollution pm2.5 environmental health",
  气候变化: "climate change heatwave environmental health",
  流行病学: "environmental epidemiology exposure cohort health",
  政策解读: "environmental policy public health regulation",
  饮用水: "drinking water contamination health",
  全部: "environmental health public health pollution climate water",
};

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
  if (/epidemiology|cohort|mortality|incidence/.test(haystack)) {
    return "流行病学";
  }
  return "空气质量";
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
  return (data.results || []).filter((item) => item.title && reconstructAbstract(item.abstract_inverted_index));
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

  return {
    id: work.id || createId("paper"),
    title: digest.result.oneSentenceSummary,
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
  const works = await fetchOpenAlexWorks(effectiveOptions, effectiveOptions.limit);
  const items = await Promise.all(works.map((work) => buildNewsItemFromOpenAlexWork(work)));
  return items.filter((item): item is NewsSeed => Boolean(item)).filter((item) => matchesNewsFilters(item, effectiveOptions));
}

export { DEFAULT_HIGH_CITATION_THRESHOLD, DEFAULT_RECENT_DAYS };
