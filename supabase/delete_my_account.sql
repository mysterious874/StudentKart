-- StudentKart account deletion RPC
-- Run this once in Supabase SQL Editor before using Settings > Delete Account.
-- The Auth user is deleted only for the currently authenticated caller.
-- Public tables should reference auth.users(id) with ON DELETE CASCADE
-- for automatic cleanup of that user's related rows.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;

    delete from auth.users
    where id = auth.uid();

    if not found then
        raise exception 'Account not found';
    end if;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
