import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, SafeAreaView, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Moon, Search, Plus, MessageCircle, Droplets, X, Check, CheckCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { inviteService, messageService } from '../services/supabaseService';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';

import { formatChatListTime } from '../utils/date';

const { width, height } = Dimensions.get('window');

export const HomeScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { colors, isDark, themeMode, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();

  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlineStatus, setOnlineStatus] = useState<Record<string, boolean>>({});
  const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({});

  // Track active subscriptions by pair ID to prevent duplicates
  const subscriptionsRef = useRef<Map<string, any[]>>(new Map());
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Clean up all subscriptions
      subscriptionsRef.current.forEach((subs) => {
        subs.forEach(ch => supabase.removeChannel(ch));
      });
      subscriptionsRef.current.clear();
    };
  }, []);

  // Cleanup individual pair subscriptions when chats change
  const cleanupPairSubscriptions = useCallback((chatIds: string[]) => {
    const currentIds = new Set(subscriptionsRef.current.keys());
    const newIds = new Set(chatIds);

    // Remove subscriptions for pairs no longer in the list
    currentIds.forEach(id => {
      if (!newIds.has(id)) {
        const subs = subscriptionsRef.current.get(id);
        if (subs) {
          subs.forEach(ch => supabase.removeChannel(ch));
        }
        subscriptionsRef.current.delete(id);
      }
    });
  }, []);

  // Setup subscriptions for a specific pair
  const setupPairSubscriptions = useCallback((chat: any, userId: string) => {
    // Remove existing subscriptions for this pair if any
    const existing = subscriptionsRef.current.get(chat.id);
    if (existing) {
      existing.forEach(ch => supabase.removeChannel(ch));
    }

    const subs: any[] = [];
    const presenceChannel = messageService.subscribeToPresence(chat.id, userId, (isOnline: boolean) => {
      if (isMountedRef.current) {
        setOnlineStatus(prev => ({ ...prev, [chat.id]: isOnline }));
      }
    });
    subs.push(presenceChannel);

    const typingChannel = messageService.subscribeToTyping(chat.id, userId, (isTyping: boolean) => {
      if (isMountedRef.current) {
        setTypingStatus(prev => ({ ...prev, [chat.id]: isTyping }));
      }
    });
    subs.push(typingChannel);

    subscriptionsRef.current.set(chat.id, subs);
  }, []);

  const fetchChats = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const data = await inviteService.getMyPairs();
      if (isMountedRef.current) {
        setChats(data || []);
      }
    } catch (error) {
      console.error('Fetch chats failed:', error);
      if (isMountedRef.current) {
        Alert.alert('Error', 'Failed to load conversations. Please try again.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [user]);

  // Fetch chats when user becomes available
  useEffect(() => {
    if (user?.id) {
      fetchChats();
    }
  }, [user?.id, fetchChats]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchChats();
      }
    }, [fetchChats, user?.id])
  );

  // Manage subscriptions when chats change - only setup new, remove stale
  useEffect(() => {
    if (!user?.id || chats.length === 0) return;

    // Clean up subscriptions for pairs no longer in the list
    const chatIds = chats.map(c => c.id);
    cleanupPairSubscriptions(chatIds);

    // Set up subscriptions for pairs that don't have them yet
    chats.forEach(chat => {
      if (!subscriptionsRef.current.has(chat.id)) {
        setupPairSubscriptions(chat, user.id);
      }
    });
  }, [chats, user?.id, cleanupPairSubscriptions, setupPairSubscriptions]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(() => {
    fetchChats();
  }, [fetchChats]);

  if (!user) return null;

  const filteredChats = chats.filter(chat => {
    const partner = chat.user_a?.id === user!.id ? chat.user_b : chat.user_a;
    return (partner?.name || partner?.email || '').toLowerCase().includes(search.toLowerCase());
  });

  const renderChatItem = ({ item }: { item: any }) => {
    const partner = item.user_a?.id === user!.id ? item.user_b : item.user_a;
    const isOnline = onlineStatus[item.id];
    const isTyping = typingStatus[item.id];
    const avatarSeed = partner?.name || partner?.email || 'User';
    const lastMsg = item.last_message;
    const lastMsgTime = lastMsg?.created_at;
    const isLastMsgFromMe = lastMsg?.sender_id === user?.id;
    const hasUnread = item.unread_count > 0;

    return (
      <TouchableOpacity
        style={[styles.chatRow, { borderBottomColor: colors.glassBorder, borderBottomWidth: StyleSheet.hairlineWidth }]}
        onPress={() => navigation.navigate('Chat', { pairId: item.id, partner })}
      >
        <View style={styles.chatThumbWrap}>
          <Image
            source={{ uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}` }}
            style={[styles.chatThumb, { borderRadius: colors.radius.story }]}
          />
          {isOnline && (
            <View style={[styles.onlineIndicator, { backgroundColor: colors.tertiary, borderColor: colors.background }]} />
          )}
        </View>
        <View style={styles.chatMain}>
          <View style={styles.chatTopLine}>
            <Text style={[styles.chatPartnerName, { color: colors.text }]}>{partner?.name || 'Partner'}</Text>
            {lastMsgTime && (
              <Text style={[styles.chatTimestamp, { color: hasUnread ? colors.primary : colors.gray }]}>
                {formatChatListTime(lastMsgTime)}
              </Text>
            )}
          </View>
          <View style={styles.snippetRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              {/* Typing indicator */}
              {isTyping ? (
                <Text style={[styles.chatSnippet, styles.typingText, { color: colors.tertiary }]}>
                  typing...
                </Text>
              ) : (
                <>
                  {/* "You:" prefix + delivery tick for own messages */}
                  {isLastMsgFromMe && (
                    <>
                      <Text style={[styles.youPrefix, { color: hasUnread ? 'rgba(255,255,255,0.6)' : colors.gray }]}>
                        You:{' '}
                      </Text>
                      {lastMsg && (
                        <View style={styles.tickInline}>
                          {lastMsg.read_at ? (
                            <CheckCheck size={14} color={colors.primary} strokeWidth={2} />
                          ) : lastMsg.delivered_at ? (
                            <CheckCheck size={14} color={colors.gray} strokeWidth={2} />
                          ) : (
                            <Check size={14} color={colors.gray} strokeWidth={2} />
                          )}
                        </View>
                      )}
                    </>
                  )}
                  <Text style={[styles.chatSnippet, { color: hasUnread ? colors.text : colors.gray }]} numberOfLines={1}>
                    {lastMsg?.content || 'No messages yet'}
                  </Text>
                </>
              )}
            </View>
            {hasUnread && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.unreadText}>{item.unread_count}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background gradient */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={colors.gradientPrimary as any} style={StyleSheet.absoluteFill} />
        {themeMode === 'mocha' && (
          <>
            <LinearGradient colors={['rgba(255, 107, 74, 0.12)', 'transparent'] as any} style={[styles.glowBall, { top: -100, right: -50, width: 350, height: 350 }]} />
            <LinearGradient colors={['rgba(255, 107, 74, 0.05)', 'transparent'] as any} style={[styles.glowBall, { bottom: height * 0.2, left: -100, width: 300, height: 300 }]} />
          </>
        )}
      </View>

      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Chats</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={toggleTheme} style={styles.headerAction}>
              {themeMode === 'obsidian' ? <Droplets size={24} color={colors.primary} /> : <Moon size={24} color={colors.primary} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={[styles.headerAvatarMini, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}>
              <Image source={{ uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || 'User'}` }} style={{ width: '100%', height: '100%' }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchWrapper}>
          <View style={[styles.searchBar, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: colors.glassBorder, borderRadius: 16 }]}>
            <Search size={18} color={colors.gray} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search conversations..."
              placeholderTextColor={colors.gray}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={16} color={colors.gray} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Chat list */}
        <View style={styles.listContainer}>
          <FlatList
            data={filteredChats}
            keyExtractor={(item) => item.id}
            renderItem={renderChatItem}
            contentContainerStyle={styles.listInside}
            showsVerticalScrollIndicator={false}
            onRefresh={handleRefresh}
            refreshing={loading}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <MessageCircle size={40} color={colors.gray} strokeWidth={1.5} />
                <Text style={[styles.emptyLabel, { color: colors.gray }]}>No conversations</Text>
                <Text style={[styles.emptySublabel, { color: colors.gray, opacity: 0.6 }]}>
                  Tap the + button to invite your partner
                </Text>
              </View>
            }
          />
        </View>
      </SafeAreaView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.floatPlus, { bottom: Math.max(insets.bottom + 20, 30) }]}
        onPress={() => navigation.navigate('Invite')}
      >
        <LinearGradient colors={colors.gradientSecondary as any} style={styles.floatGrad}>
          <Plus size={28} color="white" strokeWidth={2.5} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  glowBall: { position: 'absolute', borderRadius: 200, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingTop: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 32, fontWeight: '800' },
  headerRight: { flexDirection: 'row', gap: 15, alignItems: 'center' },
  headerAction: { opacity: 0.8 },
  headerAvatarMini: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden' },
  searchWrapper: { paddingHorizontal: 20, marginBottom: 20 },
  searchBar: { height: 46, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, overflow: 'hidden' },
  searchInput: { flex: 1, fontSize: 15 },
  listContainer: { flex: 1 },
  listInside: { paddingBottom: 100 },
  chatRow: { flexDirection: 'row', padding: 16, alignItems: 'center', paddingHorizontal: 20 },
  chatThumbWrap: { position: 'relative' },
  chatThumb: { width: 56, height: 56 },
  onlineIndicator: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  chatMain: { flex: 1, marginLeft: 14 },
  chatTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 },
  chatPartnerName: { fontSize: 16, fontWeight: '700' },
  chatTimestamp: { fontSize: 12, fontWeight: '500' },
  snippetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chatSnippet: { fontSize: 14, flex: 1, marginRight: 10 },
  typingText: { fontStyle: 'italic', fontWeight: '600' },
  youPrefix: { fontSize: 13, fontWeight: '500' },
  tickInline: { marginRight: 4 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  unreadText: { color: 'white', fontSize: 11, fontWeight: '700' },
  emptyWrap: { height: 250, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyLabel: { fontSize: 16, fontWeight: '600' },
  emptySublabel: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  floatPlus: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, shadowColor: '#7D5CFF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  floatGrad: { flex: 1, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
});
