import { createWeatherTool } from '@/server/services/tools/get-weather'
import {
  fetchAllNews,
  filterNewsByTopics,
  formatNewsHTML,
  escapeHtml,
} from './news-rss.service'
import { sendBriefingEmail } from './email.service'
import { prisma } from '@/server/db/client'
import { fetchStockQuotes, type StockQuoteItem } from '@/server/services/tools/stock-api'

const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions'

// AI writes only a personalized greeting, not full HTML
async function generateGreeting(
  apiKey: string,
  weatherData: string | null,
  newsCount: number,
  newsTopics: string | null
): Promise<string> {
  let prompt = `你是一个AI生活管家。请用2-3句话写一段亲切的晨间问候语（中文），内容包括：`

  if (weatherData) {
    prompt += `\n- 提及今日天气概况（${weatherData}），给一句出行或穿衣小建议`
  }

  prompt += `\n- 提及今日为你精选了${newsCount}条${newsTopics ? `与"${newsTopics}"相关的` : ''}新闻`
  prompt += `\n\n只输出问候语本身，不要任何标记、标题或格式。`

  try {
    const response = await fetch(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V3.2',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        max_tokens: 256,
        temperature: 0.7,
      }),
    })
    if (!response.ok) return ''
    const data = await response.json()
    return data?.choices?.[0]?.message?.content || ''
  } catch {
    return ''
  }
}

function formatStocksHTML(quotes: StockQuoteItem[]): string {
  if (quotes.length === 0) return ''

  const rows = quotes.map((q) => {
    const name = escapeHtml(q.name || q.symbol)
    const code = escapeHtml(q.symbol.replace(/^(sh|sz|hk)/, ''))
    const price = q.price?.toFixed(2) ?? '--'

    const changeVal = q.change ?? 0
    const changeStr =
      q.change != null
        ? `${changeVal > 0 ? '+' : ''}${changeVal.toFixed(2)}`
        : '--'
    const changeColor =
      changeVal > 0 ? '#ef4444' : changeVal < 0 ? '#22c55e' : '#94a3b8'

    const pctVal = q.changePct ?? 0
    const pctStr =
      q.changePct != null
        ? `${pctVal > 0 ? '+' : ''}${pctVal.toFixed(2)}%`
        : '--'
    const pctColor =
      pctVal > 0 ? '#ef4444' : pctVal < 0 ? '#22c55e' : '#94a3b8'

    return `<tr style="border-bottom:1px solid rgba(255,255,255,0.1)">
      <td style="padding:8px 6px;font-size:14px">${name}</td>
      <td style="padding:8px 6px;font-size:12px;color:#94a3b8">${code}</td>
      <td style="padding:8px 6px;font-size:14px;text-align:right">${price}</td>
      <td style="padding:8px 6px;font-size:13px;text-align:right;color:${changeColor}">${changeStr}</td>
      <td style="padding:8px 6px;font-size:13px;text-align:right;color:${pctColor}">${pctStr}</td>
    </tr>`
  }).join('')

  return `<div style="background-color:#1e293b;background-image:linear-gradient(135deg,#1e293b,#334155);color:#e2e8f0;padding:20px;border-radius:10px;margin:20px 0">
    <h2 style="margin:0 0 12px">&#x1F4C8; 今日自选股行情</h2>
    <table style="width:100%;border-collapse:collapse;color:#e2e8f0">
      <thead>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.2)">
          <th style="padding:6px;text-align:left;font-size:12px;color:#94a3b8">股票名称</th>
          <th style="padding:6px;text-align:left;font-size:12px;color:#94a3b8">代码</th>
          <th style="padding:6px;text-align:right;font-size:12px;color:#94a3b8">最新价</th>
          <th style="padding:6px;text-align:right;font-size:12px;color:#94a3b8">涨跌额</th>
          <th style="padding:6px;text-align:right;font-size:12px;color:#94a3b8">涨跌幅</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`
}

export interface BriefingConfig {
  id: string
  userId: string
  email: string
  city: string | null
  newsTopics: string | null
  user: { apiKey: string | null }
}

