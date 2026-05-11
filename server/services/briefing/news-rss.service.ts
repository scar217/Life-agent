import Parser from 'rss-parser'

const parser = new Parser()

export interface NewsItem {
  title: string
  link: string
  pubDate?: string
  description?: string
  source: string
}

const RSS_FEEDS = [
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { name: 'The Decision Lab', url: 'https://www.thedecisionlab.com/feed/' },
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/full.xml' },
  { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss/' },
  { name: 'DeepMind', url: 'https://deepmind.com/blog/feed/basic/' },
  { name: 'Stripe Blog', url: 'https://stripe.com/blog/feed.rss' },
  { name: 'First Round Review', url: 'https://firstround.com/review/feed.xml' },
  { name: 'The Pragmatic Engineer', url: 'https://blog.pragmaticengineer.com/rss/' },
  { name: 'MIT News - AI', url: 'https://news.mit.edu/rss/topic/artificial-intelligence2' },
]

async function fetchRSSFeed(feedUrl: string, sourceName: string): Promise<NewsItem[]> {
  try {
    const feed = await parser.parseURL(feedUrl)
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
  return filtered.length > 0 ? filtered.slice(0, 15) : news.slice(0, 15)
}

export function formatNewsForAI(newsItems: NewsItem[]): string {
  return newsItems
    .map(
      (item, i) =>
        `${i + 1}. [${item.source}] ${item.title}\n   ${(item.description || '').substring(0, 150)}`
    )
    .join('\n')
}

export function formatNewsHTML(newsItems: NewsItem[]): string {
  const items = newsItems.slice(0, 15)
  let html = ''
  let currentSource = ''
  for (const item of items) {
    if (item.source !== currentSource) {
      if (currentSource) html += '</div>'
      currentSource = item.source
      html += `<h2 style="color:#007bff;border-left:4px solid #007bff;padding-left:10px;margin:20px 0 10px">${currentSource}</h2><div>`
    }
    html += `
      <div style="margin:10px 0;padding:12px;background:#f8f9fa;border-radius:6px">
        <a href="${item.link}" style="color:#007bff;text-decoration:none;font-weight:bold">${item.title}</a>
        ${item.description ? `<p style="color:#666;margin:6px 0 0;line-height:1.5">${item.description.substring(0, 200)}</p>` : ''}
        ${item.pubDate ? `<span style="color:#999;font-size:12px">${new Date(item.pubDate).toLocaleString('zh-CN')}</span>` : ''}
      </div>`
  }
  if (currentSource) html += '</div>'
  return html
}
