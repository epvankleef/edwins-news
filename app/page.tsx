'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getSupabase, type NewsItem, type FeedbackRating } from '@/lib/supabase'
import NavMenu from '@/components/NavMenu'

// ── Types ────────────────────────────────────────────────────────────────────
type Layout = 'list' | 'briefing' | 'clusters' | 'gallery' | 'stream'
type Theme = 'obsidian' | 'graphite' | 'porcelain' | 'linen' | 'bone'
type FontKey = 'instrument' | 'fraunces' | 'dmserif' | 'grotesk' | 'geist' | 'mono'
type FilterMode = 'all' | 'hot' | 'high' | 'nl' | 'unread'
type ReactKey = 'interessant' | 'mwah' | 'nope'

interface FeedItem {
  id: string
  source: string
  time: string
  score: number
  title: string
  summary: string
  tags: string[]
  topic: string
  hot: boolean
  url: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const NL_MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const day = d.getDate()
  const mon = NL_MONTHS[d.getMonth()]
  const hh = String(d.getHours()).padStart(2,'0')
  const mm = String(d.getMinutes()).padStart(2,'0')
  return `${day} ${mon}, ${hh}:${mm}`
}

function parseTime(t: string): { day: string; hour: string; min: string } {
  const m = t.match(/(\d+\s*\w+),\s*(\d+):(\d+)/)
  if (!m) return { day: t, hour: '', min: '' }
  return { day: m[1].trim(), hour: m[2], min: m[3] }
}

function scoreColor(s: number): string {
  if (s >= 9) return 'oklch(0.58 0.14 145)'
  if (s >= 8) return 'oklch(0.62 0.12 145)'
  if (s >= 7) return 'oklch(0.68 0.11 75)'
  if (s >= 6) return 'oklch(0.65 0.11 45)'
  return 'oklch(0.55 0.08 25)'
}

function srcColor(src: string): string {
  let h = 0
  for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) % 360
  return `oklch(0.72 0.12 ${h})`
}

const NL_SOURCES = ['tweakers','nu.nl','emerce','google news nl','google news ai','google news llm']
function isNL(item: FeedItem): boolean {
  return NL_SOURCES.some(s => item.source.toLowerCase().includes(s)) ||
    item.tags.includes('nl')
}

function toFeedItem(n: NewsItem): FeedItem {
  const score = n.score ?? 5
  const cat = (n.category ?? 'algemeen').toLowerCase()
  return {
    id: n.id,
    source: n.source ?? 'Onbekend',
    time: n.published_at ? formatTime(n.published_at) : '',
    score,
    title: n.title,
    summary: n.summary ?? '',
    tags: [cat],
    topic: cat,
    hot: score >= 9,
    url: n.url ?? '#',
  }
}

const TOPIC_NAMES: Record<string, string> = {
  ai: 'AI', research: 'Onderzoek', tech: 'Tech', business: 'Business',
  models: 'Modellen', money: 'Investeringen', nl: 'Nederland',
  eu: 'Europa', hardware: 'Hardware', startups: 'Startups',
}

const REACTIONS: { key: ReactKey; label: string; emoji: string }[] = [
  { key: 'interessant', label: 'Interessant', emoji: '👍' },
  { key: 'mwah',        label: 'Mwah',        emoji: '🫤' },
  { key: 'nope',        label: 'Niet voor mij', emoji: '👎' },
]

const RATING_MAP: Record<ReactKey, FeedbackRating> = {
  interessant: 3, mwah: 2, nope: 1,
}

// ── Atoms ────────────────────────────────────────────────────────────────────
function SrcDot({ source }: { source: string }) {
  return <span className="src-dot" style={{ background: srcColor(source) }} />
}

function HotFlag() {
  return <span className="hot-flag" style={{ marginLeft: 10 }}>HOT</span>
}

function TagChips({ tags }: { tags: string[] }) {
  return (
    <>
      {tags.map(t => (
        <span key={t} className="tag">#{t}</span>
      ))}
    </>
  )
}

