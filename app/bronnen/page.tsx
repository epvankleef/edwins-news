'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import NavMenu from '@/components/NavMenu'

type Source = {
  id: number
  name: string
  url: string
  type: 'rss' | 'api' | 'json' | 'scrape'
  category: string
  enabled: boolean
  notes: string | null
}

type EditForm = {
  name: string
  url: string
  type: Source['type']
  category: string
  notes: string
}

const CATEGORIES = ['bedrijfsblog', 'nieuws', 'ai-media', 'community', 'aggregator', 'academisch']

const TYPE_COLOR: Record<string, string> = {
  rss: 'oklch(0.62 0.12 145)',
  api: 'oklch(0.65 0.11 250)',
  json: 'oklch(0.68 0.11 75)',
  scrape: 'oklch(0.65 0.11 45)',
}

const SQL_SETUP = `-- Voer dit uit in Supabase → SQL Editor
create table news_sources (
  id bigserial primary key,
  name text not null,
  url text not null,
  type text not null default 'rss',
  category text not null,
  enabled boolean not null default true,
  notes text,
  created_at timestamptz default now()
);

alter table news_sources enable row level security;
create policy "Public read"   on news_sources for select using (true);
create policy "Public insert" on news_sources for insert with check (true);
create policy "Public update" on news_sources for update using (true);
create policy "Public delete" on news_sources for delete using (true);

-- Initiële bronnen (23 totaal)
insert into news_sources (name, url, type, category) values
  ('OpenAI Blog',         'https://openai.com/blog/rss.xml',                     'rss',  'bedrijfsblog'),
  ('Anthropic Blog',      'https://www.anthropic.com/rss.xml',                   'rss',  'bedrijfsblog'),
  ('Google AI Blog',      'https://blog.google/technology/ai/rss/',               'rss',  'bedrijfsblog'),
  ('Meta AI Blog',        'https://ai.meta.com/blog/rss/',                        'rss',  'bedrijfsblog'),
  ('Microsoft AI Blog',   'https://blogs.microsoft.com/ai/feed/',                 'rss',  'bedrijfsblog'),
  ('NVIDIA Blog',         'https://blogs.nvidia.com/feed/',                       'rss',  'bedrijfsblog'),
  ('Mistral News',        'https://mistral.ai/news/',                             'scrape','bedrijfsblog'),
  ('Hugging Face Blog',   'https://huggingface.co/blog/feed.xml',                 'rss',  'bedrijfsblog'),
  ('Stability AI Blog',   'https://stability.ai/blog',                            'scrape','bedrijfsblog'),
  ('TechCrunch',          'https://techcrunch.com/feed/',                         'rss',  'nieuws'),
  ('The Verge',           'https://www.theverge.com/rss/index.xml',               'rss',  'nieuws'),
  ('Ars Technica',        'https://feeds.arstechnica.com/arstechnica/index',      'rss',  'nieuws'),
  ('Wired',               'https://www.wired.com/feed/rss',                       'rss',  'nieuws'),
  ('VentureBeat',         'https://venturebeat.com/feed/',                        'rss',  'nieuws'),
  ('Reuters Tech',        'https://feeds.reuters.com/reuters/technologyNews',     'rss',  'nieuws'),
  ('MIT Tech Review',     'https://www.technologyreview.com/feed/',               'rss',  'nieuws'),
  ('The Decoder',         'https://the-decoder.com/feed/',                        'rss',  'ai-media'),
  ('Marktechpost',        'https://www.marktechpost.com/feed/',                   'rss',  'ai-media'),
  ('Hacker News',         'https://news.ycombinator.com/rss',                     'rss',  'community'),
  ('Reddit ML',           'https://www.reddit.com/r/MachineLearning/.json',       'json', 'community'),
  ('NewsAPI',             'https://newsapi.org/',                                  'api',  'aggregator'),
  ('Google News',         'https://news.google.com/rss',                          'rss',  'aggregator'),
  ('ArXiv CS.AI',         'http://export.arxiv.org/api/query?search_query=cat:cs.AI', 'api', 'academisch');`

