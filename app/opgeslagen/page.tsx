'use client'

import { useEffect, useState } from 'react'
import { supabase, type NewsItem } from '@/lib/supabase'

type FilterTab = 'alles' | 'interessant' | 'mwah' | 'niet'

const RATING_LABEL: Record<number, string> = {
  3: 'Interessant',
  2: 'Mwah',
  1: 'Niet interessant',
}

const RATING_COLOR: Record<number, string> = {
  3: 'var(--gold)',
  2: 'var(--text2)',
  1: 'var(--down)',
}

function RatedCard({ item, rating, index }: { item: NewsItem; rating: number; index: number }) {
  const date = item.published_at
    ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(item.published_at))
    : null

  return (
    <article
      className="article-card fade-up py-5 px-0"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className="font-mono"
            style={{ fontSize: '10px', color: RATING_COLOR[rating], border: `1px solid ${RATING_COLOR[rating]}`, borderRadius: 2, padding: '1px 7px', letterSpacing: '0.06em' }}
          >
            {RATING_LABEL[rating]}
          </span>
          {item.category && (
            <span className="category-tag">{item.category}</span>
          )}
          <span className="font-mono text-xs" style={{ color: 'var(--text3)' }}>{item.source}</span>
          {date && <span className="font-mono text-xs" style={{ color: 'var(--text3)' }}>· {date}</span>}
        </div>

        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-display block text-lg leading-snug mb-2 hover:opacity-75 transition-opacity"
            style={{ color: 'var(--text)', fontWeight: 600 }}
          >
            {item.title}
          </a>
        ) : (
          <h2 className="font-display text-lg leading-snug mb-2" style={{ color: 'var(--text)', fontWeight: 600 }}>
            {item.title}
          </h2>
        )}

        {item.summary && (
          <p className="font-serif text-sm leading-relaxed" style={{ color: 'var(--text2)', fontStyle: 'italic' }}>
            {item.summary}
          </p>
        )}
      </div>
    </article>
  )
}

export default function OpgeslagenPage() {
  const [items, setItems] = useState<{ article: NewsItem; rating: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('alles')

  useEffect(() => {
    async function load() {
      const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: feedback } = await supabase
        .from('user_feedback')
        .select('news_item_id, rating')
        .gte('created_at', since30)

      if (!feedback || feedback.length === 0) {
        setLoading(false)
        return
      }

      const ids = feedback.map((f) => f.news_item_id)
      const ratingMap: Record<string, number> = {}
      for (const f of feedback) ratingMap[f.news_item_id] = f.rating

      const { data: articles } = await supabase
        .from('news_items')
        .select('*')
        .in('id', ids)
        .order('created_at', { ascending: false })

      setItems((articles ?? []).map((a) => ({ article: a as NewsItem, rating: ratingMap[a.id] ?? 2 })))
      setLoading(false)
    }
    load()
  }, [])

  const filtered = items.filter(({ rating }) => {
    if (filter === 'interessant') return rating === 3
    if (filter === 'mwah') return rating === 2
    if (filter === 'niet') return rating === 1
    return true
  })

  const counts = {
    alles: items.length,
    interessant: items.filter(i => i.rating === 3).length,
    mwah: items.filter(i => i.rating === 2).length,
    niet: items.filter(i => i.rating === 1).length,
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'alles', label: `Alles (${counts.alles})` },
    { key: 'interessant', label: `Interessant (${counts.interessant})` },
    { key: 'mwah', label: `Mwah (${counts.mwah})` },
    { key: 'niet', label: `Niet interessant (${counts.niet})` },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-20">
        <header className="pt-8 pb-0">
          <div style={{ borderTop: '4px solid var(--ink)' }} />
          <div style={{ borderTop: '1px solid var(--ink)', marginTop: '3px' }} />
          <div className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid var(--border-dark)' }}>
            <p className="font-mono" style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Beoordeeld
            </p>
            <a href="/" className="feedback-btn" style={{ textDecoration: 'none' }}>← feed</a>
          </div>
          <div className="py-5 text-center">
            <h1 className="font-display" style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1, color: 'var(--ink)' }}>
              Opgeslagen
            </h1>
          </div>
          <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '3px double var(--ink)' }} className="py-1" />

          {/* Filter tabs */}
          <div className="flex gap-2 flex-wrap pt-4 pb-2">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="font-mono"
                style={{
                  fontSize: '11px',
                  padding: '3px 10px',
                  borderRadius: 2,
                  border: `1px solid ${filter === key ? 'var(--ink)' : 'var(--border)'}`,
                  background: filter === key ? 'var(--ink)' : 'none',
                  color: filter === key ? 'var(--bg)' : 'var(--text3)',
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <div className="py-20 text-center">
            <p className="font-mono text-xs tracking-widest" style={{ color: 'var(--text3)', animation: 'pulse-gold 1.5s ease infinite' }}>laden…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-display text-xl italic mb-2" style={{ color: 'var(--text2)' }}>
              {items.length === 0 ? 'Nog niets beoordeeld.' : 'Geen artikelen in deze categorie.'}
            </p>
            {items.length === 0 && (
              <a href="/" className="font-mono text-xs" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>
                Ga naar de digest →
              </a>
            )}
          </div>
        ) : (
          <div>
            {filtered.map(({ article, rating }, i) => (
              <RatedCard key={article.id} item={article} rating={rating} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
