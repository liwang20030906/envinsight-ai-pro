import OpenAI from "openai";
import type {
  AnalysisMode,
  AnalysisResult,
  ComplianceGuidance,
  DiscussionResponse,
  NewsExplainers,
  PaperDraft,
  StatsSummary,
} from "../types";

const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

type WhatIfInput = {
  pm25Change: number;
  predictedDiseaseChange: number;
};

type AIResult = {
  provider: "openai" | "local-fallback";
  text: string;
};

function normalizeSecret(value: string | undefined): string {
  return (value || "").trim();
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = normalizeSecret(process.env.OPENAI_API_KEY);
  if (!apiKey || apiKey === "YOUR_OPENAI_API_KEY") {
    return null;
  }

  return new OpenAI({
    apiKey,
    maxRetries: 0,
    timeout: 12000,
  });
}

function getPValueSentence(summary: StatsSummary): string {
  if (summary.pValue == null) {
    return "当前样本量或数据结构不足以稳定计算显著性，需要补充样本后再判断统计显著性。";
  }

  if (summary.pValue < 0.05) {
    return `P 值约为 ${summary.pValue.toFixed(4)}，在常用 0.05 阈值下可视为统计学显著。`;
  }

  return `P 值约为 ${summary.pValue.toFixed(4)}，目前还不能据此认定存在统计学显著关联。`;
}

function getEffectDirection(slope: number, labels: { x: string; y: string } = { x: "自变量", y: "目标变量" }): string {
  if (slope > 0) {
    return `${labels.x} 升高与 ${labels.y} 上升呈正向关系。`;
  }
  if (slope < 0) {
    return `${labels.x} 升高与 ${labels.y} 下降呈负向关系。`;
  }
  return `当前模型中 ${labels.x} 与 ${labels.y} 的线性关系接近于零。`;
}

function getFitSentence(rSquared: number): string {
  if (rSquared >= 0.7) {
    return "模型拟合度较强，线性趋势解释力较高。";
  }
  if (rSquared >= 0.3) {
    return "模型存在一定解释力，但仍可能受到其他变量影响。";
  }
  return "模型拟合度较弱，单一线性关系对结果解释有限。";
}

export function buildAnalysisPrompt(
  summary: StatsSummary,
  dataSample: Array<{ x: number; y: number }>,
  mode: AnalysisMode,
  labels: { x: string; y: string } = { x: "自变量", y: "目标变量" },
  query?: string,
): string {
  const significanceInstruction =
    summary.pValue == null
      ? '当前输入未提供可靠 P 值，请明确说明“显著性暂不可判断”，不要虚构显著性。'
      : '若 P > 0.05，明确指出“统计上不显著”。';

  return `
# Role
${mode === "researcher"
  ? "你是首席环境数据科学家，擅长统计推断与流行病学归因分析。"
  : "你是亲切的健康生活顾问，擅长将复杂的数据转化为通俗易懂的生活建议。"}

# Task
基于提供的 OLS 回归统计摘要（包含系数、P值、R²）和数据预览，进行深度解读。

# Constraints
${mode === "researcher"
  ? `1. 必须严格基于统计数据说话，严禁幻觉。${significanceInstruction}
     2. 输出必须包含两个部分：
        - [思考过程]: 简要分析模型拟合度、识别潜在异常点，并说明统计局限。
        - [正式回答]: 使用学术严谨的语言，给出结论、局限性分析及后续研究建议。
     3. 语气：客观、冷静、专业，多用术语（如“显著正相关”“混杂因素”）。`
  : `1. 禁止使用 P 值、回归系数等统计术语，转化为“影响明显”“暂时看不出稳定规律”等自然语言。
     2. 重点在于可执行建议，避免夸大结论。
     3. 输出必须包含：
        - [思考过程]: 简单联想数据与生活场景的关联。
        - [正式回答]: 温暖、关怀的语气，分点列出风险和建议。
     4. 若结论不稳定，要明确提示“还需要更多数据”。`}
4. 严禁给出具体的用药建议或诊断结论，必须引导用户咨询医疗机构。

# Input Data
统计摘要: ${JSON.stringify(summary)}
字段标签: ${JSON.stringify(labels)}
数据预览 (前5行): ${JSON.stringify(dataSample.slice(0, 5))}
${query ? `用户追问: ${query}` : ""}

# Output Format
[思考过程]
- ...
[正式回答]
- ...
  `;
}

