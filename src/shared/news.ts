import { buildLocalPaperNewsDigest, generatePaperNewsDigest } from "./ai";

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
  doi?: string | null;
  cited_by_count?: number;
  primary_location?: OpenAlexLocation | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  authorships?: OpenAlexAuthor[];
  primary_topic?: {
    display_name?: string;
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
  publishDate: string;
  category: string;
  likes: number;
  comments: Array<{ id: string; user: string; text: string; date: string }>;
  authors?: string[];
  citedByCount?: number;
  doi?: string | null;
  explainers?: {
    whyItMatters: string;
    howStudyWorked: string;
    keyFindings: string[];
    limitations: string[];
    everydayMeaning: string;
    readerActions: string[];
  };
};

const OPEN_ALEX_BASE = "https://api.openalex.org/works";

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

function buildOpenAlexUrl(category: string, limit: number): string {
  const params = new URLSearchParams({
    search: CATEGORY_QUERY[category] || CATEGORY_QUERY["全部"],
    filter: "has_abstract:true,is_paratext:false,type:article,language:en",
    sort: "publication_date:desc",
    "per-page": String(limit),
  });
  return `${OPEN_ALEX_BASE}?${params.toString()}`;
}

export async function fetchOpenAlexWorks(category: string, limit = 8): Promise<OpenAlexWork[]> {
  const response = await fetch(buildOpenAlexUrl(category, limit), {
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
  const digest =
    process.env.ENABLE_NEWS_AI_SUMMARY === "true"
      ? await generatePaperNewsDigest(digestInput)
      : { provider: "local-fallback" as const, result: buildLocalPaperNewsDigest(digestInput) };

  return {
    id: work.id || createId("paper"),
    title: digest.result.title || title,
    oneSentenceSummary: digest.result.oneSentenceSummary,
    conceptImageUrl: `https://picsum.photos/seed/${encodeURIComponent(title.slice(0, 32))}/1200/675`,
    plainTextContent: digest.result.plainTextContent,
    translatedAbstract: digest.result.translatedAbstract,
    sourceLink,
    sourceJournal: journal,
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
      whyItMatters: digest.result.whyItMatters,
      howStudyWorked: digest.result.howStudyWorked,
      keyFindings: digest.result.keyFindings,
      limitations: digest.result.limitations,
      everydayMeaning: digest.result.everydayMeaning,
      readerActions: digest.result.readerActions,
    },
  };
}

export async function fetchRealNews(category: string, limit = 8): Promise<NewsSeed[]> {
  const works = await fetchOpenAlexWorks(category, limit);
  const items = await Promise.all(works.map((work) => buildNewsItemFromOpenAlexWork(work)));
  return items.filter((item): item is NewsSeed => Boolean(item));
}
