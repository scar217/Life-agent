# Life Agent

AI 生活管家 — 智能对话、每日简报、语音交互、多工具调用。

## 功能

### 对话
- 流式响应（SSE），实时打字动画
- 多模型切换（Qwen / DeepSeek 系列）
- 思考模式，推理过程可视化
- 会话管理（创建、删除、重命名、置顶）
- 消息操作（复制、重试、朗读）

### AI 工具
- **联网搜索** — 调用 Tavily API 获取实时信息
- **天气查询** — 支持中国城市天气
- **图片生成** — 通过 SiliconFlow 生成图片
- **股票行情** — 东方财富实时数据，支持 A 股和港股

### 每日简报
- RSS 新闻聚合，按主题筛选
- AI 生成个性化晨间问候
- 股票自选股行情汇总
- 定时邮件推送（node-cron）

### 语音
- 语音输入：录音转文字（SenseVoice）
- 语音输出：文字转语音（CosyVoice2，8 种音色）

### 其他
- 文件上传（.txt / .md，最大 1MB）
- 分享对话（生成分享链接）
- 导出对话为 Markdown
- 深色模式 / 响应式布局

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router + Turbopack) |
| 语言 | TypeScript |
| 数据库 | PostgreSQL + Prisma ORM |
| 认证 | NextAuth.js v4 (Google / GitHub / 邮箱) |
| 状态管理 | Zustand |
| UI | Tailwind CSS + shadcn/ui + Lucide |
| AI | SiliconFlow API（对话 / 语音 / 图片生成） |
| 邮件 | Nodemailer |
| 定时任务 | node-cron |

## 快速开始

### 环境要求

- Node.js v22.20.0
- PostgreSQL
- pnpm

### 安装

```bash
pnpm install
```

### 配置

创建 `.env` 文件：

```env
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/lifeagent"

# Auth.js
AUTH_SECRET="your-secret-key"

# OAuth（可选）
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
AUTH_GITHUB_ID="your-github-client-id"
AUTH_GITHUB_SECRET="your-github-client-secret"

# SiliconFlow API（必填）
SILICONFLOW_API_KEY="sk-xxx"

# 工具 API（可选）
TAVILY_API_KEY="tvly-xxx"          # 联网搜索
WEATHER_API_KEY="xxx"              # 天气查询

# 邮件推送（可选）
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="noreply@example.com"
SMTP_PASS="your-password"
```

### 数据库

```bash
pnpm prisma generate
pnpm prisma migrate dev
```

### 运行

```bash
pnpm dev          # 开发模式
pnpm build        # 生产构建
pnpm start        # 启动生产服务
```

## 可用脚本

```bash
pnpm dev             # 启动开发服务器
pnpm build           # 生产构建
pnpm start           # 启动生产服务
pnpm lint            # ESLint 检查
pnpm format          # Prettier 格式化
pnpm format:check    # 检查格式
pnpm clean:logs      # 预览 console.log 清理
pnpm clean:logs --write  # 执行 console.log 清理
pnpm db:generate     # 生成 Prisma Client
pnpm db:migrate      # 数据库迁移
pnpm db:studio       # Prisma Studio（数据库 GUI）
pnpm db:push         # 直接推送 Schema 到数据库
```

## 项目结构

```
app/                       # Next.js App Router
├── api/chat/             # 对话接口（SSE 流式响应）
├── api/auth/             # 认证接口
├── api/message/          # 消息 CRUD
├── api/share/            # 分享链接
└── auth/                 # 登录/注册页面

components/               # 全局 UI 组件
└── ui/                   # shadcn/ui 基础组件

features/                 # 客户端功能模块
├── auth/                 # 认证（登录弹窗、OAuth 回调）
├── chat/                 # 对话核心（Store、SSE 解析、消息渲染）
├── conversation/         # 会话列表
├── share/                # 分享功能
└── voice/                # 语音输入/输出

server/                   # 服务端代码
├── auth/                 # NextAuth 配置、JWT、密码哈希
├── db/                   # Prisma 客户端单例
├── repositories/         # 数据访问层
├── services/
│   ├── ai/              # SiliconFlow API 客户端
│   ├── chat/            # 对话编排、SSE 流、Prompt 构建
│   ├── tools/           # AI 工具系统（搜索/天气/图片/股票）
│   ├── briefing/        # 每日简报（RSS 新闻、邮件推送）
│   ├── image/           # 图片生成与缓存
│   ├── export/          # Markdown 导出
│   └── geo/             # IP 地理位置查询
└── middleware/           # 审计日志中间件

lib/                      # 共享工具
├── stores/              # UI 偏好 Store
├── hooks/               # 通用 React Hooks
└── utils/               # 工具函数

prisma/schema.prisma      # 数据库模型定义
```
