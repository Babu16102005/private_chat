
# 💬 CoupleChat – Full AI Development Master Prompt
## React Native + FastAPI + Supabase

---

# 🎯 PROJECT OVERVIEW

Build a production-grade one-to-one private chat application similar to WhatsApp with the following constraints:

- Login via Email + Password only
- Strictly One-to-One chat (No groups)
- Invite partner via email
- Only one active partner per user
- Built for couples
- Scalable and secure architecture

---

# 🛠 TECH STACK

Frontend:
- React Native (TypeScript)
- React Navigation
- Supabase JS SDK
- Firebase Cloud Messaging (FCM)

Backend:
- FastAPI (Async)
- Supabase PostgreSQL
- Supabase Storage
- JWT Authentication

---

# 📱 FRONTEND REQUIREMENTS

Generate complete project with:

## Folder Structure
src/
 ├── navigation/
 ├── screens/
 ├── components/
 ├── services/
 ├── hooks/
 ├── context/
 ├── utils/
 ├── types/
 ├── constants/
 └── assets/

## Authentication
- Signup
- Login
- Forgot password
- Email verification
- Persistent login

## Invitation Flow
1. Send invite to email
2. Backend generates token
3. Deep link: couplechat://accept?token=XYZ
4. Validate token
5. Create pair

Include:
- Deep linking setup (Android + iOS)
- API integration layer

## Chat Features
- Text messaging
- Message bubbles (left/right)
- Timestamp
- Sent/Delivered/Read ticks
- Typing indicator
- Online/offline presence
- Pagination
- Auto-scroll

## Media Messaging
- Image picker
- Video upload (max 30s)
- Upload to Supabase Storage
- Lazy loading

## Realtime
- Subscribe to new messages
- Subscribe to presence
- Subscribe to typing

## Push Notifications
- FCM setup
- Token registration
- Foreground + background handling

---

# ⚙️ BACKEND REQUIREMENTS (FastAPI)

## Folder Structure
app/
 ├── main.py
 ├── api/
 ├── models/
 ├── schemas/
 ├── services/
 ├── core/
 ├── utils/
 └── db/

## API Endpoints

Auth:
- POST /signup
- POST /login
- POST /reset-password

Invite:
- POST /invite
- POST /accept-invite

Messages:
- GET /messages/{pair_id}
- POST /messages
- PATCH /messages/read

Profile:
- GET /me
- PUT /me

---

# 🗄 SUPABASE DATABASE SCHEMA

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_a_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    user_b_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_a_id),
    UNIQUE(user_b_id)
);

CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pair_id UUID REFERENCES public.pairs(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT,
    media_url TEXT,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text','image','video')),
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_pair_created 
ON public.messages(pair_id, created_at DESC);

CREATE TABLE public.invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inviter_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    invitee_email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_invites_email ON public.invites(invitee_email);
```

---

# 🔐 ROW LEVEL SECURITY (RLS)

```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile"
ON public.users FOR ALL
USING (auth.uid() = id);

CREATE POLICY "Access own pair"
ON public.pairs FOR SELECT
USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY "Access own messages"
ON public.messages FOR SELECT
USING (
 EXISTS (
   SELECT 1 FROM public.pairs
   WHERE pairs.id = messages.pair_id
   AND (pairs.user_a_id = auth.uid() OR pairs.user_b_id = auth.uid())
 )
);

CREATE POLICY "Insert own messages"
ON public.messages FOR INSERT
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Inviter manages invites"
ON public.invites FOR ALL
USING (inviter_id = auth.uid());
```

---

# 📈 PERFORMANCE

- Index pair_id + created_at
- Use pagination
- Compress images
- Avoid N+1 queries
- Async FastAPI

---

# 🧪 TESTING

Backend:
- Pytest
- Integration tests

Frontend:
- Jest
- RN Testing Library
- Detox E2E

---

# 🚀 DEPLOYMENT

Backend:
- Docker
- Gunicorn + Uvicorn
- Deploy on AWS / Railway / Render

Mobile:
- Android AAB
- iOS IPA

---

# 🎨 UI DESIGN

- WhatsApp-like UI
- Soft romantic theme
- Custom wallpaper
- Smooth animations
- Clean minimal layout

---

# 🔒 OPTIONAL: END-TO-END ENCRYPTION

Future integration using Signal Protocol:
- Key exchange
- Forward secrecy
- Encrypt before send
- Decrypt on receive

---

# 🛑 IMPORTANT RULES

- Clean architecture
- SOLID principles
- Production-level code
- Fully scalable
- Async everywhere
- Proper validation
- Secure APIs

---

# 🎯 OUTPUT REQUIREMENT

When generating the app:
1. Provide full working code
2. File-by-file structure
3. Environment variables example
4. Setup instructions
5. Deployment steps

Build this as a real startup-grade application.
