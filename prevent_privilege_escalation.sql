-- ====================================================================
-- VELGO DATABASE SECURITY FIX: PREVENT ADMIN PRIVILEGE ESCALATION
-- ====================================================================
-- This migration protects critical profile columns (role, tokens, is_blocked,
-- is_verified, reputation metrics) from unauthorized client-side tampering via RLS.
--
-- Regular users can still update all their profile information:
-- (full_name, phone, address, state, lga, area, bio, avatar, NIN upload, bank details, PIN, preferences).
--
-- Only verified Admins and internal database procedures can elevate roles,
-- unblock accounts, alter tokens, or issue official verification badges.

-- 1. Ensure public.is_admin() is robust & recognizes master admins
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR email IN ('velgonigeria.uni@gmail.com', 'admin.velgo@gmail.com'))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- 2. Create the protective BEFORE UPDATE trigger function
CREATE OR REPLACE FUNCTION public.protect_profile_critical_columns()
RETURNS trigger AS $$
BEGIN
  -- BYPASS RULE: If caller is a database superuser/procedure (e.g. add_tokens RPC),
  -- a service role request, or an authenticated Admin, permit the update.
  IF current_user IN ('postgres', 'supabase_admin')
     OR (auth.jwt() ->> 'role' = 'service_role')
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- 1. PREVENT ROLE ESCALATION:
  -- Non-admins cannot elevate their role to 'admin'
  IF NEW.role = 'admin' AND (OLD.role IS NULL OR OLD.role != 'admin') THEN
    RAISE EXCEPTION 'Security Violation: You do not have permission to assign an admin role.';
  END IF;

  -- Non-admins cannot alter an existing assigned role (e.g. from user to worker or custom)
  IF OLD.role IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Security Violation: Account role cannot be altered.';
  END IF;

  -- 2. PREVENT MODERATION STATUS TAMPERING:
  -- Blocked users cannot unblock themselves or wipe block reasons
  IF NEW.is_blocked IS DISTINCT FROM OLD.is_blocked OR NEW.block_reason IS DISTINCT FROM OLD.block_reason THEN
    RAISE EXCEPTION 'Security Violation: Moderation status cannot be self-modified.';
  END IF;

  -- 3. PREVENT DIRECT TOKEN MANIPULATION:
  -- Direct client-side updates to tokens are blocked.
  -- Tokens can only be added via the add_tokens RPC or deducted by official booking triggers.
  IF NEW.tokens IS DISTINCT FROM OLD.tokens THEN
    RAISE EXCEPTION 'Security Violation: Token balances cannot be directly altered.';
  END IF;

  -- 4. PREVENT REPUTATION & METRIC FORGERY:
  -- Users cannot forge their rating, review count, or completed job counts directly.
  IF NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.rating_count IS DISTINCT FROM OLD.rating_count
     OR NEW.completed_jobs_count IS DISTINCT FROM OLD.completed_jobs_count
     OR NEW.job_count IS DISTINCT FROM OLD.job_count
     OR NEW.task_count IS DISTINCT FROM OLD.task_count THEN
    RAISE EXCEPTION 'Security Violation: Reputation metrics cannot be directly modified.';
  END IF;

  -- 5. PREVENT VERIFICATION BADGE & TIER FORGERY:
  -- Non-admins cannot grant themselves is_verified = true or modify subscription_tier directly.
  -- Verification badges and token pack tier updates are granted exclusively via the verified serverless gateway or Compliance Admin.
  IF NEW.is_verified = true AND (OLD.is_verified IS DISTINCT FROM true) THEN
    RAISE EXCEPTION 'Security Violation: Official verification status can only be granted by Velgo Compliance or verified token pack purchase.';
  END IF;

  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    RAISE EXCEPTION 'Security Violation: Tier updates must be processed through the verified payment gateway.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Bind the trigger to public.profiles table
DROP TRIGGER IF EXISTS trg_protect_profile_critical_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_critical_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_critical_columns();
