'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ProfileRow = { profile: string; updated_at: string }
type FeedbackRow = { rating: number; news_items: { category: string | null; source: string | null } | null }

type StatEntry = { name: string; interessant: number; mwah: number; niet: number; total: number }

function StatBar({ entries, label }: { entries: StatEntry[]; label: string }) {
  if (entries.length === 0) return null
  return (
    <div className="mb-6">
      <p className="font-mono text-xs uppercase mb-3" style={{ color: 'var(--text3)', letterSpacing: '0.12em' }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {entries.map((e) => (
          <div key={e.name} className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-xs w-28 truncate shrink-0" style={{ color: 'var(--text2)' }}>{e.name}</span>
            <span className="font-mono text-xs" style={{ color: 'var(--gold)' }}>{e.interessant}✓</span>
            <span className="font-mono text-xs" style={{ color: 'var(--text3)' }}>{e.mwah}~</span>
            <span className="font-mono text-xs" style={{ color: 'var(--down)' }}>{e.niet}✗</span>
          </div>
        ))}
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

  useEffect(() => {
    async function load() {
      const [profileRes, feedbackRes] = await Promise.all([
        supabase.from('user_profile').select('profile, updated_at').eq('id', 1).single(),
        supabase.from('user_feedback').select('rating, news_items(category, source)'),
      ])

      if (profileRes.data) setProfile(profileRes.data as ProfileRow)

      const rows = (feedbackRes.data ?? []) as unknown as FeedbackRow[]

      // Aggregeer per categorie
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
            niet: ratings.filter(r => r === 1).length,
            total: ratings.length,
          }))
          .sort((a, b) => b.interessant - a.interessant || b.total - a.total)

      setCatStats(toStats(catMap))
      setSrcStats(toStats(srcMap).slice(0, 10))
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
      if (json.skipped) {
        setUpdateMsg(`Overgeslagen: ${json.reason}`)
      } else if (json.triggered) {
        setUpdateMsg('Profiel wordt bijgewerkt… even wachten en dan herladen.')
        setTimeout(() => window.location.reload(), 4000)
      } else {
        setUpdateMsg('Onbekende status')
      }
    } catch {
      setUpdateMsg('Netwerkfout')
    } finally {
      setUpdating(false)
    }
  }

  const updatedDate = profile?.updated_at
    ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(profile.updated_at))
    : null

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-20">
        {/* Header */}
        <header className="pt-8 pb-0">
          <div style={{ borderTop: '4px solid var(--ink)' }} />
          <div style={{ borderTop: '1px solid var(--ink)', marginTop: '3px' }} />
          <div className="flex items-center justify-between py-1 px-0" style={{ borderBottom: '1px solid var(--border-dark)' }}>
            <p className="font-mono" style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Voorkeuren
            </p>
            <a href="/" className="feedback-btn" style={{ textDecoration: 'none' }}>← feed</a>
          </div>
          <div className="py-5 text-center">
            <h1 className="font-display" style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1, color: 'var(--ink)' }}>
              Wat het systeem heeft geleerd
            </h1>
          </div>
          <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '3px double var(--ink)' }} className="py-1" />
        </header>

        {loading ? (
          <div className="py-20 text-center">
            <p className="font-mono text-xs tracking-widest" style={{ color: 'var(--text3)', animation: 'pulse-gold 1.5s ease infinite' }}>laden…</p>
          </div>
        ) : (
          <div className="mt-8" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* Sectie A: Profiel */}
            <section>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="font-display text-xl" style={{ color: 'var(--ink)', fontWeight: 700 }}>Jouw profiel</h2>
                <button
                  className="feedback-btn"
                  onClick={handleUpdate}
                  disabled={updating}
                  style={updating ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  {updating ? '…bijwerken' : '↻ bijwerken'}
                </button>
              </div>

              {profile?.profile ? (
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 2, padding: '16px 20px' }}>
                  <p className="font-serif text-sm leading-relaxed" style={{ color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>
                    {profile.profile}
                  </p>
                  {updatedDate && (
                    <p className="font-mono text-xs mt-3" style={{ color: 'var(--text3)' }}>
                      Bijgewerkt op {updatedDate}
                    </p>
                  )}
                </div>
              ) : (
                <p className="font-serif text-sm italic" style={{ color: 'var(--text3)' }}>
                  Nog geen profiel. Rate minimaal 10 artikelen en klik op bijwerken.
                </p>
              )}

              {updateMsg && (
                <p className="font-mono text-xs mt-2" style={{ color: updateMsg.startsWith('Overgeslagen') ? 'var(--text3)' : 'var(--gold)' }}>
                  {updateMsg}
                </p>
              )}
            </section>

            {/* Sectie B: Statistieken */}
            {(catStats.length > 0 || srcStats.length > 0) && (
              <section>
                <h2 className="font-display text-xl mb-4" style={{ color: 'var(--ink)', fontWeight: 700 }}>Jouw statistieken</h2>
                <StatBar entries={catStats} label="Per categorie" />
                <StatBar entries={srcStats} label="Per bron (top 10)" />
              </section>
            )}

            {/* Sectie C: Uitleg */}
            <section style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
              <h2 className="font-display text-xl mb-3" style={{ color: 'var(--ink)', fontWeight: 700 }}>Hoe het werkt</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  'Bij het ophalen van nieuws worden artikelen gescoord op basis van jouw profiel.',
                  'Hogere score (8-10) = bovenaan in de feed.',
                  'Het profiel wordt automatisch bijgewerkt na elke 10 nieuwe beoordelingen.',
                  'Sterren 4-5 = interessant → verschijnen op de Interessant-pagina.',
                  'Sterren 1-2 = minder relevant → worden minder snel getoond.',
                ].map((line, i) => (
                  <p key={i} className="font-mono text-xs" style={{ color: 'var(--text3)' }}>
                    <span style={{ color: 'var(--gold)', marginRight: '8px' }}>·</span>{line}
                  </p>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