const EMPTY_FORM: EditForm = { name: '', url: '', type: 'rss', category: CATEGORIES[0], notes: '' }

function TypeBadge({ type }: { type: string }) {
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
      padding: '2px 6px', borderRadius: 4, color: TYPE_COLOR[type] ?? 'var(--ink-dim)',
      background: `color-mix(in oklab, ${TYPE_COLOR[type] ?? 'var(--ink-dim)'} 12%, transparent)`,
      border: `1px solid color-mix(in oklab, ${TYPE_COLOR[type] ?? 'var(--ink-dim)'} 25%, transparent)`,
      flexShrink: 0,
    }}>{type}</span>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 36, height: 20, borderRadius: 999, border: 'none', cursor: 'pointer',
        background: on ? 'var(--sage)' : 'var(--rule-strong)',
        position: 'relative', flexShrink: 0, transition: 'background 200ms',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 18 : 3, width: 14, height: 14,
        borderRadius: '50%', background: 'white', transition: 'left 200ms',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

function SourceForm({
  form, setForm, onSave, onCancel, saving,
}: {
  form: EditForm
  setForm: (f: EditForm) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  const inp: React.CSSProperties = {
    background: 'var(--bg)', border: '1px solid var(--rule-strong)', borderRadius: 8,
    padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)',
    outline: 'none', width: '100%',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--rule-strong)', borderRadius: 12, marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Naam</label>
          <input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="OpenAI Blog" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Type</label>
          <select style={{ ...inp, cursor: 'pointer' }} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Source['type'] })}>
            <option value="rss">RSS</option>
            <option value="api">API</option>
            <option value="json">JSON</option>
            <option value="scrape">Scrape</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--ink-soft)', textTransform: 'uppercase' }}>URL</label>
        <input style={inp} value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/feed.xml" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Categorie</label>
          <select style={{ ...inp, cursor: 'pointer' }} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Notitie (optioneel)</label>
          <input style={inp} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="bijv. vereist API-sleutel" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button className="chip" onClick={onCancel} style={{ opacity: 0.7 }}>annuleer</button>
        <button className="chip chip--on" onClick={onSave} disabled={saving || !form.name || !form.url}>
          {saving ? '…' : 'opslaan'}
        </button>
      </div>
    </div>
  )
}

