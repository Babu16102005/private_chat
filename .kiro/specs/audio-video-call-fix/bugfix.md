# Bugfix Requirements Document

## Introduction

The kiba app's audio/video calling and audio messaging features are non-functional. Users cannot make audio calls, video calls, or send voice messages. The app uses WebRTC (react-native-webrtc v124.0.7) for calls with Supabase realtime signaling, and expo-audio v1.1.1 for voice messages. The implementation exists but fails at runtime due to missing permissions handling, incorrect module imports, and race conditions in the signaling flow.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user attempts to initiate an audio or video call THEN the system fails to acquire media streams because no permission request is made before calling `getUserMedia`

1.2 WHEN a user attempts to make a call on native platforms (Android/iOS) THEN the system may fail because WebRTC modules are conditionally imported but not properly initialized for all execution paths

1.3 WHEN call signaling messages (offer/answer/ICE candidates) are exchanged via Supabase realtime THEN race conditions occur because ICE candidates may arrive before the remote description is set, causing connection failures

1.4 WHEN a user attempts to record an audio message THEN the recording may fail to start or upload because the audio recorder state is not properly validated before stopping

1.5 WHEN the outbound signaling channel is created in `ensureOutboundChannel` THEN the channel may not be ready for immediate use because subscription is fire-and-forget without waiting for confirmation

1.6 WHEN a user toggles camera or microphone during a call THEN the system modifies track states but doesn't verify the tracks exist, potentially causing silent failures

1.7 WHEN remote media tracks arrive via `ontrack` event THEN the remote stream may not render properly because the stream construction logic has fallback paths that may create incomplete MediaStream objects

1.8 WHEN a call is ended or rejected THEN cleanup may be incomplete because channels are removed but peer connection state isn't fully validated before closure

### Expected Behavior (Correct)

2.1 WHEN a user attempts to initiate an audio or video call THEN the system SHALL request camera and microphone permissions before calling `getUserMedia` and handle permission denial gracefully

2.2 WHEN a user attempts to make a call on native platforms THEN the system SHALL ensure WebRTC modules are properly loaded and provide clear error messages if unavailable

2.3 WHEN call signaling messages are exchanged THEN the system SHALL queue ICE candidates received before remote description is set and apply them after `setRemoteDescription` completes

2.4 WHEN a user attempts to record an audio message THEN the system SHALL validate the recorder is in recording state before attempting to stop and handle recording failures with user feedback

2.5 WHEN the outbound signaling channel is created THEN the system SHALL wait for channel subscription confirmation before sending signaling messages

2.6 WHEN a user toggles camera or microphone during a call THEN the system SHALL verify tracks exist and are in the expected state before modification

2.7 WHEN remote media tracks arrive THEN the system SHALL construct the remote stream correctly and ensure all tracks are properly added before rendering

2.8 WHEN a call is ended or rejected THEN the system SHALL perform complete cleanup including validating peer connection state, stopping all tracks, and removing all channels

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the app runs in Expo Go THEN the system SHALL CONTINUE TO show appropriate warnings that WebRTC requires a custom dev build

3.2 WHEN a user sends text messages, images, or videos in chat THEN the system SHALL CONTINUE TO function normally without interference from call-related code

3.3 WHEN call state changes (IDLE, RINGING, CONNECTED, ENDED) THEN the system SHALL CONTINUE TO update UI components correctly via the CallContext

3.4 WHEN a user navigates away from a call screen THEN the system SHALL CONTINUE TO maintain call state and allow returning to the active call

3.5 WHEN WebRTC is unavailable (web platform without HTTPS, or missing native modules) THEN the system SHALL CONTINUE TO provide clear user-facing error messages

3.6 WHEN audio messages are played back THEN the system SHALL CONTINUE TO use the existing MediaViewer component for playback

3.7 WHEN typing indicators and presence status are shown THEN the system SHALL CONTINUE TO function independently of call features

3.8 WHEN theme changes between obsidian and mocha modes THEN the system SHALL CONTINUE TO apply correct styling to call UI components
