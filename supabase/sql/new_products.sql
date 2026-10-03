-- StudentKart: New Products catalog
-- Run this once in Supabase SQL Editor.

create table if not exists public.new_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('electronics','books','fashion','home','gaming')),
  price numeric(12,2) not null default 0 check (price >= 0),
  source text not null,
  image text,
  url text not null,
  created_at timestamptz not null default now()
);

alter table public.new_products enable row level security;

drop policy if exists "New products are publicly readable" on public.new_products;
create policy "New products are publicly readable"
on public.new_products
for select
using (true);

drop policy if exists "Admins can add new products" on public.new_products;
create policy "Admins can add new products"
on public.new_products
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_users au
    where au.id = auth.uid()
  )
);

drop policy if exists "Admins can update new products" on public.new_products;
create policy "Admins can update new products"
on public.new_products
for update
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where au.id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.admin_users au
    where au.id = auth.uid()
  )
);

drop policy if exists "Admins can delete new products" on public.new_products;
create policy "Admins can delete new products"
on public.new_products
for delete
to authenticated
using (
  exists (
    select 1
    from public.admin_users au
    where au.id = auth.uid()
  )
);

create index if not exists new_products_category_idx on public.new_products(category);
create index if not exists new_products_created_at_idx on public.new_products(created_at desc);
