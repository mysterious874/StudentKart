-- StudentKart: Admin moderation appeal decisions
-- Run this once in Supabase SQL Editor after reports-moderation.sql.

create or replace function public.admin_decide_moderation_appeal(
    target_appeal_id uuid,
    decision text,
    admin_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    appeal_row public.moderation_appeals%rowtype;
    listing_owner uuid;
    listing_name text;
begin
    if not exists (
        select 1
        from public.admin_users
        where id = auth.uid()
    ) then
        raise exception 'admin access required';
    end if;

    if decision not in ('approved','rejected') then
        raise exception 'invalid appeal decision';
    end if;

    select *
      into appeal_row
      from public.moderation_appeals
     where id = target_appeal_id
     for update;

    if not found then
        return false;
    end if;

    if appeal_row.status <> 'pending' then
        raise exception 'appeal has already been decided';
    end if;

    select user_id, name
      into listing_owner, listing_name
      from public.products
     where id = appeal_row.product_id;

    if not found then
        update public.moderation_appeals
           set status = 'rejected',
               admin_note = coalesce(admin_note, 'Listing no longer exists.'),
               reviewed_at = now(),
               reviewed_by = auth.uid()
         where id = target_appeal_id;

        insert into public.notifications (
            user_id, product_id, type, title, message, is_read, created_at
        )
        values (
            appeal_row.seller_id, appeal_row.product_id,
            'listing_appeal_rejected',
            'Appeal rejected',
            'Your appeal was rejected because the listing is no longer available.',
            false,
            now()
        );

        return true;
    end if;

    if decision = 'approved' then
        update public.products
           set moderation_status = 'active',
               moderation_reason = null,
               moderated_at = now(),
               moderated_by = auth.uid()
         where id = appeal_row.product_id;

        insert into public.moderation_activity (
            product_id, admin_id, action, reason
        )
        values (
            appeal_row.product_id,
            auth.uid(),
            'restore',
            coalesce(admin_note, 'Seller appeal approved')
        );
    end if;

    update public.moderation_appeals
       set status = decision,
           admin_note = nullif(trim(admin_note), ''),
           reviewed_at = now(),
           reviewed_by = auth.uid()
     where id = target_appeal_id;

    insert into public.notifications (
        user_id, product_id, type, title, message, is_read, created_at
    )
    values (
        listing_owner, appeal_row.product_id,
        case when decision = 'approved'
             then 'listing_appeal_approved'
             else 'listing_appeal_rejected'
        end,
        case when decision = 'approved'
             then 'Appeal approved'
             else 'Appeal rejected'
        end,
        case
            when decision = 'approved'
                then coalesce(listing_name, 'Your listing') ||
                     ' has been restored after your appeal was approved.'
            else
                coalesce(listing_name, 'Your listing') ||
                     ' appeal was rejected.' ||
                     case when nullif(trim(admin_note), '') is not null
                          then ' Admin note: ' || trim(admin_note)
                          else ''
                     end
        end,
        false,
        now()
    );

    return true;
end;
$$;

revoke all on function public.admin_decide_moderation_appeal(uuid, text, text) from public;
grant execute on function public.admin_decide_moderation_appeal(uuid, text, text) to authenticated;
