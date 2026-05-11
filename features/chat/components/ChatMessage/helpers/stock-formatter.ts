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
