-- Banjara Connect security hardening applied to the live Supabase project.
-- This file mirrors the RLS changes so the repository keeps an auditable record.

create or replace function private.can_view_post(p_post_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from posts p
    where p.id = p_post_id
      and (
        p.visibility = 'public'
        or p.author_id = (select auth.uid())
        or (p.visibility = 'community' and exists (
          select 1 from community_members cm
          where cm.community_id = p.community_id and cm.user_id = (select auth.uid())
        ))
        or (p.visibility = 'connections' and (
          p.author_id = (select auth.uid())
          or exists (
            select 1 from connections c
            where c.status = 'accepted'
              and (
                (c.requester_id = (select auth.uid()) and c.addressee_id = p.author_id)
                or (c.addressee_id = (select auth.uid()) and c.requester_id = p.author_id)
              )
          )
        ))
      )
  );
$$;

revoke all on function private.can_view_post(uuid) from public, anon, authenticated;

drop policy if exists "members read" on public.community_members;
create policy "members read visible communities" on public.community_members for select
to authenticated using (
  exists (
    select 1 from communities c
    where c.id = community_members.community_id
      and (
        c.is_public or c.created_by = (select auth.uid())
        or exists (select 1 from community_members me where me.community_id=c.id and me.user_id=(select auth.uid()))
      )
  )
);

drop policy if exists "members self join" on public.community_members;
create policy "members join public or owned community" on public.community_members for insert
to authenticated with check (
  user_id=(select auth.uid())
  and exists (select 1 from communities c where c.id=community_members.community_id and (c.is_public or c.created_by=(select auth.uid())))
);

drop policy if exists "members self leave" on public.community_members;
create policy "members self leave" on public.community_members for delete
to authenticated using (user_id=(select auth.uid()));

drop policy if exists "posts author create" on public.posts;
create policy "posts author create authorized" on public.posts for insert
to authenticated with check (
  author_id=(select auth.uid())
  and (community_id is null or exists (
    select 1 from community_members cm where cm.community_id=posts.community_id and cm.user_id=(select auth.uid())
  ))
  and (visibility <> 'community' or community_id is not null)
);

drop policy if exists "posts author update" on public.posts;
create policy "posts author update authorized" on public.posts for update
to authenticated using (author_id=(select auth.uid()))
with check (
  author_id=(select auth.uid())
  and (community_id is null or exists (
    select 1 from community_members cm where cm.community_id=posts.community_id and cm.user_id=(select auth.uid())
  ))
);

drop policy if exists "posts author delete" on public.posts;
create policy "posts author delete" on public.posts for delete
to authenticated using (author_id=(select auth.uid()));

drop policy if exists "comments public read" on public.comments;
create policy "comments read visible posts" on public.comments for select
to authenticated using (private.can_view_post(post_id));

drop policy if exists "comments self create" on public.comments;
create policy "comments self create visible post" on public.comments for insert
to authenticated with check (user_id=(select auth.uid()) and private.can_view_post(post_id));

drop policy if exists "comments self update" on public.comments;
create policy "comments self update" on public.comments for update
to authenticated using (user_id=(select auth.uid()) and private.can_view_post(post_id))
with check (user_id=(select auth.uid()) and private.can_view_post(post_id));

drop policy if exists "comments self delete" on public.comments;
create policy "comments self delete" on public.comments for delete
to authenticated using (user_id=(select auth.uid()));

drop policy if exists "comments read" on public.post_comments;
create policy "post_comments read visible posts" on public.post_comments for select
to authenticated using (private.can_view_post(post_id));

drop policy if exists "comments self create" on public.post_comments;
create policy "post_comments self create visible post" on public.post_comments for insert
to authenticated with check (auth.uid()=user_id and private.can_view_post(post_id));

drop policy if exists "comments self update" on public.post_comments;
create policy "post_comments self update visible post" on public.post_comments for update
to authenticated using (auth.uid()=user_id and private.can_view_post(post_id))
with check (auth.uid()=user_id and private.can_view_post(post_id));

drop policy if exists "comments self delete" on public.post_comments;
create policy "post_comments self delete" on public.post_comments for delete
to authenticated using (auth.uid()=user_id);

