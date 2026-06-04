# Login-systeem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De hele app afschermen achter een Supabase-Auth login (e-mail + wachtwoord) voor de eigenaar, met een datamodel dat klaar is voor meer gebruikers.

**Architecture:** Cookie-gebaseerde sessies via `@supabase/ssr`. Een Next.js `middleware.ts` gate redirect niet-ingelogde bezoekers naar `/login`. `user_feedback` en `user_profile` krijgen een `user_id`-koppeling; RLS schermt leesacties af op `authenticated` en per-gebruiker-data op `auth.uid()`. `news_items` blijft globaal (gedeelde scoring). De gelekte `NEXT_PUBLIC_CRON_SECRET` verdwijnt uit de client; client-getriggerde cron-routes vertrouwen voortaan op de sessie.

**Tech Stack:** Next.js 16 (App Router), React 19, `@supabase/ssr` 0.10.2, `@supabase/supabase-js` 2.x, Supabase Postgres + Auth, TypeScript, Tailwind v4.

> **Belangrijke context — live DB ≠ `supabase/schema.sql`:** Het bestand `supabase/schema.sql` is verouderd (noemt kolom `profile_text`). De **echte** `user_profile`-tabel heeft een kolom **`profile`** en wordt gelezen via **`id = 1`** (zie `app/api/cron/news/route.ts:288` en `app/voorkeuren/page.tsx:41`). Dit plan laat `id`/`profile` ongemoeid en voegt alleen `user_id` toe. Migraties worden uitgevoerd in de Supabase SQL-editor, idempotent geschreven.

> **Testopzet:** Dit project heeft geen test-runner (geen `test`-script, geen framework). Verificatie verloopt via `npm run build` (vangt typefouten), `npm run lint`, en handmatige browser-checks. We introduceren bewust geen testframework (YAGNI).

> **Owner-account:** e-mail `epvankleef@gmail.com`.

---

### Task 1: Eigenaar-account aanmaken + self-signup uitzetten

**Files:**
- Create: `scripts/create-owner.mjs`

- [ ] **Step 1: Schrijf het account-aanmaakscript**

```javascript
// scripts/create-owner.mjs
// Gebruik: node --env-file=.env.local scripts/create-owner.mjs <email> <wachtwoord>
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.argv[2]
const password = process.argv[3]

if (!url || !serviceKey) {
  console.error('Ontbrekende env: NEXT_PUBLIC_SUPABASE_URL of SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!email || !password) {
  console.error('Gebruik: node --env-file=.env.local scripts/create-owner.mjs <email> <wachtwoord>')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})

if (error) {
  console.error('Fout bij aanmaken:', error.message)
  process.exit(1)
}
console.log('Account aangemaakt. user_id =', data.user.id)
```

- [ ] **Step 2: Account aanmaken**

Run (kies zelf een sterk wachtwoord):
```
node --env-file=.env.local scripts/create-owner.mjs epvankleef@gmail.com "<sterk-wachtwoord>"
```
Expected: `Account aangemaakt. user_id = <uuid>`. Noteer dit wachtwoord — je logt er straks mee in.

- [ ] **Step 3: Self-signup uitzetten in Supabase**

Ga in het Supabase-dashboard naar **Authentication → Sign In / Providers → Email** (of **Authentication → Settings**) en zet **"Allow new users to sign up"** (Enable signups) **uit**. Sla op.
Verify: de toggle staat uit. Hierdoor kan niemand zich registreren; alleen het zojuist aangemaakte account kan inloggen.

- [ ] **Step 4: Commit**

```bash
git add scripts/create-owner.mjs
git commit -m "feat(auth): script om eigenaar-account aan te maken"
```

---

### Task 2: Database-migratie — user_id, constraints en RLS

**Files:**
- Create: `supabase/2026-06-04-auth-migration.sql`

Deze migratie is additief en idempotent. Voer hem uit in de **Supabase SQL-editor**.

- [ ] **Step 1: Schrijf het migratiebestand**

