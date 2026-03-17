-- COMPLETE SUPABASE SETUP SCRIPT
-- This script deletes everything and recreates the entire database structure
-- for the Private Chat Application.
-- ⚠️ WARNING: Running this will delete all existing data.

-- 1. DELETE EVERYTHING (Clean Start)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.check_pair_access(UUID);
DROP TABLE IF EXISTS public.messages;
DROP TABLE IF EXISTS public.invites;
DROP TABLE IF EXISTS public.pairs;
DROP TABLE IF EXISTS public.users;

-- 2. CREATE TABLES
-- Users table: Stores profile info
CREATE TABLE public.users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  push_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invites table: Stores one-to-one link requests
CREATE TABLE public.invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inviter_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  invitee_email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invites_email ON public.invites(invitee_email);

-- Pairs table: Stores actual active chat connections
CREATE TABLE public.pairs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  user_b_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT pairs_unique_connection UNIQUE(user_a_id, user_b_id)
);

-- Messages table: Stores all chat history
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pair_id UUID REFERENCES public.pairs(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  media_url TEXT,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video')),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_pair_created ON public.messages(pair_id, created_at DESC);

-- 3. FUNCTIONS AND TRIGGERS
-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Security function to check if a user belongs to a pair
CREATE OR REPLACE FUNCTION public.check_pair_access(p_pair_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.pairs
    WHERE id = p_pair_id
    AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- Enable RLS for all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Users Policies
DROP POLICY IF EXISTS "View relevant profiles" ON public.users;
CREATE POLICY "View relevant profiles" ON public.users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Update own profile" ON public.users;
CREATE POLICY "Update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Allow user creation" ON public.users;
CREATE POLICY "Allow user creation" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Pairs Policies
DROP POLICY IF EXISTS "View own pairs" ON public.pairs;
CREATE POLICY "View own pairs" ON public.pairs FOR SELECT USING (user_a_id = auth.uid() OR user_b_id = auth.uid());
DROP POLICY IF EXISTS "Create own pairs" ON public.pairs;
CREATE POLICY "Create own pairs" ON public.pairs FOR INSERT WITH CHECK (user_a_id = auth.uid() OR user_b_id = auth.uid());

-- Messages Policies
DROP POLICY IF EXISTS "View messages from pairs" ON public.messages;
CREATE POLICY "View messages from pairs" ON public.messages FOR SELECT USING (check_pair_access(pair_id));
DROP POLICY IF EXISTS "Send messages to pairs" ON public.messages;
CREATE POLICY "Send messages to pairs" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid() AND check_pair_access(pair_id));
DROP POLICY IF EXISTS "Update read/delivered status" ON public.messages;
CREATE POLICY "Update read/delivered status" ON public.messages FOR UPDATE USING (check_pair_access(pair_id));

-- Invites Policies
DROP POLICY IF EXISTS "View own invites" ON public.invites;
CREATE POLICY "View own invites" ON public.invites FOR SELECT USING (inviter_id = auth.uid() OR invitee_email = lower(auth.jwt() ->> 'email'));
DROP POLICY IF EXISTS "Update invites" ON public.invites;
CREATE POLICY "Update invites" ON public.invites FOR UPDATE USING (inviter_id = auth.uid() OR invitee_email = lower(auth.jwt() ->> 'email'));
DROP POLICY IF EXISTS "Create invites" ON public.invites;
CREATE POLICY "Create invites" ON public.invites FOR INSERT WITH CHECK (inviter_id = auth.uid());

-- 5. ENABLE REALTIME
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users, public.pairs, public.invites, public.messages;
