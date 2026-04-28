export type CallSignalType = 'call-offer' | 'call-answer' | 'ice-candidate' | 'call-hangup';

export type CallSignalPayload = Record<string, any> & {
  type?: CallSignalType;
};

export const buildCallSignalPayload = (
  type: CallSignalType,
  payload: Record<string, any> = {},
): CallSignalPayload => ({
  ...payload,
  type,
});

export const getCallSignalType = (event: string | undefined, payload: CallSignalPayload | null | undefined) => {
  return payload?.type || event || '';
};

export const getCallTargetId = (partner: Record<string, any> | null | undefined): string | null => {
  if (!partner) return null;

  const candidates = [
    partner.auth_user_id,
    partner.user_id,
    partner.id,
  ];

  const targetId = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
  return targetId ? targetId.trim() : null;
};