```sql
-- supabase/2026-06-04-auth-migration.sql
-- Login-systeem: koppel feedback + profiel aan auth.users, scherp RLS aan.
-- Idempotent — veilig om opnieuw te draaien.

-- 1. user_feedback: user_id-kolom -------------------------------------------
alter table public.user_feedback
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- Backfill bestaande feedback naar de eigenaar
update public.user_feedback
set user_id = (select id from auth.users where email = 'epvankleef@gmail.com')
where user_id is null;

-- Default voor toekomstige inserts = de ingelogde gebruiker
alter table public.user_feedback
  alter column user_id set default auth.uid();

create index if not exists user_feedback_user_id_idx on public.user_feedback (user_id);

-- Uniek per (gebruiker, artikel) zodat upsert per gebruiker werkt
create unique index if not exists user_feedback_user_item_uidx
  on public.user_feedback (user_id, news_item_id);

-- 2. user_profile: user_id-kolom (id=1 blijft de globale scorer-rij) ---------
alter table public.user_profile
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

update public.user_profile
set user_id = (select id from auth.users where email = 'epvankleef@gmail.com')
where user_id is null;

-- id=1-restrictie laten vervallen zodat er later meer profielrijen kunnen zijn
alter table public.user_profile drop constraint if exists user_profile_id_check;

-- 3. RLS aanscherpen ---------------------------------------------------------
-- news_items: lezen alleen voor ingelogde gebruikers
drop policy if exists "Artikelen zijn publiek leesbaar" on public.news_items;
create policy "news_items leesbaar voor ingelogden"
  on public.news_items for select
  to authenticated
  using (true);

-- user_profile: ingelogde gebruikers mogen profielen lezen (globale scorer-rij gedeeld)
drop policy if exists "Profiel is publiek leesbaar" on public.user_profile;
create policy "user_profile leesbaar voor ingelogden"
  on public.user_profile for select
  to authenticated
  using (true);

-- user_feedback: alleen je eigen rijen, en alleen ingelogd
drop policy if exists "Feedback mag worden ingevoegd" on public.user_feedback;
create policy "feedback select eigen rijen"
  on public.user_feedback for select
  to authenticated
  using (auth.uid() = user_id);
create policy "feedback insert eigen rijen"
  on public.user_feedback for insert
  to authenticated
  with check (auth.uid() = user_id);
create policy "feedback update eigen rijen"
  on public.user_feedback for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Migratie uitvoeren**

Plak de inhoud in de Supabase SQL-editor en voer uit.
Expected: "Success. No rows returned" (of vergelijkbaar). Geen errors.

- [ ] **Step 3: Backfill verifiëren**

Run in de SQL-editor:
```sql
select
  (select count(*) from public.user_feedback where user_id is null) as feedback_zonder_user,
  (select count(*) from public.user_profile where user_id is null) as profiel_zonder_user;
```
Expected: beide kolommen `0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/2026-06-04-auth-migration.sql
git commit -m "feat(auth): migratie user_id + per-gebruiker RLS"
```

---

### Task 3: Supabase-clients omzetten naar @supabase/ssr (cookies)

**Files:**
- Modify: `lib/supabase.ts` (volledig herschrijven, types behouden)
- Create: `lib/supabase-server.ts`

- [ ] **Step 1: Browser-client herschrijven**

Vervang de volledige inhoud van `lib/supabase.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _supabase
}

export type NewsItem = {
  id: string
  title: string
  summary: string | null
  url: string | null
  source: string | null
  category: string | null
  score: number | null
  published_at: string | null
  created_at: string
}

export type FeedbackRating = 1 | 2 | 3
```
De publieke API (`getSupabase`, `NewsItem`, `FeedbackRating`) blijft identiek, dus bestaande pagina's hoeven niet aangepast — alleen de sessieopslag wordt cookie-gebaseerd.

- [ ] **Step 2: Server-client toevoegen**

Maak `lib/supabase-server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Voor gebruik in Route Handlers (server). Leest de sessie uit cookies.
export async function getServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // In Route Handlers zonder schrijfcontext stil falen
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Build draaien**

