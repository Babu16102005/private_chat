import { buildCallSignalPayload, getCallSignalType, getCallTargetId } from '../utils/callSignaling';
import { getUploadContentType, getUploadExtension } from '../utils/mediaUpload';

describe('Production media fixes', () => {
  it('includes the call signal type inside broadcast payloads', () => {
    const payload = buildCallSignalPayload('call-offer', { pairId: 'pair-1' });

    expect(payload).toEqual({ type: 'call-offer', pairId: 'pair-1' });
    expect(getCallSignalType('broadcast-event', payload)).toBe('call-offer');
  });

  it('falls back to the Supabase broadcast event name for legacy payloads', () => {
    expect(getCallSignalType('ice-candidate', { candidate: 'candidate' })).toBe('ice-candidate');
  });

  it('resolves the partner auth id for call channels', () => {
    expect(getCallTargetId({ auth_user_id: ' auth-id ', id: 'profile-id' })).toBe('auth-id');
    expect(getCallTargetId({ user_id: 'user-id' })).toBe('user-id');
    expect(getCallTargetId({ id: 'partner-id' })).toBe('partner-id');
    expect(getCallTargetId({ id: ' ' })).toBeNull();
  });

  it('extracts upload metadata from local uri files', () => {
    const file = {
      uri: 'file:///cache/voice-message.m4a?token=123',
      name: 'voice-message.m4a',
      type: 'audio/mp4',
    };

    expect(getUploadExtension(file)).toBe('m4a');
    expect(getUploadContentType(file)).toBe('audio/mp4');
  });
});
