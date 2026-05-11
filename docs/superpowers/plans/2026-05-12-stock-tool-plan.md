# 股票行情工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AI Chat 添加股票行情查询工具，支持 A 股/港股实时行情、热门板块、涨幅榜、自选股关注列表。

**Architecture:** 新增 `get_stock_info` 工具，通过东方财富免费 API 获取数据，工具内按 `action` 参数分发到 quote/hot_sectors/gainers/watchlist 四种行为。自选股持久化到 PostgreSQL。前端通过 StockQuoteCard/StockListCard 组件渲染股票卡片（涨红跌绿）。

**Tech Stack:** TypeScript, Prisma, Zustand, React, Tailwind CSS, 东方财富公开 API

---

### Task 1: 股票代码转换工具

**Files:**
- Create: `server/services/tools/stock-utils.ts`

- [ ] **Step 1: 创建股票代码转换工具**

在 `server/services/tools/stock-utils.ts` 中创建：

```typescript
/**
 * 股票代码格式转换工具
 *
 * 用户输入   sh/sz 格式   东方财富 API 格式
 * 600519  → sh600519  → 1.600519   (SH)
 * 000858  → sz000858  → 0.000858   (SZ)
 * 00700   → hk00700   → 116.00700  (HK)
 */

const EASTMONEY_MARKET_MAP: Record<string, string> = {
  sh: '1',
  sz: '0',
  hk: '116',
}

const MARKET_NAME_MAP: Record<string, string> = {
  sh: 'SH',
  sz: 'SZ',
  hk: 'HK',
}

export interface ParsedSymbol {
  symbol: string     // sh600519
  market: string     // SH / SZ / HK
  marketCode: string // 1 / 0 / 116
  code: string       // 600519
}

/**
 * 将各种格式的股票代码统一解析为 ParsedSymbol
 * 支持输入: "600519" "sh600519" "SH600519" "1.600519"
 * 自动推断 market: 6 开头 → SH, 0/3 开头 → SZ, 纯数字 5 位 → HK
 */
export function parseSymbol(input: string): ParsedSymbol | null {
  const trimmed = input.trim()

  // 已带前缀 sh/sz/hk (不区分大小写)
  const prefixMatch = trimmed.match(/^(sh|sz|hk)(\d+)$/i)
  if (prefixMatch) {
    const market = prefixMatch[1].toLowerCase()
    const code = prefixMatch[2]
    return { symbol: `${market}${code}`, market: MARKET_NAME_MAP[market], marketCode: EASTMONEY_MARKET_MAP[market], code }
  }

  // 纯数字: 推断 market
  const digitsMatch = trimmed.match(/^(\d{5,6})$/)
  if (digitsMatch) {
    const code = digitsMatch[1]
    let market: string
    if (code.length === 5) {
      market = 'hk'
    } else if (code.startsWith('6')) {
      market = 'sh'
    } else {
      market = 'sz'
    }
    return { symbol: `${market}${code}`, market: MARKET_NAME_MAP[market], marketCode: EASTMONEY_MARKET_MAP[market], code }
  }

  return null
}

/**
 * 构建东方财富实时行情 API URL
 */
export function buildQuoteUrl(symbols: ParsedSymbol[]): string {
  const secids = symbols.map(s => `${s.marketCode}.${s.code}`).join(',')
  return `https://push2.eastmoney.com/api/qt/stock/get?secid=${secids}&fields=f43,f44,f45,f46,f47,f48,f49,f50,f51,f52,f57,f58,f116,f117,f162,f167,f168,f169,f170`
}

/**
 * 构建东方财富列表 API URL (板块/涨幅榜)
 */
export function buildListUrl(fs: string, pageSize: number): string {
  return `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${pageSize}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(fs)}&fields=f2,f3,f4,f8,f12,f14,f15,f16,f17,f18,f20`
}