export function buildLocalAnalysis(
  summary: StatsSummary,
  dataSample: Array<{ x: number; y: number }>,
  mode: AnalysisMode,
  labels: { x: string; y: string } = { x: "自变量", y: "目标变量" },
  query?: string,
): string {
  const fitSentence = getFitSentence(summary.rSquared);
  const directionSentence = getEffectDirection(summary.coefficients.pm25, labels);
  const significanceSentence = getPValueSentence(summary);
  const sampleSentence = `本次分析基于 ${summary.n} 个样本点，预览数据覆盖 ${dataSample.length} 条记录。`;
  const querySentence = query ? `另外，用户特别关注：${query}。` : "";

  if (mode === "researcher") {
    return `[思考过程]
- ${sampleSentence}
- ${fitSentence}
- ${directionSentence}
- ${significanceSentence}
- 该模型仅包含单一 ${labels.x} 自变量，仍需警惕气温、年龄结构、社会经济因素等混杂变量。${querySentence}
[正式回答]
- 回归系数为 ${summary.coefficients.pm25.toFixed(4)}，说明在当前线性模型下，${labels.x} 每增加 1 个单位，${labels.y} 平均变化约 ${summary.coefficients.pm25.toFixed(4)} 个单位。
- R² 为 ${summary.rSquared.toFixed(3)}，表示模型对结果波动的解释程度为 ${(summary.rSquared * 100).toFixed(1)}%。
- ${significanceSentence}
- 当前结果更适合作为探索性分析依据；若要支持科研结论，建议补充协变量、开展残差诊断，并增加样本量或分层分析。
- 本系统不提供医疗诊断，任何公共卫生或临床决策都应结合专业团队进一步评估。`;
  }

  const confidenceSentence =
    summary.pValue != null && summary.pValue < 0.05
      ? "这组数据里已经能看到比较稳定的变化趋势。"
      : "这组数据暂时只能说明一种可能趋势，还需要更多数据确认。";

  return `[思考过程]
- 先看整体走势：${directionSentence}
- 再看稳定程度：${fitSentence}
- ${confidenceSentence}
- 这意味着环境变化和健康风险可能有关，但不能直接当成诊断结果。${querySentence}
[正式回答]
- 从这批数据看，${labels.x} 变化时，${labels.y} 有同步变化的迹象。
- 如果这个指标会影响你的业务或研究对象，优先围绕 ${labels.x} 做监测、分层观察和高风险人群提示。
- 如果你现在看到的数据波动较大，不要急着下结论，最好继续补充更多监测数据再判断。
- 本结果只用于风险提醒，不代替医生建议或公共卫生正式通告。`;
}

function buildWhatIfPrompt(data: WhatIfInput, coefficient: number, label = "核心指标"): string {
  return `
# Role
你是环境健康风险评估专家。

# Task
基于以下模拟数据，提供简短的政策建议或生活指导。

# Data
- ${label} 变化: ${data.pm25Change}%
- 预计目标结果变化: ${data.predictedDiseaseChange.toFixed(2)}%
- 原始回归系数: ${coefficient.toFixed(4)}

# Constraints
1. 语气专业且具有前瞻性。
2. 重点说明这种变化对公共卫生系统的潜在影响。
3. 限制在 150 字以内。
`;
}

export function buildLocalWhatIfAnalysis(data: WhatIfInput, coefficient: number, label = "核心指标"): string {
  const direction =
    data.pm25Change > 0 ? "上升" : data.pm25Change < 0 ? "下降" : "保持不变";

  return `在当前模型下，若 ${label}${direction} ${Math.abs(data.pm25Change)}%，预计目标结果变化约 ${data.predictedDiseaseChange.toFixed(
    2,
  )}%。这意味着相关团队应提前准备重点人群防护、资源调度与持续监测；回归系数 ${coefficient.toFixed(4)} 仅反映线性趋势，正式决策仍需结合更多数据。`;
}

async function callOpenAI(prompt: string, maxOutputTokens: number, instructions?: string): Promise<string | null> {
  const client = getOpenAIClient();
  if (!client) {
    return null;
  }

  const request = (async () => {
    try {
      const stream = await client.chat.completions.create({
        model: MODEL,
        messages: [
          ...(instructions ? [{ role: "system" as const, content: instructions }] : []),
          { role: "user" as const, content: prompt },
        ],
        max_tokens: maxOutputTokens,
        stream: true,
      });

      let text = "";
      for await (const chunk of stream) {
        text += chunk.choices?.[0]?.delta?.content || "";
      }
      text = text.trim();
      return text || null;
    } catch (error) {
      console.error("[AI] OpenAI request failed, using local fallback.", error);
      return null;
    }
  })();

  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => {
      console.error("[AI] OpenAI request timed out, using local fallback.");
      resolve(null);
    }, 6000);
  });

  return Promise.race([request, timeout]);
}

export async function generateAnalysisText(
  summary: StatsSummary,
  dataSample: Array<{ x: number; y: number }>,
  mode: AnalysisMode,
  labels: { x: string; y: string } = { x: "自变量", y: "目标变量" },
  query?: string,
): Promise<AIResult> {
  const prompt = buildAnalysisPrompt(summary, dataSample, mode, labels, query);
  const openAIText = await callOpenAI(prompt, 4096);

  return {
    provider: openAIText ? "openai" : "local-fallback",
    text: openAIText ?? buildLocalAnalysis(summary, dataSample, mode, labels, query),
  };
}

export async function generateWhatIfText(data: WhatIfInput, coefficient: number, label = "核心指标"): Promise<AIResult> {
  const openAIText = await callOpenAI(buildWhatIfPrompt(data, coefficient, label), 1024);

  return {
    provider: openAIText ? "openai" : "local-fallback",
    text: openAIText ?? buildLocalWhatIfAnalysis(data, coefficient, label),
  };
}

