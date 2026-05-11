'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/hooks/use-toast'
import { Loader2, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react'

interface WatchlistItem {
  id: string
  symbol: string
  name: string
  market: string
  addedAt: string
}

export default function StockWatchlistPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchWatchlist = useCallback(() => {
    fetch('/api/stock/watchlist')
      .then((res) => {
        if (res.status === 401) { router.push('/auth/signin'); return null }
        return res.json()
      })
      .then((data) => {
        if (data?.items) setItems(data.items)
      })
      .catch(() => toast({ title: '加载自选股失败' }))
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => { fetchWatchlist() }, [fetchWatchlist])

  async function handleAdd() {
    const trimmed = symbol.trim()
    if (!trimmed) { toast({ title: '请输入股票代码' }); return }

    setAdding(true)
    const res = await fetch('/api/stock/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: trimmed, name: name.trim() || undefined }),
    })
    const data = await res.json()
    if (res.ok) {
      toast({ title: '添加成功' })
      setSymbol('')
      setName('')
      fetchWatchlist()
    } else {
      toast({ title: data.error || '添加失败' })
    }
    setAdding(false)
  }

  async function handleDelete(s: string) {
    setDeleting(s)
    const res = await fetch(`/api/stock/watchlist?symbol=${encodeURIComponent(s)}`, { method: 'DELETE' })
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.symbol !== s))
    } else {
      toast({ title: '删除失败' })
    }
    setDeleting(null)
  }

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">自选股管理</h1>

      {/* 添加区域 */}
      <div className="space-y-3 rounded-lg border p-4">
        <Label>添加股票</Label>
        <div className="flex gap-2">
          <Input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="股票代码，如 600519"
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="名称（可选）"
            className="w-40"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={adding} size="icon">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* 自选股列表 */}
      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          暂无自选股，在上方添加
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <div>
                  <span className="font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {item.symbol.replace(/^(sh|sz|hk)/, '')} · {item.market}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(item.symbol)}
                disabled={deleting === item.symbol}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                {deleting === item.symbol ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
