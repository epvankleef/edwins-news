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

-- Vervang de standalone-unique op news_item_id door een composiet (user_id, news_item_id),
-- zodat meerdere gebruikers later hetzelfde artikel kunnen beoordelen.
alter table public.user_feedback drop constraint if exists user_feedback_news_item_id_unique;
create unique index if not exists user_feedback_user_item_uidx
  on public.user_feedback (user_id, news_item_id);

-- 2. user_profile: user_id-kolom (id=1 blijft de globale scorer-rij) ---------
alter table public.user_profile
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

update public.user_profile
set user_id = (select id from auth.users where email = 'epvankleef@gmail.com')
where user_id is null;

-- id=1-restrictie (constraint "single_row") laten vervallen zodat er later meer profielrijen kunnen zijn
alter table public.user_profile drop constraint if exists single_row;

-- 3. RLS aanscherpen ---------------------------------------------------------
-- Verwijder de bestaande publieke (anon) policies (werkelijke namen in de live-DB).
drop policy if exists "news_items_public_read"    on public.news_items;
drop policy if exists "news_items_service_insert" on public.news_items;
drop policy if exists "user_feedback_public_all"  on public.user_feedback;
drop policy if exists "user_profile_public_read"  on public.user_profile;
drop policy if exists "user_profile_public_upsert" on public.user_profile;

-- news_items: lezen alleen voor ingelogde gebruikers
create policy "news_items leesbaar voor ingelogden"
  on public.news_items for select
  to authenticated
  using (true);

-- user_profile: ingelogde gebruikers mogen profielen lezen (globale scorer-rij gedeeld)
create policy "user_profile leesbaar voor ingelogden"
  on public.user_profile for select
  to authenticated
  using (true);

-- user_feedback: alleen je eigen rijen, en alleen ingelogd
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