export async function generateTranslatedPaper(abstract: string): Promise<{
  provider: "openai" | "local-fallback";
  result: Record<string, string>;
}> {
  const instructions = `你是一位资深科学记者，擅长将复杂的学术论文转化为大众爱读的新闻资讯。
你必须输出纯 JSON（不要 markdown 代码块），包含以下字段：
- title
- oneSentenceSummary
- conceptImagePrompt
- plainTextContent
- translatedAbstract
- sourceJournal`;

  const openAIText = await callOpenAI(abstract, 4096, instructions);

  if (openAIText) {
    const cleaned = openAIText.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    return {
      provider: "openai",
      result: JSON.parse(cleaned),
    };
  }

  return {
    provider: "local-fallback",
    result: {
      title: "环境健康研究摘要解读",
      oneSentenceSummary: "这篇研究提示环境暴露与健康结果可能存在关联，但仍需要结合原文进一步判断。",
      conceptImagePrompt: "A clean editorial illustration about environmental health research, data charts, air quality, and public wellbeing.",
      plainTextContent: "当前系统暂未能使用在线 AI 转写服务，建议结合论文原文摘要、研究对象、暴露指标与结局指标进行人工复核。",
      translatedAbstract: abstract,
      sourceJournal: "Unknown Journal",
    },
  };
}

type PaperNewsDigestInput = {
  title: string;
  abstract: string;
  journal?: string;
  publicationDate?: string;
  citedByCount?: number;
  category?: string;
};

const PAPER_EXPOSURE_PATTERNS: Array<[RegExp, string]> = [
  [/\bpm2\.?5\b/iu, "PM2.5 暴露"],
  [/\bpm10\b/iu, "PM10 暴露"],
  [/\bair pollution\b/iu, "空气污染"],
  [/\bindoor air pollution\b/iu, "室内空气污染"],
  [/\bozone\b|\bo3\b/iu, "臭氧暴露"],
  [/\bnitrogen dioxide\b|\bno2\b/iu, "二氧化氮暴露"],
  [/\bheatwave\b|\bextreme heat\b/iu, "极端高温"],
  [/\bdroughts?\b/iu, "干旱暴露"],
  [/\bflood risk\b|\bflooding\b/iu, "洪涝风险"],
  [/\btemperature\b/iu, "气温变化"],
  [/\bclimate change\b|\bglobal warming\b/iu, "气候变化"],
  [/\bdrinking water\b|\bwater contamination\b|\bgroundwater\b/iu, "饮用水污染"],
  [/\bwater quality\b/iu, "水质变化"],
  [/\bwastewater\b|\bsewage\b/iu, "污水暴露"],
  [/\bmicroplastic[s]?\b/iu, "微塑料暴露"],
  [/\bpfas\b|per-? and polyfluoroalkyl/iu, "PFAS 暴露"],
  [/\bpesticide[s]?\b/iu, "农药暴露"],
  [/\bantimicrobial resistance\b|\bamr\b/iu, "抗菌药耐药性"],
  [/\bmobile genetic element[s]?\b|\bmges?\b/iu, "可移动遗传元件"],
  [/\blead\b/iu, "铅暴露"],
  [/\barsenic\b/iu, "砷暴露"],
  [/\bnoise\b/iu, "噪声暴露"],
  [/\bgreen space\b|\bgreenspace\b/iu, "城市绿地"],
  [/\bwildfire smoke\b/iu, "野火烟雾"],
  [/\bcarbon tax\b/iu, "碳税政策"],
];

const PAPER_OUTCOME_PATTERNS: Array<[RegExp, string]> = [
  [/\brespiratory\b.*\b(admission|hospitali[sz]ation|visit)s?\b/iu, "呼吸系统就诊风险"],
  [/\bcardiovascular\b|\bheart disease\b/iu, "心血管风险"],
  [/\bkidney\b|\brenal\b/iu, "肾脏健康风险"],
  [/\bmental health\b|\banxiety\b|\bdepression\b/iu, "心理健康风险"],
  [/\bcognitive\b|\bcognition\b/iu, "认知发育或认知表现"],
  [/\bsleep\b|\binsomnia\b/iu, "睡眠问题"],
  [/\bcancer\b|\bcarcinoma\b/iu, "癌症风险"],
  [/\basthma\b/iu, "哮喘风险"],
  [/\bmortality\b|\bdeath\b/iu, "死亡风险"],
  [/\binflammation\b|\bimmune\b/iu, "炎症或免疫风险"],
  [/\bbirth\b|\bpreterm\b|\bprenatal\b/iu, "出生结局风险"],
  [/\bhospital admission\b|\badmission\b/iu, "住院风险"],
  [/\bwater quality index\b|\bwqi\b|\bassessment\b/iu, "水安全评估"],
  [/\bcontrol strateg(y|ies)\b/iu, "防控策略"],
  [/\bone health\b/iu, "同一健康协同治理"],
];

