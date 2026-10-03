-- StudentKart chat RLS policies
-- Covers:
--   1) messages: sender-side delete, sender-side deleted marker update,
--      receiver-side is_read updates
--   2) hidden_chats: per-user SELECT / INSERT / UPDATE / DELETE
--
-- Run this entire file once in Supabase SQL Editor.

alter table public.messages enable row level security;
alter table public.hidden_chats enable row level security;

-- =========================================================
-- MESSAGES: DELETE
-- =========================================================
-- A user can physically delete only messages they sent.
-- This is intentionally NOT based on inquiry_id alone, so one user
-- cannot erase the other participant's messages.

drop policy if exists "messages_delete_own" on public.messages;

create policy "messages_delete_own"
on public.messages
for delete
to authenticated
using (
    auth.uid() = sender_id
);

-- =========================================================
-- MESSAGES: UPDATE
-- =========================================================
-- Sender needs UPDATE to replace their own message with the
-- WhatsApp-style deleted marker.
--
-- Receiver needs UPDATE to mark received messages read/unread.
-- Both policies are row-level permissions; the application still
-- restricts which fields each action changes.

drop policy if exists "messages_update_own" on public.messages;
drop policy if exists "messages_update_sender_or_receiver" on public.messages;

create policy "messages_update_sender_or_receiver"
on public.messages
for update
to authenticated
using (
    auth.uid() = sender_id
    or auth.uid() = receiver_id
)
with check (
    auth.uid() = sender_id
    or auth.uid() = receiver_id
);

-- =========================================================
-- HIDDEN CHATS: SELECT
-- =========================================================
-- Each user can see only their own hidden-chat records.

drop policy if exists "hidden_chats_select_own" on public.hidden_chats;

create policy "hidden_chats_select_own"
on public.hidden_chats
for select
to authenticated
using (
    auth.uid() = user_id
);

-- =========================================================
-- HIDDEN CHATS: INSERT
-- =========================================================
-- Used by Delete for Me / hide-chat operations.

drop policy if exists "hidden_chats_insert_own" on public.hidden_chats;

create policy "hidden_chats_insert_own"
on public.hidden_chats
for insert
to authenticated
with check (
    auth.uid() = user_id
);

-- =========================================================
-- HIDDEN CHATS: UPDATE
-- =========================================================
-- Supabase upsert() can require UPDATE when the
-- (user_id, inquiry_id) row already exists.

drop policy if exists "hidden_chats_update_own" on public.hidden_chats;

create policy "hidden_chats_update_own"
on public.hidden_chats
for update
to authenticated
using (
    auth.uid() = user_id
)
with check (
    auth.uid() = user_id
);

-- =========================================================
-- HIDDEN CHATS: DELETE
-- =========================================================
-- Used when the user unhides/restores a chat.

drop policy if exists "hidden_chats_delete_own" on public.hidden_chats;

create policy "hidden_chats_delete_own"
on public.hidden_chats
for delete
to authenticated
using (
    auth.uid() = user_id
);
