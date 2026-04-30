-- ============================================================================
-- COUPLCHAT — COMPLETE SUPABASE DATABASE SETUP
-- Run the full file for a fresh database.
-- For an existing database, run only PART 7 (Migration Fixes) at the bottom.
-- ============================================================================


-- ============================================================================
-- PART 1: TABLES
-- ============================================================================

-- Users: profile info linked to Supabase auth
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID        REFERENCES auth.users NOT NULL PRIMARY KEY,
  email       TEXT        UNIQUE NOT NULL,
  name        TEXT,
  avatar_url  TEXT,
  push_token  TEXT,
  about       TEXT        DEFAULT 'Hey there! I am using CoupleChat',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Invites: one-to-one link requests
CREATE TABLE IF NOT EXISTS public.invites (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  inviter_id     UUID        REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  invitee_email  TEXT        NOT NULL,
  token          TEXT        UNIQUE NOT NULL,
  accepted_at    TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_email ON public.invites(invitee_email);

-- Pairs: active chat connections between two users
CREATE TABLE IF NOT EXISTS public.pairs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a_id   UUID        REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  user_b_id   UUID        REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  status      TEXT        DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  is_blocked  BOOLEAN     DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT pairs_unique_connection UNIQUE (user_a_id, user_b_id)
);

-- Messages: full chat history
CREATE TABLE IF NOT EXISTS public.messages (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  pair_id              UUID        REFERENCES public.pairs(id)    ON DELETE CASCADE NOT NULL,
  sender_id            UUID        REFERENCES public.users(id)    ON DELETE CASCADE NOT NULL,
  content              TEXT,
  media_url            TEXT,
  message_type         TEXT        DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'voice', 'document', 'system_call', 'encrypted')),
  file_name            TEXT,
  file_size            BIGINT,
  mime_type            TEXT,
  call_started_at      TIMESTAMPTZ,
  call_ended_at        TIMESTAMPTZ,
  call_duration_seconds INTEGER,
  call_kind            TEXT        CHECK (call_kind IS NULL OR call_kind IN ('audio', 'video')),
  call_status          TEXT        CHECK (call_status IS NULL OR call_status IN ('completed', 'missed', 'rejected', 'cancelled')),
  delivered_at         TIMESTAMPTZ,
  read_at              TIMESTAMPTZ,
  reply_to_message_id  UUID        REFERENCES public.messages(id),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_pair_created ON public.messages(pair_id, created_at DESC);