const PAPER_PHRASE_TRANSLATIONS: Array<[RegExp, string]> = [
  [/\bwater quality assessment\b/giu, "水质评估"],
  [/\brecreational water quality index\b|\bir-wqi\b/giu, "休闲水质指数"],
  [/\bbathers?[’']? safety and comfort\b/giu, "游客下水安全与舒适度"],
  [/\bmobile genetic elements?\b|\bmges?\b/giu, "可移动遗传元件"],
  [/\bantimicrobial resistance\b|\bamr\b/giu, "抗菌药耐药性"],
  [/\bmolecular mechanisms\b/giu, "分子机制"],
  [/\bevolutionary ecology\b/giu, "演化生态"],
  [/\bone health implications\b/giu, "同一健康影响"],
  [/\bone health\b/giu, "同一健康"],
  [/\bcontrol strategies\b/giu, "防控策略"],
  [/\bpractical options\b/giu, "可行做法"],
  [/\badaptive public health strategies\b/giu, "公共健康应对策略"],
  [/\boccupational health emerging risks\b/giu, "职业健康新风险"],
  [/\benvironmental pathogen surveillance\b/giu, "环境病原体监测"],
  [/\bcities without universal piped wastewater infrastructure\b/giu, "缺乏完善污水管网的城市"],
  [/\bgroundwater quality index prediction\b/giu, "地下水水质指数预测"],
  [/\baquifer failure risk analysis\b/giu, "含水层失效风险分析"],
  [/\bmetaheuristic-tuned artificial neural networks\b/giu, "启发式优化神经网络"],
  [/\bclimate change\b/giu, "气候变化"],
  [/\bwater scarcity\b/giu, "缺水风险"],
  [/\bflood risk\b/giu, "洪涝风险"],
  [/\bagricultural pollution\b/giu, "农业污染"],
  [/\burban heat stress\b/giu, "城市热暴露压力"],
  [/\bprenatal\b/giu, "孕前"],
  [/\bpostnatal\b/giu, "出生后"],
  [/\bdroughts?\b/giu, "干旱"],
  [/\bcognitive development\b/giu, "认知发育"],
  [/\brespiratory admissions?\b|\brespiratory visits?\b/giu, "呼吸系统就诊"],
  [/\bhospital admissions?\b/giu, "住院"],
  [/\bmental health\b/giu, "心理健康"],
  [/\bdrinking water\b/giu, "饮用水"],
  [/\bwater contamination\b/giu, "水污染"],
  [/\bair pollution\b/giu, "空气污染"],
  [/\bpm2\.?5\b/giu, "PM2.5"],
  [/\bhealth implications\b/giu, "健康影响"],
  [/\bcontrol strategies\b/giu, "防控策略"],
  [/\bpublic health\b/giu, "公共健康"],
];

function pickPaperLabel(source: string, patterns: Array<[RegExp, string]>): string | null {
  for (const [pattern, label] of patterns) {
    if (pattern.test(source)) {
      return label;
    }
  }
  return null;
}

function inferPaperMethod(source: string): string {
  if (/\bmeta-analysis\b|\bsystematic review\b|\breview\b/iu.test(source)) return "系统综述或证据综述";
  if (/\bcohort\b/iu.test(source)) return "队列研究";
  if (/\bcase-control\b/iu.test(source)) return "病例对照研究";
  if (/\btime series\b|\blongitudinal\b/iu.test(source)) return "时间序列或长期追踪研究";
  if (/\brandomized\b|\btrial\b/iu.test(source)) return "干预试验";
  if (/\bpanel\b/iu.test(source)) return "面板数据分析";
  if (/\bindex\b|\bframework\b|\bmodel\b|\bassessment\b/iu.test(source)) return "指标或评估工具研究";
  return "观察性数据分析";
}

function extractEvidenceSnippet(source: string): string | null {
  const normalized = source.replace(/\s+/g, " ");
  const percentage = normalized.match(/\b\d+(?:\.\d+)?%\b/);
  if (percentage) {
    return `摘要里提到了约 ${percentage[0]} 这样的具体变化幅度。`;
  }

  const yearRange = normalized.match(/\b(19|20)\d{2}\s*[–-]\s*(19|20)\d{2}\b/);
  if (yearRange) {
    return `研究覆盖了 ${yearRange[0]} 这样的连续时间段，不是只看某一天的数据。`;
  }

  const sample = normalized.match(/\b\d{2,6}\b(?=\s+(participants|patients|people|residents|adults|children|volunteers|countries|cities|samples|case studies)\b)/iu);
  const unit = normalized.match(/\b(participants|patients|people|residents|adults|children|volunteers|countries|cities|samples|case studies)\b/iu);
  if (sample && unit) {
    return `研究涉及约 ${sample[0]} ${unit[0]}，说明它不是只看了极少量个案。`;
  }

  const scenario = normalized.match(/\b\d+\s+scenarios?\b/iu);
  if (scenario) {
    return `摘要里还提到做了 ${scenario[0]} 的比较，说明研究者比较了不同方案。`;
  }

  return null;
}

function translatePaperPhrase(value: string): string {
  let translated = ` ${value.toLowerCase()} `;
  for (const [pattern, replacement] of PAPER_PHRASE_TRANSLATIONS) {
    translated = translated.replace(pattern, ` ${replacement} `);
  }

  translated = translated
    .replace(/\busing\b/giu, "使用")
    .replace(/\binteraction?s?\b/giu, "相互作用")
    .replace(/\bshaping\b/giu, "塑造")
    .replace(/\bdrivers?\b/giu, "驱动因素")
    .replace(/\bcentral\b/giu, "关键")
    .replace(/\bregional\b/giu, "区域")
    .replace(/\bimplications\b/giu, "影响")
    .replace(/\bof\b/giu, "的")
    .replace(/\band\b/giu, "与")
    .replace(/\bon\b/giu, "对")
    .replace(/\bfor\b/giu, "针对")
    .replace(/\bin\b/giu, "在")
    .replace(/\bthe\b/giu, "")
    .replace(/\ba\b|\ban\b/giu, "")
    .replace(/\s+/g, " ")
    .replace(/[,:;()]/g, " ")
    .trim();

  return translated.replace(/\s+/g, " ").trim();
}

function normalizeChineseTopic(value: string, fallback: string): string {
  const normalized = value
    .replace(/^[^一-龥A-Za-z0-9]+/u, "")
    .replace(/[^一-龥A-Za-z0-9]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
  return /[一-龥]/u.test(normalized) ? normalized : fallback;
}

function trimPaperClause(value: string): string {
  return value.split(/[:：;；—–-]/u)[0].replace(/\s+/g, " ").trim();
}

function buildTitleDrivenSummary(input: PaperNewsDigestInput): {
  translatedTitle: string;
  focusSentence: string;
  summarySentence: string;
  plainSentence: string;
} | null {
  const title = input.title.trim();
  const lower = title.toLowerCase();
  const translatedTitle = normalizeChineseTopic(translatePaperPhrase(title), `${input.category || "环境健康"}研究`);

  const driverMatch = title.match(/(.+?)\s+as\s+(?:a\s+|an\s+)?(?:central\s+)?drivers?\s+of\s+(.+)/iu);
  if (driverMatch) {
    const driver = normalizeChineseTopic(translatePaperPhrase(trimPaperClause(driverMatch[1])), "某类关键因素");
    const outcome = normalizeChineseTopic(translatePaperPhrase(trimPaperClause(driverMatch[2])), "公共健康风险");
    return {
      translatedTitle: `${driver}与${outcome}关系综述`,
      focusSentence: `这篇论文重点解释，为什么“${driver}”会成为“${outcome}”扩散的重要推手。`,
      summarySentence: `${driver}可能正在推动${outcome}扩散，单靠末端治理可能不够。`,
      plainSentence: `一句话理解：真正需要盯住的，不只是结果本身，还有背后那个会把问题越带越大的关键环节。`,
    };
  }

  if (/assessment|index|framework|model/iu.test(lower) && /water|air|pollution|quality|risk/iu.test(lower)) {
    const subject = pickPaperLabel(`${title} ${input.abstract}`.toLowerCase(), PAPER_EXPOSURE_PATTERNS) || `${input.category || "环境健康"}问题`;
    return {
      translatedTitle: `${subject}评估方法研究`,
      focusSentence: `这篇论文更像是在做“怎么评估才更准”的方法研究，重点不是直接下健康结论，而是提升“${subject}”的识别准确度。`,
      summarySentence: `新的评估方法可能更早识别${subject}风险，适合用来做监测和预警。`,
      plainSentence: `一句话理解：它更像是在升级“尺子”，让大家更早看出哪里真的有风险。`,
    };
  }

  const implicationMatch = title.match(/(.+?)\s+implications?\s+of\s+(.+)/iu);
  if (implicationMatch) {
    const theme = normalizeChineseTopic(translatePaperPhrase(trimPaperClause(implicationMatch[2])), "环境变化");
    const frame = normalizeChineseTopic(translatePaperPhrase(trimPaperClause(implicationMatch[1])), "健康协同治理");
    return {
      translatedTitle: `${theme}的${frame}影响`,
      focusSentence: `这篇论文重点讨论，“${theme}”为什么不能只当成单一环境问题，而要放到“${frame}”的整体框架下看。`,
      summarySentence: `${theme}带来的冲击，往往会同时传导到人、动物和环境系统。`,
      plainSentence: `一句话理解：气候和环境问题最后不会只影响一头，它常常会连着人、动物和城市系统一起动。`,
    };
  }

  const interactionMatch = title.match(/(.+?)\s+interact\s+in\s+shaping\s+(.+)/iu);
  if (interactionMatch) {
    const factor = normalizeChineseTopic(translatePaperPhrase(trimPaperClause(interactionMatch[1])), "多种环境因素");
    const outcome = normalizeChineseTopic(translatePaperPhrase(trimPaperClause(interactionMatch[2])), "健康发育结果");
    return {
      translatedTitle: `${factor}与${outcome}关系研究`,
      focusSentence: `这篇论文重点在看，“${factor}”叠加出现时，会不会一起改变“${outcome}”。`,
      summarySentence: `${factor}叠加出现时，可能共同影响${outcome}。`,
      plainSentence: `一句话理解：真正麻烦的往往不是一个风险单独出现，而是多个压力叠加。`,
    };
  }

  if (/review|meta-analysis|systematic review/iu.test(lower)) {
    const topic = pickPaperLabel(`${title} ${input.abstract}`.toLowerCase(), PAPER_EXPOSURE_PATTERNS) || normalizeChineseTopic(translatePaperPhrase(title), `${input.category || "环境健康"}议题`);
    return {
      translatedTitle: `${topic}证据综述`,
      focusSentence: `这篇论文不是在报告单一实验结果，而是在系统梳理“${topic}”已经积累了哪些证据。`,
      summarySentence: `已有研究普遍认为，${topic}值得作为长期风险持续跟踪。`,
      plainSentence: `一句话理解：它更像一份“研究总账”，帮大家看清这个问题到底严不严重。`,
    };
  }

  return null;
}

function buildConcretePaperSummary(input: PaperNewsDigestInput): {
  translatedTitle: string;
  focusSentence: string;
  summarySentence: string;
  evidenceSentence: string;
  methodSentence: string;
  plainSentence: string;
  confidence: number;
} {
  const source = `${input.title} ${input.abstract}`.toLowerCase();
  const titleDriven = buildTitleDrivenSummary(input);
  const exposure = pickPaperLabel(source, PAPER_EXPOSURE_PATTERNS) || `${input.category || "环境因素"}问题`;
  const outcome = pickPaperLabel(source, PAPER_OUTCOME_PATTERNS) || null;
  const method = inferPaperMethod(source);
  const evidence = extractEvidenceSnippet(source);

  if (titleDriven) {
    return {
      translatedTitle: titleDriven.translatedTitle,
      focusSentence: titleDriven.focusSentence,
      summarySentence: titleDriven.summarySentence,
      evidenceSentence: evidence || `摘要里给出的细节说明，研究者不是空泛讨论，而是在拿具体案例、时间段或方案做比较。`,
      methodSentence: `从摘要看，这更像一项${method}，重点是把问题讲清楚、把判断依据补完整。`,
      plainSentence: titleDriven.plainSentence,
      confidence: 2,
    };
  }

  const translatedTitle = outcome
    ? `${exposure}与${outcome}的关系研究`
    : `${exposure}相关研究`;
  const focusSentence = outcome
    ? `这篇论文重点在看“${exposure}”和“${outcome}”之间有没有关系。`
    : `这篇论文重点在看“${exposure}”会不会带来值得注意的环境或健康影响。`;
  const summarySentence = outcome
    ? `${exposure}可能和${outcome}有关，但还需要结合完整论文继续判断证据强度。`
    : `${exposure}可能正在带来值得持续跟踪的新风险，适合继续观察后续证据。`;
  const evidenceSentence = evidence || `摘要里给出的信息说明，研究者确实拿真实数据在看这个问题，而不是只停留在猜测。`;
  const methodSentence = outcome
    ? `从摘要看，这更像一项${method}，研究者主要是比较暴露变化和健康结果有没有一起变化。`
    : `从摘要看，这更像一项${method}，研究者主要是在判断这个问题该怎么监测、评估或解释。`;
  const plainSentence = outcome
    ? `一句话理解：如果你关心${exposure}，这篇论文是在提醒你，它可能和${outcome}连在一起。`
    : `一句话理解：这篇论文提醒大家，${exposure}这件事本身就值得继续盯着看。`;
  return { translatedTitle, focusSentence, summarySentence, evidenceSentence, methodSentence, plainSentence, confidence: outcome ? 2 : 1 };
}

function extractSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function trimSentence(text: string, length = 140): string {
  return text.length > length ? `${text.slice(0, length - 1).trim()}...` : text;
}

function chineseOnlySummary(text: string | undefined, fallback: string): string {
  const value = (text || "").trim();
  if (!value) {
    return fallback;
  }
  if (/[\u4e00-\u9fa5]/.test(value)) {
    return trimSentence(value, 100);
  }
  return fallback;
}

export function buildLocalPaperNewsDigest(input: PaperNewsDigestInput): NewsExplainers & {
  title: string;
  oneSentenceSummary: string;
  translatedAbstract: string;
  plainTextContent: string;
} {
  const sentences = extractSentences(input.abstract);
  const lead = sentences[0] || input.abstract || input.title;
  const support = sentences[1] || sentences[0] || input.abstract || input.title;
  const method = sentences[2] || support;
  const concrete = buildConcretePaperSummary(input);
  const leadCN = chineseOnlySummary(
    lead,
    concrete.focusSentence,
  );
  const supportCN = chineseOnlySummary(
    support,
    concrete.evidenceSentence,
  );
  const methodCN = chineseOnlySummary(
    method,
    concrete.methodSentence,
  );
  const translatedTitle = /[\u4e00-\u9fa5]/.test(input.title)
    ? input.title
    : concrete.translatedTitle;
  const summary = trimSentence(
    `先说结论：${concrete.summarySentence}`,
    110,
  );

  const translatedAbstract = [
    `给普通人看的版本是：${concrete.focusSentence}`,
    `研究者先给出的一条核心线索是：${leadCN}`,
    `摘要里还能看到的补充信息是：${supportCN}`,
    `所以最适合记住的一句话是：${concrete.summarySentence}`,
  ].join("");
  const plainLanguageSummary = trimSentence(
    concrete.plainSentence,
    120,
  );
  const keyFindings = [
    trimSentence(`最值得记住的一点是：${leadCN}`, 120),
    trimSentence(`摘要里还能读出的有效信息是：${supportCN}`, 120),
    trimSentence(
      input.citedByCount != null
        ? `这篇论文目前已被引用约 ${input.citedByCount} 次，说明它已经引起了不少研究者关注。`
        : `论文发表于 ${input.publicationDate || "近年"}，更适合和同主题的新研究放在一起看。`,
      120,
    ),
  ];
  const limitations = [
    "这里是根据论文摘要做的通俗版解释，摘要本身不会把所有细节都写全。",
    "如果你要认真判断结论靠不靠谱，还得回原文看样本量、研究方法和局限性。",
    "单篇论文更像是“一个重要线索”，还不能直接替代正式指南或系统综述。",
  ];
  const publicCautions = [
    "不要把一篇论文的结果直接理解成“所有人都一定如此”。",
    "看到“有关联”，不等于已经证明是直接因果。",
    "如果涉及健康判断，还是要以医生意见、指南或系统综述为准。",
  ];
  const readerActions = [
    "先看研究对象是不是你真正关心的人群，比如儿童、老人还是普通成年人。",
    "再看研究怎么做的，特别留意样本量够不够、有没有对照、有没有控制其他影响因素。",
    "如果你要把它写进报告，最好再找 2 到 3 篇同主题论文一起对照着看。",
  ];
  const whyItMatters = trimSentence(
    `这篇论文值得关注，是因为它把一个具体环境议题拆成普通人能听懂的风险线索或判断方法，让你知道这件事为什么和现实生活有关。`,
    160,
  );
  const howStudyWorked = trimSentence(
    `你可以把这项研究理解成一个“三步走”：先提出问题，再收集数据，最后用研究方法看两者是不是一起变化。摘要里能看到的核心做法是：${methodCN}`,
    180,
  );
  const everydayMeaning = trimSentence(
    `对普通人来说，这篇论文真正有用的地方在于：它告诉你哪些环境问题值得更早关注，以及应该把注意力放在风险、监测还是治理方法上。`,
    160,
  );
  const plainTextContent = [
    `先用最简单的话说：${concrete.focusSentence}`,
    `这篇论文里最值得普通人记住的是两点：${leadCN}；以及 ${supportCN}。这说明这个问题不是空穴来风，但也还没有到“一锤定音”的程度。`,
    `研究怎么做的也很关键。摘要里透露出的做法可以概括成：${methodCN}。也就是说，研究者是在认真用数据或实验做判断，不只是提出一个猜想。`,
    `如果把它放回日常生活，这项研究其实是在提醒大家：遇到“${input.category || "环境健康"}”相关问题时，哪些风险值得更早关注，哪些预防动作可以提前准备。`,
    `最后要记住：单篇论文更像“提醒你注意的信号”，不是“最终结论”。真正发布成大众资讯时，必须把局限性和不能说明的部分一起讲清楚。`,
  ].join("\n\n");

  return {
    title: input.title,
    oneSentenceSummary: summary,
    translatedAbstract,
    plainTextContent,
    translatedTitle,
    plainLanguageSummary,
    whyItMatters,
    howStudyWorked,
    keyFindings,
    limitations,
    everydayMeaning,
    readerActions,
    publicCautions,
  };
}

export async function generatePaperNewsDigest(input: PaperNewsDigestInput): Promise<{
  provider: "openai" | "local-fallback";
  result: ReturnType<typeof buildLocalPaperNewsDigest>;
}> {
  const instructions = `你是一位面向大众的环境健康科学记者。请把论文信息转成详细、准确、通俗的简体中文科普解读。
要求：
- 必须忠于原始论文摘要，不要编造数据、样本量或结论
- 明确区分“观察到相关”与“证明因果”
- 语言尽量口语化，像在给非专业大众解释；避免术语堆砌，出现专业概念时要换成大众能懂的话
- 每段都优先回答“这对普通人意味着什么”，不要写成科研论文腔
- 输出内容面向资讯 feeds 流，适合大众快速阅读
你必须输出纯 JSON（不要 markdown 代码块），字段必须包含：
- title
- oneSentenceSummary
- translatedAbstract
- plainTextContent
- translatedTitle
- plainLanguageSummary
- whyItMatters
- howStudyWorked
- keyFindings (string[])
- limitations (string[])
- everydayMeaning
- readerActions (string[])
- publicCautions (string[])`;

  const prompt = JSON.stringify(input);
  const openAIText = await callOpenAI(prompt, 4096, instructions);
  if (openAIText) {
    try {
      const cleaned = openAIText.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      return {
        provider: "openai",
        result: JSON.parse(cleaned),
      };
    } catch {
      // Fall back to local digest.
    }
  }

  return {
    provider: "local-fallback",
    result: buildLocalPaperNewsDigest(input),
  };
}

function buildComplianceGuidancePrompt(result: AnalysisResult): string {
  return `
# Role
你是数据治理与科研合规顾问。

# Task
基于当前数据审查结果，输出一个可执行的解决方案，覆盖隐私脱敏、版权审查、AI 输出审核和发布前检查。

# Input
合规审查: ${JSON.stringify(result.complianceReview || null)}
数据体检: ${JSON.stringify(result.profile || null)}
模型对比: ${JSON.stringify(result.modelComparison || null)}

# Output
请输出纯 JSON（不要 markdown 代码块），字段必须包含：
- summary: 一段总述
- desensitizationPlan: string[]
- reviewWorkflow: string[]
- copyrightChecklist: string[]
- publishGuardrails: string[]
`;
}

function buildLocalComplianceGuidance(result: AnalysisResult): ComplianceGuidance {
  const findings = result.complianceReview?.findings || [];
  const hasCopyrightRisk = findings.some((item) => item.reason.includes("版权") || item.field.toLowerCase().includes("abstract"));

  return {
    provider: "local-fallback",
    summary:
      "建议将合规控制拆成“字段脱敏 -> 来源核验 -> AI 输出审查 -> 发布前复核”四步，确保数据与论文草稿都具备可追踪依据。",
    desensitizationPlan: [
      "删除姓名、邮箱、手机号、证件号等直接身份字段；必要时用哈希或区间分箱替代。",
      "对地址、机构、时间戳等间接标识做聚合或模糊化处理，避免重新识别。",
      "保留一份脱敏映射说明，但不要把映射表放进分析输出或导出文件。",
    ],
    reviewWorkflow: [
      "上传后先执行规则审查，拦截高风险字段。",
      "再由 AI 基于审查结果给出脱敏建议和发布流程。",
      "分析完成后对报告、论文初稿和摘要做二次审查，确认没有越权结论或敏感信息残留。",
    ],
    copyrightChecklist: hasCopyrightRisk
      ? [
          "确认摘要/全文是否来自开放获取来源，或是否具备二次加工许可。",
          "在资讯页和论文草稿中明确标注原始来源与加工方式。",
          "避免直接复用受限全文内容，优先输出基于证据链的摘要化结果。",
        ]
      : [
          "保留原始来源链接和期刊信息。",
          "对所有外部内容补充来源标注与引用边界说明。",
        ],
    publishGuardrails: [
      "发布前由人工复核敏感字段、版权来源、AI 生成段落和证据链一致性。",
      "所有对外结论都附带局限说明与免责声明，不把相关性写成因果结论。",
      "保留审计日志与版本记录，支持后续追踪与回滚。",
    ],
  };
}

export async function generateComplianceGuidance(result: AnalysisResult): Promise<ComplianceGuidance> {
  const prompt = buildComplianceGuidancePrompt(result);
  const openAIText = await callOpenAI(prompt, 2048);

  if (openAIText) {
    try {
      const cleaned = openAIText.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      return {
        provider: "openai",
        ...JSON.parse(cleaned),
      } as ComplianceGuidance;
    } catch {
      // Fall through to local guidance.
    }
  }

  return buildLocalComplianceGuidance(result);
}

function buildPaperDraftPrompt(result: AnalysisResult, aiResponse?: string): string {
  return `
# Role
你是环境健康研究论文写作助手。

# Task
将分析结果整理成学术论文初稿，严格输出 IMRaD 结构，并保留局限与免责声明。

# Input
分析结果: ${JSON.stringify(result)}
AI 分析摘要: ${JSON.stringify(aiResponse || "")}

# Output
请输出纯 JSON（不要 markdown 代码块），字段必须包含：
- title
- abstract
- introduction
- methods
- results
- discussion
- limitations
- disclaimer
`;
}

export async function generateAIPaperDraft(result: AnalysisResult, aiResponse?: string): Promise<{
  provider: "openai" | "local-fallback";
  paperDraft?: Omit<PaperDraft, "evidenceMap">;
}> {
  const prompt = buildPaperDraftPrompt(result, aiResponse);
  const openAIText = await callOpenAI(prompt, 4096);

  if (openAIText) {
    try {
      const cleaned = openAIText.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      return {
        provider: "openai",
        paperDraft: JSON.parse(cleaned),
      };
    } catch {
      // Fall through to template-based draft builder.
    }
  }

  return { provider: "local-fallback" };
}

function buildDiscussionPrompt(page: string, question: string, result?: AnalysisResult | null): string {
  return `
# Role
你是 EnvInsight AI Pro 的科研工作流助手。

# Task
围绕当前页面上下文回答用户问题，优先给出下一步建议、风险提醒和执行顺序。

# Constraints
1. 必须严格基于输入内容回答，不要编造未给出的实验结果。
2. 如果问题涉及隐私、版权、论文发表或模型选择，请分点说明。
3. 每次回答都包含：
   - 一个简短结论
   - 2-4 条可执行建议
   - 一条风险或局限提醒
4. 不提供医疗诊断，不把统计相关性写成因果结论。

# Context
- 当前页面: ${page}
- 用户问题: ${question}
- 当前分析结果: ${JSON.stringify(result || null)}
`;
}

function buildLocalDiscussion(page: string, question: string, result?: AnalysisResult | null): string {
  const modelHint = result?.modelComparison
    ? `当前已推荐 ${result.modelComparison.bestModelName}，可优先围绕该路线继续验证。`
    : "当前尚未形成稳定的模型推荐，建议先完成数据体检再提问更细的问题。";
  const complianceHint = result?.complianceGuidance
    ? "系统已经生成合规方案，建议优先落实脱敏、版权核查和发布前复核。"
    : "若问题涉及隐私或版权，建议先完成字段脱敏与来源核验。";

  return `结论：围绕“${question}”的下一步应先结合当前页面任务把风险控制和证据链补齐。

- 当前位于 ${page} 页面，建议先确认目标变量、证据链和导出用途，再决定是否进入正式分析或论文整理。
- ${modelHint}
- ${complianceHint}
- 如果需要对外展示，先生成结构化报告或论文初稿，再由人工复核关键信息与免责声明。

风险提醒：当前回答基于页面上下文生成，不能替代正式科研评审、伦理审查或版权判断。`;
}

export async function generateDiscussionResponse(
  page: string,
  question: string,
  result?: AnalysisResult | null,
): Promise<DiscussionResponse> {
  const openAIText = await callOpenAI(buildDiscussionPrompt(page, question, result), 2048);
  const content = openAIText ?? buildLocalDiscussion(page, question, result);

  return {
    provider: openAIText ? "openai" : "local-fallback",
    message: {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: "assistant",
      content,
      timestamp: new Date().toISOString(),
    },
  };
}