function RxBtns({
  item,
  myReaction,
  onReact,
  compact = false,
}: {
  item: FeedItem
  myReaction: ReactKey | undefined
  onReact: (id: string, key: ReactKey) => void
  compact?: boolean
}) {
  return (
    <>
      {REACTIONS.map(r => {
        const on = myReaction === r.key
        return (
          <button
            key={r.key}
            className={`rx-btn ${on ? 'on' : ''}`}
            style={compact ? { padding: '4px 7px' } : undefined}
            title={r.label}
            onClick={e => { e.stopPropagation(); onReact(item.id, r.key) }}
          >
            <span className="e">{r.emoji}</span>
            {!compact && <span>{r.label}</span>}
          </button>
        )
      })}
    </>
  )
}

type SortKey = 'score' | 'source' | 'time' | 'title' | 'reaction'
type SortDir = 'asc' | 'desc'

function sortItems(items: FeedItem[], key: SortKey, dir: SortDir, reactions: Record<string, ReactKey>): FeedItem[] {
  const mul = dir === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    let cmp = 0
    if (key === 'score') cmp = a.score - b.score
    else if (key === 'source') cmp = a.source.localeCompare(b.source)
    else if (key === 'time') cmp = a.time.localeCompare(b.time)
    else if (key === 'title') cmp = a.title.localeCompare(b.title)
    else if (key === 'reaction') {
      const order: Record<string, number> = { interessant: 2, mwah: 1, nope: 0 }
      cmp = (order[reactions[a.id] ?? ''] ?? -1) - (order[reactions[b.id] ?? ''] ?? -1)
    }
    return cmp * mul
  })
}

