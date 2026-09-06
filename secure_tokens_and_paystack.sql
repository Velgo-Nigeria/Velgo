-- ====================================================================
-- VELGO DATABASE SECURITY FIX: SECURE TOKEN MINTING & AUDIT LOGS
-- ====================================================================
-- This migration fixes the arbitrary token minting vulnerability by:
-- 1. Restricting add_tokens so only authenticated Admins, service role (backend API),
--    and database internal processes can execute it.
-- 2. Creating a payment_transactions table to prevent replay attacks and log Paystack receipts.

-- 1. Create payment_transactions audit table if it does not exist
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency TEXT DEFAULT 'NGN',
    tier TEXT,
    tokens_added INTEGER DEFAULT 0,
    status TEXT DEFAULT 'success',
    paystack_id TEXT,
    customer_email TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on payment_transactions
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transaction history
DROP POLICY IF EXISTS "Users can view own payment transactions" ON public.payment_transactions;
CREATE POLICY "Users can view own payment transactions"
ON public.payment_transactions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- Backend service role and internal database processes can insert/manage
DROP POLICY IF EXISTS "Service role can insert payments" ON public.payment_transactions;
CREATE POLICY "Service role can insert payments"
ON public.payment_transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. Secure the add_tokens RPC function
-- Only Admins, service_role, and database superusers can mint tokens
CREATE OR REPLACE FUNCTION public.add_tokens(p_user_id UUID, p_amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_authorized BOOLEAN;
BEGIN
  -- 1. Reject invalid or negative amounts (prevents token draining attacks)
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Security Violation: Token amount must be a positive integer.';
  END IF;

  -- 2. Verify caller authorization:
  -- Allowed only for:
  -- - Superuser / Postgres internal context
  -- - Backend serverless API via service_role key
  -- - Platform Admin (checked via public.is_admin())
  v_is_authorized := current_user IN ('postgres', 'supabase_admin')
                     OR (auth.jwt() ->> 'role' = 'service_role')
                     OR public.is_admin();

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Security Violation: Direct client-side token minting is forbidden. Payments must be verified through the serverless endpoint.';
  END IF;

  -- 3. Perform the token addition
  UPDATE public.profiles
  SET tokens = COALESCE(tokens, 0) + p_amount
  WHERE id = p_user_id;
END;
$$;

-- Revoke default public execute permission
REVOKE ALL ON FUNCTION public.add_tokens(UUID, INTEGER) FROM PUBLIC;

-- Explicitly grant to authenticated users and service_role
-- (Execution inside the function will still enforce v_is_authorized for non-admins)
GRANT EXECUTE ON FUNCTION public.add_tokens(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_tokens(UUID, INTEGER) TO service_role;

-- 3. Update profile protection trigger to completely remove subscription_end_date
-- and ensure regular users cannot self-assign verification badges or change subscription_tier.
CREATE OR REPLACE FUNCTION public.protect_profile_critical_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Superuser, service role, or platform admin can update any column
  IF current_user IN ('postgres', 'supabase_admin') 
     OR (auth.jwt() ->> 'role' = 'service_role')
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- 1. PREVENT ROLE ESCALATION:
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Security Violation: You are not authorized to modify user roles.';
  END IF;

  -- 2. PREVENT MODERATION STATUS TAMPERING:
  IF NEW.is_blocked IS DISTINCT FROM OLD.is_blocked OR NEW.block_reason IS DISTINCT FROM OLD.block_reason THEN
    RAISE EXCEPTION 'Security Violation: Moderation status cannot be self-modified.';
  END IF;

  -- 3. PREVENT DIRECT TOKEN MANIPULATION:
  IF NEW.tokens IS DISTINCT FROM OLD.tokens THEN
    RAISE EXCEPTION 'Security Violation: Token balances cannot be directly altered.';
  END IF;

  -- 4. PREVENT REPUTATION & METRIC FORGERY:
  IF NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.rating_count IS DISTINCT FROM OLD.rating_count
     OR NEW.completed_jobs_count IS DISTINCT FROM OLD.completed_jobs_count
     OR NEW.job_count IS DISTINCT FROM OLD.job_count
     OR NEW.task_count IS DISTINCT FROM OLD.task_count THEN
    RAISE EXCEPTION 'Security Violation: Reputation metrics cannot be directly modified.';
  END IF;

  -- 5. PREVENT VERIFICATION BADGE & TIER FORGERY:
  -- Non-admins cannot grant themselves is_verified = true or modify subscription_tier directly.
  -- Token pack tier promotions and badges are handled exclusively via verified serverless gateway or Compliance Admin.
  IF NEW.is_verified = true AND (OLD.is_verified IS DISTINCT FROM true) THEN
    RAISE EXCEPTION 'Security Violation: Official verification status can only be granted by Velgo Compliance or verified token pack purchase.';
  END IF;

  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    RAISE EXCEPTION 'Security Violation: Tier updates must be processed through the verified payment gateway.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_critical_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_critical_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_critical_columns();
