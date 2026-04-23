'use client'

import { useEffect, useState } from 'react'
import { getSupabase, type NewsItem } from '@/lib/supabase'
import NavMenu from '@/components/NavMenu'

type Tab = 'alles' | 'interessant' | 'mwah' | 'nope'

const RATING_LABEL: Record<number, string> = { 3: 'interessant', 2: 'mwah', 1: 'nope' }
const RATING_EMOJI: Record<number, string> = { 3: '👍', 2: '🫤', 1: '👎' }

function scoreColor(s: number) {
  if (s >= 9) return 'oklch(0.58 0.14 145)'
  if (s >= 8) return 'oklch(0.62 0.12 145)'
  if (s >= 7) return 'oklch(0.68 0.11 75)'
  if (s >= 6) return 'oklch(0.65 0.11 45)'
  return 'oklch(0.55 0.08 25)'
}

function srcColor(src: string) {
  let h = 0
  for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) % 360
  return `oklch(0.72 0.12 ${h})`
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export default function OpgeslagenPage() {
  const [items, setItems] = useState<{ article: NewsItem; rating: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('interessant')

  useEffect(() => {
    async function load() {
      const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: feedback } = await getSupabase()
        .from('user_feedback')
        .select('news_item_id, rating')
        .gte('created_at', since30)

      if (!feedback?.length) { setLoading(false); return }

      const ids = feedback.map(f => f.news_item_id)
      const ratingMap: Record<string, number> = {}
      for (const f of feedback) ratingMap[f.news_item_id] = f.rating

      const { data: articles } = await getSupabase()
        .from('news_items')
        .select('*')
        .in('id', ids)
        .order('created_at', { ascending: false })

      setItems((articles ?? []).map(a => ({ article: a as NewsItem, rating: ratingMap[a.id] ?? 2 })))
      setLoading(false)
    }
    load()
  }, [])

  const filtered = tab === 'alles' ? items
    : tab === 'interessant' ? items.filter(i => i.rating === 3)
    : tab === 'mwah'        ? items.filter(i => i.rating === 2)
    :                         items.filter(i => i.rating === 1)

  const counts = {
    alles:       items.length,
    interessant: items.filter(i => i.rating === 3).length,
    mwah:        items.filter(i => i.rating === 2).length,
    nope:        items.filter(i => i.rating === 1).length,
  }

  const TABS: { key: Tab; emoji: string; label: string }[] = [
    { key: 'interessant', emoji: '👍', label: 'Interessant' },
    { key: 'mwah',        emoji: '🫤', label: 'Mwah' },
    { key: 'nope',        emoji: '👎', label: 'Niet voor mij' },
    { key: 'alles',       emoji: '',   label: 'Alles' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 28px 80px', position: 'relative', zIndex: 1 }}>

        <header style={{ borderBottom: '1px solid var(--rule)', paddingBottom: 18, marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10, fontFamily: 'var(--title)', fontSize: 32, letterSpacing: '-0.015em', lineHeight: 1.1, color: 'var(--ink)' }}>
              <span style={{ color: 'var(--accent)', fontSize: 20 }}>◆</span>
              opgeslagen
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <nav className="masthead__nav desktop-nav">
                <a href="/" className="masthead__nav-link">feed</a>
                <a href="/opgeslagen" className="masthead__nav-link masthead__nav-link--active">opgeslagen</a>
                <a href="/voorkeuren" className="masthead__nav-link">voorkeuren</a>
                <a href="/bronnen" className="masthead__nav-link">bronnen</a>
              </nav>
              <NavMenu current="/opgeslagen" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
            {TABS.map(({ key, emoji, label }) => (
              <button
                key={key}
                className={`chip ${tab === key ? 'chip--on' : ''}`}
                onClick={() => setTab(key)}
              >
                {emoji && <span style={{ marginRight: 4 }}>{emoji}</span>}
                {label}
                <span style={{ opacity: 0.55, marginLeft: 5 }}>({counts[key]})</span>
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-soft)', letterSpacing: '0.1em' }}>
            laden…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink-dim)', fontStyle: 'italic' }}>
              {items.length === 0 ? 'Nog niets beoordeeld.' : 'Geen artikelen in dit filter.'}
            </p>
            {items.length === 0 && (
              <a href="/" style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', marginTop: 12, display: 'inline-block' }}>
                ← ga naar de feed
              </a>
            )}
          </div>
        ) : (
          <div style={{ fontFamily: 'var(--mono)', border: '1px solid var(--rule)', borderRadius: 16, background: 'var(--surface)', backdropFilter: 'blur(10px)', overflow: 'hidden', boxShadow: 'var(--inner-hi),var(--shadow)' }}>
            <div className="saved-header">
              <span className="saved-col-rx">Reactie</span>
              <span className="saved-col-score">Score</span>
              <span className="saved-col-src">Bron</span>
              <span className="saved-col-title">Titel</span>
              <span className="saved-col-date">Datum</span>
            </div>

            {filtered.map(({ article: a, rating }) => (
              <a key={a.id} href={a.url ?? '#'} target="_blank" rel="noreferrer" className="saved-row">
                <span className="saved-col-rx">
                  <span>{RATING_EMOJI[rating]}</span>
                  <span className="saved-rx-label">{RATING_LABEL[rating]}</span>
                </span>
                <span className="saved-col-score" style={{ color: scoreColor(a.score ?? 5) }}>
                  {a.score ?? '—'}<span className="saved-score-denom">/10</span>
                </span>
                <span className="saved-col-src">
                  <span className="saved-src-dot" style={{ background: srcColor(a.source ?? '') }} />
                  <span className="saved-src-name">{a.source}</span>
                </span>
                <span className="saved-col-title">{a.title}</span>
                <span className="saved-col-date">{a.published_at ? formatDate(a.published_at) : ''}</span>
              </a>
            ))}

            <div style={{ padding: '20px 22px', fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-soft)', textAlign: 'center', borderTop: '1px solid var(--rule)', fontWeight: 500 }}>
              <span style={{ display: 'inline-block', width: 32, height: 1, background: 'var(--rule-strong)', verticalAlign: 'middle', margin: '0 10px' }} />
              {filtered.length} artikel{filtered.length !== 1 ? 'en' : ''} · laatste 30 dagen
              <span style={{ display: 'inline-block', width: 32, height: 1, background: 'var(--rule-strong)', verticalAlign: 'middle', margin: '0 10px' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
