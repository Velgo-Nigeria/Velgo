-- ==========================================
-- VELGO V2: UNIFIED USER ARCHITECTURE
-- ==========================================

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE task_status AS ENUM ('open', 'assigned', 'completed', 'cancelled');
CREATE TYPE booking_status AS ENUM ('pending', 'accepted', 'completed', 'cancelled', 'declined', 'disputed');

-- 2. PROFILES TABLE
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role user_role DEFAULT 'user',
    tokens INTEGER DEFAULT 2,
    bio TEXT,
    category TEXT,
    subcategory TEXT,
    hourly_rate INTEGER,
    state TEXT,
    lga TEXT,
    address TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    phone_number TEXT,
    avatar_url TEXT,
    nin_image_url TEXT,
    instagram_handle TEXT,
    portfolio_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE,
    starting_price INTEGER,
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT,
    service_title TEXT,
    last_reset_date TIMESTAMP WITH TIME ZONE,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    theme_mode TEXT DEFAULT 'auto',
    notification_preferences JSONB,
    worker_rating_count INTEGER DEFAULT 0,
    worker_avg_rating NUMERIC(3,2) DEFAULT 0.00,
    
    -- Metrics
    task_count INTEGER DEFAULT 0, -- Tasks they requested
    job_count INTEGER DEFAULT 0,  -- Tasks they completed
    
    rating_count INTEGER DEFAULT 0,
    avg_rating NUMERIC(3,2) DEFAULT 0.00,
    avg_quality NUMERIC(3,2) DEFAULT 0.00,
    avg_communication NUMERIC(3,2) DEFAULT 0.00,
    avg_punctuality NUMERIC(3,2) DEFAULT 0.00,
    
    is_verified BOOLEAN DEFAULT false,
    profile_score NUMERIC DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger to create profile upon signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, tokens)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    'user', 
    2 -- Initial free tokens
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 3. POSTED TASKS
CREATE TABLE posted_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    location TEXT NOT NULL, -- or state/city
    budget INTEGER NOT NULL,
    budget_type TEXT DEFAULT 'fixed',
    status task_status DEFAULT 'open',
    assigned_worker_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE posted_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tasks viewable by everyone" ON posted_tasks FOR SELECT USING (true);
CREATE POLICY "Users can insert tasks" ON posted_tasks FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Users can update own tasks" ON posted_tasks FOR UPDATE USING (auth.uid() = client_id);
CREATE POLICY "Users can delete own tasks" ON posted_tasks FOR DELETE USING (auth.uid() = client_id);


-- 4. BOOKINGS
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    worker_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    task_id UUID REFERENCES posted_tasks(id) ON DELETE CASCADE,
    status booking_status DEFAULT 'pending',
    
    -- Ratings (stored directly on the transaction)
    rating INTEGER, -- overall
    quality_rating INTEGER,
    communication_rating INTEGER,
    punctuality_rating INTEGER,
    review_text TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bookings viewable by involved users" ON bookings 
FOR SELECT USING (auth.uid() = client_id OR auth.uid() = worker_id);
CREATE POLICY "Bookings insertable by involved users" ON bookings 
FOR INSERT WITH CHECK (auth.uid() = client_id OR auth.uid() = worker_id);
CREATE POLICY "Bookings updatable by involved users" ON bookings 
FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = worker_id);


-- 5. MESSAGES
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messages viewable by sender or receiver" ON messages 
FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Messages insertable by sender" ON messages 
FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Messages updatable by receiver" ON messages 
FOR UPDATE USING (auth.uid() = receiver_id);


-- 6. SUPPORT MESSAGES
CREATE TABLE support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert support messages" ON support_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own support messages" ON support_messages FOR SELECT USING (auth.uid() = user_id);


-- 7. DISPUTES
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
    initiator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own disputes via bookings" ON disputes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM bookings 
    WHERE bookings.id = disputes.booking_id 
    AND (bookings.client_id = auth.uid() OR bookings.worker_id = auth.uid())
  )
);
CREATE POLICY "Users can insert disputes for their bookings" ON disputes
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM bookings 
    WHERE bookings.id = booking_id 
    AND (bookings.client_id = auth.uid() OR bookings.worker_id = auth.uid())
  )
  AND auth.uid() = initiator_id
);

-- ==========================================
-- TOKEN DEDUCTION LOGIC
-- ==========================================

-- Function to accept a booking/application and deduct from BOTH parties
CREATE OR REPLACE FUNCTION accept_booking_with_mutual_deduction(p_booking_id UUID, p_accepter_id UUID)
RETURNS boolean AS $$
DECLARE
    v_client_id UUID;
    v_worker_id UUID;
    v_client_tokens INTEGER;
    v_worker_tokens INTEGER;
    v_booking_status booking_status;