drop policy if exists "events public read" on public.events;
create policy "events visible communities" on public.events for select
to authenticated using (
  community_id is null or exists (
    select 1 from communities c where c.id=events.community_id
      and (c.is_public or c.created_by=(select auth.uid())
        or exists (select 1 from community_members cm where cm.community_id=c.id and cm.user_id=(select auth.uid())))
  )
);

drop policy if exists "events creator create" on public.events;
create policy "events creator create authorized" on public.events for insert
to authenticated with check (
  created_by=(select auth.uid())
  and (community_id is null or exists (
    select 1 from community_members cm where cm.community_id=events.community_id and cm.user_id=(select auth.uid())
  ))
);

drop policy if exists "events creator update" on public.events;
create policy "events creator update" on public.events for update
to authenticated using (created_by=(select auth.uid()))
with check (
  created_by=(select auth.uid())
  and (community_id is null or exists (
    select 1 from community_members cm where cm.community_id=events.community_id and cm.user_id=(select auth.uid())
  ))
);

drop policy if exists "events creator delete" on public.events;
create policy "events creator delete" on public.events for delete
to authenticated using (created_by=(select auth.uid()));

drop policy if exists "attendees read" on public.event_attendees;
create policy "attendees read visible events" on public.event_attendees for select
to authenticated using (exists (select 1 from events e where e.id=event_attendees.event_id));

drop policy if exists "attendees self manage" on public.event_attendees;
create policy "attendees self manage visible events" on public.event_attendees for insert
to authenticated with check (user_id=(select auth.uid()) and exists (select 1 from events e where e.id=event_attendees.event_id));

drop policy if exists "attendees self update" on public.event_attendees;
create policy "attendees self update" on public.event_attendees for update
to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

drop policy if exists "attendees self delete" on public.event_attendees;
create policy "attendees self delete" on public.event_attendees for delete
to authenticated using (user_id=(select auth.uid()));


-- Live notification triggers for core social actions.