export { EASTMONEY_MARKET_MAP, MARKET_NAME_MAP }
```

- [ ] **Step 2: 验证类型检查通过**

Run: `npx tsc --noEmit --pretty server/services/tools/stock-utils.ts`
Expected: 无错误 (如有依赖缺失则正常)

- [ ] **Step 3: Commit**

```bash
git add server/services/tools/stock-utils.ts
git commit -m "feat: add stock symbol parsing and API URL builder utilities"
```

---

### Task 2: 东方财富 API 封装层

**Files:**
- Create: `server/services/tools/stock-api.ts`

- [ ] **Step 1: 创建 API 封装层**

```typescript
/**
 * 东方财富 API 封装层
 */
import { buildQuoteUrl, buildListUrl, parseSymbol, type ParsedSymbol } from './stock-utils'

const FETCH_TIMEOUT = 8000

async function eastmoneyFetch<T>(url: string): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  try {
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://quote.eastmoney.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`东方财富 API 返回 ${response.status}`)
    }

    return await response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

interface EMQuoteData {
  f43?: number  // 最新价
  f44?: number  // 最高价
  f45?: number  // 最低价
  f46?: number  // 开盘价
  f47?: number  // 成交量（手）
  f48?: number  // 成交额
  f49?: number  // 涨跌额
  f50?: number  // 量比
  f51?: number  // 涨停价
  f52?: number  // 跌停价
  f57?: string  // 名称
  f58?: string  // 代码
  f116?: number // 总市值
  f117?: number // 市盈率
  f162?: number // 市盈率（动）
  f167?: number // 换手率
  f168?: number // 量比
  f169?: number // 涨跌幅
  f170?: number // 涨跌额
}

export interface StockQuoteItem {
  symbol: string
  name: string
  market: string
  price: number | null
  change: number | null
  changePct: number | null
  open: number | null
  high: number | null
  low: number | null
  volume: number | null
  turnover: number | null
  pe: number | null
  totalValue: number | null
  turnoverRate: number | null
}

function formatNumber(n: number | undefined | null): number | null {
  if (n === undefined || n === null) return null
  if (typeof n === 'number' && !isNaN(n)) return n
  const parsed = parseFloat(String(n))
  return isNaN(parsed) ? null : parsed
}

/**
 * 查询实时行情
 */
export async function fetchStockQuotes(rawSymbols: string[]): Promise<StockQuoteItem[]> {
  const parsed: ParsedSymbol[] = []
  for (const s of rawSymbols) {
    const p = parseSymbol(s)
    if (p) parsed.push(p)
  }
  if (parsed.length === 0) return []

  const url = buildQuoteUrl(parsed)
  const data = await eastmoneyFetch<{ data?: { rc?: Record<string, EMQuoteData> } | EMQuoteData }>(url)

  // 单只股票返回格式和批量不同
  const items: EMQuoteData[] = []
  if (data.data) {
    // 批量: data.data 是数组或 rc map
    if (Array.isArray(data.data)) {
      items.push(...data.data as unknown as EMQuoteData[])
    } else if ((data.data as { rc?: Record<string, EMQuoteData> }).rc) {
      items.push(...Object.values((data.data as { rc: Record<string, EMQuoteData> }).rc))
    } else {
      // 单只
      items.push(data.data as unknown as EMQuoteData)
    }
  }

  // 批量可能返回多个，建立 market.code → ParsedSymbol 的索引
  const parsedByMc = new Map<string, ParsedSymbol>()
  for (const p of parsed) {
    parsedByMc.set(`${p.marketCode}.${p.code}`, p)
  }

  return items.map((item, i) => {
    const p = parsed[i] || (item.f58 ? parseSymbol(item.f58) : null)
    return {
      symbol: p?.symbol || '',
      name: item.f57 || '',
      market: p?.market || '',
      price: formatNumber(item.f43),
      change: formatNumber(item.f170 ?? item.f49),
      changePct: formatNumber(item.f169),
      open: formatNumber(item.f46),
      high: formatNumber(item.f44),
      low: formatNumber(item.f45),
      volume: formatNumber(item.f47),
      turnover: formatNumber(item.f48),
      pe: formatNumber(item.f162 ?? item.f117),
      totalValue: formatNumber(item.f116),
      turnoverRate: formatNumber(item.f167),
    }
  })
}

