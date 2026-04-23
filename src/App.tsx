import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Upload,
  Activity,
  ShieldAlert,
  FileText,
  TrendingDown,
  TrendingUp,
  Info,
  ChevronRight,
  Download,
  RefreshCw,
  User as UserIcon,
  Search,
  AlertTriangle,
  Newspaper,
  Globe,
  ArrowLeft,
  ExternalLink,
  Calendar,
  Heart,
  MessageSquare,
  Send,
  BarChart2,
  Bot,
  Sparkles,
  Copy,
  X
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  AnalysisResult,
  AnalysisMode,
  CollaborationRole,
  CollaborationRoom,
  ImportedResearchLead,
  NewsItem,
  NewsFilters,
  Comment,
  AnalyticsEvent,
  ComplianceGuidance,
  ComplianceReview,
  DiscussionMessage,
  GeneratedReport,
  PaperDraft,
  AuditLogEntry,
  WorkbenchFeedbackBrief,
  WorkbenchNewsPublishReview,
} from './types';
import { discussWithAI, getAIAnalysisStream, getWhatIfAnalysis } from './services/aiService';
import {
  addCollaborationNote,
  addCollaborationTask,
  fetchCollaborationRoom,
  joinCollaborationRoom,
  toggleCollaborationTask,
} from './services/collaborationService';
import {
  getStoredUser,
  setStoredUser,
  login as doLogin,
  logout as doLogout,
  fetchNews,
  crawlNews,
  likeNews,
  addComment,
  getStoredImportedLead,
  getUserInterests,
  setStoredImportedLead,
  updateUserInterest,
  trackEvent,
  getAnalytics,
} from './services/localDataService';
import {
  analyzeDataset,
  fetchSampleDataset,
  fetchAuditTrail,
  generatePaperDraft,
  generateReport,
  reviewDataset,
} from './services/workbenchService';
import { buildImportedResearchLead, buildWorkbenchFeedbackBrief, buildWorkbenchNewsPublishReview } from './shared/researchBridge';
import type { User as UserType } from './types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NEWS_CATEGORIES = ["空气质量", "气候变化", "流行病学", "政策解读", "饮用水"];
const DEFAULT_NEWS_FILTERS: NewsFilters = {
  openAccessOnly: false,
  highlyCitedOnly: false,
  recentOnly: false,
};
const SAMPLE_DATASETS = [
  { id: 'regression', title: '连续型回归', description: 'PM2.5 与疾病率的线性关系，适合看回归、What-If 和论文初稿。' },
  { id: 'classification', title: '二分类风险', description: '生物标志物 + 风险标签，适合预览分类模型对比与推荐。' },
  { id: 'time-series', title: '时间序列趋势', description: '按日期追踪污染与门诊量，适合预览趋势建模与时序对比。' },
  { id: 'privacy-risk', title: '高风险样本', description: '包含姓名、邮箱和摘要列，可直接预览合规拦截与 AI 脱敏方案。' },
] as const;

