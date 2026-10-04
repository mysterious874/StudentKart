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
