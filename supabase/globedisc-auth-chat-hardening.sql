-- GlobeDisc auth/chat hardening
-- Apply in Supabase SQL Editor for the active project.

alter table public.profiles enable row level security;

create unique index if not exists profiles_phone_unique
on public.profiles (phone)
where phone is not null and btrim(phone) <> '';

create index if not exists profiles_phone_prefix_idx
on public.profiles (phone);

create or replace function public.search_chat_users_by_phone(search_query text)
returns table (
  id uuid,
  name text,
  username text,
  phone text,
  area text,
  city text,
  avatar_url text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name, p.username, p.phone, p.area, p.city, p.avatar_url
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and regexp_replace(coalesce(p.phone,''), '\\D', '', 'g')
        like regexp_replace(coalesce(search_query,''), '\\D', '', 'g') || '%'
  order by p.name nulls last
  limit 10;
$$;

revoke all on function public.search_chat_users_by_phone(text) from public;
revoke execute on function public.search_chat_users_by_phone(text) from anon;
grant execute on function public.search_chat_users_by_phone(text) to authenticated;

comment on function public.search_chat_users_by_phone(text)
is 'Authenticated-only prefix search for starting a GlobeDisc chat by registered mobile number.';
