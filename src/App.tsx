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
import { AnalysisResult, AnalysisMode, NewsItem, Comment, AnalyticsEvent } from './types';
import { getAIAnalysisStream, getWhatIfAnalysis } from './services/claudeService';
import {
  getStoredUser,
  setStoredUser,
  login as doLogin,
  logout as doLogout,
  fetchNews,
  crawlNews,
  likeNews,
  addComment,
  getUserInterests,
  updateUserInterest,
  trackEvent,
  getAnalytics,
} from './services/localDataService';
import type { User as UserType } from './types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [userInterests, setUserInterests] = useState<Record<string, number>>({});
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('全部');
  const reportRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'news' | 'workbench' | 'analytics'>('news');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsEvent[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      setUser(stored);
      setUserInterests(getUserInterests());
    }
  }, []);

  useEffect(() => {
    if (view === 'analytics') {
      setAnalyticsData(getAnalytics());
    }
    if (view === 'news') {
      loadNews(searchQuery);
    }
  }, [view, activeCategory]);

  useEffect(() => {
    if (result) {
      triggerAIAnalysis(result, mode);
    }
  }, [mode]);

  const loadNews = async (queryStr?: string) => {
    setNewsLoading(true);
    try {
      const items = await fetchNews({ q: queryStr, category: activeCategory });

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
      await crawlNews();
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
    setFile(uploadedFile);
    setError(null);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setResult(data);
      triggerAIAnalysis(data, mode);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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

  const handleWhatIf = async () => {
    if (!result) return;
    trackEvent('click', 'run_simulation_button', { pm25Delta });
    setWhatIfLoading(true);
    try {
      const predictedChange = result.summary.coefficients.pm25 * (pm25Delta / 100 * result.data[0].x);
      const response = await getWhatIfAnalysis(
        { pm25Change: pm25Delta, predictedDiseaseChange: predictedChange },
        result.summary.coefficients.pm25
      );
      setWhatIfResponse(response);
    } catch (err) {
      setWhatIfResponse('模拟分析失败。');
    } finally {
      setWhatIfLoading(false);
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
            />
          ) : (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex-1">
                  <h2 className="text-3xl font-bold text-gray-900">环境健康头条</h2>
                  <p className="text-gray-500 mt-1">AI 驱动的全球环境科研资讯实时解读</p>
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
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                  {['全部', ...(user ? ['为你推荐'] : []), '空气质量', '气候变化', '流行病学', '政策解读'].map(cat => (
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
                    title="抓取最新论文"
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
                <p className="text-xs text-gray-500 mt-1">支持 PM2.5 与 疾病率 相关数据</p>
              </div>

              <button
                onClick={async () => {
                  trackEvent('click', 'use_sample_data_button');
                  setLoading(true);
                  try {
                    const res = await fetch('/api/sample-data');
                    const sampleData = await res.json();
                    const csvContent = "pm25,disease_rate\n" + sampleData.map((d: any) => `${d.pm25},${d.disease_rate}`).join("\n");
                    const csvBlob = new Blob([csvContent], { type: 'text/csv' });
                    const csvFile = new File([csvBlob], 'sample_data.csv', { type: 'text/csv' });
                    const uploadFormData = new FormData();
                    uploadFormData.append('file', csvFile);
                    const analyzeRes = await fetch('/api/analyze', { method: 'POST', body: uploadFormData });
                    const resultData = await analyzeRes.json();
                    setResult(resultData);
                    setFile(csvFile);
                    triggerAIAnalysis(resultData, mode);
                  } catch (err: any) {
                    setError(err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="w-full mt-4 text-xs text-emerald-600 font-bold uppercase tracking-widest hover:text-emerald-700 transition-colors py-2 border border-emerald-100 rounded-lg bg-emerald-50/50"
              >
                使用示例数据进行演示
              </button>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              {loading && (
                <div className="mt-4 flex items-center justify-center gap-2 text-emerald-600 text-sm font-medium">
                  <RefreshCw className="animate-spin" size={16} />
                  正在进行 OLS 回归分析...
                </div>
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
                    <label className="text-sm font-medium text-gray-700">环境变量 (PM2.5) 调整</label>
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
                  disabled={whatIfLoading}
                  className="w-full bg-gray-900 hover:bg-black text-white py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                >
                  {whatIfLoading ? <RefreshCw className="animate-spin" size={16} /> : <Search size={16} />}
                  运行模拟预测
                </button>

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
                  result && result.summary.pValue < 0.05 ? "text-emerald-600" : "text-gray-900"
                )}>
                  {result ? result.summary.pValue.toFixed(3) : '--'}
                </p>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-medium">
                  {result && result.summary.pValue < 0.05 ? (
                    <span className="text-emerald-600 flex items-center gap-1"><TrendingDown size={10} /> 统计学显著</span>
                  ) : (
                    <span className="text-gray-400 flex items-center gap-1"><TrendingUp size={10} /> 统计学不显著</span>
                  )}
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Beta (影响系数)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {result ? result.summary.coefficients.pm25.toFixed(4) : '--'}
                </p>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-gray-500">
                  每单位 PM2.5 变化对疾病率的影响
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
                      <XAxis type="number" dataKey="x" name="PM2.5" unit=" μg/m³" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#868E96' }} />
                      <YAxis type="number" dataKey="y" name="疾病率" unit="%" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#868E96' }} />
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

            <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Activity size={20} className="text-emerald-600" />
                  AI 智能解读
                </h2>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                  Powered by Claude
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

function NewsDetail({ item, onBack, user, onLogin }: { item: NewsItem; onBack: () => void; user: UserType | null; onLogin: () => void }) {
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

        <div className="mt-16 pt-8 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold">AI</div>
            <div>
              <p className="text-sm font-bold text-gray-900">EnvInsight AI 科学记者</p>
              <p className="text-xs text-gray-500">基于 Claude AI 模型生成</p>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {item.sourceJournal && (
              <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full font-medium">
                {item.sourceJournal}
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
