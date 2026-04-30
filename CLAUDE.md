# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**kiba** — a private, one-to-one chat application built for couples using React Native (Expo ~54) + Supabase backend. Supports real-time messaging, WebRTC video/audio calls, message reactions, media sharing, and invite-based pairing.

## Tech Stack

- **Frontend**: React Native 0.81, Expo SDK ~54, TypeScript, React 19
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Navigation**: React Navigation native stack (`createNativeStackNavigator`)
- **Realtime**: Supabase Realtime Channels (messages, typing indicators, presence, reactions, call signaling)
- **Calls**: react-native-webrtc with @config-plugins/react-native-webrtc
- **Styling**: expo-linear-gradient, expo-blur, custom themes (Obsidian / Mocha dark modes)
- **Notifications**: expo-notifications for push
- **Storage**: Supabase Storage (`chat-media` bucket)

## Directory Structure

```
frontend/
  App.tsx                          # Root: providers + NavigationContainer
  eas.json                         # EAS build profiles (development/preview/production)
  app.json                         # Expo config (deep link scheme: chatapp://)
  src/
    context/
      AuthContext.tsx              # Auth state, session management, profile auto-creation
      ThemeContext.tsx             # Theme mode (obsidian/mocha), color system
      CallContext.tsx              # WebRTC call state, signaling, peer connections
    screens/
      LoginScreen.tsx
      SignupScreen.tsx
      ForgotPasswordScreen.tsx
      HomeScreen.tsx               # Pair list / invite flow
      ChatScreen.tsx               # Realtime messaging
      CallScreen.tsx               # WebRTC video/audio call UI
      ProfileScreen.tsx
      InviteScreen.tsx             # Accept/manage invites
      ChatSettingsScreen.tsx       # Block/unblock, clear chat
    services/
      supabase.ts                  # Supabase client (hardcoded fallbacks + env vars)
      supabaseService.ts           # All service functions (auth, profile, message, storage, reactions, delete, chat settings, invites)
    components/
      MessageBubble.tsx            # Message UI component
      MediaPicker.tsx              # Media selection component
      ImageViewer.tsx              # Full-screen image viewer
      MediaViewer.tsx              # Media preview component
    navigation/
      AppNavigator.tsx             # Auth-gated native stack
      types.ts                     # RootStackParamList
    hooks/
      usePushNotifications.ts
    constants/
      theme.ts                     # Base design tokens (colors, spacing, radius)
    utils/
      date.ts                      # Date formatting utilities
      errorHandler.ts              # Centralized error handling
```

## Commands

### Development
- `cd frontend && npm install` — install dependencies
- `cd frontend && npx expo start` — start Expo dev server
- `cd frontend && npx expo start --android` — run on Android
- `cd frontend && npx expo start --ios` — run on iOS
- `cd frontend && npx expo start --web` — run on web

### Build (EAS)
- `cd frontend && eas build --profile development` — development build (requires dev client)
- `cd frontend && eas build --profile preview` — preview build (internal distribution)
- `cd frontend && eas build --profile production` — production build (auto-incrementing version)

### Testing & Linting
- **Unit Tests**: No test framework, linter, or type-check script is configured.
- **E2E Tests**: `cd frontend && node test-e2e.js` — REST API-level integration test suite (tests auth, pairs, messaging, reactions, delete, chat settings, storage, unread count fix verification).

### TypeScript
- `cd frontend && npx tsc --noEmit` — type-check without emitting output.
- `tsconfig.json` extends Expo's base config with strict mode enabled.

## Architecture

### Provider Hierarchy

`App.tsx` wraps everything in:
```
ThemeProvider → AuthProvider → CallProvider → NavigationContainer → AppNavigator
                                                                        (CallScreen rendered outside nav)
```

### Auth Flow

- **AuthContext** initializes by calling `supabase.auth.getSession()`, then auto-creates a `users` profile row if none exists.
- Listens to `onAuthStateChange` for session updates; also creates missing profiles on sign-in.
- **AppNavigator** renders auth screens (Login/Signup/ForgotPassword) when `session` is null, or app screens (Home/Chat/Invite/Profile/ChatSettings) when authenticated.
- Session persists via AsyncStorage with `autoRefreshToken: true`.

### Service Layer (`supabaseService.ts`)

Single file exporting these service objects:

| Service | Key Functions |
|---------|--------------|
| `authService` | signUp, signIn, signOut, resetPassword, updatePassword, getCurrentUser |
| `profileService` | getProfile, updateProfile, createUserProfile |
| `inviteService` | sendInvite, acceptInvite, getPendingInvites, getMyPairs, getMyPair, subscribeToInvites |
| `messageService` | getMessages (paginated), sendMessage, markMessageAsRead, markMessagesAsDelivered, subscribeToMessages, subscribeToTyping, sendTypingIndicator, subscribeToPresence, getRepliedMessage |
| `storageService` | uploadFile |
| `messageReactionsService` | addReaction, removeReaction, getReactions, subscribeToReactions |
| `deleteMessageService` | deleteForMe, isDeletedForMe, getDeletedIdsForUser (batch check) |
| `chatSettingsService` | blockUser, unblockUser, clearChat |

### Realtime System

- **Messages**: Per-pair channel (`messages:${pairId}`), listens for INSERT on `messages` table.
- **Typing**: Presence channel (`typing:${pairId}`), tracks `is_typing` state.
- **Presence**: Presence channel (`presence:${pairId}`), tracks partner online status.
- **Reactions**: Per-message channel (`reactions:${messageId}`), listens for INSERT/UPDATE/DELETE on `message_reactions`.
- **Calls**: Per-user broadcast channel (`calls:${userId}`) for call-offer, call-answer, ice-candidate, call-hangup events.
- **Invites**: Global channel listening for INSERT on `invites` table.

### Call System (`CallContext.tsx`)

- **WebRTC** via `react-native-webrtc` with platform-conditional imports (native module vs. browser APIs).
- **Signaling** over Supabase Realtime broadcast channels — noTURN server configured, only Google STUN servers.
- **Signaling events**: `call-offer`, `call-answer`, `ice-candidate`, `call-hangup`.
- **States**: IDLE → RINGING → CONNECTED / REJECTED / ENDED.
- Incoming calls are ignored if already in a non-IDLE state.
- Inbound channel: subscribes to `calls:${userId}` for incoming signals. Outbound channels are created per-call for signaling to a specific partner.

### Navigation

All app screens share one flat native stack. No nested navigators. Auth gating is handled by conditional rendering of `Stack.Screen` entries based on session presence.

### Database Schema

Tables: `users`, `pairs`, `messages`, `invites`, `message_reactions`, `deleted_messages`. Full schema with RLS policies, triggers, and storage bucket setup is in `supabase_setup.sql`.

- `pairs` enforces unique connections via `UNIQUE(user_a_id, user_b_id)` constraint.
- Auto-profile creation via `on_auth_user_created` trigger.
- `check_pair_access()` security function validates pair membership.
- RLS policies are permissive (all SELECT/INSERT allowed for testing).

### Supabase Config

`frontend/src/services/supabase.ts` has hardcoded fallback credentials. Production should use `.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Always prefer env vars over the hardcoded values.