// ── Layout 1: List ───────────────────────────────────────────────────────────
function ListLayout({
  items,
  cursor,
  expanded,
  reactions,
  onRowClick,
  onReact,
}: {
  items: FeedItem[]
  cursor: number
  expanded: Record<string, boolean>
  reactions: Record<string, ReactKey>
  onRowClick: (idx: number, id: string) => void
  onReact: (id: string, key: ReactKey) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = sortItems(items, sortKey, sortDir, reactions)
  const arrow = (key: SortKey) => sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''

  return (
    <div className="atelier">
      <div className="atelier__statusbar">
        <span>{items.length} items</span>
        <span>·</span>
        <span>{Object.keys(reactions).filter(id => items.some(it => it.id === id)).length} beoordeeld</span>
        <span>·</span>
        <span>{items.filter(it => !reactions[it.id]).length} ongelezen</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: 'var(--ink-soft)', opacity: 0.55, fontSize: 11 }}>jk · ↵ · 1–3</span>
      </div>
      <div className="atelier__colheads">
        <span style={{ width: 28 }} />
        <button className="colhead" style={{ width: 68 }} onClick={() => handleSort('score')}>
          Score{arrow('score')}
        </button>
        <button className="colhead" style={{ width: 190 }} onClick={() => handleSort('source')}>
          Bron{arrow('source')}
        </button>
        <button className="colhead" style={{ width: 120 }} onClick={() => handleSort('time')}>
          Tijd{arrow('time')}
        </button>
        <button className="colhead" style={{ flex: 1 }} onClick={() => handleSort('title')}>
          Titel{arrow('title')}
        </button>
        <button className="colhead" style={{ width: 180, textAlign: 'right' }} onClick={() => handleSort('reaction')}>
          Reactie{arrow('reaction')}
        </button>
      </div>
      <div className="atelier__rows">
        {sorted.map((it, idx) => {
          const isC = idx === cursor
          const isE = expanded[it.id]
          const rx = reactions[it.id]
          const arrowMark = isC ? '▸' : (it.hot ? '◆' : '·')
          const rxDisplay = rx
            ? <span style={{ color: 'var(--sage)', fontWeight: 600 }}>
                {REACTIONS.find(r => r.key === rx)?.emoji}{' '}
                {REACTIONS.find(r => r.key === rx)?.label.toLowerCase()}
              </span>
            : <span style={{ color: 'var(--ink-soft)' }}>—</span>

          return (
            <div
              key={it.id}
              className={`arow ${isC ? 'arow--cursor' : ''}`}
              data-idx={idx}
            >
              <div
                className="arow__main"
                onClick={() => onRowClick(idx, it.id)}
              >
                <span className="arow__arrow" style={{ width: 28 }}>{arrowMark}</span>
                <span className="score-pill" style={{ width: 68, color: scoreColor(it.score) }}>
                  {it.score}<span className="slash">/10</span>
                </span>
                <span style={{ width: 190, display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--ink-dim)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                  <SrcDot source={it.source} />{it.source}
                </span>
                <span style={{ width: 120, color: 'var(--ink-soft)', fontFamily: 'var(--mono)', fontSize: 12 }}>{it.time}</span>
                <span className="arow__title" style={{ flex: 1 }}>
                  {it.title}
                  {it.hot && <HotFlag />}
                </span>
                <span style={{ width: 180, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{rxDisplay}</span>
              </div>
              {isE && (
                <div className="arow__expand">
                  <p className="arow__summary">{it.summary}</p>
                  <div className="arow__tags"><TagChips tags={it.tags} /></div>
                  <div className="arow__actions">
                    <RxBtns item={it} myReaction={rx} onReact={onReact} />
                    <a href={it.url} target="_blank" rel="noreferrer"
                      style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}
                      onClick={e => e.stopPropagation()}>
                      ↗ open
                    </a>
                    <span className="arow__hint">druk <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> voor snel reageren</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <div className="atelier__eof">
          <span className="atelier__eof-rule" />
          einde feed · {items.length} items
          <span className="atelier__eof-rule" />
        </div>
      </div>
    </div>
  )
}

// ── Layout 2: Briefing ───────────────────────────────────────────────────────
function BriefingLayout({
  items,
}: {
  items: FeedItem[]
  reactions: Record<string, ReactKey>
  onReact: (id: string, key: ReactKey) => void
}) {
  const sorted = [...items].sort((a, b) => b.score - a.score)
  const [lead, ...rest] = sorted
  const secondary = rest.slice(0, 2)
  const tail = rest.slice(2)
  const today = new Date()
  const dateStr = today.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

  if (!lead) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>Geen items</div>

  const HeroCard = ({ it, cls = '' }: { it: FeedItem; cls?: string }) => (
    <a href={it.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
      <div className={`hero ${cls}`}>
        <div className="hero__kicker">
          <span className="hero__kicker-dot" />
          {TOPIC_NAMES[it.topic] ?? it.topic} · {it.score}/10
          {it.hot && <> · <span style={{ color: 'var(--rose)' }}>HOT</span></>}
        </div>
        <h3 className="hero__title">{it.title}</h3>
        <p className="hero__summary">{it.summary}</p>
        <div className="hero__foot">
          <SrcDot source={it.source} />{it.source} · {it.time}
        </div>
      </div>
    </a>
  )

  return (
    <div className="briefing">
      <div className="briefing__intro">
        <h1>Ochtendbriefing.</h1>
        <p>{dateStr} · {items.length} verhalen op de radar</p>
      </div>
      <div className="briefing__heroes">
        <HeroCard it={lead} cls="hero--lead" />
        {secondary.map(it => <HeroCard key={it.id} it={it} />)}
      </div>
      {tail.length > 0 && (
        <>
          <div className="briefing__section-head">
            <h2>Verder in het nieuws</h2>
            <p>{tail.length} items</p>
          </div>
          <div className="briefing__rest">
            {tail.map(it => (
              <a key={it.id} href={it.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <div className="brow">
                  <span className="brow__score" style={{ color: scoreColor(it.score) }}>{it.score}</span>
                  <span className="brow__src"><SrcDot source={it.source} />{it.source}</span>
                  <span className="brow__title">
                    {it.title}
                    {it.hot && <> <span className="hot-flag">HOT</span></>}
                  </span>
                  <span className="brow__time">{it.time}</span>
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Layout 3: Clusters ───────────────────────────────────────────────────────
function ClustersLayout({ items }: { items: FeedItem[] }) {
  const groups: Record<string, FeedItem[]> = {}
  items.forEach(it => {
    if (!groups[it.topic]) groups[it.topic] = []
    groups[it.topic].push(it)
  })
  const ordered = Object.entries(groups)
    .map(([topic, list]) => ({ topic, list: list.sort((a, b) => b.score - a.score) }))
    .sort((a, b) => b.list.length - a.list.length || b.list[0].score - a.list[0].score)

  return (
    <div className="clusters">
      {ordered.map(({ topic, list }) => {
        const lead = list[0]
        const angles = list.slice(0, 4)
        return (
          <div key={topic} className="cluster">
            <div className="cluster__head">
              <span className="cluster__topic">{TOPIC_NAMES[topic] ?? topic}</span>
              <h3 className="cluster__title">{lead.title}</h3>
              <span className="cluster__count">{list.length} {list.length === 1 ? 'bron' : 'bronnen'}</span>
            </div>
            <p className="cluster__summary">{lead.summary}</p>
            <div className="cluster__angles">
              {angles.map(it => (
                <a key={it.id} href={it.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <div className="angle">
                    <span className="angle__src"><SrcDot source={it.source} />{it.source}</span>
                    <span className="angle__title">{it.title}</span>
                    <span className="angle__score" style={{ color: scoreColor(it.score) }}>{it.score}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Layout 4: Gallery ────────────────────────────────────────────────────────
function GalleryLayout({ items }: { items: FeedItem[] }) {
  const sorted = [...items].sort((a, b) => b.score - a.score)
  return (
    <div className="gallery">
      {sorted.map((it, idx) => {
        let cls = ''
        if (idx === 0) cls = 'gcard--featured'
        else if (idx === 1 || idx === 4) cls = 'gcard--tall'
        return (
          <a key={it.id} href={it.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <div className={`gcard ${cls}`}>
              <div className="gcard__kicker">
                <span className="src-dot" style={{ background: srcColor(it.source) }} />
                {it.source} · {TOPIC_NAMES[it.topic] ?? it.topic}
                {it.hot && <> · <span className="hot-flag">HOT</span></>}
              </div>
              <h3 className="gcard__title">{it.title}</h3>
              <p className="gcard__summary">{it.summary}</p>
              <div className="gcard__foot">
                <span style={{ color: scoreColor(it.score), fontWeight: 700 }}>{it.score}/10</span>
                {' · '}{it.time}
              </div>
            </div>
          </a>
        )
      })}
    </div>
  )
}

// ── Layout 5: Stream ─────────────────────────────────────────────────────────
function StreamLayout({
  items,
  reactions,
  onReact,
}: {
  items: FeedItem[]
  reactions: Record<string, ReactKey>
  onReact: (id: string, key: ReactKey) => void
}) {
  const days: Record<string, FeedItem[]> = {}
  items.forEach(it => {
    const { day } = parseTime(it.time)
    if (!days[day]) days[day] = []
    days[day].push(it)
  })

  const todayKey = (() => {
    const d = new Date()
    return `${d.getDate()} ${NL_MONTHS[d.getMonth()]}`
  })()
  const yesterdayKey = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return `${d.getDate()} ${NL_MONTHS[d.getMonth()]}`
  })()

  return (
    <div className="stream">
      {Object.entries(days).map(([day, list]) => {
        const label = day === todayKey ? 'Vandaag' : day === yesterdayKey ? 'Gisteren' : day
        return (
          <div key={day} className="stream__day">
            <div className="stream__day-head">
              <h2 className="stream__day-label">{label}</h2>
              <span className="stream__day-date">{day} 2026</span>
              <span className="stream__day-count">{list.length} items</span>
            </div>
            {list.map((it, rowIdx) => {
              const { hour, min } = parseTime(it.time)
              const rx = reactions[it.id]
              const isLast = rowIdx === list.length - 1
              return (
                <div key={it.id} className="srow">
                  <div className="srow__time">
                    <div className="srow__hour">{hour}:{min}</div>
                    <div className="srow__min">{day}</div>
                  </div>
                  <div className="srow__line">
                    <span className="srow__dot" style={{ background: scoreColor(it.score) }} />
                    {!isLast && <span className="srow__connect" />}
                  </div>
                  <div className="srow__body">
                    <div className="srow__meta">
                      <SrcDot source={it.source} />{it.source}
                      <span style={{ color: 'var(--ink-soft)' }}>·</span>
                      <span style={{ color: scoreColor(it.score), fontWeight: 700, fontFamily: 'var(--mono)' }}>{it.score}/10</span>
                      {it.hot && <span className="hot-flag">HOT</span>}
                    </div>
                    <a href={it.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                      <h3 className="srow__title">{it.title}</h3>
                    </a>
                    <p className="srow__summary">{it.summary}</p>
                    <div className="srow__foot">
                      <TagChips tags={it.tags} />
                      <div className="srow__rx">
                        <RxBtns item={it} myReaction={rx} onReact={onReact} compact />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── Loader ───────────────────────────────────────────────────────────────────
function Loader() {
  return (
    <div className="loader">
      <div className="loader__marks">
        <span className="loader__mark" style={{ animationDelay: '0ms' }}>◆</span>
        <span className="loader__mark" style={{ animationDelay: '200ms' }}>◆</span>
        <span className="loader__mark" style={{ animationDelay: '400ms' }}>◆</span>
      </div>
      <span className="loader__label">laden</span>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [fetchMsg, setFetchMsg] = useState('')

  const [theme, setTheme] = useState<Theme>('porcelain')
  const [layout, setLayout] = useState<Layout>('list')
  const [font, setFont] = useState<FontKey>('instrument')
  const [filterMode, setFilterMode] = useState<FilterMode>('unread')
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [reactions, setReactions] = useState<Record<string, ReactKey>>({})

  const searchRef = useRef<HTMLInputElement>(null)

  // Load persisted prefs (reactions komen via loadArticles vanuit Supabase)
  useEffect(() => {
    const t = localStorage.getItem('ef:theme') as Theme | null
    const l = localStorage.getItem('ef:layout') as Layout | null
    const f = localStorage.getItem('ef:font') as FontKey | null
    if (t) setTheme(t)
    if (l) setLayout(l)
    if (f) setFont(f)
  }, [])

  // Apply theme + font to body
  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
    document.body.setAttribute('data-font', font)
  }, [theme, font])

  // Fetch articles from Supabase
  const loadArticles = useCallback(async () => {
    setLoading(true)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    const [{ data: newsData }, { data: fbData }] = await Promise.all([
      getSupabase()
        .from('news_items')
        .select('*')
        .gte('created_at', cutoff)
        .order('score', { ascending: false })
        .limit(60),
      getSupabase()
        .from('user_feedback')
        .select('news_item_id, rating'),
    ])

    // Bouw reactie-map op uit Supabase + localStorage
    const REVERSE: Record<number, ReactKey> = { 3: 'interessant', 2: 'mwah', 1: 'nope' }
    const stored = (() => { try { return JSON.parse(localStorage.getItem('ef:reactions') ?? '{}') } catch { return {} } })()
    const allReactions: Record<string, ReactKey> = { ...stored }
    for (const fb of (fbData ?? [])) {
      const key = REVERSE[fb.rating as number]
      if (key) allReactions[String(fb.news_item_id)] = key
    }

    // Dedupliceer op URL — groepeer per URL, kies hoogste score
    // Draag bestaande reactie over naar de winnaar (zelfde artikel, andere bron/ID)
    const groups = new Map<string, ReturnType<typeof toFeedItem>[]>()
    for (const raw of (newsData ?? [])) {
      const item = toFeedItem(raw)
      const key = item.url === '#' ? item.id : item.url
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(item)
    }

    const mergedReactions: Record<string, ReactKey> = { ...allReactions }
    const deduped: ReturnType<typeof toFeedItem>[] = []
    for (const group of groups.values()) {
      group.sort((a, b) => b.score - a.score)
      const winner = group[0]
      // Als een ander exemplaar van dit artikel al beoordeeld is, koppel dat aan de winnaar
      const ratedSibling = group.find(it => allReactions[it.id])
      if (ratedSibling && !mergedReactions[winner.id]) {
        mergedReactions[winner.id] = allReactions[ratedSibling.id]
      }
      deduped.push(winner)
    }

    setItems(deduped)
    localStorage.setItem('ef:reactions', JSON.stringify(mergedReactions))
    setReactions(mergedReactions)

    setLoading(false)
  }, [])

  useEffect(() => { loadArticles() }, [loadArticles])

  // Apply filters
  const filtered = items.filter(it => {
    if (filterMode === 'hot' && !it.hot) return false
    if (filterMode === 'high' && it.score < 8) return false
    if (filterMode === 'nl' && !isNL(it)) return false
    if (filterMode === 'unread' && reactions[it.id]) return false
    if (query) {
      const q = query.toLowerCase()
      const hay = `${it.title} ${it.summary} ${it.source} ${it.tags.join(' ')}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  // React handler
  const handleReact = useCallback(async (id: string, key: ReactKey) => {
    setReactions(prev => {
      const next = { ...prev }
      if (next[id] === key) delete next[id]
      else next[id] = key
      localStorage.setItem('ef:reactions', JSON.stringify(next))
      return next
    })
    const rating = RATING_MAP[key]
    await getSupabase().from('user_feedback').upsert({
      news_item_id: id,
      rating,
    }, { onConflict: 'news_item_id' })
  }, [])

  // Row click (list layout)
  const handleRowClick = useCallback((idx: number, id: string) => {
    setCursor(idx)
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  // Keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (layout !== 'list') return
      const len = filtered.length
      if ((e.key === 'j' || e.key === 'ArrowDown') && len > 0) {
        e.preventDefault()
        setCursor(c => Math.min(len - 1, c + 1))
      } else if ((e.key === 'k' || e.key === 'ArrowUp') && len > 0) {
        e.preventDefault()
        setCursor(c => Math.max(0, c - 1))
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const id = filtered[cursor]?.id
        if (id) setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
      } else if (e.key === '1' || e.key === '2' || e.key === '3') {
        const map: Record<string, ReactKey> = { '1': 'interessant', '2': 'mwah', '3': 'nope' }
        const id = filtered[cursor]?.id
        if (id) handleReact(id, map[e.key])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [layout, filtered, cursor, handleReact])

  // Fetch fresh news
  async function triggerFetch() {
    setFetching(true)
    setFetchMsg('Ophalen…')
    try {
      const resp = await fetch('/api/cron/news', {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}` },
      })
      const reader = resp.body?.getReader()
      const dec = new TextDecoder()
      if (!reader) { setFetchMsg('Geen stream'); setFetching(false); return }
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = dec.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data:'))
        for (const line of lines) {
          try {
            const evt = JSON.parse(line.slice(5))
            if (evt.type === 'status') setFetchMsg(evt.message)
            if (evt.type === 'done') setFetchMsg(`✓ ${evt.inserted} nieuw opgeslagen`)
            if (evt.type === 'error') setFetchMsg(`✗ ${evt.message}`)
          } catch {}
        }
      }
      await loadArticles()
    } catch (err) {
      setFetchMsg(`Fout: ${String(err)}`)
    }
    setFetching(false)
    setTimeout(() => setFetchMsg(''), 4000)
  }

  async function resetToday() {
    if (!confirm('Alle artikelen van vandaag wissen?')) return
    await fetch('/api/cron/reset-today', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}` },
    })
    setItems([])
  }

  const sourceCount = new Set(items.map(i => i.source)).size
  const today = new Date()
  const todayStr = today.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead__top">
          {/* Links: brand + datum */}
          <div className="masthead__brand">
            <div className="masthead__brand-row">
              <span className="masthead__mark">◆</span>
              <span>edwin's feed</span>
            </div>
            <span className="masthead__subtitle">{todayStr} · {sourceCount} bronnen</span>
          </div>

          {/* Midden: navigatie */}
          <nav className="masthead__nav desktop-nav">
            <a href="/" className="masthead__nav-link masthead__nav-link--active">feed</a>
            <a href="/opgeslagen" className="masthead__nav-link">opgeslagen</a>
            <a href="/voorkeuren" className="masthead__nav-link">voorkeuren</a>
            <a href="/bronnen" className="masthead__nav-link">bronnen</a>
          </nav>

          {/* Rechts: controls */}
          <div className="masthead__controls">
            <div className="theme-picker">
              {(['obsidian','graphite','porcelain','linen','bone'] as Theme[]).map(t => (
                <button
                  key={t}
                  className={`theme-swatch ${theme === t ? 'active' : ''}`}
                  title={t.charAt(0).toUpperCase() + t.slice(1)}
                  style={{ '--sw': t === 'obsidian' ? '#0E0E12' : t === 'graphite' ? '#1E2024' : t === 'porcelain' ? '#FBF9F5' : t === 'linen' ? '#F5F0E8' : '#FAFAF8' } as React.CSSProperties}
                  onClick={() => { setTheme(t); localStorage.setItem('ef:theme', t) }}
                />
              ))}
            </div>
            <button
              className="chip"
              onClick={triggerFetch}
              disabled={fetching}
              style={{ opacity: fetching ? 0.6 : 1 }}
            >
              ↺ ophalen
            </button>
            {fetching ? (
              <span className="fetch-pulse">
                <span className="fetch-pulse__mark">◆</span>
                <span className="fetch-pulse__txt">{fetchMsg || 'ophalen…'}</span>
              </span>
            ) : fetchMsg ? (
              <span className="masthead__msg">{fetchMsg}</span>
            ) : null}
            <NavMenu current="/" />
          </div>
        </div>

        <div className="masthead__filters">
          <div className="filterrow">
            {(['all','hot','high','nl','unread'] as FilterMode[]).map(mode => (
              <button
                key={mode}
                className={`chip ${filterMode === mode ? 'chip--on' : ''}`}
                onClick={() => { setFilterMode(mode); setCursor(0) }}
              >
                {mode === 'all' ? 'Alles' : mode === 'hot' ? 'Hot' : mode === 'high' ? '8+' : mode === 'nl' ? 'NL' : 'Ongelezen'}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button
              className="chip filterrow__fetch"
              onClick={triggerFetch}
              disabled={fetching}
              style={{ opacity: fetching ? 0.6 : 1, flexShrink: 0 }}
            >
              ↺ ophalen
            </button>
            <div className="filterrow__search">
              <span className="filterrow__srch-icon">⌕</span>
              <input
                ref={searchRef}
                type="text"
                placeholder="zoek in feed…"
                value={query}
                onChange={e => { setQuery(e.target.value); setCursor(0) }}
              />
            </div>
          </div>

          <div className="layoutrow">
            {(['list','briefing','clusters','gallery','stream'] as Layout[]).map(l => (
              <button
                key={l}
                className={`lchip ${layout === l ? 'lchip--on' : ''}`}
                onClick={() => { setLayout(l); localStorage.setItem('ef:layout', l); setCursor(0) }}
              >
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div id="feed">
        {loading ? (
          <Loader />
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-soft)' }}>
            {items.length === 0 ? 'Geen artikelen vandaag — klik ↺ ophalen om nieuws te laden.' : 'Geen artikelen voor dit filter.'}
          </div>
        ) : layout === 'list' ? (
          <ListLayout
            items={filtered}
            cursor={cursor}
            expanded={expanded}
            reactions={reactions}
            onRowClick={handleRowClick}
            onReact={handleReact}
          />
        ) : layout === 'briefing' ? (
          <BriefingLayout items={filtered} reactions={reactions} onReact={handleReact} />
        ) : layout === 'clusters' ? (
          <ClustersLayout items={filtered} />
        ) : layout === 'gallery' ? (
          <GalleryLayout items={filtered} />
        ) : (
          <StreamLayout items={filtered} reactions={reactions} onReact={handleReact} />
        )}
      </div>
    </div>
  )
}
