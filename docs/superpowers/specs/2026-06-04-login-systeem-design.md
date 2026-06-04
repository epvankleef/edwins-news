# Ontwerp: Login-systeem (Supabase Auth)

**Datum:** 2026-06-04
**Status:** Goedgekeurd
**Project:** I News Digest

## Doel

Een login-systeem toevoegen dat de app afschermt voor de eigenaar (Edwin). De
hele app komt achter een login. Het datamodel wordt meteen per-gebruiker
gemaakt, zodat er later extra gebruikers bij kunnen zonder datamigratie. Echte
multi-user (registratie, per-gebruiker nieuwsscoring) is bewust nog buiten scope.

## Achtergrond / huidige situatie

- Next.js 16, volledig client-side (`'use client'`), praat rechtstreeks met
  Supabase via de anon key.
- Geen auth. RLS staat iedereen toe `news_items`/`user_profile` te lezen en
  `user_feedback` in te voegen.
- Beheer-acties (nieuws ophalen, resetten) gaan vanuit de client via
  `NEXT_PUBLIC_CRON_SECRET` — die secret lekt dus naar de browser.
- `@supabase/ssr` staat al in `package.json` maar wordt nog niet gebruikt.
- Eén gedeeld profiel (`user_profile` met altijd `id=1`). Reacties in
  localStorage + `user_feedback` (zonder gebruikerskoppeling).

## Beslissingen

- **Inlogmethode:** e-mail + wachtwoord via Supabase Auth. Geen extra
  dependencies; standaard in de Supabase/Next.js-wereld; schaalt naadloos naar
  meer gebruikers.
- **Self-signup uit.** Het account van de eigenaar wordt één keer handmatig
  aangemaakt (Supabase dashboard of scriptje). Niemand kan zich registreren tot
  dit bewust wordt opengezet.
- **Cookie-gebaseerde sessie** via `@supabase/ssr`, zodat middleware/server de
  sessie kan zien (de huidige localStorage-client kan dat niet, waardoor een
  server-side gate onmogelijk is).

## Architectuur

### Auth-clients (`@supabase/ssr`)

- **Browser-client** (`createBrowserClient`) — vervangt de huidige
  `getSupabase()` in `lib/supabase.ts`. Cookie-gebaseerd i.p.v. localStorage.
- **Server-client** (`createServerClient`) — nieuw, voor middleware en route
  handlers. Leest/schrijft sessie-cookies.

De bestaande types (`NewsItem`, `FeedbackRating`) blijven behouden.

### De gate (`middleware.ts`)

Nieuw bestand in de project-root. Bij elk verzoek:

1. Sessie verversen (cookie-refresh — vereist door `@supabase/ssr`).
2. Geen geldige sessie → redirect naar `/login`.
3. Wel ingelogd en pad is `/login` → redirect naar `/`.

Matcher sluit static assets, `_next`, favicon en de auth-callback uit. Alle
bestaande pagina's (`/`, `/opgeslagen`, `/voorkeuren`, `/bronnen`) komen
hierdoor automatisch achter de gate.

### Login-pagina (`app/login/page.tsx`)

- E-mail + wachtwoord formulier in de bestaande design-taal (zelfde
  thema's/fonts/CSS-tokens als de rest van de app).
- Foutafhandeling: verkeerde combinatie, leeg veld, netwerkfout — netjes
  zichtbaar voor de gebruiker.
- Bij succes → redirect naar `/`.

### Logout

- Knop in de masthead (op alle pagina's, want masthead/PageHeader is gedeeld).
- Roept `supabase.auth.signOut()` aan en redirect naar `/login`.

## Datamodel (migratie in `supabase/schema.sql`)

Klaar maken voor meer gebruikers:

- **`user_feedback`**: kolom `user_id uuid` toevoegen, FK → `auth.users(id)`,
  default `auth.uid()`. Bestaande rijen backfillen naar het account van de
  eigenaar.
- **`user_profile`**: van singleton (`id=1`) naar **per gebruiker**. Een
  `user_id uuid`-kolom (FK → `auth.users(id)`, uniek) wordt de sleutel.
  Bestaande profielrij backfillen naar de eigenaar. De `id=1`-constraint
  vervalt.
- **`news_items`**: blijft **gedeeld/globaal**. Per-gebruiker scoren is een
  n8n-wijziging die pas nodig is bij echte multi-user → toekomstig werk, buiten
  scope.

### RLS aanscherpen

- **Lezen** (`news_items`, `user_profile`) vereist nu een ingelogde gebruiker
  (`authenticated` rol) i.p.v. publiek.
- **`user_feedback`** en **`user_profile`**: rijen afgeschermd per gebruiker via
  `auth.uid() = user_id` (select/insert/update).
- n8n gebruikt de **service-role-key** en omzeilt RLS — de flows blijven dus
  ongewijzigd werken.

## Beveiligingsfix: cron-secret uit de client

Nu er auth is, hoeft `NEXT_PUBLIC_CRON_SECRET` niet meer naar de browser te
lekken:

- De twee client-getriggerde routes (`/api/cron/news`, `/api/cron/reset-today`)
  accepteren voortaan **een geldige ingelogde sessie OF** de `CRON_SECRET`
  header (voor Vercel-cron).
- De client roept deze routes aan op basis van de sessie-cookie (geen secret in
  de header meer).
- `NEXT_PUBLIC_CRON_SECRET` wordt uit de client-code verwijderd.
- De server-side geplande routes (`/api/cron/profile`, `/api/cron/cleanup`)
  blijven `CRON_SECRET` gebruiken — ongewijzigd.

## Buiten scope (bewust)

- Wachtwoord-reset via e-mail.
- Publieke registratiepagina.
- Per-gebruiker nieuwsscoring in n8n.

Het datamodel is op deze uitbreidingen voorbereid, maar ze worden nu niet
gebouwd.

## Verificatie

Conform `CLAUDE.md` (`verification-before-completion`):

- `npm run build` en `npm run lint` draaien, output tonen.
- Loginflow handmatig doorlopen: inloggen lukt, niet-ingelogd wordt
  geredirect naar `/login`, logout werkt, feedback plaatsen koppelt aan
  `user_id`.
- Bewijs (output/screenshots) tonen voordat iets "klaar" wordt genoemd.
