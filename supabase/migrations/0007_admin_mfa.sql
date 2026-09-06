-- =========================================================
-- Sweetly — Migration 0007: Admin MFA & Webhook Deduplication
-- =========================================================

-- 1. Table to store encrypted TOTP secrets and recovery codes for platform admins
create table if not exists public.admin_mfa (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_secret text not null,       -- AES-256-GCM ciphertext (hex)
  secret_iv text not null,              -- 12-byte initialization vector (hex)
  secret_tag text not null,             -- 16-byte authentication tag (hex)
  recovery_codes text[] not null default '{}', -- Salted SHA-256 hashes of single-use recovery codes
  mfa_enabled boolean not null default false,
  last_used_counter bigint not null default 0, -- Atomic RFC 6238 time-step counter for replay protection
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: Enabled. Direct client writes and non-admin reads are blocked.
alter table public.admin_mfa enable row level security;

-- Drop existing policy if exists to allow clean re-application
drop policy if exists "admin_mfa: platform admins read own" on public.admin_mfa;

-- Platform admins can only view their own row, never other users
create policy "admin_mfa: platform admins read own" on public.admin_mfa
  for select using (
    user_id = auth.uid() and exists (
      select 1 from public.profiles where id = auth.uid() and platform_role = 'PLATFORM_ADMIN'
    )
  );

create index if not exists idx_admin_mfa_user_id on public.admin_mfa(user_id);

-- Keep updated_at synchronized on every change
drop trigger if exists trg_admin_mfa_updated_at on public.admin_mfa;
create trigger trg_admin_mfa_updated_at before update on public.admin_mfa
  for each row execute procedure public.set_updated_at();

-- 2. Webhook Event Deduplication Table
-- Stores received x-razorpay-event-id to ensure idempotent at-least-once webhook handling.
create table if not exists public.webhook_events (
  event_id text primary key,
  provider text not null default 'razorpay',
  event_type text not null,
  resource_id text,
  payload jsonb,
  processed_at timestamptz not null default now()
);

-- RLS: Enabled with NO client policies (only accessible server-side via service role)
alter table public.webhook_events enable row level security;

create index if not exists idx_webhook_events_resource_id on public.webhook_events(resource_id);
create index if not exists idx_webhook_events_processed_at on public.webhook_events(processed_at desc);

-- 3. Bind pending Razorpay Order ID to subscriptions
alter table public.subscriptions
  add column if not exists pending_razorpay_order_id text,
  add column if not exists pending_plan text;

-- Unique partial index prevents two shops from ever claiming or sharing the same Razorpay order
create unique index if not exists idx_subscriptions_pending_order on public.subscriptions(pending_razorpay_order_id)
  where pending_razorpay_order_id is not null;

-- 4. Atomic Helper Functions for MFA Security
-- Atomic single-use recovery code consumption: guarantees race-condition safety
create or replace function public.consume_admin_recovery_code(
  p_user_id uuid,
  p_consumed_code_entry text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows_affected int;
begin
  update public.admin_mfa
  set
    recovery_codes = array_remove(recovery_codes, p_consumed_code_entry),
    last_verified_at = now(),
    updated_at = now()
  where user_id = p_user_id
    and p_consumed_code_entry = any(recovery_codes);

  get diagnostics v_rows_affected = row_count;
  return v_rows_affected > 0;
end;
$$;

-- Atomic TOTP counter update: guarantees replay prevention even with simultaneous requests
create or replace function public.verify_and_update_totp_counter(
  p_user_id uuid,
  p_counter bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows_affected int;
begin
  update public.admin_mfa
  set
    last_used_counter = p_counter,
    last_verified_at = now(),
    updated_at = now()
  where user_id = p_user_id
    and last_used_counter < p_counter;

  get diagnostics v_rows_affected = row_count;
  return v_rows_affected > 0;
end;
$$;
