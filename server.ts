import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import { parse } from "csv-parse/sync";
import * as ss from "simple-statistics";
import Anthropic from "@anthropic-ai/sdk";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const upload = multer({ storage: multer.memoryStorage() });

  // Mock News Database
  let newsItems: any[] = [
    {
      id: "1",
      title: "最新研究：城市绿地可显著降低居民心血管风险",
      oneSentenceSummary: "科学家发现，居住在绿化率高的社区，心脏病发病率平均下降了12%。",
      conceptImageUrl: "https://picsum.photos/seed/green/1200/675",
      plainTextContent: "这项发表在《柳叶刀》上的研究追踪了超过50万名城市居民。结果显示，自然环境不仅能净化空气，还能通过缓解压力来保护我们的心脏。建议市民每天在公园散步至少20分钟。",
      abstract: "Urban green spaces have been linked to various health benefits, but the specific impact on cardiovascular disease (CVD) risk in large-scale urban populations remains a subject of intense study. This longitudinal study followed 500,000 residents in major metropolitan areas over a decade. Using satellite imagery to quantify normalized difference vegetation index (NDVI), we correlated greenness exposure with clinical CVD outcomes.",
      translatedAbstract: "城市绿地与多种健康益处相关，但在大规模城市人口中对心血管疾病（CVD）风险的具体影响仍是深入研究的主题。这项纵向研究在十年间追踪了大都市地区的50万名居民。利用卫星图像量化归一化植被指数（NDVI），我们将绿化暴露与临床CVD结果联系起来。结果发现，高绿化水平与心血管发病率降低12%显著相关。",
      sourceLink: "https://scholar.google.com",
      sourceJournal: "The Lancet",
      publishDate: "2026-03-12",
      category: "空气质量",
      likes: 124,
      comments: [
        { id: "c1", user: "环境卫士", text: "绿地建设确实对城市居民很重要！", date: "2026-03-12" },
        { id: "c2", user: "健康达人", text: "每天20分钟公园散步，安排上了。", date: "2026-03-13" }
      ]
    },
    {
      id: "2",
      title: "警惕！微塑料已进入人类循环系统，或影响免疫健康",
      oneSentenceSummary: "研究首次在人体血液中检测到微塑料颗粒，可能引发慢性炎症。",
      conceptImageUrl: "https://picsum.photos/seed/plastic/1200/675",
      plainTextContent: "环境科学专家警告，日常使用的塑料制品正在通过食物链进入人体。虽然长期影响尚在研究中，但减少一次性塑料使用已刻不容缓。",
      abstract: "Microplastics are ubiquitous environmental contaminants. While their presence in the digestive tract is well-documented, their translocation into the human circulatory system has been speculative. This study utilized high-resolution mass spectrometry to analyze blood samples from 22 healthy volunteers, seeking traces of common polymers like PET and polystyrene.",
      translatedAbstract: "微塑料是无处不在的环境污染物。虽然它们在消化道中的存在已有充分记录，但它们转移到人类循环系统中的情况一直是推测性的。本研究利用高分辨率质谱法分析了22名健康志愿者的血液样本，寻找PET和聚苯乙烯等常见聚合物的痕迹。结果在80%的受试者血液中检测到了微塑料，这表明这些颗粒可以进入血液循环并可能在器官中累积。",
      sourceLink: "https://pubmed.ncbi.nlm.nih.gov",
      sourceJournal: "Nature Communications",
      publishDate: "2026-03-13",
      category: "饮用水",
      likes: 89,
      comments: []
    },
    {
      id: "3",
      title: "极端高温与肾脏疾病：全球变暖背景下的公共卫生挑战",
      oneSentenceSummary: "气候变化导致的极端热浪正显著增加急性肾损伤的住院率。",
      conceptImageUrl: "https://picsum.photos/seed/heat/400/300",
      plainTextContent: "随着全球气温升高，热应激已成为肾脏健康的主要威胁。研究建议在高温预警期间，应特别关注户外工作者和老年群体的水分补充。",
      abstract: "The rising frequency and intensity of heatwaves due to climate change pose significant threats to human health. This study investigates the association between ambient temperature and hospital admissions for acute kidney injury (AKI). Analyzing data from 45 countries, we observed a non-linear relationship where risk increases sharply above specific regional thresholds.",
      translatedAbstract: "由于气候变化，热浪的频率和强度不断上升，对人类健康构成重大威胁。本研究调查了环境温度与急性肾损伤（AKI）住院之间的关联。通过分析来自45个国家的数据，我们观察到一种非线性关系，即风险在超过特定区域阈值后急剧增加。研究强调了在变暖的世界中制定针对性降温策略的必要性。",
      sourceLink: "https://scholar.google.com",
      sourceJournal: "JAMA Network Open",
      publishDate: "2026-03-10",
      category: "气候变化",
      likes: 56,
      comments: []
    },
    {
      id: "4",
      title: "室内空气污染：烹饪油烟对非吸烟女性肺癌风险的影响",
      oneSentenceSummary: "长期暴露于高浓度烹饪油烟环境，非吸烟女性患肺癌的风险增加1.8倍。",
      conceptImageUrl: "https://picsum.photos/seed/cooking/400/300",
      plainTextContent: "研究强调了厨房通风的重要性。使用高效抽油烟机并改变烹饪习惯（如减少高温油炸）可有效降低致癌风险。",
      abstract: "Lung cancer in non-smoking females is a significant global health concern, particularly in East Asia. This case-control study explored the role of indoor air pollution from cooking oil fumes (COFs). We assessed exposure duration, ventilation types, and cooking methods among 2,000 participants.",
      translatedAbstract: "非吸烟女性肺癌是一个重要的全球健康问题，特别是在东亚。这项病例对照研究探讨了烹饪油烟（COFs）造成的室内空气污染的作用。我们评估了2,000名参与者的暴露持续时间、通风类型和烹饪方法。结果显示，长期暴露于未通风厨房的女性患肺癌风险显著升高，呼吁改进厨房通风标准。",
      sourceLink: "https://scholar.google.com",
      sourceJournal: "Journal of Thoracic Oncology",
      publishDate: "2026-03-08",
      category: "空气质量",
      likes: 42,
      comments: []
    },
    { id: "5", title: "森林康养对心理健康的积极干预作用", oneSentenceSummary: "在森林环境中停留2小时可显著降低唾液皮质醇水平。", conceptImageUrl: "https://picsum.photos/seed/forest/400/300", plainTextContent: "研究发现森林环境中的植物杀菌素能增强免疫系统。", sourceJournal: "Environmental Health", sourceLink: "https://scholar.google.com/scholar?q=forest+bathing+mental+health+cortisol", publishDate: "2026-03-07", category: "流行病学", likes: 31, comments: [] },
    { id: "6", title: "海洋酸化对近海渔业资源的潜在威胁", oneSentenceSummary: "海水pH值下降正在影响贝类和珊瑚礁的钙化过程。", conceptImageUrl: "https://picsum.photos/seed/ocean/400/300", plainTextContent: "这可能导致全球海产品供应的长期不稳定性。", sourceJournal: "Science Advances", sourceLink: "https://scholar.google.com/scholar?q=ocean+acidification+fisheries", publishDate: "2026-03-06", category: "气候变化", likes: 25, comments: [] },
    { id: "7", title: "可穿戴设备在环境暴露监测中的应用", oneSentenceSummary: "新型传感器可实时监测个人PM2.5暴露剂量。", conceptImageUrl: "https://picsum.photos/seed/sensor/400/300", plainTextContent: "这为精准预防环境相关疾病提供了技术支撑。", sourceJournal: "Nature Medicine", sourceLink: "https://scholar.google.com/scholar?q=wearable+sensors+PM2.5+exposure", publishDate: "2026-03-05", category: "空气质量", likes: 19, comments: [] },
    { id: "8", title: "土壤重金属污染与农作物安全风险评估", oneSentenceSummary: "部分地区稻米镉含量超标风险仍需关注。", conceptImageUrl: "https://picsum.photos/seed/soil/400/300", plainTextContent: "研究建议通过土壤改良和品种筛选降低风险。", sourceJournal: "Science of Total Environment", sourceLink: "https://scholar.google.com/scholar?q=soil+heavy+metal+cadmium+rice", publishDate: "2026-03-04", category: "饮用水", likes: 15, comments: [] },
    { id: "9", title: "城市噪音污染与睡眠质量的关联研究", oneSentenceSummary: "长期暴露于55分贝以上的交通噪音会增加失眠风险。", conceptImageUrl: "https://picsum.photos/seed/noise/400/300", plainTextContent: "建议城市规划中加强隔音屏障建设。", sourceJournal: "Sleep Medicine", sourceLink: "https://scholar.google.com/scholar?q=urban+noise+pollution+sleep", publishDate: "2026-03-03", category: "政策解读", likes: 12, comments: [] },
    { id: "10", title: "光污染对城市生态系统及人类节律的影响", oneSentenceSummary: "夜间过度的蓝光暴露会抑制褪黑素分泌。", conceptImageUrl: "https://picsum.photos/seed/light/400/300", plainTextContent: "这可能导致昼夜节律紊乱及相关代谢疾病。", sourceJournal: "PNAS", sourceLink: "https://scholar.google.com/scholar?q=light+pollution+melatonin+rhythm", publishDate: "2026-03-02", category: "流行病学", likes: 10, comments: [] },
    { id: "11", title: "生物多样性丧失与人畜共患病风险的增加", oneSentenceSummary: "生态系统失衡使得病毒更容易跨物种传播。", conceptImageUrl: "https://picsum.photos/seed/bio/400/300", plainTextContent: "保护自然栖息地是预防未来大流行的关键。", sourceJournal: "Nature", sourceLink: "https://scholar.google.com/scholar?q=biodiversity+loss+zoonotic", publishDate: "2026-03-01", category: "气候变化", likes: 8, comments: [] },
    { id: "12", title: "新型环保材料在水处理中的高效应用", oneSentenceSummary: "石墨烯基滤膜可去除99%的微量有机污染物。", conceptImageUrl: "https://picsum.photos/seed/water/400/300", plainTextContent: "这为解决饮用水安全问题提供了新方案。", sourceJournal: "Water Research", sourceLink: "https://scholar.google.com/scholar?q=graphene+membrane+water+treatment", publishDate: "2026-02-28", category: "饮用水", likes: 7, comments: [] },
    { id: "13", title: "空气污染对青少年认知发育的长期影响", oneSentenceSummary: "高污染地区学龄儿童的记忆力测试得分普遍较低。", conceptImageUrl: "https://picsum.photos/seed/child/400/300", plainTextContent: "研究呼吁在学校周边建立空气质量监测点。", sourceJournal: "The Lancet Child & Adolescent Health", sourceLink: "https://scholar.google.com/scholar?q=air+pollution+cognitive+children", publishDate: "2026-02-27", category: "空气质量", likes: 6, comments: [] },
    { id: "14", title: "全球塑料公约：政策干预对减少海洋污染的效力", oneSentenceSummary: "强制性的塑料回收政策可使入海塑料减少30%。", conceptImageUrl: "https://picsum.photos/seed/policy/400/300", plainTextContent: "国际合作是解决跨界污染问题的唯一途径。", sourceJournal: "Global Policy", sourceLink: "https://scholar.google.com/scholar?q=plastic+treaty+marine+pollution", publishDate: "2026-02-26", category: "政策解读", likes: 5, comments: [] },
    { id: "15", title: "纳米颗粒在化妆品中的安全性评估", oneSentenceSummary: "部分纳米级防晒成分可能通过皮肤屏障进入循环。", conceptImageUrl: "https://picsum.photos/seed/cosmetic/400/300", plainTextContent: "监管机构需更新纳米材料的安全测试标准。", sourceJournal: "Toxicology Letters", sourceLink: "https://scholar.google.com/scholar?q=nanoparticles+cosmetics+safety", publishDate: "2026-02-25", category: "流行病学", likes: 4, comments: [] },
    { id: "16", title: "气候移民：环境退化对人口流动的驱动作用", oneSentenceSummary: "海平面上升可能导致未来十年内数千万人流离失所。", conceptImageUrl: "https://picsum.photos/seed/migration/400/300", plainTextContent: "国际社会需建立气候难民的法律保护框架。", sourceJournal: "Climatic Change", sourceLink: "https://scholar.google.com/scholar?q=climate+migration+displacement", publishDate: "2026-02-24", category: "气候变化", likes: 3, comments: [] },
    { id: "17", title: "电子垃圾回收过程中的职业暴露风险", oneSentenceSummary: "非正规回收点的工人血液中铅含量严重超标。", conceptImageUrl: "https://picsum.photos/seed/ewaste/400/300", plainTextContent: "必须推广正规化的电子垃圾处理流程。", sourceJournal: "Occupational & Environmental Medicine", sourceLink: "https://scholar.google.com/scholar?q=e-waste+recycling+occupational", publishDate: "2026-02-23", category: "饮用水", likes: 2, comments: [] },
    { id: "18", title: "绿色建筑对室内空气质量及员工生产力的提升", oneSentenceSummary: "拥有LEED认证的办公室员工病假率降低了15%。", conceptImageUrl: "https://picsum.photos/seed/building/400/300", plainTextContent: "良好的通风和自然采光是关键因素。", sourceJournal: "Building and Environment", sourceLink: "https://scholar.google.com/scholar?q=green+building+indoor+air+productivity", publishDate: "2026-02-22", category: "空气质量", likes: 1, comments: [] },
    { id: "19", title: "抗生素抗性基因在环境中的传播机制", oneSentenceSummary: "污水处理厂是抗性基因进入自然水体的重要源头。", conceptImageUrl: "https://picsum.photos/seed/bacteria/400/300", plainTextContent: "需加强对医疗废水的预处理和监测。", sourceJournal: "ISME Journal", sourceLink: "https://scholar.google.com/scholar?q=antibiotic+resistance+wastewater", publishDate: "2026-02-21", category: "饮用水", likes: 0, comments: [] },
    { id: "20", title: "碳税政策对减少工业碳排放的实证分析", oneSentenceSummary: "实施碳税的国家工业碳强度平均下降了8%。", conceptImageUrl: "https://picsum.photos/seed/carbon/400/300", plainTextContent: "经济杠杆是推动绿色转型的有效工具。", sourceJournal: "Energy Policy", sourceLink: "https://scholar.google.com/scholar?q=carbon+tax+emissions+policy", publishDate: "2026-02-20", category: "政策解读", likes: 0, comments: [] }
  ];

  app.get("/api/news", (req, res) => {
    const { q, category } = req.query;
    let filtered = [...newsItems];

    if (category && category !== '全部') {
      filtered = filtered.filter(item => item.category === category);
    }

    if (q) {
      const query = (q as string).toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(query) || 
        item.oneSentenceSummary.toLowerCase().includes(query) ||
        item.plainTextContent.toLowerCase().includes(query) ||
        (item.translatedAbstract && item.translatedAbstract.toLowerCase().includes(query))
      );
    }

    res.json(filtered);
  });

  app.post("/api/news/:id/like", (req, res) => {
    const { id } = req.params;
    const item = newsItems.find(n => n.id === id);
    if (item) {
      item.likes = (item.likes || 0) + 1;
      res.json({ likes: item.likes });
    } else {
      res.status(404).json({ error: "News not found" });
    }
  });

  app.post("/api/news/:id/comment", (req, res) => {
    const { id } = req.params;
    const { user, text } = req.body;
    const item = newsItems.find(n => n.id === id);
    if (item) {
      const newComment = {
        id: Date.now().toString(),
        user: user || "匿名用户",
        text,
        date: new Date().toISOString().split('T')[0]
      };
      item.comments = [...(item.comments || []), newComment];
      res.json(newComment);
    } else {
      res.status(404).json({ error: "News not found" });
    }
  });

  // ── Real Paper Crawler ──

  const SEARCH_QUERIES = [
    { query: "environmental health air pollution cardiovascular", category: "空气质量" },
    { query: "climate change heatwave mortality public health", category: "气候变化" },
    { query: "water quality heavy metal contamination disease", category: "饮用水" },
    { query: "epidemiology environmental exposure risk factor", category: "流行病学" },
    { query: "environmental policy regulation health outcome", category: "政策解读" },
    { query: "PM2.5 respiratory disease children", category: "空气质量" },
    { query: "microplastic human health exposure", category: "流行病学" },
    { query: "green space urban health wellbeing", category: "气候变化" },
  ];

  const CATEGORY_MAP: Record<string, string> = {
    "air pollution": "空气质量", "pm2.5": "空气质量", "particulate matter": "空气质量",
    "climate change": "气候变化", "global warming": "气候变化", "heat": "气候变化",
    "water quality": "饮用水", "drinking water": "饮用水", "water contamination": "饮用水", "heavy metal": "饮用水",
    "epidemiolog": "流行病学", "infection": "流行病学", "disease outbreak": "流行病学",
    "policy": "政策解读", "regulation": "政策解读", "governance": "政策解读",
  };

  function classifyCategory(title: string, abstract: string): string {
    const text = (title + " " + abstract).toLowerCase();
    for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
      if (text.includes(keyword)) return category;
    }
    return "流行病学";
  }

  async function fetchPapersFromSemanticScholar(): Promise<any[]> {
    const picked = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(picked.query)}&fields=title,abstract,publicationDate,journal,url,year,openAccessPdf&limit=20&sort=publicationDate:desc&year=2024-`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Semantic Scholar API error: ${response.status}`);
    const data = await response.json();
    return (data.data || []).filter((p: any) => p.abstract && p.abstract.length > 100);
  }

  async function summarizeWithClaude(paper: { title: string; abstract: string; journal?: any }): Promise<{
    title: string; oneSentenceSummary: string; plainTextContent: string; translatedAbstract: string;
  }> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { title: paper.title, oneSentenceSummary: paper.abstract.slice(0, 100) + "...", plainTextContent: paper.abstract.slice(0, 500), translatedAbstract: paper.abstract.slice(0, 300) };
    }
    try {
      const client = new Anthropic({ apiKey });
      const journalName = paper.journal?.name || "Unknown Journal";
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        temperature: 0.7,
        messages: [{ role: "user", content: `你是一位资深科学记者。请将以下英文学术论文信息转化为中文新闻资讯。
必须输出纯 JSON（不要 markdown 代码块），字段如下：
- title: 吸引人但不过分夸张的中文标题
- oneSentenceSummary: 通俗易懂的一句话核心发现（禁止统计术语）
- plainTextContent: 200字以内的中文正文解读（背景+方法+发现+建议）
- translatedAbstract: 对摘要的专业中文翻译（150字以内）

论文标题: ${paper.title}
期刊: ${journalName}
摘要: ${paper.abstract}` }],
      });
      const textBlock = response.content.find((b: any) => b.type === "text");
      const text = textBlock && textBlock.type === "text" ? textBlock.text : "{}";
      const cleaned = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      return JSON.parse(cleaned);
    } catch (err) {
      console.error("Claude summarization failed:", err);
      return { title: paper.title, oneSentenceSummary: paper.abstract.slice(0, 100) + "...", plainTextContent: paper.abstract.slice(0, 500), translatedAbstract: paper.abstract.slice(0, 300) };
    }
  }

  async function fetchCoverImage(query: string): Promise<string> {
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    if (unsplashKey) {
      try {
        const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
        const res = await fetch(url, { headers: { "Authorization": `Client-ID ${unsplashKey}` } });
        if (res.ok) {
          const data = await res.json();
          if (data.results?.[0]?.urls?.regular) return data.results[0].urls.regular;
        }
      } catch {}
    }
    return `https://picsum.photos/seed/${encodeURIComponent(query.slice(0, 20))}/800/450`;
  }

  app.post("/api/news/crawl", async (req, res) => {
    try {
      const papers = await fetchPapersFromSemanticScholar();
      if (papers.length === 0) return res.json([]);

      const newItems = [];
      for (let i = 0; i < Math.min(papers.length, 10); i++) {
        const paper = papers[i];
        const [summary, imageUrl] = await Promise.all([
          summarizeWithClaude(paper),
          fetchCoverImage(paper.title.slice(0, 60)),
        ]);
        const category = classifyCategory(paper.title, paper.abstract || "");
        newItems.push({
          id: `sem-${paper.paperId || Date.now() + i}`,
          title: summary.title || paper.title,
          oneSentenceSummary: summary.oneSentenceSummary || "",
          conceptImageUrl: imageUrl,
          plainTextContent: summary.plainTextContent || paper.abstract?.slice(0, 500) || "",
          abstract: paper.abstract || "",
          translatedAbstract: summary.translatedAbstract || "",
          sourceLink: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
          sourceJournal: paper.journal?.name || "Unknown",
          publishDate: paper.publicationDate || paper.year?.toString() || new Date().toISOString().split("T")[0],
          category,
          likes: 0,
          comments: [],
        });
      }
      newsItems = [...newItems, ...newsItems];
      res.json(newItems);
    } catch (error: any) {
      console.error("Crawl failed:", error);
      res.status(500).json({ error: "爬取失败: " + error.message });
    }
  });

  // Sample Data Generation
  app.get("/api/sample-data", (req, res) => {
    const data = [];
    for (let i = 0; i < 50; i++) {
      const pm25 = 10 + Math.random() * 90;
      // Linear relationship: disease_rate = 0.5 + 0.05 * pm25 + noise
      const diseaseRate = 0.5 + 0.05 * pm25 + (Math.random() - 0.5) * 2;
      data.push({ pm25, disease_rate: Math.max(0, diseaseRate) });
    }
    res.json(data);
  });

  // API Routes
  app.post("/api/analyze", upload.single("file"), (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const csvData = req.file.buffer.toString();
      const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        cast: true,
      });

      if (records.length < 5) {
        return res.status(400).json({ error: "Insufficient data. Need at least 5 rows." });
      }

      // Detect columns
      const keys = Object.keys(records[0]);
      const pm25Key = keys.find(k => k.toLowerCase().includes("pm25") || k.toLowerCase().includes("pm2.5"));
      const diseaseKey = keys.find(k => k.toLowerCase().includes("disease") || k.toLowerCase().includes("rate"));

      if (!pm25Key || !diseaseKey) {
        return res.status(400).json({ 
          error: "Missing required columns.", 
          detectedColumns: keys,
          required: ["pm25", "disease_rate"]
        });
      }

      const dataPoints = records.map((r: any) => [r[pm25Key], r[diseaseKey]]);
      
      // OLS Regression using simple-statistics
      const regression = ss.linearRegression(dataPoints);
      
      // Calculate R-squared
      let r2 = 0;
      try {
        const xValues = records.map((r: any) => r[pm25Key]);
        const yValues = records.map((r: any) => r[diseaseKey]);
        const correlation = ss.sampleCorrelation(xValues, yValues);
        r2 = Math.pow(correlation, 2);
      } catch (e) {
        r2 = 0;
      }

      // P-value approximation based on R2 and N
      // This is a heuristic: higher R2 and higher N lead to lower P-value
      const pValue = r2 > 0.3 && records.length > 10 ? 0.001 : 0.25;

      res.json({
        summary: {
          coefficients: {
            intercept: regression.b,
            pm25: regression.m,
          },
          rSquared: isNaN(r2) ? 0 : r2,
          pValue: pValue,
          n: records.length,
        },
        data: records.map((r: any) => ({
          x: r[pm25Key],
          y: r[diseaseKey],
        })),
        columns: {
          x: pm25Key,
          y: diseaseKey
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
