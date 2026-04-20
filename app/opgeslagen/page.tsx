'use client'

import { useEffect, useState } from 'react'
import { getSupabase, type NewsItem } from '@/lib/supabase'

type FilterTab = 'alles' | 'interessant' | 'mwah' | 'nope'

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
  const [filter, setFilter] = useState<FilterTab>('alles')

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

  const filtered = items.filter(({ rating }) => {
    if (filter === 'interessant') return rating === 3
    if (filter === 'mwah') return rating === 2
    if (filter === 'nope') return rating === 1
    return true
  })

  const counts = {
    alles: items.length,
    interessant: items.filter(i => i.rating === 3).length,
    mwah: items.filter(i => i.rating === 2).length,
    nope: items.filter(i => i.rating === 1).length,
  }

  const tabs: { key: FilterTab; label: string; emoji: string }[] = [
    { key: 'alles',        label: `Alles`,        emoji: '' },
    { key: 'interessant',  label: `Interessant`,  emoji: '👍' },
    { key: 'mwah',         label: `Mwah`,         emoji: '🫤' },
    { key: 'nope',         label: `Niet voor mij`, emoji: '👎' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 28px 80px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <header style={{ borderBottom: '1px solid var(--rule)', paddingBottom: 18, marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10, fontFamily: 'var(--title)', fontSize: 32, letterSpacing: '-0.015em', lineHeight: 1.1, color: 'var(--ink)' }}>
              <span style={{ color: 'var(--accent)', fontSize: 20 }}>◆</span>
              opgeslagen
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-soft)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <a href="/" style={{ color: 'var(--ink-dim)', textDecoration: 'none' }}>← feed</a>
              <span>·</span>
              <a href="/voorkeuren" style={{ color: 'var(--ink-dim)', textDecoration: 'none' }}>voorkeuren</a>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16 }}>
            {tabs.map(({ key, label, emoji }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: '5px 11px', borderRadius: 999,
                  border: `1px solid ${filter === key ? 'var(--ink)' : 'var(--rule-strong)'}`,
                  background: filter === key ? 'var(--ink)' : 'transparent',
                  color: filter === key ? 'var(--bg)' : 'var(--ink-dim)',
                  fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 500,
                  cursor: 'pointer', letterSpacing: '0.02em',
                }}
              >
                {emoji && <span style={{ marginRight: 5 }}>{emoji}</span>}
                {label} <span style={{ opacity: 0.6 }}>({counts[key]})</span>
              </button>
            ))}
          </div>
        </header>

        {/* Content */}
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
            {/* Col headers */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 22px 10px', fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-soft)', textTransform: 'uppercase', fontWeight: 600, borderBottom: '1px solid var(--rule)' }}>
              <span style={{ width: 70 }}>Reactie</span>
              <span style={{ width: 60 }}>Score</span>
              <span style={{ width: 160 }}>Bron</span>
              <span style={{ flex: 1 }}>Titel</span>
              <span style={{ width: 120, textAlign: 'right' }}>Datum</span>
            </div>

            {filtered.map(({ article: a, rating }) => (
              <a
                key={a.id}
                href={a.url ?? '#'}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '13px 22px', borderTop: '1px solid var(--rule)',
                  cursor: 'pointer', transition: 'background 140ms',
                  fontSize: 13, color: 'var(--ink-dim)',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ width: 70, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span>{RATING_EMOJI[rating]}</span>
                    <span style={{ fontSize: 10, letterSpacing: '0.04em' }}>{RATING_LABEL[rating]}</span>
                  </span>
                  <span style={{ width: 60, fontWeight: 700, color: scoreColor(a.score ?? 5), fontVariantNumeric: 'tabular-nums' }}>
                    {a.score ?? '—'}<span style={{ color: 'var(--ink-soft)', fontWeight: 500, fontSize: 11 }}>/10</span>
                  </span>
                  <span style={{ width: 160, display: 'inline-flex', alignItems: 'center', gap: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: srcColor(a.source ?? ''), flexShrink: 0, display: 'inline-block' }} />
                    {a.source}
                  </span>
                  <span style={{ flex: 1, color: 'var(--ink)', fontFamily: 'var(--title)', fontSize: 17, letterSpacing: '-0.015em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.title}
                  </span>
                  <span style={{ width: 120, textAlign: 'right', fontSize: 11, color: 'var(--ink-soft)' }}>
                    {a.published_at ? formatDate(a.published_at) : ''}
                  </span>
                </div>
              </a>
            ))}

            <div style={{ padding: '20px 22px', fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-soft)', textAlign: 'center', borderTop: '1px solid var(--rule)', fontWeight: 500 }}>
              <span style={{ display: 'inline-block', width: 32, height: 1, background: 'var(--rule-strong)', verticalAlign: 'middle', margin: '0 10px' }} />
              {filtered.length} beoordeeld · laatste 30 dagen
              <span style={{ display: 'inline-block', width: 32, height: 1, background: 'var(--rule-strong)', verticalAlign: 'middle', margin: '0 10px' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
