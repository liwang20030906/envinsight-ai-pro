import { User, NewsItem, Comment, AnalyticsEvent, ImportedResearchLead, NewsFilters } from "../types";

// ── Auth ──

const STORAGE_KEY = "envinsight_user";

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user: User | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function login(displayName: string, email: string): User {
  const user: User = {
    uid: crypto.randomUUID(),
    displayName,
    email,
  };
  setStoredUser(user);
  return user;
}

export function logout() {
  setStoredUser(null);
}

// ── News (via REST API) ──

export async function fetchNews(params?: { q?: string; category?: string; filters?: NewsFilters }): Promise<NewsItem[]> {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);
  if (params?.category && params.category !== "全部") sp.set("category", params.category);
  if (params?.filters?.openAccessOnly) sp.set("oa", "true");
  if (params?.filters?.highlyCitedOnly) sp.set("minCitations", "25");
  if (params?.filters?.recentOnly) sp.set("publishedWithinDays", "365");
  if (params?.filters?.highlyCitedOnly) sp.set("sort", "cited");

  const res = await fetch(`/api/news?${sp.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch news");
  const raw = await res.json();

  return raw.map((item: any) => ({
    id: item.id,
    title: item.title,
    summary: item.oneSentenceSummary || item.summary || "",
    content: item.plainTextContent || item.content || "",
    category: item.category || "未分类",
    date: item.publishDate || item.date || "",
    imageUrl: item.conceptImageUrl || item.imageUrl || "",
    likesCount: item.likes || 0,
    translatedAbstract: item.translatedAbstract,
    authors: item.authors || [],
    citedByCount: item.citedByCount,
    doi: item.doi,
    explainers: item.explainers,
    sourceJournal: item.sourceJournal,
    sourceLink: item.sourceLink,
    paperTitle: item.paperTitle,
    discoverySource: item.discoverySource,
    scholarLink: item.scholarLink,
    isOpenAccess: item.isOpenAccess,
    publicationYear: item.publicationYear,
    comments: (item.comments || []).map((c: any) => ({
      id: c.id,
      userName: c.user || c.userName || "匿名用户",
      content: c.text || c.content || "",
      timestamp: c.date || c.timestamp || "",
    })),
  }));
}

export async function crawlNews(category?: string, filters?: NewsFilters): Promise<NewsItem[]> {
  const res = await fetch("/api/news/crawl", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: category || "全部",
      oa: filters?.openAccessOnly || false,
      minCitations: filters?.highlyCitedOnly ? 25 : 0,
      publishedWithinDays: filters?.recentOnly ? 365 : undefined,
    }),
  });
  if (!res.ok) throw new Error("Crawl failed");
  const raw = await res.json();
  return raw.map((item: any) => ({
    id: item.id,
    title: item.title,
    summary: item.oneSentenceSummary || item.summary || "",
    content: item.plainTextContent || item.content || "",
    category: item.category || "未分类",
    date: item.publishDate || item.date || "",
    imageUrl: item.conceptImageUrl || item.imageUrl || "",
    likesCount: item.likes || 0,
    translatedAbstract: item.translatedAbstract,
    authors: item.authors || [],
    citedByCount: item.citedByCount,
    doi: item.doi,
    explainers: item.explainers,
    sourceJournal: item.sourceJournal,
    sourceLink: item.sourceLink,
    paperTitle: item.paperTitle,
    discoverySource: item.discoverySource,
    scholarLink: item.scholarLink,
    isOpenAccess: item.isOpenAccess,
    publicationYear: item.publicationYear,
    comments: [],
  }));
}

export async function publishWorkbenchNews(payload: {
  result: unknown;
  importedLead?: unknown;
  publishReview: unknown;
  workbenchFeedback: unknown;
}): Promise<NewsItem> {
  const res = await fetch("/api/news/publish-workbench", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("发布到大众资讯流失败");
  const item = await res.json();
  return {
    id: item.id,
    title: item.title,
    summary: item.oneSentenceSummary || item.summary || "",
    content: item.plainTextContent || item.content || "",
    category: item.category || "未分类",
    date: item.publishDate || item.date || "",
    imageUrl: item.conceptImageUrl || item.imageUrl || "",
    likesCount: item.likes || 0,
    translatedAbstract: item.translatedAbstract,
    authors: item.authors || [],
    citedByCount: item.citedByCount,
    doi: item.doi,
    explainers: item.explainers,
    sourceJournal: item.sourceJournal,
    sourceLink: item.sourceLink,
    paperTitle: item.paperTitle,
    discoverySource: item.discoverySource,
    scholarLink: item.scholarLink,
    isOpenAccess: item.isOpenAccess,
    publicationYear: item.publicationYear,
    comments: [],
  };
}

// ── Likes (via REST API) ──

export async function likeNews(newsId: string): Promise<number> {
  const res = await fetch(`/api/news/${newsId}/like`, { method: "POST" });
  if (!res.ok) throw new Error("Like failed");
  const data = await res.json();
  return data.likes;
}

// ── Comments (via REST API) ──

export async function addComment(newsId: string, userName: string, text: string): Promise<Comment> {
  const res = await fetch(`/api/news/${newsId}/comment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: userName, text }),
  });
  if (!res.ok) throw new Error("Comment failed");
  const data = await res.json();
  return {
    id: data.id,
    userName: data.user || userName,
    content: data.text || text,
    timestamp: data.date || new Date().toISOString().split("T")[0],
  };
}

// ── User Interests (localStorage) ──

const INTERESTS_KEY = "envinsight_interests";

export function getUserInterests(): Record<string, number> {
  const raw = localStorage.getItem(INTERESTS_KEY);
  return raw ? JSON.parse(raw) : {};
}

export function updateUserInterest(category: string, weight: number) {
  const interests = getUserInterests();
  interests[category] = (interests[category] || 0) + weight;
  localStorage.setItem(INTERESTS_KEY, JSON.stringify(interests));
}

// ── Analytics (local buffer + console) ──

const ANALYTICS_KEY = "envinsight_analytics";

function getAnalyticsBuffer(): AnalyticsEvent[] {
  const raw = localStorage.getItem(ANALYTICS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function trackEvent(eventName: string, elementId: string, metadata: any = {}) {
  const events = getAnalyticsBuffer();
  const user = getStoredUser();
  const event: AnalyticsEvent = {
    id: crypto.randomUUID(),
    eventName,
    elementId,
    timestamp: new Date().toISOString(),
    userId: user?.uid || "anonymous",
    metadata,
  };
  events.unshift(event);
  // Keep last 200 events
  if (events.length > 200) events.length = 200;
  localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events));
  console.log("[Analytics]", eventName, elementId, metadata);
}

export function getAnalytics(): AnalyticsEvent[] {
  return getAnalyticsBuffer();
}

// ── News -> Workbench Bridge ──

const IMPORTED_LEAD_KEY = "envinsight_imported_research_lead";

export function getStoredImportedLead(): ImportedResearchLead | null {
  const raw = localStorage.getItem(IMPORTED_LEAD_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setStoredImportedLead(lead: ImportedResearchLead | null) {
  if (lead) {
    localStorage.setItem(IMPORTED_LEAD_KEY, JSON.stringify(lead));
  } else {
    localStorage.removeItem(IMPORTED_LEAD_KEY);
  }
}
