'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, type NewsItem, type FeedbackRating } from '@/lib/supabase'

const CATEGORY_COLORS: Record<string, string> = {
  ai: '#c9963a',
  tech: '#6a8fa0',
  research: '#8a7ab0',
  business: '#7a9a6a',
  default: '#5a5248',
}

function ScoreMeter({ score }: { score: number }) {
  return (
    <span className="score-badge" style={{ color: score >= 8 ? 'var(--gold2)' : 'var(--text3)' }}>
      {score}/10
    </span>
  )
}

const RATING_OPTIONS: { value: FeedbackRating; label: string; color: string; active: string }[] = [
  { value: 3, label: 'Interessant', color: 'var(--text3)', active: 'var(--gold)' },
  { value: 2, label: 'Mwah',        color: 'var(--text3)', active: 'var(--text2)' },
  { value: 1, label: 'Niet interessant', color: 'var(--text3)', active: 'var(--down)' },
]

function CategoryRating({
  current,
  onRate,
}: {
  current: FeedbackRating | undefined
  onRate: (r: FeedbackRating) => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {RATING_OPTIONS.map(({ value, label, color, active }) => (
        <button
          key={value}
          onClick={() => onRate(value)}
          style={{
            background: current === value ? active : 'none',
            border: `1px solid ${current === value ? active : 'var(--border)'}`,
            color: current === value ? (value === 3 ? 'var(--ink)' : '#fff') : color,
            borderRadius: 2,
            padding: '3px 10px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono, monospace)',
            cursor: 'pointer',
            transition: 'all 0.12s ease',
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function ArticleCard({
  item,
  index,
  feedbackMap,
  onFeedback,
}: {
  item: NewsItem
  index: number
  feedbackMap: Record<string, FeedbackRating>
  onFeedback: (id: string, rating: FeedbackRating) => void
}) {
  const [saved, setSaved] = useState(false)
  const current = feedbackMap[item.id]
  const cat = (item.category ?? 'default').toLowerCase()
  const accentColor = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.default
  const date = item.published_at
    ? new Intl.DateTimeFormat('nl-NL', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(item.published_at))
    : null

  const handleRate = (r: FeedbackRating) => {
    onFeedback(item.id, r)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <article
      className="article-card fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Rubriek + meta */}
      <div className="flex items-baseline gap-3 mb-1 flex-wrap">
        <span className="category-tag" style={{ color: accentColor }}>
          {item.category ?? 'algemeen'}
        </span>
        {item.source && (
          <span className="font-mono text-xs" style={{ color: 'var(--text3)', letterSpacing: '0.04em' }}>
            {item.source}
          </span>
        )}
        {date && (
          <span className="font-mono text-xs" style={{ color: 'var(--text3)' }}>
            {date}
          </span>
        )}
        {item.score != null && <ScoreMeter score={item.score} />}
      </div>

      {/* Kop */}
      {item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-display block leading-tight mb-2 hover:underline"
          style={{ color: 'var(--ink)', fontWeight: 700, fontSize: '1.2rem', textDecorationColor: 'var(--border-dark)' }}
        >
          {item.title}
        </a>
      ) : (
        <h2
          className="font-display leading-tight mb-2"
          style={{ color: 'var(--ink)', fontWeight: 700, fontSize: '1.2rem' }}
        >
          {item.title}
        </h2>
      )}

      {/* Samenvatting */}
      {item.summary && (
        <p className="font-serif text-sm leading-relaxed mb-3" style={{ color: 'var(--text2)' }}>
          {item.summary}
        </p>
      )}

      {/* Rating */}
      <div className="flex items-center gap-3 relative flex-wrap">
        <CategoryRating current={current} onRate={handleRate} />
        {saved && (
          <span
            className="font-mono text-xs pointer-events-none"
            style={{ color: 'var(--gold)', animation: 'saved-flash 1.8s ease forwards' }}
          >
            opgeslagen ✓
          </span>
        )}
      </div>
    </article>
  )
}

function Header({
  total,
  onFetch,
  fetching,
}: {
  total: number
  onFetch: () => void
  fetching: boolean
}) {
  const today = new Intl.DateTimeFormat('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  return (
    <header className="pt-8 pb-0">
      <div style={{ borderTop: '4px solid var(--ink)' }} />
      <div style={{ borderTop: '1px solid var(--ink)', marginTop: '3px' }} />

      <div className="flex items-center justify-between py-1 px-0" style={{ borderBottom: '1px solid var(--border-dark)' }}>
        <p className="font-mono" style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {today}
        </p>
        <div className="flex items-center gap-3">
          <button
            className="feedback-btn"
            onClick={onFetch}
            disabled={fetching}
            style={fetching ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          >
            {fetching ? <span style={{ animation: 'pulse-gold 1s ease infinite' }}>ophalen…</span> : '↻ ophalen'}
          </button>
          <a href="/opgeslagen" className="feedback-btn" style={{ textDecoration: 'none' }}>★ interessant</a>
          <a href="/voorkeuren" className="feedback-btn" style={{ textDecoration: 'none' }}>~ voorkeuren</a>
        </div>
      </div>

      <div className="py-5 text-center">
        <h1 className="font-display" style={{ fontSize: 'clamp(2.4rem, 8vw, 4.5rem)', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1, color: 'var(--ink)' }}>
          Edwin&apos;s Feed
        </h1>
        <p className="font-serif mt-1" style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--text2)', letterSpacing: '0.02em' }}>
          Edwin&apos;s gepersonaliseerde AI-nieuwsfeed
        </p>
      </div>

      <div className="flex items-center justify-between py-1" style={{ borderTop: '1px solid var(--ink)', borderBottom: '3px double var(--ink)' }}>
        <p className="font-mono" style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Editie vandaag
        </p>
        <p className="font-mono" style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {total} artikel{total !== 1 ? 'en' : ''}
        </p>
      </div>
    </header>
  )
}

export default function HomePage() {
  const [articles, setArticles] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [fetchLines, setFetchLines] = useState<string[]>([])
  const [feedbackMap, setFeedbackMap] = useState<Record<string, FeedbackRating>>({})
  const [feedbackCount, setFeedbackCount] = useState(0)

  const CACHE_KEY = `articles_${new Date().toISOString().split('T')[0]}`

  const loadArticles = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('news_items')
      .select('*')
      .gte('created_at', today + 'T00:00:00')
      .order('score', { ascending: false })
      .limit(20)
    const items = data ?? []
    setArticles(items)
    if (items.length > 0) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(items)) } catch { /* quota */ }
    }
  }, [CACHE_KEY])

  useEffect(() => {
    async function init() {
      // Gebruik cache als die er is, anders Supabase
      try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          setArticles(JSON.parse(cached) as NewsItem[])
        } else {
          await loadArticles()
        }
      } catch {
        await loadArticles()
      }
      const { data } = await supabase.from('user_feedback').select('news_item_id, rating')
      if (data) {
        const map: Record<string, FeedbackRating> = {}
        for (const row of data) map[row.news_item_id] = row.rating as FeedbackRating
        setFeedbackMap(map)
        setFeedbackCount(data.length)
      }
      setLoading(false)
    }
    init()
  }, [loadArticles, CACHE_KEY])

  const unrated = articles.filter((a) => !feedbackMap[a.id])

  const handleFetch = useCallback(async () => {
    setFetching(true)
    setFetchLines([])
    try {
      const res = await fetch('/api/cron/news', {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? 'change-me-before-deploying'}` },
      })
      if (!res.body) throw new Error('Geen stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.replace(/^data: /, '').trim()
          if (!line) continue
          try {
            const evt = JSON.parse(line)
            if (evt.type === 'source') {
              setFetchLines((prev) => [...prev, `${evt.count > 0 ? '✓' : '·'} ${evt.name}${evt.count > 0 ? ` — ${evt.count}` : ' — geen'}`])
            } else if (evt.type === 'status') {
              setFetchLines((prev) => [...prev, `→ ${evt.message}`])
            } else if (evt.type === 'done') {
              setFetchLines((prev) => [...prev, `✓ ${evt.inserted} artikelen opgeslagen (${evt.total} totaal)`])
              await loadArticles()
            } else if (evt.type === 'error') {
              setFetchLines((prev) => [...prev, `✗ ${evt.message}`])
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setFetchLines(['✗ Netwerkfout: ' + String(e)])
    } finally {
      setFetching(false)
    }
  }, [loadArticles])

  const handleFeedback = useCallback(
    async (newsItemId: string, rating: FeedbackRating) => {
      setFeedbackMap((prev) => ({ ...prev, [newsItemId]: rating }))
      const newCount = feedbackCount + 1
      setFeedbackCount(newCount)

      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ news_item_id: newsItemId, rating }),
      })

      if (newCount % 10 === 0) {
        fetch('/api/profile-update', { method: 'POST' }).catch(() => null)
      }
    },
    [feedbackCount]
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-20">
        <Header total={unrated.length} onFetch={handleFetch} fetching={fetching} />

        {fetchLines.length > 0 && (
          <div className="mb-6 p-4 fade-up" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 2 }}>
            {fetchLines.map((line, i) => (
              <p key={i} className="font-mono text-xs leading-relaxed" style={{
                color: line.startsWith('✓') ? 'var(--gold)' : line.startsWith('✗') ? 'var(--down)' : 'var(--text3)',
              }}>
                {line}
              </p>
            ))}
            {fetching && <p className="font-mono text-xs mt-1" style={{ color: 'var(--text3)', animation: 'pulse-gold 1s ease infinite' }}>…</p>}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center">
            <p className="font-mono text-xs tracking-widest" style={{ color: 'var(--text3)', animation: 'pulse-gold 1.5s ease infinite' }}>laden...</p>
          </div>
        ) : unrated.length === 0 && articles.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-display text-xl italic mb-2" style={{ color: 'var(--text2)' }}>Nog geen artikelen vandaag.</p>
            <p className="font-mono text-xs" style={{ color: 'var(--text3)' }}>Klik op ↻ ophalen om te beginnen.</p>
          </div>
        ) : unrated.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-display text-xl italic mb-3" style={{ color: 'var(--text2)' }}>Alles beoordeeld voor vandaag.</p>
            <a href="/opgeslagen" className="font-mono text-xs" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>
              Bekijk je interessante artikelen →
            </a>
          </div>
        ) : (
          <div>
            {unrated.map((item, i) => (
              <ArticleCard
                key={item.id}
                item={item}
                index={i}
                feedbackMap={feedbackMap}
                onFeedback={handleFeedback}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
