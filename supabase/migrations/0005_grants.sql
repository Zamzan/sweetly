-- =========================================================
-- Sweetly — Fix: grant baseline table privileges
--
-- This does NOT weaken security. Row Level Security (0002_rls.sql)
-- still controls exactly which ROWS each role can see or change —
-- this migration only grants the more basic "is this role allowed
-- to touch this table at all" permission that Postgres checks
-- before RLS is even evaluated. Without it, every query fails with
-- "permission denied for table X" regardless of how correct the
-- RLS policies are.
--
-- Run this once if you created tables by pasting SQL directly into
-- the SQL Editor (rather than via Supabase's CLI/migration tooling,
-- which sets this up automatically).
-- =========================================================

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- Also apply to any tables created AFTER this point, so you never
-- hit this issue again if you add tables later.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
