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
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[StockAPI] Request timeout')
      throw new Error('股票数据请求超时，请稍后重试')
    }
    console.error('[StockAPI] Request failed:', error instanceof Error ? error.message : error)
    throw error
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
  const data = await eastmoneyFetch<{ data?: { rc?: Record<string, EMQuoteData> } | EMQuoteData | EMQuoteData[] }>(url)

  const items: EMQuoteData[] = []
  if (data.data) {
    if (Array.isArray(data.data)) {
      items.push(...(data.data as unknown as EMQuoteData[]))
    } else if (typeof data.data === 'object') {
      const obj = data.data as Record<string, unknown>
      // RC 包装格式
      if (obj.rc && typeof obj.rc === 'object') {
        items.push(...Object.values(obj.rc as Record<string, EMQuoteData>))
      } else {
        // 扁平对象或单只股票: 检查第一个 value 是否为股票数据
        const vals = Object.values(obj)
        const firstVal = vals[0]
        if (firstVal && typeof firstVal === 'object' && 'f43' in (firstVal as object)) {
          items.push(...(vals as EMQuoteData[]))
        } else {
          items.push(data.data as unknown as EMQuoteData)
        }
      }
    }
  }

  return items.map((item, i) => {
    // Try to infer market from the returned data
    const p = parsed[i]
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
    symbol: `${item.f12 || ''}`,
    name: String(item.f14 || ''),
    price: formatNumber(item.f2 as number),
    changePct: formatNumber(item.f3 as number),
  }))
}
