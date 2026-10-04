-- Banjara Connect profile privacy hardening
-- Applied to Supabase project yymzfjfkmsrymqhpnfqz.
-- Browser clients must use the JWT-protected profile-api Edge Function.
-- public.profiles is intentionally not exposed to anon/authenticated roles because it contains
-- private contact/session fields (phone, email, active_session_id).

revoke all on table public.profiles from public, anon, authenticated;