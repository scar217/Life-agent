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
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const safeLink = /^https?:\/\//i.test(item.link) ? escapeHtml(item.link) : '#'
    const ariaLabel = `阅读 ${item.source} 新闻: ${item.title}`
    const isLast = i === items.length - 1
    html += `
      <div style="padding:24px 0;border-bottom:${isLast ? 'none' : '1px dashed #e5e7eb'}">
        <div style="display:flex;align-items:center;margin-bottom:12px;gap:12px">
          <span style="background-color:#94a3b8;color:#fff;font-size:13px;padding:4px 14px;border-radius:20px;white-space:nowrap">${escapeHtml(item.source)}</span>
          <a href="${safeLink}" aria-label="${escapeHtml(ariaLabel)}" class="news-link" style="font-size:18px;color:#1f2937;font-weight:500;text-decoration:none">${escapeHtml(item.title)}</a>
        </div>
        ${item.description ? `<p style="font-size:15px;color:#6b7280;line-height:1.7;margin:0">${escapeHtml(item.description.substring(0, 200))}</p>` : ''}
      </div>`
  }
  return html
}