export async function generateAndSendBriefing(
  config: BriefingConfig,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Concurrent: weather + RSS news
  const [newsItems, weatherResult] = await Promise.all([
    fetchAllNews(),
    config.city
      ? createWeatherTool(process.env.WEATHER_API_KEY || '').execute({
          location: config.city,
        })
      : Promise.resolve(null),
  ])

  // 2. Filter news by user preferences
  const filteredNews = filterNewsByTopics(newsItems, config.newsTopics || '')

  // 3. Parse weather
  let weatherData: string | null = null
  if (weatherResult) {
    try {
      const parsed = JSON.parse(weatherResult)
      if (parsed.success) {
        const parts: string[] = []
        if (parsed.city) parts.push(parsed.city)
        if (parsed.condition) parts.push(parsed.condition)
        if (parsed.temp !== null && parsed.temp !== undefined)
          parts.push(`${parsed.temp}°C`)
        if (parsed.humidity !== undefined && parsed.humidity !== null)
          parts.push(`湿度${parsed.humidity}%`)
        if (parsed.wind) parts.push(parsed.wind)
        if (parsed.reportTime) parts.push(`更新于${parsed.reportTime}`)
        weatherData = parts.join('，')
      }
    } catch {
      /* ignore parse errors */
    }
  }

  // 3.5. 获取用户自选股行情
  let stocksHTML = ''
  try {
    const watchlistItems = await prisma.stockWatchlist.findMany({
      where: { userId: config.userId },
      orderBy: { addedAt: 'asc' },
    })
    if (watchlistItems.length > 0) {
      const symbols = watchlistItems.map((w) => w.symbol)
      const quotes = await fetchStockQuotes(symbols)
      stocksHTML = formatStocksHTML(quotes)
    }
  } catch (err) {
    console.error('[Briefing] Failed to fetch stock data:', err instanceof Error ? err.message : err)
  }

  // 4. Assemble full HTML email (code controls structure, AI only writes greeting)
  const dateStr = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  const greeting = await generateGreeting(apiKey, weatherData, filteredNews.length, config.newsTopics)
  const newsHTML = formatNewsHTML(filteredNews)

  const weatherHTML = weatherData
    ? `<div style="background-color:#667eea;background-image:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:20px;border-radius:10px;margin:20px 0"><h2 style="margin:0 0 10px">&#x1F324; 今日天气</h2><p style="font-size:18px;margin:0">${escapeHtml(weatherData)}</p></div>`
    : ''

  const emptyNewsHTML = '<p style="color:#999;font-size:14px;text-align:center;padding:30px 0">暂无新闻，请稍后查看</p>'

  const fullHTML = `<div lang="zh-CN" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff">
    <style>
      .news-link:hover { color: #3b82f6 !important; text-decoration: underline !important; }
    </style>
    <header><h1 style="color:#333;border-bottom:3px solid #667eea;padding-bottom:10px">&#x1F4F0; 每日简报</h1></header>
    <p style="color:#444;font-size:14px">${dateStr}</p>
    <main>
      ${greeting ? `<p style="font-size:16px;line-height:1.8;color:#444;margin:15px 0">${escapeHtml(greeting)}</p>` : ''}
      ${weatherHTML}
      ${stocksHTML}
      <div style="box-shadow:0 2px 16px rgba(0,0,0,0.08);border-radius:12px;padding:20px 30px;margin:20px 0;background:#fff">
        <div style="display:flex;align-items:center;border-bottom:1px solid #f0f2f5;padding-bottom:15px;margin-bottom:10px"><div style="width:6px;height:24px;background-color:#3b82f6;border-radius:4px;margin-right:12px"></div><h2 style="font-size:24px;font-weight:bold;color:#3b82f6;margin:0;letter-spacing:1px">精选新闻</h2></div>
        ${newsHTML || emptyNewsHTML}
      </div>
    </main>
    <footer>
      <hr style="border:none;border-top:1px solid #eee;margin:30px 0">
      <p style="color:#666;font-size:12px;text-align:center">本简报由 AI Life Agent 自动生成</p>
    </footer>
  </div>`

  // 5. Send
  const subject = `每日简报 — ${dateStr}`
  return sendBriefingEmail(config.email, subject, fullHTML)
}
