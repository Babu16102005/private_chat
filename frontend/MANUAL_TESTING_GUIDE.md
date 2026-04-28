# Manual Testing Guide - Audio/Video Call and Voice Message Fix

This guide provides step-by-step instructions for manually testing the audio/video call and voice message fixes.

## Prerequisites

- Device with camera and microphone (or browser with media device access)
- Two test accounts for call testing
- Permissions to grant/deny camera and microphone access

## Test Scenarios

### 1. Call Initiation with Permission Grant

**Objective**: Verify that calls work correctly when permissions are granted.

**Steps**:
1. Open the app on two devices/browsers with different test accounts
2. Navigate to the chat screen between the two accounts
3. On Device A, tap the **Phone** icon (audio call) or **Video** icon (video call)
4. When prompted for camera/microphone permissions, **GRANT** the permissions
5. Observe that Device A shows "RINGING" state
6. On Device B, observe incoming call notification
7. On Device B, tap "Accept"
8. When prompted for permissions on Device B, **GRANT** them
9. Verify both devices show "CONNECTED" state
10. Verify audio is working (speak and listen)
11. If video call, verify video streams are visible on both devices
12. Tap "End Call" on either device
13. Verify both devices return to chat screen

**Expected Results**:
- ✅ Permission prompts appear before media access
- ✅ Call connects successfully after permissions granted
- ✅ Audio/video streams work correctly
- ✅ Call ends cleanly without errors

---

### 2. Call Initiation with Permission Denial

**Objective**: Verify graceful handling when permissions are denied.

**Steps**:
1. Open the app on a device/browser
2. Navigate to any chat screen
3. Tap the **Phone** or **Video** icon to initiate a call
4. When prompted for camera/microphone permissions, **DENY** the permissions
5. Observe the error message displayed

**Expected Results**:
- ✅ User-friendly alert appears explaining permissions are required
- ✅ Alert message: "Please grant camera and microphone permissions to make calls. Check your browser or device settings."
- ✅ Call does not proceed (no RINGING state)
- ✅ No unhandled errors in console
- ✅ App remains functional after denial

---

### 3. Voice Message Recording with Permission Grant

**Objective**: Verify voice messages work correctly when permissions are granted.

**Steps**:
1. Open the app and navigate to a chat screen
2. Tap and hold the **Microphone** icon in the input bar
3. When prompted for microphone permission, **GRANT** it
4. Observe the recording indicator (red dot pulsing)
5. Speak a short message (3-5 seconds)
6. Release the microphone icon to stop recording
7. Observe the voice message being uploaded
8. Verify the voice message appears in the chat as an audio bubble
9. Tap the audio bubble to play it back
10. Verify the audio plays correctly

**Expected Results**:
- ✅ Permission prompt appears before recording starts
- ✅ Recording indicator shows while recording
- ✅ Voice message uploads successfully
- ✅ Audio message appears in chat
- ✅ Playback works correctly

---

### 4. Voice Message Recording with Permission Denial

**Objective**: Verify graceful handling when recording permissions are denied.

**Steps**:
1. Open the app and navigate to a chat screen
2. Tap the **Microphone** icon
3. When prompted for microphone permission, **DENY** it
4. Observe the error message displayed

**Expected Results**:
- ✅ User-friendly alert appears: "Please grant microphone permission to send voice messages."
- ✅ Recording does not start
- ✅ No unhandled errors in console
- ✅ App remains functional after denial

---

### 5. Rapid Voice Message Button Taps

**Objective**: Verify recorder state validation prevents crashes.

**Steps**:
1. Open the app and navigate to a chat screen
2. Tap the **Microphone** icon to start recording
3. **Immediately** tap the microphone icon again (before recording fully starts)
4. Repeat tapping rapidly 3-4 times
5. Observe the app behavior

**Expected Results**:
- ✅ No crashes or errors occur
- ✅ Recording state is validated before stop operations
- ✅ App handles rapid taps gracefully
- ✅ Recording either starts properly or shows appropriate feedback

---

### 6. ICE Candidate Race Condition Test

**Objective**: Verify ICE candidates are queued correctly during call setup.

**Steps**:
1. Open the app on two devices with different test accounts
2. On Device A, initiate a video call to Device B
3. On Device B, accept the call **immediately** when it rings
4. Observe the call connection process
5. Verify the call connects successfully within 5-10 seconds

**Expected Results**:
- ✅ Call connects successfully even with rapid acceptance
- ✅ No "Cannot add ICE candidate" errors in console
- ✅ Video and audio streams establish correctly
- ✅ Connection is stable

---

### 7. Toggle Camera and Microphone During Call

**Objective**: Verify track validation prevents silent failures.

**Steps**:
1. Establish a video call between two devices
2. On Device A, tap the **Mute** button
3. Verify the microphone icon shows muted state
4. Speak - verify Device B does not hear audio
5. Tap **Mute** again to unmute
6. Verify Device B can hear audio again
7. Tap the **Camera Off** button
8. Verify the camera icon shows off state
9. Verify Device B sees a black screen or placeholder
10. Tap **Camera Off** again to turn camera back on
11. Verify Device B sees video again

**Expected Results**:
- ✅ Mute toggle works correctly
- ✅ Camera toggle works correctly
- ✅ UI state matches actual media state
- ✅ No errors when toggling tracks
- ✅ Remote peer sees/hears changes correctly

---

### 8. Call Cleanup and Resource Release

**Objective**: Verify complete cleanup when call ends.

