# EnvInsight AI Pro

智能环境健康决策系统 —— 基于 AI 驱动的环境健康数据分析与科研资讯平台。

## 功能

- **资讯流** — 环境健康领域学术论文的 AI 摘要解读，支持分类筛选与搜索
- **数据工作台** — 上传 CSV 数据，自动进行 OLS 回归分析，生成可视化图表
- **AI 智能解读** — 基于 Claude 的统计分析报告生成（研究者/大众双模式）
- **What-If 模拟** — 调整环境变量，预测对公共健康的潜在影响
- **PDF 报告导出** — 一键生成分析报告

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + TailwindCSS + Recharts |
| 后端 | Express + Vite (开发中间件) |
| AI | Anthropic Claude SDK |
| 构建 | Vite 6 |
| 图表 | Recharts + Framer Motion |

## 快速开始

**前置条件:** Node.js 18+

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 ANTHROPIC_API_KEY

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
│       ├── claudeService.ts       # Claude AI 调用（分析、翻译、模拟）
│       └── localDataService.ts    # 数据服务（REST API + 本地存储）
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/news` | 获取资讯列表（支持 `q`、`category` 参数） |
| POST | `/api/news/crawl` | 爬取最新论文 |
| POST | `/api/news/:id/like` | 点赞 |
| POST | `/api/news/:id/comment` | 发表评论 |
| GET | `/api/sample-data` | 获取示例数据 |
| POST | `/api/analyze` | 上传 CSV 进行回归分析 |

## 环境变量

| 变量 | 说明 |
|------|------|
| `ANTHROPIC_API_KEY` | Claude AI API 密钥（必需） |
| `APP_URL` | 应用部署地址 |

## License

MIT