export default function App() {
  const [user, setUser] = useState<UserType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [mode, setMode] = useState<AnalysisMode>('researcher');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pm25Delta, setPm25Delta] = useState(0);
  const [whatIfResponse, setWhatIfResponse] = useState<string>('');
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complianceReview, setComplianceReview] = useState<ComplianceReview | null>(null);
  const [complianceGuidance, setComplianceGuidance] = useState<ComplianceGuidance | null>(null);
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [paperDraft, setPaperDraft] = useState<PaperDraft | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditLogEntry[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [paperLoading, setPaperLoading] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [discussionInput, setDiscussionInput] = useState('');
  const [discussionMessages, setDiscussionMessages] = useState<DiscussionMessage[]>([]);
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsFilters, setNewsFilters] = useState<NewsFilters>(DEFAULT_NEWS_FILTERS);
  const [userInterests, setUserInterests] = useState<Record<string, number>>({});
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('全部');
  const [importedLead, setImportedLead] = useState<ImportedResearchLead | null>(null);
  const [workbenchFeedback, setWorkbenchFeedback] = useState<WorkbenchFeedbackBrief | null>(null);
  const [publishReview, setPublishReview] = useState<WorkbenchNewsPublishReview | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'news' | 'workbench' | 'analytics'>('news');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsEvent[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [collabRoomId, setCollabRoomId] = useState('envinsight-demo-room');
  const [collabName, setCollabName] = useState('');
  const [collabRole, setCollabRole] = useState<CollaborationRole>('analyst');
  const [collabMemberId, setCollabMemberId] = useState<string | null>(null);
  const [collabRoom, setCollabRoom] = useState<CollaborationRoom | null>(null);
  const [collabLoading, setCollabLoading] = useState(false);
  const [collabNoteInput, setCollabNoteInput] = useState('');
  const [collabTaskInput, setCollabTaskInput] = useState('');

  useEffect(() => {
    const stored = getStoredUser();
    const roomFromUrl = new URLSearchParams(window.location.search).get('room');
    if (roomFromUrl) {
      setCollabRoomId(roomFromUrl);
    }
    if (stored) {
      setUser(stored);
      setUserInterests(getUserInterests());
      setCollabName((prev) => prev || stored.displayName);
    }
    const storedLead = getStoredImportedLead();
    if (storedLead) {
      setImportedLead(storedLead);
    }
  }, []);

  useEffect(() => {
    if (view === 'analytics') {
      setAnalyticsData(getAnalytics());
    }
    if (view === 'news') {
      loadNews(searchQuery);
    }
  }, [view, activeCategory, newsFilters]);

  useEffect(() => {
    if (result) {
      triggerAIAnalysis(result, mode);
    }
  }, [result, mode]);

  useEffect(() => {
    setSelectedModelId(result?.modelComparison?.bestModelId || null);
  }, [result?.modelComparison?.bestModelId]);

  useEffect(() => {
    setWorkbenchFeedback(result ? buildWorkbenchFeedbackBrief(result, importedLead) : null);
    setPublishReview(result ? buildWorkbenchNewsPublishReview(result, importedLead) : null);
  }, [result, importedLead]);

  useEffect(() => {
    const intro =
      view === 'workbench'
        ? '可以问我：这个数据更适合什么模型？隐私/版权风险如何处理？报告怎么变成论文？'
        : view === 'analytics'
          ? '可以问我：用户都在看什么？哪些功能最常被点击？'
          : '可以问我：这条资讯是否适合导入科研工作台？如何继续深度分析？';
    setDiscussionMessages([
      {
        id: `assistant_intro_${view}`,
        role: 'assistant',
        content: `你好，我是 EnvInsight AI 助手。${intro}`,
        timestamp: new Date().toISOString(),
      },
    ]);
  }, [view]);

  useEffect(() => {
    if (user?.displayName) {
      setCollabName((prev) => prev || user.displayName);
    }
  }, [user?.displayName]);

  useEffect(() => {
    if (!collabMemberId || !collabRoomId) {
      return;
    }

    let cancelled = false;
    const sync = async () => {
      try {
        const { room } = await fetchCollaborationRoom(collabRoomId);
        if (!cancelled) {
          setCollabRoom(room);
        }
      } catch {
        // Ignore polling failures and keep current snapshot.
      }
    };

    sync();
    const timer = window.setInterval(sync, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [collabMemberId, collabRoomId]);

  useEffect(() => {
    if (!result?.trace?.datasetId) {
      setAuditTrail(result?.trace?.auditTrail || []);
      return;
    }

    fetchAuditTrail(result.trace.datasetId)
      .then(({ logs }) => setAuditTrail(logs))
      .catch(() => setAuditTrail(result.trace?.auditTrail || []));
  }, [result?.trace?.datasetId]);

  const loadNews = async (queryStr?: string) => {
    setNewsLoading(true);
    try {
      const items = await fetchNews({ q: queryStr, category: activeCategory, filters: newsFilters });

      // Personalized recommendation
      if (activeCategory === '为你推荐' && user) {
        const interests = getUserInterests();
        items.sort((a, b) => {
          const scoreA = 1 + (interests[a.category] || 0) / 10;
          const scoreB = 1 + (interests[b.category] || 0) / 10;
          return scoreB - scoreA;
        });
      }

      setNewsItems(items);
    } catch (err) {
      console.error('Failed to fetch news:', err);
      setError('获取资讯失败，请检查网络连接。');
    } finally {
      setNewsLoading(false);
    }
  };

  const toggleNewsFilter = (key: keyof NewsFilters) => {
    trackEvent('click', 'news_filter_toggle', { filter: key, enabled: !newsFilters[key] });
    setNewsFilters((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const resetWorkbenchOutputs = () => {
    setResult(null);
    setAiResponse('');
    setWhatIfResponse('');
    setReport(null);
    setPaperDraft(null);
    setComplianceGuidance(null);
    setAuditTrail([]);
    setSelectedModelId(null);
  };

  const runWorkbenchAnalysis = async (uploadedFile: File) => {
    setError(null);
    setFile(uploadedFile);
    resetWorkbenchOutputs();
    setLoading(true);

    try {
      const compliance = await reviewDataset(uploadedFile);
      setComplianceReview(compliance.review);
      setComplianceGuidance(compliance.guidance || null);

      if (compliance.review.status === 'blocked') {
        setError('检测到高风险字段，当前数据需先脱敏后才能进入分析。');
        return;
      }

      const analysisResult = await analyzeDataset(uploadedFile);
      setResult(analysisResult);
      setComplianceReview(analysisResult.complianceReview || compliance.review);
      setComplianceGuidance(analysisResult.complianceGuidance || compliance.guidance || null);
    } catch (err: any) {
      setError(err.message || '数据处理失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    setShowLoginModal(true);
  };

  const handleLoginSubmit = () => {
    if (!loginName.trim() || !loginEmail.trim()) return;
    const u = doLogin(loginName, loginEmail);
    setUser(u);
    setUserInterests(getUserInterests());
    setShowLoginModal(false);
    setLoginName('');
    setLoginEmail('');
  };

  const handleLogout = () => {
    doLogout();
    setUser(null);
    setUserInterests({});
  };

  const handleCrawl = async () => {
    trackEvent('click', 'crawl_news_button');
    if (!user) {
      setError('请先登录以执行此操作。');
      handleLogin();
      return;
    }

    setNewsLoading(true);
    try {
      await crawlNews(activeCategory === '为你推荐' ? '全部' : activeCategory, newsFilters);
      loadNews();
    } catch (err) {
      console.error('Crawl failed:', err);
      setError('抓取失败：网络错误。');
    } finally {
      setNewsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    trackEvent('click', 'upload_file_button');
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    await runWorkbenchAnalysis(uploadedFile);
  };

  const handleLoadSampleDataset = async (type: (typeof SAMPLE_DATASETS)[number]['id']) => {
    trackEvent('click', 'load_sample_dataset', { type });
    setError(null);
    try {
      const sampleRows = await fetchSampleDataset(type);
      const headers = Object.keys(sampleRows[0] || {});
      const csvContent = [
        headers.join(','),
        ...sampleRows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? '')).join(',')),
      ].join('\n');
      const csvBlob = new Blob([csvContent], { type: 'text/csv' });
      const csvFile = new File([csvBlob], `${type}.csv`, { type: 'text/csv' });
      await runWorkbenchAnalysis(csvFile);
    } catch (err: any) {
      setError(err.message || '示例数据加载失败');
    }
  };

  const handleImportNewsToWorkbench = (item: NewsItem) => {
    const lead = buildImportedResearchLead(item);
    setImportedLead(lead);
    setStoredImportedLead(lead);
    setSelectedNews(item);
    setView('workbench');
    setMode('researcher');
    setDiscussionOpen(true);
    setDiscussionInput(`请基于导入论文《${item.title}》帮我梳理研究问题、变量设计和第一轮分析路线。`);
    trackEvent('click', 'import_news_to_workbench', { newsId: item.id, category: item.category });
  };

  const clearImportedLead = () => {
    setImportedLead(null);
    setStoredImportedLead(null);
    trackEvent('click', 'clear_imported_lead');
  };

  const handleRunImportedLeadSample = async () => {
    if (!importedLead) return;
    await handleLoadSampleDataset(importedLead.suggestedDataset);
  };

  const handleSyncLeadToCollaboration = async () => {
    if (!importedLead) return;
    if (!collabMemberId || !collabRoomId) {
      setView('workbench');
      setError('请先加入一个协作房间，再同步论文拆解任务。');
      return;
    }

    if (canCreateTask) {
      setCollabLoading(true);
      try {
        let latestRoom = collabRoom;
        for (const task of importedLead.collaborationTasks.slice(0, 3)) {
          const payload = await addCollaborationTask({
            roomId: collabRoomId,
            memberId: collabMemberId,
            title: task,
            ownerName: collabName || user?.displayName || 'Research Guest',
          });
          latestRoom = payload.room;
        }
        if (latestRoom) {
          setCollabRoom(latestRoom);
        }
      } catch (err: any) {
        setError(err.message || '同步协作任务失败');
      } finally {
        setCollabLoading(false);
      }
      return;
    }

    setCollabNoteInput(importedLead.collaborationTasks.map((task, index) => `${index + 1}. ${task}`).join('\n'));
    setError('当前角色不能直接创建任务，我已把推荐任务放进备注框，方便提交给 lead/reviewer。');
  };

  const handleJoinCollaboration = async () => {
    const nextName = (collabName || user?.displayName || 'Research Guest').trim();
    if (!collabRoomId.trim()) {
      setError('请输入协作房间号。');
      return;
    }

    setCollabLoading(true);
    try {
      const payload = await joinCollaborationRoom({
        roomId: collabRoomId.trim(),
        name: nextName,
        role: collabRole,
        datasetId: result?.trace?.datasetId,
        roomName: result ? `${result.columns.x} x ${result.columns.y} Research Room` : undefined,
      });
      setCollabRoom(payload.room);
      setCollabMemberId(payload.member.id);
      setCollabName(nextName);
      const params = new URLSearchParams(window.location.search);
      params.set('room', collabRoomId.trim());
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    } catch (err: any) {
      setError(err.message || '加入协作房间失败');
    } finally {
      setCollabLoading(false);
    }
  };

  const handleAddCollaborationNote = async (kind: 'note' | 'decision' = 'note') => {
    if (!collabMemberId || !collabRoomId || !collabNoteInput.trim()) return;
    setCollabLoading(true);
    try {
      const payload = await addCollaborationNote({
        roomId: collabRoomId,
        memberId: collabMemberId,
        authorName: collabName || user?.displayName || 'Research Guest',
        content: collabNoteInput.trim(),
        kind,
      });
      setCollabRoom(payload.room);
      setCollabNoteInput('');
    } catch (err: any) {
      setError(err.message || '协作备注提交失败');
    } finally {
      setCollabLoading(false);
    }
  };

  const handleAddCollaborationTask = async () => {
    if (!collabRoomId || !collabTaskInput.trim()) return;
    setCollabLoading(true);
    try {
      const payload = await addCollaborationTask({
        roomId: collabRoomId,
        memberId: collabMemberId,
        title: collabTaskInput.trim(),
        ownerName: collabName || user?.displayName || 'Research Guest',
      });
      setCollabRoom(payload.room);
      setCollabTaskInput('');
    } catch (err: any) {
      setError(err.message || '协作任务创建失败');
    } finally {
      setCollabLoading(false);
    }
  };

  const handleToggleCollaborationTask = async (taskId: string) => {
    if (!collabRoomId || !collabMemberId) return;
    try {
      const payload = await toggleCollaborationTask(collabRoomId, taskId, collabMemberId);
      setCollabRoom(payload.room);
    } catch (err: any) {
      setError(err.message || '协作任务更新失败');
    }
  };

  const copyCollaborationLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(collabRoomId)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('复制这个邀请链接', url);
    }
  };

  const triggerAIAnalysis = async (data: AnalysisResult, currentMode: AnalysisMode) => {
    setAiLoading(true);
    setAiResponse('');
    let firstChunk = true;
    try {
      await getAIAnalysisStream(
        data.summary,
        data.data,
        currentMode,
        data.columns,
        (chunk) => {
          if (firstChunk) {
            setAiLoading(false);
            firstChunk = false;
          }
          setAiResponse(prev => prev + chunk);
        }
      );
    } catch (err: any) {
      console.error(err);
      setAiResponse('AI 分析暂时不可用，请稍后再试。');
      setAiLoading(false);
    }
  };

  const handleDiscussSubmit = async () => {
    if (!discussionInput.trim() || discussionLoading) return;

    const userMessage: DiscussionMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: discussionInput.trim(),
      timestamp: new Date().toISOString(),
    };
    setDiscussionMessages((prev) => [...prev, userMessage]);
    setDiscussionInput('');
    setDiscussionLoading(true);

    try {
      const response = await discussWithAI(view, userMessage.content, result);
      setDiscussionMessages((prev) => [...prev, response.message]);
    } catch (err: any) {
      setDiscussionMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: err.message || 'AI 讨论暂时不可用，请稍后再试。',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setDiscussionLoading(false);
    }
  };

  const exportPaperMarkdown = async () => {
    if (!paperDraft) return;
    const markdown = [
      `# ${paperDraft.title}`,
      '',
      `> ${paperDraft.disclaimer}`,
      '',
      '## Abstract',
      paperDraft.abstract,
      '',
      '## Introduction',
      paperDraft.introduction,
      '',
      '## Methods',
      paperDraft.methods,
      '',
      '## Results',
      paperDraft.results,
      '',
      '## Discussion',
      paperDraft.discussion,
      '',
      '## Limitations',
      paperDraft.limitations,
      '',
      '## Evidence Map',
      ...paperDraft.evidenceMap.map((item) => `- ${item.label}: ${item.value} (${item.source})`),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${paperDraft.title.replace(/\s+/g, '_') || 'paper_draft'}.md`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleWhatIf = async () => {
    if (!result) return;
    trackEvent('click', 'run_simulation_button', { pm25Delta });
    setWhatIfLoading(true);
    try {
      const predictedChange = result.summary.coefficients.pm25 * (pm25Delta / 100 * result.data[0].x);
      const response = await getWhatIfAnalysis(
        { pm25Change: pm25Delta, predictedDiseaseChange: predictedChange },
        result.summary.coefficients.pm25,
        result.columns.x
      );
      setWhatIfResponse(response);
    } catch (err) {
      setWhatIfResponse('模拟分析失败。');
    } finally {
      setWhatIfLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!result) return;
    trackEvent('click', 'generate_report_button');
    setReportLoading(true);
    try {
      const { report: nextReport } = await generateReport(result, aiResponse);
      setReport(nextReport);
    } catch (err: any) {
      setError(err.message || '报告生成失败');
    } finally {
      setReportLoading(false);
    }
  };

  const handleGeneratePaperDraft = async () => {
    if (!result) return;
    trackEvent('click', 'generate_paper_draft_button');
    setPaperLoading(true);
    try {
      const { paperDraft: nextPaperDraft } = await generatePaperDraft(result, aiResponse);
      setPaperDraft(nextPaperDraft);
    } catch (err: any) {
      setError(err.message || '论文初稿生成失败');
    } finally {
      setPaperLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!result || !reportRef.current) return;
    trackEvent('click', 'download_pdf_button');
    setPdfLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#F8F9FA',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            * { border-color: #e5e7eb !important; box-shadow: none !important; }
            .text-emerald-600 { color: #059669 !important; }
            .bg-emerald-600 { background-color: #059669 !important; }
            .bg-emerald-50 { background-color: #ecfdf5 !important; }
            .text-gray-900 { color: #111827 !important; }
            .text-gray-700 { color: #374151 !important; }
            .text-gray-500 { color: #6b7280 !important; }
            .text-gray-400 { color: #9ca3af !important; }
            .border-gray-200 { border-color: #e5e7eb !important; }
            .bg-white { background-color: #ffffff !important; }
            .bg-gray-50 { background-color: #f9fafb !important; }
          `;
          clonedDoc.head.appendChild(style);

          const buttons = clonedDoc.querySelectorAll('button');
          buttons.forEach(btn => { (btn as HTMLElement).style.display = 'none'; });
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const margin = 10;
      const displayWidth = pdfWidth - (margin * 2);
      const imgProps = pdf.getImageProperties(imgData);
      const displayHeight = displayWidth * (imgProps.height / imgProps.width);

      pdf.addImage(imgData, 'PNG', margin, margin, displayWidth, displayHeight);
      pdf.save(`EnvInsight_Report_${new Date().getTime()}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const selectedModel = result?.modelComparison?.runs.find((run) => run.id === selectedModelId) || result?.modelComparison?.runs[0] || null;
  const currentCollabMember = collabRoom?.members.find((member) => member.id === collabMemberId) || null;
  const canCreateDecision = currentCollabMember?.role === 'lead' || currentCollabMember?.role === 'reviewer';
  const canCreateTask = currentCollabMember?.role === 'lead';
  const canToggleTask = currentCollabMember?.role === 'lead' || currentCollabMember?.role === 'reviewer';

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-lg">
            <Activity className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">EnvInsight AI Pro</h1>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">智能环境健康决策系统 V3.2</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => { setView('news'); setMode('public'); }}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                view === 'news' ? "bg-emerald-50 text-emerald-700" : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <Newspaper size={18} />
              大众资讯
            </button>
            <button
              onClick={() => { setView('workbench'); setMode('researcher'); }}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                view === 'workbench' ? "bg-emerald-50 text-emerald-700" : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <Activity size={18} />
              专业工作台
            </button>
          </nav>

          <div className="h-6 w-px bg-gray-200 hidden md:block" />

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-gray-900">{user.displayName}</p>
                  <button onClick={handleLogout} className="text-[10px] text-red-500 font-bold uppercase tracking-wider hover:underline">退出登录</button>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm border border-gray-200">
                  {user.displayName[0]}
                </div>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-black transition-all"
              >
                <UserIcon size={16} />
                登录
              </button>
            )}
            <button
              onClick={() => {
                trackEvent('click', 'view_analytics_button');
                setView(view === 'analytics' ? 'news' : 'analytics');
              }}
              className={cn(
                "p-2 rounded-lg transition-all",
                view === 'analytics' ? "bg-emerald-100 text-emerald-600" : "text-gray-400 hover:bg-gray-100"
              )}
              title="数据看板"
            >
              <BarChart2 size={20} />
            </button>
            {result && view === 'workbench' && (
              <button
                onClick={downloadPDF}
                disabled={pdfLoading}
                className={cn(
                  "flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm",
                  pdfLoading ? "bg-gray-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                {pdfLoading ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                {pdfLoading ? "正在生成..." : "导出报告"}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-gray-200"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">登录</h3>
                <button onClick={() => setShowLoginModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">昵称</label>
                  <input
                    type="text"
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none"
                    placeholder="输入你的昵称"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">邮箱</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none"
                    placeholder="输入你的邮箱"
                    onKeyDown={(e) => e.key === 'Enter' && handleLoginSubmit()}
                  />
                </div>
                <button
                  onClick={handleLoginSubmit}
                  disabled={!loginName.trim() || !loginEmail.trim()}
                  className="w-full bg-gray-900 hover:bg-black text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50"
                >
                  进入系统
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {view === 'analytics' ? (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <AnalyticsDashboard data={analyticsData} onBack={() => setView('news')} />
        </div>
      ) : view === 'news' ? (
        <div className="max-w-7xl mx-auto px-6 py-8">
          {selectedNews ? (
            <NewsDetail
              item={selectedNews}
              onBack={() => setSelectedNews(null)}
              user={user}
              onLogin={handleLogin}
              onImportToWorkbench={() => handleImportNewsToWorkbench(selectedNews)}
            />
          ) : (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex-1">
                  <h2 className="text-3xl font-bold text-gray-900">环境健康头条</h2>
                  <p className="text-gray-500 mt-1">基于真实论文抓取，并自动翻译成中文大众读物的环境科研资讯流</p>
                  <div className="mt-6 relative max-w-xl">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="搜索研究论文、关键词或健康建议..."
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white border border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none shadow-sm"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        loadNews(e.target.value);
                      }}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      { key: 'openAccessOnly', label: '仅开放获取 OA' },
                      { key: 'highlyCitedOnly', label: '高被引优先' },
                      { key: 'recentOnly', label: '近一年' },
                    ].map((filter) => (
                      <button
                        key={filter.key}
                        onClick={() => toggleNewsFilter(filter.key as keyof NewsFilters)}
                        className={cn(
                          "px-3 py-2 rounded-full text-xs font-bold transition-all border",
                          newsFilters[filter.key as keyof NewsFilters]
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                        )}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    资讯流会按分类拉取真实论文，并每 30 分钟自动刷新；导入工作台后可继续做建模、协作和论文初稿。
                  </p>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                  {['全部', ...(user ? ['为你推荐'] : []), ...NEWS_CATEGORIES].map(cat => (
                    <button
                      key={cat}
                      onClick={() => {
                        trackEvent('click', 'category_filter', { category: cat });
                        setActiveCategory(cat);
                      }}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                        activeCategory === cat
                          ? "bg-gray-900 text-white"
                          : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                  <button
                    onClick={handleCrawl}
                    disabled={newsLoading}
                    className="ml-2 p-2 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    title="抓取真实论文"
                  >
                    <RefreshCw size={18} className={newsLoading ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

              {newsLoading && newsItems.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 h-80 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-12">
                  {activeCategory === '全部' && newsItems.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {newsItems.slice(0, Math.min(newsItems.length, 2)).map((item) => (
                        <NewsCard
                          key={item.id}
                          item={item}
                          featured
                          onClick={() => {
                            setSelectedNews(item);
                            updateUserInterest(item.category, 1);
                          }}
                        />
                      ))}
                    </div>
                  )}

                  <div className="space-y-6">
                    {newsItems.length === 0 ? (
                      <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
                        <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto">
                          <Search className="text-gray-300" size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">未找到相关资讯</h3>
                        <p className="text-gray-500 text-sm mt-1">尝试更换关键词或分类</p>
                      </div>
                    ) : (
                      (activeCategory === '全部' ? newsItems.slice(2) : newsItems)
                        .filter(item => activeCategory === '全部' || item.category === activeCategory)
                        .map((item: NewsItem) => (
                          <NewsStrip
                            key={item.id}
                            item={item}
                            onClick={() => {
                              setSelectedNews(item);
                              updateUserInterest(item.category, 1);
                            }}
                          />
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6" ref={reportRef}>
          <div className="lg:col-span-4 space-y-6">
            <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload size={20} className="text-emerald-600" />
                数据接入
              </h2>
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer group",
                  file ? "border-emerald-200 bg-emerald-50/30" : "border-gray-200 hover:border-emerald-400 hover:bg-gray-50"
                )}
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <input id="file-upload" type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                <div className="bg-emerald-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <FileText className="text-emerald-600" />
                </div>
                <p className="text-sm font-medium text-gray-900">
                  {file ? file.name : "点击或拖拽上传 CSV 文件"}
                </p>
                <p className="text-xs text-gray-500 mt-1">支持连续型、二分类、时间序列等多种 CSV 数据结构</p>
              </div>

              <div className="mt-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">一键预览完整功能板块</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SAMPLE_DATASETS.map((dataset) => (
                    <button
                      key={dataset.id}
                      onClick={() => handleLoadSampleDataset(dataset.id)}
                      className="text-left rounded-xl border border-gray-200 bg-gray-50 hover:bg-white hover:border-emerald-200 transition-all px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-gray-900">{dataset.title}</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{dataset.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {importedLead && (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">资讯 → 科研工作台</p>
                      <h3 className="text-sm font-bold text-gray-900 mt-1">{importedLead.title}</h3>
                      <p className="text-xs text-gray-600 mt-2 leading-relaxed">{importedLead.researchQuestion}</p>
                    </div>
                    <button
                      onClick={clearImportedLead}
                      className="text-xs font-bold text-gray-400 hover:text-gray-700"
                    >
                      清除
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-full bg-white border border-emerald-100 text-[10px] font-bold text-emerald-700">
                      推荐样本 {importedLead.suggestedDataset}
                    </span>
                    {importedLead.isOpenAccess && (
                      <span className="px-2 py-1 rounded-full bg-white border border-emerald-100 text-[10px] font-bold text-emerald-700">
                        Open Access
                      </span>
                    )}
                    {importedLead.citedByCount != null && (
                      <span className="px-2 py-1 rounded-full bg-white border border-emerald-100 text-[10px] font-bold text-emerald-700">
                        被引 {importedLead.citedByCount}
                      </span>
                    )}
                  </div>

                  <KeyValueList title="建议先准备的数据" items={importedLead.dataNeeds.slice(0, 3)} />
                  <KeyValueList title="推荐模型路线" items={importedLead.suggestedModels} />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      onClick={handleRunImportedLeadSample}
                      className="px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-black transition-all"
                    >
                      跑推荐示例数据
                    </button>
                    <button
                      onClick={handleSyncLeadToCollaboration}
                      className="px-4 py-2.5 rounded-xl border border-emerald-200 text-sm font-medium text-emerald-700 hover:bg-white transition-all"
                    >
                      同步到协作研究室
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              {loading && (
                <div className="mt-4 flex items-center justify-center gap-2 text-emerald-600 text-sm font-medium">
                  <RefreshCw className="animate-spin" size={16} />
                  正在进行数据体检、模型对比与分析生成...
                </div>
              )}
            </section>

            <section className={cn(
              "bg-white rounded-2xl border border-gray-200 p-6 shadow-sm transition-opacity",
              !complianceReview && "opacity-70"
            )}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ShieldAlert size={20} className="text-emerald-600" />
                合规预审与审计
              </h2>
              {complianceReview ? (
                <div className="space-y-4">
                  <div className={cn(
                    "rounded-xl border px-4 py-3",
                    complianceReview.status === 'blocked'
                      ? "bg-red-50 border-red-200"
                      : complianceReview.status === 'warning'
                        ? "bg-amber-50 border-amber-200"
                        : "bg-emerald-50 border-emerald-200"
                  )}>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">审查结论</p>
                    <p className="text-sm font-semibold text-gray-900">{complianceReview.summary}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">风险发现</p>
                    <div className="space-y-2">
                      {complianceReview.findings.length > 0 ? complianceReview.findings.map((finding, index) => (
                        <div key={`${finding.field}-${index}`} className="rounded-lg border border-gray-200 px-3 py-2">
                          <p className="text-sm font-medium text-gray-900">{finding.field}</p>
                          <p className="text-xs text-gray-500 mt-1">{finding.reason}</p>
                        </div>
                      )) : (
                        <p className="text-sm text-gray-500">当前未检测到高风险身份字段。</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">处理建议</p>
                    <ul className="space-y-2 text-sm text-gray-600">
                      {complianceReview.suggestions.map((suggestion) => (
                        <li key={suggestion} className="rounded-lg bg-gray-50 px-3 py-2 border border-gray-100">
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">上传数据后，系统会先执行字段级风险审查并留下审计轨迹。</p>
              )}
            </section>

            <section className={cn(
              "bg-white rounded-2xl border border-gray-200 p-6 shadow-sm transition-opacity",
              !complianceGuidance && "opacity-70"
            )}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Info size={20} className="text-emerald-600" />
                AI 合规解决方案
              </h2>
              {complianceGuidance ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <p className="text-sm text-emerald-900 leading-relaxed">{complianceGuidance.summary}</p>
                  </div>
                  <KeyValueList title="数据脱敏方案" items={complianceGuidance.desensitizationPlan} />
                  <KeyValueList title="AI 审查工作流" items={complianceGuidance.reviewWorkflow} />
                  <KeyValueList title="版权核查清单" items={complianceGuidance.copyrightChecklist} />
                  <KeyValueList title="发布前守则" items={complianceGuidance.publishGuardrails} />
                </div>
              ) : (
                <p className="text-sm text-gray-500">完成预审后，AI 会自动生成数据脱敏、版权核查和发布前审查工作流。</p>
              )}
            </section>

            <section className={cn(
              "bg-white rounded-2xl border border-gray-200 p-6 shadow-sm transition-opacity",
              !result && "opacity-50 pointer-events-none"
            )}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <RefreshCw size={20} className="text-emerald-600" />
                What-If 决策模拟
              </h2>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">核心自变量 ({result?.columns.x || '待分析'}) 调整</label>
                    <span className={cn(
                      "text-sm font-bold",
                      pm25Delta > 0 ? "text-red-600" : pm25Delta < 0 ? "text-emerald-600" : "text-gray-500"
                    )}>
                      {pm25Delta > 0 ? '+' : ''}{pm25Delta}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={pm25Delta}
                    onChange={(e) => setPm25Delta(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between mt-1 text-[10px] text-gray-400 uppercase font-bold tracking-tighter">
                    <span>大幅改善 (-50%)</span>
                    <span>无干预</span>
                    <span>大幅恶化 (+50%)</span>
                  </div>
                </div>

                <button
                  onClick={handleWhatIf}
                  disabled={whatIfLoading || result?.modelComparison?.datasetShape !== 'regression'}
                  className="w-full bg-gray-900 hover:bg-black text-white py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                >
                  {whatIfLoading ? <RefreshCw className="animate-spin" size={16} /> : <Search size={16} />}
                  运行模拟预测
                </button>

                {result?.modelComparison?.datasetShape !== 'regression' && (
                  <p className="text-xs text-gray-500">
                    当前数据推荐的默认路线不是回归分析，What-If 预测仅在回归型数据上启用。
                  </p>
                )}

                {whatIfResponse && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl"
                  >
                    <p className="text-xs text-emerald-900 leading-relaxed whitespace-pre-wrap">
                      {whatIfResponse}
                    </p>
                  </motion.div>
                )}
              </div>
            </section>

            <section className={cn(
              "bg-white rounded-2xl border border-gray-200 p-6 shadow-sm transition-opacity",
              !result && "opacity-50 pointer-events-none"
            )}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText size={20} className="text-emerald-600" />
                报告与论文初稿
              </h2>
              <div className="space-y-3">
                <button
                  onClick={handleGenerateReport}
                  disabled={reportLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                >
                  {reportLoading ? <RefreshCw className="animate-spin" size={16} /> : <FileText size={16} />}
                  {reportLoading ? '正在生成报告...' : '生成结构化报告'}
                </button>
                <button
                  onClick={handleGeneratePaperDraft}
                  disabled={paperLoading}
                  className="w-full bg-gray-900 hover:bg-black text-white py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                >
                  {paperLoading ? <RefreshCw className="animate-spin" size={16} /> : <ChevronRight size={16} />}
                  {paperLoading ? '正在生成初稿...' : '生成论文初稿'}
                </button>
                <p className="text-xs text-gray-500 leading-relaxed">
                  输出将附带证据链、局限说明与免责声明，适合用于科研讨论和初稿整理。
                </p>
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageSquare size={20} className="text-emerald-600" />
                多人协作研究室
              </h2>
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-1">协作策略</p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    采用“房间码 + 共享任务板 + 决策备注流 + 轮询同步”的轻协作策略，适合研究小组多人并行推进建模、审查和论文整理。
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 block">房间号</label>
                    <input
                      value={collabRoomId}
                      onChange={(e) => setCollabRoomId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none"
                      placeholder="例如 envinsight-demo-room"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 block">你的名字</label>
                    <input
                      value={collabName}
                      onChange={(e) => setCollabName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none"
                      placeholder="例如 Analyst Wang"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(['lead', 'analyst', 'reviewer'] as CollaborationRole[]).map((role) => (
                    <button
                      key={role}
                      onClick={() => setCollabRole(role)}
                      className={cn(
                        "px-3 py-2 rounded-full text-xs font-bold uppercase tracking-widest border transition-all",
                        collabRole === role
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      )}
                    >
                      {role}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleJoinCollaboration}
                    disabled={collabLoading}
                    className="flex-1 bg-gray-900 hover:bg-black text-white py-2.5 rounded-xl text-sm font-medium transition-all"
                  >
                    {collabLoading ? '正在加入...' : '加入 / 创建协作房间'}
                  </button>
                  <button
                    onClick={() => setCollabRoomId('envinsight-demo-room')}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-emerald-200"
                  >
                    使用示例房间
                  </button>
                  {result?.trace?.datasetId && (
                    <button
                      onClick={() => setCollabRoomId(result.trace!.datasetId)}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-emerald-200"
                    >
                      使用当前数据集房间
                    </button>
                  )}
                </div>

                {collabRoom ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{collabRoom.name}</p>
                          <p className="text-xs text-gray-500 mt-1">{collabRoom.objective}</p>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                          {collabRoom.id}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-3 leading-relaxed">{collabRoom.strategy}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={copyCollaborationLink}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:border-emerald-200 hover:text-emerald-700"
                        >
                          <Copy size={14} />
                          复制邀请链接
                        </button>
                        {currentCollabMember && (
                          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                            你当前是 {currentCollabMember.role}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-gray-200 p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">成员在线</p>
                        <div className="space-y-2">
                          {collabRoom.members.map((member) => (
                            <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{member.name}</p>
                                <p className="text-[10px] uppercase tracking-widest text-gray-400">{member.role}</p>
                              </div>
                              <p className="text-[10px] text-gray-400">{new Date(member.lastSeen).toLocaleTimeString()}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-gray-200 p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">共享任务板</p>
                        <p className="text-[11px] text-gray-500 mb-3">
                          角色权限：`lead` 可创建任务，`lead/reviewer` 可切换状态，`analyst` 主要负责补充备注。
                        </p>
                        <div className="space-y-2">
                          {collabRoom.tasks.map((task) => (
                            <button
                              key={task.id}
                              onClick={() => handleToggleCollaborationTask(task.id)}
                              disabled={!canToggleTask}
                              className={cn(
                                "w-full text-left rounded-xl px-3 py-2 border transition-all disabled:opacity-60 disabled:cursor-not-allowed",
                                task.status === 'done'
                                  ? "bg-emerald-50 border-emerald-200"
                                  : "bg-gray-50 border-gray-200 hover:border-emerald-200"
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-gray-900">{task.title}</p>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">{task.statusLabel || task.status}</span>
                              </div>
                              <p className="text-[10px] text-gray-400 mt-1">{task.ownerName || '未指派'}</p>
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <input
                            value={collabTaskInput}
                            onChange={(e) => setCollabTaskInput(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none"
                            placeholder="添加新的协作任务"
                          />
                          <button
                            onClick={handleAddCollaborationTask}
                            disabled={!canCreateTask}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:bg-gray-300"
                          >
                            添加
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">研究备注流</p>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {collabRoom.notes.map((note) => (
                          <div key={note.id} className="rounded-xl bg-gray-50 px-3 py-3 border border-gray-200">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-gray-900">{note.authorName}</p>
                              <span className="text-[10px] uppercase tracking-widest text-gray-400">{note.kind}</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-2 leading-relaxed">{note.content}</p>
                          </div>
                        ))}
                      </div>
                      <textarea
                        value={collabNoteInput}
                        onChange={(e) => setCollabNoteInput(e.target.value)}
                        rows={3}
                        className="w-full mt-3 px-3 py-3 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none"
                        placeholder="记录结论、需要复核的问题或下一步安排"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => handleAddCollaborationNote('note')}
                          disabled={!collabMemberId}
                          className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-black disabled:bg-gray-300"
                        >
                          发送备注
                        </button>
                        <button
                          onClick={() => handleAddCollaborationNote('decision')}
                          disabled={!canCreateDecision}
                          className="px-4 py-2 rounded-xl border border-emerald-200 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:border-gray-200 disabled:text-gray-400 disabled:bg-gray-100"
                        >
                          标记为决策
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">协作历史</p>
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {collabRoom.activities.map((activity) => (
                          <div key={activity.id} className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-gray-900">
                                {activity.actorName}
                                {activity.actorRole ? <span className="text-[10px] text-gray-400 ml-2 uppercase">{activity.actorRole}</span> : null}
                              </p>
                              <span className="text-[10px] uppercase tracking-widest text-gray-400">{activity.action}</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{activity.detail}</p>
                            <p className="text-[10px] text-gray-400 mt-2">{new Date(activity.createdAt).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    先加入示例房间或基于当前数据集创建房间，即可让多位研究成员共享任务、同步结论和协同推进论文整理。
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">R-Squared (拟合度)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {result ? result.summary.rSquared.toFixed(3) : '--'}
                </p>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                  <Info size={10} />
                  模型对变异的解释程度
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">P-Value (显著性)</p>
                <p className={cn(
                  "text-2xl font-bold",
                  result && result.summary.pValue != null && result.summary.pValue < 0.05 ? "text-emerald-600" : "text-gray-900"
                )}>
                  {result ? (result.summary.pValue == null ? 'N/A' : result.summary.pValue.toFixed(3)) : '--'}
                </p>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-medium">
                  {result && result.summary.pValue != null ? (
                    result.summary.pValue < 0.05 ? (
                    <span className="text-emerald-600 flex items-center gap-1"><TrendingDown size={10} /> 基于 t 检验，统计学显著</span>
                  ) : (
                    <span className="text-gray-400 flex items-center gap-1"><TrendingUp size={10} /> 基于 t 检验，统计学不显著</span>
                  )
                  ) : (
                    <span className="text-gray-400 flex items-center gap-1"><Info size={10} /> 样本不足，暂不显示显著性</span>
                  )}
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Beta (影响系数)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {result ? result.summary.coefficients.pm25.toFixed(4) : '--'}
                </p>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-gray-500">
                  每单位 {result?.columns.x || '自变量'} 变化对 {result?.columns.y || '目标变量'} 的影响
                </div>
              </div>
            </div>

            <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp size={20} className="text-emerald-600" />
                  回归分析可视化
                </h2>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500"></div>
                    观测数据点
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-0.5 bg-emerald-600"></div>
                    OLS 拟合线
                  </div>
                </div>
              </div>
              <div className="h-[350px] w-full">
                {result ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F3F5" />
                      <XAxis type="number" dataKey="x" name={result.columns.x} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#868E96' }} />
                      <YAxis type="number" dataKey="y" name={result.columns.y} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#868E96' }} />
                      <ZAxis type="number" range={[60, 60]} />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Scatter name="数据点" data={result.data} fill="#10B981" fillOpacity={0.4} stroke="#059669" />
                      <Line type="monotone" dataKey="y" stroke="#059669" strokeWidth={2} dot={false} activeDot={false} />
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <Activity size={48} className="mb-4 opacity-20" />
                    <p className="text-sm font-medium">等待数据上传以生成可视化图表</p>
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Info size={20} className="text-emerald-600" />
                  数据体检与多模型对比
                </h2>
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  {result?.profile?.datasetShape || '待分析'}
                </span>
              </div>
              {result?.profile ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">质量评分</p>
                      <p className="text-2xl font-bold text-gray-900">{result.profile.qualityScore}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">数据规模</p>
                      <p className="text-2xl font-bold text-gray-900">{result.profile.rowCount} / {result.profile.columnCount}</p>
                      <p className="text-[10px] text-gray-500 mt-1">行 / 列</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">缺失单元</p>
                      <p className="text-2xl font-bold text-gray-900">{result.profile.missingCells}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">主要问题</p>
                    <div className="space-y-2">
                      {result.profile.issues.length > 0 ? result.profile.issues.map((issue) => (
                        <div key={issue} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
                          {issue}
                        </div>
                      )) : (
                        <p className="text-sm text-gray-500">当前未发现明显的数据质量阻断项。</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">候选模型</p>
                    {result.modelComparison && (
                      <div className="space-y-4 mb-4">
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-1">自动推荐</p>
                              <p className="text-lg font-bold text-gray-900">{result.modelComparison.bestModelName}</p>
                              <p className="text-sm text-gray-600 mt-1">{result.modelComparison.whyRecommended}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">目标变量</p>
                              <p className="text-sm font-semibold text-gray-900">{result.modelComparison.selectedTarget || '未指定'}</p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-gray-900">模型评分视图</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">点击卡片切换结果说明</p>
                          </div>
                          <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={result.modelComparison.runs}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="score" radius={[6, 6, 0, 0]} fill="#10b981" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(result.modelComparison?.runs || result.profile.recommendedModels).map((model: any) => (
                        <button
                          key={model.id}
                          onClick={() => result.modelComparison && setSelectedModelId(model.id)}
                          className={cn(
                            "rounded-2xl border p-4 text-left transition-all",
                            result.modelComparison && selectedModelId === model.id
                              ? "border-emerald-400 bg-emerald-50/60 shadow-sm"
                              : "border-gray-200 hover:border-emerald-200"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-gray-900">{model.name}</p>
                            <span className="text-xs font-bold text-emerald-600">
                              {result.modelComparison ? `Score ${model.score}` : `Fit ${model.fitScore}`}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-2">{result.modelComparison ? model.summary : model.reason}</p>
                          {result.modelComparison && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {Object.entries(model.metrics).slice(0, 3).map(([key, value]) => (
                                <span key={key} className="px-2 py-1 rounded-full bg-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                  {key}: {String(value)}
                                </span>
                              ))}
                            </div>
                          )}
                          {result.modelComparison && (
                            <p className="text-xs text-gray-500 mt-3">{model.rationale}</p>
                          )}
                          <ul className="mt-3 space-y-1 text-xs text-gray-500">
                            {model.limitations.map((item: string) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </button>
                      ))}
                    </div>
                    {selectedModel && (
                      <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">当前查看</p>
                            <p className="text-lg font-bold text-gray-900 mt-1">{selectedModel.name}</p>
                          </div>
                          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-xs font-bold text-emerald-600">
                            {selectedModel.family}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-3">{selectedModel.summary}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {Object.entries(selectedModel.metrics).map(([key, value]) => (
                            <span key={key} className="px-2 py-1 rounded-full bg-white border border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                              {key}: {String(value)}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-gray-600 mt-3">{selectedModel.rationale}</p>
                        <ul className="mt-3 space-y-1 text-xs text-gray-500">
                          {selectedModel.limitations.map((item) => (
                            <li key={item}>- {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">分析完成后，这里会展示数据体检结果、多模型对比和最优模型推荐。</p>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Activity size={20} className="text-emerald-600" />
                  AI 智能解读
                </h2>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                  OpenAI
                </span>
              </div>

              <div className="p-6 min-h-[300px]">
                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center h-full py-20 space-y-4">
                    <div className="flex gap-1">
                      <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 bg-emerald-600 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-emerald-600 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-emerald-600 rounded-full" />
                    </div>
                    <p className="text-sm text-gray-500 font-medium">EnvInsight AI 正在深度分析数据逻辑...</p>
                  </div>
                ) : aiResponse ? (
                  <div className="prose prose-sm max-w-none">
                    <div className="space-y-6">
                      {(() => {
                        const sections = aiResponse.split(/(\[思考过程\]|\[正式回答\])/g);
                        let currentType: 'none' | 'thought' | 'answer' = 'none';
                        return sections.map((part, i) => {
                          if (part === '[思考过程]') { currentType = 'thought'; return null; }
                          else if (part === '[正式回答]') { currentType = 'answer'; return null; }
                          if (!part.trim()) return null;
                          if (currentType === 'thought') {
                            return (
                              <div key={i} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <Search size={12} /> 思考过程
                                </h4>
                                <div className="text-gray-600 italic text-sm leading-relaxed">
                                  <ReactMarkdown>{part.trim()}</ReactMarkdown>
                                </div>
                              </div>
                            );
                          }
                          if (currentType === 'answer') {
                            return (
                              <div key={i}>
                                <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                  <ChevronRight size={12} /> 分析结论
                                </h4>
                                <div className="text-gray-800 text-sm leading-relaxed">
                                  <ReactMarkdown>{part.trim()}</ReactMarkdown>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={i} className="text-gray-800 text-sm leading-relaxed">
                              <ReactMarkdown>{part.trim()}</ReactMarkdown>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-gray-400">
                    <Activity size={48} className="mb-4 opacity-20" />
                    <p className="text-sm font-medium">上传数据后，AI 将自动生成深度解读报告</p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                <p className="text-[10px] text-gray-400 flex items-center gap-1.5">
                  <ShieldAlert size={12} />
                  本建议基于统计数据生成，仅供参考，不构成医疗诊断。如有不适请咨询专业医生。
                </p>
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Newspaper size={20} className="text-emerald-600" />
                  研究结果回流资讯
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">News Loop</span>
              </div>
              <div className="p-6">
                {workbenchFeedback ? (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{workbenchFeedback.headline}</h3>
                      <p className="text-sm text-gray-600 mt-2 leading-relaxed">{workbenchFeedback.summary}</p>
                    </div>
                    <KeyValueList title="适合回流到资讯侧的亮点" items={workbenchFeedback.highlights} />
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-2">发布前提醒</p>
                      <p className="text-sm text-amber-900 leading-relaxed">{workbenchFeedback.caution}</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      这块用于把科研工作台里的分析结果重新整理成大众资讯摘要，实现“论文线索 → 本地验证 → 公众解读”的闭环。
                    </p>
                    {publishReview && (
                      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">能不能直接上传到资讯流？</p>
                            <h4 className="text-lg font-bold text-gray-900 mt-1">{publishReview.headline}</h4>
                            <p className="text-sm text-gray-600 mt-2 leading-relaxed">{publishReview.summary}</p>
                          </div>
                          <span
                            className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                              publishReview.verdict === 'blocked'
                                ? "bg-red-50 text-red-600 border border-red-200"
                                : publishReview.verdict === 'review_required'
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            )}
                          >
                            {publishReview.verdict === 'blocked'
                              ? '禁止直发'
                              : publishReview.verdict === 'review_required'
                                ? '需人工复核'
                                : '可进入编辑流程'}
                          </span>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">建议的大众资讯草稿</p>
                          <h5 className="text-base font-bold text-gray-900">{publishReview.publicDraftTitle}</h5>
                          <p className="text-sm text-gray-600 mt-2">{publishReview.publicDraftSummary}</p>
                          <div className="mt-3 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                            {publishReview.publicDraftBody}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">直接上传会遇到的问题，以及怎么解决</p>
                          <div className="space-y-3">
                            {publishReview.riskItems.map((risk) => (
                              <div key={`${risk.title}-${risk.issue}`} className="rounded-2xl border border-gray-200 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold text-gray-900">{risk.title}</p>
                                  <span
                                    className={cn(
                                      "text-[10px] font-bold uppercase tracking-widest",
                                      risk.severity === 'high'
                                        ? "text-red-600"
                                        : risk.severity === 'medium'
                                          ? "text-amber-600"
                                          : "text-emerald-600"
                                    )}
                                  >
                                    {risk.severity}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mt-2 leading-relaxed">{risk.issue}</p>
                                <p className="text-sm text-emerald-700 mt-2 leading-relaxed">解决方案：{risk.solution}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <KeyValueList title="推荐发布流程" items={publishReview.requiredActions} />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    先导入一篇资讯论文，或先完成一次工作台分析；系统会把结果整理成可回流到资讯侧的公众版摘要。
                  </p>
                )}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileText size={20} className="text-emerald-600" />
                  结构化报告
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Traceable</span>
              </div>
              <div className="p-6">
                {report ? (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{report.title}</h3>
                      <p className="text-sm text-gray-600 mt-2">{report.executiveSummary}</p>
                    </div>
                    <KeyValueList title="关键发现" items={report.keyFindings} />
                    <KeyValueList title="局限说明" items={report.limitations} />
                    <KeyValueList title="下一步建议" items={report.nextSteps} />
                    <EvidenceList items={report.evidence} />
                    <p className="text-xs text-gray-500 border-t border-gray-100 pt-4">{report.disclaimer}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">点击左侧“生成结构化报告”后，这里会展示摘要、局限说明和证据链。</p>
                )}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ChevronRight size={20} className="text-emerald-600" />
                  论文初稿
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">IMRaD</span>
              </div>
              <div className="p-6">
                {paperDraft ? (
                  <div className="space-y-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                      <h3 className="text-xl font-bold text-gray-900">{paperDraft.title}</h3>
                      <p className="text-xs text-gray-500 mt-2">{paperDraft.disclaimer}</p>
                      </div>
                      <button
                        onClick={exportPaperMarkdown}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-600 hover:border-emerald-200 hover:text-emerald-700 transition-all"
                      >
                        <Copy size={14} />
                        复制 Markdown
                      </button>
                    </div>
                    <DraftSection title="Abstract" content={paperDraft.abstract} />
                    <DraftSection title="Introduction" content={paperDraft.introduction} />
                    <DraftSection title="Methods" content={paperDraft.methods} />
                    <DraftSection title="Results" content={paperDraft.results} />
                    <DraftSection title="Discussion" content={paperDraft.discussion} />
                    <DraftSection title="Limitations" content={paperDraft.limitations} />
                    <EvidenceList items={paperDraft.evidenceMap} />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">点击左侧“生成论文初稿”后，这里会生成结构化的 IMRaD 草稿和证据映射。</p>
                )}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart2 size={20} className="text-emerald-600" />
                  审计轨迹
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {result?.trace?.datasetId || 'No dataset'}
                </span>
              </div>
              <div className="p-6">
                {auditTrail.length > 0 ? (
                  <div className="space-y-3">
                    {auditTrail.map((item) => (
                      <div key={item.id} className="rounded-xl border border-gray-200 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-gray-900">{item.action}</p>
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-widest",
                            item.status === 'success' ? "text-emerald-600" : item.status === 'warning' ? "text-amber-600" : "text-red-600"
                          )}>
                            {item.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{item.summary}</p>
                        <p className="text-[10px] text-gray-400 mt-2">{item.timestamp}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">关键链路执行后，这里会展示审计日志与留痕信息。</p>
                )}
              </div>
            </section>
          </div>
        </main>
      )}

      <footer className="bg-white border-t border-gray-200 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Activity size={16} />
            <span className="text-xs font-bold uppercase tracking-widest">EnvInsight AI Pro</span>
          </div>
          <div className="flex gap-8">
            <a href="#" className="text-xs text-gray-500 hover:text-emerald-600 font-medium transition-colors">用户协议</a>
            <a href="#" className="text-xs text-gray-500 hover:text-emerald-600 font-medium transition-colors">隐私政策</a>
            <a href="#" className="text-xs text-gray-500 hover:text-emerald-600 font-medium transition-colors">技术文档</a>
          </div>
          <p className="text-xs text-gray-400">&copy; 2026 EnvInsight AI. All rights reserved.</p>
        </div>
      </footer>

      <div className="fixed right-6 bottom-6 z-[90] flex flex-col items-end gap-3">
        <AnimatePresence>
          {discussionOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="w-[min(92vw,420px)] h-[min(70vh,620px)] bg-white border border-gray-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Bot size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">与 AI 讨论</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">{view}</p>
                  </div>
                </div>
                <button onClick={() => setDiscussionOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#FAFBFB]">
                {discussionMessages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap max-w-[92%]",
                      message.role === 'assistant'
                        ? "bg-white border border-gray-200 text-gray-700"
                        : "ml-auto bg-gray-900 text-white"
                    )}
                  >
                    {message.content}
                  </div>
                ))}
                {discussionLoading && (
                  <div className="rounded-2xl px-4 py-3 text-sm bg-white border border-gray-200 text-gray-500 w-fit">
                    EnvInsight AI 正在整理建议...
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex items-end gap-3">
                  <textarea
                    value={discussionInput}
                    onChange={(e) => setDiscussionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleDiscussSubmit();
                      }
                    }}
                    rows={3}
                    placeholder="例如：这个数据该怎么脱敏？为什么推荐这个模型？论文结果段还能怎么写？"
                    className="flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none"
                  />
                  <button
                    onClick={handleDiscussSubmit}
                    disabled={discussionLoading || !discussionInput.trim()}
                    className="shrink-0 h-12 w-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white flex items-center justify-center transition-all"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setDiscussionOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-5 py-3 rounded-full shadow-lg"
        >
          <Sparkles size={16} />
          与 AI 讨论
        </button>
      </div>

      <AnimatePresence>
        {showDisclaimer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-gray-200"
            >
              <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto">
                <ShieldAlert className="text-red-600 w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-center mb-4">合规免责声明</h3>
              <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                <p>欢迎使用 EnvInsight AI Pro。在使用本系统前，请仔细阅读以下条款：</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>本系统生成的分析结论基于用户上传的统计数据，仅供科研与决策参考。</li>
                  <li className="font-bold text-red-600">本系统不提供任何形式的医疗诊断、用药建议或临床指导。</li>
                  <li>环境健康受多种复杂因素影响，统计相关性不代表必然的因果关系。</li>
                  <li>用户需自行承担基于本系统结论所采取行动的一切风险。</li>
                </ul>
                <p className="pt-2">点击"我已阅读并同意"即表示您接受上述条款。</p>
              </div>
              <button
                onClick={() => setShowDisclaimer(false)}
                className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-2xl font-bold mt-8 transition-all shadow-lg shadow-gray-200"
              >
                我已阅读并同意
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function KeyValueList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{title}</h4>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidenceList({ items }: { items: { label: string; value: string; source: string }[] }) {
  return (
    <div>
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">证据链</h4>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={`${item.label}-${item.source}`} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-900">{item.label}</p>
              <span className="text-xs font-bold text-emerald-600">{item.value}</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">{item.source}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DraftSection({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{title}</h4>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

function AnalyticsDashboard({ data, onBack }: { data: AnalyticsEvent[]; onBack: () => void }) {
  const eventCounts = data.reduce((acc: any, curr) => {
    acc[curr.eventName] = (acc[curr.eventName] || 0) + 1;
    return acc;
  }, {});
  const barData = Object.entries(eventCounts).map(([name, value]) => ({ name, value }));

  const elementCounts = data.reduce((acc: any, curr) => {
    acc[curr.elementId] = (acc[curr.elementId] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(elementCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a: any, b: any) => b.value - a.value)
    .slice(0, 5);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">数据看板</h2>
          <p className="text-gray-500">本地存储的用户交互与功能使用情况</p>
        </div>
        <button onClick={onBack} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-all">
          返回资讯
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">事件类型分布</h3>
          <div className="h-64">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">暂无数据</div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">热门交互元素 (Top 5)</h3>
          <div className="h-64">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">暂无数据</div>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {pieData.map((item: any, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-xs text-gray-600 truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">最近活动日志</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4">时间</th>
                <th className="px-6 py-4">事件</th>
                <th className="px-6 py-4">元素 ID</th>
                <th className="px-6 py-4">用户 ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.slice(0, 50).map((event) => (
                <tr key={event.id} className="text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">{event.timestamp || '刚刚'}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold uppercase">
                      {event.eventName}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">{event.elementId}</td>
                  <td className="px-6 py-4 font-mono text-xs truncate max-w-[100px]">{event.userId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NewsStrip({ item, onClick }: { item: NewsItem; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ x: 4 }}
      onClick={() => {
        trackEvent('click', 'news_strip_item', { newsId: item.id });
        onClick();
      }}
      className="flex items-center gap-6 p-4 bg-white rounded-2xl border border-gray-100 cursor-pointer transition-all hover:border-emerald-200 hover:shadow-md group"
    >
      <div className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 rounded-xl overflow-hidden">
        <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">
          <span className="text-emerald-600">{item.category}</span>
          <span className="mx-1">&bull;</span>
          {item.date}
          {item.isOpenAccess ? (
            <>
              <span className="mx-1">&bull;</span>
              <span className="text-emerald-600">OA</span>
            </>
          ) : null}
          {item.citedByCount != null ? (
            <>
              <span className="mx-1">&bull;</span>
              <span className="normal-case">被引 {item.citedByCount}</span>
            </>
          ) : null}
          {item.sourceJournal ? (
            <>
              <span className="mx-1">&bull;</span>
              <span className="truncate max-w-[140px] normal-case">{item.sourceJournal}</span>
            </>
          ) : null}
        </div>
        <h3 className="text-lg font-bold text-gray-900 leading-tight mb-2 group-hover:text-emerald-600 transition-colors truncate">
          {item.title}
        </h3>
        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed hidden md:block">{item.summary}</p>
      </div>
      <div className="hidden md:block">
        <ChevronRight size={20} className="text-gray-300 group-hover:text-emerald-500 transition-colors" />
      </div>
    </motion.div>
  );
}

function NewsCard({ item, featured, onClick }: { item: NewsItem; featured?: boolean; onClick: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={() => {
        trackEvent('click', 'news_card_item', { newsId: item.id });
        onClick();
      }}
      className={cn(
        "bg-white rounded-2xl border border-gray-100 overflow-hidden cursor-pointer transition-all hover:shadow-xl hover:border-emerald-100 group",
        featured ? "md:col-span-2 md:flex" : ""
      )}
    >
      <div className={cn("relative overflow-hidden", featured ? "md:w-1/2 h-64 md:h-auto" : "h-48")}>
        <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
        <div className="absolute top-4 left-4">
          <span className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold text-emerald-700 uppercase tracking-wider shadow-sm">
            {item.category}
          </span>
        </div>
      </div>
      <div className={cn("p-6 flex flex-col justify-between", featured ? "md:w-1/2" : "")}>
        <div>
          <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">
            <Globe size={10} />
            <Calendar size={10} />
            {item.date}
            {item.isOpenAccess ? <span className="text-emerald-600">OA</span> : null}
            {item.citedByCount != null ? <span className="normal-case">被引 {item.citedByCount}</span> : null}
            {item.sourceJournal ? <span className="normal-case truncate max-w-[140px]">{item.sourceJournal}</span> : null}
          </div>
          <h3 className={cn("font-bold text-gray-900 leading-tight group-hover:text-emerald-600 transition-colors", featured ? "text-2xl mb-3" : "text-lg mb-2")}>
            {item.title}
          </h3>
          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{item.summary}</p>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 group-hover:gap-2 transition-all">
            阅读全文 <ChevronRight size={14} />
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function LikeButton({ newsId, initialLikes }: { newsId: string; initialLikes: number }) {
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLike = async () => {
    if (loading) return;
    trackEvent('click', 'like_button', { newsId, action: isLiked ? 'unlike' : 'like' });
    setLoading(true);
    try {
      if (!isLiked) {
        const newCount = await likeNews(newsId);
        setLikes(newCount);
        setIsLiked(true);
      }
    } catch (err) {
      console.error('Like failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLike}
      disabled={loading}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
        isLiked
          ? "bg-red-50 text-red-600 border border-red-100"
          : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100"
      )}
    >
      <motion.div
        animate={isLiked ? { scale: [1, 1.4, 1] } : { scale: 1 }}
        whileTap={{ scale: 0.8 }}
        transition={{ duration: 0.3 }}
      >
        <Heart size={18} className={cn(isLiked && "fill-current")} />
      </motion.div>
      <span className="font-bold text-sm">{likes}</span>
    </button>
  );
}

function CommentSection({ newsId, initialComments }: { newsId: string; initialComments: Comment[] }) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const currentUser = getStoredUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!newComment.trim() || loading) return;

    trackEvent('click', 'submit_comment_button', { newsId });
    setLoading(true);
    try {
      const comment = await addComment(newsId, currentUser.displayName, newComment);
      setComments(prev => [...prev, comment]);
      setNewComment('');
    } catch (err) {
      console.error('Comment failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-16 pt-12 border-t border-gray-100">
      <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-2">
        <MessageSquare size={24} className="text-emerald-600" />
        评论交流 ({comments.length})
      </h3>

      <form onSubmit={handleSubmit} className="mb-10">
        <div className="relative">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={currentUser ? "分享你的看法..." : "请登录后发表评论"}
            disabled={!currentUser}
            className="w-full p-4 pr-16 rounded-2xl bg-gray-50 border border-gray-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none resize-none h-24 text-sm disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || loading || !currentUser}
            className="absolute right-3 bottom-3 p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:scale-95"
          >
            <Send size={20} />
          </button>
        </div>
      </form>

      <div className="space-y-6">
        {comments.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <MessageSquare size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">暂无评论，快来抢沙发吧！</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs shrink-0">
                {comment.userName[0]}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-gray-900">{comment.userName}</span>
                  <span className="text-[10px] text-gray-400 font-medium">{comment.timestamp}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{comment.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NewsDetail({
  item,
  onBack,
  user,
  onLogin,
  onImportToWorkbench,
}: {
  item: NewsItem;
  onBack: () => void;
  user: UserType | null;
  onLogin: () => void;
  onImportToWorkbench: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm"
    >
      <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-medium text-sm">
          <ArrowLeft size={18} />
          返回资讯列表
        </button>
        <div className="flex items-center gap-3">
          <LikeButton newsId={item.id} initialLikes={item.likesCount || 0} />
          <div className="h-6 w-px bg-gray-100 mx-1" />
          <button
            onClick={() => {
              if (!user) {
                onLogin();
                return;
              }
              onImportToWorkbench();
            }}
            className="bg-gray-900 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all hover:bg-black"
          >
            导入科研工作台
          </button>
          <button
            onClick={() => trackEvent('click', 'share_news_button', { newsId: item.id })}
            className="bg-emerald-600 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all hover:bg-emerald-700"
          >
            分享资讯
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-6">
          <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            {item.category}
          </span>
          <span className="text-gray-400 text-sm flex items-center gap-1">
            <Calendar size={14} /> {item.date}
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">{item.title}</h1>

        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-6 rounded-r-2xl mb-10">
          <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">核心结论</h4>
          <p className="text-xl font-medium text-emerald-900 italic">&ldquo;{item.summary}&rdquo;</p>
        </div>

        <div className="rounded-3xl overflow-hidden mb-12 shadow-2xl">
          <img src={item.imageUrl} alt="Concept" className="w-full aspect-video object-cover" />
          <div className="bg-gray-900 p-4 text-center">
            <p className="text-xs text-gray-400 italic">概念示意图</p>
          </div>
        </div>

        <div className="prose prose-lg max-w-none text-gray-800 leading-relaxed space-y-8">
          {item.content.split('\n\n').map((para, i) => (
            <p key={i} className="whitespace-pre-wrap">{para}</p>
          ))}
        </div>

        {item.translatedAbstract && (
          <div className="mt-12 rounded-3xl border border-gray-100 bg-gray-50 p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">摘要通俗版</h3>
            <p className="text-base text-gray-700 leading-relaxed">{item.translatedAbstract}</p>
            {item.explainers?.plainLanguageSummary && (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-white px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-2">一句大白话</p>
                <p className="text-sm text-gray-700 leading-relaxed">{item.explainers.plainLanguageSummary}</p>
              </div>
            )}
          </div>
        )}

        {item.explainers && (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            {item.explainers.translatedTitle && (
              <div className="rounded-3xl border border-gray-100 p-6 md:col-span-2">
                <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-600 mb-3">论文标题怎么理解</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{item.explainers.translatedTitle}</p>
              </div>
            )}
            <div className="rounded-3xl border border-gray-100 p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-600 mb-3">为什么值得关注</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{item.explainers.whyItMatters}</p>
            </div>
            <div className="rounded-3xl border border-gray-100 p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-600 mb-3">研究是怎么做的</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{item.explainers.howStudyWorked}</p>
            </div>
            <div className="rounded-3xl border border-gray-100 p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-600 mb-3">这篇论文最值得记住的点</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                {item.explainers.keyFindings.map((point) => (
                  <li key={point}>- {point}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-gray-100 p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-600 mb-3">局限与阅读提醒</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                {item.explainers.limitations.map((point) => (
                  <li key={point}>- {point}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-gray-100 p-6 md:col-span-2">
              <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-600 mb-3">对普通人意味着什么</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{item.explainers.everydayMeaning}</p>
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">继续读这篇论文时可以重点看</p>
                <ul className="space-y-2 text-sm text-gray-700">
                  {item.explainers.readerActions.map((point) => (
                    <li key={point}>- {point}</li>
                  ))}
                </ul>
              </div>
            </div>
            {item.explainers.publicCautions && item.explainers.publicCautions.length > 0 && (
              <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6 md:col-span-2">
                <h3 className="text-sm font-bold uppercase tracking-widest text-amber-700 mb-3">大众阅读时要注意什么</h3>
                <ul className="space-y-2 text-sm text-amber-900">
                  {item.explainers.publicCautions.map((point) => (
                    <li key={point}>- {point}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-16 pt-8 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold">AI</div>
            <div>
              <p className="text-sm font-bold text-gray-900">EnvInsight AI 科学记者</p>
              <p className="text-xs text-gray-500">基于 OpenAI 模型生成</p>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {item.sourceJournal && (
              <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full font-medium">
                {item.sourceJournal}
              </span>
            )}
            {item.citedByCount != null && (
              <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full font-medium">
                被引用 {item.citedByCount} 次
              </span>
            )}
            {item.isOpenAccess && (
              <span className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full font-medium">
                Open Access
              </span>
            )}
            {item.authors && item.authors.length > 0 && (
              <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full font-medium">
                {item.authors.slice(0, 3).join(" / ")}
              </span>
            )}
            {item.sourceLink && (
              <a href={item.sourceLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-sm">
                <ExternalLink size={16} />
                查看原始论文
              </a>
            )}
          </div>
        </div>

        <CommentSection newsId={item.id} initialComments={item.comments || []} />

        <div className="mt-12 p-6 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-xs text-gray-400 flex items-center gap-2">
            <ShieldAlert size={14} />
            免责声明：本文由 AI 自动翻译并科普化，不代表本平台立场，亦不构成医疗建议。
          </p>
        </div>
      </div>
    </motion.div>
  );
}
