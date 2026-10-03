-- StudentKart: allow message senders to replace their own message
-- with the WhatsApp-style deleted-message marker.
alter table public.messages enable row level security;

drop policy if exists "messages_update_own" on public.messages;

create policy "messages_update_own"
on public.messages
for update
to authenticated
using (auth.uid() = sender_id)
with check (auth.uid() = sender_id);
