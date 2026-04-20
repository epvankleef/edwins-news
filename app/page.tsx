'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase, type NewsItem, type FeedbackRating } from '@/lib/supabase'

const PILL: Record<string, string> = {
  ai: 'pill pill-ai', research: 'pill pill-research',
  tech: 'pill pill-tech', business: 'pill pill-business',
}
const pill = (cat: string) => PILL[(cat ?? '').toLowerCase()] ?? 'pill pill-default'

const SCORE_COLOR = (s: number) =>
  s >= 8 ? 'var(--green)' : s >= 6 ? 'var(--accent2)' : 'var(--text3)'

type Tab = 'feed' | 'opgeslagen' | 'voorkeuren'
type Filter = 'alles' | 'ai' | 'research' | 'tech'

function timeStr(iso: string) {
  return new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

// ── Article Row ──────────────────────────────────────────────────────────────
function ArticleRow({
  item, index, rating, onFeedback,
}: {
  item: NewsItem
  index: number
  rating: FeedbackRating | undefined
  onFeedback: (id: string, r: FeedbackRating) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div
        className="article-row slide-in"
        style={{ animationDelay: `${index * 30}ms` }}
        onClick={() => setOpen(o => !o)}
      >
        {/* Score */}
        <div style={{ paddingTop: '1px', textAlign: 'right' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: item.score != null ? SCORE_COLOR(item.score) : 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
            {item.score != null ? item.score.toFixed(0) : '—'}
          </span>
        </div>

        {/* Main */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
            <span className={pill(item.category ?? '')}>{item.category ?? 'algemeen'}</span>
            <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 400 }}>{item.source}</span>
            {item.published_at && (
              <span style={{ fontSize: '11px', color: 'var(--text3)' }}>{timeStr(item.published_at)}</span>
            )}
          </div>
          <p className="font-display" style={{
            fontSize: '13.5px', fontWeight: 600, color: 'var(--text)',
            lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: open ? 'unset' : 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ color: 'inherit', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent2)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'inherit')}
              >{item.title}</a>
            ) : item.title}
          </p>
          {open && item.summary && (
            <p style={{ fontSize: '12.5px', color: 'var(--text2)', lineHeight: 1.6, marginTop: '6px', fontWeight: 300 }}>
              {item.summary}
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', paddingTop: '2px', flexShrink: 0 }}>
          <button
            className={`action-btn${rating === 3 ? ' active-interessant' : ''}`}
            onClick={e => { e.stopPropagation(); onFeedback(item.id, 3) }}
          >interessant</button>
          <button
            className={`action-btn${rating === 2 ? ' active-mwah' : ''}`}
            onClick={e => { e.stopPropagation(); onFeedback(item.id, 2) }}
          >mwah</button>
          <button
            className={`action-btn${rating === 1 ? ' active-niet' : ''}`}
            onClick={e => { e.stopPropagation(); onFeedback(item.id, 1) }}
          >niet</button>
        </div>
      </div>
    </>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [articles, setArticles]     = useState<NewsItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [fetching, setFetching]     = useState(false)
  const [resetting, setResetting]   = useState(false)
  const [fetchStatus, setFetchStatus] = useState('')
  const [feedbackMap, setFeedbackMap] = useState<Record<string, FeedbackRating>>({})
  const [feedbackCount, setFeedbackCount] = useState(0)
  const [activeTab, setActiveTab]   = useState<Tab>('feed')
  const [filter, setFilter]         = useState<Filter>('alles')
  const [theme, setTheme]           = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null
    if (saved) setTheme(saved)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const CACHE_KEY = `articles_${new Date().toISOString().split('T')[0]}`

  const loadArticles = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('news_items').select('*')
      .gte('created_at', today + 'T00:00:00')
      .order('score', { ascending: false }).limit(10)
    const items = data ?? []
    setArticles(items)
    if (items.length > 0) try { localStorage.setItem(CACHE_KEY, JSON.stringify(items)) } catch { /**/ }
  }, [CACHE_KEY])

  useEffect(() => {
    async function init() {
      try {
        const c = localStorage.getItem(CACHE_KEY)
        if (c) setArticles(JSON.parse(c) as NewsItem[])
        else await loadArticles()
      } catch { await loadArticles() }
      const { data } = await supabase.from('user_feedback').select('news_item_id, rating')
      if (data) {
        const map: Record<string, FeedbackRating> = {}
        for (const r of data) map[r.news_item_id] = r.rating as FeedbackRating
        setFeedbackMap(map)
        setFeedbackCount(data.length)
      }
      setLoading(false)
    }
    init()
  }, [loadArticles, CACHE_KEY])

  const visible = useMemo(() =>
    filter === 'alles' ? articles : articles.filter(a => (a.category ?? '').toLowerCase() === filter),
    [articles, filter]
  )
  const unrated = visible.filter(a => !feedbackMap[a.id])

  const handleFetch = useCallback(async () => {
    setFetching(true); setFetchStatus('ophalen…')
    try {
      const res = await fetch('/api/cron/news', {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? 'change-me-before-deploying'}` },
      })
      if (!res.body) throw new Error('Geen stream')
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split('\n\n'); buf = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.replace(/^data: /, '').trim(); if (!line) continue
          try {
            const e = JSON.parse(line)
            if (e.type === 'status') setFetchStatus(e.message)
            else if (e.type === 'done') { setFetchStatus(`${e.inserted} artikelen opgehaald`); await loadArticles() }
            else if (e.type === 'error') setFetchStatus('Fout: ' + e.message)
          } catch { /**/ }
        }
      }
    } catch (e) { setFetchStatus('Fout: ' + String(e)) }
    finally { setFetching(false) }
  }, [loadArticles])

  const handleReset = useCallback(async () => {
    if (!confirm('Alle artikelen van vandaag wissen?')) return
    setResetting(true)
    try {
      const res = await fetch('/api/cron/reset-today', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? 'change-me-before-deploying'}` },
      })
      const j = await res.json()
      setFetchStatus(res.ok ? `${j.deleted} artikelen gewist` : 'Fout: ' + j.error)
      if (res.ok) { setArticles([]); try { localStorage.removeItem(CACHE_KEY) } catch { /**/ } }
    } catch (e) { setFetchStatus('Fout: ' + String(e)) }
    finally { setResetting(false) }
  }, [CACHE_KEY])

  const handleFeedback = useCallback(async (newsItemId: string, rating: FeedbackRating) => {
    setFeedbackMap(p => ({ ...p, [newsItemId]: rating }))
    const n = feedbackCount + 1; setFeedbackCount(n)
    await fetch('/api/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ news_item_id: newsItemId, rating }),
    })
    if (n % 10 === 0) fetch('/api/profile-update', { method: 'POST' }).catch(() => null)
  }, [feedbackCount])

  const today = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  const cats = useMemo(() => {
    const c = new Set(articles.map(a => (a.category ?? '').toLowerCase()).filter(Boolean))
    return ['alles', ...Array.from(c)] as (Filter | string)[]
  }, [articles])

  const ratedCount   = articles.filter(a => feedbackMap[a.id]).length
  const unratedCount = articles.filter(a => !feedbackMap[a.id]).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '44px' }}>
          <span className="font-display" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            edwin&apos;s feed
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text3)' }}>{today}</span>
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Lichte modus' : 'Donkere modus'}
              style={{
                width: '28px', height: '16px', borderRadius: '8px', border: 'none',
                background: theme === 'dark' ? 'var(--border2)' : 'var(--accent)',
                cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: '2px',
                left: theme === 'dark' ? '2px' : '14px',
                width: '12px', height: '12px', borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
                display: 'block',
              }} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              onClick={handleReset} disabled={resetting || fetching}
              className="action-btn"
              style={{ opacity: (resetting || fetching) ? 0.4 : 1 }}
            >{resetting ? 'wissen…' : 'wis'}</button>
            <button
              onClick={handleFetch} disabled={fetching || resetting}
              style={{
                padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                background: 'var(--accent)', border: 'none', color: '#fff',
                cursor: (fetching || resetting) ? 'not-allowed' : 'pointer',
                opacity: (fetching || resetting) ? 0.5 : 1,
                fontFamily: 'var(--font-body)', transition: 'opacity 0.15s',
              }}
            >{fetching ? <span style={{ animation: 'pulse-dim 1s ease infinite', display: 'inline-block' }}>ophalen…</span> : '↻ ophalen'}</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', gap: '0', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex' }}>
            {(['feed', 'opgeslagen', 'voorkeuren'] as Tab[]).map(t => (
              t === 'feed'
                ? <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>Feed</button>
                : <a key={t} href={`/${t}`} className="tab" style={{ textDecoration: 'none' }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </a>
            ))}
          </div>
          {fetchStatus && (
            <span style={{ fontSize: '11px', color: fetching ? 'var(--accent2)' : 'var(--text3)', animation: fetching ? 'pulse-dim 1s ease infinite' : 'none' }}>
              {fetchStatus}
            </span>
          )}
          <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text3)' }}>
            <span><b style={{ color: 'var(--text2)' }}>{articles.length}</b> artikelen</span>
            <span><b style={{ color: 'var(--green)' }}>{ratedCount}</b> beoordeeld</span>
            <span><b style={{ color: 'var(--text2)' }}>{unratedCount}</b> open</span>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      {articles.length > 0 && (
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '8px 20px' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {cats.map(c => (
              <button
                key={c}
                className={`filter-chip ${filter === c ? 'active' : ''}`}
                onClick={() => setFilter(c as Filter)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, maxWidth: '900px', margin: '0 auto', width: '100%' }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: 'var(--text3)', animation: 'pulse-dim 1.4s ease infinite' }}>laden…</p>
          </div>
        ) : unrated.length === 0 && articles.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <p className="font-display" style={{ fontSize: '1rem', color: 'var(--text2)', marginBottom: '8px' }}>Nog geen artikelen vandaag.</p>
            <p style={{ fontSize: '12px', color: 'var(--text3)' }}>Klik op ↻ ophalen om te beginnen.</p>
          </div>
        ) : unrated.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <p className="font-display" style={{ fontSize: '1rem', color: 'var(--text2)', marginBottom: '10px' }}>Alles beoordeeld voor vandaag.</p>
            <a href="/opgeslagen" style={{ fontSize: '12px', color: 'var(--accent2)', textDecoration: 'underline' }}>
              Bekijk opgeslagen artikelen →
            </a>
          </div>
        ) : (
          <div>
            {unrated.map((item, i) => (
              <ArticleRow
                key={item.id} item={item} index={i}
                rating={feedbackMap[item.id]}
                onFeedback={handleFeedback}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
