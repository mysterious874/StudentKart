-- StudentKart campus verification MVP
-- Run once in Supabase SQL Editor.
-- Existing profile "college" is treated as the campus value.

create table if not exists public.campus_verifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    campus text not null,
    document_path text not null,
    status text not null default 'pending' check (status in ('pending','approved','rejected')),
    rejection_reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists campus_verifications_user_idx
    on public.campus_verifications(user_id, created_at desc);

alter table public.campus_verifications enable row level security;

drop policy if exists "campus_verifications_select_own" on public.campus_verifications;
create policy "campus_verifications_select_own"
on public.campus_verifications for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "campus_verifications_insert_own" on public.campus_verifications;
create policy "campus_verifications_insert_own"
on public.campus_verifications for insert
to authenticated
with check (auth.uid() = user_id);

-- No client UPDATE/DELETE policy: approval must be performed by an admin/service role.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'student-id-cards',
    'student-id-cards',
    false,
    5242880,
    array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update set
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "student_id_cards_insert_own" on storage.objects;
create policy "student_id_cards_insert_own"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'student-id-cards'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
);

drop policy if exists "student_id_cards_select_own" on storage.objects;
create policy "student_id_cards_select_own"
on storage.objects for select
to authenticated
using (
    bucket_id = 'student-id-cards'
    and owner_id = (select auth.uid())
);
