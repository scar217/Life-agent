import { createWeatherTool } from '@/server/services/tools/get-weather'
import {
  fetchAllNews,
  filterNewsByTopics,
  formatNewsHTML,
  escapeHtml,
} from './news-rss.service'
import { sendBriefingEmail } from './email.service'

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
    ? `<div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:20px;border-radius:10px;margin:20px 0"><h2 style="margin:0 0 10px">&#x1F324; 今日天气</h2><p style="font-size:18px;margin:0">${escapeHtml(weatherData)}</p></div>`
    : ''

  const fullHTML = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff">
    <h1 style="color:#333;border-bottom:3px solid #667eea;padding-bottom:10px">&#x1F4F0; 每日简报</h1>
    <p style="color:#666;font-size:14px">${dateStr}</p>
    ${greeting ? `<p style="font-size:16px;line-height:1.8;color:#444;margin:15px 0">${escapeHtml(greeting)}</p>` : ''}
    ${weatherHTML}
    <h2 style="color:#333;margin:25px 0 15px">&#x1F4A1; 今日要闻</h2>
    ${newsHTML}
    <hr style="border:none;border-top:1px solid #eee;margin:30px 0">
    <p style="color:#999;font-size:12px;text-align:center">本简报由 AI Life Agent 自动生成</p>
  </div>`

  // 5. Send
  const subject = `每日简报 — ${dateStr}`
  return sendBriefingEmail(config.email, subject, fullHTML)
}
