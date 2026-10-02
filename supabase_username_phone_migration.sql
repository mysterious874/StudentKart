-- StudentKart user discovery fields
-- Run once in Supabase SQL Editor.

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists phone text;

create unique index if not exists profiles_username_lower_unique
on public.profiles (lower(username))
where username is not null and btrim(username) <> '';

create index if not exists profiles_phone_search_idx on public.profiles (phone);
create index if not exists profiles_email_search_idx on public.profiles (lower(email));
create index if not exists profiles_username_search_idx on public.profiles (lower(username));
create index if not exists profiles_name_search_idx on public.profiles (lower(name));
