# Audio/Video Call and Audio Message Bugfix Design

## Overview

The kiba app's WebRTC-based calling and expo-audio voice messaging features are non-functional due to missing permissions handling, race conditions in signaling flow, and incomplete state validation. This fix will implement proper permission requests before media access, queue ICE candidates to prevent race conditions, validate recorder state before operations, and ensure complete cleanup on call termination. The approach is minimal and surgical, targeting only the defective code paths while preserving all existing chat, UI, and theme functionality.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when users attempt calls or voice messages without proper permission handling, signaling synchronization, or state validation
- **Property (P)**: The desired behavior - calls and voice messages work reliably with proper permissions, synchronized signaling, and validated state transitions
- **Preservation**: Existing chat features, theme system, navigation, and non-call UI behaviors that must remain unchanged
- **getUserMedia**: WebRTC API that accesses camera/microphone; requires prior permission grants
- **ICE Candidate**: Network connectivity information exchanged during WebRTC connection setup
- **Remote Description**: SDP (Session Description Protocol) offer/answer that must be set before ICE candidates
- **Signaling Channel**: Supabase realtime channel used to exchange WebRTC connection metadata
- **expo-audio Recorder**: Audio recording module that requires permission and state validation
- **CallContext**: React context in `frontend/src/context/CallContext.tsx` managing call state and WebRTC logic
- **ChatScreen**: Component in `frontend/src/screens/ChatScreen.tsx` handling voice message recording

## Bug Details

### Bug Condition

The bug manifests when users attempt to make audio/video calls or send voice messages. The system fails due to: (1) calling `getUserMedia` without requesting permissions first, (2) ICE candidates arriving before remote SDP is set causing connection failures, (3) audio recorder operations on invalid state, (4) incomplete cleanup leaving resources dangling.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action: string, platform: string, hasPermission: boolean, 
                         recorderState: string, iceCandidate: any, remoteSdp: any }
  OUTPUT: boolean
  
  RETURN (input.action == 'initiateCall' OR input.action == 'acceptCall')
         AND input.hasPermission == false
         AND getUserMediaCalled()
    OR (input.action == 'receiveIceCandidate')
         AND input.iceCandidate != null
         AND input.remoteSdp == null
    OR (input.action == 'stopRecording')
         AND input.recorderState != 'recording'
    OR (input.action == 'sendSignal')
         AND channelNotReady()
