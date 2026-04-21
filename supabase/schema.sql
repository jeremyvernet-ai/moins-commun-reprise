-- Extensions
create extension if not exists pgcrypto;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Artists
create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  bio text,
  country text,
  image_url text,
  created_at timestamptz not null default now()
);

-- Songs
create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist_id uuid not null references public.artists(id) on delete cascade,
  year integer,
  genre text,
  cover_url text,
  description text,
  youtube_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists songs_title_artist_id_idx on public.songs(title, artist_id);
create index if not exists songs_year_idx on public.songs(year);
create index if not exists songs_genre_idx on public.songs(genre);

-- Relationships between songs
create table if not exists public.song_relationships (
  id uuid primary key default gen_random_uuid(),
  source_song_id uuid not null references public.songs(id) on delete cascade,
  target_song_id uuid not null references public.songs(id) on delete cascade,
  relation_type text not null check (relation_type in ('sampled','covered','interpolated','remixed')),
  note text,
  created_at timestamptz not null default now(),
  constraint no_self_relation check (source_song_id <> target_song_id),
  unique(source_song_id, target_song_id, relation_type)
);

-- Favorites
create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, song_id)
);

-- Trigger to create profile after signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1) || '-' || substr(new.id::text, 1, 6)),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Public views
create or replace view public.song_details as
select
  s.id,
  s.title,
  s.year,
  s.genre,
  s.cover_url,
  s.description,
  s.youtube_url,
  s.created_at,
  a.id as artist_id,
  a.name as artist_name,
  a.country as artist_country
from public.songs s
join public.artists a on a.id = s.artist_id;

-- RLS
alter table public.profiles enable row level security;
alter table public.artists enable row level security;
alter table public.songs enable row level security;
alter table public.song_relationships enable row level security;
alter table public.favorites enable row level security;

-- Profiles policies
create policy "profiles are readable by everyone"
on public.profiles for select
using (true);

create policy "users can update their own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Artists policies
create policy "artists readable by everyone"
on public.artists for select
using (true);

create policy "admins can insert artists"
on public.artists for insert
to authenticated
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create policy "admins can update artists"
on public.artists for update
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create policy "admins can delete artists"
on public.artists for delete
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- Songs policies
create policy "songs readable by everyone"
on public.songs for select
using (true);

create policy "admins can insert songs"
on public.songs for insert
to authenticated
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create policy "admins can update songs"
on public.songs for update
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create policy "admins can delete songs"
on public.songs for delete
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- Relationships policies
create policy "relationships readable by everyone"
on public.song_relationships for select
using (true);

create policy "admins can insert relationships"
on public.song_relationships for insert
to authenticated
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create policy "admins can update relationships"
on public.song_relationships for update
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create policy "admins can delete relationships"
on public.song_relationships for delete
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- Favorites policies
create policy "users can read their favorites"
on public.favorites for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert their favorites"
on public.favorites for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can delete their favorites"
on public.favorites for delete
to authenticated
using (auth.uid() = user_id);

-- Seed data
insert into public.artists (name, country, bio)
values
  ('Kanye West', 'USA', 'Rap, hip-hop et production.'),
  ('Daft Punk', 'France', 'Duo emblématique de la musique électronique.'),
  ('Stevie Wonder', 'USA', 'Icône soul, funk et pop.'),
  ('Coolio', 'USA', 'Rappeur connu pour Gangsta''s Paradise.')
on conflict (name) do nothing;

with artist_rows as (
  select id, name from public.artists where name in ('Kanye West','Daft Punk','Stevie Wonder','Coolio')
)
insert into public.songs (title, artist_id, year, genre, description, youtube_url)
select 'Stronger', id, 2007, 'Hip-Hop', 'Titre contenant un sample très connu de Daft Punk.', 'https://www.youtube.com/watch?v=PsO6ZnUZI0g'
from artist_rows where name = 'Kanye West'
on conflict (title, artist_id) do nothing;

with artist_rows as (
  select id, name from public.artists where name in ('Kanye West','Daft Punk','Stevie Wonder','Coolio')
)
insert into public.songs (title, artist_id, year, genre, description, youtube_url)
select 'Harder, Better, Faster, Stronger', id, 2001, 'Electronic', 'Classique électronique samplé par Kanye West.', 'https://www.youtube.com/watch?v=gAjR4_CbPpQ'
from artist_rows where name = 'Daft Punk'
on conflict (title, artist_id) do nothing;

with artist_rows as (
  select id, name from public.artists where name in ('Kanye West','Daft Punk','Stevie Wonder','Coolio')
)
insert into public.songs (title, artist_id, year, genre, description, youtube_url)
select 'Gangsta''s Paradise', id, 1995, 'Hip-Hop', 'Hit de Coolio inspiré d''un morceau de Stevie Wonder.', 'https://www.youtube.com/watch?v=fPO76Jlnz6c'
from artist_rows where name = 'Coolio'
on conflict (title, artist_id) do nothing;

with artist_rows as (
  select id, name from public.artists where name in ('Kanye West','Daft Punk','Stevie Wonder','Coolio')
)
insert into public.songs (title, artist_id, year, genre, description, youtube_url)
select 'Pastime Paradise', id, 1976, 'Soul', 'Titre original de Stevie Wonder.', 'https://www.youtube.com/watch?v=_H3Sv2zad6s'
from artist_rows where name = 'Stevie Wonder'
on conflict (title, artist_id) do nothing;

insert into public.song_relationships (source_song_id, target_song_id, relation_type, note)
select s1.id, s2.id, 'sampled', 'Exemple de sample fondateur du catalogue.'
from public.songs s1
join public.songs s2 on s2.title = 'Harder, Better, Faster, Stronger'
where s1.title = 'Stronger'
on conflict do nothing;

insert into public.song_relationships (source_song_id, target_song_id, relation_type, note)
select s1.id, s2.id, 'covered', 'Exemple d''inspiration/reprise dans la base de départ.'
from public.songs s1
join public.songs s2 on s2.title = 'Pastime Paradise'
where s1.title = 'Gangsta''s Paradise'
on conflict do nothing;

-- Storage policies for bucket "covers"
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

drop policy if exists "Public can view covers" on storage.objects;
drop policy if exists "Admins can upload covers" on storage.objects;
drop policy if exists "Admins can update covers" on storage.objects;
drop policy if exists "Admins can delete covers" on storage.objects;

create policy "Public can view covers"
on storage.objects for select
using (bucket_id = 'covers');

create policy "Admins can upload covers"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'covers'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

create policy "Admins can update covers"
on storage.objects for update
to authenticated
using (
  bucket_id = 'covers'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
)
with check (
  bucket_id = 'covers'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

create policy "Admins can delete covers"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'covers'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);
