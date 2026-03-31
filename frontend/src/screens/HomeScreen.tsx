import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Image, ActivityIndicator, RefreshControl, Platform, Alert, TextInput } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { inviteService } from '../services/supabaseService';
import { handleError } from '../utils/errorHandler';

export const HomeScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { isDark, toggleTheme, colors } = useTheme();
  const [pairs, setPairs] = useState<any[]>([]);
  const [filteredPairs, setFilteredPairs] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [pairsData, invitesData] = await Promise.all([
        inviteService.getMyPairs(),
        inviteService.getPendingInvites()
      ]);
      setPairs(pairsData);
      setFilteredPairs(pairsData);
      setPendingInvites(invitesData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
    const unsubscribe = navigation.addListener('focus', fetchData);
    const subscription = inviteService.subscribeToInvites((newInvite) => {
      if (newInvite.invitee_email === user?.email?.toLowerCase().trim()) {
        fetchData();
      }
    });
    return () => {
      unsubscribe();
      subscription.unsubscribe();
    };
  }, [fetchData, navigation, user]);

  useEffect(() => {
    if (search.trim() === '') {
      setFilteredPairs(pairs);
    } else {
      const lowerSearch = search.toLowerCase();
      setFilteredPairs(pairs.filter(p => {
        const partner = p.user_a?.id === user?.id ? p.user_b : p.user_a;
        return (partner?.name || partner?.email || '').toLowerCase().includes(lowerSearch);
      }));
    }
  }, [search, pairs, user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleAcceptInvite = async (token: string) => {
    setLoading(true);
    try {
      const pair = await inviteService.acceptInvite(token);
      if (pair) {
        Alert.alert('Success', 'Profile linked! Start chatting now.');
        const partner = pair.user_a?.id === user?.id ? pair.user_b : pair.user_a;
        navigation.navigate('Chat', { pairId: pair.id, partner });
      }
      fetchData();
    } catch (error) {
      handleError(error, 'Accept failed');
    } finally {
      setLoading(false);
    }
  };

  const renderInviteItem = ({ item }: { item: any }) => (
    <View style={[styles.inviteCard, { backgroundColor: colors.white, borderColor: colors.primary }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.inviteName, { color: colors.primary }]}>{item.inviter?.name || 'Someone'}</Text>
        <Text style={[styles.inviteEmail, { color: colors.text }]}>{item.inviter?.email || 'No email'}</Text>
      </View>
      <TouchableOpacity style={[styles.acceptButton, { backgroundColor: colors.primary }]} onPress={() => handleAcceptInvite(item.token)}>
        <Text style={styles.acceptButtonText}>Accept</Text>
      </TouchableOpacity>
    </View>
  );

  const renderChatItem = ({ item }: { item: any }) => {
    const partner = item.user_a?.id === user?.id ? item.user_b : item.user_a;
    if (!partner) return null;
    const lastMsg = item.last_message;
    const time = lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    return (
      <TouchableOpacity
        style={[styles.chatItem, { borderBottomColor: colors.lightGray }]}
        onPress={() => navigation.navigate('Chat', {
          pairId: item.id,
          partnerId: partner?.id,
          partnerName: partner?.name || partner?.email || 'Partner',
          partnerAvatar: partner?.avatar_url
        })}
      >
        <View style={styles.avatarContainer}>
          {partner?.avatar_url ? (
            <Image source={{ uri: partner.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.avatarInitial, { color: colors.white }]}>{(partner?.name || partner?.email || '?')[0].toUpperCase()}</Text>
            </View>
          )}
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={[styles.partnerName, { color: colors.text }]} numberOfLines={1}>{partner?.name || partner?.email || 'Unknown'}</Text>
            <Text style={[styles.timeText, { color: colors.gray }]}>{time}</Text>
          </View>
          <Text style={[styles.lastMessage, { color: colors.gray }]} numberOfLines={1}>
            {lastMsg ? (lastMsg.message_type === 'text' ? lastMsg.content : '📸 Media') : 'No messages yet'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View>
      <View style={styles.searchContainer}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.lightGray, color: colors.text }]}
          placeholder="Search chats..."
          placeholderTextColor={colors.gray}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      {pendingInvites.length > 0 && (
        <View>
          <Text style={[styles.sectionHeader, { color: colors.gray }]}>Pending Invites</Text>
          <FlatList
            data={pendingInvites}
            keyExtractor={item => item.id}
            renderItem={renderInviteItem}
            scrollEnabled={false}
          />
          <Text style={[styles.sectionHeader, { color: colors.gray }]}>Chats</Text>
        </View>
      )}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: colors.white, borderBottomColor: colors.lightGray }]}>
        <Text style={[styles.appTitle, { color: colors.primary }]}>PrivateChat</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={toggleTheme}>
            <Text style={styles.themeIcon}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredPairs}
        keyExtractor={(item) => item.id}
        renderItem={renderChatItem}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.gray }]}>No chats found.</Text>
            <TouchableOpacity style={[styles.newChatButton, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate('Invite')}>
              <Text style={styles.newChatButtonText}>Start a New Chat</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate('Invite')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, paddingTop: Platform.OS === 'android' ? 40 : 10 },
  appTitle: { fontSize: 24, fontWeight: 'bold' },
  settingsIcon: { fontSize: 22 },
  themeIcon: { fontSize: 22, marginRight: 15 },
  searchContainer: { padding: 15 },
  searchInput: { borderRadius: 10, padding: 12, fontSize: 16 },
  sectionHeader: { paddingHorizontal: 15, paddingVertical: 8, fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' },
  inviteCard: { marginHorizontal: 15, marginVertical: 5, padding: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  inviteName: { fontWeight: 'bold', fontSize: 16 },
  inviteEmail: { fontSize: 12, opacity: 0.7 },
  acceptButton: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  acceptButtonText: { color: 'white', fontWeight: 'bold' },
  chatItem: { flexDirection: 'row', padding: 15, alignItems: 'center', borderBottomWidth: 1 },
  avatarContainer: { marginRight: 15 },
  avatar: { width: 55, height: 55, borderRadius: 27.5 },
  avatarPlaceholder: { width: 55, height: 55, borderRadius: 27.5, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 22, fontWeight: 'bold' },
  chatInfo: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  partnerName: { fontSize: 17, fontWeight: 'bold' },
  timeText: { fontSize: 12 },
  lastMessage: { fontSize: 14 },
  listContent: { paddingBottom: 100 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, marginBottom: 20 },
  newChatButton: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: 25 },
  newChatButtonText: { color: 'white', fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  fabText: { color: 'white', fontSize: 35, marginTop: -3 }
});
