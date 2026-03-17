-- 1. CLEAN START (Optional: Uncomment to delete existing data)
-- DROP TABLE IF EXISTS public.messages;
-- DROP TABLE IF EXISTS public.invites;
-- DROP TABLE IF EXISTS public.pairs;
-- DROP TABLE IF EXISTS public.users;

-- 2. CREATE TABLES
-- Users table: Stores profile info
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  push_token TEXT,
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
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video')),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_pair_created ON public.messages(pair_id, created_at DESC);
