export interface StatsSummary {
  coefficients: {
    intercept: number;
    pm25: number;
  };
  rSquared: number;
  pValue: number;
  n: number;
}

export interface DataPoint {
  x: number;
  y: number;
}

export type AnalysisMode = 'researcher' | 'public';

export interface Comment {
  id: string;
  userName: string;
  content: string;
  timestamp: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  date: string;
  imageUrl: string;
  likesCount: number;
  sourceLink?: string;
  sourceJournal?: string;
  comments?: Comment[];
}

export interface AnalyticsEvent {
  id: string;
  eventName: string;
  elementId: string;
  timestamp: string;
  userId?: string;
  metadata?: any;
}

export interface AnalysisResult {
  summary: StatsSummary;
  data: DataPoint[];
  columns: {
    x: string;
    y: string;
  };
}

export interface User {
  uid: string;
  displayName: string;
  email: string;
}