Run: `npm run build`
Expected: build slaagt, geen type-errors over `lib/supabase.ts` of `lib/supabase-server.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase.ts lib/supabase-server.ts
git commit -m "feat(auth): cookie-gebaseerde Supabase-clients via @supabase/ssr"
```

---

### Task 4: Middleware-gate

**Files:**
- Create: `middleware.ts` (project-root)

- [ ] **Step 1: Middleware schrijven**

Maak `middleware.ts` in de project-root (naast `package.json`):
```typescript
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Sluit API-routes (cron draait zonder sessie, met CRON_SECRET), Next-assets en afbeeldingen uit.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
```

- [ ] **Step 2: Build draaien**

Run: `npm run build`
Expected: build slaagt; Next detecteert de middleware (zichtbaar in build-output als "Middleware").

- [ ] **Step 3: Handmatige check (niet-ingelogd)**

Run: `npm run dev`, open `http://localhost:3000/` in een **incognito**-venster.
Expected: je wordt geredirect naar `/login`. (De loginpagina bestaat nog niet — je ziet een 404 op `/login`; dat is goed, dat lossen we op in Task 5. De redirect zelf moet werken.)

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "feat(auth): middleware-gate redirect niet-ingelogde bezoekers naar /login"
```

---

### Task 5: Login-pagina

**Files:**
- Create: `app/login/page.tsx`

- [ ] **Step 1: Loginpagina schrijven**

Maak `app/login/page.tsx`:
```tsx
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
```

- [ ] **Step 2: Build draaien**

Run: `npm run build`
Expected: build slaagt, `/login` verschijnt in de routelijst.

- [ ] **Step 3: Handmatige loginflow testen**

Met `npm run dev` draaiend, open incognito `http://localhost:3000/` → je belandt op `/login`. Log in met `epvankleef@gmail.com` + het wachtwoord uit Task 1.
Expected: je wordt naar `/` geredirect en ziet de feed. Bij een fout wachtwoord verschijnt "Onjuiste e-mail of wachtwoord."

- [ ] **Step 4: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat(auth): loginpagina met e-mail + wachtwoord"
```

---

### Task 6: Logout-knop (masthead + mobiel menu)

**Files:**
- Create: `components/LogoutButton.tsx`
- Modify: `components/PageHeader.tsx` (controls)
- Modify: `app/page.tsx:751-779` (masthead controls)
- Modify: `components/NavMenu.tsx` (drawer)

- [ ] **Step 1: LogoutButton-component**

Maak `components/LogoutButton.tsx`:
```tsx
'use client'

import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

export default function LogoutButton({ className = 'chip' }: { className?: string }) {
  const router = useRouter()

  async function onLogout() {
    await getSupabase().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <button className={className} onClick={onLogout} title="Uitloggen">
      ⏻ uitloggen
    </button>
  )
}
```

- [ ] **Step 2: Logout in PageHeader (opgeslagen / voorkeuren / bronnen)**

In `components/PageHeader.tsx`, voeg de import toe bovenaan (na de bestaande import):
```tsx
import LogoutButton from '@/components/LogoutButton'
```
Vervang vervolgens het controls-blok:
```tsx
        <div className="masthead__controls">
          {right}
        </div>
```
door:
```tsx
        <div className="masthead__controls">
          {right}
          <LogoutButton />
        </div>
```

- [ ] **Step 3: Logout in de feed-masthead**

In `app/page.tsx`, voeg de import toe bij de overige imports (bovenaan, na de `getSupabase`-import):
```tsx
import LogoutButton from '@/components/LogoutButton'
```
Voeg in de masthead-controls (binnen `<div className="masthead__controls">`, na het `fetchMsg`-blok dat eindigt met `) : null}`) toe, vlak vóór de sluitende `</div>` van de controls:
```tsx
            <LogoutButton />
