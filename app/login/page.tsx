'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    if (error) {
      setError('Onjuiste e-mail of wachtwoord.')
      setBusy(false)
      return
    }
    router.replace('/')
    router.refresh()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <form
        onSubmit={onSubmit}
        style={{ width: '100%', maxWidth: 360, border: '1px solid var(--rule)', borderRadius: 16, background: 'var(--surface)', padding: '32px 28px', boxShadow: 'var(--inner-hi),var(--shadow)', display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ color: 'var(--accent)', fontSize: 22 }}>◆</span>
          <h1 style={{ margin: 0, fontFamily: 'var(--title)', fontSize: 24, letterSpacing: '-0.015em' }}>edwin&apos;s feed</h1>
        </div>
        <p style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-soft)' }}>Log in om verder te gaan.</p>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)' }}>
          E-mail
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: 13 }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-dim)' }}>
          Wachtwoord
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: 13 }}
          />
        </label>

        {error && (
          <p style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--rose)' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="chip"
          style={{ marginTop: 4, padding: '10px 14px', opacity: busy ? 0.6 : 1 }}
        >
          {busy ? '…inloggen' : 'inloggen'}
        </button>
      </form>
    </div>
  )
}
