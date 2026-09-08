-- Museum of Us — Supabase schema
-- Run this once in Supabase: Project → SQL Editor → New query → paste all of this → Run.

-- Needed for gen_random_uuid() / gen_random_bytes()
create extension if not exists pgcrypto;

-- One row per gift gallery someone creates.
create table if not exists museums (
  id uuid primary key default gen_random_uuid(),
  edit_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  title text not null default 'Museum of Us',
  settings jsonb not null default '{}'::jsonb
);

-- One row per photo frame inside a museum.
create table if not exists artworks (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references museums(id) on delete cascade,
  display_order int not null default 0,
  frame int,
  pos_x numeric,
  pos_y numeric,
  width numeric,
  rotation numeric,
  side text,
  title text not null default '',
  medium text not null default 'Photograph',
  year text not null default '2026',
  note text not null default '',
  image_path text,
  img_fit jsonb,
  created_at timestamptz not null default now()
);

create index if not exists artworks_museum_id_idx on artworks (museum_id);

-- Row Level Security: on, with NO public policies.
-- All reads and writes go through our Vercel API routes, which use the
-- Supabase service-role key (server-side only, never sent to browsers) and
-- so bypass RLS entirely. This keeps the edit_token check in one place
-- (our API code) instead of split between Postgres policies and app logic.
alter table museums enable row level security;
alter table artworks enable row level security;

-- Storage bucket for uploaded photos. Public read (so gift links can load
-- images directly by URL); uploads only ever happen via the API routes
-- using the service-role key, never directly from a browser.
insert into storage.buckets (id, name, public)
values ('museum-photos', 'museum-photos', true)
on conflict (id) do nothing;
