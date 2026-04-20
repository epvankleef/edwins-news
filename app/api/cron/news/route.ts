import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function decodeHTML(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

const RSS_SOURCES: { url: string; source: string; category: string; maxItems?: number; cutoffHours?: number }[] = [
  // AI-labs (eigen blogs) — posten niet dagelijks, ruimere cutoff
  { url: 'https://openai.com/news/rss.xml', source: 'OpenAI', category: 'ai', cutoffHours: 72 },
  { url: 'https://www.anthropic.com/rss.xml', source: 'Anthropic', category: 'ai', cutoffHours: 72 },
  { url: 'https://blog.google/technology/ai/rss/', source: 'Google AI', category: 'ai', cutoffHours: 72 },
  { url: 'https://blogs.microsoft.com/ai/feed/', source: 'Microsoft AI', category: 'ai', cutoffHours: 72 },
  { url: 'https://huggingface.co/blog/feed.xml', source: 'Hugging Face', category: 'ai', cutoffHours: 72 },
  { url: 'https://mistral.ai/news/rss.xml', source: 'Mistral', category: 'ai', cutoffHours: 72 },
  // AI-media
  { url: 'https://venturebeat.com/category/ai/feed/', source: 'VentureBeat AI', category: 'ai' },
  { url: 'https://www.thedecoder.de/feed/', source: 'The Decoder', category: 'ai' },
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'TechCrunch AI', category: 'ai' },
  { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', source: 'The Verge AI', category: 'ai' },
  // Academisch — max 4 per feed zodat ze niet alles verdringen
  { url: 'https://export.arxiv.org/rss/cs.AI', source: 'ArXiv AI', category: 'research', maxItems: 4 },
  { url: 'https://export.arxiv.org/rss/cs.LG', source: 'ArXiv ML', category: 'research', maxItems: 4 },
  // Google News AI (Nederlandstalig)
  { url: 'https://news.google.com/rss/search?q=artificial+intelligence&hl=nl&gl=NL&ceid=NL:nl', source: 'Google News AI', category: 'ai' },
  { url: 'https://news.google.com/rss/search?q=ChatGPT+OR+Claude+OR+Gemini&hl=nl&gl=NL&ceid=NL:nl', source: 'Google News LLM', category: 'ai' },
  // Nederlandse bronnen
  { url: 'https://tweakers.net/feeds/nieuws.xml', source: 'Tweakers', category: 'tech' },
  { url: 'https://www.nu.nl/rss/tech', source: 'NU.nl Tech', category: 'tech' },
  { url: 'https://www.emerce.nl/rss', source: 'Emerce', category: 'tech' },
  { url: 'https://news.google.com/rss/search?q=kunstmatige+intelligentie&hl=nl&gl=NL&ceid=NL:nl', source: 'Google News NL KI', category: 'ai' },
]

type Article = {
  title: string
  url: string
  summary: string
  source: string
  category: string
  published_at: string
  score?: number
}

async function fetchRSS(url: string, source: string, category: string, maxItems = 20, cutoffHours = 24): Promise<Article[]> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(url, { headers: { 'User-Agent': 'NewsDigest/1.0' }, signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return []
    const xml = await res.text()
    const items = xml.match(/<item[\s\S]*?<\/item>/g) ?? xml.match(/<entry[\s\S]*?<\/entry>/g) ?? []
    const cutoff = Date.now() - cutoffHours * 60 * 60 * 1000

    return items.slice(0, maxItems).flatMap((item) => {
      const title = decodeHTML((item.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ?? item.match(/<title[^>]*>([\s\S]*?)<\/title>/))?.[1] ?? '')
      const link = (item.match(/<link[^>]*href="([^"]+)"/) ?? item.match(/<link[^>]*>(https?:\/\/[^<]+)<\/link>/))?.[1]?.trim()
      const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) ?? item.match(/<published>([\s\S]*?)<\/published>/) ?? item.match(/<updated>([\s\S]*?)<\/updated>/))?.[1]?.trim()
      const desc = decodeHTML((item.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ?? item.match(/<description[^>]*>([\s\S]*?)<\/description>/) ?? item.match(/<summary[^>]*>([\s\S]*?)<\/summary>/))?.[1]?.replace(/<[^>]+>/g, '') ?? '').slice(0, 300)

      if (!title || !link) return []
      const pub = pubDate ? new Date(pubDate).getTime() : Date.now()
      if (isNaN(pub) || pub < cutoff) return []

      return [{ title, url: link, summary: desc, source, category, published_at: new Date(pub).toISOString() }]
    })
  } catch {
    return []
  }
}