export interface StockListItem {
  symbol: string
  name: string
  price: number | null
  changePct: number | null
}

/**
 * 查询热门板块
 */
export async function fetchHotSectors(count: number): Promise<Array<{ name: string; code: string; changePct: number | null; leadStock: string | null }>> {
  const url = buildListUrl('m:90+t2', count)
  const data = await eastmoneyFetch<{ data?: { diff?: Array<Record<string, unknown>> } }>(url)

  return (data.data?.diff || []).map((item) => ({
    name: String(item.f14 || ''),
    code: String(item.f12 || ''),
    changePct: formatNumber(item.f3 as number),
    leadStock: typeof item.f128 === 'string' && item.f128 ? item.f128 : null,
  }))
}

/**
 * 查询涨幅榜
 */
export async function fetchGainers(count: number): Promise<StockListItem[]> {
  const url = buildListUrl('m:0+t6,m:0+t7,m:1+t2,m:1+t23', count)
  const data = await eastmoneyFetch<{ data?: { diff?: Array<Record<string, unknown>> } }>(url)

  return (data.data?.diff || []).map((item) => ({
    symbol: `sh${item.f12 || ''}`,
    name: String(item.f14 || ''),
    price: formatNumber(item.f2 as number),
    changePct: formatNumber(item.f3 as number),
  }))
}
```

- [ ] **Step 2: Commit**

```bash
git add server/services/tools/stock-api.ts
git commit -m "feat: add Eastmoney stock API wrapper"
```

---

### Task 3: 股票查询工具实现

**Files:**
- Create: `server/services/tools/stock-quote.ts`

- [ ] **Step 1: 创建 stock-quote.ts**

```typescript
/**
 * 股票查询工具
 */
import type { Tool } from './types'
import { fetchStockQuotes, fetchHotSectors, fetchGainers } from './stock-api'
import { prisma } from '@/server/db/client'

