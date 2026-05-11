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
