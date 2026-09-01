-- Ridge audio library
-- ============================================================================
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query -> paste -> Run). It is safe to run twice.
--
-- What this sets up: a catalogue of tracks that any device can browse, download
-- once, and then play offline forever. The audio itself stays in Storage; this
-- table is only the index.
--
-- SECURITY, stated plainly. These policies grant read access to the `anon`
-- role, which means the project's anon key is effectively a password for this
-- bucket. Anyone holding it can list and download your tracks. Do not commit it
-- and do not paste it anywhere public — the Ridge repository is public, and a
-- key in a repository is a key on the internet. It is typed into the app on
-- each device and stored only there.
-- ============================================================================

create table if not exists public.tracks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  category     text not null default 'Uncategorised',
  -- Free text on purpose: 'CC0', 'CC-BY Alexander Nakarada', 'personal'.
  -- Recording it at the catalogue means you can still answer "where did this
  -- come from" in a year, which is the question that actually matters.
  licence      text not null default 'personal',
  -- Full object path including the bucket, e.g. 'Musics/my track.mp3'.
  storage_path text not null unique,
  bytes        bigint not null default 0,
  duration_sec real,
  -- The TrackAnalysis computed by the first device to download this track:
  -- loop points, trim, energy envelope, busyness, gain. Written back so no
  -- other device ever has to decode the file again.
  analysis     jsonb,
  created_at   timestamptz not null default now()
);

alter table public.tracks enable row level security;

drop policy if exists "anon reads the catalogue" on public.tracks;
create policy "anon reads the catalogue"
  on public.tracks for select to anon using (true);

-- Only the analysis column is ever written from the app. Restricting the
-- policy to updates that leave everything else alone would need a trigger;
-- for a single-user catalogue the update grant is proportionate, and nothing
-- in the client writes any other field.
drop policy if exists "anon writes back analysis" on public.tracks;
create policy "anon writes back analysis"
  on public.tracks for update to anon using (true) with check (true);

-- Storage: let anon read objects in the bucket, which stays private otherwise.
drop policy if exists "anon downloads music" on storage.objects;
create policy "anon downloads music"
  on storage.objects for select to anon
  using (bucket_id = 'Musics');

-- ---------------------------------------------------------------------------
-- Columns the streaming library needs.
-- Separate ALTERs so this file stays safe to re-run over an existing table.
-- ---------------------------------------------------------------------------
alter table public.tracks add column if not exists source_url text;
alter table public.tracks add column if not exists pinned boolean not null default false;

-- ---------------------------------------------------------------------------
-- Auto-catalogue: anything landing in the bucket becomes a row.
--
-- Without this, adding a sound means uploading the file AND writing an insert,
-- and the insert is the step people forget — leaving audio in storage that the
-- app cannot see. The title is derived from the filename and can be edited
-- afterwards; category defaults to Uncategorised so it is obvious what still
-- needs sorting.
-- ---------------------------------------------------------------------------
create or replace function public.catalogue_new_object()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.bucket_id <> 'Musics' then
    return new;
  end if;

  insert into public.tracks (title, storage_path, bytes)
  values (
    -- Filename without its extension, underscores and dashes opened out.
    regexp_replace(
      regexp_replace(split_part(new.name, '/', -1), '\.[A-Za-z0-9]+$', ''),
      '[_-]+', ' ', 'g'
    ),
    new.bucket_id || '/' || new.name,
    coalesce((new.metadata->>'size')::bigint, 0)
  )
  on conflict (storage_path) do nothing;

  return new;
end;
$$;

drop trigger if exists catalogue_new_object on storage.objects;
create trigger catalogue_new_object
  after insert on storage.objects
  for each row execute function public.catalogue_new_object();

-- The function is SECURITY DEFINER, which makes it callable at
-- /rest/v1/rpc/catalogue_new_object by anyone holding the anon key. Postgres
-- does not check EXECUTE when firing a trigger, so revoking closes that
-- endpoint without affecting the trigger at all. Supabase's security linter
-- flags this if it is missing.
revoke execute on function public.catalogue_new_object() from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- Seed the three files already in the bucket. Adjust the category and licence
-- to whatever is true; `on conflict do nothing` makes re-running harmless.
-- ---------------------------------------------------------------------------
insert into public.tracks (title, category, licence, storage_path, bytes) values
  ('Golden Kingdoms pt1', 'Medieval', 'personal',
   'Musics/Relaxing medieval music golden kingdoms pt1.mp3', 34561924),
  ('Golden Kingdoms pt2', 'Medieval', 'personal',
   'Musics/Relaxing medieval music golden kingdoms pt2.mp3', 34677281),
  ('Golden Kingdoms pt3', 'Medieval', 'personal',
   'Musics/Relaxing medieval music golden kingdoms pt3.mp3', 37638313)
on conflict (storage_path) do nothing;

-- ---------------------------------------------------------------------------
-- Adding more later: paste a link into Ridge (Settings -> Library -> Add by
-- link). The `ingest` Edge Function fetches it server-side, stores it, and the
-- trigger above catalogues it. Nothing needs writing by hand.
--
-- Deploy the function once with:
--   supabase functions deploy ingest --project-ref snmpnpuwtojwvsqpdwap
--
-- Uploading through the dashboard still works and is still catalogued; only
-- the title and category are then worth editing afterwards.
-- ---------------------------------------------------------------------------
