-- Banjara Connect: prevent client-side profile creation from choosing protected identity fields.
-- Profile rows are created/updated by the authenticated account/session backend.
-- Public clients may only insert non-sensitive profile fields if a future flow requires it.

revoke insert on table public.profiles from authenticated;
grant insert (id, name, college, username, bio, avatar_url, cover_url, state, city, area)
  on table public.profiles to authenticated;
