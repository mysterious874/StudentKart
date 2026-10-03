-- StudentKart Campus Verification — Admin Security
-- Run AFTER campus-verification.sql

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "Admins can view admin membership" on public.admin_users;
create policy "Admins can view admin membership"
  on public.admin_users
  for select
  to authenticated
  using (user_id = auth.uid());

-- Users must never be able to change verification status themselves.
drop policy if exists "Users can update their pending verification"
  on public.campus_verifications;

-- Admins can review every verification.
drop policy if exists "Admins can view campus verifications"
  on public.campus_verifications;
create policy "Admins can view campus verifications"
  on public.campus_verifications
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users
      where admin_users.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can update campus verifications"
  on public.campus_verifications;
create policy "Admins can update campus verifications"
  on public.campus_verifications
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users
      where admin_users.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.admin_users
      where admin_users.user_id = auth.uid()
    )
  );

-- Admins can securely view private student-ID images.
drop policy if exists "Admins can view student IDs"
  on storage.objects;
create policy "Admins can view student IDs"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'student-ids'
    and exists (
      select 1
      from public.admin_users
      where admin_users.user_id = auth.uid()
    )
  );

-- Helper:
-- 1. Login to StudentKart with your admin account.
-- 2. In Supabase SQL Editor run:
--    select id, email from auth.users order by created_at;
-- 3. Copy YOUR user id and run:
--    insert into public.admin_users (user_id) values ('YOUR-UUID-HERE')
--    on conflict (user_id) do nothing;
