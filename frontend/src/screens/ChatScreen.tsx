import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Image, Alert, Platform, KeyboardAvoidingView, Dimensions, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ChevronLeft, Phone, Video, Mic, Plus, SendHorizontal, Search, X, Square, MoreVertical, Reply as ReplyIcon } from 'lucide-react-native';
import { messageService, deleteMessageService, storageService, profileService, messageReactionsService } from '../services/supabaseService';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';

import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { MessageBubble, ReplyToMessage } from '../components/MessageBubble';
import { ImageViewer } from '../components/ImageViewer';
import { MediaViewer } from '../components/MediaViewer';
import { useTheme } from '../context/ThemeContext';
import { useCall } from '../context/CallContext';

import { formatMessageTime, formatDateHeader, getDateKey } from '../utils/date';

const { width, height } = Dimensions.get('window');

type MessageDateGroup = { dateKey: string; messages: any[] };

export const ChatScreen = ({ route, navigation }: any) => {
  const { pairId, partner } = route.params;
  const { user } = useAuth();
  const { colors, isDark, themeMode } = useTheme();
  const { initiateCall } = useCall();
  const insets = useSafeAreaInsets();
  const isMountedRef = useRef(true);

  const [messages, setMessages] = useState<any[]>([]);
  const [groupedMessages, setGroupedMessages] = useState<MessageDateGroup[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [senderName, setSenderName] = useState('');

  // Reply state
  const [replyingTo, setReplyingTo] = useState<ReplyToMessage | null>(null);

  // ImageViewer state
  const [imageViewerUri, setImageViewerUri] = useState<string | null>(null);

  // MediaViewer state
  const [mediaViewerUri, setMediaViewerUri] = useState<string | null>(null);
  const [mediaViewerType, setMediaViewerType] = useState<'image' | 'video' | 'audio'>('image');

  const flatListRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);
  const typingChannelRef = useRef<any>(null);
  const msgChannelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const footerRef = useRef<View>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Mounted ref for unmount guard
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Clear typing timeout to prevent state updates after unmount
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // Fetch sender name from user profile
  useEffect(() => {
    (async () => {
      if (user?.id && isMountedRef.current) {
        const profile = await profileService.getProfile(user.id);
        if (profile?.name && isMountedRef.current) setSenderName(profile.name);
      }
    })();
  }, [user]);

  // Main effect: fetch messages and setup subscriptions
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        await fetchMessages();
      } catch {
        // fetchMessages already logs errors
      }

      if (cancelled) return;

      // Subscriptions
      const msgChannel = messageService.subscribeToMessages(pairId, (newMessage: any) => {
        if (newMessage.sender_id !== user!.id) {
          messageService.markMessageAsRead(newMessage.id);
        }
        setMessages(prev => [...prev, newMessage]);
      });
      msgChannelRef.current = msgChannel;

      const presenceChannel = messageService.subscribeToPresence(pairId, user!.id, (online: boolean) => {
        if (isMountedRef.current) {
          setIsOnline(online);
        }
      });
      presenceChannelRef.current = presenceChannel;

      typingChannelRef.current = messageService.subscribeToTyping(pairId, user!.id, (typing: boolean) => {
        if (isMountedRef.current) {
          setIsPartnerTyping(typing);
        }
      });
    };

    setup();

    return () => {
      cancelled = true;
      // Clean up all channels
      if (msgChannelRef.current) {
        supabase.removeChannel(msgChannelRef.current);
        msgChannelRef.current = null;
      }
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
    };
  }, [pairId]);

  // Group messages by date (memoized to avoid re-computing on every render)
  useEffect(() => {
    if (messages.length === 0) { setGroupedMessages([]); return; }
    const groups: MessageDateGroup[] = [];
    let currentDateKey = '';

    for (const msg of messages) {
      const key = getDateKey(msg.created_at);
      if (key !== currentDateKey) {
        currentDateKey = key;
        groups.push({ dateKey: msg.created_at, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    }

    setGroupedMessages(groups);
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const fetchMessages = async () => {
    try {
      const data = await messageService.getMessages(pairId);
      // Filter out messages that were hidden by the user ("delete for me")
      // Bug 7 fix: batch deleted check in single query instead of N+1 individual queries
      const userId = user!.id;
      const messageIds = (data || []).map(m => m.id);
      const deletedIds = await deleteMessageService.getDeletedIdsForUser(userId, messageIds);
      const checked: boolean[] = (data || []).map(m => deletedIds.has(m.id));
      const filtered = (data || []).filter((_, i) => !checked[i]);
      // Bug 8 fix: removed blanket auto-mark on fetch (only realtime handler marks as read)
      setMessages([...filtered].reverse());
    } catch (error) { console.error('Fetch msgs fail:', error); }
    finally { setLoading(false); }
  };

  const handleTyping = (text: string) => {
    setInput(text);
    if (!typingChannelRef.current || !isMountedRef.current) return;

    messageService.sendTypingIndicator(typingChannelRef.current, true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && typingChannelRef.current) {
        messageService.sendTypingIndicator(typingChannelRef.current, false);
      }
    }, 2000);
  };

  const sendMessage = useCallback(async (content: string, mediaUrl?: string, msgType?: any) => {
    const trimmed = content?.trim();
    if (!trimmed && !mediaUrl) return;
    try {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingChannelRef.current) {
        messageService.sendTypingIndicator(typingChannelRef.current, false);
      }

      await messageService.sendMessage(pairId, trimmed, mediaUrl, msgType || 'text', replyingTo?.id);
      setReplyingTo(null);
      setInput('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      console.error('Send message fail:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  }, [pairId, replyingTo]);

  const handleImageTap = (uri: string) => {
    setImageViewerUri(uri);
  };

  const handleCloseImageViewer = () => {
    setImageViewerUri(null);
  };

  const handleMediaTap = (uri: string, type: 'image' | 'video' | 'audio') => {
    setMediaViewerUri(uri);
    setMediaViewerType(type);
  };

  const handleCloseMediaViewer = () => {
    setMediaViewerUri(null);
  };

  const handleAttach = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const response = await fetch(asset.uri);
        const blob: any = await response.blob();
        blob.name = asset.uri.split('/').pop() || 'photo';

        // Ensure correct MIME type based on asset type
        if (asset.type === 'video') {
          blob.type = asset.mimeType || 'video/mp4';
        } else {
          blob.type = asset.mimeType || 'image/jpeg';
        }

        const url = await storageService.uploadFile(blob);
        await sendMessage('', url, asset.type === 'video' ? 'video' : 'image');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to attach media');
    }
  };

  const startVoice = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission required', 'Please grant microphone permission to send voice messages.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Could not start recording. Microphone may be in use.');
    }
  };

  const stopVoice = async () => {
    if (!recording) return;
    try {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        let blob: any;

        // Try fetching as blob first
        try {
          const response = await fetch(uri);
          blob = await response.blob();
        } catch (fetchErr) {
          console.warn('fetch() failed for audio URI, trying base64 fallback:', fetchErr);
          // Fallback: read file as base64 then create blob
          // This handles content:// / file:// URIs that fetch() can't read
          const base64 = require('react-native/Libraries/Blob/BlobManager');
          // In React Native, we need to create a File-like object from the URI
          // The cleanest approach: use the URL directly as the data source
          blob = {
            uri: uri,
            name: 'voice.m4a',
            type: 'audio/mp4',
          };
        }

        blob.name = 'voice.m4a';
        blob.type = 'audio/mp4';
        const url = await storageService.uploadFile(blob);
        await sendMessage('', url, 'audio');
      }
    } catch (error: any) {
      console.error('Voice upload failed:', error);
      Alert.alert('Error', 'Failed to send voice message.');
    }
  };

  const getStatusText = () => {
    if (isPartnerTyping) return 'typing...';
    return isOnline ? 'Online' : 'Offline';
  };

  const startReply = (msg: any) => {
    const senderName = msg.sender_id === user!.id
      ? 'You'
      : (partner?.name || 'Partner');

    setReplyingTo({
      id: msg.id,
      content: msg.content,
      senderName,
      messageType: msg.message_type,
      mediaUrl: msg.media_url,
    });
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  // Grouped list render
  const renderMessageGroup = ({ item: group }: { item: MessageDateGroup }) => {
    return (
      <>
        <View style={styles.dateSeparator}>
          <View style={[styles.datePill, { backgroundColor: 'rgba(128,128,128,0.15)' }]}>
            <Text style={[styles.dateText, { color: 'rgba(255,255,255,0.5)' }]}>
              {formatDateHeader(group.dateKey)}
            </Text>
          </View>
        </View>
        {group.messages.map((msg) => {
          let replyToMessage: ReplyToMessage | null = null;
          if (msg.reply_to_message_id) {
            replyToMessage = {
              id: msg.reply_to_message_id,
              content: msg.reply_content,
              senderName: msg.reply_sender_name || 'Unknown',
              messageType: msg.reply_message_type,
            };
          }

          return (
            <MessageBubble
              key={msg.id}
              content={msg.content}
              mediaUrl={msg.media_url}
              messageType={msg.message_type}
              isMe={msg.sender_id === user!.id}
              timestamp={msg.created_at}
              delivered_at={msg.delivered_at}
              read_at={msg.read_at}
              onDelete={() => deleteMessageService.deleteForMe(msg.id)}
              onReply={() => startReply(msg)}
              replyToMessage={replyToMessage}
              onImageTap={(uri) => handleImageTap(uri)}
              onMediaTap={(u, t) => handleMediaTap(u, t)}
            />
          );
        })}
      </>
    );
  };

  // Search results fallback
  const filteredMessages = isSearching && searchQuery
    ? messages.filter(m => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const renderSearchResultItem = ({ item }: { item: any }) => (
    <MessageBubble
      content={item.content}
      mediaUrl={item.media_url}
      messageType={item.message_type}
      isMe={item.sender_id === user!.id}
      timestamp={item.created_at}
      delivered_at={item.delivered_at}
      read_at={item.read_at}
      onDelete={() => deleteMessageService.deleteForMe(item.id)}
      onReply={() => startReply(item)}
      onImageTap={(uri) => handleImageTap(uri)}
      onMediaTap={(u, t) => handleMediaTap(u, t)}
    />
  );

  const renderEmptyChat = () => (
    <View style={styles.emptyChat}>
      <View style={[styles.emptyAvatarWrap, { borderColor: colors.glassBorder }]}>
        <Image source={{ uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner?.name || 'Partner'}` }} style={styles.emptyAvatar} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        Say hello to {partner?.name || 'your partner'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.gray }]}>
        Send your first message to start the conversation
      </Text>
    </View>
  );

  const openChatSettings = () => {
    navigation.navigate('ChatSettings', { pairId, partner });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Subtle background gradient */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={colors.gradientPrimary as any} style={StyleSheet.absoluteFill} />
        {themeMode === 'mocha' && (
          <>
            <LinearGradient colors={['rgba(255, 107, 74, 0.08)', 'transparent'] as any} style={[styles.glowBall, { top: height * 0.1, left: -50, width: 200, height: 200 }]} />
            <LinearGradient colors={['rgba(255, 107, 74, 0.05)', 'transparent'] as any} style={[styles.glowBall, { bottom: height * 0.1, right: -50, width: 200, height: 200 }]} />
          </>
        )}
      </View>

      {/* ImageViewer modal */}
      {imageViewerUri && (
        <ImageViewer
          uri={imageViewerUri}
          visible={!!imageViewerUri}
          onClose={handleCloseImageViewer}
        />
      )}

      {/* MediaViewer modal */}
      {mediaViewerUri && (
        <MediaViewer
          uri={mediaViewerUri}
          visible={!!mediaViewerUri}
          onClose={handleCloseMediaViewer}
          messageType={mediaViewerType}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <BlurView
          intensity={themeMode === 'obsidian' ? 10 : colors.glassBlur}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.headerBlur, { borderBottomColor: colors.glassBorder, borderBottomWidth: colors.borderWidth > 0 ? colors.borderWidth : 0.5 }]}
        >
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBtn}>
                <ChevronLeft size={28} color={colors.text} strokeWidth={2.5} />
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.7} onPress={() => Alert.alert('Profile', partner?.name || 'Partner')} style={styles.partnerInfo}>
                <View style={styles.avatarWrap}>
                  <Image source={{ uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner?.name || 'Partner'}` }} style={[styles.headerAvatar, { borderRadius: colors.radius.story }]} />
                  {isOnline && (
                    <View style={[styles.onlineDot, { backgroundColor: colors.tertiary, borderColor: colors.background }]} />
                  )}
                </View>
                <View style={styles.partnerTextWrap}>
                  <Text style={[styles.headerName, { color: colors.text }]}>{partner?.name || 'Partner'}</Text>
                  <Text style={[
                    styles.statusTxt,
                    { color: isPartnerTyping ? colors.tertiary : colors.gray },
                    (!isOnline && !isPartnerTyping) && styles.offlineStatus,
                  ]}>
                    {getStatusText()}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.headerActions}>
                <TouchableOpacity onPress={() => initiateCall(pairId, partner, false)} style={styles.actionIcon}><Phone size={22} color={colors.text} /></TouchableOpacity>
                <TouchableOpacity onPress={() => initiateCall(pairId, partner, true)} style={styles.actionIcon}><Video size={22} color={colors.text} /></TouchableOpacity>
                <TouchableOpacity onPress={() => setIsSearching(!isSearching)} style={styles.actionIcon}>
                  {isSearching ? <X size={22} color={colors.text} /> : <Search size={22} color={colors.text} />}
                </TouchableOpacity>
                <TouchableOpacity onPress={openChatSettings} style={styles.actionIcon}><MoreVertical size={20} color={colors.text} /></TouchableOpacity>
              </View>
            </View>
            {isSearching && (
              <View style={styles.searchBarRow}>
                <BlurView
                  intensity={themeMode === 'obsidian' ? 10 : colors.glassBlur}
                  tint={isDark ? 'dark' : 'light'}
                  style={[styles.searchInputBar, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: colors.glassBorder, borderRadius: 12 }]}
                >
                  <Search size={18} color={colors.gray} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.searchField, { color: colors.text }]}
                    placeholder="Search in chat..."
                    placeholderTextColor={colors.gray}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <X size={16} color={colors.gray} />
                    </TouchableOpacity>
                  )}
                </BlurView>
              </View>
            )}
          </SafeAreaView>
        </BlurView>

        {/* Messages List */}
        {messages.length > 0 && !isSearching ? (
          <FlatList<any>
            ref={flatListRef}
            data={groupedMessages}
            renderItem={renderMessageGroup}
            keyExtractor={(item) => item.dateKey + (item.messages[0]?.id || '')}
            contentContainerStyle={[styles.listInside, isSearching && { paddingBottom: 0 }]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={messages.length <= 0 ? renderEmptyChat : null}
            ListFooterComponent={<View ref={footerRef as any} style={{ height: 8 }} />}
          />
        ) : isSearching && searchQuery.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={filteredMessages}
            renderItem={renderSearchResultItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listInside}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.searchEmpty}>
                <Search size={40} color={colors.gray} strokeWidth={1.5} />
                <Text style={[styles.searchEmptyText, { color: colors.gray }]}>
                  No results for "{searchQuery}"
                </Text>
              </View>
            }
          />
        ) : (
          <FlatList<any>
            ref={flatListRef}
            data={groupedMessages}
            renderItem={renderMessageGroup}
            keyExtractor={(item) => item.dateKey + (item.messages[0]?.id || '')}
            contentContainerStyle={styles.listInside}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyChat}
            ListFooterComponent={<View ref={footerRef as any} style={{ height: 8 }} />}
          />
        )}

        {/* Reply preview bar */}
        {replyingTo && (
          <View style={[styles.replyPreviewBar, { backgroundColor: 'rgba(128,128,128,0.1)', borderTopColor: colors.primary, borderTopWidth: 2 }]}>
            <View style={[styles.replyAccentBar, { backgroundColor: colors.primary }]} />
            <View style={styles.replyContent}>
              <Text style={[styles.replyName, { color: colors.primary }]} numberOfLines={1}>{replyingTo.senderName}</Text>
              <Text style={[styles.replyText, { color: colors.gray }]} numberOfLines={1}>
                {replyingTo.messageType === 'image' ? '📷 Photo' : replyingTo.messageType === 'audio' ? '🎤 Voice message' : replyingTo.content}
              </Text>
            </View>
            <TouchableOpacity onPress={cancelReply} style={styles.replyCancelBtn}>
              <X size={18} color={colors.gray} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Bar */}
        <View style={[styles.pillWrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {recording && (
            <Animated.View style={[styles.recordingIndicator, { transform: [{ scale: pulseAnim }] }]}>
              <View style={[styles.recordingDot, { backgroundColor: '#FF3B30' }]} />
              <Text style={styles.recordingText}>Recording... Tap mic to stop</Text>
            </Animated.View>
          )}

          <BlurView
            intensity={themeMode === 'obsidian' ? 10 : colors.glassBlur}
            tint={isDark ? 'dark' : 'light'}
            style={[styles.inputBar, {
              backgroundColor: themeMode === 'obsidian' ? colors.bubbleSentBg : 'rgba(255,255,255,0.05)',
              borderColor: colors.glassBorder,
              borderWidth: colors.borderWidth,
            }]}
          >
            <TouchableOpacity onPress={handleAttach} style={styles.pillAction}>
              <Plus size={22} color={colors.primary} strokeWidth={2} />
            </TouchableOpacity>

            <TextInput
              style={[styles.inputField, { color: colors.text }]}
              placeholder="Type a message..."
              placeholderTextColor={colors.gray}
              value={input}
              onChangeText={handleTyping}
              multiline
              maxLength={2000}
            />

            {input.trim() ? (
              <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.primary }]} onPress={() => sendMessage(input)}>
                <SendHorizontal size={18} color="white" strokeWidth={2.5} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={recording ? stopVoice : startVoice} style={styles.pillAction}>
                {recording ? <Square size={20} color="#FF3B30" fill="#FF3B30" /> : <Mic size={22} color={colors.primary} strokeWidth={1.5} />}
              </TouchableOpacity>
            )}
          </BlurView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  glowBall: { position: 'absolute', borderRadius: 100, overflow: 'hidden' },

  // Header
  headerBlur: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerSafe: { paddingTop: 10 },
  headerContent: { flexDirection: 'row', alignItems: 'center', height: 64, paddingHorizontal: 12, justifyContent: 'space-between' },
  navBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  partnerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 2 },
  avatarWrap: { position: 'relative', marginRight: 12 },
  headerAvatar: { width: 38, height: 38 },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  partnerTextWrap: { justifyContent: 'center' },
  headerName: { fontSize: 16, fontWeight: '700' },
  statusTxt: { fontSize: 12, fontWeight: '500' },
  offlineStatus: { opacity: 0.5 },
  headerActions: { flexDirection: 'row', gap: 2 },
  actionIcon: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  // Search bar
  searchBarRow: { paddingHorizontal: 12, paddingBottom: 10 },
  searchInputBar: { height: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, overflow: 'hidden' },
  searchField: { flex: 1, fontSize: 14 },

  // List
  listInside: { paddingTop: 80, paddingHorizontal: 4 },

  // Date separator (WhatsApp-style pill)
  dateSeparator: { alignItems: 'center', marginVertical: 12, marginHorizontal: 8 },
  datePill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 10 },
  dateText: { fontSize: 12, fontWeight: '600' },

  // Reply preview bar
  replyPreviewBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 8, borderRadius: 12, marginBottom: 4 },
  replyAccentBar: { width: 4, height: '100%', borderRadius: 2, position: 'absolute', left: 0, top: 0 },
  replyContent: { flex: 1, gap: 2 },
  replyName: { fontSize: 12, fontWeight: '600' },
  replyText: { fontSize: 13 },
  replyCancelBtn: { padding: 6 },

  // Input bar
  pillWrapper: { paddingHorizontal: 8, paddingTop: 8 },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  recordingText: { color: '#FF3B30', fontSize: 13, fontWeight: '600' },
  inputBar: { borderRadius: 24, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingVertical: 6, overflow: 'hidden' },
  pillAction: { width: 36, height: 40, justifyContent: 'center', alignItems: 'center' },
  inputField: { flex: 1, paddingHorizontal: 8, fontSize: 15, fontWeight: '400', maxHeight: 100, minHeight: 36, textAlignVertical: 'center' },
  sendBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', margin: 2 },

  // Empty chat
  emptyChat: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyAvatarWrap: { width: 100, height: 100, borderRadius: 50, overflow: 'hidden', borderWidth: 3, marginBottom: 20 },
  emptyAvatar: { width: '100%', height: '100%' },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },

  // Search empty
  searchEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12, opacity: 0.6 },
  searchEmptyText: { fontSize: 15, textAlign: 'center' },
});