export default function BronnenPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState(false)
  const [editId, setEditId] = useState<number | 'new' | null>(null)
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await getSupabase()
      .from('news_sources')
      .select('*')
      .order('category')
      .order('name')
    if (error) {
      setTableError(true)
    } else {
      setSources((data ?? []) as Source[])
    }
    setLoading(false)
  }

  async function toggleEnabled(id: number, val: boolean) {
    setSources(s => s.map(x => x.id === id ? { ...x, enabled: val } : x))
    await getSupabase().from('news_sources').update({ enabled: val }).eq('id', id)
  }

  async function saveEdit() {
    if (!editForm.name || !editForm.url) return
    setSaving(true)
    if (editId === 'new') {
      const { data, error } = await getSupabase()
        .from('news_sources')
        .insert({ ...editForm, notes: editForm.notes || null })
        .select()
        .single()
      if (!error && data) setSources(s => [...s, data as Source].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)))
    } else {
      await getSupabase()
        .from('news_sources')
        .update({ ...editForm, notes: editForm.notes || null })
        .eq('id', editId as number)
      setSources(s => s.map(x => x.id === editId ? { ...x, ...editForm, notes: editForm.notes || null } : x))
    }
    setSaving(false)
    setEditId(null)
    setEditForm(EMPTY_FORM)
  }

  async function deleteSrc(id: number) {
    setDeleting(id)
    await getSupabase().from('news_sources').delete().eq('id', id)
    setSources(s => s.filter(x => x.id !== id))
    setDeleting(null)
  }

  function startEdit(src: Source) {
    setEditId(src.id)
    setEditForm({ name: src.name, url: src.url, type: src.type, category: src.category, notes: src.notes ?? '' })
  }

  function startNew() {
    setEditId('new')
    setEditForm(EMPTY_FORM)
  }

  function cancelEdit() {
    setEditId(null)
    setEditForm(EMPTY_FORM)
  }

  async function copySql() {
    await navigator.clipboard.writeText(SQL_SETUP)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  const grouped = CATEGORIES.map(cat => ({
    cat,
    items: sources.filter(s => s.category === cat),
  })).filter(g => g.items.length > 0 || (!tableError && !loading))

  const enabledCount = sources.filter(s => s.enabled).length

  if (tableError) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 28px 80px', position: 'relative', zIndex: 1 }}>
          <header style={{ borderBottom: '1px solid var(--rule)', paddingBottom: 18, marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10, fontFamily: 'var(--title)', fontSize: 32, letterSpacing: '-0.015em', lineHeight: 1.1 }}>
                <span style={{ color: 'var(--accent)', fontSize: 20 }}>◆</span>
                bronnen
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <nav className="masthead__nav desktop-nav">
                  <a href="/" className="masthead__nav-link">feed</a>
                  <a href="/opgeslagen" className="masthead__nav-link">opgeslagen</a>
                  <a href="/voorkeuren" className="masthead__nav-link">voorkeuren</a>
                  <a href="/bronnen" className="masthead__nav-link masthead__nav-link--active">bronnen</a>
                </nav>
                <NavMenu current="/bronnen" />
              </div>
            </div>
          </header>

          <div style={{ border: '1px solid var(--rule)', borderRadius: 16, background: 'var(--surface)', padding: '24px', boxShadow: 'var(--inner-hi),var(--shadow)' }}>
            <h2 style={{ margin: '0 0 10px', fontFamily: 'var(--title)', fontSize: 22, letterSpacing: '-0.015em' }}>Tabel aanmaken in Supabase</h2>
            <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', margin: '0 0 16px', lineHeight: 1.6 }}>
              De tabel <code style={{ background: 'var(--rule)', padding: '1px 6px', borderRadius: 4 }}>news_sources</code> bestaat nog niet.
              Voer onderstaande SQL uit in <strong>Supabase → SQL Editor</strong> om de tabel aan te maken en de 23 standaardbronnen te seeden.
            </p>
            <div style={{ position: 'relative' }}>
              <pre style={{
                fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.6,
                background: 'var(--bg)', border: '1px solid var(--rule-strong)',
                borderRadius: 10, padding: '16px', overflowX: 'auto',
                color: 'var(--ink-dim)', margin: 0, whiteSpace: 'pre-wrap',
              }}>{SQL_SETUP}</pre>
              <button
                className="chip"
                onClick={copySql}
                style={{ position: 'absolute', top: 10, right: 10, fontSize: 10 }}
              >
                {copySuccess ? '✓ gekopieerd' : 'kopieer SQL'}
              </button>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className="chip" onClick={load} style={{ opacity: 0.8 }}>↻ opnieuw proberen</button>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-soft)' }}>
                Na het uitvoeren van de SQL, klik op opnieuw proberen.
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 28px 80px', position: 'relative', zIndex: 1 }}>

        <header style={{ borderBottom: '1px solid var(--rule)', paddingBottom: 18, marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10, fontFamily: 'var(--title)', fontSize: 32, letterSpacing: '-0.015em', lineHeight: 1.1 }}>
                <span style={{ color: 'var(--accent)', fontSize: 20 }}>◆</span>
                bronnen
              </div>
              {!loading && (
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-soft)', letterSpacing: '0.04em' }}>
                  {enabledCount} van {sources.length} actief
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <nav className="masthead__nav desktop-nav">
                <a href="/" className="masthead__nav-link">feed</a>
                <a href="/opgeslagen" className="masthead__nav-link">opgeslagen</a>
                <a href="/voorkeuren" className="masthead__nav-link">voorkeuren</a>
                <a href="/bronnen" className="masthead__nav-link masthead__nav-link--active">bronnen</a>
              </nav>
              <NavMenu current="/bronnen" />
            </div>
          </div>
        </header>

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-soft)', letterSpacing: '0.1em' }}>laden…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {grouped.map(({ cat, items }) => (
              <section key={cat} style={{ border: '1px solid var(--rule)', borderRadius: 16, background: 'var(--surface)', overflow: 'hidden', boxShadow: 'var(--inner-hi),var(--shadow)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: items.length > 0 ? '1px solid var(--rule)' : 'none', background: 'color-mix(in oklab, var(--surface) 60%, transparent)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600 }}>{cat}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-soft)' }}>
                      {items.filter(s => s.enabled).length}/{items.length}
                    </span>
                  </div>
                  <button
                    className="chip"
                    onClick={() => { setEditId('new'); setEditForm({ ...EMPTY_FORM, category: cat }) }}
                    style={{ fontSize: 10, padding: '3px 10px' }}
                  >
                    + bron
                  </button>
                </div>

                {items.map(src => (
                  <div key={src.id}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                      borderTop: '1px solid var(--rule)', opacity: src.enabled ? 1 : 0.45,
                      transition: 'opacity 200ms',
                    }}>
                      <Toggle on={src.enabled} onChange={v => toggleEnabled(src.id, v)} />
                      <TypeBadge type={src.type} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {src.name}
                        </div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                          {src.url}
                        </div>
                        {src.notes && (
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-dim)', fontStyle: 'italic', marginTop: 2 }}>{src.notes}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          className="chip"
                          onClick={() => editId === src.id ? cancelEdit() : startEdit(src)}
                          style={{ fontSize: 10, padding: '3px 8px', opacity: 0.7 }}
                        >
                          {editId === src.id ? 'annuleer' : 'bewerk'}
                        </button>
                        <button
                          className="chip"
                          onClick={() => deleteSrc(src.id)}
                          disabled={deleting === src.id}
                          style={{ fontSize: 10, padding: '3px 8px', color: 'var(--rose)', borderColor: 'color-mix(in oklab, var(--rose) 30%, transparent)', opacity: deleting === src.id ? 0.4 : 0.7 }}
                        >
                          {deleting === src.id ? '…' : 'verwijder'}
                        </button>
                      </div>
                    </div>
                    {editId === src.id && (
                      <div style={{ padding: '0 20px 16px' }}>
                        <SourceForm form={editForm} setForm={setEditForm} onSave={saveEdit} onCancel={cancelEdit} saving={saving} />
                      </div>
                    )}
                  </div>
                ))}

                {editId === 'new' && editForm.category === cat && (
                  <div style={{ padding: '0 20px 16px', borderTop: items.length > 0 ? '1px solid var(--rule)' : 'none' }}>
                    <SourceForm form={editForm} setForm={setEditForm} onSave={saveEdit} onCancel={cancelEdit} saving={saving} />
                  </div>
                )}
              </section>
            ))}

            {/* Uncategorized new source */}
            {editId === 'new' && !CATEGORIES.includes(editForm.category) && (
              <section style={{ border: '1px solid var(--rule)', borderRadius: 16, background: 'var(--surface)', padding: '14px 20px', boxShadow: 'var(--inner-hi),var(--shadow)' }}>
                <SourceForm form={editForm} setForm={setEditForm} onSave={saveEdit} onCancel={cancelEdit} saving={saving} />
              </section>
            )}

            <button
              className="chip"
              onClick={startNew}
              style={{ alignSelf: 'flex-start', opacity: 0.7 }}
            >
              + nieuwe bron toevoegen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
