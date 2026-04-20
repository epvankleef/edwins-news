'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

type ProfileRow = { profile: string; updated_at: string }
type FeedbackRow = { rating: number; news_items: { category: string | null; source: string | null } | null }
type StatEntry = { name: string; interessant: number; mwah: number; nope: number; total: number }

function BarRow({ entry, max }: { entry: StatEntry; max: number }) {
  const pct = max > 0 ? (entry.interessant / max) * 100 : 0
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', gap: 14, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--rule)' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
      <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'var(--rule-strong)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'var(--sage)', borderRadius: 2, transition: 'width 600ms cubic-bezier(.22,1,.36,1)' }} />
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <span style={{ color: 'oklch(0.62 0.12 145)' }}>👍{entry.interessant}</span>
        <span style={{ color: 'var(--ink-soft)' }}>🫤{entry.mwah}</span>
        <span style={{ color: 'var(--rose)' }}>👎{entry.nope}</span>
      </div>
    </div>
  )
}

export default function VoorkeurenPage() {
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [catStats, setCatStats] = useState<StatEntry[]>([])
  const [srcStats, setSrcStats] = useState<StatEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [updateMsg, setUpdateMsg] = useState<string | null>(null)
  const [totalFeedback, setTotalFeedback] = useState(0)

  useEffect(() => {
    async function load() {
      const [profileRes, feedbackRes] = await Promise.all([
        getSupabase().from('user_profile').select('profile, updated_at').eq('id', 1).single(),
        getSupabase().from('user_feedback').select('rating, news_items(category, source)'),
      ])

      if (profileRes.data) setProfile(profileRes.data as ProfileRow)

      const rows = (feedbackRes.data ?? []) as unknown as FeedbackRow[]
      setTotalFeedback(rows.length)

      const catMap: Record<string, number[]> = {}
      const srcMap: Record<string, number[]> = {}
      for (const row of rows) {
        const cat = row.news_items?.category ?? 'onbekend'
        const src = row.news_items?.source ?? 'onbekend'
        if (!catMap[cat]) catMap[cat] = []
        catMap[cat].push(row.rating)
        if (!srcMap[src]) srcMap[src] = []
        srcMap[src].push(row.rating)
      }

      const toStats = (map: Record<string, number[]>): StatEntry[] =>
        Object.entries(map)
          .map(([name, ratings]) => ({
            name,
            interessant: ratings.filter(r => r === 3).length,
            mwah: ratings.filter(r => r === 2).length,
            nope: ratings.filter(r => r === 1).length,
            total: ratings.length,
          }))
          .sort((a, b) => b.interessant - a.interessant || b.total - a.total)

      setCatStats(toStats(catMap))
      setSrcStats(toStats(srcMap).slice(0, 12))
      setLoading(false)
    }
    load()
  }, [])

  const handleUpdate = async () => {
    setUpdating(true)
    setUpdateMsg(null)
    try {
      const res = await fetch('/api/profile-update', { method: 'POST' })
      const json = await res.json()
      if (json.skipped) setUpdateMsg(`Overgeslagen: ${json.reason}`)
      else if (json.triggered) {
        setUpdateMsg('Profiel wordt bijgewerkt… even wachten.')
        setTimeout(() => window.location.reload(), 4000)
      } else setUpdateMsg('Onbekende status')
    } catch {
      setUpdateMsg('Netwerkfout')
    }
    setUpdating(false)
  }

  const updatedDate = profile?.updated_at
    ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(profile.updated_at))
    : null

  const maxCat = catStats[0]?.interessant ?? 1
  const maxSrc = srcStats[0]?.interessant ?? 1

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 28px 80px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <header style={{ borderBottom: '1px solid var(--rule)', paddingBottom: 18, marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10, fontFamily: 'var(--title)', fontSize: 32, letterSpacing: '-0.015em', lineHeight: 1.1 }}>
              <span style={{ color: 'var(--accent)', fontSize: 20 }}>◆</span>
              voorkeuren
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-soft)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: 'var(--ink-dim)' }}>{totalFeedback} beoordelingen totaal</span>
              <span>·</span>
              <a href="/" style={{ color: 'var(--ink-dim)', textDecoration: 'none' }}>← feed</a>
              <span>·</span>
              <a href="/opgeslagen" style={{ color: 'var(--ink-dim)', textDecoration: 'none' }}>opgeslagen</a>
            </div>
          </div>
        </header>

        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-soft)', letterSpacing: '0.1em' }}>laden…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* Profiel */}
            <section style={{ border: '1px solid var(--rule)', borderRadius: 16, background: 'var(--surface)', padding: '22px 24px', boxShadow: 'var(--inner-hi),var(--shadow)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--title)', fontSize: 22, letterSpacing: '-0.015em', color: 'var(--ink)' }}>Jouw profiel</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {updateMsg && (
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: updateMsg.startsWith('Over') ? 'var(--ink-soft)' : 'var(--sage)' }}>
                      {updateMsg}
                    </span>
                  )}
                  <button
                    onClick={handleUpdate}
                    disabled={updating}
                    style={{
                      padding: '5px 11px', borderRadius: 999,
                      border: '1px solid var(--rule-strong)',
                      background: 'transparent', color: 'var(--ink-dim)',
                      fontFamily: 'var(--mono)', fontSize: 11, cursor: updating ? 'default' : 'pointer',
                      opacity: updating ? 0.5 : 1,
                    }}
                  >
                    {updating ? '…bijwerken' : '↻ bijwerken'}
                  </button>
                </div>
              </div>

              {profile?.profile ? (
                <>
                  <p style={{ fontFamily: 'var(--serif)', fontSize: 16, lineHeight: 1.6, color: 'var(--ink)', margin: '0 0 12px', whiteSpace: 'pre-wrap', maxWidth: '72ch' }}>
                    {profile.profile}
                  </p>
                  {updatedDate && (
                    <p style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-soft)', margin: 0 }}>
                      Bijgewerkt op {updatedDate}
                    </p>
                  )}
                </>
              ) : (
                <p style={{ fontFamily: 'var(--serif)', fontSize: 15, fontStyle: 'italic', color: 'var(--ink-dim)', margin: 0 }}>
                  Nog geen profiel. Beoordeel minimaal 10 artikelen en klik op bijwerken.
                </p>
              )}
            </section>

            {/* Statistieken */}
            {(catStats.length > 0 || srcStats.length > 0) && (
              <section style={{ border: '1px solid var(--rule)', borderRadius: 16, background: 'var(--surface)', padding: '22px 24px', boxShadow: 'var(--inner-hi),var(--shadow)' }}>
                <h2 style={{ margin: '0 0 20px', fontFamily: 'var(--title)', fontSize: 22, letterSpacing: '-0.015em', color: 'var(--ink)' }}>Statistieken</h2>

                {catStats.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <p style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-soft)', margin: '0 0 4px' }}>Per categorie</p>
                    {catStats.map(e => <BarRow key={e.name} entry={e} max={maxCat} />)}
                  </div>
                )}

                {srcStats.length > 0 && (
                  <div>
                    <p style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-soft)', margin: '0 0 4px' }}>Per bron (top 12)</p>
                    {srcStats.map(e => <BarRow key={e.name} entry={e} max={maxSrc} />)}
                  </div>
                )}
              </section>
            )}

            {/* Uitleg */}
            <section style={{ border: '1px solid var(--rule)', borderRadius: 16, background: 'var(--surface)', padding: '22px 24px', boxShadow: 'var(--inner-hi),var(--shadow)' }}>
              <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--title)', fontSize: 22, letterSpacing: '-0.015em', color: 'var(--ink)' }}>Hoe het werkt</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['↺', 'Elke ochtend worden nieuwe artikelen opgehaald uit 18+ bronnen en gescoord op jouw profiel.'],
                  ['◆', 'Score 1–10 op relevantie — hogere scores verschijnen bovenaan in de feed.'],
                  ['👍 🫤 👎', 'Jouw reacties trainen het profiel. Na 10+ nieuwe reacties kan het bijgewerkt worden.'],
                  ['📊', 'De statistieken hiernaast laten zien welke bronnen en categorieën je het meest waardeert.'],
                  ['⌛', 'Beoordelingen en artikelen worden automatisch verwijderd na 60 dagen.'],
                ].map(([icon, text]) => (
                  <div key={icon} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)', minWidth: 40 }}>{icon}</span>
                    <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-dim)', margin: 0, lineHeight: 1.5 }}>{text}</p>
                  </div>
                ))}
              </div>
            </section>

          </div>
        )}
      </div>
    </div>
  )
}
