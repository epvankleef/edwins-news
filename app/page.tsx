'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, type NewsItem, type FeedbackRating } from '@/lib/supabase'

const CAT_CLASS: Record<string, string> = {
  ai:       'cat-ai',
  research: 'cat-research',
  tech:     'cat-tech',
  business: 'cat-business',
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 8 ? 'var(--green)' : score >= 6 ? 'var(--accent2)' : 'var(--text3)'
  return (
    <span style={{
      fontSize: '11px',
      fontWeight: 600,
      color,
      background: 'transparent',
      fontFamily: 'var(--font-body)',
      letterSpacing: '0.02em',
    }}>
      {score.toFixed(0)}
    </span>
  )
}

const RATINGS: { value: FeedbackRating; label: string; activeColor: string }[] = [
  { value: 3, label: 'Interessant', activeColor: 'var(--green)' },
  { value: 2, label: 'Mwah',        activeColor: 'var(--text2)' },
  { value: 1, label: 'Niet voor mij', activeColor: 'var(--red)' },
]

function ArticleCard({
  item, index, feedbackMap, onFeedback,
}: {
  item: NewsItem
  index: number
  feedbackMap: Record<string, FeedbackRating>
  onFeedback: (id: string, r: FeedbackRating) => void
}) {
  const [saved, setSaved] = useState(false)
  const current = feedbackMap[item.id]
  const catKey = (item.category ?? 'default').toLowerCase()
  const catClass = CAT_CLASS[catKey] ?? 'cat-default'
  const timeAgo = item.published_at
    ? new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' }).format(new Date(item.published_at))
    : null

  const handleRate = (r: FeedbackRating) => {
    onFeedback(item.id, r)
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  return (
    <article
      className="fade-up"
      style={{
        animationDelay: `${index * 50}ms`,
        borderBottom: '1px solid var(--border)',
        padding: '20px 0',
      }}
    >
      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={catClass} style={{
            fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px',
          }}>
            {item.category ?? 'algemeen'}
          </span>
          {item.source && (
            <span style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: 400 }}>
              {item.source}
            </span>
          )}
          {timeAgo && (
            <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{timeAgo}</span>
          )}
        </div>
        {item.score != null && <ScorePill score={item.score} />}
      </div>

      {/* Title */}
      {item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-display"
          style={{
            display: 'block',
            fontSize: '1.05rem',
            fontWeight: 700,
            lineHeight: 1.35,
            color: 'var(--text)',
            textDecoration: 'none',
            marginBottom: '8px',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent2)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}
        >
          {item.title}
        </a>
      ) : (
        <h2 className="font-display" style={{
          fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.35,
          color: 'var(--text)', marginBottom: '8px',
        }}>
          {item.title}
        </h2>
      )}

      {/* Summary */}
      {item.summary && (
        <p style={{
          fontSize: '13.5px', color: 'var(--text2)', lineHeight: 1.65,
          marginBottom: '14px', fontWeight: 300,
        }}>
          {item.summary}
        </p>
      )}

      {/* Feedback */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
        {RATINGS.map(({ value, label, activeColor }) => {
          const active = current === value
          return (
            <button
              key={value}
              onClick={() => handleRate(value)}
              style={{
                fontSize: '11px',
                fontWeight: 500,
                padding: '4px 10px',
                borderRadius: '6px',
                border: `1px solid ${active ? activeColor : 'var(--border2)'}`,
                background: active ? `${activeColor}18` : 'transparent',
                color: active ? activeColor : 'var(--text3)',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text3)' }}}
            >
              {label}
            </button>
          )
        })}
        {saved && (
          <span style={{
            fontSize: '11px', color: 'var(--green)', marginLeft: '4px',
            animation: 'saved-flash 1.6s ease forwards',
            pointerEvents: 'none', position: 'absolute', right: 0,
          }}>
            opgeslagen
          </span>
        )}
      </div>
    </article>
  )
}

