import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, SafeAreaView, Image, ViewToken, ActivityIndicator, ImageBackground, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAuth } from '../context/AuthContext';
import { MessageBubble } from '../components/MessageBubble';
import { MediaPicker } from '../components/MediaPicker';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { handleError } from '../utils/errorHandler';
import { messageService, storageService } from '../services/supabaseService';
import { theme } from '../constants/theme';

const MESSAGE_LIMIT = 20;

type Message = { id: string; content: string; sender_id: string; created_at: string; media_url?: string; message_type: 'text' | 'image' | 'video'; delivered_at?: string | null; read_at?: string | null; };

const VideoMessage = ({ uri }: { uri: string }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  return (
    <VideoView
      style={styles.media}
      player={player}
      nativeControls={true}
    />
  );
};

const renderItem = ({ item, user }: { item: Message, user: any }) => {
  const isMe = item.sender_id === user?.id;

  return (
    <View style={{ marginBottom: 5, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
      {item.media_url && item.message_type === 'video' ? (
        <VideoMessage uri={item.media_url} />
      ) : item.media_url && item.message_type === 'image' ? (
        <Image source={{ uri: item.media_url }} style={styles.media} />
      ) : null}
      {item.content ? (
        <MessageBubble
          content={item.content}
          isMe={isMe}
          timestamp={item.created_at}
          delivered_at={item.delivered_at}
          read_at={item.read_at}
        />
      ) : null}
    </View>
  );
};

export const ChatScreen = ({ route, navigation }: any) => {
  const { pairId, partnerId, partnerName, partnerAvatar } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const [messageSubscription, setMessageSubscription] = useState<any>(null);
  const [typingChannel, setTypingChannel] = useState<any>(null);
  const [presenceChannel, setPresenceChannel] = useState<any>(null);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const viewabilityConfig = { viewAreaCoveragePercentThreshold: 50 };

  usePushNotifications();

  useEffect(() => {
    fetchMessages();

    return () => {
      if (messageSubscription) messageSubscription.unsubscribe();
      if (typingChannel) typingChannel.unsubscribe();
      if (presenceChannel) presenceChannel.unsubscribe();
    };
  }, []);

  const handleNewMessage = useCallback(async (newMessage: Message) => {
    if (newMessage.sender_id !== user?.id) {
      await messageService.markMessagesAsDelivered([newMessage.id]);
      newMessage.delivered_at = new Date().toISOString();
    }
    setMessages(prev => [newMessage, ...prev.filter(m => m.id !== newMessage.id)]);
  }, [user]);

  const fetchMessages = async () => {
    if (!user || !pairId) return;
    setLoading(true);
    try {
      const initialMsgs = await messageService.getMessages(pairId, MESSAGE_LIMIT, 0);
      if (initialMsgs) {
        setMessages(initialMsgs);
        setOffset(1);
        if (initialMsgs.length < MESSAGE_LIMIT) setHasMore(false);
      }

      const msgSub = messageService.subscribeToMessages(pairId, handleNewMessage);
      setMessageSubscription(msgSub);

      const typCh = messageService.subscribeToTyping(pairId, user.id, setIsPartnerTyping);
      setTypingChannel(typCh);

      const presCh = messageService.subscribeToPresence(pairId, user.id, setIsPartnerOnline);
      setPresenceChannel(presCh);

    } catch (error) {
      handleError(error, 'Error fetching messages');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (loadingMore || !hasMore || !pairId) return;

    setLoadingMore(true);
    try {
      const olderMsgs = await messageService.getMessages(pairId, MESSAGE_LIMIT, offset * MESSAGE_LIMIT);
      if (olderMsgs && olderMsgs.length > 0) {
        setMessages(prev => [...prev, ...olderMsgs]);
        setOffset(prev => prev + 1);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      handleError(error, 'Error fetching older messages');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleTyping = (text: string) => {
    setInput(text);
    if (typingChannel) {
      if (text.length > 0) {
        messageService.sendTypingIndicator(typingChannel, true);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => messageService.sendTypingIndicator(typingChannel, false), 3000);
      } else {
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        messageService.sendTypingIndicator(typingChannel, false);
      }
    }
  };

  const handleMediaSelect = async (asset: ImagePicker.ImagePickerAsset) => {
    const fileType = asset.type === 'video' ? 'video' : 'image';
    try {
      const file = {
        uri: asset.uri,
        name: asset.fileName || `media.${fileType === 'video' ? 'mp4' : 'jpg'}`,
        type: asset.mimeType || (fileType === 'video' ? 'video/mp4' : 'image/jpeg'),
      };
      const publicUrl = await storageService.uploadFile(file, 'chat-media');
      sendMessage(input, publicUrl, fileType);
    } catch (error: any) {
      Alert.alert('Upload Error', error.message);
    }
  };

  const sendMessage = async (content: string, mediaUrl?: string, messageType: 'text' | 'image' | 'video' = 'text') => {
    if ((!content.trim() && !mediaUrl) || !pairId) return;

    try {
      await messageService.sendMessage(pairId, content, mediaUrl, messageType);

      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      if (typingChannel) messageService.sendTypingIndicator(typingChannel, false);
      setInput('');
    } catch (error) {
      handleError(error, 'Failed to send message');
    }
  };

  const handleViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const toMarkAsRead = viewableItems
      .filter(item => !item.item.read_at && item.item.sender_id !== user?.id)
      .map(item => item.item.id);

    if (toMarkAsRead.length > 0) {
      toMarkAsRead.forEach(id => messageService.markMessageAsRead(id));
      setMessages(prev => prev.map(msg => toMarkAsRead.includes(msg.id) ? { ...msg, read_at: new Date().toISOString() } : msg));
    }
  }, [user]);

  const renderFooter = () => {
    if (!loadingMore) return null;
    return <ActivityIndicator style={{ marginVertical: 20 }} size="small" color={theme.colors.primary} />;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ flex: 1 }} size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1518895318346-f32b4091d599' }}
      style={styles.container}
      imageStyle={styles.bgImage}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.headerIcon}>←</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {partnerAvatar ? (
              <Image source={{ uri: partnerAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{(partnerName || '?')[0].toUpperCase()}</Text>
              </View>
            )}
            <View>
              <Text style={styles.headerTitle}>{partnerName}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {isPartnerOnline && <View style={styles.onlineDot} />}
                <Text style={styles.onlineStatus}>{isPartnerOnline ? 'Online' : 'Offline'}</Text>
              </View>
            </View>
          </View>
        </View>
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={(props) => renderItem({ ...props, user })}
          inverted
          contentContainerStyle={styles.listContent}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
        {isPartnerTyping && <Text style={styles.typingIndicator}>{partnerName} is typing...</Text>}
        <View style={styles.inputContainer}>
          <MediaPicker onMediaSelect={handleMediaSelect} />
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={handleTyping}
            placeholder="Message..."
            placeholderTextColor={theme.colors.gray}
          />
          <TouchableOpacity style={styles.sendButton} onPress={() => sendMessage(input)}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bgImage: { opacity: 0.1 },
  safeArea: { flex: 1 },
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    padding: 15,
    paddingTop: 45,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    ...Platform.select({
      ios: {
        shadowColor: 'black',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
      }
    }),
  },
  backButton: {
    marginRight: 15,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarInitial: {
    color: theme.colors.white,
    fontWeight: 'bold',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.primary },
  onlineStatus: { fontSize: 12, color: theme.colors.gray, marginLeft: 5 },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'green',
  },
  headerIcon: { fontSize: 24, color: theme.colors.primary },
  listContent: { padding: 15, paddingBottom: 20 },
  media: { width: 250, height: 250, borderRadius: 20, marginBottom: 5 },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.lightGray
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.lightGray,
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginRight: 10,
    fontSize: 16,
    color: theme.colors.text,
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  sendText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 16 },
  typingIndicator: { paddingHorizontal: 15, paddingBottom: 10, fontStyle: 'italic', color: theme.colors.gray }
});
