-- Banjara Connect profile privacy hardening
-- Applied to Supabase project yymzfjfkmsrymqhpnfqz.
-- Client roles cannot query public.profiles directly; safe profile data is exposed only through authenticated RPCs.

create or replace function public.get_my_profile()
returns table (
  id uuid, name text, college text, avatar_url text, created_at timestamptz,
  updated_at timestamptz, username text, state text, city text, area text,
  bio text, cover_url text, is_online boolean, last_seen_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select p.id,p.name,p.college,p.avatar_url,p.created_at,p.updated_at,p.username,
         p.state,p.city,p.area,p.bio,p.cover_url,p.is_online,p.last_seen_at
  from public.profiles p
  where p.id = (select auth.uid()) limit 1;
$$;

create or replace function public.get_public_profiles(
  p_ids uuid[] default null, p_limit integer default 60
)
returns table (
  id uuid, name text, college text, avatar_url text, created_at timestamptz,
  updated_at timestamptz, username text, state text, city text, area text,
  bio text, cover_url text, is_online boolean, last_seen_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select p.id,p.name,p.college,p.avatar_url,p.created_at,p.updated_at,p.username,
         p.state,p.city,p.area,p.bio,p.cover_url,p.is_online,p.last_seen_at
  from public.profiles p
  where p.id <> (select auth.uid())
    and (p_ids is null or p.id = any(p_ids))
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit,60),100));
$$;

create or replace function public.update_my_profile(p_name text, p_bio text)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return false; end if;
  if length(btrim(coalesce(p_name,''))) = 0 or length(p_name) > 120 or length(p_bio) > 5000 then return false; end if;
  update public.profiles
     set name=btrim(p_name), bio=coalesce(p_bio,''), updated_at=now()
   where id=(select auth.uid());
  return found;
end;
$$;

create or replace function public.touch_my_presence()
returns boolean language sql security definer set search_path = ''
as $$
  update public.profiles
     set is_online=true, last_seen_at=now(), updated_at=now()
   where id=(select auth.uid())
  returning true;
$$;

revoke all on table public.profiles from public, anon, authenticated;
revoke execute on function public.get_my_profile() from public, anon;
revoke execute on function public.get_public_profiles(uuid[], integer) from public, anon;
revoke execute on function public.update_my_profile(text, text) from public, anon;
revoke execute on function public.touch_my_presence() from public, anon;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.get_public_profiles(uuid[], integer) to authenticated;
grant execute on function public.update_my_profile(text, text) to authenticated;
grant execute on function public.touch_my_presence() to authenticated;