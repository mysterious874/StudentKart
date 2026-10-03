-- StudentKart Campus Verification
-- Safe to run more than once.

create table if not exists public.campus_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campus text not null,
  student_name text,
  student_id text,
  id_image_path text not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  rejection_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campus_verifications_user_id_idx
  on public.campus_verifications(user_id);

create index if not exists campus_verifications_status_idx
  on public.campus_verifications(status);

alter table public.campus_verifications enable row level security;

drop policy if exists "Users can view their campus verifications"
  on public.campus_verifications;
create policy "Users can view their campus verifications"
  on public.campus_verifications
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can submit campus verification"
  on public.campus_verifications;
create policy "Users can submit campus verification"
  on public.campus_verifications
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their pending verification"
  on public.campus_verifications;
create policy "Users can update their pending verification"
  on public.campus_verifications
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('student-ids', 'student-ids', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload their student ID"
  on storage.objects;
create policy "Users can upload their student ID"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'student-ids'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can view their student ID"
  on storage.objects;
create policy "Users can view their student ID"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'student-ids'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can replace their student ID"
  on storage.objects;
create policy "Users can replace their student ID"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'student-ids'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'student-ids'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