```
Het resultaat is dat `<LogoutButton />` als laatste kind in `<div className="masthead__controls">` staat.

- [ ] **Step 4: Logout in het mobiele menu (NavMenu)**

In `components/NavMenu.tsx`, voeg de import toe (na de bestaande imports):
```tsx
import LogoutButton from '@/components/LogoutButton'
```
Voeg onderaan de drawer toe, direct ná het `nav-drawer__themes`-blok en vóór de sluitende `</div>` van `nav-drawer`:
```tsx
        <div className="nav-drawer__section-label">Account</div>
        <div style={{ padding: '4px 0' }}>
          <LogoutButton />
        </div>
```

- [ ] **Step 5: Build draaien**

Run: `npm run build`
Expected: build slaagt, geen type-errors.

- [ ] **Step 6: Handmatig testen**

Met `npm run dev`: log in, klik op elke pagina (feed, opgeslagen, voorkeuren, bronnen) op "uitloggen".
Expected: je wordt naar `/login` geredirect en kunt niet meer terug naar `/` zonder opnieuw in te loggen.

- [ ] **Step 7: Commit**

```bash
git add components/LogoutButton.tsx components/PageHeader.tsx components/NavMenu.tsx app/page.tsx
git commit -m "feat(auth): logout-knop in masthead en mobiel menu"
```

---

### Task 7: Feedback koppelen aan user_id

**Files:**
- Modify: `app/page.tsx:635-648` (handleReact)

- [ ] **Step 1: handleReact aanpassen zodat user_id wordt meegestuurd**

In `app/page.tsx`, vervang de bestaande `handleReact`:
```tsx
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
```
door:
```tsx
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
    const { data: { user } } = await getSupabase().auth.getUser()
    if (!user) return
    await getSupabase().from('user_feedback').upsert({
      news_item_id: id,
      rating,
      user_id: user.id,
    }, { onConflict: 'user_id,news_item_id' })
  }, [])
```

- [ ] **Step 2: Build draaien**

Run: `npm run build`
Expected: build slaagt.

- [ ] **Step 3: Handmatig testen**

Met `npm run dev`, ingelogd op de feed: geef een artikel een reactie (👍/🫤/👎).
Controleer in de Supabase SQL-editor:
```sql
select news_item_id, rating, user_id from public.user_feedback order by created_at desc limit 3;
```
Expected: de nieuwste rij heeft een gevulde `user_id` (= jouw account). Klik dezelfde reactie nogmaals / een andere reactie → er ontstaat geen dubbele rij voor hetzelfde artikel (upsert werkt op `(user_id, news_item_id)`).

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(auth): feedback koppelen aan ingelogde gebruiker"
```

---

### Task 8: Cron-secret uit de client — sessie-gebaseerde autorisatie

**Files:**
- Modify: `app/api/cron/news/route.ts:214-219` (GET-auth)
- Modify: `app/api/cron/reset-today/route.ts:6-11` (DELETE-auth)
- Modify: `app/page.tsx` (`triggerFetch` ~683-713 en `resetToday` ~715-722)

- [ ] **Step 1: Auth in de news-route — sessie OF CRON_SECRET**

In `app/api/cron/news/route.ts`, voeg bovenaan de import toe (na de bestaande imports):
```typescript
import { getServerSupabase } from '@/lib/supabase-server'
```
Vervang het auth-blok bovenin `GET`:
```typescript
  const auth = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET ?? process.env.NEXT_PUBLIC_CRON_SECRET
  if (!expected || auth !== `Bearer ${expected}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
```
door:
```typescript
  // Toegang: een ingelogde gebruiker (browser-sessie) OF de CRON_SECRET (Vercel-cron).
  const cronSecret = process.env.CRON_SECRET
  const hasCronSecret = !!cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`
  let isLoggedIn = false
  if (!hasCronSecret) {
    const auth = await getServerSupabase()
    const { data: { user } } = await auth.auth.getUser()
    isLoggedIn = !!user
  }
  if (!hasCronSecret && !isLoggedIn) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
```

