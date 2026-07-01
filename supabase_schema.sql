-- ============================================================
-- WTL66998 site content table + policies
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

-- 1. Table
create table if not exists site_content (
  key         text primary key,        -- e.g. 'rules_ta', 'rules_en'
  value       jsonb not null,          -- the actual content (array, object, string...)
  updated_at  timestamptz not null default now()
);

-- 2. Row Level Security (RLS) must be ON, then we add policies.
alter table site_content enable row level security;

-- 3. Policies: this is a public community page, so every visitor's
--    browser (using the public "anon" key) is allowed to read AND write.
--    The in-page password is just a UI gate for convenience -- it is
--    NOT real server-side security. See the README for hardening tips
--    if you need real authentication later.
drop policy if exists "Public read access"   on site_content;
drop policy if exists "Public insert access" on site_content;
drop policy if exists "Public update access" on site_content;
drop policy if exists "Public delete access" on site_content;

create policy "Public read access"
  on site_content for select
  using (true);

create policy "Public insert access"
  on site_content for insert
  with check (true);

create policy "Public update access"
  on site_content for update
  using (true);

create policy "Public delete access"
  on site_content for delete
  using (true);

-- 4. Seed the two rows the page expects (safe to re-run; won't overwrite existing data)
insert into site_content (key, value) values
  ('rules_ta', '[]'::jsonb),
  ('rules_en', '[]'::jsonb)
on conflict (key) do nothing;

-- 5. (Optional) Enable Realtime so edits appear instantly on every open tab,
--    without needing a page refresh. In the Supabase Dashboard:
--    Database -> Replication -> toggle "site_content" ON for the
--    "supabase_realtime" publication. (New projects usually have this on
--    by default for all tables; the app works fine even without it --
--    visitors will just see the latest content on their next page load.)
