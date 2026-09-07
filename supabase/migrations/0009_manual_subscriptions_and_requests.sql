-- =========================================================
-- Sweetly — Migration 0009: Manual UPI Subscriptions & Requests
-- =========================================================

-- 1. Extend public.subscriptions for manual approvals and grants
alter table public.subscriptions
  add column if not exists subscription_started_at timestamptz,
  add column if not exists payment_reference text,
  add column if not exists activated_by uuid references auth.users(id) on delete set null,
  add column if not exists activation_notes text;

-- 2. Create public.subscription_requests table
create table if not exists public.subscription_requests (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'pro',
  amount numeric(10,2) not null default 199.00,
  currency text not null default 'INR',
  utr text not null check (char_length(trim(utr)) >= 6),
  payment_screenshot_path text,
  notes text check (char_length(notes) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  admin_notes text check (char_length(admin_notes) <= 1000)
);

-- Indexes for performance & query speed
create index if not exists idx_subscription_requests_shop on public.subscription_requests(shop_id);
create index if not exists idx_subscription_requests_user on public.subscription_requests(user_id);
create index if not exists idx_subscription_requests_status on public.subscription_requests(status);
create index if not exists idx_subscription_requests_created on public.subscription_requests(created_at desc);

-- 3. Row Level Security for subscription_requests
alter table public.subscription_requests enable row level security;

-- Policy: Shop members can read requests for their own shop
do $$ begin
  if not exists (
    select 1 from pg_policies 
    where tablename = 'subscription_requests' and policyname = 'sub_requests: members can read own shop'
  ) then
    create policy "sub_requests: members can read own shop" on public.subscription_requests
      for select using (public.is_shop_member(shop_id));
  end if;
end $$;

-- Policy: Shop owners can submit new requests for their own shop
do $$ begin
  if not exists (
    select 1 from pg_policies 
    where tablename = 'subscription_requests' and policyname = 'sub_requests: owners can insert for own shop'
  ) then
    create policy "sub_requests: owners can insert for own shop" on public.subscription_requests
      for insert with check (
        public.has_shop_permission(shop_id, 'settings') 
        and auth.uid() = user_id
        and status = 'pending'
        and amount = 199.00
        and currency = 'INR'
        and plan = 'pro'
      );
  end if;
end $$;

-- Policy: Platform admins can read all requests
do $$ begin
  if not exists (
    select 1 from pg_policies 
    where tablename = 'subscription_requests' and policyname = 'sub_requests: admins can read all'
  ) then
    create policy "sub_requests: admins can read all" on public.subscription_requests
      for select using (
        exists (
          select 1 from public.profiles p 
          where p.id = auth.uid() and p.platform_role = 'PLATFORM_ADMIN'
        )
      );
  end if;
end $$;

-- Policy: Platform admins can update requests (approve/reject)
do $$ begin
  if not exists (
    select 1 from pg_policies 
    where tablename = 'subscription_requests' and policyname = 'sub_requests: admins can update'
  ) then
    create policy "sub_requests: admins can update" on public.subscription_requests
      for update using (
        exists (
          select 1 from public.profiles p 
          where p.id = auth.uid() and p.platform_role = 'PLATFORM_ADMIN'
        )
      );
  end if;
end $$;

-- 4. Reload PostgREST schema cache
notify pgrst, 'reload schema';
