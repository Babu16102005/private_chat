import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Image, Alert, Platform, KeyboardAvoidingView, Dimensions, Animated, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ChevronLeft, Phone, Video, Mic, Plus, SendHorizontal, MoreVertical, Search } from 'lucide-react-native';
import { messageService, deleteMessageService } from '../services/supabaseService';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { MessageBubble } from '../components/MessageBubble';
import { useTheme } from '../context/ThemeContext';
import { useCall } from '../context/CallContext';

const { width, height } = Dimensions.get('window');

export const ChatScreen = ({ route, navigation }: any) => {
  const { pairId, partner } = route.params;
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { initiateCall } = useCall();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<any>(null);
  const typingChannelRef = useRef<any>(null);

  useEffect(() => {
    fetchMessages();
    
    // Subscriptions
    const msgChannel = messageService.subscribeToMessages(pairId, (newMessage: any) => {
      setMessages(prev => [...prev, newMessage]);
    });

    const presenceChannel = messageService.subscribeToPresence(pairId, user!.id, (online: boolean) => {
      setIsOnline(online);
    });

    typingChannelRef.current = messageService.subscribeToTyping(pairId, user!.id, (typing: boolean) => {
      setIsPartnerTyping(typing);
    });

    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => { 
      supabase.removeChannel(msgChannel); 
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(typingChannelRef.current);
      keyboardDidShowListener.remove();
    };
  }, [pairId]);

  const fetchMessages = async () => {
    try {
      const data = await messageService.getMessages(pairId);
      setMessages((data || []).reverse());
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
    } catch (error) { console.error('Fetch msgs fail:', error); }
    finally { setLoading(false); }
  };

  const handleTyping = (text: string) => {
    setInput(text);
    if (!typingChannelRef.current) return;
    
    messageService.sendTypingIndicator(typingChannelRef.current, true);
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      messageService.sendTypingIndicator(typingChannelRef.current, false);
    }, 2000);
  };

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;
    try {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      messageService.sendTypingIndicator(typingChannelRef.current, false);
      
      await messageService.sendMessage(pairId, content);
      setInput('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) { console.error('Send message fail:', error); }
  };

  const renderBackgroundGlows = () => (
    <View style={styles.glowOverlay}>
      <LinearGradient colors={['rgba(210, 118, 25, 0.15)', 'transparent'] as any} style={[styles.glowBall, { top: height * 0.1, left: -50, width: 300, height: 300 }]} />
      <LinearGradient colors={['rgba(210, 118, 25, 0.1)', 'transparent'] as any} style={[styles.glowBall, { bottom: 100, right: -50, width: 350, height: 350 }]} />
    </View>
  );

  const getStatusText = () => {
    if (isPartnerTyping) return 'typing...';
    return isOnline ? 'Online' : 'Offline';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderBackgroundGlows()}

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.headerGlass, { borderBottomColor: colors.glassBorder, borderBottomWidth: colors.borderWidth }]}>
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBtn}>
                <ChevronLeft size={28} color={colors.text} strokeWidth={2.5} />
              </TouchableOpacity>
              
              <TouchableOpacity activeOpacity={0.7} onPress={() => Alert.alert('Profile', partner?.name)} style={styles.partnerInfo}>
                <View style={styles.avatarWrap}>
                  <Image source={{ uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner?.name || 'Partner'}` }} style={styles.headerAvatar} />
                  {isOnline && <View style={[styles.onlineDot, { backgroundColor: colors.tertiary, borderColor: colors.black }]} />}
                </View>
                <View>
                  <Text style={[styles.headerName, { color: colors.text }]}>{partner?.name || 'Partner'}</Text>
                  <Text style={[styles.statusTxt, { color: isPartnerTyping ? colors.tertiary : colors.gray, opacity: isOnline || isPartnerTyping ? 1 : 0.6 }]}>
                    {getStatusText()}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.headerActions}>
                <TouchableOpacity onPress={() => initiateCall(pairId, partner, false)} style={styles.actionIcon}><Phone size={22} color={colors.text} /></TouchableOpacity>
                <TouchableOpacity onPress={() => initiateCall(pairId, partner, true)} style={styles.actionIcon}><Video size={22} color={colors.text} /></TouchableOpacity>
                <TouchableOpacity onPress={() => Alert.alert('Search', 'Find in chat...')} style={styles.actionIcon}><Search size={22} color={colors.text} /></TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </BlurView>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={({ item }) => (
            <View style={styles.bubbleRow}>
              <MessageBubble 
                content={item.content} 
                isMe={item.sender_id === user!.id} 
                timestamp={item.created_at}
                delivered_at={item.delivered_at}
                read_at={item.read_at}
                onDelete={() => deleteMessageService.deleteForMe(item.id)}
              />
            </View>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listInside}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => messages.length > 0 && flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={[styles.pillWrapper, { paddingBottom: Math.max(insets.bottom, 15) }]}>
          <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.inputPill, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}>
            <TouchableOpacity onPress={() => Alert.alert('Attach', 'Pick a file...')} style={styles.pillAction}><Plus size={24} color={colors.gray} /></TouchableOpacity>
            <TextInput
              style={[styles.inputField, { color: colors.text }]}
              placeholder="Type a message..."
              placeholderTextColor={colors.gray}
              value={input}
              onChangeText={handleTyping}
              multiline
            />
            {input.trim() ? (
              <TouchableOpacity style={styles.sendBtn} onPress={() => sendMessage(input)}>
                <LinearGradient colors={colors.gradientSecondary as any} style={styles.sendGrad}>
                  <SendHorizontal size={20} color="white" strokeWidth={2.5} />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => Alert.alert('Voice', 'Record audio...')} style={styles.pillAction}><Mic size={24} color={colors.gray} /></TouchableOpacity>
            )}
          </BlurView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  glowOverlay: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  glowBall: { position: 'absolute', borderRadius: 200 },
  headerGlass: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerSafe: { paddingTop: 10 },
  headerContent: { flexDirection: 'row', alignItems: 'center', height: 74, paddingHorizontal: 20, justifyContent: 'space-between' },
  navBtn: { width: 44, height: 44, justifyContent: 'center' },
  partnerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 5 },
  avatarWrap: { position: 'relative', marginRight: 15 },
  headerAvatar: { width: 42, height: 42, borderRadius: 12 },
  onlineDot: { position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  headerName: { fontSize: 16, fontWeight: '800' },
  statusTxt: { fontSize: 11, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 5 },
  actionIcon: { width: 40, height: 44, justifyContent: 'center', alignItems: 'center' },
  listInside: { paddingHorizontal: 20, paddingTop: 130, paddingBottom: 20 },
  bubbleRow: { marginBottom: 12 },
  pillWrapper: { paddingHorizontal: 20, paddingTop: 10 },
  inputPill: { height: 60, borderRadius: 30, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  pillAction: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  inputField: { flex: 1, paddingHorizontal: 12, fontSize: 15, fontWeight: '600', maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  sendGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
