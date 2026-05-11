import Parser from 'rss-parser'

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timeout')), ms)),
  ])
}

const parser = new Parser()

export interface NewsItem {
  title: string
  link: string
  pubDate?: string
  description?: string
  source: string
}

const RSS_FEEDS = [
  { name: '36氪', url: 'https://36kr.com/feed' },
  { name: '少数派', url: 'https://sspai.com/feed' },
  { name: 'IT之家', url: 'https://www.ithome.com/rss/' },
  { name: '爱范儿', url: 'https://www.ifanr.com/feed' },
  { name: 'InfoQ 中文', url: 'https://www.infoq.cn/feed' },
  { name: '掘金', url: 'https://juejin.cn/rss' },
  { name: '博客园', url: 'https://www.cnblogs.com/rss' },
  { name: '阮一峰的网络日志', url: 'https://www.ruanyifeng.com/blog/atom.xml' },
]

async function fetchRSSFeed(feedUrl: string, sourceName: string): Promise<NewsItem[]> {
  try {
    const feed = await withTimeout(parser.parseURL(feedUrl), 10000)
    return (feed.items || []).slice(0, 5).map((item) => ({
      title: item.title || '',
      link: item.link || '',
      pubDate: item.pubDate || undefined,
      description: item.contentSnippet || item.content || '',
      source: sourceName,
    }))
  } catch (error) {
    console.error(`Error fetching RSS from ${sourceName}:`, error)
    return []
  }
}

export async function fetchAllNews(): Promise<NewsItem[]> {
  const allNewsArrays = await Promise.all(
    RSS_FEEDS.map((feed) => fetchRSSFeed(feed.url, feed.name))
  )
  return allNewsArrays.flat().sort((a, b) => {
    if (!a.pubDate || !b.pubDate) return 0
    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  })
}

export function filterNewsByTopics(news: NewsItem[], topics: string): NewsItem[] {
  if (!news) return []
  if (!topics) return news.slice(0, 15)
  const keywords = topics.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
  if (keywords.length === 0) return news.slice(0, 15)
  const filtered = news.filter((item) =>
    keywords.some(
      (kw) =>
        item.title.toLowerCase().includes(kw) ||
        (item.description || '').toLowerCase().includes(kw)
    )
  )
  return filtered.length > 0 ? filtered.slice(0, 15) : []
}

export function formatNewsForAI(newsItems: NewsItem[]): string {
  if (!newsItems) return ''
  return newsItems
    .map(
      (item, i) =>
        `${i + 1}. [${item.source}] ${item.title}\n   链接: ${item.link}\n   ${(item.description || '').substring(0, 150)}`
    )
    .join('\n')
}

export function formatNewsHTML(newsItems: NewsItem[]): string {
  if (!newsItems) return ''
  const items = newsItems.slice(0, 15)
  let html = ''
  for (const item of items) {
    const safeLink = /^https?:\/\//i.test(item.link) ? escapeHtml(item.link) : '#'
    html += `
      <div style="margin:12px 0;padding:14px;background:#f8f9fa;border-radius:8px;border-left:3px solid #667eea">
        <span style="display:inline-block;background:#667eea;color:#fff;font-size:11px;padding:2px 8px;border-radius:4px;margin-right:8px;vertical-align:middle">${escapeHtml(item.source)}</span>
        <a href="${safeLink}" style="color:#333;text-decoration:none;font-weight:bold;font-size:15px;vertical-align:middle">${escapeHtml(item.title)}</a>
        ${item.description ? `<p style="color:#666;margin:8px 0 0;line-height:1.6;font-size:14px">${escapeHtml(item.description.substring(0, 200))}</p>` : ''}
      </div>`
  }
  return html
}
