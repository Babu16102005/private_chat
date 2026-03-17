-- Run this in your Supabase SQL Editor after creating the tables
-- This file enables automatic profiles, real-time sync, and security

-- 1. Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger to automatically create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Security Functions
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

-- 4. Row Level Security (RLS) Policies

-- Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View relevant profiles" ON public.users;
CREATE POLICY "View relevant profiles" ON public.users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Update own profile" ON public.users;
CREATE POLICY "Update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Allow user creation" ON public.users;
CREATE POLICY "Allow user creation" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Pairs
ALTER TABLE public.pairs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View own pairs" ON public.pairs;
CREATE POLICY "View own pairs" ON public.pairs FOR SELECT USING (user_a_id = auth.uid() OR user_b_id = auth.uid());
DROP POLICY IF EXISTS "Create own pairs" ON public.pairs;
CREATE POLICY "Create own pairs" ON public.pairs FOR INSERT WITH CHECK (user_a_id = auth.uid() OR user_b_id = auth.uid());

-- Messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View messages from pairs" ON public.messages;
CREATE POLICY "View messages from pairs" ON public.messages FOR SELECT USING (check_pair_access(pair_id));
DROP POLICY IF EXISTS "Send messages to pairs" ON public.messages;
CREATE POLICY "Send messages to pairs" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid() AND check_pair_access(pair_id));
DROP POLICY IF EXISTS "Update read/delivered status" ON public.messages;
CREATE POLICY "Update read/delivered status" ON public.messages FOR UPDATE USING (check_pair_access(pair_id));

-- Invites
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View own invites" ON public.invites;
CREATE POLICY "View own invites" ON public.invites FOR SELECT USING (inviter_id = auth.uid() OR invitee_email = lower(auth.jwt() ->> 'email'));
DROP POLICY IF EXISTS "Update invites" ON public.invites;
CREATE POLICY "Update invites" ON public.invites FOR UPDATE USING (inviter_id = auth.uid() OR invitee_email = lower(auth.jwt() ->> 'email'));
DROP POLICY IF EXISTS "Create invites" ON public.invites;
CREATE POLICY "Create invites" ON public.invites FOR INSERT WITH CHECK (inviter_id = auth.uid());

-- 5. Enable Realtime
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users, public.pairs, public.invites, public.messages;