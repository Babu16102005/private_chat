import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, ScrollView, Platform, SafeAreaView, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, Sun, Moon, Search, Plus, MessageCircle, MoreHorizontal, LayoutGrid, Heart, Briefcase } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { inviteService, messageService } from '../services/supabaseService';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

export const HomeScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlineStatus, setOnlineStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user?.id) {
      fetchChats();
    }
  }, [user]);

  useEffect(() => {
    if (chats.length === 0 || !user?.id) return;

    const channels = chats.map(chat => {
      return messageService.subscribeToPresence(chat.id, user.id, (isOnline: boolean) => {
        setOnlineStatus(prev => ({ ...prev, [chat.id]: isOnline }));
      });
    });

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [chats]);

  const fetchChats = async () => {
    try {
      const data = await inviteService.getMyPairs();
      setChats(data || []);
    } catch (error) { console.error('Fetch chats fail:', error); }
    finally { setLoading(false); }
  };

  const filteredChats = chats.filter(chat => {
    const partner = chat.user_a?.id === user!.id ? chat.user_b : chat.user_a;
    return partner?.name?.toLowerCase().includes(search.toLowerCase());
  });

  const renderBackgroundGlows = () => (
    <View style={styles.glowOverlay}>
      <LinearGradient colors={['rgba(210, 118, 25, 0.2)', 'transparent'] as any} style={[styles.glowBall, { top: -100, right: -50, width: 350, height: 350 }]} />
      <LinearGradient colors={['rgba(210, 118, 25, 0.1)', 'transparent'] as any} style={[styles.glowBall, { bottom: height * 0.2, left: -100, width: 300, height: 300 }]} />
    </View>
  );

  const renderStoryItem = (partner: any, isAdd: boolean = false) => {
    const isOnline = partner?.id && onlineStatus[partner.pairId];
    return (
      <TouchableOpacity 
        style={styles.storyCard}
        onPress={() => isAdd ? navigation.navigate('Invite') : navigation.navigate('Chat', { pairId: partner.pairId, partner })}
      >
        <View style={[styles.storyAvatarWrap, { borderRadius: colors.radius.story, backgroundColor: colors.white, borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}>
          {isAdd ? (
            <Plus size={24} color={colors.primary} strokeWidth={2.5} />
          ) : (
            <Image source={{ uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner?.name || 'User'}` }} style={styles.storyImg} />
          )}
          {isOnline && <View style={[styles.storyBadge, { backgroundColor: colors.tertiary, borderColor: colors.black }]} />}
        </View>
        <Text style={[styles.storyLabel, { color: colors.text }]} numberOfLines={1}>
          {isAdd ? 'You' : (partner?.name?.split(' ')[0] || 'User')}
        </Text>
      </TouchableOpacity>
    );
  };


  const renderChatItem = ({ item }: { item: any }) => {
    const partner = item.user_a?.id === user!.id ? item.user_b : item.user_a;
    const isOnline = onlineStatus[item.id];
    return (
      <TouchableOpacity 
        style={[styles.chatRow, { borderBottomColor: colors.glassBorder, borderBottomWidth: StyleSheet.hairlineWidth }]} 
        onPress={() => navigation.navigate('Chat', { pairId: item.id, partner })}
      >
        <View style={styles.chatThumbWrap}>
          <Image source={{ uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner?.name || 'User'}` }} style={styles.chatThumb} />
          {isOnline && <View style={[styles.onlineIndicator, { backgroundColor: colors.tertiary, borderColor: colors.black }]} />}
        </View>
        <View style={styles.chatMain}>
          <View style={styles.chatTopLine}>
            <Text style={[styles.chatPartnerName, { color: colors.text }]}>{partner?.name || 'Partner'}</Text>
            <Text style={[styles.chatTimestamp, { color: colors.gray }]}>24 mins</Text>
          </View>
          <Text style={[styles.chatSnippet, { color: colors.gray }]} numberOfLines={1}>
            {item.last_message?.content || 'No messages yet'}
          </Text>
        </View>
        {item.unread_count > 0 && (
          <View style={[styles.unreadCount, { backgroundColor: colors.tertiary }]}>
            <Text style={styles.unreadCountText}>{item.unread_count}</Text>
          </View>
        )}
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
      {renderBackgroundGlows()}
      
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Chats</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => Alert.alert('Menu', 'Opening settings...')} style={styles.headerAction}><MoreHorizontal size={24} color={colors.text} /></TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={[styles.headerAvatarMini, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}>
              <Image source={{ uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || 'User'}` }} style={{ width: '100%', height: '100%' }} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchWrapper}>
          <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.searchPill, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}>
            <Search size={20} color={colors.gray} style={{ marginRight: 10 }} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search conversations..."
              placeholderTextColor={colors.gray}
              value={search}
              onChangeText={setSearch}
            />
          </BlurView>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollInside}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storySection} contentContainerStyle={styles.storyContent}>
            {renderStoryItem(null, true)}
            {chats.map(chat => {
              const partner = chat.user_a?.id === user!.id ? chat.user_b : chat.user_a;
              return renderStoryItem({ ...partner, pairId: chat.id }, false);
            })}
          </ScrollView>

          <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.glassListContainer, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth, borderRadius: colors.radius.panel }]}>
            <FlatList
              data={filteredChats}
              keyExtractor={(item) => item.id}
              renderItem={renderChatItem}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <MessageCircle size={40} color={colors.lightGray} strokeWidth={1.5} />
                  <Text style={[styles.emptyLabel, { color: colors.gray }]}>No conversations found</Text>
                </View>
              }
            />
          </BlurView>
        </ScrollView>
      </SafeAreaView>

      <TouchableOpacity 
        style={[styles.floatPlus, { bottom: Math.max(insets.bottom + 15, 30) }]} 
        onPress={() => navigation.navigate('Invite')}
      >
        <LinearGradient colors={colors.gradientSecondary as any} style={styles.floatGrad}>
          <Plus size={30} color="white" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  glowOverlay: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  glowBall: { position: 'absolute', borderRadius: 200 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingTop: 20, paddingBottom: 25 },
  headerTitle: { fontSize: 32, fontWeight: '800' },
  headerRight: { flexDirection: 'row', gap: 15, alignItems: 'center' },
  headerAction: { opacity: 0.8 },
  headerAvatarMini: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden' },
  searchWrapper: { paddingHorizontal: 25, marginBottom: 25 },
  searchPill: { height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, overflow: 'hidden' },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '600' },
  scrollInside: { paddingBottom: 100 },
  storySection: { marginBottom: 30 },
  storyContent: { gap: 18, paddingHorizontal: 25 },
  storyCard: { alignItems: 'center', gap: 10 },
  storyAvatarWrap: { width: 68, height: 68, justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  storyImg: { width: '100%', height: '100%' },
  storyBadge: { position: 'absolute', bottom: 6, right: 6, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  storyLabel: { fontSize: 13, fontWeight: '700', opacity: 0.8 },
  glassListContainer: { marginHorizontal: 20, paddingHorizontal: 10, marginBottom: 40, overflow: 'hidden' },
  chatRow: { flexDirection: 'row', padding: 18, alignItems: 'center' },
  chatThumbWrap: { position: 'relative' },
  chatThumb: { width: 58, height: 58, borderRadius: 20 },
  onlineIndicator: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  chatMain: { flex: 1, marginLeft: 16 },
  chatTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  chatPartnerName: { fontSize: 17, fontWeight: '800' },
  chatTimestamp: { fontSize: 12, fontWeight: '600' },
  chatSnippet: { fontSize: 14, fontWeight: '500', opacity: 0.8 },
  unreadCount: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  unreadCountText: { color: 'white', fontSize: 11, fontWeight: '800' },
  emptyWrap: { height: 300, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyLabel: { fontSize: 15, fontWeight: '600' },
  floatPlus: { position: 'absolute', bottom: 30, right: 25, width: 64, height: 64, borderRadius: 32, shadowColor: '#D27619', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10 },
  floatGrad: { flex: 1, borderRadius: 32, justifyContent: 'center', alignItems: 'center' }
});
