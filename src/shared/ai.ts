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
  const leadCN = chineseOnlySummary(
    lead,
    `研究首先指出，${input.category || "环境健康"}议题正在成为一个值得公众关注的问题。`,
  );
  const supportCN = chineseOnlySummary(
    support,
    "摘要进一步说明，这类环境暴露或变化与真实健康结局之间可能存在值得继续追踪的联系。",
  );
  const methodCN = chineseOnlySummary(
    method,
    "从摘要能看出，研究者使用了数据分析、实验观察或系统比较的方法来验证这个问题。",
  );
  const translatedTitle = /[\u4e00-\u9fa5]/.test(input.title)
    ? input.title
    : `${input.category || "环境健康"}研究速读：一项值得关注的新发现`;
  const summary = trimSentence(
    `这篇发表于${input.journal || "学术期刊"}的研究用大白话来说是：${input.category || "环境健康"}变化，可能会影响真实健康或暴露结果。`,
    110,
  );

  const translatedAbstract = [
    `中文导读：这篇论文主要想回答一个和${input.category || "环境健康"}有关的现实问题。`,
    `从摘要来看，研究者先描述了一个值得关注的环境健康现象：${leadCN}`,
    `然后又补充说明了研究中最关键的发现或背景：${supportCN}`,
    `如果只记一句话，可以把它理解成：这项研究提示 ${input.category || "环境健康"} 议题和真实健康风险之间可能存在值得继续验证的联系。`,
  ].join("");
  const plainLanguageSummary = trimSentence(
    `一句大白话：它不是在告诉你“已经被完全证明了什么”，而是在提醒我们——某种环境因素可能真的会影响健康，值得继续关注和验证。`,
    120,
  );
  const keyFindings = [
    trimSentence(`研究最核心的观察是：${leadCN}`, 120),
    trimSentence(`摘要进一步补充的关键信息是：${supportCN}`, 120),
    trimSentence(
      input.citedByCount != null
        ? `这篇论文目前已被引用约 ${input.citedByCount} 次，说明它在学术讨论中已有一定关注度。`
        : `论文发表于 ${input.publicationDate || "近年"}，更适合和最新研究一起交叉阅读。`,
      120,
    ),
  ];
  const limitations = [
    "这里只是基于论文摘要做通俗化解读，摘要通常不会完整呈现所有实验细节和统计检验。",
    "如果要把它用于科研决策，还需要回到原文查看样本量、研究设计、混杂因素控制和局限性声明。",
    "单篇论文更适合提供线索，不适合直接替代系统综述或临床/政策结论。",
  ];
  const publicCautions = [
    "不要把单篇论文的结果直接理解为对每个人都成立。",
    "不要把“相关”自动理解成“因果”或“已经证明”。",
    "如果涉及健康风险判断，仍应以医生、指南或系统综述为准。",
  ];
  const readerActions = [
    "先看研究对象和暴露指标是不是与你关心的人群或场景一致。",
    "再看论文方法是否能支持它提出的结论，特别要关注样本量和对照设计。",
    "如果要引用到报告或论文里，建议和至少 2-3 篇同主题研究交叉验证。",
  ];
  const whyItMatters = trimSentence(
    `它之所以重要，是因为这项研究把“${input.category || "环境健康"}”问题和真实健康或暴露结果联系起来，帮助非专业读者快速理解这类风险为什么值得关注。`,
    160,
  );
  const howStudyWorked = trimSentence(
    `从摘要看，研究大致采用了这样的思路：先界定研究问题，再采集或整理相关暴露与结局数据，最后用统计或实验方法评估二者之间的关系。摘要中提到的关键信息可以概括为：${methodCN}`,
    180,
  );
  const everydayMeaning = trimSentence(
    `对普通读者来说，这篇论文更像是在回答“这种环境变化是不是可能影响我的健康或生活环境”。它不能直接给出个人诊断，但能帮助我们知道哪些风险值得更早关注。`,
    160,
  );
  const plainTextContent = [
    `这篇研究如果翻成大众语言，可以理解成：研究者正在检查一个环境变化，看看它会不会和真实健康结果、暴露水平或公共卫生压力有关。`,
    `先看最重要的发现。摘要里最值得抓住的两点是：${leadCN}；以及 ${supportCN}。这并不一定代表“已经完全证明”，但至少说明这个问题值得继续追踪。`,
    `再看研究怎么做。摘要透露出的关键信息可以概括为：${methodCN}。换句话说，研究者不是只在表达观点，而是在尝试用数据、实验或统计方法去回答问题。`,
    `如果把它放到日常生活里理解，这项研究其实是在提醒大家：面对“${input.category || "环境健康"}”议题时，哪些风险可能被低估了，哪些监测、预防或公共决策值得更早准备。`,
    `最后一定要记住：单篇论文更像“研究线索”，不是“终局答案”。如果要把它写成资讯或建议，必须同步写清楚样本范围、局限性和它还不能说明什么。`,
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
- 语言尽量口语化，避免术语堆砌；出现专业概念时要换成大众能懂的话
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
