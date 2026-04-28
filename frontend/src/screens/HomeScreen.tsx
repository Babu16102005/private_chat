import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, SafeAreaView, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Moon, Search, Plus, MessageCircle, Droplets, X, Check, CheckCheck, Settings } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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
    const avatarSource = partner?.avatar_url
      ? { uri: partner.avatar_url }
      : { uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}` };
    const lastMsg = item.last_message;
    const lastMsgTime = lastMsg?.created_at;
    const isLastMsgFromMe = lastMsg?.sender_id === user?.id;
    const hasUnread = item.unread_count > 0;

    return (
      <TouchableOpacity
        style={styles.chatRowTouch}
        onPress={() => navigation.navigate('Chat', { pairId: item.id, partner })}
        activeOpacity={0.78}
      >
        <BlurView intensity={colors.glassBlur + 10} tint="dark" style={[styles.chatRow, { borderColor: 'rgba(255,255,255,0.14)' }]}> 
          <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(115,55,185,0.2)', 'rgba(8,2,24,0.46)'] as any} style={StyleSheet.absoluteFill} />
          <View style={styles.chatRowFrost} />
          <View style={styles.chatThumbWrap}>
            <View style={[styles.chatThumbGlass, { borderColor: colors.glassBorder }]}> 
              <Image
                source={avatarSource}
                style={[styles.chatThumb, { borderRadius: colors.radius.story }]}
              />
            </View>
            {isOnline && (
              <View style={[styles.onlineIndicator, { backgroundColor: colors.tertiary, borderColor: 'rgba(255,255,255,0.75)' }]} />
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
                {isTyping ? (
                  <Text style={[styles.chatSnippet, styles.typingText, { color: colors.tertiary }]}> 
                    typing...
                  </Text>
                ) : (
                  <>
                    {isLastMsgFromMe && (
                      <>
                        <Text style={[styles.youPrefix, { color: hasUnread ? 'rgba(255,255,255,0.72)' : colors.gray }]}> 
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
                <LinearGradient colors={colors.gradientSecondary as any} style={styles.unreadBadge}> 
                  <Text style={styles.unreadText}>{item.unread_count}</Text>
                </LinearGradient>
              )}
            </View>
          </View>
        </BlurView>
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
        <LinearGradient colors={['rgba(185, 76, 255, 0.52)', 'transparent'] as any} style={[styles.glowBall, { top: -120, right: -80, width: 380, height: 380 }]} />
        <LinearGradient colors={['rgba(37, 214, 255, 0.32)', 'transparent'] as any} style={[styles.glowBall, { top: height * 0.26, left: -140, width: 320, height: 320 }]} />
        <LinearGradient colors={['rgba(255, 122, 92, 0.24)', 'transparent'] as any} style={[styles.glowBall, { bottom: -80, right: -80, width: 280, height: 280 }]} />
      </View>

      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Chats</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={toggleTheme} style={styles.headerAction}>
              {themeMode === 'obsidian' ? <Droplets size={24} color={colors.primary} /> : <Moon size={24} color={colors.primary} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={[styles.settingsButton, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
              <Settings size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchWrapper}>
          <BlurView intensity={colors.glassBlur + 8} tint={isDark ? 'dark' : 'light'} style={[styles.searchBar, { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: colors.glassBorder, borderRadius: 22 }]}> 
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
          </BlurView>
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
        <LinearGradient colors={colors.gradientSecondary as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.floatGrad}>
          <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }} style={styles.floatShine} />
          <Plus size={28} color="white" strokeWidth={2.5} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  glowBall: { position: 'absolute', borderRadius: 220, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingTop: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 32, fontWeight: '800' },
  headerRight: { flexDirection: 'row', gap: 15, alignItems: 'center' },
  headerAction: { opacity: 0.8 },
  settingsButton: { width: 40, height: 40, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', shadowColor: '#B94CFF', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.28, shadowRadius: 20, elevation: 6 },
  searchWrapper: { paddingHorizontal: 20, marginBottom: 20 },
  searchBar: { height: 50, borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  searchInput: { flex: 1, fontSize: 15 },
  listContainer: { flex: 1 },
  listInside: { paddingBottom: 100, paddingTop: 2 },
  chatRowTouch: { marginHorizontal: 14, marginBottom: 12, borderRadius: 28, shadowColor: '#B94CFF', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.24, shadowRadius: 30, elevation: 6 },
  chatRow: { flexDirection: 'row', padding: 16, alignItems: 'center', paddingHorizontal: 18, borderRadius: 28, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, backgroundColor: 'rgba(18,7,42,0.5)' },
  chatRowFrost: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(110,42,190,0.055)' },
  chatThumbWrap: { position: 'relative' },
  chatThumbGlass: { width: 62, height: 62, borderRadius: 31, padding: 3, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: StyleSheet.hairlineWidth, shadowColor: '#B94CFF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 14, elevation: 4 },
  chatThumb: { width: 56, height: 56 },
  onlineIndicator: { position: 'absolute', bottom: 1, right: 1, width: 15, height: 15, borderRadius: 8, borderWidth: 2 },
  chatMain: { flex: 1, marginLeft: 14 },
  chatTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 },
  chatPartnerName: { fontSize: 16, fontWeight: '700' },
  chatTimestamp: { fontSize: 12, fontWeight: '500' },
  snippetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chatSnippet: { fontSize: 14, flex: 1, marginRight: 10 },
  typingText: { fontStyle: 'italic', fontWeight: '600' },
  youPrefix: { fontSize: 13, fontWeight: '500' },
  tickInline: { marginRight: 4 },
  unreadBadge: { minWidth: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.38)', overflow: 'hidden' },
  unreadText: { color: 'white', fontSize: 11, fontWeight: '700' },
  emptyWrap: { height: 250, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyLabel: { fontSize: 16, fontWeight: '600' },
  emptySublabel: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  floatPlus: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.14)', shadowColor: '#B94CFF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.42, shadowRadius: 20, elevation: 8 },
  floatGrad: { flex: 1, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  floatShine: { position: 'absolute', top: 2, left: 9, right: 9, height: 20, borderRadius: 999, opacity: 0.34 },
});
