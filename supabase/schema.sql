-- ============================================================
-- I News Digest — Supabase Schema
-- Voer dit uit in de Supabase SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. news_items
--    Gescoorde artikelen, elke ochtend ingeladen door n8n
-- ------------------------------------------------------------
create table public.news_items (
  id            uuid primary key default gen_random_uuid(),
  title         text        not null,
  summary       text,
  url           text        not null unique,
  source        text        not null,  -- bijv. 'TechCrunch', 'Anthropic'
  category      text        not null,  -- zie categorieën hieronder
  score         smallint    not null check (score between 1 and 10),
  published_at  timestamptz not null,
  fetched_at    timestamptz not null default now()
);

-- Categorieën (ter referentie, niet afgedwongen als enum zodat je makkelijk kunt uitbreiden):
-- 'bedrijfsblog' | 'nieuwssite' | 'ai-media' | 'community' | 'aggregator' | 'academisch'

create index on public.news_items (fetched_at desc);
create index on public.news_items (score desc);

-- ------------------------------------------------------------
-- 2. user_profile
--    Één rij: het actuele voorkeursprofiel in platte tekst
-- ------------------------------------------------------------
create table public.user_profile (
  id            integer primary key default 1 check (id = 1),  -- altijd 1 rij
  profile_text  text        not null default '',
  updated_at    timestamptz not null default now()
);

-- Voeg de beginrij in (lege profieltekst, n8n overschrijft dit later)
insert into public.user_profile (id, profile_text) values (1, '');

-- ------------------------------------------------------------
-- 3. user_feedback
--    Beoordelingen per artikel door de gebruiker
-- ------------------------------------------------------------
create table public.user_feedback (
  id            uuid primary key default gen_random_uuid(),
  news_item_id  uuid        not null references public.news_items (id) on delete cascade,
  rating        text        not null check (rating in ('up', 'neutral', 'down')),
  reason        text,                  -- optionele toelichting
  created_at    timestamptz not null default now()
);

create index on public.user_feedback (news_item_id);
create index on public.user_feedback (created_at desc);

-- Handige view: hoeveel nieuwe feedback sinds de laatste profielupdate?
create view public.feedback_since_last_update as
select count(*) as nieuwe_beoordelingen
from public.user_feedback f
cross join public.user_profile p
where f.created_at > p.updated_at;

-- ============================================================
-- Row Level Security
-- n8n gebruikt de service role key (bypass RLS)
-- Frontend gebruikt de anon key (alleen lezen + feedback plaatsen)
-- ============================================================
alter table public.news_items   enable row level security;
alter table public.user_profile enable row level security;
alter table public.user_feedback enable row level security;

-- news_items: iedereen mag lezen (anon)
create policy "Artikelen zijn publiek leesbaar"
  on public.news_items for select
  using (true);

-- user_profile: iedereen mag lezen (anon)
create policy "Profiel is publiek leesbaar"
  on public.user_profile for select
  using (true);

-- user_feedback: iedereen mag invoegen (anon), niemand mag lezen via frontend
create policy "Feedback mag worden ingevoegd"
  on public.user_feedback for insert
  with check (true);
