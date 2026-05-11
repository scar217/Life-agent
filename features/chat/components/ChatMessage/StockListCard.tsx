import { getColorScheme, formatPrice, formatChangePct } from './helpers/stock-formatter'

export interface StockListItem {
  symbol: string
  name: string
  price: number | null
  changePct: number | null
  turnoverRate?: number | null
  leadStock?: string | null
  code?: string
}

export interface StockListCardProps {
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
