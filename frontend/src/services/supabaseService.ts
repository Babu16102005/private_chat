import { supabase } from './supabase';
import { handleError } from '../utils/errorHandler';
import { ChatBackgroundSettings, defaultChatBackgroundId, defaultChatBackgroundSettings, normalizeBackgroundOpacity } from '../utils/chatBackground';
import { getUploadContentType, getUploadExtension, normalizeUploadBody } from '../utils/mediaUpload';

type PushNotificationPayload = {
  recipientId: string;
  type: 'message' | 'call';
  title: string;
  body: string;
  data?: Record<string, any>;
};

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'system_call' | 'encrypted';

export type SendMessageOptions = {
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  audioDurationMs?: number;
  callStartedAt?: string;
  callEndedAt?: string;
  callDurationSeconds?: number;
  callKind?: 'audio' | 'video';
  callStatus?: 'completed' | 'missed' | 'rejected' | 'cancelled';
};

const getPairRecipientId = async (pairId: string, senderId: string) => {
  const { data, error } = await supabase
    .from('pairs')
    .select('user_a_id, user_b_id')
    .eq('id', pairId)
    .maybeSingle();

  if (error || !data) return null;
  return data.user_a_id === senderId ? data.user_b_id : data.user_a_id;
};

const getNotificationSenderName = async (userId: string, fallbackEmail?: string | null) => {
  const profile = await profileService.getProfile(userId);
  return profile?.name || fallbackEmail?.split('@')[0] || 'Kiba';
};

const sendPushNotification = async (payload: PushNotificationPayload) => {
  try {
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: payload,
    });

    if (error) {
      console.warn('Push notification request failed:', error.message);
    }
  } catch (error) {
    console.warn('Push notification request failed:', error);
  }
};

const buildMessageNotificationBody = (content: string, messageType: string) => {
  if (messageType === 'image') return 'Sent you a photo';
  if (messageType === 'video') return 'Sent you a video';
  if (messageType === 'document') return 'Sent you a document';
  if (messageType === 'system_call') return content || 'Call ended';
  if (messageType === 'encrypted') return 'Sent you an encrypted message';
  if (messageType === 'audio' || messageType === 'voice') return 'Sent you a voice message';
  return content || 'Sent you a message';
};

const getPartnerFromPair = (pair: any, userId: string) => {
  if (pair.user_a_id === userId) return pair.user_b;
  if (pair.user_b_id === userId) return pair.user_a;
  return null;
};

export const notificationService = {
  async sendMessagePush(pairId: string, message: any) {
    const user = await authService.getCurrentUser();
    if (!user) return;

    const recipientId = await getPairRecipientId(pairId, user.id);
    if (!recipientId) return;

    const senderName = await getNotificationSenderName(user.id, user.email);
    const messageType = message.message_type || 'text';

    await sendPushNotification({
      recipientId,
      type: 'message',
      title: senderName,
      body: buildMessageNotificationBody(message.content || '', messageType),
      data: {
        pairId,
        messageId: message.id,
        senderId: user.id,
      },
    });
  },

  async sendCallPush(pairId: string, recipientId: string, isVideo: boolean) {
    const user = await authService.getCurrentUser();
    if (!user) return;

    const senderName = await getNotificationSenderName(user.id, user.email);
    const callType = isVideo ? 'video' : 'audio';

    await sendPushNotification({
      recipientId,
      type: 'call',
      title: `${senderName} is calling`,
      body: `Incoming ${callType} call`,
      data: {
        pairId,
        callerId: user.id,
        callerName: senderName,
        isVideo,
      },
    });
  },
};

