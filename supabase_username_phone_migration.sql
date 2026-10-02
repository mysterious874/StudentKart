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

-- Profile photos use the existing "product-images" bucket.
-- Files are stored inside a folder named with the authenticated user's id.
do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = 'studentkart_profile_image_insert_own'
    ) then
        create policy studentkart_profile_image_insert_own
        on storage.objects
        for insert
        to authenticated
        with check (
            bucket_id = 'product-images'
            and (storage.foldername(name))[1] = (select auth.uid()::text)
        );
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = 'studentkart_profile_image_update_own'
    ) then
        create policy studentkart_profile_image_update_own
        on storage.objects
        for update
        to authenticated
        using (
            bucket_id = 'product-images'
            and (storage.foldername(name))[1] = (select auth.uid()::text)
        )
        with check (
            bucket_id = 'product-images'
            and (storage.foldername(name))[1] = (select auth.uid()::text)
        );
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = 'studentkart_profile_image_delete_own'
    ) then
        create policy studentkart_profile_image_delete_own
        on storage.objects
        for delete
        to authenticated
        using (
            bucket_id = 'product-images'
            and (storage.foldername(name))[1] = (select auth.uid()::text)
        );
    end if;
end
$$;
