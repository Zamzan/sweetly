-- =========================================================
-- Run this ONCE in the Supabase SQL editor to make yourself
-- a platform admin so you can see /admin (all registered shops,
-- publish status, counts).
--
-- Find your user id first: Supabase Dashboard -> Authentication
-- -> Users -> copy the UUID next to your email. Or run:
--   select id, email from auth.users where email = 'you@example.com';
-- =========================================================

update public.profiles
set platform_role = 'PLATFORM_ADMIN'
where id = 'REPLACE-WITH-YOUR-AUTH-USER-UUID';

-- Verify:
-- select id, full_name, platform_role from public.profiles where platform_role = 'PLATFORM_ADMIN';