export const callInviteService = {
  async createCallInvite(pairId: string, calleeId: string, isVideo: boolean, offerSdp: any, callerInfo: Record<string, any>) {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('Auth required');

    const expiresAt = new Date(Date.now() + 45_000).toISOString();
    const { data, error } = await supabase
      .from('call_invites')
      .insert({
        pair_id: pairId,
        caller_id: user.id,
        callee_id: calleeId,
        is_video: isVideo,
        offer_sdp: offerSdp,
        caller_info: callerInfo,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getPendingCallInvite() {
    const user = await authService.getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('call_invites')
      .select('*')
      .eq('callee_id', user.id)
      .eq('status', 'ringing')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async updateCallInviteStatus(inviteId: string, status: 'accepted' | 'rejected' | 'missed' | 'cancelled') {
    const { error } = await supabase
      .from('call_invites')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', inviteId);

    if (error) throw error;
  },

  subscribeToIncomingCallInvites(userId: string, callback: (invite: any) => void) {
    return supabase
      .channel(`call-invites:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'call_invites', filter: `callee_id=eq.${userId}` },
        (payload) => callback(payload.new)
      )
      .subscribe();
  },
};

// Authentication Services
export const authService = {
  async signUp(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      return data;
    } catch (error) {
      handleError(error, 'Sign up failed');
      throw error;
    }
  },

  async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    } catch (error) {
       const msg = (error as any)?.message?.toLowerCase() || '';
       if (msg.includes('email not confirmed')) {
         throw new Error('Email not confirmed. Please verify your email first.');
       }
       throw error;
    }
  },

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      handleError(error, 'Sign out failed');
      throw error;
    }
  },

  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      return null;
    }
  },

  async resetPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    } catch (error) {
      handleError(error, 'Password reset failed');
      throw error;
    }
  },

  async updatePassword(newPassword: string) {
    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return data;
    } catch (error) {
      handleError(error, 'Password update failed');
      throw error;
    }
  }
};

// Profile Services
export const profileService = {
  async getProfile(userId: string) {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', userId).limit(1);
      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('profileService: getProfile error:', error);
      return null;
    }
  },

  async updateProfile(userId: string, updates: { name?: string; about?: string; avatar_url?: string; push_token?: string }) {
    try {
      const { data, error } = await supabase.from('users').update(updates).eq('id', userId).select().single();
      if (error) throw error;
      return data;
    } catch (error) {
      handleError(error, 'Could not update profile');
      throw error;
    }
  },

  async createUserProfile(userId: string, email: string) {
    try {
      const { data, error } = await supabase.from('users').insert({ id: userId, email: email }).select().single();
      if (error) throw error;
      return data;
    } catch (error) {
      return null;
    }
  },

  async updateActiveStatus(userId: string, isActive: boolean) {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_active: isActive,
          last_seen: new Date().toISOString(),
        })
        .eq('id', userId);
      if (error) throw error;
    } catch (error) {
      console.warn('updateActiveStatus error:', error);
    }
  },

  subscribeToActiveStatus(userId: string, callback: (isActive: boolean) => void) {
    const channel = supabase
      .channel(`user-active-status:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
        (payload) => callback(!!payload.new?.is_active)
      )
      .subscribe();

    return channel;
  }
};

// Invite Services
export const inviteService = {
  async sendInvite(inviteeEmail: string) {
    try {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const token = Math.random().toString(36).substring(2, 15);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data, error } = await supabase
        .from('invites')
        .insert({
          inviter_id: user.id,
          invitee_email: inviteeEmail.toLowerCase().trim(),
          token: token,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, deep_link: `chatapp://accept?token=${token}` };
    } catch (error) {
      handleError(error, 'Could not send invite');
      throw error;
    }
  },

  async acceptInvite(token: string) {
    try {
      const { data: invite, error: inviteError } = await supabase.from('invites').select('*').eq('token', token).single();
      if (inviteError) throw inviteError;

      if (invite.accepted_at) {
        throw new Error('This invite has already been accepted.');
      }

      if (new Date(invite.expires_at) < new Date()) {
        throw new Error('This invite has expired. Ask your partner to resend.');
      }

      const currentUser = await authService.getCurrentUser();
      if (!currentUser) throw new Error('Auth required');

      const { data: pair, error: pairError } = await supabase
        .from('pairs')
        .insert({ user_a_id: invite.inviter_id, user_b_id: currentUser.id, status: 'active' })
        .select(`*, user_a:users!pairs_user_a_id_fkey(*), user_b:users!pairs_user_b_id_fkey(*)`)
        .single();

      if (pairError) {
        if ((pairError as any).code === '23505') {
          const existingPair = await supabase
            .from('pairs')
            .select(`*, user_a:users!pairs_user_a_id_fkey(*), user_b:users!pairs_user_b_id_fkey(*)`)
            .or(
              `user_a_id.eq.${invite.inviter_id},and(user_a_id.eq.${invite.inviter_id},user_b_id.eq.${currentUser.id})`
            )
            .or(`user_a_id.eq.${currentUser.id},user_b_id.eq.${currentUser.id}`)
            .eq('status', 'active')
            .maybeSingle();

          if (existingPair.data) {
            await supabase.from('invites').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id);
            return existingPair.data;
          }
        }
        throw pairError;
      }
      await supabase.from('invites').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id);
      return pair;
    } catch (error) {
      handleError(error, 'Could not accept invite');
      throw error;
    }
  },

  async getPendingInvites() {
    try {
      const user = await authService.getCurrentUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('invites')
        .select('*, inviter:users!invites_inviter_id_fkey(*)')
        .eq('invitee_email', user.email?.toLowerCase().trim())
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString());
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('getPendingInvites error:', error);
      return [];
    }
  },

  async getMyPairs() {
    try {
      const user = await authService.getCurrentUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('pairs')
        .select(`
          *,
          user_a:users!pairs_user_a_id_fkey(*),
          user_b:users!pairs_user_b_id_fkey(*),
          messages:messages(id, content, created_at, message_type, sender_id, read_at, delivered_at)
        `)
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .eq('status', 'active');

      if (error) throw error;

      const messageIds = (data || []).flatMap((p: any) => (p.messages || []).map((m: any) => m.id));
      const deletedIds = await deleteMessageService.getDeletedIdsForUser(user.id, messageIds);

      return (data || []).map((p: any) => {
          const visibleMessages = (p.messages || []).filter((m: any) => !deletedIds.has(m.id));
          const sortedMsgs = visibleMessages.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const unread = visibleMessages.filter((m: any) => m.sender_id !== user.id && !m.read_at).length;
          return { ...p, partner: getPartnerFromPair(p, user.id), messages: visibleMessages, last_message: sortedMsgs[0] || null, unread_count: unread };
      });
    } catch (error) {
      console.error('getMyPairs error:', error);
      throw error;
    }
  },

  async getMyPair() {
     const pairs = await this.getMyPairs();
     return pairs[0] || null;
  },

  async getPairById(pairId: string) {
    try {
      const user = await authService.getCurrentUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('pairs')
        .select(`*, user_a:users!pairs_user_a_id_fkey(*), user_b:users!pairs_user_b_id_fkey(*)`)
        .eq('id', pairId)
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('getPairById error:', error);
      return null;
    }
  },
  
  subscribeToInvites(callback: (invite: any) => void) {
    return supabase
      .channel('invites-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'invites' },
        (payload) => callback(payload.new)
      )
      .subscribe();
  }
};

// Message Services
export const messageService = {
  async getMessages(pairId: string, limit: number = 50, offset: number = 0) {
    try {
      const { data, error } = await supabase.from('messages').select('*').eq('pair_id', pairId).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('getMessages error:', error);
      throw error;
    }
  },

  async sendMessage(pairId: string, content: string, mediaUrl?: string, messageType: MessageType = 'text', replyToMessageId?: string, options: SendMessageOptions = {}) {
    try {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('Auth required');
      const payload: any = { pair_id: pairId, sender_id: user.id, content, media_url: mediaUrl, message_type: messageType };
      if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
      if (options.fileName) payload.file_name = options.fileName;
      if (options.fileSize !== undefined) payload.file_size = options.fileSize;
      if (options.mimeType) payload.mime_type = options.mimeType;
      if (options.audioDurationMs !== undefined) payload.audio_duration_ms = options.audioDurationMs;
      if (options.callStartedAt) payload.call_started_at = options.callStartedAt;
      if (options.callEndedAt) payload.call_ended_at = options.callEndedAt;
      if (options.callDurationSeconds !== undefined) payload.call_duration_seconds = options.callDurationSeconds;
      if (options.callKind) payload.call_kind = options.callKind;
      if (options.callStatus) payload.call_status = options.callStatus;
      const { data, error } = await supabase.from('messages').insert(payload).select().single();
      if (error) throw error;
      if (messageType !== 'system_call') notificationService.sendMessagePush(pairId, data);
      return data;
    } catch (error) { throw error; }
  },

  async sendCallHistoryMessage(pairId: string, options: Required<Pick<SendMessageOptions, 'callKind' | 'callStatus'>> & SendMessageOptions) {
    const started = options.callStartedAt ? new Date(options.callStartedAt) : null;
    const ended = options.callEndedAt ? new Date(options.callEndedAt) : new Date();
    const duration = options.callDurationSeconds ?? (started ? Math.max(0, Math.round((ended.getTime() - started.getTime()) / 1000)) : 0);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const durationText = duration > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : 'No answer';
    const kindLabel = options.callKind === 'video' ? 'Video call' : 'Voice call';
    const statusLabel = options.callStatus === 'completed' ? durationText : options.callStatus;

    const callOptions = {
      ...options,
      callEndedAt: ended.toISOString(),
      callDurationSeconds: duration,
    };

    return messageService.sendMessage(pairId, `${kindLabel} - ${statusLabel}`, undefined, 'system_call', undefined, callOptions);
  },

  async getRepliedMessage(messageId: string) {
    try {
      const { data, error } = await supabase.from('messages').select('*').eq('id', messageId).maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) { return null; }
  },

  async markMessageAsRead(messageId: string) {
    try {
      await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', messageId);
    } catch (error) {
      console.error('markMessageAsRead error:', error);
    }
  },

  async markMessagesAsRead(messageIds: string[]) {
    if (messageIds.length === 0) return;

    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', messageIds);
    } catch (error) {
      console.error('markMessagesAsRead error:', error);
    }
  },

  async markMessagesAsDelivered(messageIds: string[]) {
    try {
      await supabase.from('messages').update({ delivered_at: new Date().toISOString() }).in('id', messageIds);
    } catch (error) {
      console.error('markMessagesAsDelivered error:', error);
    }
  },

  subscribeToMessages(pairId: string, callback: (message: any) => void) {
    return supabase.channel(`messages:${pairId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `pair_id=eq.${pairId}` }, (p) => callback(p.new)).subscribe();
  },

  subscribeToTyping(pairId: string, userId: string, callback: (isTyping: boolean) => void) {
    const channel = supabase.channel(`typing:${pairId}`);
    channel.on('presence', { event: 'sync' }, () => {
        const state: any = channel.presenceState();
        const typing = Object.values(state).flat().some((p: any) => p.user_id !== userId && p.is_typing);
        callback(typing);
    }).subscribe();
    return channel;
  },

  async sendTypingIndicator(channel: any, isTyping: boolean) {
    const user = await authService.getCurrentUser();
    if (user) await channel.track({ user_id: user.id, is_typing: isTyping });
  },

  subscribeToPresence(pairId: string, userId: string, callback: (isOnline: boolean) => void) {
    const channel = supabase.channel(`presence:${pairId}`);
    const syncOnlineState = () => {
      const state = channel.presenceState();
      const partner = Object.values(state).flat().find((p: any) => p.user_id !== userId && p.is_active !== false);
      callback(!!partner);
    };

    channel
      .on('presence', { event: 'sync' }, syncOnlineState)
      .on('presence', { event: 'join' }, syncOnlineState)
      .on('presence', { event: 'leave' }, syncOnlineState)
      .subscribe(async (s) => {
        if (s === 'SUBSCRIBED') {
          await channel.track({ user_id: userId, is_active: true, online_at: new Date().toISOString() });
        }
    });
    return channel;
  },
};

export const storageService = {
  async uploadFile(file: any, bucket: string = 'chat-media', onProgress?: (progress: number) => void) {
    try {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('Auth required');

      const ext = getUploadExtension(file);
      const fileName = `${user.id}/${Date.now()}.${ext}`;
      const contentType = getUploadContentType(file);
      const uploadBody = await normalizeUploadBody(file);
      const { error } = await supabase.storage.from(bucket).upload(fileName, uploadBody as any, {
        contentType,
        upsert: false,
      });
      if (error) throw error;
      return supabase.storage.from(bucket).getPublicUrl(fileName).data.publicUrl;
    } catch (error) { throw error; }
  }
};

export const messageReactionsService = {
  async addReaction(messageId: string, emoji: string) {
    try {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('Auth required');
      const { data, error } = await supabase.from('message_reactions').insert({
        message_id: messageId,
        user_id: user.id,
        emoji
      }).select().single();
      if (error) throw error;
      return data;
    } catch (error) { throw error; }
  },

  async removeReaction(messageId: string) {
    try {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('Auth required');
      await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', user.id);
    } catch (error) { console.error(error); }
  },

  async getReactions(messageId: string) {
    try {
      const { data, error } = await supabase.from('message_reactions').select('*').eq('message_id', messageId);
      if (error) throw error;
      return data || [];
    } catch (error) { return []; }
  },

  subscribeToReactions(messageId: string, callback: () => void) {
    return supabase.channel(`reactions:${messageId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions', filter: `message_id=eq.${messageId}` }, callback).subscribe();
  }
};

export const deleteMessageService = {
  async deleteForMe(messageId: string) {
    try {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('Auth required');
      await supabase
        .from('deleted_messages')
        .upsert(
          { message_id: messageId, user_id: user.id },
          { onConflict: 'message_id,user_id', ignoreDuplicates: true }
        );
    } catch (error) { console.error(error); }
  },

  async isDeletedForMe(messageId: string) {
    try {
      const user = await authService.getCurrentUser();
      if (!user) return false;
      const { data } = await supabase.from('deleted_messages').select('id').eq('message_id', messageId).eq('user_id', user.id).maybeSingle();
      return !!data;
    } catch (error) { return false; }
  },

  async getDeletedIdsForUser(userId: string, messageIds: string[]): Promise<Set<string>> {
    try {
      if (!messageIds.length) return new Set();
      const { data } = await supabase
        .from('deleted_messages')
        .select('message_id')
        .eq('user_id', userId)
        .in('message_id', messageIds);
      return new Set((data || []).map((d: any) => d.message_id));
    } catch (error) {
      console.error('getDeletedIdsForUser error:', error);
      return new Set();
    }
  }
};

export const chatSettingsService = {
  async getChatContentCounts(pairId: string) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('content, message_type')
        .eq('pair_id', pairId);

      if (error) throw error;

      const messages = data || [];
      const mediaCount = messages.filter((message: any) => message.message_type === 'image' || message.message_type === 'video').length;
      const linkCount = messages.filter((message: any) => /\bhttps?:\/\/[^\s]+/i.test(message.content || '')).length;
      const docsCount = messages.filter((message: any) => message.message_type === 'document').length;

      return { mediaCount, linkCount, docsCount };
    } catch (error) {
      console.error('Get chat content counts error:', error);
      return { mediaCount: 0, linkCount: 0, docsCount: 0 };
    }
  },

  isMissingChatSettingsTable(error: any) {
    return error?.code === 'PGRST205' || error?.message?.includes("public.chat_settings");
  },

  async getChatBackground(pairId: string) {
    try {
      const user = await authService.getCurrentUser();
      if (!user) return defaultChatBackgroundSettings;

      const { data, error } = await supabase
        .from('chat_settings')
        .select('background_id, background_image_url, background_opacity')
        .eq('pair_id', pairId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        if (!this.isMissingChatSettingsTable(error)) {
          console.warn('Get chat background error:', error.message);
        }
        return defaultChatBackgroundSettings;
      }

      return {
        background_id: data?.background_id || defaultChatBackgroundId,
        background_image_url: data?.background_image_url || null,
        background_opacity: normalizeBackgroundOpacity(data?.background_opacity),
      };
    } catch (error) {
      if (!this.isMissingChatSettingsTable(error)) {
        console.warn('Get chat background failed:', error);
      }
      return defaultChatBackgroundSettings;
    }
  },

  async updateChatBackground(pairId: string, updates: Partial<ChatBackgroundSettings>) {
    try {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('Auth required');

      const payload: any = {
        pair_id: pairId,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      };

      if (updates.background_id !== undefined) payload.background_id = updates.background_id;
      if (updates.background_image_url !== undefined) payload.background_image_url = updates.background_image_url;
      if (updates.background_opacity !== undefined) payload.background_opacity = normalizeBackgroundOpacity(updates.background_opacity);

      const { error } = await supabase
        .from('chat_settings')
        .upsert(
          payload,
          { onConflict: 'pair_id,user_id' }
        );

      if (error) throw error;
    } catch (error) {
      if (this.isMissingChatSettingsTable(error)) {
        throw new Error('Chat background settings table is not ready. Run PART 7 from supabase_setup.sql, then restart the app.');
      }
      console.error('Set chat background error:', error);
      throw error;
    }
  },

  async setChatBackground(pairId: string, backgroundId: string) {
    return this.updateChatBackground(pairId, { background_id: backgroundId });
  },

  async blockUser(pairId: string) {
    try {
      await supabase.from('pairs').update({ is_blocked: true }).eq('id', pairId);
    } catch (error) { console.error('Block user error:', error); }
  },

  async unblockUser(pairId: string) {
    try {
      await supabase.from('pairs').update({ is_blocked: false }).eq('id', pairId);
    } catch (error) { console.error('Unblock user error:', error); }
  },

  async clearChat(pairId: string) {
    try {
      const user = await authService.getCurrentUser();
      if (!user) return;
      const { data } = await supabase.from('messages').select('id').eq('pair_id', pairId);
      if (!data || data.length === 0) return;
      const messageIds = data.map((m: any) => m.id);
      const inserts = messageIds.map((id: string) => ({ message_id: id, user_id: user.id }));
      const { error } = await supabase.from('deleted_messages').upsert(inserts, { onConflict: 'message_id,user_id', ignoreDuplicates: true });
      if (error) console.error('Clear chat upsert error:', error);
    } catch (error) { console.error('Clear chat error:', error); }
  },
};

