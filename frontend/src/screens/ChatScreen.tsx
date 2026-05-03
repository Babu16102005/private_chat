import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Image, Alert, Platform, KeyboardAvoidingView, Animated, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ChevronLeft, Phone, Video, Mic, Camera, SendHorizontal, Search, X, CircleStop, MoreVertical, Reply as ReplyIcon, SmilePlus } from 'lucide-react-native';
import { messageService, deleteMessageService, storageService, profileService, messageReactionsService, chatSettingsService, isProfileOnline } from '../services/supabaseService';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { MessageBubble, ReplyToMessage } from '../components/MessageBubble';
import { ImageViewer } from '../components/ImageViewer';
import { MediaViewer } from '../components/MediaViewer';
import { useTheme } from '../context/ThemeContext';
import { useCall } from '../context/CallContext';
import { defaultChatBackgroundSettings, getChatBackgroundPreset } from '../utils/chatBackground';
import { Sticker, stickers } from '../utils/stickers';

import { formatMessageTime, formatDateHeader, getDateKey } from '../utils/date';

type MessageDateGroup = { dateKey: string; messages: any[] };

const STICKER_USAGE_STORAGE_KEY = 'kiba:stickerUsageCounts';

const MESSAGE_PAGE_SIZE = 50;

type UploadableFile = {
  uri: string;
  name: string;
  type: string;
};

