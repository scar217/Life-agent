'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/lib/hooks/use-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function BriefingSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [pushHour, setPushHour] = useState(8)
  const [city, setCity] = useState('')
  const [newsTopics, setNewsTopics] = useState('')
  const [isEnabled, setIsEnabled] = useState(true)

  useEffect(() => {
    fetch('/api/briefing/config')
      .then((res) => {
        if (res.status === 401) { router.push('/auth/signin'); return null }
        return res.json()
      })
      .then((data) => {
        if (data) {
          setEmail(data.email || '')
          setPushHour(data.pushHour ?? 8)
          setCity(data.city || '')
          setNewsTopics(data.newsTopics || '')
          setIsEnabled(data.isEnabled ?? true)
        }
      })
      .catch(() => toast({ title: '加载配置失败' }))
      .finally(() => setLoading(false))
  }, [router])

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/briefing/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, pushHour, city, newsTopics, isEnabled }),
    })
    if (res.ok) {
      toast({ title: '保存成功' })
    } else {
      const data = await res.json()
      toast({ title: data.error || '保存失败' })
    }
    setSaving(false)
  }

  if (loading) return <div className="flex justify-center p-10">加载中...</div>

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">每日简报设置</h1>

      <div className="space-y-2">
        <Label htmlFor="email">接收邮箱 *</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
      </div>

      <div className="space-y-2">
        <Label>推送时间</Label>
        <Select value={String(pushHour)} onValueChange={(v) => setPushHour(Number(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: 24 }, (_, i) => (
              <SelectItem key={i} value={String(i)}>{`${i}:00`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="city">城市（天气）</Label>
        <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="例如：北京" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="topics">新闻主题（逗号分隔，可选）</Label>
        <Input id="topics" value={newsTopics} onChange={(e) => setNewsTopics(e.target.value)} placeholder="例如：AI, 科技, 创业" />
      </div>

      <div className="flex items-center justify-between">
        <Label>启用推送</Label>
        <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? '保存中...' : '保存'}
      </Button>
    </div>
  )
}
