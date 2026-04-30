# AGENTS.md

 Repository guide for agentic coding assistants working in `D:\babu_projects\private_chat_app`.

 ## Project Snapshot

- App name: `kiba`
 - Stack: React Native + Expo 54 + TypeScript + Supabase + React Navigation + WebRTC
 - Main app folder: `frontend`
 - Backend logic lives mostly in Supabase and `frontend/src/services/supabaseService.ts`
 - Navigation is a flat native stack with auth gating in `frontend/src/navigation/AppNavigator.tsx`
 - Providers are composed in `frontend/App.tsx`

## Agent Priorities

- Prefer small, targeted edits over broad refactors.
- Preserve the product direction: a polished, theme-heavy private chat app.
- Respect the `obsidian` and `mocha` themes unless the task explicitly changes design.
- Avoid generic boilerplate and unnecessary new dependencies.

 ## Source Of Truth

 - App bootstrap: `frontend/App.tsx`
 - Auth/session flow: `frontend/src/context/AuthContext.tsx`
 - Theme system: `frontend/src/context/ThemeContext.tsx`
 - Call state and signaling: `frontend/src/context/CallContext.tsx`
 - Supabase client: `frontend/src/services/supabase.ts`
 - Service layer: `frontend/src/services/supabaseService.ts`
 - Navigation types: `frontend/src/navigation/types.ts`
 - Shared error UI: `frontend/src/utils/errorHandler.ts`

 ## Commands

 Run all commands from `frontend` unless noted otherwise.

### Install

- `npm install` - install dependencies

 ### Development

 - `npm run start` - start Expo dev server
 - `npm run android` - run Android native build via Expo
 - `npm run ios` - run iOS native build via Expo
 - `npm run web` - run web target
 - `npx expo start --clear` - clear Metro cache when bundling gets stuck

 ### Type Checking

 - `npx tsc --noEmit` - primary static verification command

 ### Lint / Formatting

- There is no ESLint script, Prettier script, or formatter config in `frontend/package.json`.
- Do not claim lint passed unless you actually added and ran a lint tool.
- Treat `npx tsc --noEmit` as the minimum automated quality gate today.

 ### Tests

- `node test-e2e.js` - run the backend-oriented Supabase E2E suite
- The suite is not wired into `package.json`; call it directly with Node.
- It uses real Supabase credentials and seeded users, so expect network dependency and stateful behavior.

 ### Running A Single Test

- There is no built-in single-test runner, Jest config, or per-spec CLI filter.
- `test-e2e.js` contains standalone functions like `testAuth`, `testPairs`, `testMessaging`, `testReactions`, `testDeleteForMe`, `testChatSettings`, `testStorage`, and `testUnreadCountBugFix`.
- To run one area only, temporarily edit `main()` in `test-e2e.js` to call just the target flow after any required setup, run `node test-e2e.js`, then revert only that harness change.
- Do not document or imply fake commands like `npm test -- testName`; they do not exist here.

 ### Build / Release

- `eas build --profile development` - dev client build
- `eas build --profile preview` - internal preview build
- `eas build --profile production` - production build
- EAS profiles are defined in `frontend/eas.json`

 ## Environment Notes

 - Deep link scheme: `chatapp://`
 - Expo config: `frontend/app.json`
 - TypeScript is strict; config lives in `frontend/tsconfig.json`
- Path alias exists: `@/* -> src/*`, but current source mostly uses relative imports.

 ## Cursor / Copilot Rules

- No `.cursor/rules/` directory was found.
- No `.cursorrules` file was found.
- No `.github/copilot-instructions.md` file was found.
- Follow this file plus existing in-repo conventions instead.

 ## Code Style

 ### Imports

- Keep imports grouped as React, third-party, then local modules.
- Separate major groups with a blank line when it helps readability.
- Prefer the existing relative import style inside `src` unless you are cleaning a file consistently.
- Import React hooks by name and remove unused imports in touched files.

 ### Formatting

- Follow the existing style in touched files instead of reformatting whole files.
- Use semicolons and single quotes.
- Keep object literals and JSX readable rather than aggressively compact.
- Use `StyleSheet.create` for screen/component styles when that pattern already exists.

 ### Types

- Prefer explicit TypeScript types for public props, context values, navigation params, and service inputs.
- Reuse or extend existing types before inventing parallel shapes.
- `any` exists in the repo; do not spread it further unless the boundary is genuinely hard to type.
- Keep navigation params aligned with `frontend/src/navigation/types.ts`.

 ### Naming

- Components, contexts, and screens use PascalCase.
- Hooks and helper functions use camelCase.
- Boolean flags should read clearly, for example `isLoading`, `isIncoming`, `hasUnread`, `isCameraOff`.
- Service objects use noun-based names like `authService`, `inviteService`, and `messageService`.

 ### React / React Native Patterns

- Prefer functional components and hooks.
- Guard async state updates on unmount when the file already uses `isMountedRef` or a similar pattern.
- Clean up Supabase realtime channels and media resources in `useEffect` cleanup.
- Preserve platform-aware code paths, especially in WebRTC and native/web conditionals.

 ### Error Handling

- Service-layer operations usually `throw` after logging or delegating to `handleError`.
- UI handlers usually catch, log if needed, and show `Alert.alert(...)` or `handleError(...)`.
- Reuse `frontend/src/utils/errorHandler.ts` for generic user-facing failures when appropriate.
- Include actionable user messages for auth, media, upload, and call failures.

 ### Supabase Conventions

- Prefer the service layer in `frontend/src/services/supabaseService.ts` over scattering raw queries in UI code.
- Keep auth and session access centralized through `authService` or `useAuth()` when practical.
- Prefer `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`; do not add more hardcoded secrets.
- Be careful with realtime subscriptions: create once, store refs, and remove channels on cleanup.

 ### UI / Theming Conventions

- Use `useTheme()` colors instead of hardcoded values whenever the color is theme-dependent.
- Preserve the app's premium, atmospheric visual style and existing gradient-heavy theme language.
- Respect `obsidian` and `mocha` tokens.
- New UI should work on mobile first and remain reasonable on web.

 ### Comments

- Keep comments sparse.
- Add comments only for non-obvious logic, lifecycle traps, subscription cleanup, or platform-specific behavior.
- Prefer better naming over explanatory comments.

 ### File Editing Guidance

- Make the smallest safe change that solves the task.
- Do not mass-reformat unrelated code.
- Do not rename files or exports unless the task requires it.

 ## Verification Expectations

- For TypeScript or structural changes, run `npx tsc --noEmit` when possible.
- For Supabase service or data-flow changes, prefer `node test-e2e.js` if the affected area is covered.
- For UI-only changes, at minimum sanity-check the impacted screen path and import graph.
- If you cannot run verification, say exactly what you were unable to run and why.

 ## Known Gaps

- No formal lint setup
- No unit test framework
- No real single-test CLI support
- Some files still use `any` and inline alerts
- Supabase fallback credentials exist in source; prefer env-driven configuration in new work

 ## Practical Defaults For Agents

- Default to editing inside `frontend/src`.
- Default to preserving relative imports.
- Default to strict TypeScript-safe changes without broad type churn.
- Default to using existing service/context abstractions before adding new ones.