-- Stories: 24-hour status updates shared with paired users
CREATE TABLE IF NOT EXISTS public.stories (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  media_url   TEXT        NOT NULL,
  media_type  TEXT        NOT NULL CHECK (media_type IN ('image', 'video')),
  caption     TEXT,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stories_user_expires ON public.stories(user_id, expires_at DESC);

-- Story Views: one view marker per user per story
CREATE TABLE IF NOT EXISTS public.story_views (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id   UUID        REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  viewer_id  UUID        REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  viewed_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_story_views_story ON public.story_views(story_id);

-- Optional E2EE foundation. App-level encryption can store only public material here.
CREATE TABLE IF NOT EXISTS public.user_crypto_keys (
  user_id              UUID        REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  identity_public_key  TEXT        NOT NULL,
  signed_prekey        TEXT,
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Message Reactions: one emoji reaction per user per message
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id  UUID        REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID        REFERENCES public.users(id)    ON DELETE CASCADE NOT NULL,
  emoji       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON public.message_reactions(message_id);

-- Deleted Messages: per-user soft delete ("delete for me")
CREATE TABLE IF NOT EXISTS public.deleted_messages (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id  UUID        REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID        REFERENCES public.users(id)    ON DELETE CASCADE NOT NULL,
  deleted_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_deleted_messages_message ON public.deleted_messages(message_id);

-- Chat Settings: per-user, per-chat preferences
CREATE TABLE IF NOT EXISTS public.chat_settings (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  pair_id        UUID        REFERENCES public.pairs(id) ON DELETE CASCADE NOT NULL,
  user_id        UUID        REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  background_id  TEXT        DEFAULT 'aurora' NOT NULL,
  background_image_url TEXT,
  background_opacity   NUMERIC(4, 2) DEFAULT 0.38 NOT NULL CHECK (background_opacity >= 0.12 AND background_opacity <= 0.85),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chat_settings_unique_pair_user UNIQUE (pair_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_settings_pair_user ON public.chat_settings(pair_id, user_id);


-- ============================================================================
-- PART 2: FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-create user profile row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper: check if the current user belongs to a given pair
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
-- PART 3: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_crypto_keys  ENABLE ROW LEVEL SECURITY;

-- ── users ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "View relevant profiles" ON public.users;
CREATE POLICY "View relevant profiles" ON public.users
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Update own profile" ON public.users;
CREATE POLICY "Update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow user creation" ON public.users;
CREATE POLICY "Allow user creation" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ── pairs ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "View own pairs" ON public.pairs;
CREATE POLICY "View own pairs" ON public.pairs
  FOR SELECT USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "Create own pairs" ON public.pairs;
CREATE POLICY "Create own pairs" ON public.pairs
  FOR INSERT WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "Update own pairs" ON public.pairs;
CREATE POLICY "Update own pairs" ON public.pairs
  FOR UPDATE USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- ── messages ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "View messages from pairs" ON public.messages;
CREATE POLICY "View messages from pairs" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pairs
      WHERE pairs.id = messages.pair_id
        AND (pairs.user_a_id = auth.uid() OR pairs.user_b_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Send messages to pairs" ON public.messages;
CREATE POLICY "Send messages to pairs" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.pairs
      WHERE pairs.id = pair_id
        AND (pairs.user_a_id = auth.uid() OR pairs.user_b_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Update read/delivered status" ON public.messages;
CREATE POLICY "Update read/delivered status" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.pairs
      WHERE pairs.id = messages.pair_id
        AND (pairs.user_a_id = auth.uid() OR pairs.user_b_id = auth.uid())
    )
  );

-- ── stories ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "View own and paired stories" ON public.stories;
CREATE POLICY "View own and paired stories" ON public.stories
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.pairs
      WHERE status = 'active'
        AND (
          (user_a_id = auth.uid() AND user_b_id = stories.user_id)
          OR (user_b_id = auth.uid() AND user_a_id = stories.user_id)
        )
    )
  );

DROP POLICY IF EXISTS "Create own stories" ON public.stories;
CREATE POLICY "Create own stories" ON public.stories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Delete own stories" ON public.stories;
CREATE POLICY "Delete own stories" ON public.stories
  FOR DELETE USING (auth.uid() = user_id);

-- ── story_views ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "View story views for visible stories" ON public.story_views;
CREATE POLICY "View story views for visible stories" ON public.story_views
  FOR SELECT USING (
    viewer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.stories
      WHERE stories.id = story_views.story_id
        AND stories.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Create own story views" ON public.story_views;
CREATE POLICY "Create own story views" ON public.story_views
  FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- ── user_crypto_keys ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "View paired public crypto keys" ON public.user_crypto_keys;
CREATE POLICY "View paired public crypto keys" ON public.user_crypto_keys
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.pairs
      WHERE status = 'active'
        AND (
          (user_a_id = auth.uid() AND user_b_id = user_crypto_keys.user_id)
          OR (user_b_id = auth.uid() AND user_a_id = user_crypto_keys.user_id)
        )
    )
  );

DROP POLICY IF EXISTS "Upsert own public crypto keys" ON public.user_crypto_keys;
CREATE POLICY "Upsert own public crypto keys" ON public.user_crypto_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update own public crypto keys" ON public.user_crypto_keys;
CREATE POLICY "Update own public crypto keys" ON public.user_crypto_keys
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── invites ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "View own invites" ON public.invites;
CREATE POLICY "View own invites" ON public.invites
  FOR SELECT USING (
    auth.uid() = inviter_id
    OR invitee_email = (SELECT email FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Create invites" ON public.invites;
CREATE POLICY "Create invites" ON public.invites
  FOR INSERT WITH CHECK (auth.uid() = inviter_id);

DROP POLICY IF EXISTS "Update invites" ON public.invites;
CREATE POLICY "Update invites" ON public.invites
  FOR UPDATE USING (
    auth.uid() = inviter_id
    OR invitee_email = (SELECT email FROM public.users WHERE id = auth.uid())
  );

-- ── message_reactions ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "View reactions" ON public.message_reactions;
CREATE POLICY "View reactions" ON public.message_reactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Add reactions" ON public.message_reactions;
CREATE POLICY "Add reactions" ON public.message_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Delete reactions" ON public.message_reactions;
CREATE POLICY "Delete reactions" ON public.message_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- ── deleted_messages ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "View deleted messages" ON public.deleted_messages;
CREATE POLICY "View deleted messages" ON public.deleted_messages
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Mark deleted" ON public.deleted_messages;
CREATE POLICY "Mark deleted" ON public.deleted_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Delete own deleted_messages" ON public.deleted_messages;
CREATE POLICY "Delete own deleted_messages" ON public.deleted_messages
  FOR DELETE USING (auth.uid() = user_id);

-- ── chat_settings ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "View own chat settings" ON public.chat_settings;
CREATE POLICY "View own chat settings" ON public.chat_settings
  FOR SELECT USING (
    auth.uid() = user_id
    AND public.check_pair_access(pair_id)
  );

DROP POLICY IF EXISTS "Create own chat settings" ON public.chat_settings;
CREATE POLICY "Create own chat settings" ON public.chat_settings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND public.check_pair_access(pair_id)
  );

DROP POLICY IF EXISTS "Update own chat settings" ON public.chat_settings;
CREATE POLICY "Update own chat settings" ON public.chat_settings
  FOR UPDATE USING (
    auth.uid() = user_id
    AND public.check_pair_access(pair_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.check_pair_access(pair_id)
  );


-- ============================================================================
-- PART 4: REALTIME
-- ============================================================================

DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime;
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.users,
  public.pairs,
  public.invites,
  public.messages,
  public.message_reactions,
  public.deleted_messages,
  public.chat_settings,
  public.stories,
  public.story_views;


-- ============================================================================
-- PART 5: STORAGE
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "Authenticated Users can Upload" ON storage.objects;
CREATE POLICY "Authenticated Users can Upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);


-- ============================================================================
-- PART 6: SEED (optional — uncomment to create the test pair)
-- ============================================================================

-- INSERT INTO public.pairs (user_a_id, user_b_id, status)
-- VALUES (
--   '7d059305-de07-48c5-9103-d6ebb638c909',
--   '6c6715a1-a561-40d5-8b3a-b09a17ad8709',
--   'active'
-- )
-- ON CONFLICT (user_a_id, user_b_id) DO NOTHING;


-- ============================================================================
-- PART 7: MIGRATION — existing live database only
-- Run ONLY this block if the schema already exists.
-- All statements are idempotent (safe to re-run).
-- ============================================================================

-- Fix 1: One reaction per user per message (drop old 3-col constraint first)
ALTER TABLE public.message_reactions
  DROP CONSTRAINT IF EXISTS message_reactions_message_id_user_id_emoji_key;
ALTER TABLE public.message_reactions
  DROP CONSTRAINT IF EXISTS message_reactions_message_id_user_id_key;
ALTER TABLE public.message_reactions
  ADD CONSTRAINT message_reactions_message_id_user_id_key UNIQUE (message_id, user_id);

-- Fix 2: Users — authenticated reads, own-row updates
DROP POLICY IF EXISTS "View relevant profiles" ON public.users;
CREATE POLICY "View relevant profiles" ON public.users
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Update own profile" ON public.users;
CREATE POLICY "Update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Fix 3: Pairs — members only
DROP POLICY IF EXISTS "View own pairs" ON public.pairs;
CREATE POLICY "View own pairs" ON public.pairs
  FOR SELECT USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "Create own pairs" ON public.pairs;
CREATE POLICY "Create own pairs" ON public.pairs
  FOR INSERT WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "Update own pairs" ON public.pairs;
CREATE POLICY "Update own pairs" ON public.pairs
  FOR UPDATE USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- Fix 4: Messages — pair members only
DROP POLICY IF EXISTS "View messages from pairs" ON public.messages;
CREATE POLICY "View messages from pairs" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pairs
      WHERE pairs.id = messages.pair_id
        AND (pairs.user_a_id = auth.uid() OR pairs.user_b_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Send messages to pairs" ON public.messages;
CREATE POLICY "Send messages to pairs" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.pairs
      WHERE pairs.id = pair_id
        AND (pairs.user_a_id = auth.uid() OR pairs.user_b_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Update read/delivered status" ON public.messages;
CREATE POLICY "Update read/delivered status" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.pairs
      WHERE pairs.id = messages.pair_id
        AND (pairs.user_a_id = auth.uid() OR pairs.user_b_id = auth.uid())
    )
  );

-- Fix 5: Invites — inviter or invitee only
DROP POLICY IF EXISTS "View own invites" ON public.invites;
CREATE POLICY "View own invites" ON public.invites
  FOR SELECT USING (
    auth.uid() = inviter_id
    OR invitee_email = (SELECT email FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Update invites" ON public.invites;
CREATE POLICY "Update invites" ON public.invites
  FOR UPDATE USING (
    auth.uid() = inviter_id
    OR invitee_email = (SELECT email FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Create invites" ON public.invites;
CREATE POLICY "Create invites" ON public.invites
  FOR INSERT WITH CHECK (auth.uid() = inviter_id);

-- Fix 6: Chat Settings — per-user, per-chat background preferences
CREATE TABLE IF NOT EXISTS public.chat_settings (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  pair_id        UUID        REFERENCES public.pairs(id) ON DELETE CASCADE NOT NULL,
  user_id        UUID        REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  background_id  TEXT        DEFAULT 'aurora' NOT NULL,
  background_image_url TEXT,
  background_opacity   NUMERIC(4, 2) DEFAULT 0.38 NOT NULL CHECK (background_opacity >= 0.12 AND background_opacity <= 0.85),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chat_settings_unique_pair_user UNIQUE (pair_id, user_id)
);

ALTER TABLE public.chat_settings
  ADD COLUMN IF NOT EXISTS background_image_url TEXT;

ALTER TABLE public.chat_settings
  ADD COLUMN IF NOT EXISTS background_opacity NUMERIC(4, 2) DEFAULT 0.38 NOT NULL;

ALTER TABLE public.chat_settings
  DROP CONSTRAINT IF EXISTS chat_settings_background_opacity_range;
ALTER TABLE public.chat_settings
  ADD CONSTRAINT chat_settings_background_opacity_range CHECK (background_opacity >= 0.12 AND background_opacity <= 0.85);

CREATE INDEX IF NOT EXISTS idx_chat_settings_pair_user ON public.chat_settings(pair_id, user_id);

ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own chat settings" ON public.chat_settings;
CREATE POLICY "View own chat settings" ON public.chat_settings
  FOR SELECT USING (
    auth.uid() = user_id
    AND public.check_pair_access(pair_id)
  );

DROP POLICY IF EXISTS "Create own chat settings" ON public.chat_settings;
CREATE POLICY "Create own chat settings" ON public.chat_settings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND public.check_pair_access(pair_id)
  );

DROP POLICY IF EXISTS "Update own chat settings" ON public.chat_settings;
CREATE POLICY "Update own chat settings" ON public.chat_settings
  FOR UPDATE USING (
    auth.uid() = user_id
    AND public.check_pair_access(pair_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.check_pair_access(pair_id)
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'chat_settings'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_settings;
    END IF;
  END IF;
END $$;

-- Refresh PostgREST schema cache so the app can see chat_settings immediately.
NOTIFY pgrst, 'reload schema';

-- Fix 7: WhatsApp-style communication features (calls, documents, stories, E2EE foundation)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS call_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS call_ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS call_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS call_kind TEXT,
  ADD COLUMN IF NOT EXISTS call_status TEXT;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_message_type_check CHECK (message_type IN ('text', 'image', 'video', 'audio', 'voice', 'document', 'system_call', 'encrypted'));

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_call_kind_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_call_kind_check CHECK (call_kind IS NULL OR call_kind IN ('audio', 'video'));

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_call_status_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_call_status_check CHECK (call_status IS NULL OR call_status IN ('completed', 'missed', 'rejected', 'cancelled'));

CREATE TABLE IF NOT EXISTS public.stories (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  media_url   TEXT        NOT NULL,
  media_type  TEXT        NOT NULL CHECK (media_type IN ('image', 'video')),
  caption     TEXT,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stories_user_expires ON public.stories(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.story_views (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id   UUID        REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  viewer_id  UUID        REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  viewed_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_story_views_story ON public.story_views(story_id);

CREATE TABLE IF NOT EXISTS public.user_crypto_keys (
  user_id              UUID        REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  identity_public_key  TEXT        NOT NULL,
  signed_prekey        TEXT,
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_crypto_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own and paired stories" ON public.stories;
CREATE POLICY "View own and paired stories" ON public.stories
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.pairs
      WHERE status = 'active'
        AND (
          (user_a_id = auth.uid() AND user_b_id = stories.user_id)
          OR (user_b_id = auth.uid() AND user_a_id = stories.user_id)
        )
    )
  );

DROP POLICY IF EXISTS "Create own stories" ON public.stories;
CREATE POLICY "Create own stories" ON public.stories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Delete own stories" ON public.stories;
CREATE POLICY "Delete own stories" ON public.stories
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "View story views for visible stories" ON public.story_views;
CREATE POLICY "View story views for visible stories" ON public.story_views
  FOR SELECT USING (
    viewer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.stories
      WHERE stories.id = story_views.story_id
        AND stories.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Create own story views" ON public.story_views;
CREATE POLICY "Create own story views" ON public.story_views
  FOR INSERT WITH CHECK (auth.uid() = viewer_id);

DROP POLICY IF EXISTS "View paired public crypto keys" ON public.user_crypto_keys;
CREATE POLICY "View paired public crypto keys" ON public.user_crypto_keys
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.pairs
      WHERE status = 'active'
        AND (
          (user_a_id = auth.uid() AND user_b_id = user_crypto_keys.user_id)
          OR (user_b_id = auth.uid() AND user_a_id = user_crypto_keys.user_id)
        )
    )
  );

DROP POLICY IF EXISTS "Upsert own public crypto keys" ON public.user_crypto_keys;
CREATE POLICY "Upsert own public crypto keys" ON public.user_crypto_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update own public crypto keys" ON public.user_crypto_keys;
CREATE POLICY "Update own public crypto keys" ON public.user_crypto_keys
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'stories'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'story_views'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views;
    END IF;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