BEGIN
    -- 1. Get booking details
    SELECT client_id, worker_id, status 
    INTO v_client_id, v_worker_id, v_booking_status
    FROM bookings
    WHERE id = p_booking_id;
    
    IF v_booking_status != 'pending' THEN
        RAISE EXCEPTION 'Booking is not pending.';
    END IF;

    -- 2. Verify accepter is part of the booking
    IF p_accepter_id != v_client_id AND p_accepter_id != v_worker_id THEN
        RAISE EXCEPTION 'Unauthorized: Accepter is not part of this booking.';
    END IF;

    -- 3. Check tokens for BOTH
    SELECT tokens INTO v_client_tokens FROM profiles WHERE id = v_client_id;
    SELECT tokens INTO v_worker_tokens FROM profiles WHERE id = v_worker_id;

    IF v_client_tokens < 1 THEN
        RAISE EXCEPTION 'INSUFFICIENT_TOKENS_CLIENT';
    END IF;
    
    IF v_worker_tokens < 1 THEN
        RAISE EXCEPTION 'INSUFFICIENT_TOKENS_WORKER';
    END IF;

    -- 4. Deduct tokens
    UPDATE profiles SET tokens = tokens - 1 WHERE id = v_client_id;
    UPDATE profiles SET tokens = tokens - 1 WHERE id = v_worker_id;

    -- 5. Update booking status
    UPDATE bookings SET status = 'accepted', updated_at = NOW() WHERE id = p_booking_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- METRICS (RATINGS & TASK COUNTS)
-- ==========================================

CREATE OR REPLACE FUNCTION update_profile_metrics_on_booking()
RETURNS trigger AS $$
BEGIN
    -- Only trigger when a booking is COMPLETED and HAS A RATING
    IF NEW.status = 'completed' AND NEW.rating IS NOT NULL THEN
        -- We apply ratings uniquely to the WORKER (who provided the service)
        -- Since users are unified, the "worker" in this transaction receives the rating.
        UPDATE profiles
        SET rating_count = (SELECT COUNT(*) FROM bookings WHERE worker_id = NEW.worker_id AND rating IS NOT NULL AND status='completed'),
            avg_rating = (SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0) FROM bookings WHERE worker_id = NEW.worker_id AND rating IS NOT NULL AND status='completed'),
            avg_quality = (SELECT COALESCE(ROUND(AVG(quality_rating)::numeric, 2), 0) FROM bookings WHERE worker_id = NEW.worker_id AND quality_rating IS NOT NULL AND status='completed'),
            avg_communication = (SELECT COALESCE(ROUND(AVG(communication_rating)::numeric, 2), 0) FROM bookings WHERE worker_id = NEW.worker_id AND communication_rating IS NOT NULL AND status='completed'),
            avg_punctuality = (SELECT COALESCE(ROUND(AVG(punctuality_rating)::numeric, 2), 0) FROM bookings WHERE worker_id = NEW.worker_id AND punctuality_rating IS NOT NULL AND status='completed')
        WHERE id = NEW.worker_id;
    END IF;

    -- Update counts when Accepted
    IF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted') THEN
        UPDATE profiles SET job_count = job_count + 1 WHERE id = NEW.worker_id;
        UPDATE profiles SET task_count = task_count + 1 WHERE id = NEW.client_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_metrics
AFTER INSERT OR UPDATE ON bookings
FOR EACH ROW EXECUTE PROCEDURE update_profile_metrics_on_booking();


-- Automatically set updated_at on bookings
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_bookings_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- That's it for the core schema!

-- ==========================================
-- VISIBILITY SCORE CALCULATION
-- ==========================================

-- Ensure the subscription_tier column exists to prevent errors
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'basic';

-- 1. Create the function to calculate the Visibility Score
CREATE OR REPLACE FUNCTION calculate_profile_score()
RETURNS TRIGGER AS $$
DECLARE
    score NUMERIC := 0;