async function fetchHN(): Promise<Article[]> {
  try {
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
    const ids: number[] = await res.json()
    const items = await Promise.allSettled(
      ids.slice(0, 15).map((id) => fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then((r) => r.json()))
    )
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return items.flatMap((r) => {
      if (r.status !== 'fulfilled') return []
      const { title, url, time, score } = r.value
      if (!title || !url || !time || time * 1000 < cutoff || (score ?? 0) < 50) return []
      return [{ title, url, summary: '', source: 'Hacker News', category: 'tech', published_at: new Date(time * 1000).toISOString() }]
    })
  } catch {
    return []
  }
}

const AI_KEYWORDS = /\b(ai|artificial intelligence|machine learning|deep learning|llm|gpt|claude|gemini|mistral|openai|anthropic|hugging face|neural network|language model|chatbot|generative|diffusion|transformer|reinforcement learning|computer vision|nlp|large model|foundation model|copilot|midjourney|stable diffusion|imagen|dall-e|sora|agents?|rag|embeddings?)\b/i

function isAIRelated(article: Article): boolean {
  const text = `${article.title} ${article.summary}`.toLowerCase()
  return AI_KEYWORDS.test(text) || article.category === 'ai' || article.category === 'research'
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function titleSimilar(a: string, b: string): boolean {
  const wa = new Set(normalizeTitle(a).split(' ').filter(w => w.length > 4))
  const wb = new Set(normalizeTitle(b).split(' ').filter(w => w.length > 4))
  if (wa.size === 0 || wb.size === 0) return false
  let overlap = 0
  for (const w of wa) if (wb.has(w)) overlap++
  return overlap / Math.min(wa.size, wb.size) >= 0.6
}

function deduplicate(articles: Article[]): Article[] {
  const seenUrls = new Set<string>()
  const seenTitles: string[] = []
  return articles.filter((a) => {
    if (seenUrls.has(a.url)) return false
    if (seenTitles.some(t => titleSimilar(t, a.title))) return false
    seenUrls.add(a.url)
    seenTitles.push(a.title)
    return true
  })
}

async function scoreBatch(
  openai: OpenAI,
  articles: Article[],
  profile: string,
  offset: number
): Promise<{ index: number; score: number; title: string; summary: string }[]> {
  const list = articles.map((a, i) => `${offset + i + 1}. ${a.title}${a.summary ? ` | ${a.summary.slice(0, 80)}` : ''}`).join('\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: 'Je bent een nieuwsredacteur. Je antwoordt ALTIJD in het Nederlands. Je antwoordt ALLEEN met geldige JSON, nooit met tekst erbuiten.',
      },
      {
        role: 'user',
        content: `Gebruikersprofiel: "${profile.slice(0, 300)}"

Verwerk elk artikel:
1. Score 1-10 op relevantie voor dit profiel
2. Vertaal de titel naar het Nederlands
3. Schrijf een Nederlandse samenvatting (1 zin, max 120 tekens)

Geef terug als JSON object: {"articles":[{"index":1,"score":7,"title":"Nederlandse titel","summary":"Nederlandse samenvatting"},...]}

Artikelen:
${list}`,
      },
    ],
    temperature: 0,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  try {
    const parsed = JSON.parse(raw)
    const arr = parsed.articles ?? parsed.scores ?? parsed.items ?? parsed
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

async function scoreWithOpenAI(openai: OpenAI, articles: Article[], profile: string): Promise<Article[]> {
  const BATCH_SIZE = 10
  const allScores: { index: number; score: number; title: string; summary: string }[] = []

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE)
    try {
      const batchScores = await scoreBatch(openai, batch, profile, i)
      allScores.push(...batchScores)
    } catch {
      // fallback scores voor deze batch
      batch.forEach((_, j) => allScores.push({ index: i + j + 1, score: 5, title: batch[j].title, summary: batch[j].summary ?? '' }))
    }
  }

  return articles.map((a, i) => {
    const s = allScores.find((x) => x.index === i + 1)
    return {
      ...a,
      score: s?.score ?? 5,
      title: s?.title ?? a.title,
      summary: s?.summary ?? a.summary,
    }
  })
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Fetch all sources in parallel, emit each result as it completes
        const allArticles: Article[] = []

        const rssPromises = RSS_SOURCES.map(({ url, source, category, maxItems, cutoffHours }) =>
          fetchRSS(url, source, category, maxItems, cutoffHours).then((articles) => {
            send({ type: 'source', name: source, count: articles.length })
            allArticles.push(...articles)
          })
        )

        const hnPromise = fetchHN().then((articles) => {
          send({ type: 'source', name: 'Hacker News', count: articles.length })
          allArticles.push(...articles)
        })

        await Promise.all([...rssPromises, hnPromise])

        const deduped = deduplicate(allArticles)

        // Filter out URLs already in the database today
        const today = new Date().toISOString().split('T')[0]
        const { data: existing } = await supabase
          .from('news_items')
          .select('url')
          .gte('created_at', today + 'T00:00:00')
        const existingUrls = new Set((existing ?? []).map((r) => r.url))
        const fresh = deduped.filter((a) => !existingUrls.has(a.url) && isAIRelated(a))

        if (fresh.length === 0) {
          send({ type: 'done', inserted: 0, total: deduped.length, skipped: existingUrls.size })
          return
        }

        send({ type: 'status', message: `${fresh.length} nieuwe artikelen (${existingUrls.size} al opgeslagen), scores berekenen…` })

        // Get profile
        const { data: profileRow } = await supabase.from('user_profile').select('profile').eq('id', 1).single()
        const profile = profileRow?.profile ?? 'Geïnteresseerd in AI, technologie en wetenschappelijk onderzoek.'

        // Score top 30 fresh articles
        const toScore = fresh.slice(0, 30)
        let scored: Article[]
        try {
          scored = await scoreWithOpenAI(openai, toScore, profile)
        } catch (e) {
          send({ type: 'status', message: `Scoring mislukt (${String(e).slice(0, 80)}), opslaan met standaardscore…` })
          scored = toScore.map((a) => ({ ...a, score: 5 }))
        }

        // Store top 30
        const top = (scored as (Article & { score: number })[])
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .slice(0, 30)

        const { error } = await supabase.from('news_items').insert(
          top.map((a) => ({
            title: a.title,
            summary: a.summary || null,
            url: a.url,
            source: a.source,
            category: a.category,
            score: a.score,
            published_at: a.published_at,
          }))
        )

        if (error) {
          send({ type: 'error', message: error.message })
        } else {
          // Cleanup: verwijder nieuws en feedback ouder dan 60 dagen
          const cutoff60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
          await supabase.from('user_feedback').delete().lt('created_at', cutoff60)
          await supabase.from('news_items').delete().lt('created_at', cutoff60)
          send({ type: 'done', inserted: top.length, total: deduped.length })
        }
      } catch (err) {
        const msg = err instanceof Error ? `${err.message} | ${err.cause}` : String(err)
        console.error('[cron/news] fout:', msg)
        send({ type: 'error', message: msg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
