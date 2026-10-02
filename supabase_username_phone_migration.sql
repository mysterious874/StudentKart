-- StudentKart profile fields + self-service RLS policies
-- Run once in Supabase SQL Editor.

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists state text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists area text;

create unique index if not exists profiles_username_lower_unique
on public.profiles (lower(username))
where username is not null and btrim(username) <> '';

create index if not exists profiles_phone_search_idx on public.profiles (phone);
create index if not exists profiles_email_search_idx on public.profiles (lower(email));
create index if not exists profiles_username_search_idx on public.profiles (lower(username));
create index if not exists profiles_name_search_idx on public.profiles (lower(name));

-- Allow a logged-in student to manage only their own profile row.
-- These blocks are safe to run even if the policies already exist.
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'profiles'
          and policyname = 'studentkart_profiles_select_own'
    ) then
        create policy studentkart_profiles_select_own
        on public.profiles
        for select
        to authenticated
        using (auth.uid() = id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'profiles'
          and policyname = 'studentkart_profiles_insert_own'
    ) then
        create policy studentkart_profiles_insert_own
        on public.profiles
        for insert
        to authenticated
        with check (auth.uid() = id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'profiles'
          and policyname = 'studentkart_profiles_update_own'
    ) then
        create policy studentkart_profiles_update_own
        on public.profiles
        for update
        to authenticated
        using (auth.uid() = id)
        with check (auth.uid() = id);
    end if;
end
$$;
