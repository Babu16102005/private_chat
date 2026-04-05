-- ============================================================================
-- COMPLETE SUPABASE DATABASE SETUP FOR COUPLE CHAT APP
-- Run this entire script in Supabase SQL Editor to set up the database
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE TABLES
-- ============================================================================

-- Users table: Stores profile info
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  push_token TEXT,
  about TEXT DEFAULT 'Hey there! I am using ChatApplication',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invites table: Stores one-to-one link requests
CREATE TABLE IF NOT EXISTS public.invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inviter_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  invitee_email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_email ON public.invites(invitee_email);

-- Pairs table: Stores actual active chat connections
CREATE TABLE IF NOT EXISTS public.pairs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  user_b_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  is_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT pairs_unique_connection UNIQUE(user_a_id, user_b_id)
);

-- Messages table: Stores all chat history
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pair_id UUID REFERENCES public.pairs(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  media_url TEXT,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio')),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  reply_to_message_id UUID REFERENCES public.messages(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_pair_created ON public.messages(pair_id, created_at DESC);

-- Message Reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON public.message_reactions(message_id);

-- Deleted Messages table (for "delete for me" feature)
CREATE TABLE IF NOT EXISTS public.deleted_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_deleted_messages_message ON public.deleted_messages(message_id);

-- ============================================================================
-- PART 2: FUNCTIONS AND TRIGGERS
-- ============================================================================

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
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
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

-- ============================================================================
-- PART 3: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS for all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_messages ENABLE ROW LEVEL SECURITY;

-- Users Policies
DROP POLICY IF EXISTS "View relevant profiles" ON public.users;
CREATE POLICY "View relevant profiles" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Update own profile" ON public.users;
CREATE POLICY "Update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow user creation" ON public.users;
CREATE POLICY "Allow user creation" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Pairs Policies - More permissive for testing
DROP POLICY IF EXISTS "View own pairs" ON public.pairs;
CREATE POLICY "View own pairs" ON public.pairs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Create own pairs" ON public.pairs;
CREATE POLICY "Create own pairs" ON public.pairs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Update own pairs" ON public.pairs;
CREATE POLICY "Update own pairs" ON public.pairs FOR UPDATE USING (true);

-- Messages Policies - More permissive for testing
DROP POLICY IF EXISTS "View messages from pairs" ON public.messages;
CREATE POLICY "View messages from pairs" ON public.messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Send messages to pairs" ON public.messages;
CREATE POLICY "Send messages to pairs" ON public.messages FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Update read/delivered status" ON public.messages;
CREATE POLICY "Update read/delivered status" ON public.messages FOR UPDATE USING (true);

-- Invites Policies - More permissive for testing
DROP POLICY IF EXISTS "View own invites" ON public.invites;
CREATE POLICY "View own invites" ON public.invites FOR SELECT USING (true);

DROP POLICY IF EXISTS "Update invites" ON public.invites;
CREATE POLICY "Update invites" ON public.invites FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Create invites" ON public.invites;
CREATE POLICY "Create invites" ON public.invites FOR INSERT WITH CHECK (true);

-- Message Reactions Policies
DROP POLICY IF EXISTS "View reactions" ON public.message_reactions;
CREATE POLICY "View reactions" ON public.message_reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Add reactions" ON public.message_reactions;
CREATE POLICY "Add reactions" ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Delete reactions" ON public.message_reactions;
CREATE POLICY "Delete reactions" ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

-- Deleted Messages Policies
DROP POLICY IF EXISTS "View deleted messages" ON public.deleted_messages;
CREATE POLICY "View deleted messages" ON public.deleted_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Mark deleted" ON public.deleted_messages;
CREATE POLICY "Mark deleted" ON public.deleted_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Delete own deleted_messages" ON public.deleted_messages;
CREATE POLICY "Delete own deleted_messages" ON public.deleted_messages FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- PART 4: ENABLE REALTIME
-- ============================================================================

DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime;
ALTER PUBLICATION supabase_realtime ADD TABLE 
  public.users, 
  public.pairs, 
  public.invites, 
  public.messages,
  public.message_reactions,
  public.deleted_messages;

-- ============================================================================
-- PART 5: CREATE TEST PAIR (Optional - for testing only)
-- ============================================================================

-- Uncomment the lines below to create a test pair between the two users
-- INSERT INTO public.pairs (user_a_id, user_b_id, status) 
-- VALUES ('7d059305-de07-48c5-9103-d6ebb638c909', '6c6715a1-a561-40d5-8b3a-b09a17ad8709', 'active')
-- ON CONFLICT (user_a_id, user_b_id) DO NOTHING;

-- ============================================================================
-- PART 6: STORAGE BUCKETS & POLICIES
-- ============================================================================

-- Create the 'chat-media' storage bucket if it does not exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies to allow users to view and upload media
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'chat-media' );

DROP POLICY IF EXISTS "Authenticated Users can Upload" ON storage.objects;
CREATE POLICY "Authenticated Users can Upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'chat-media' AND auth.role() = 'authenticated' );