export function createStockTool(): Tool {
  return {
    name: 'get_stock_info',
    description: '查询股票实时行情、热门板块或涨幅榜。当用户询问股票价格、涨跌、行情时必须使用此工具。支持 A 股和港股。支持的操作: quote(实时行情)、hot_sectors(热门板块)、gainers(涨幅榜)、watchlist(查看自选股)。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: '操作类型。quote=查行情(需要 symbols); hot_sectors=热门板块; gainers=涨幅榜; watchlist=查看自选股',
          enum: ['quote', 'hot_sectors', 'gainers', 'watchlist'],
        },
        symbols: {
          type: 'array',
          description: '股票代码列表，仅 quote 操作需要。支持格式: sh600519, sz000858, hk00700 或纯数字 600519',
          items: { type: 'string' },
        },
        count: {
          type: 'number',
          description: '返回数量，hot_sectors 和 gainers 操作使用，默认 10',
        },
      },
      required: ['action'],
    },
    execute: async (args) => {
      const action = args.action as string
      const symbols = (args.symbols as string[]) || []
      const count = Math.min((args.count as number) || 10, 20)

      try {
        switch (action) {
          case 'quote': {
            if (symbols.length === 0) {
              return JSON.stringify({ success: false, error: '请提供要查询的股票代码', action })
            }
            const items = await fetchStockQuotes(symbols)
            return JSON.stringify({ success: true, action, items })
          }

          case 'hot_sectors': {
            const sectors = await fetchHotSectors(count)
            return JSON.stringify({ success: true, action: 'hot_sectors', sectors })
          }

          case 'gainers': {
            const gainers = await fetchGainers(count)
            return JSON.stringify({ success: true, action: 'gainers', gainers })
          }

          case 'watchlist': {
            // 需要从参数或 context 获取 userId
            // userId 在 execute 时由调用方注入，这里从 args 中读取
            const userId = args._userId as string
            if (!userId) {
              return JSON.stringify({ success: false, error: '未登录', action })
            }
            const watchlist = await prisma.stockWatchlist.findMany({
              where: { userId },
              orderBy: { addedAt: 'desc' },
            })
            if (watchlist.length === 0) {
              return JSON.stringify({ success: true, action: 'watchlist', items: [], message: '暂无自选股' })
            }
            const watchSymbols = watchlist.map(w => w.symbol)
            const items = await fetchStockQuotes(watchSymbols)
            return JSON.stringify({ success: true, action: 'watchlist', items })
          }

          default:
            return JSON.stringify({ success: false, error: `不支持的操作: ${action}`, action })
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : '未知错误'
        return JSON.stringify({ success: false, error: msg, action })
      }
    },
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/services/tools/stock-quote.ts
git commit -m "feat: add stock market tool with quote/hot_sectors/gainers/watchlist actions"
```

---

### Task 4: 数据库迁移

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/...` (via prisma migrate)

- [ ] **Step 1: 在 prisma/schema.prisma 末尾添加 StockWatchlist model**

```prisma
/// 自选股关注表（用户→股票代码映射）
model StockWatchlist {
  /// 主键
  id        String   @id @default(cuid())
  /// 所属用户 ID
  userId    String
  /// 所属用户（级联删除）
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  /// 股票代码（东方财富格式：sh600519 / sz000858 / hk00700）
  symbol    String
  /// 股票名称（冗余存储）
  name      String
  /// 所属市场（SH / SZ / HK）
  market    String
  /// 添加时间
  addedAt   DateTime @default(now())

  @@unique([userId, symbol])
  @@index([userId])
}
```

- [ ] **Step 2: 运行数据库迁移**

Run: `npx prisma migrate dev --name add_stock_watchlist`
Expected: 成功创建迁移文件并应用到数据库

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add StockWatchlist model for user stock watchlist"
```

---

### Task 5: 自选股管理 API

**Files:**
- Create: `app/api/stock/watchlist/route.ts`

- [ ] **Step 1: 创建自选股 CRUD API**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/server/auth/utils'
import { prisma } from '@/server/db/client'
import { parseSymbol } from '@/server/services/tools/stock-utils'

// GET /api/stock/watchlist - 获取自选股列表
export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const items = await prisma.stockWatchlist.findMany({
    where: { userId },
    orderBy: { addedAt: 'desc' },
  })

  return NextResponse.json({ items })
}

// POST /api/stock/watchlist - 添加自选股
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { symbol, name, market } = body

  if (!symbol) {
    return NextResponse.json({ error: 'symbol 不能为空' }, { status: 400 })
  }

  const parsed = parseSymbol(symbol)
  if (!parsed) {
    return NextResponse.json({ error: '无法识别的股票代码' }, { status: 400 })
  }

  try {
    const item = await prisma.stockWatchlist.upsert({
      where: { userId_symbol: { userId, symbol: parsed.symbol } },
      update: { name: name || parsed.code },
      create: {
        userId,
        symbol: parsed.symbol,
        name: name || parsed.code,
        market: market || parsed.market,
      },
    })
    return NextResponse.json({ item })
  } catch (error) {
    return NextResponse.json({ error: '添加失败' }, { status: 500 })
  }
}

// DELETE /api/stock/watchlist - 删除自选股
export async function DELETE(req: NextRequest) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')

  if (!symbol) {
    return NextResponse.json({ error: 'symbol 不能为空' }, { status: 400 })
  }

  await prisma.stockWatchlist.deleteMany({
    where: { userId, symbol },
  })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/stock/
git commit -m "feat: add stock watchlist CRUD API endpoints"
```

---

### Task 6: 注册股票工具

**Files:**
- Modify: `server/services/tools/index.ts`

- [ ] **Step 1: 在 index.ts 中注册 get_stock_info 工具**

在 `server/services/tools/index.ts` 中添加导入和注册。

找到 `initTools` 函数，在现有工具注册代码后添加：

```typescript
// 在 initTools() 函数末尾添加 (其他工具注册代码之后):

// 注册股票查询工具（使用东方财富公开 API，无需 key）
import { createStockTool } from './stock-quote'
toolRegistry.register(createStockTool())

// 同时添加 createStockTool 到 exports:
```
同时更新文件顶部的 import 和底部的 export：

在 import 区域添加:
```typescript
import { createStockTool } from './stock-quote'
```

在 export 区域添加:
```typescript
export { createStockTool } from './stock-quote'
```

- [ ] **Step 2: Commit**

```bash
git add server/services/tools/index.ts
git commit -m "feat: register stock tool in tool registry"
```

---

### Task 7: SSE Writer 支持股票工具

**Files:**
- Modify: `server/services/chat/sse-writer.ts`

- [ ] **Step 1: 在 sendToolCall 和 sendToolResult 中添加股票工具支持**

**sendToolCall** (第 46-65 行) — 在 `if (tc.function.name === 'generate_image')` 后添加:

```typescript
if (tc.function.name === 'get_stock_info') {
  event.action = args.action
  event.symbols = args.symbols
}
```

**sendToolResult** (第 71-94 行) — 在最后一个 `if` 块后添加:

```typescript
if (result.name === 'get_stock_info') {
  event.action = parsed.action
  event.items = parsed.items
  event.sectors = parsed.sectors
  event.gainers = parsed.gainers
  event.resultCount = parsed.items?.length || parsed.sectors?.length || parsed.gainers?.length || 0
}
```

- [ ] **Step 2: Commit**

```bash
git add server/services/chat/sse-writer.ts
git commit -m "feat: add stock tool fields to SSE writer"
```

---

### Task 8: 客户端 ChatService 处理股票 SSE 事件

**Files:**
- Modify: `features/chat/services/chat.service.ts`
- Modify: `features/chat/types/chat.ts`

- [ ] **Step 1: 更新 chat.ts 中 SSEData 类型**

在 `features/chat/types/chat.ts` 的 `SSEData` 接口中添加股票相关字段:

在接口末尾（closing `}` 前）添加:
```typescript
  /** 股票查询 action（get_stock_info tool_call 事件） */
  action?: string
  /** 股票 symbol 数组（get_stock_info tool_call 事件） */
  symbols?: string[]
  /** 股票行情列表（get_stock_info tool_result 事件） */
  items?: Array<Record<string, unknown>>
  /** 热门板块列表（get_stock_info tool_result 事件） */
  sectors?: Array<Record<string, unknown>>
  /** 涨幅榜列表（get_stock_info tool_result 事件） */
  gainers?: Array<Record<string, unknown>>
```

- [ ] **Step 2: 更新 ToolInvocation 的 args 类型（chat.ts）**

`ToolInvocation` 的 `args` 已经支持 `[key: string]: unknown`，无需修改。

- [ ] **Step 3: 更新 chat.service.ts 的 SSE 处理**

在 `handleStream` 方法中:

**tool_call 事件** (第 333-359 行) — `args` 对象添加股票字段:

```typescript
// 在创建 newInvocation 处，args 扩展为:
args: {
  query: data.query,
  prompt: data.prompt,
  action: data.action,
  symbols: data.symbols,
},
```

**tool_result 事件** (第 386-405 行) — result 扩展为:

```typescript
result: {
  success: data.success ?? false,
  imageUrl: data.imageUrl,
  resultCount: data.resultCount,
  sources: data.sources,
  width: data.width,
  height: data.height,
  action: data.action,
  items: data.items,
  sectors: data.sectors,
  gainers: data.gainers,
},
```

- [ ] **Step 4: Commit**

```bash
git add features/chat/types/chat.ts features/chat/services/chat.service.ts
git commit -m "feat: handle stock tool SSE events in chat service"
```

---

### Task 9: 格式化工具消息处理股票结果

**Files:**
- Modify: `server/services/tools/handler.ts`

- [ ] **Step 1: 在 formatToolMessage 中添加股票结果处理**

在 `formatToolMessage` 函数中 (第 33-65 行)，现有的 if/else 链中添加:

```typescript
  // 股票结果：提取简要信息给 AI
  // 注意：如果 result.content 已经是 JSON 字符串，我们需要解析它并保留完整数据
  // AI 不需要看到完整 JSON，只需要知道结果成功即可
  // 但前端需要完整数据来渲染卡片，所以这里保持 content 原样传回
```
实际上股票结果已经是 JSON，AI 需要看到内容才能用自然语言回复。保持原样，不需要特殊处理。

- [ ] **Step 2: 无需修改，直接 commit 占位**

```bash
git commit --allow-empty -m "chore: verify stock tool message formatting needs no changes"
```

---

### Task 10: 股票卡片组件 - 格式化工具

**Files:**
- Create: `features/chat/components/ChatMessage/helpers/stock-formatter.ts`

- [ ] **Step 1: 创建格式化工具**

```typescript
/**
 * 股票展示格式化工具
 */

// 涨红跌绿 (中国股市配色)
export const STOCK_COLORS = {
  up: {
    bg: 'rgba(239, 68, 68, 0.08)',
    text: '#ef4444',
    border: 'rgba(239, 68, 68, 0.2)',
  },
  down: {
    bg: 'rgba(34, 197, 94, 0.08)',
    text: '#22c55e',
    border: 'rgba(34, 197, 94, 0.2)',
  },
  flat: {
    bg: 'rgba(156, 163, 175, 0.06)',
    text: '#9ca3af',
    border: 'rgba(156, 163, 175, 0.15)',
  },
} as const

export function getColorScheme(change: number | null | undefined): typeof STOCK_COLORS.up {
  if (change == null || change === 0) return STOCK_COLORS.flat
  return change > 0 ? STOCK_COLORS.up : STOCK_COLORS.down
}

export function formatPrice(n: number | null | undefined): string {
  if (n == null) return '--'
  return n.toFixed(2)
}

export function formatChangePct(n: number | null | undefined): string {
  if (n == null) return '--'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

export function formatChange(n: number | null | undefined): string {
  if (n == null) return '--'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}`
}