END FUNCTION
```

### Examples

- **Call initiation without permission**: User taps video call button → `initiateCall` calls `getUserMedia({ video: true, audio: true })` → Browser/OS denies access because no permission request was made → Call fails with "Permission denied" or silent failure
- **ICE candidate race condition**: Caller sends offer → Callee receives offer and ICE candidates nearly simultaneously → `addIceCandidate` called before `setRemoteDescription` → WebRTC throws "Cannot add ICE candidate before remote description" → Connection never establishes
- **Audio recorder invalid state**: User taps mic button briefly → `startVoice` begins recording → User taps again before recorder fully initializes → `stopVoice` calls `audioRecorder.stop()` on non-recording state → Crash or silent failure
- **Channel not ready**: `ensureOutboundChannel` creates channel and calls `subscribe()` fire-and-forget → `sendSignal` immediately broadcasts offer → Channel not yet subscribed → Signal lost → Call never rings on remote side

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Text messaging, image sharing, and video sharing in ChatScreen must continue to work exactly as before
- Theme system (obsidian/mocha) styling and color application must remain unchanged
- Navigation between screens and auth gating must remain unchanged
- Typing indicators and presence status must continue to function independently
- Message reactions, reply-to, delete-for-me features must remain unchanged
- CallScreen UI rendering and controls layout must remain unchanged
- Expo Go warning messages for WebRTC unavailability must remain unchanged

**Scope:**
All inputs that do NOT involve initiating calls, accepting calls, sending voice messages, or WebRTC signaling should be completely unaffected by this fix. This includes:
- All text-based chat interactions
- Image/video attachment uploads via ImagePicker
- Message search functionality
- Chat settings navigation
- Profile viewing
- Theme switching

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Missing Permission Requests**: The `setupPeerConnection` and `startVoice` functions call `getUserMedia` and `requestRecordingPermissionsAsync` respectively, but on web platforms and some native scenarios, permissions must be explicitly requested before media access. The code assumes permissions are granted or handles denial only after failure.

2. **ICE Candidate Race Condition**: In `CallContext.tsx`, the broadcast event handler processes `ice-candidate` events immediately via `pc.current.addIceCandidate(...)`. However, if the ICE candidate arrives before `call-answer` (which sets remote description), the operation fails. WebRTC requires remote description to be set before adding ICE candidates.

3. **Audio Recorder State Validation**: In `ChatScreen.tsx`, `stopVoice` calls `audioRecorder.stop()` without checking if `audioRecorder` is actually in a recording state. If the user taps the mic button rapidly or if recording fails to start, this causes errors.

4. **Signaling Channel Readiness**: The `ensureOutboundChannel` function calls `channel.subscribe()` but doesn't wait for subscription confirmation. Immediately calling `sendSignal` after may result in lost messages if the channel isn't ready.

5. **Track Existence Validation**: `toggleMute` and `toggleCamera` call `getAudioTracks()` and `getVideoTracks()` without verifying the stream or tracks exist, potentially causing silent failures.

6. **Incomplete Cleanup**: The `cleanup` function closes the peer connection and removes channels, but doesn't validate peer connection state before closure or ensure all tracks are stopped.

## Correctness Properties

Property 1: Bug Condition - Calls and Voice Messages Work With Proper Permissions

_For any_ user action where a call is initiated, accepted, or voice message is recorded, the fixed system SHALL request appropriate permissions (camera, microphone, audio recording) before accessing media devices, handle permission denial with clear user feedback, and only proceed with media operations after permissions are granted.

**Validates: Requirements 2.1, 2.2, 2.4**

Property 2: Bug Condition - ICE Candidates Are Synchronized With Remote Description

_For any_ ICE candidate received via signaling, the fixed system SHALL queue the candidate if remote description is not yet set, apply queued candidates after `setRemoteDescription` completes successfully, and ensure WebRTC connection establishment proceeds without race condition failures.

**Validates: Requirements 2.3**

Property 3: Bug Condition - Signaling Channel Is Ready Before Use

_For any_ signaling message (offer, answer, ICE candidate, hangup), the fixed system SHALL wait for channel subscription confirmation before sending messages, ensuring all signaling data is reliably transmitted to the remote peer.

**Validates: Requirements 2.5**

Property 4: Bug Condition - Media Track Operations Are Validated

_For any_ toggle operation (mute, camera), the fixed system SHALL verify the local stream exists and contains the expected tracks before modifying track state, preventing silent failures and ensuring UI state matches actual media state.

**Validates: Requirements 2.6**

Property 5: Bug Condition - Cleanup Is Complete and Safe

_For any_ call termination (end, reject, error), the fixed system SHALL validate peer connection state before closure, stop all media tracks, remove all signaling channels, and reset all call-related state to prevent resource leaks.

**Validates: Requirements 2.8**

Property 6: Preservation - Non-Call Features Remain Unchanged

_For any_ user interaction that does NOT involve calls or voice messages (text messaging, image sharing, navigation, theme changes), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing chat and UI functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `frontend/src/context/CallContext.tsx`

**Function**: `setupPeerConnection`

**Specific Changes**:
1. **Add Permission Request Before getUserMedia**: Before calling `mediaDevicesImpl.getUserMedia`, add explicit permission check and request logic. On web, this is implicit in `getUserMedia`, but we should handle denial gracefully. On native, verify permissions are granted.
   - Add try-catch around `getUserMedia` with specific error handling for permission denial
   - Show user-friendly Alert explaining why permissions are needed
   - Return early if permissions denied

2. **Implement ICE Candidate Queue**: Add a ref to store ICE candidates that arrive before remote description is set
   - Create `pendingIceCandidates` ref: `useRef<RTCIceCandidate[]>([])`
   - In broadcast handler for `ice-candidate`, check if `pc.current.remoteDescription` exists
   - If no remote description, push candidate to queue instead of adding immediately
   - After `setRemoteDescription` in `call-answer` handler, drain the queue by adding all pending candidates

3. **Wait for Channel Subscription**: Modify `ensureOutboundChannel` to return a Promise that resolves when subscription is confirmed
   - Change `channel.subscribe()` to `channel.subscribe((status) => { if (status === 'SUBSCRIBED') resolve(); })`
   - Await this Promise in `sendSignal` before broadcasting
   - Add timeout to prevent infinite waiting

4. **Validate Track Existence in Toggle Functions**: In `toggleMute` and `toggleCamera`, add null checks
   - Check `if (!localStream) return;`
   - Check `if (localStream.getAudioTracks().length === 0) return;` for mute
   - Check `if (localStream.getVideoTracks().length === 0) return;` for camera

5. **Improve Cleanup Validation**: In `resetCallState`, add peer connection state checks
   - Check `if (pc.current && pc.current.connectionState !== 'closed')` before calling `close()`
   - Ensure all tracks are stopped with try-catch around `track.stop()`
   - Clear pending ICE candidates queue

**File**: `frontend/src/screens/ChatScreen.tsx`

**Function**: `stopVoice`

**Specific Changes**:
1. **Validate Recorder State Before Stop**: Add state check before calling `audioRecorder.stop()`
   - Check `if (!isRecording || !audioRecorder.isRecording) return;`
   - Add try-catch around `audioRecorder.stop()` with user-facing error message
   - Ensure `setIsRecording(false)` is called even if stop fails

2. **Handle Recording Permission Denial**: In `startVoice`, improve permission handling
   - After `requestRecordingPermissionsAsync`, check `permission.granted` explicitly
   - If denied, show Alert and return early without attempting to record
   - Add try-catch around `audioRecorder.record()` for initialization failures

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code by attempting calls and voice messages without proper setup, then verify the fixes work correctly across permission scenarios, signaling timing variations, and state transitions.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate call initiation without permissions, rapid ICE candidate arrival, recorder state transitions, and channel timing issues. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Permission Denial Test**: Mock `getUserMedia` to throw permission error, initiate call, observe failure (will fail on unfixed code with unhandled error)
2. **ICE Race Condition Test**: Send ICE candidate before remote description is set, observe WebRTC error (will fail on unfixed code with "Cannot add ICE candidate" error)
3. **Recorder Invalid State Test**: Call `stopVoice` when recorder is not recording, observe crash or silent failure (will fail on unfixed code)
4. **Channel Not Ready Test**: Send signal immediately after channel creation, observe lost message (will fail on unfixed code with signal not received)

**Expected Counterexamples**:
- `getUserMedia` throws "NotAllowedError: Permission denied" and call fails without user feedback
- `addIceCandidate` throws "InvalidStateError: Cannot add ICE candidate before setting remote description"
- `audioRecorder.stop()` throws error or returns undefined when not recording
- Signaling messages sent before channel subscription are lost, causing call to never ring

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedCallSystem(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Expected Behavior After Fix**:
- Permission requests are made before media access, denials show user-friendly alerts
- ICE candidates are queued and applied after remote description is set
- Recorder state is validated before stop operations
- Signaling channel subscription is confirmed before sending messages
- Track operations validate stream and track existence
- Cleanup safely handles all peer connection states

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalChatSystem(input) = fixedChatSystem(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-call inputs

**Test Plan**: Observe behavior on UNFIXED code first for text messaging, image sharing, navigation, and theme changes, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Text Messaging Preservation**: Observe that sending text messages works correctly on unfixed code, then write test to verify this continues after fix
2. **Media Attachment Preservation**: Observe that image/video uploads work correctly on unfixed code, then write test to verify this continues after fix
3. **Navigation Preservation**: Observe that screen navigation works correctly on unfixed code, then write test to verify this continues after fix
4. **Theme Preservation**: Observe that theme switching works correctly on unfixed code, then write test to verify this continues after fix

### Unit Tests

- Test permission request flow for audio and video calls with granted/denied scenarios
- Test ICE candidate queueing when remote description is not set
- Test ICE candidate application after remote description is set
- Test audio recorder state validation before stop operations
- Test signaling channel subscription confirmation before message sending
- Test track toggle operations with missing streams or tracks
- Test cleanup with various peer connection states (new, connecting, connected, closed)

### Property-Based Tests

- Generate random call initiation sequences with varying permission states and verify proper handling
- Generate random ICE candidate arrival timings relative to remote description and verify no race conditions
- Generate random recorder state transitions and verify all operations are safe
- Generate random signaling message sequences and verify all messages are delivered
- Generate random chat interactions (messages, attachments, navigation) and verify preservation of existing behavior

### Integration Tests

- Test full call flow: initiate → ring → accept → connect → end with proper permissions
- Test call flow with permission denial at various stages
- Test voice message flow: start recording → stop → upload → send
- Test voice message flow with permission denial
- Test call with rapid ICE candidate exchange
- Test call cleanup after network failure or peer disconnection
- Test switching between chat and call screens during active call
- Test theme changes during active call