- [ ] **Step 2: Auth in de reset-today-route — sessie OF CRON_SECRET**

In `app/api/cron/reset-today/route.ts`, voeg de import toe (na de bestaande imports):
```typescript
import { getServerSupabase } from '@/lib/supabase-server'
```
Vervang het auth-blok in `DELETE`:
```typescript
  const auth = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET ?? process.env.NEXT_PUBLIC_CRON_SECRET
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
```
door:
```typescript
  const cronSecret = process.env.CRON_SECRET
  const hasCronSecret = !!cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`
  let isLoggedIn = false
  if (!hasCronSecret) {
    const sb = await getServerSupabase()
    const { data: { user } } = await sb.auth.getUser()
    isLoggedIn = !!user
  }
  if (!hasCronSecret && !isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
```

- [ ] **Step 3: Client — Authorization-header verwijderen uit triggerFetch**

In `app/page.tsx`, in `triggerFetch`, vervang:
```tsx
      const resp = await fetch('/api/cron/news', {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}` },
      })
```
door:
```tsx
      const resp = await fetch('/api/cron/news')
```

- [ ] **Step 4: Client — Authorization-header verwijderen uit resetToday**

In `app/page.tsx`, in `resetToday`, vervang:
```tsx
    await fetch('/api/cron/reset-today', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}` },
    })
```
door:
```tsx
    await fetch('/api/cron/reset-today', { method: 'DELETE' })
```

- [ ] **Step 5: Build + lint draaien**

Run: `npm run build`
Expected: build slaagt.
Run: `npm run lint`
Expected: geen errors. (Mocht ESLint klagen over een ongebruikte `NEXT_PUBLIC_CRON_SECRET`-referentie elders, verwijder die referentie.)

- [ ] **Step 6: Handmatig testen**

Met `npm run dev`, ingelogd op de feed: klik "↺ ophalen".
Expected: de stream-statusberichten lopen door en eindigen met "✓ N nieuw opgeslagen" (of "0 nieuw"). Geen 401. De server-cron (`/api/cron/news` met `Authorization: Bearer <CRON_SECRET>`) blijft ook werken omdat de header-route behouden is.

- [ ] **Step 7: Commit**

```bash
git add app/api/cron/news/route.ts app/api/cron/reset-today/route.ts app/page.tsx
git commit -m "feat(auth): client-cron-acties via sessie i.p.v. gelekte cron-secret"
```

---

### Task 9: Eindverificatie

**Files:** (geen — alleen verificatie)

- [ ] **Step 1: Volledige build**

Run: `npm run build`
Expected: slaagt, alle routes (`/`, `/login`, `/opgeslagen`, `/voorkeuren`, `/bronnen`, `api/...`) en "Middleware" verschijnen in de output.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: geen errors.

- [ ] **Step 3: End-to-end handmatige checklist**

Met `npm run dev`:
1. Incognito → `http://localhost:3000/` redirect naar `/login`. ✓
2. Fout wachtwoord → foutmelding. ✓
3. Correct inloggen → feed zichtbaar. ✓
4. Direct `http://localhost:3000/voorkeuren` openen terwijl uitgelogd → redirect naar `/login`. ✓
5. Reactie geven → rij in `user_feedback` met `user_id`. ✓
6. "↺ ophalen" werkt zonder 401. ✓
7. Uitloggen op elke pagina → terug naar `/login`, geen toegang meer. ✓

- [ ] **Step 4: Bevestig dat `NEXT_PUBLIC_CRON_SECRET` niet meer in client-code voorkomt**

Run (grep): zoek in de codebase naar `NEXT_PUBLIC_CRON_SECRET`.
Expected: geen treffers meer in `app/page.tsx` of andere client-componenten. (De env-var mag in `.env.local`/Vercel blijven staan voor de overige cron-routes, maar wordt niet meer naar de browser gestuurd.)
```