const buildUploadFile = (uri: string, fallbackName: string, mimeType: string): UploadableFile => {
  const normalizedUri = uri.split('?')[0];
  const fileNameFromUri = normalizedUri.split('/').pop();

  return {
    uri,
    name: fileNameFromUri || fallbackName,
    type: mimeType,
  };
};

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
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const isRecordingRef = useRef(false);
  const isRecordingTransitionRef = useRef(false);
  const [senderName, setSenderName] = useState('');
  const [backgroundSettings, setBackgroundSettings] = useState(defaultChatBackgroundSettings);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isStickerPickerOpen, setIsStickerPickerOpen] = useState(false);
  const [stickerUsageCounts, setStickerUsageCounts] = useState<Record<string, number>>({});

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
  const activeStatusChannelRef = useRef<any>(null);
  const footerRef = useRef<View>(null);
  const isLoadingOlderRef = useRef(false);
  const fetchedMessagesCountRef = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const chatLoadingPulse = useRef(new Animated.Value(0.5)).current;
  const chatLoadingOpacityStyle = { opacity: chatLoadingPulse } as any;

  const sortedStickers = useMemo(() => {
    return [...stickers].sort((a, b) => {
      const usageDelta = (stickerUsageCounts[b.id] || 0) - (stickerUsageCounts[a.id] || 0);
      if (usageDelta !== 0) return usageDelta;
      return stickers.indexOf(a) - stickers.indexOf(b);
    });
  }, [stickerUsageCounts]);
  const chatBackground = getChatBackgroundPreset(backgroundSettings.background_id);

  const fetchMessages = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await messageService.getMessages(pairId, MESSAGE_PAGE_SIZE, 0);
      const messageIds = (data || []).map(m => m.id);
      const deletedIds = await deleteMessageService.getDeletedIdsForUser(user.id, messageIds);
      const filtered = (data || []).filter(m => !deletedIds.has(m.id));
      const unreadIncomingIds = filtered
        .filter(m => m.sender_id !== user.id && !m.read_at)
        .map(m => m.id);

      if (unreadIncomingIds.length > 0) {
        messageService.markMessagesAsRead(unreadIncomingIds);
      }

      fetchedMessagesCountRef.current = (data || []).length;
      setHasMoreMessages((data || []).length === MESSAGE_PAGE_SIZE);
      const readAt = new Date().toISOString();
      setMessages([...filtered].map(m => unreadIncomingIds.includes(m.id) ? { ...m, read_at: readAt } : m).reverse());
    } catch (error) { console.error('Fetch msgs fail:', error); }
    finally { setLoading(false); }
  }, [pairId, user?.id]);

  const loadOlderMessages = useCallback(async () => {
    if (!user?.id || isLoadingOlderRef.current || !hasMoreMessages || loading) return;

    try {
      isLoadingOlderRef.current = true;
      setIsLoadingOlder(true);
      const data = await messageService.getMessages(pairId, MESSAGE_PAGE_SIZE, fetchedMessagesCountRef.current);
      const messageIds = (data || []).map(m => m.id);
      const deletedIds = await deleteMessageService.getDeletedIdsForUser(user.id, messageIds);
      const filtered = (data || []).filter(m => !deletedIds.has(m.id));
      fetchedMessagesCountRef.current += (data || []).length;
      setHasMoreMessages((data || []).length === MESSAGE_PAGE_SIZE);
      setMessages(prev => {
        const existingIds = new Set(prev.map(message => message.id));
        const olderMessages = [...filtered]
          .reverse()
          .filter(message => !existingIds.has(message.id));
        return [...olderMessages, ...prev];
      });
    } catch (error) {
      console.error('Load older msgs fail:', error);
    } finally {
      setIsLoadingOlder(false);
      isLoadingOlderRef.current = false;
    }
  }, [hasMoreMessages, loading, pairId, user?.id]);

  // Mounted ref for unmount guard
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Clear typing timeout to prevent state updates after unmount
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(STICKER_USAGE_STORAGE_KEY)
      .then((value) => {
        if (!active || !value) return;
        setStickerUsageCounts(JSON.parse(value));
      })
      .catch((error) => console.warn('Failed to load sticker usage:', error));

    return () => {
      active = false;
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
    if (!user?.id) return;
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
        if (newMessage.sender_id !== user.id) {
          messageService.markMessageAsRead(newMessage.id);
          newMessage = { ...newMessage, read_at: new Date().toISOString() };
        }
        setMessages(prev => [...prev, newMessage]);
      });
      msgChannelRef.current = msgChannel;

      if (partner?.id) {
        setIsOnline(isProfileOnline(partner));
        activeStatusChannelRef.current = profileService.subscribeToActiveStatus(partner.id, (active: boolean) => {
          if (isMountedRef.current) {
            setIsOnline(active);
          }
        });
      }

      typingChannelRef.current = messageService.subscribeToTyping(pairId, user.id, (typing: boolean) => {
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
      if (activeStatusChannelRef.current) {
        supabase.removeChannel(activeStatusChannelRef.current);
        activeStatusChannelRef.current = null;
      }
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
    };
  }, [pairId, user?.id, fetchMessages]);

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
    if (messages.length > 0 && !isLoadingOlderRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(chatLoadingPulse, { toValue: 1, duration: 720, useNativeDriver: true }),
        Animated.timing(chatLoadingPulse, { toValue: 0.5, duration: 720, useNativeDriver: true }),
      ])
    );

    if (loading) {
      loop.start();
    }

    return () => loop.stop();
  }, [chatLoadingPulse, loading]);

  useFocusEffect(
    useCallback(() => {
      fetchMessages();
    }, [fetchMessages])
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        const nextBackgroundSettings = await chatSettingsService.getChatBackground(pairId);
        if (active) setBackgroundSettings(nextBackgroundSettings);
      })();

      return () => {
        active = false;
      };
    }, [pairId])
  );


  const handleTyping = (text: string) => {
    setInput(text);
    if (isStickerPickerOpen) setIsStickerPickerOpen(false);
    if (!typingChannelRef.current || !isMountedRef.current) return;

    messageService.sendTypingIndicator(typingChannelRef.current, true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && typingChannelRef.current) {
        messageService.sendTypingIndicator(typingChannelRef.current, false);
      }
    }, 2000);
  };

  const sendMessage = useCallback(async (content: string, mediaUrl?: string, msgType?: any, options?: any) => {
    const trimmed = content?.trim();
    if (!trimmed && !mediaUrl) return;
    try {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingChannelRef.current) {
        messageService.sendTypingIndicator(typingChannelRef.current, false);
      }

      await messageService.sendMessage(pairId, trimmed, mediaUrl, msgType || 'text', replyingTo?.id, options);
      setReplyingTo(null);
      setInput('');
      setIsStickerPickerOpen(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      console.error('Send message fail:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  }, [pairId, replyingTo]);

  const sendSticker = useCallback(async (sticker: Sticker) => {
    try {
      await messageService.sendMessage(pairId, sticker.message, sticker.id, 'sticker', replyingTo?.id);
      setReplyingTo(null);
      setIsStickerPickerOpen(false);
      setStickerUsageCounts((current) => {
        const next = { ...current, [sticker.id]: (current[sticker.id] || 0) + 1 };
        AsyncStorage.setItem(STICKER_USAGE_STORAGE_KEY, JSON.stringify(next)).catch((error) => console.warn('Failed to save sticker usage:', error));
        return next;
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error: any) {
      if (error?.code === '23514') {
        Alert.alert('Sticker setup needed', 'Please apply the latest Supabase migration before sending stickers.');
        return;
      }
      console.error('Send sticker fail:', error);
      Alert.alert('Error', 'Failed to send sticker. Please try again.');
    }
  }, [pairId, replyingTo]);

  const normalizeMessageType = (messageType?: string, mediaUrl?: string, content?: string): 'text' | 'image' | 'video' | 'audio' | 'document' | 'system_call' | 'encrypted' | 'sticker' => {
    if (messageType === 'image' || messageType === 'video' || messageType === 'audio' || messageType === 'voice' || messageType === 'document' || messageType === 'system_call' || messageType === 'encrypted' || messageType === 'sticker') {
      return messageType === 'voice' ? 'audio' : messageType;
    }

    if (mediaUrl && content === 'Voice message') {
      return 'audio';
    }

    return 'text';
  };

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

  const getAvatarSource = (profile: any, fallback = 'User') => {
    if (profile?.avatar_url) return { uri: profile.avatar_url };

    const seed = profile?.name || profile?.email || fallback;
    return { uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}` };
  };

  const handleAttach = async () => {
    Alert.alert('Share', 'Choose what to send', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Photo or video', onPress: handleMediaAttach },
      { text: 'Document', onPress: handleDocumentAttach },
    ]);
  };

  const handleMediaAttach = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const mimeType = asset.type === 'video'
          ? (asset.mimeType || 'video/mp4')
          : (asset.mimeType || 'image/jpeg');
        const fallbackName = asset.type === 'video' ? 'video.mp4' : 'photo.jpg';
        const uploadFile = buildUploadFile(asset.uri, fallbackName, mimeType);

        setIsUploading(true);
        setUploadProgress(0.1);
        
        // Progress simulation
        const interval = setInterval(() => {
          setUploadProgress(prev => Math.min(prev + 0.1, 0.9));
        }, 500);

        const url = await storageService.uploadFile(uploadFile, 'chat-media');
        
        clearInterval(interval);
        setUploadProgress(1);
        await sendMessage('', url, asset.type === 'video' ? 'video' : 'image');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to attach media');
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  const handleDocumentAttach = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const uploadFile = buildUploadFile(asset.uri, asset.name || 'document', asset.mimeType || 'application/octet-stream');
      
      setIsUploading(true);
      setUploadProgress(0.1);

      // Progress simulation
      const interval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 0.1, 0.9));
      }, 500);

      const url = await storageService.uploadFile(uploadFile, 'chat-media');
      
      clearInterval(interval);
      setUploadProgress(1);
      await sendMessage(asset.name || 'Document', url, 'document', {
        fileName: asset.name,
        fileSize: asset.size,
        mimeType: asset.mimeType,
      });
    } catch (error) {
      console.error('Document attach failed:', error);
      Alert.alert('Error', 'Failed to attach document');
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  const startVoice = async () => {
    if (isRecordingRef.current || isRecordingTransitionRef.current) return;

    try {
      isRecordingTransitionRef.current = true;
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please grant microphone permission to send voice messages.');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      isRecordingRef.current = true;
      setRecordingStartedAt(Date.now());
      setIsRecording(true);
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } catch (err) {
      console.error('Failed to start recording:', err);
      isRecordingRef.current = false;
      setIsRecording(false);
      setRecordingStartedAt(null);
      Alert.alert('Error', 'Could not start recording. Microphone may be in use.');
    } finally {
      isRecordingTransitionRef.current = false;
    }
  };

  const stopVoice = async () => {
    if (!isRecordingRef.current || isRecordingTransitionRef.current) return;

    try {
      isRecordingTransitionRef.current = true;
      pulseAnim.stopAnimation();
      Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();

      await audioRecorder.stop();
      isRecordingRef.current = false;
      setIsRecording(false);
      const uri = audioRecorder.uri;

      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      if (uri) {
        const recorderStatus = audioRecorder.getStatus?.();
        const recordedDurationMs = recorderStatus?.durationMillis || (audioRecorder.currentTime ? audioRecorder.currentTime * 1000 : 0);
        const uploadFile = buildUploadFile(uri, 'voice.m4a', 'audio/mp4');
        console.log('Uploading voice message:', { uri, name: uploadFile.name, type: uploadFile.type });
        setIsUploading(true);
        setUploadProgress(0.1);

        // Progress simulation
        const interval = setInterval(() => {
          setUploadProgress(prev => Math.min(prev + 0.1, 0.9));
        }, 300);

        const url = await storageService.uploadFile(uploadFile, 'chat-media');
        
        clearInterval(interval);
        setUploadProgress(1);
        const fallbackDurationMs = recordingStartedAt ? Date.now() - recordingStartedAt : 0;
        const audioDurationMs = Math.max(1000, Math.round(recordedDurationMs || fallbackDurationMs));
        await sendMessage('Voice message', url, 'audio', { audioDurationMs });
      }
    } catch (error: any) {
      console.error('Voice upload failed:', error);
      isRecordingRef.current = false;
      setIsRecording(false);
      Alert.alert('Error', 'Failed to send voice message.');
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
      isRecordingTransitionRef.current = false;
      setRecordingStartedAt(null);
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

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    await deleteMessageService.deleteForMe(messageId);
    setMessages(prev => prev.filter(message => message.id !== messageId));
    setReplyingTo(prev => prev?.id === messageId ? null : prev);
  }, []);

  const handleMessagesScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (offsetY < 40) {
      loadOlderMessages();
    }
  }, [loadOlderMessages]);

  // Grouped list render
  const renderMessageGroup = ({ item: group }: { item: MessageDateGroup }) => {
    return (
      <>
        <View style={styles.dateSeparator}>
          <View style={[styles.datePill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', borderColor: colors.glassBorder, borderWidth: 0.5 }]}>
            <Text style={[styles.dateText, { color: colors.gray }]}>
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
              messageType: normalizeMessageType(msg.reply_message_type, undefined, msg.reply_content),
            };
          }

          return (
            <MessageBubble
              key={msg.id}
              content={msg.content}
              mediaUrl={msg.media_url}
              messageType={normalizeMessageType(msg.message_type, msg.media_url, msg.content)}
              fileName={msg.file_name}
              fileSize={msg.file_size}
              mimeType={msg.mime_type}
              audioDurationMs={msg.audio_duration_ms}
              isMe={msg.sender_id === user!.id}
              timestamp={msg.created_at}
              delivered_at={msg.delivered_at}
              read_at={msg.read_at}
              onDelete={() => handleDeleteMessage(msg.id)}
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
      messageType={normalizeMessageType(item.message_type, item.media_url, item.content)}
      fileName={item.file_name}
      fileSize={item.file_size}
      mimeType={item.mime_type}
      audioDurationMs={item.audio_duration_ms}
      isMe={item.sender_id === user!.id}
      timestamp={item.created_at}
      delivered_at={item.delivered_at}
      read_at={item.read_at}
      onDelete={() => handleDeleteMessage(item.id)}
      onReply={() => startReply(item)}
      onImageTap={(uri) => handleImageTap(uri)}
      onMediaTap={(u, t) => handleMediaTap(u, t)}
    />
  );

  const renderEmptyChat = () => (
    <View style={styles.emptyChat}>
      <View style={[styles.emptyAvatarWrap, { borderColor: colors.glassBorder }]}>
        <Image source={getAvatarSource(partner, 'Partner')} style={styles.emptyAvatar} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        Say hello to {partner?.name || 'your partner'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.gray }]}>
        Send your first message to start the conversation
      </Text>
    </View>
  );

  const renderOlderMessagesLoader = () => {
    if (!isLoadingOlder) return null;

    return (
      <View style={styles.olderLoader}>
        <View style={[styles.olderLoaderDot, { backgroundColor: colors.primary }]} />
      </View>
    );
  };

  const renderChatLoading = () => (
    <View style={[styles.chatLoadingWrap, { paddingTop: insets.top + 94 }]}> 
      {[0, 1, 2, 3, 4].map((item) => (
        <Animated.View key={item} style={[styles.chatLoadingBubble, item % 2 === 0 ? styles.chatLoadingLeft : styles.chatLoadingRight, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.42)' }, chatLoadingOpacityStyle]}>
          <View style={[styles.chatLoadingLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.55)' }]} />
          <View style={[styles.chatLoadingLineShort, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.38)' }]} />
        </Animated.View>
      ))}
    </View>
  );

  const openChatSettings = () => {
    navigation.navigate('ChatSettings', { pairId, partner });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Subtle background gradient */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient 
          colors={themeMode === 'mocha' ? (colors.gradientPrimary as any) : (chatBackground.gradient as any)} 
          start={{ x: 0.1, y: 0 }} 
          end={{ x: 0.96, y: 1 }} 
          style={StyleSheet.absoluteFill} 
        />
        <LinearGradient 
          colors={themeMode === 'mocha' 
            ? ['rgba(118, 159, 205, 0.12)', 'rgba(185, 215, 234, 0.08)', 'transparent'] as any 
            : [chatBackground.glows[0], chatBackground.glows[1], 'transparent'] as any} 
          start={{ x: 1, y: 0 }} 
          end={{ x: 0.12, y: 0.72 }} 
          style={StyleSheet.absoluteFill} 
        />
        <LinearGradient 
          colors={themeMode === 'mocha' 
            ? ['transparent', 'rgba(118, 159, 205, 0.1)', isDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.4)'] as any 
            : ['transparent', chatBackground.glows[2], 'rgba(0,0,0,0.22)'] as any} 
          start={{ x: 0, y: 0.24 }} 
          end={{ x: 1, y: 1 }} 
          style={StyleSheet.absoluteFill} 
        />
        {backgroundSettings.background_image_url && (
          <Image
            source={{ uri: backgroundSettings.background_image_url }}
            style={[StyleSheet.absoluteFill, { opacity: backgroundSettings.background_opacity }]}
            resizeMode="cover"
          />
        )}
        {backgroundSettings.background_image_url && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.28)' }]} />
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
          intensity={colors.glassBlur}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.headerBlur, { borderBottomColor: colors.glassBorder, borderBottomWidth: colors.borderWidth }]}
        >
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBtn}>
                <ChevronLeft size={28} color={colors.text} strokeWidth={2.5} />
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.7} onPress={() => Alert.alert('Profile', partner?.name || 'Partner')} style={styles.partnerInfo}>
                <View style={styles.avatarWrap}>
                  <Image source={getAvatarSource(partner, 'Partner')} style={[styles.headerAvatar, { borderRadius: colors.radius.story }]} />
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
                <TouchableOpacity onPress={() => initiateCall(pairId, partner, false)} style={[styles.actionIcon, { borderColor: colors.glassBorder }]}><Phone size={22} color={colors.text} /></TouchableOpacity>
                <TouchableOpacity onPress={() => initiateCall(pairId, partner, true)} style={[styles.actionIcon, { borderColor: colors.glassBorder }]}><Video size={22} color={colors.text} /></TouchableOpacity>
                <TouchableOpacity onPress={() => setIsSearching(!isSearching)} style={[styles.actionIcon, { borderColor: colors.glassBorder }]}>
                  {isSearching ? <X size={22} color={colors.text} /> : <Search size={22} color={colors.text} />}
                </TouchableOpacity>
                <TouchableOpacity onPress={openChatSettings} style={[styles.actionIcon, { borderColor: colors.glassBorder }]}><MoreVertical size={20} color={colors.text} /></TouchableOpacity>
              </View>
            </View>
            {isSearching && (
              <View style={styles.searchBarRow}>
                <BlurView
                  intensity={colors.glassBlur}
                  tint={isDark ? 'dark' : 'light'}
                  style={[styles.searchInputBar, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: colors.glassBorder, borderRadius: 18, borderWidth: colors.borderWidth }]}
                >
                  <Search size={18} color={colors.gray} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.searchField, { color: colors.text }]}
                    placeholder="Search in chat..."
                    placeholderTextColor={colors.gray}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                    underlineColorAndroid="transparent"
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
        {loading ? (
          renderChatLoading()
        ) : messages.length > 0 && !isSearching ? (
          <FlatList<any>
            ref={flatListRef}
            data={groupedMessages}
            renderItem={renderMessageGroup}
            keyExtractor={(item) => item.dateKey + (item.messages[0]?.id || '')}
            contentContainerStyle={[
              styles.listInside, 
              { paddingTop: insets.top + 64 + (isSearching ? 52 : 0) + 10 },
              isSearching && { paddingBottom: 0 }
            ]}
            showsVerticalScrollIndicator={false}
            onScroll={handleMessagesScroll}
            scrollEventThrottle={16}
            ListHeaderComponent={renderOlderMessagesLoader}
            ListFooterComponent={<View ref={footerRef as any} style={{ height: 8 }} />}
          />
        ) : isSearching && searchQuery.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={filteredMessages}
            renderItem={renderSearchResultItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listInside,
              { paddingTop: insets.top + 64 + (isSearching ? 52 : 0) + 10 }
            ]}
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
            contentContainerStyle={[
              styles.listInside,
              { paddingTop: insets.top + 64 + (isSearching ? 52 : 0) + 10 }
            ]}
            showsVerticalScrollIndicator={false}
            onScroll={handleMessagesScroll}
            scrollEventThrottle={16}
            ListHeaderComponent={renderOlderMessagesLoader}
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
                {replyingTo.messageType === 'image' ? '📷 Photo' : normalizeMessageType(replyingTo.messageType, replyingTo.mediaUrl, replyingTo.content) === 'audio' ? '🎤 Voice message' : replyingTo.content}
              </Text>
            </View>
            <TouchableOpacity onPress={cancelReply} style={styles.replyCancelBtn}>
              <X size={18} color={colors.gray} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Bar */}
        <View style={[styles.pillWrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {isRecording && (
            <Animated.View style={[styles.recordingIndicator, { transform: [{ scale: pulseAnim }] }]}> 
              <View style={[styles.recordingDot, { backgroundColor: '#FF3B30' }]} />
              <Text style={styles.recordingText}>Recording... Tap mic to stop</Text>
            </Animated.View>
          )}

          {isStickerPickerOpen && (
            <BlurView intensity={colors.glassBlur + 12} tint={isDark ? 'dark' : 'light'} style={[styles.stickerPicker, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
              <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)'] as any} style={StyleSheet.absoluteFill} />
              <Text style={[styles.stickerPickerTitle, { color: colors.text }]}>Animated stickers</Text>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stickerGrid}>
                {sortedStickers.map((sticker) => (
                  <TouchableOpacity key={sticker.id} activeOpacity={0.78} onPress={() => sendSticker(sticker)} style={[styles.stickerChip, { borderColor: colors.glassBorder }]}> 
                    <Text style={styles.stickerChipEmoji}>{sticker.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </BlurView>
          )}

          <BlurView
            intensity={colors.glassBlur + 10}
            tint={isDark ? 'dark' : 'light'}
            style={[styles.inputBar, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.4)',
              borderColor: colors.glassBorder,
              borderWidth: colors.borderWidth,
            }]}
          >
            <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.04)'] as any} style={StyleSheet.absoluteFill} />
            <TouchableOpacity onPress={handleAttach} style={[styles.pillAction, styles.inputIconButton, { borderColor: colors.glassBorder }]}> 
              <Camera size={21} color={colors.primary} strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsStickerPickerOpen((open) => !open)} style={[styles.pillAction, styles.inputIconButton, { borderColor: isStickerPickerOpen ? colors.primary : colors.glassBorder }]}> 
              <SmilePlus size={20} color={isStickerPickerOpen ? colors.tertiary : colors.primary} strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.inputTextWrap}>
              <TextInput
                style={[styles.inputField, { color: colors.text }]}
                placeholder="Message"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.48)' : 'rgba(17, 45, 78, 0.4)'}
                value={input}
                onChangeText={handleTyping}
                multiline
                maxLength={2000}
                underlineColorAndroid="transparent"
              />
            </View>

            {input.trim() ? (
              <TouchableOpacity style={[styles.sendBtn, { borderColor: colors.glassBorder }]} onPress={() => sendMessage(input)}>
                <LinearGradient colors={colors.gradientSecondary as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendBtnGradient}>
                  <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }} style={styles.sendBtnShine} />
                  <SendHorizontal size={18} color="white" strokeWidth={2.5} />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={isRecording ? stopVoice : startVoice} style={[styles.pillAction, styles.inputIconButton, { borderColor: colors.glassBorder }]}>
                {isRecording ? <CircleStop size={21} color="#FF3B30" fill="rgba(255,59,48,0.16)" /> : <Mic size={22} color={colors.primary} strokeWidth={1.5} />}
              </TouchableOpacity>
            )}
          </BlurView>
        </View>
      </KeyboardAvoidingView>

      {/* Upload Progress Overlay */}
      {isUploading && (
        <View style={styles.uploadOverlay}>
          <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.uploadCard}>
            <Text style={[styles.uploadTitle, { color: colors.text }]}>Transferring File...</Text>
            <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              <Animated.View 
                style={[
                  styles.progressFill, 
                  { 
                    backgroundColor: colors.primary,
                    width: `${Math.round(uploadProgress * 100)}%` 
                  }
                ]} 
              />
            </View>
            <Text style={[styles.progressText, { color: colors.gray }]}>
              {Math.round(uploadProgress * 100)}%
            </Text>
          </BlurView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Header
  headerBlur: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerSafe: { paddingTop: 10 },
  headerContent: { flexDirection: 'row', alignItems: 'center', height: 64, paddingHorizontal: 12, justifyContent: 'space-between' },
  navBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  partnerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 2 },
  avatarWrap: { position: 'relative', marginRight: 12 },
  headerAvatar: { width: 38, height: 38, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.32)' },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  partnerTextWrap: { justifyContent: 'center' },
  headerName: { fontSize: 16, fontWeight: '700' },
  statusTxt: { fontSize: 12, fontWeight: '500' },
  offlineStatus: { opacity: 0.5 },
  headerActions: { flexDirection: 'row', gap: 2 },
  actionIcon: { width: 40, height: 40, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(128,128,128,0.08)', borderWidth: 0.5 },

  // Search bar
  searchBarRow: { paddingHorizontal: 12, paddingBottom: 10 },
  searchInputBar: { height: 42, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, overflow: 'hidden' },
  searchField: { flex: 1, fontSize: 14 },

  // List
  listInside: { paddingHorizontal: 4 },
  olderLoader: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  olderLoaderDot: { width: 8, height: 8, borderRadius: 4 },
  chatLoadingWrap: { flex: 1, paddingHorizontal: 14, justifyContent: 'center' },
  chatLoadingBubble: { width: '72%', borderRadius: 24, padding: 16, marginBottom: 14 },
  chatLoadingLeft: { alignSelf: 'flex-start', borderBottomLeftRadius: 8 },
  chatLoadingRight: { alignSelf: 'flex-end', borderBottomRightRadius: 8 },
  chatLoadingLine: { width: '82%', height: 12, borderRadius: 6, marginBottom: 10 },
  chatLoadingLineShort: { width: '46%', height: 10, borderRadius: 5 },

  // Date separator (WhatsApp-style pill)
  dateSeparator: { alignItems: 'center', marginVertical: 12, marginHorizontal: 8 },
  datePill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)' },
  dateText: { fontSize: 12, fontWeight: '600' },

  // Reply preview bar
  replyPreviewBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 8, borderRadius: 18, marginBottom: 4 },
  replyAccentBar: { width: 4, height: '100%', borderRadius: 2, position: 'absolute', left: 0, top: 0 },
  replyContent: { flex: 1, gap: 2 },
  replyName: { fontSize: 12, fontWeight: '600' },
  replyText: { fontSize: 13 },
  replyCancelBtn: { padding: 6 },

  // Input bar
  pillWrapper: { paddingHorizontal: 12, paddingTop: 10 },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  recordingText: { color: '#FF3B30', fontSize: 13, fontWeight: '600' },
  inputBar: { minHeight: 54, borderRadius: 28, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingVertical: 7, overflow: 'hidden' },
  inputShine: { position: 'absolute', top: 1, left: 18, right: 18, height: 1, backgroundColor: 'rgba(255,255,255,0.42)' },
  pillAction: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  inputIconButton: { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 0.5 },
  inputTextWrap: { flex: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 },
  inputField: { flex: 1, paddingHorizontal: 8, paddingTop: 9, paddingBottom: 8, fontSize: 15, fontWeight: '500', maxHeight: 104, minHeight: 40, textAlignVertical: 'center', letterSpacing: 0.1 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, marginLeft: 2, borderWidth: 0.5, backgroundColor: 'rgba(255,255,255,0.1)' },
  sendBtnGradient: { flex: 1, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sendBtnShine: { position: 'absolute', top: 1, left: 5, right: 5, height: 13, borderRadius: 999, opacity: 0.34 },
  stickerPicker: { height: 214, borderRadius: 24, paddingVertical: 12, marginBottom: 8, overflow: 'hidden' },
  stickerPickerTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 16, marginBottom: 8 },
  stickerGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 10, rowGap: 10, columnGap: 8 },
  stickerChip: { width: '23%', height: 78, borderRadius: 20, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  stickerChipEmoji: { fontSize: 40, lineHeight: 48 },

  // Empty chat
  emptyChat: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyAvatarWrap: { width: 100, height: 100, borderRadius: 50, overflow: 'hidden', borderWidth: 3, marginBottom: 20 },
  emptyAvatar: { width: '100%', height: '100%' },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },

  // Search empty
  searchEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12, opacity: 0.6 },
  searchEmptyText: { fontSize: 15, textAlign: 'center' },

  // Upload Progress
  uploadOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 100, justifyContent: 'center', alignItems: 'center' },
  uploadCard: { width: 280, borderRadius: 24, padding: 24, alignItems: 'center', overflow: 'hidden' },
  uploadTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  progressTrack: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 14, fontWeight: '600' },
});
