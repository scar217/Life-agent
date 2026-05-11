# 股票行情工具设计文档

## 概述

为 Chat AI 添加股票行情查询工具，扩展"AI 生活管家"能力。支持 A 股/港股实时行情、热门板块、涨幅榜、自选股关注列表。

## 数据来源

**东方财富免费公开 API**，无需 API Key：
- 实时行情：`push2.eastmoney.com/api/qt/stock/get`
- 列表数据：`push2.eastmoney.com/api/qt/clist/get`

## 数据库变更

新增 `StockWatchlist` 表，存储用户自选股：

```prisma
model StockWatchlist {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  symbol    String   // 东方财富格式：sh600519 / sz000858 / hk00700
  name      String   // 股票名称，冗余存储
  market    String   // SH / SZ / HK
  addedAt   DateTime @default(now())

  @@unique([userId, symbol])
  @@index([userId])
}
```

## 工具接口

工具名：`get_stock_info`

### action = "quote" — 实时行情

```
输入: { action: "quote", symbols: ["sh600519", "sz000858"] }
输出: {
  success: true,
  action: "quote",
  items: [{
    symbol, name, market,
    price, change, changePct,
    open, high, low,
    volume, turnover,
    pe, totalValue
  }]
}
```

### action = "hot_sectors" — 热门板块

```
输入: { action: "hot_sectors", count: 10 }
输出: { success: true, action: "hot_sectors", sectors: [...] }
```

### action = "gainers" — 涨幅榜

```
输入: { action: "gainers", count: 15 }
输出: { success: true, action: "gainers", gainers: [...] }
```

### action = "watchlist" — 自选股行情

```
输入: { action: "watchlist" }
输出: { success: true, action: "watchlist", items: [...] }
```

## 后端实现

### 新增文件

| 文件 | 职责 |
|------|------|
| `server/services/tools/stock-quote.ts` | `createStockTool()` 主工具，按 action 分发 |
| `server/services/tools/stock-api.ts` | 东方财富 API 封装层 |
| `server/services/tools/stock-utils.ts` | 代码格式转换 |

### 自选股管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/stock/watchlist` | 添加自选股 `{ symbol, name, market }` |
| DELETE | `/api/stock/watchlist?symbol=sh600519` | 删除自选股 |
| GET | `/api/stock/watchlist` | 获取自选股列表 |

## 前端实现

### 新增组件

| 文件 | 职责 |
|------|------|
| `features/chat/components/ChatMessage/StockQuoteCard.tsx` | 单股行情卡片 |
| `features/chat/components/ChatMessage/StockListCard.tsx` | 列表卡片（涨幅榜/板块） |
| `features/chat/components/ChatMessage/helpers/stock-formatter.ts` | 颜色/格式工具 |

### 配色规范

- 涨：红色（#ef4444）背景 + 文字 + ↑ 箭头
- 跌：绿色（#22c55e）背景 + 文字 + ↓ 箭头
- 平盘：灰色

### 渲染流程

1. `ToolInvocationItem` 检测 `invocation.name === 'get_stock_info'`
   - pending/running → "查询股市数据..." + 加载态
   - completed → `StockQuoteCard` 或 `StockListCard`
2. `ToolResultItem` 同理，处理持久化数据

### 需要修改的现有文件

| 文件 | 改动 |
|------|------|
| `ChatMessageUI.tsx` | ToolInvocationItem / ToolResultItem 增加 get_stock_info 分支 |
| `chat.service.ts` | SSE tool_result 处理增加股票字段 |
| `sse-writer.ts` | sendToolCall / sendToolResult 增加股票专用字段 |

## 实现顺序

1. 后端 API 层（stock-api.ts + stock-utils.ts）
2. 工具注册（stock-quote.ts + index.ts 注册）
3. 自选股 API（路由 + 数据库迁移）
4. 前端卡片组件（StockQuoteCard + StockListCard）
5. 前端集成（ChatMessageUI + chat.service.ts + chat.store.ts）
6. 自选股管理前端（对话内通过工具增删，未来可扩展设置页面）
