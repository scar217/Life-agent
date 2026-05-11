import { createWeatherTool } from '@/server/services/tools/get-weather'
import {
  fetchAllNews,
  filterNewsByTopics,
  formatNewsForAI,
  formatNewsHTML,
  escapeHtml,
} from './news-rss.service'
import { sendBriefingEmail } from './email.service'

const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions'

// Non-streaming AI call for email generation
async function callAINonStreaming(
  apiKey: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  try {
    const response = await fetch(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V3.2',
        messages,
        stream: false,
        max_tokens: 2048,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      console.error('[Briefing] AI API error:', response.status)
      return ''
    }

    const data = await response.json()
    return data?.choices?.[0]?.message?.content || ''
  } catch (error) {
    console.error('[Briefing] AI API call failed:', error)
    return ''
  }
}

function buildBriefingPrompt(
  newsText: string,
  weatherData: string | null,
  newsTopics: string | null
): string {
  let prompt = `你是一个AI生活管家，请为用户生成每日简报的HTML内容（中文）。

## 今日新闻
${newsText}

## 天气`

  if (weatherData) {
    prompt += `\n${weatherData}`
  } else {
    prompt += `\n用户未设置城市，无天气数据。`
  }

  prompt += `

请生成HTML内容，要求：
1. 开头是一句亲切的日期问候
2. 如有天气数据，简要概括（温度、天气状况、出行建议）
3. 新闻部分：${newsTopics ? `优先介绍与"${newsTopics}"相关的新闻` : '按类别精选最重要的新闻'}
4. 每篇新闻附一句话摘要
5. 整体风格温馨专业，适合晨间阅读
6. 只输出 HTML 内容，不含 <!DOCTYPE>, <html>, <head>, <body> 标签`

  return prompt
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
      ? createWeatherTool(process.env.AMAP_API_KEY || '').execute({
          location: config.city,
        })
      : Promise.resolve(null),
  ])

  // 2. Filter news by user preferences
  const filteredNews = filterNewsByTopics(newsItems, config.newsTopics || '')
  const newsText = formatNewsForAI(filteredNews)

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

  // 4. AI generates the email body
  const prompt = buildBriefingPrompt(newsText, weatherData, config.newsTopics)
  const aiHTML = await callAINonStreaming(apiKey, [
    { role: 'user', content: prompt },
  ])

  // 5. Determine content: prefer AI-generated, fall back to formatted news
  const contentHTML = aiHTML || formatNewsHTML(filteredNews)
  if (!contentHTML) {
    return { success: false, error: 'Failed to generate briefing content' }
  }

  // 6. Assemble full HTML email
  const dateStr = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  const weatherHTML = weatherData
    ? `<div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:20px;border-radius:10px;margin:20px 0"><h2 style="margin:0 0 10px">&#x1F324; 今日天气</h2><p style="font-size:18px;margin:0">${escapeHtml(weatherData)}</p></div>`
    : ''

  const fullHTML = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff">
  <h1 style="color:#333;border-bottom:3px solid #667eea;padding-bottom:10px">&#x1F4F0; 每日简报</h1>
  <p style="color:#666;font-size:14px">${dateStr}</p>
  ${weatherHTML}
  <div style="margin:20px 0">${contentHTML}</div>
  <hr style="border:none;border-top:1px solid #eee;margin:30px 0">
  <p style="color:#999;font-size:12px;text-align:center">本简报由 AI Life Agent 自动生成</p>
</div>`

  // 7. Send
  const subject = `每日简报 — ${dateStr}`
  return sendBriefingEmail(config.email, subject, fullHTML)
}