export const storyService = {
  async getStories() {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select('*, user:users(*)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('getStories error:', error);
      return [];
    }
  },

  async createStory(mediaUrl: string, mediaType: 'image' | 'video', caption?: string) {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('Auth required');

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('stories')
      .insert({ user_id: user.id, media_url: mediaUrl, media_type: mediaType, caption, expires_at: expiresAt })
      .select('*, user:users(*)')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteStory(storyId: string) {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('Auth required');

    const { error } = await supabase
      .from('stories')
      .delete()
      .eq('id', storyId)
      .eq('user_id', user.id);

    if (error) throw error;
  },

  async markViewed(storyId: string) {
    try {
      const user = await authService.getCurrentUser();
      if (!user) return;
      await supabase
        .from('story_views')
        .upsert({ story_id: storyId, viewer_id: user.id }, { onConflict: 'story_id,viewer_id', ignoreDuplicates: true });
    } catch (error) {
      console.warn('markViewed story failed:', error);
    }
  },

  subscribeToStories(callback: () => void) {
    return supabase
      .channel('stories-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, callback)
      .subscribe();
  },
};

export const cryptoKeyService = {
  async upsertPublicKeys(identityPublicKey: string, signedPrekey?: string) {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('Auth required');
    const { error } = await supabase
      .from('user_crypto_keys')
      .upsert({ user_id: user.id, identity_public_key: identityPublicKey, signed_prekey: signedPrekey, updated_at: new Date().toISOString() });
    if (error) throw error;
  },

  async getPublicKeys(userId: string) {
    const { data, error } = await supabase
      .from('user_crypto_keys')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};
