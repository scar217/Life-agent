/**
 * 股票查询工具
 *
 * 支持 A 股和港股的实时行情查询、热门板块、涨幅榜及自选股查看。
 * 数据源：东方财富公开 API。
 */
import type { Tool } from './types'
import { fetchStockQuotes, fetchHotSectors, fetchGainers } from './stock-api'
import { prisma } from '@/server/db/client'

export function createStockTool(): Tool {
  return {
    name: 'get_stock_info',
    description:
      '查询股票实时行情、热门板块或涨幅榜。当用户询问股票价格、涨跌、行情时必须使用此工具。支持 A 股和港股。支持的操作: quote(实时行情)、hot_sectors(热门板块)、gainers(涨幅榜)、watchlist(查看自选股)。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description:
            '操作类型。quote=查行情(需要 symbols); hot_sectors=热门板块; gainers=涨幅榜; watchlist=查看自选股',
          enum: ['quote', 'hot_sectors', 'gainers', 'watchlist'],
        },
        symbols: {
          type: 'array',
          description:
            '股票代码列表，仅 quote 操作需要。支持格式: sh600519, sz000858, hk00700 或纯数字 600519',
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
              return JSON.stringify({
                success: false,
                error: '请提供要查询的股票代码',
                action,
              })
            }
            const items = await fetchStockQuotes(symbols)
            return JSON.stringify({ success: true, action, items })
          }

          case 'hot_sectors': {
            const sectors = await fetchHotSectors(count)
            return JSON.stringify({
              success: true,
              action: 'hot_sectors',
              sectors,
            })
          }

          case 'gainers': {
            const gainers = await fetchGainers(count)
            return JSON.stringify({
              success: true,
              action: 'gainers',
              gainers,
            })
          }

          case 'watchlist': {
            const userId = args._userId as string
            if (!userId) {
              return JSON.stringify({
                success: false,
                error: '未登录',
                action,
              })
            }
            const watchlist = await prisma.stockWatchlist.findMany({
              where: { userId },
              orderBy: { addedAt: 'desc' },
            })
            if (watchlist.length === 0) {
              return JSON.stringify({
                success: true,
                action: 'watchlist',
                items: [],
                message: '暂无自选股',
              })
            }
            const watchSymbols = watchlist.map((w) => w.symbol)
            const items = await fetchStockQuotes(watchSymbols)
            return JSON.stringify({ success: true, action: 'watchlist', items })
          }

          default:
            return JSON.stringify({
              success: false,
              error: `不支持的操作: ${action}`,
              action,
            })
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : '未知错误'
        return JSON.stringify({ success: false, error: msg, action })
      }
    },
  }
}