function NavBtn({
  onClick, disabled, children, variant = 'default',
}: {
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
  variant?: 'default' | 'ghost'
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: '12px',
        fontWeight: 500,
        padding: '6px 14px',
        borderRadius: '8px',
        border: variant === 'ghost' ? '1px solid var(--border2)' : '1px solid var(--accent)',
        background: variant === 'ghost' ? 'transparent' : 'var(--accent)',
        color: variant === 'ghost' ? 'var(--text2)' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'all 0.15s ease',
        fontFamily: 'var(--font-body)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

export default function HomePage() {
  const [articles, setArticles]       = useState<NewsItem[]>([])
  const [loading, setLoading]         = useState(true)
  const [fetching, setFetching]       = useState(false)
  const [resetting, setResetting]     = useState(false)
  const [fetchLines, setFetchLines]   = useState<string[]>([])
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
      .limit(10)
    const items = data ?? []
    setArticles(items)
    if (items.length > 0) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(items)) } catch { /* quota */ }
    }
  }, [CACHE_KEY])

  useEffect(() => {
    async function init() {
      try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) setArticles(JSON.parse(cached) as NewsItem[])
        else await loadArticles()
      } catch { await loadArticles() }
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

  const unrated = articles.filter(a => !feedbackMap[a.id])

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
            if (evt.type === 'source')
              setFetchLines(p => [...p, `${evt.count > 0 ? '✓' : '·'} ${evt.name}${evt.count > 0 ? ` — ${evt.count}` : ''}`])
            else if (evt.type === 'status')
              setFetchLines(p => [...p, evt.message])
            else if (evt.type === 'done') {
              setFetchLines(p => [...p, `${evt.inserted} artikelen opgehaald`])
              await loadArticles()
            } else if (evt.type === 'error')
              setFetchLines(p => [...p, `Fout: ${evt.message}`])
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setFetchLines(['Netwerkfout: ' + String(e)])
    } finally {
      setFetching(false)
    }
  }, [loadArticles])

  const handleReset = useCallback(async () => {
    if (!confirm('Alle artikelen van vandaag wissen?')) return
    setResetting(true)
    setFetchLines([])
    try {
      const res = await fetch('/api/cron/reset-today', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? 'change-me-before-deploying'}` },
      })
      const json = await res.json()
      if (res.ok) {
        setFetchLines([`${json.deleted} artikelen gewist`])
        setArticles([])
        try { localStorage.removeItem(CACHE_KEY) } catch { /* quota */ }
      } else {
        setFetchLines([`Fout: ${json.error}`])
      }
    } catch (e) {
      setFetchLines(['Netwerkfout: ' + String(e)])
    } finally {
      setResetting(false)
    }
  }, [CACHE_KEY])

  const handleFeedback = useCallback(async (newsItemId: string, rating: FeedbackRating) => {
    setFeedbackMap(prev => ({ ...prev, [newsItemId]: rating }))
    const newCount = feedbackCount + 1
    setFeedbackCount(newCount)
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ news_item_id: newsItemId, rating }),
    })
    if (newCount % 10 === 0) fetch('/api/profile-update', { method: 'POST' }).catch(() => null)
  }, [feedbackCount])

  const today = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 20px 80px' }}>

        {/* Header */}
        <header style={{ padding: '24px 0 0', marginBottom: '8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingBottom: '16px', borderBottom: '1px solid var(--border)',
          }}>
            <div>
              <h1 className="font-display" style={{
                fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)',
                letterSpacing: '-0.02em', lineHeight: 1,
              }}>
                Edwin&apos;s Feed
              </h1>
              <p style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '3px', fontWeight: 400 }}>
                {today}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <NavBtn onClick={handleReset} disabled={resetting || fetching} variant="ghost">
                {resetting ? 'wissen…' : 'wis'}
              </NavBtn>
              <NavBtn onClick={handleFetch} disabled={fetching || resetting}>
                {fetching ? <span style={{ animation: 'pulse-accent 1s ease infinite', display: 'inline-block' }}>ophalen…</span> : '↻ ophalen'}
              </NavBtn>
              <a href="/opgeslagen" style={{
                fontSize: '12px', fontWeight: 500, padding: '6px 14px',
                borderRadius: '8px', border: '1px solid var(--border2)',
                color: 'var(--text2)', textDecoration: 'none',
                transition: 'all 0.15s ease', whiteSpace: 'nowrap',
              }}>
                opgeslagen
              </a>
            </div>
          </div>
        </header>

        {/* Fetch log */}
        {fetchLines.length > 0 && (
          <div className="fade-up" style={{
            margin: '16px 0', padding: '14px 16px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '10px',
          }}>
            {fetchLines.map((line, i) => (
              <p key={i} style={{
                fontSize: '12px', lineHeight: 1.7, fontFamily: 'var(--font-body)',
                color: line.includes('Fout') ? 'var(--red)' : line.startsWith('✓') ? 'var(--green)' : 'var(--text3)',
              }}>
                {line}
              </p>
            ))}
            {fetching && <p style={{ fontSize: '12px', color: 'var(--text3)', animation: 'pulse-accent 1s ease infinite' }}>…</p>}
          </div>
        )}

        {/* Articles */}
        {loading ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: 'var(--text3)', animation: 'pulse-accent 1.5s ease infinite' }}>laden…</p>
          </div>
        ) : unrated.length === 0 && articles.length === 0 ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <p className="font-display" style={{ fontSize: '1.1rem', color: 'var(--text2)', marginBottom: '8px' }}>
              Nog geen artikelen vandaag.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text3)' }}>Klik op ↻ ophalen om te beginnen.</p>
          </div>
        ) : unrated.length === 0 ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <p className="font-display" style={{ fontSize: '1.1rem', color: 'var(--text2)', marginBottom: '10px' }}>
              Alles gelezen voor vandaag.
            </p>
            <a href="/opgeslagen" style={{ fontSize: '13px', color: 'var(--accent2)', textDecoration: 'underline' }}>
              Bekijk opgeslagen artikelen →
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
