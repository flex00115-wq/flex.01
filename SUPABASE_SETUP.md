# Supabase Free Tier Setup for FLEX (Real-Time Multi-Device Sync)

FLEX uses **Supabase Postgres + Supabase Storage + Supabase Realtime** so every Admin upload, price edit, stock update, publish toggle, reorder, and deletion syncs immediately across all customers and devices.

If Supabase environment variables are not configured, FLEX automatically falls back to browser IndexedDB.

---

## Step 1: Run This SQL in Supabase SQL Editor (10 Seconds)

Open your Supabase project -> **SQL Editor** -> **New query**, paste the entire script below, and click **Run**:

```sql
-- 1. Create the FLEX cards table
create table if not exists public.cards (
  id text primary key,
  serial integer not null,
  name text not null,
  category text not null,
  price_bdt integer,
  publish_status text not null default 'published' check (publish_status in ('published', 'draft')),
  stock_status text not null default 'available' check (stock_status in ('available', 'sold', 'out_of_stock')),
  rarity text not null default 'Rare',
  set_name text not null default 'Base Set',
  condition text not null default 'Near Mint',
  description text,
  display_order integer not null,
  image_url text not null default '',
  phash jsonb,
  embedding jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cards_display_order_serial_idx
  on public.cards (display_order asc, serial asc);

create index if not exists cards_publish_status_idx
  on public.cards (publish_status);

-- 2. Enable Realtime broadcasts for INSERT, UPDATE, and DELETE
alter table public.cards replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cards'
  ) then
    alter publication supabase_realtime add table public.cards;
  end if;
end $$;

-- 3. Enable Row Level Security (RLS) & policies for public storefront + Admin sync
alter table public.cards enable row level security;

drop policy if exists "Public can read cards" on public.cards;
create policy "Public can read cards"
  on public.cards
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can insert cards" on public.cards;
create policy "Public can insert cards"
  on public.cards
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public can update cards" on public.cards;
create policy "Public can update cards"
  on public.cards
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Public can delete cards" on public.cards;
create policy "Public can delete cards"
  on public.cards
  for delete
  to anon, authenticated
  using (true);

-- 4. Create the public "card-images" Storage bucket for WebP card uploads
insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do update set public = true;

-- 5. Storage bucket policies for "card-images"
drop policy if exists "Public read access for card-images" on storage.objects;
create policy "Public read access for card-images"
  on storage.objects
  for select
  to public
  using (bucket_id = 'card-images');

drop policy if exists "Anon upload access for card-images" on storage.objects;
create policy "Anon upload access for card-images"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'card-images');

drop policy if exists "Anon update access for card-images" on storage.objects;
create policy "Anon update access for card-images"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'card-images')
  with check (bucket_id = 'card-images');

drop policy if exists "Anon delete access for card-images" on storage.objects;
create policy "Anon delete access for card-images"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'card-images');
```

---

## Step 2: Add Your Two Supabase Keys

In Supabase, go to **Project Settings -> Data API / API Keys** and copy:

- `VITE_SUPABASE_URL` (your Project URL, e.g. `https://xyzcompany.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` (your `anon` / `public` key)

Set both in your `.env` file (or hosting environment variables / Secrets panel) and rebuild or restart the app:

```env
VITE_SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
```

Once both variables are set, any card added, priced, edited, reordered, or deleted in **Admin** uploads its compressed WebP image to `card-images` and syncs live across every open browser and customer device.
