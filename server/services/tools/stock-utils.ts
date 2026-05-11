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
 * 支持输入: "600519" "sh600519" "SH600519"
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
  const digitsMatch = trimmed.match(/^(\d{1,6})$/)
  if (digitsMatch) {
    const code = digitsMatch[1]
    let market: string
    // 6 digits starting with 6 or 9 → SH (A股上海)
    if (code.length === 6 && (code.startsWith('6') || code.startsWith('9'))) {
      market = 'sh'
    // 6 digits starting with 0 or 3 → SZ (A股深圳)
    } else if (code.length === 6 && (code.startsWith('0') || code.startsWith('3'))) {
      market = 'sz'
    // Otherwise → HK (港股: 1-5 digits, or 6 digits not matching A-share)
    } else {
      market = 'hk'
    }
    return { symbol: `${market}${code}`, market: MARKET_NAME_MAP[market], marketCode: EASTMONEY_MARKET_MAP[market], code }
  }

  return null
}

/**
 * 构建东方财富实时行情 API URL
 */
export function buildQuoteUrl(symbols: ParsedSymbol[]): string {
  if (symbols.length === 0) throw new Error('symbols array cannot be empty')
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