create or replace function private.create_notification(p_user_id uuid,p_type text,p_title text,p_message text,p_reference_id uuid default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_user_id is null or p_user_id=(select auth.uid()) then return; end if;
  insert into notifications(user_id,type,title,message,reference_id)
  values(p_user_id,left(p_type,50),left(p_title,160),left(p_message,1000),p_reference_id);
end; $$;

revoke all on function private.create_notification(uuid,text,text,text,uuid) from public,anon,authenticated;

create or replace function private.notify_connection_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    perform private.create_notification(new.addressee_id,'connection_request','New connection request','Someone wants to connect with you.',new.id);
  elsif tg_op='UPDATE' and old.status is distinct from new.status and new.status in ('accepted','declined') then
    perform private.create_notification(new.requester_id,'connection_update',
      case when new.status='accepted' then 'Connection accepted' else 'Connection request declined' end,
      case when new.status='accepted' then 'Your connection request was accepted.' else 'Your connection request was declined.' end,new.id);
  end if;
  return new;
end; $$;

drop trigger if exists trg_connection_notifications on public.connections;
create trigger trg_connection_notifications after insert or update of status on public.connections
for each row execute function private.notify_connection_change();

create or replace function private.notify_community_join()
returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid; cname text;
begin
  select created_by,name into owner_id,cname from communities where id=new.community_id;
  if owner_id is not null and owner_id<>new.user_id then
    perform private.create_notification(owner_id,'community_join','New community member',cname||' has a new member.',new.community_id);
  end if;
  return new;
end; $$;

drop trigger if exists trg_community_join_notifications on public.community_members;
create trigger trg_community_join_notifications after insert on public.community_members
for each row execute function private.notify_community_join();

create or replace function private.notify_post_interaction()
returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid;
begin
  select author_id into owner_id from posts where id=new.post_id;
  perform private.create_notification(owner_id,
    case when tg_table_name='post_likes' then 'post_like' else 'post_comment' end,
    case when tg_table_name='post_likes' then 'Post liked' else 'New comment' end,
    case when tg_table_name='post_likes' then 'A member liked your post.' else 'A member commented on your post.' end,
    new.post_id);
  return new;
end; $$;

drop trigger if exists trg_post_like_notifications on public.post_likes;
create trigger trg_post_like_notifications after insert on public.post_likes
for each row execute function private.notify_post_interaction();

drop trigger if exists trg_post_comment_notifications on public.comments;
create trigger trg_post_comment_notifications after insert on public.comments
for each row execute function private.notify_post_interaction();


-- API surface hardening and RLS performance cleanup.
-- Banjara Connect is authenticated-first; anonymous table access is not required.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all functions in schema public from anon;

-- Security-definer helpers are never direct client APIs.
do $$
declare r record;
begin
  for r in
    select n.nspname schema_name, p.proname, pg_get_function_identity_arguments(p.oid) args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prosecdef
  loop
    execute format('revoke all on function %I.%I(%s) from public, anon, authenticated',
      r.schema_name,r.proname,r.args);
  end loop;
end $$;

grant execute on function private.is_chat_member(uuid) to authenticated;
grant execute on function private.user_blocked_in_chat(uuid) to authenticated;
grant execute on function private.can_view_post(uuid) to authenticated;
grant select on public.profiles to authenticated;

-- Policies using auth.uid() directly are evaluated per row. Wrap the auth call
-- in a SELECT so PostgreSQL can initialize it once per statement.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname, roles, cmd, qual, with_check
    from pg_policies
    where schemaname='public'
      and (coalesce(qual,'') like '%auth.uid()%' or coalesce(with_check,'') like '%auth.uid()%')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    execute format(
      'create policy %I on %I.%I as permissive for %s to %s %s %s',
      r.policyname, r.schemaname, r.tablename, lower(r.cmd),
      array_to_string(r.roles, ', '),
      case when r.qual is not null then 'using (' ||
        replace(replace(r.qual, 'auth.uid()', '(select auth.uid())'), '(select (select auth.uid()))','(select auth.uid())') || ')' else '' end,
      case when r.with_check is not null then 'with check (' ||
        replace(replace(r.with_check, 'auth.uid()', '(select auth.uid())'), '(select (select auth.uid()))','(select auth.uid())') || ')' else '' end
    );
  end loop;
end $$;


-- Event-attendee visibility follows the parent event/community visibility.
create or replace function private.can_view_event(p_event_id uuid)
returns boolean
language sql stable security definer
set search_path=public
as $$
  select exists (
    select 1 from events e
    where e.id=p_event_id and (
      e.community_id is null or exists (
        select 1 from communities c where c.id=e.community_id and (
          c.is_public or c.created_by=(select auth.uid()) or exists (
            select 1 from community_members cm
            where cm.community_id=c.id and cm.user_id=(select auth.uid())
          )
        )
      )
    )
  );
$$;
revoke all on function private.can_view_event(uuid) from public,anon,authenticated;
grant execute on function private.can_view_event(uuid) to authenticated;

drop policy if exists "attendees read visible events" on public.event_attendees;
create policy "attendees read visible events" on public.event_attendees for select
to authenticated using (private.can_view_event(event_id));

drop policy if exists "attendees self manage visible events" on public.event_attendees;
create policy "attendees self manage visible events" on public.event_attendees for insert
to authenticated with check (user_id=(select auth.uid()) and private.can_view_event(event_id));

drop policy if exists "attendees self update" on public.event_attendees;
create policy "attendees self update" on public.event_attendees for update
to authenticated using (user_id=(select auth.uid()) and private.can_view_event(event_id))
with check (user_id=(select auth.uid()) and private.can_view_event(event_id));

drop policy if exists "attendees self delete" on public.event_attendees;
create policy "attendees self delete" on public.event_attendees for delete
to authenticated using (user_id=(select auth.uid()));

alter policy "communities authenticated create" on public.communities to authenticated;
alter policy "communities public read" on public.communities to authenticated;
alter policy "community creator delete" on public.communities to authenticated;
alter policy "community creator update" on public.communities to authenticated;
alter policy "reactions read" on public.post_reactions to authenticated;
alter policy "reactions self insert" on public.post_reactions to authenticated;
alter policy "reactions self update" on public.post_reactions to authenticated;
alter policy "reactions self delete" on public.post_reactions to authenticated;
