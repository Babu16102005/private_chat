import { supabase } from './supabase';
import { handleError } from '../utils/errorHandler';

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
          return { ...p, messages: visibleMessages, last_message: sortedMsgs[0] || null, unread_count: unread };
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

  async sendMessage(pairId: string, content: string, mediaUrl?: string, messageType: 'text' | 'image' | 'video' | 'audio' = 'text', replyToMessageId?: string) {
    try {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('Auth required');
      const payload: any = { pair_id: pairId, sender_id: user.id, content, media_url: mediaUrl, message_type: messageType };
      if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
      const { data, error } = await supabase.from('messages').insert(payload).select().single();
      if (error) throw error;
      return data;
    } catch (error) { throw error; }
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
    channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const partner = Object.values(state).flat().find((p: any) => p.user_id !== userId);
        callback(!!partner);
    }).subscribe(async (s) => {
        if (s === 'SUBSCRIBED') await channel.track({ user_id: userId, online_at: new Date().toISOString() });
    });
    return channel;
  },
};

export const storageService = {
  async uploadFile(file: any, bucket: string = 'chat-media') {
    try {
      const user = await authService.getCurrentUser();
      if (!user) throw new Error('Auth required');

      let fileName: string;
      const contentType: string | undefined = file.type || file.mimeType;

      // Handle file URI objects (from camera/audio recording)
      if (file.uri) {
        const ext = file.name?.split('.').pop() ||
                    file.uri.split('.').pop() ||
                    'bin';
        fileName = `${user.id}/${Date.now()}.${ext}`;
        const { data, error } = await supabase.storage.from(bucket).upload(fileName, file as any, {
          contentType: contentType || undefined,
        });
        if (error) throw error;
        return supabase.storage.from(bucket).getPublicUrl(fileName).data.publicUrl;
      }

      // Handle Blob files (from ImagePicker)
      const ext = file.name ? file.name.split('.').pop() : 'bin';
      fileName = `${user.id}/${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from(bucket).upload(fileName, file, {
        contentType: contentType || undefined,
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
