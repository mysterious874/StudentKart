-- StudentKart: Reports & moderation
create table if not exists public.reports (
    id uuid primary key default gen_random_uuid(),
    product_id uuid references public.products(id) on delete set null,
    reporter_id uuid references auth.users(id) on delete set null,
    reason text not null,
    details text,
    status text not null default 'pending'
        check (status in ('pending','reviewed','resolved','dismissed')),
    created_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists reports_status_idx on public.reports(status);
create index if not exists reports_created_at_idx on public.reports(created_at desc);
create index if not exists reports_product_id_idx on public.reports(product_id);

alter table public.reports enable row level security;

drop policy if exists "Users can create reports" on public.reports;
create policy "Users can create reports"
on public.reports for insert to authenticated
with check (reporter_id = auth.uid());

drop policy if exists "Users can view own reports" on public.reports;
create policy "Users can view own reports"
on public.reports for select to authenticated
using (reporter_id = auth.uid());

drop policy if exists "Admins can view reports" on public.reports;
create policy "Admins can view reports"
on public.reports for select to authenticated
using (
    exists (
        select 1 from public.admin_users
        where id = auth.uid()
    )
);

drop policy if exists "Admins can update reports" on public.reports;
create policy "Admins can update reports"
on public.reports for update to authenticated
using (
    exists (
        select 1 from public.admin_users
        where id = auth.uid()
    )
)
with check (
    exists (
        select 1 from public.admin_users
        where id = auth.uid()
    )
);


-- Soft-moderation for marketplace listings.
alter table public.products
    add column if not exists moderation_status text not null default 'active'
        check (moderation_status in ('active','suspended')),
    add column if not exists moderation_reason text,
    add column if not exists moderated_at timestamptz,
    add column if not exists moderated_by uuid references auth.users(id) on delete set null;

create index if not exists products_moderation_status_idx
    on public.products(moderation_status);

create or replace function public.admin_set_listing_moderation(
    target_product_id uuid,
    new_status text,
    reason_text text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    listing_owner uuid;
    listing_name text;
begin
    if not exists (
        select 1 from public.admin_users
        where id = auth.uid()
    ) then
        raise exception 'admin access required';
    end if;

    if new_status not in ('active','suspended') then
        raise exception 'invalid moderation status';
    end if;

    select user_id, name
      into listing_owner, listing_name
      from public.products
     where id = target_product_id;

    if not found then
        return false;
    end if;

    update public.products
       set moderation_status = new_status,
           moderation_reason = case when new_status = 'suspended' then reason_text else null end,
           moderated_at = now(),
           moderated_by = auth.uid()
     where id = target_product_id;

    insert into public.moderation_activity (product_id, admin_id, action, reason)
    values (
        target_product_id,
        auth.uid(),
        case when new_status = 'suspended' then 'suspend' else 'restore' end,
        case when new_status = 'suspended' then reason_text else null end
    );

    if listing_owner is not null then
        insert into public.notifications (
            user_id,
            type,
            title,
            message,
            is_read,
            created_at
        )
        values (
            listing_owner,
            case when new_status = 'suspended' then 'listing_suspended' else 'listing_restored' end,
            case when new_status = 'suspended' then 'Listing suspended' else 'Listing restored' end,
            case
                when new_status = 'suspended'
                    then coalesce(listing_name, 'Your listing') || ' was suspended after an admin moderation review. Reason: ' || coalesce(reason_text, 'Community report review')
                else
                    coalesce(listing_name, 'Your listing') || ' has been restored and is visible in the marketplace again.'
            end,
            false,
            now()
        );
    end if;

    return true;
end;
$$;

revoke all on function public.admin_set_listing_moderation(uuid, text, text) from public;
grant execute on function public.admin_set_listing_moderation(uuid, text, text) to authenticated;


-- Moderation audit trail.
create table if not exists public.moderation_activity (
    id uuid primary key default gen_random_uuid(),
    product_id uuid references public.products(id) on delete set null,
    admin_id uuid references auth.users(id) on delete set null,
    action text not null check (action in ('suspend','restore')),
    reason text,
    created_at timestamptz not null default now()
);

create index if not exists moderation_activity_created_at_idx
    on public.moderation_activity(created_at desc);

create index if not exists moderation_activity_product_id_idx
    on public.moderation_activity(product_id);

alter table public.moderation_activity enable row level security;

drop policy if exists "Admins can view moderation activity" on public.moderation_activity;
create policy "Admins can view moderation activity"
on public.moderation_activity for select to authenticated
using (exists (select 1 from public.admin_users where id = auth.uid()));

drop policy if exists "Admins can insert moderation activity" on public.moderation_activity;
create policy "Admins can insert moderation activity"
on public.moderation_activity for insert to authenticated
with check (exists (select 1 from public.admin_users where id = auth.uid()));



-- Seller moderation appeals.
create table if not exists public.moderation_appeals (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references public.products(id) on delete cascade,
    seller_id uuid not null references auth.users(id) on delete cascade,
    message text not null,
    status text not null default 'pending'
        check (status in ('pending','reviewed','approved','rejected')),
    admin_note text,
    created_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists moderation_appeals_product_id_idx
    on public.moderation_appeals(product_id);
create index if not exists moderation_appeals_seller_id_idx
    on public.moderation_appeals(seller_id);
create index if not exists moderation_appeals_status_idx
    on public.moderation_appeals(status);

create unique index if not exists moderation_appeals_pending_unique_idx
    on public.moderation_appeals(product_id, seller_id)
    where status = 'pending';

alter table public.moderation_appeals enable row level security;

drop policy if exists "Sellers can create own appeals" on public.moderation_appeals;
create policy "Sellers can create own appeals"
on public.moderation_appeals for insert to authenticated
with check (
    seller_id = auth.uid()
    and exists (
        select 1 from public.products
        where products.id = product_id
          and products.user_id = auth.uid()
          and products.moderation_status = 'suspended'
    )
);

drop policy if exists "Sellers can view own appeals" on public.moderation_appeals;
create policy "Sellers can view own appeals"
on public.moderation_appeals for select to authenticated
using (seller_id = auth.uid());

drop policy if exists "Admins can view appeals" on public.moderation_appeals;
create policy "Admins can view appeals"
on public.moderation_appeals for select to authenticated
using (exists (select 1 from public.admin_users where id = auth.uid()));

drop policy if exists "Admins can update appeals" on public.moderation_appeals;
create policy "Admins can update appeals"
on public.moderation_appeals for update to authenticated
using (exists (select 1 from public.admin_users where id = auth.uid()))
with check (exists (select 1 from public.admin_users where id = auth.uid()));