export function formatVolume(n: number | null | undefined): string {
  if (n == null) return '--'
  if (n >= 10000) return `${(n / 10000).toFixed(2)}万`
  return n.toString()
}

export function formatTurnover(n: number | null | undefined): string {
  if (n == null) return '--'
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿`
  if (n >= 1e4) return `${(n / 1e4).toFixed(2)}万`
  return n.toFixed(0)
}

export function getChangeArrow(change: number | null | undefined): string {
  if (change == null || change === 0) return '→'
  return change > 0 ? '↗' : '↘'
}
```

- [ ] **Step 2: Commit**

```bash
git add features/chat/components/ChatMessage/helpers/
git commit -m "feat: add stock display formatting utilities"
```

---

### Task 11: StockQuoteCard 组件

**Files:**
- Create: `features/chat/components/ChatMessage/StockQuoteCard.tsx`

- [ ] **Step 1: 创建 StockQuoteCard**

```typescript
import { Loader2, XCircle } from 'lucide-react'
import { getColorScheme, formatPrice, formatChange, formatChangePct, getChangeArrow, formatVolume, formatTurnover } from './helpers/stock-formatter'

interface StockQuoteItem {
  symbol: string
  name: string
  market: string
  price: number | null
  change: number | null
  changePct: number | null
  open: number | null
  high: number | null
  low: number | null
  volume: number | null
  turnover: number | null
  pe: number | null
  totalValue: number | null
}

interface StockQuoteCardProps {
  items: StockQuoteItem[]
  isLoading?: boolean
  error?: string
}

export function StockQuoteCard({ items, isLoading, error }: StockQuoteCardProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>查询股市数据...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <XCircle className="h-3.5 w-3.5" />
        <span>查询失败: {error}</span>
      </div>
    )
  }

  return (
    <div className="space-y-3 py-1">
      {items.map((item) => {
        const color = getColorScheme(item.changePct)
        return (
          <div
            key={item.symbol}
            className="rounded-lg border p-3 text-sm"
            style={{ backgroundColor: color.bg, borderColor: color.border }}
          >
            {/* 头部: 名称 + 代码 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{item.name}</span>
                <span className="text-xs text-muted-foreground">{item.symbol.replace(/^(sh|sz|hk)/, '').toUpperCase()}</span>
                <span className="text-xs px-1 rounded border text-muted-foreground">{item.market}</span>
              </div>
            </div>

            {/* 价格 + 涨跌 */}
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-foreground">
                ¥{formatPrice(item.price)}
              </span>
              <span style={{ color: color.text }} className="font-medium">
                {formatChange(item.change)}
              </span>
              <span style={{ color: color.text }} className="font-medium">
                {formatChangePct(item.changePct)} {getChangeArrow(item.changePct)}
              </span>
            </div>

            {/* 明细 */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>今开</span>
                <span className="text-foreground">{formatPrice(item.open)}</span>
              </div>
              <div className="flex justify-between">
                <span>最高</span>
                <span className="text-foreground">{formatPrice(item.high)}</span>
              </div>
              <div className="flex justify-between">
                <span>最低</span>
                <span className="text-foreground">{formatPrice(item.low)}</span>
              </div>
              <div className="flex justify-between">
                <span>成交量</span>
                <span className="text-foreground">{formatVolume(item.volume)}手</span>
              </div>
              {item.turnover != null && (
                <div className="flex justify-between">
                  <span>成交额</span>
                  <span className="text-foreground">{formatTurnover(item.turnover)}</span>
                </div>
              )}
              {item.pe != null && (
                <div className="flex justify-between">
                  <span>市盈率</span>
                  <span className="text-foreground">{item.pe.toFixed(2)}</span>
                </div>
              )}
              {item.totalValue != null && (
                <div className="flex justify-between">
                  <span>总市值</span>
                  <span className="text-foreground">{formatTurnover(item.totalValue)}</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add features/chat/components/ChatMessage/StockQuoteCard.tsx
git commit -m "feat: add StockQuoteCard component with red/green color scheme"
```

---

### Task 12: StockListCard 组件

**Files:**
- Create: `features/chat/components/ChatMessage/StockListCard.tsx`

- [ ] **Step 1: 创建 StockListCard**

```typescript
import { getColorScheme, formatPrice, formatChangePct } from './helpers/stock-formatter'

interface StockListItem {
  symbol: string
  name: string
  price: number | null
  changePct: number | null
  turnoverRate?: number | null
  leadStock?: string | null
  code?: string
}

interface StockListCardProps {
  title: string
  items: StockListItem[]
}

export function StockListCard({ title, items }: StockListCardProps) {
  return (
    <div className="rounded-lg border p-3 text-sm space-y-2">
      <div className="font-medium text-sm text-foreground">{title}</div>
      <div className="space-y-1">
        {items.map((item, index) => {
          const color = getColorScheme(item.changePct)
          return (
            <div key={item.symbol || index} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-muted-foreground w-5 text-right">{index + 1}</span>
                <span className="text-sm font-medium truncate max-w-[120px]">{item.name}</span>
                {'code' in item && item.code && (
                  <span className="text-xs text-muted-foreground">{item.code as string}</span>
                )}
                {'leadStock' in item && item.leadStock && (
                  <span className="text-xs text-muted-foreground truncate">领涨: {item.leadStock}</span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm">{formatPrice(item.price)}</span>
                <span className="text-sm font-medium min-w-[70px] text-right" style={{ color: color.text }}>
                  {formatChangePct(item.changePct)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add features/chat/components/ChatMessage/StockListCard.tsx
git commit -m "feat: add StockListCard component for list-style stock display"
```

---

### Task 13: 集成到 ChatMessageUI

**Files:**
- Modify: `features/chat/components/ChatMessage/ChatMessageUI.tsx`

- [ ] **Step 1: 添加导入**

在文件头部导入区域添加:
```typescript
import { StockQuoteCard } from './StockQuoteCard'
import { StockListCard } from './StockListCard'
```

- [ ] **Step 2: ToolInvocationItem 中添加 get_stock_info 分支**

在 `ToolInvocationItem` 函数中 (第 98-173 行)，在 `web_search` 分支 (第 168-170 行) 之前添加:

```typescript
  // 股票查询工具
  if (invocation.name === 'get_stock_info') {
    if (invocation.state === 'running' || invocation.state === 'pending') {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>查询股市数据...</span>
        </div>
      )
    }

    if (invocation.state === 'failed') {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <XCircle className="h-3.5 w-3.5" />
          <span>查询失败</span>
        </div>
      )
    }

    if (invocation.state === 'completed' && invocation.result) {
      const result = invocation.result
      const action = result.action as string

      if (action === 'quote' || action === 'watchlist') {
        return <StockQuoteCard items={(result.items as StockQuoteItem[]) || []} />
      }

      if (action === 'hot_sectors') {
        return <StockListCard title="热门板块" items={(result.sectors as StockListItem[]) || []} />
      }

      if (action === 'gainers') {
        return <StockListCard title="涨幅榜" items={(result.gainers as StockListItem[]) || []} />
      }
    }

    return null
  }
```

- [ ] **Step 3: ToolResultItem 中添加 get_stock_info 分支**

在 `ToolResultItem` 函数中 (第 179-224 行)，在 `web_search` 分支之前添加:

```typescript
  // 股票查询结果
  if (result.name === 'get_stock_info' && result.result.success) {
    const action = result.result.action as string

    if (action === 'quote' || action === 'watchlist') {
      return <StockQuoteCard items={(result.result.items as StockQuoteItem[]) || []} />
    }

    if (action === 'hot_sectors') {
      return <StockListCard title="热门板块" items={(result.result.sectors as StockListItem[]) || []} />
    }

    if (action === 'gainers') {
      return <StockListCard title="涨幅榜" items={(result.result.gainers as StockListItem[]) || []} />
    }
  }
```

- [ ] **Step 4: 从已有导入添加 Loader2 和 XCircle (如果还没有)**

检查第 16 行导入，`Loader2` 和 `XCircle` 已在现有导入中。确认即可。

- [ ] **Step 5: Commit**

```bash
git add features/chat/components/ChatMessage/ChatMessageUI.tsx
git commit -m "feat: integrate stock card components into ChatMessageUI"
```

---

### Task 14: 服务端 Chat Service 注册股票工具

**Files:**
- Modify: `server/services/chat/chat.service.ts`

- [ ] **Step 1: 在工具启用列表中添加 get_stock_info**

在 `handleChatRequest` 函数中 (第 80-103 行)，在其他工具注册代码后添加:

```typescript
  if (toolRegistry.has('get_stock_info')) {
    enabledTools.push(toolRegistry.get('get_stock_info')!)
  }
```

- [ ] **Step 2: Commit**

```bash
git add server/services/chat/chat.service.ts
git commit -m "feat: enable stock tool in chat request handler"
```

---

### Task 15: 验证与测试

**Files:** None (manual testing)

- [ ] **Step 1: TypeScript 编译检查**

Run: `npx tsc --noEmit`
Expected: 无新增类型错误

- [ ] **Step 2: 启动开发服务器**

Run: `pnpm dev`
Expected: 服务正常启动，无错误

- [ ] **Step 3: 功能验证**

在聊天界面测试以下场景:
1. 发送 "贵州茅台股价多少" → 应显示 StockQuoteCard
2. 发送 "查看热门板块" → 应显示 StockListCard
3. 发送 "今天涨幅榜" → 应显示 StockListCard
4. 发送 "把我自选股里的茅台加上" → AI 应调用 add to watchlist API

- [ ] **Step 4: 颜色验证**

确认: 涨 → 红色显示，跌 → 绿色显示

- [ ] **Step 5: Commit (if needed)**

```bash
git add .
git commit -m "chore: verify stock tool end-to-end functionality"
```
