# EnvInsight AI Pro

智能环境健康决策系统 —— 基于 AI 驱动的环境健康数据分析、合规审查与科研资讯平台。

## 功能

- **资讯流** — 基于 OpenAlex 真实论文抓取的环境健康资讯流，默认优先用 OpenAI 把英文论文转成中文大众解读，支持分类筛选、搜索、点赞评论，以及 OA / 高被引 / 近一年过滤
- **科研工作台** — 上传 CSV 后自动完成字段合规审查、数据体检、多模型对比与最优模型推荐
- **资讯 <-> 科研联动** — 论文可一键导入科研工作台，自动生成研究问题、数据需求、协作任务，并把分析结果回流成公众版摘要 + 发布前审查清单
- **多数据类型预览** — 内置连续型、二分类、时间序列、高风险隐私样本，方便演示完整链路
- **AI 合规方案** — 自动生成数据脱敏、版权核查、AI 审查工作流与发布前守则
- **报告 -> 论文** — 将分析结果结构化为报告与 IMRaD 论文初稿，并附带证据链
- **多人协作研究室** — 通过房间码/邀请链接共享成员、任务板、研究备注流、决策记录与协作历史，支持轻量多人协作
- **AI 讨论助手** — 页面级侧边栏，可围绕模型、隐私、论文写作等问题继续追问
- **导出** — 支持 PDF 报告导出与论文 Markdown 复制/下载

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + TailwindCSS + Recharts |
| 后端 | Express + Vite (开发中间件) |
| AI | OpenAI Chat Completions（服务端托管 + 超时 fallback） |
| 构建 | Vite 6 |
| 图表 | Recharts + Framer Motion |

## 快速开始

**前置条件:** Node.js 18+

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 OPENAI_API_KEY

# 3. 启动开发服务器
npm run dev
```

访问 http://localhost:3000

## 项目结构

```
├── server.ts              # Express 后端（REST API + Vite 中间件）
├── src/
│   ├── App.tsx            # 主应用组件
│   ├── main.tsx           # 入口文件
│   ├── types.ts           # TypeScript 类型定义
│   ├── index.css          # TailwindCSS 样式
│   └── services/
│       ├── aiService.ts           # 服务端 AI API 调用（分析、翻译、模拟）
│       └── localDataService.ts    # 数据服务（REST API + 本地存储）
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/news` | 获取资讯列表（支持 `q`、`category`、`oa`、`minCitations`、`publishedWithinDays`、`sort` 参数） |
| POST | `/api/news/crawl` | 按分类和筛选条件爬取最新论文 |
| POST | `/api/news/:id/like` | 点赞 |
| POST | `/api/news/:id/comment` | 发表评论 |
| GET | `/api/sample-data` | 获取示例数据 |
| POST | `/api/compliance/review` | 上传 CSV 进行字段级合规审查 |
| POST | `/api/analyze` | 上传 CSV 进行数据体检、多模型对比与默认分析 |
| POST | `/api/report` | 生成结构化报告 |
| POST | `/api/paper-draft` | 生成结构化论文初稿 |
| POST | `/api/ai/discuss` | 页面级 AI 讨论助手 |
| GET | `/api/audit-logs` | 获取审计轨迹 |

## 环境变量

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥（必需） |
| `OPENAI_MODEL` | 可选模型名，默认 `gpt-5-mini` |
| `DISABLE_NEWS_AI_SUMMARY` | 可选；设为 `true` 时，资讯侧不调用 OpenAI，改用本地通俗化 fallback |
| `APP_URL` | 应用部署地址 |

## 本地预览

- 运行 `npm run dev`
- 访问 `http://localhost:3000`
- 在“专业工作台”里可直接点击四组示例数据，预览：
  - 回归分析 + What-If + 报告/论文
  - 二分类模型对比
  - 时间序列趋势建模
  - 高风险隐私/版权拦截与 AI 脱敏方案
- 在“资讯流”里可进一步预览：
  - 按分类抓取真实论文并 30 分钟自动刷新
  - 仅看开放获取 OA / 高被引 / 近一年论文
  - 将论文导入科研工作台，继续做研究假设拆解、模型验证和协作分工
  - 查看“工作台结果能不能直接上传到资讯流”的风险判断与解决方案

## 可运行示例代码

- 先启动服务：`npm run dev`
- 再执行：`npm run demo:collab`
- 脚本位置：`examples/collaboration-demo.mjs`
- 该示例会自动演示：
  - 两位成员加入同一个研究协作房间
  - 基于成员角色控制决策与任务权限
  - 添加研究决策备注
  - 创建协作任务并切换状态
  - 输出最终协作快照与最近活动历史

## License

MIT