BEGIN
    -- Verify ID (+20 Pts)
    IF NEW.is_verified = true THEN
        score := score + 20;
    END IF;

    -- Add Bank Details (+10 Pts)
    IF NEW.bank_name IS NOT NULL AND trim(NEW.bank_name) != '' 
       AND NEW.account_number IS NOT NULL AND trim(NEW.account_number) != '' THEN
        score := score + 10;
    END IF;

    -- Complete Bio & Avatar (+10 Pts)
    IF NEW.bio IS NOT NULL AND trim(NEW.bio) != '' 
       AND NEW.avatar_url IS NOT NULL AND trim(NEW.avatar_url) != '' THEN
        score := score + 10;
    END IF;

    -- Upgrade to Pro/Enterprise Tier (Up to +25 Pts)
    IF NEW.subscription_tier = 'enterprise' THEN
        score := score + 25;
    ELSIF NEW.subscription_tier = 'pro' THEN
        score := score + 15;
    END IF;

    -- Maintain 5-Star Ratings & Badges (Up to +50 Pts)
    IF NEW.avg_rating IS NOT NULL AND NEW.avg_rating > 0 THEN
        score := score + (NEW.avg_rating * 10);
    END IF;

    -- Assign the calculated score
    NEW.profile_score := ROUND(score);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach the Trigger to the Profiles table (For both INSERT and UPDATE)
DROP TRIGGER IF EXISTS trg_calculate_visibility_score ON profiles;
CREATE TRIGGER trg_calculate_visibility_score
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE PROCEDURE calculate_profile_score();

-- ==========================================
-- TOKENS MANAGEMENT
-- ==========================================
CREATE OR REPLACE FUNCTION public.add_tokens(p_user_id UUID, p_amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_authorized BOOLEAN;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Security Violation: Token amount must be a positive integer.';
  END IF;

  v_is_authorized := current_user IN ('postgres', 'supabase_admin')
                     OR (auth.jwt() ->> 'role' = 'service_role')
                     OR public.is_admin();

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Security Violation: Direct client-side token minting is forbidden.';
  END IF;

  UPDATE public.profiles
  SET tokens = COALESCE(tokens, 0) + p_amount
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_tokens(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_tokens(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_tokens(UUID, INTEGER) TO service_role;

-- ==========================================
-- APP REVIEWS
-- ==========================================
CREATE TABLE app_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    review_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE app_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view app reviews" ON app_reviews FOR SELECT USING (true);
CREATE POLICY "Verified users can insert app reviews" ON app_reviews FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_verified = true)
);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_rejection_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- ==========================================
-- LOCATION RELEASES & WAITLIST
-- ==========================================
CREATE TABLE IF NOT EXISTS public.location_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state TEXT NOT NULL,
    lga TEXT,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(state, lga)
);

CREATE TABLE IF NOT EXISTS public.location_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    contact_info TEXT NOT NULL,
    state TEXT NOT NULL,
    lga TEXT NOT NULL,
    area TEXT,
    role_intent TEXT DEFAULT 'client',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.posted_tasks ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS area TEXT;

ALTER TABLE public.location_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view location settings" ON public.location_settings;
CREATE POLICY "Public can view location settings" ON public.location_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can join location waitlist" ON public.location_waitlist;
CREATE POLICY "Anyone can join location waitlist" ON public.location_waitlist FOR INSERT WITH CHECK (true);

-- ====================================================================
-- PROFILE SECURITY: PREVENT PRIVILEGE ESCALATION
-- ====================================================================
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

CREATE OR REPLACE FUNCTION public.protect_profile_critical_columns()
RETURNS trigger AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin')
     OR (auth.jwt() ->> 'role' = 'service_role')
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- 1. Prevent role escalation
  IF NEW.role = 'admin' AND (OLD.role IS NULL OR OLD.role != 'admin') THEN
    RAISE EXCEPTION 'Security Violation: You do not have permission to assign an admin role.';
  END IF;

  IF OLD.role IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Security Violation: Account role cannot be altered.';
  END IF;

  -- 2. Prevent moderation tampering
  IF NEW.is_blocked IS DISTINCT FROM OLD.is_blocked OR NEW.block_reason IS DISTINCT FROM OLD.block_reason THEN
    RAISE EXCEPTION 'Security Violation: Moderation status cannot be self-modified.';
  END IF;

  -- 3. Prevent direct token manipulation
  IF NEW.tokens IS DISTINCT FROM OLD.tokens THEN
    RAISE EXCEPTION 'Security Violation: Token balances cannot be directly altered.';
  END IF;

  -- 4. Prevent reputation & counters forgery
  IF NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.rating_count IS DISTINCT FROM OLD.rating_count
     OR NEW.completed_jobs_count IS DISTINCT FROM OLD.completed_jobs_count
     OR NEW.job_count IS DISTINCT FROM OLD.job_count
     OR NEW.task_count IS DISTINCT FROM OLD.task_count THEN
    RAISE EXCEPTION 'Security Violation: Reputation metrics cannot be directly modified.';
  END IF;

  -- 5. Prevent verification badge & tier forgery
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