**Steps**:
1. Establish a video call between two devices
2. Let the call run for 10-15 seconds
3. On Device A, tap **End Call**
4. Observe both devices return to chat screen
5. Check that camera/microphone indicators (if visible in OS) turn off
6. Initiate another call immediately
7. Verify the second call works correctly

**Expected Results**:
- ✅ Call ends cleanly on both devices
- ✅ Media tracks are stopped (camera light turns off)
- ✅ Peer connection is closed properly
- ✅ No lingering resources or memory leaks
- ✅ Subsequent calls work without issues

---

### 9. Text Messaging Preservation Test

**Objective**: Verify text messaging still works correctly after call fixes.

**Steps**:
1. Open the app and navigate to a chat screen
2. Type a text message: "Hello, this is a test message"
3. Tap the **Send** button
4. Verify the message appears in the chat
5. Send several more messages with different content
6. Verify all messages appear correctly
7. Test reply-to functionality by long-pressing a message and selecting "Reply"
8. Send a reply message
9. Verify the reply appears with the quoted message

**Expected Results**:
- ✅ Text messages send and receive correctly
- ✅ Message ordering is preserved
- ✅ Reply-to functionality works
- ✅ No interference from call-related code

---

### 10. Media Attachment Preservation Test

**Objective**: Verify image/video uploads still work correctly.

**Steps**:
1. Open the app and navigate to a chat screen
2. Tap the **Plus** (+) icon
3. Select an image from the gallery
4. Verify the image uploads and appears in the chat
5. Tap the image to view it in full screen
6. Close the image viewer
7. Tap the **Plus** icon again
8. Select a video from the gallery
9. Verify the video uploads and appears in the chat
10. Tap the video to play it

**Expected Results**:
- ✅ Image uploads work correctly
- ✅ Video uploads work correctly
- ✅ Media viewer displays images/videos properly
- ✅ No interference from call-related code

---

### 11. Theme Switching Preservation Test

**Objective**: Verify theme switching still works correctly.

**Steps**:
1. Open the app and navigate to the home screen
2. Tap the **Settings** or **Profile** icon
3. Find the theme toggle option
4. Switch from **Obsidian** to **Mocha** theme
5. Observe the color changes throughout the app
6. Navigate to a chat screen
7. Verify the chat UI uses the new theme colors
8. Switch back to **Obsidian** theme
9. Verify the colors revert correctly

**Expected Results**:
- ✅ Theme switching works correctly
- ✅ All UI elements update to new theme colors
- ✅ Chat screen reflects theme changes
- ✅ No visual glitches or inconsistencies

---

### 12. Typing Indicators Preservation Test

**Objective**: Verify typing indicators still work correctly.

**Steps**:
1. Open the app on two devices with different test accounts
2. Navigate to the chat screen between the two accounts
3. On Device A, start typing a message (don't send it)
4. On Device B, observe the typing indicator appears
5. On Device A, stop typing for 2-3 seconds
6. On Device B, observe the typing indicator disappears
7. On Device A, resume typing
8. On Device B, observe the typing indicator reappears

**Expected Results**:
- ✅ Typing indicator appears when partner types
- ✅ Typing indicator disappears after timeout
- ✅ Typing indicator is independent of call features
- ✅ No interference from call-related code

---

## Console Error Monitoring

While performing manual tests, keep the browser/app console open and monitor for:

- ❌ **Unhandled promise rejections**
- ❌ **WebRTC errors** (especially "Cannot add ICE candidate" errors)
- ❌ **Permission errors** without user feedback
- ❌ **State validation errors** (recorder, peer connection)
- ❌ **Channel subscription errors**

All errors should be handled gracefully with user-friendly messages.

---

## Platform-Specific Notes

### Web (Browser)
- Test on Chrome, Firefox, and Safari
- HTTPS is required for WebRTC (use `https://localhost` or deployed URL)
- Browser may remember permission choices - clear site data to retest permission flows

### Android
- Test on physical device (emulator may not have camera/microphone)
- Requires custom dev build: `npx expo run:android`
- Check Android system permissions in Settings > Apps > CoupleChat

### iOS
- Test on physical device (simulator may not have camera/microphone)
- Requires custom dev build: `npx expo run:ios`
- Check iOS system permissions in Settings > CoupleChat

### Expo Go
- WebRTC is **not available** in Expo Go
- Should show appropriate warning message
- Text messaging and other features should still work

---

## Troubleshooting

### Call doesn't connect
- Verify both devices have granted permissions
- Check network connectivity
- Verify STUN servers are accessible
- Check console for WebRTC errors

### No audio/video
- Verify permissions are granted
- Check device has working camera/microphone
- Try toggling mute/camera buttons
- Check browser/OS audio settings

### Voice messages don't record
- Verify microphone permission is granted
- Check microphone is not in use by another app
- Try restarting the app
- Check console for recording errors

### Permission prompts don't appear
- Clear browser site data and reload
- On native, uninstall and reinstall app
- Check OS-level permission settings

---

## Success Criteria

All manual tests should pass with:
- ✅ No unhandled errors in console
- ✅ User-friendly error messages for all failure cases
- ✅ Proper permission handling before media access
- ✅ Stable call connections without race conditions
- ✅ Clean resource cleanup after calls end
- ✅ No regressions in non-call features

---

## Reporting Issues

If any test fails, document:
1. Test scenario number and name
2. Steps to reproduce
3. Expected vs actual behavior
4. Console errors (if any)
5. Platform and device details
6. Screenshots or screen recordings (if applicable)
