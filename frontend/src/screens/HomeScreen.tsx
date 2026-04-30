import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Plus, MessageCircle, X, Check, CheckCheck, Settings, CirclePlus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '../context/AuthContext';
import { inviteService, messageService, storyService } from '../services/supabaseService';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';

import { formatChatListTime } from '../utils/date';

export const HomeScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { colors, isDark, themeMode, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();

  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlineStatus, setOnlineStatus] = useState<Record<string, boolean>>({});
  const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({});
  const [stories, setStories] = useState<any[]>([]);

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

  const fetchStories = useCallback(async () => {
    const data = await storyService.getStories();
    if (isMountedRef.current) setStories(data || []);
  }, []);

  // Fetch chats when user becomes available
  useEffect(() => {
    if (user?.id) {
      fetchChats();
      fetchStories();
    }
  }, [user?.id, fetchChats, fetchStories]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchChats();
        fetchStories();
      }
    }, [fetchChats, fetchStories, user?.id])
  );

  useEffect(() => {
    const channel = storyService.subscribeToStories(fetchStories);
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStories]);

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
        <BlurView intensity={colors.glassBlur + 14} tint={isDark ? 'dark' : 'light'} style={[styles.chatRow, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}>
          <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.02)'] as any} style={StyleSheet.absoluteFill} />
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

  const renderStories = () => {
    const mine = stories.filter((story) => story.user_id === user.id);
    const others = stories.filter((story) => story.user_id !== user.id);

    return (
      <View style={styles.storiesWrap}>
        <FlatList
          horizontal
          data={[{ id: 'create-story', create: true }, ...mine, ...others]}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesList}
          renderItem={({ item }) => {
            if (item.create) {
              return (
                <TouchableOpacity style={styles.storyItem} onPress={() => navigation.navigate('CreateStory')}>
                  <View style={[styles.storyRing, { borderColor: colors.primary }]}> 
                    <CirclePlus size={30} color={colors.primary} />
                  </View>
                  <Text style={[styles.storyName, { color: colors.gray }]} numberOfLines={1}>Your story</Text>
                </TouchableOpacity>
              );
            }
            const seed = item.user?.name || item.user?.email || 'Story';
            const avatarSource = item.user?.avatar_url ? { uri: item.user.avatar_url } : { uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}` };
            return (
              <TouchableOpacity style={styles.storyItem} onPress={() => navigation.navigate('StoryViewer', { story: item })}>
                <LinearGradient colors={colors.gradientSecondary as any} style={styles.storyRing}>
                  <Image source={item.media_type === 'image' ? { uri: item.media_url } : avatarSource} style={styles.storyThumb} />
                </LinearGradient>
                <Text style={[styles.storyName, { color: colors.gray }]} numberOfLines={1}>{item.user_id === user.id ? 'You' : item.user?.name || 'Story'}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
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
        <LinearGradient colors={colors.gradientPrimary as any} start={{ x: 0.08, y: 0 }} end={{ x: 0.95, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(100,243,255,0.11)', 'rgba(233,199,255,0.06)', 'transparent'] as any} start={{ x: 1, y: 0 }} end={{ x: 0.12, y: 0.72 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['transparent', 'rgba(141,255,213,0.07)', isDark ? 'rgba(5,7,18,0.24)' : 'rgba(118,159,205,0.15)'] as any} start={{ x: 0, y: 0.22 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </View>

      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Chats</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={toggleTheme}
              style={[styles.themeToggle, { borderColor: colors.glassBorder }]}
              activeOpacity={0.82}
            >
              <LinearGradient colors={colors.gradientSecondary as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={[styles.themeToggleLabel, { color: themeMode === 'obsidian' ? colors.text : colors.gray }]}>1</Text>
              <Text style={[styles.themeToggleLabel, { color: themeMode === 'mocha' ? colors.text : colors.gray }]}>2</Text>
              <View style={[styles.themeToggleKnob, { transform: [{ translateX: themeMode === 'obsidian' ? 0 : 24 }], backgroundColor: 'rgba(255,255,255,0.9)' }]} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={[styles.settingsButton, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}>
              <Settings size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchWrapper}>
          <BlurView intensity={colors.glassBlur + 18} tint={isDark ? 'dark' : 'light'} style={[styles.searchBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(128,128,128,0.03)', borderColor: colors.glassBorder, borderRadius: 22, borderWidth: colors.borderWidth }]}> 
            <Search size={18} color={colors.gray} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search conversations..."
              placeholderTextColor={colors.gray}
              value={search}
              onChangeText={setSearch}
              underlineColorAndroid="transparent"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={16} color={colors.gray} />
              </TouchableOpacity>
            )}
          </BlurView>
        </View>

        {renderStories()}

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
        style={[styles.floatPlus, { 
          bottom: Math.max(insets.bottom + 20, 30),
          borderColor: isDark ? 'rgba(255,255,255,0.2)' : colors.primary,
          borderWidth: 1.5,
          shadowColor: isDark ? colors.primary : 'rgba(0,0,0,0.1)'
        }]}
        onPress={() => navigation.navigate('Invite')}
        activeOpacity={0.8}
      >
        <BlurView intensity={colors.glassBlur + 40} tint={isDark ? 'dark' : 'light'} style={styles.floatBlur}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.3)' }]} />
          <Plus size={32} color={isDark ? 'white' : colors.primary} strokeWidth={3} />
        </BlurView>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingTop: 32, paddingBottom: 18 },
  headerTitle: { fontSize: 32, lineHeight: 38, fontWeight: '800' },
  headerRight: { flexDirection: 'row', gap: 10, alignItems: 'center', height: 38 },
  themeToggle: { width: 56, height: 30, borderRadius: 15, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, backgroundColor: 'rgba(128,128,128,0.08)' },
  themeToggleLabel: { fontSize: 11, fontWeight: '900', zIndex: 2, letterSpacing: 0.3 },
  themeToggleKnob: { position: 'absolute', left: 3, width: 24, height: 24, borderRadius: 12, zIndex: 1, shadowColor: '#64F3FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.26, shadowRadius: 8, elevation: 4 },
  settingsButton: { width: 36, height: 36, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(128,128,128,0.1)', borderWidth: 0.5 },
  searchWrapper: { paddingHorizontal: 20, marginBottom: 20 },
  searchBar: { height: 50, borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, overflow: 'hidden' },
  searchInput: { flex: 1, fontSize: 15 },
  storiesWrap: { marginTop: -6, marginBottom: 16 },
  storiesList: { paddingHorizontal: 16, gap: 12 },
  storyItem: { width: 72, alignItems: 'center' },
  storyRing: { width: 64, height: 64, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center', padding: 3, overflow: 'hidden' },
  storyThumb: { width: 56, height: 56, borderRadius: 21 },
  storyName: { fontSize: 11, fontWeight: '700', marginTop: 6, maxWidth: 72 },
  listContainer: { flex: 1 },
  listInside: { paddingBottom: 100, paddingTop: 2 },
  chatRowTouch: { marginHorizontal: 14, marginBottom: 12, borderRadius: 28 },
  chatRow: { flexDirection: 'row', padding: 16, alignItems: 'center', paddingHorizontal: 18, borderRadius: 28, overflow: 'hidden' },
  chatRowFrost: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  chatThumbWrap: { position: 'relative' },
  chatThumbGlass: { width: 62, height: 62, borderRadius: 31, padding: 3, backgroundColor: 'rgba(128,128,128,0.06)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)' },
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
  floatPlus: { position: 'absolute', right: 20, width: 64, height: 64, borderRadius: 100, overflow: 'hidden', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12 },
  floatBlur: { flex: 1, borderRadius: 100, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  liquidShine: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%', opacity: 0.4 },
});
