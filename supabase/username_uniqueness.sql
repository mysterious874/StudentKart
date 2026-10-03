-- StudentKart username uniqueness
-- Run once in Supabase SQL Editor.
-- Usernames are case-insensitive: Harish, harish and HARISH are the same.

create unique index if not exists profiles_username_unique_lower
on public.profiles (lower(trim(username)))
where username is not null and trim(username) <> '';

alter table public.profiles
    drop constraint if exists profiles_username_format_check;

alter table public.profiles
    add constraint profiles_username_format_check
    check (
        username is null
        or username = ''
        or username ~ '^[a-zA-Z0-9._]{3,30}$'
    );
