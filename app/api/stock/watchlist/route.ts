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
    console.error('[StockWatchlist] Create failed:', error)
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
