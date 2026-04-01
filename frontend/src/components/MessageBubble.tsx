import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { Check, CheckCheck, PlayCircle } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

interface MessageBubbleProps {
  content?: string;
  isMe: boolean;
  timestamp: string;
  delivered_at?: string | null;
  read_at?: string | null;
  onDelete?: () => void;
  mediaUrl?: string;
  messageType?: 'text' | 'image' | 'video' | 'audio';
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ content, isMe, timestamp, delivered_at, read_at, onDelete, mediaUrl, messageType }) => {
  const { colors, isDark, themeMode } = useTheme();

  const renderTicks = () => {
    if (!isMe) return null;
    const size = 14;
    const color = read_at ? '#00FF00' : 'rgba(255,255,255,0.7)'; // Brighter ticks for Obsidian
    return (read_at || delivered_at) 
      ? <CheckCheck size={size} color={color} strokeWidth={3} /> 
      : <Check size={size} color={color} strokeWidth={3} />;
  };

  const formatTime = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <TouchableOpacity 
      onLongPress={() => isMe && onDelete && Alert.alert('Delete', 'Delete this message?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', onPress: onDelete, style: 'destructive' }])} 
      activeOpacity={0.9} 
      style={[styles.container, { alignSelf: isMe ? 'flex-end' : 'flex-start' }]}
    >
      <BlurView 
        intensity={themeMode === 'obsidian' ? 0 : colors.glassBlur} 
        tint={isDark ? 'dark' : 'light'} 
        style={[
          styles.glassWrap, 
          { 
            backgroundColor: isMe ? colors.bubbleSentBg : colors.bubbleReceivedBg,
            borderColor: colors.glassBorder, 
            borderWidth: colors.borderWidth,
            borderRadius: colors.radius.bubble,
            borderBottomRightRadius: isMe ? 4 : colors.radius.bubble,
            borderBottomLeftRadius: !isMe ? 4 : colors.radius.bubble
          }
        ]}
      >
        <View style={styles.bubble}>
          {messageType === 'image' && mediaUrl ? (
            <Image source={{ uri: mediaUrl }} style={styles.mediaImage} borderRadius={8} />
          ) : messageType === 'audio' && mediaUrl ? (
            <View style={styles.audioWrap}>
               <PlayCircle size={24} color={colors.text} />
               <Text style={{color: colors.text, marginLeft: 8}}>Voice Message</Text>
            </View>
          ) : null}
          {!!content && <Text style={[styles.text, { color: colors.text, marginTop: mediaUrl ? 8 : 0 }]}>{content}</Text>}
          <View style={styles.metaRow}>
            <Text style={[styles.time, { color: 'rgba(255,255,255,0.6)' }]}>{formatTime(timestamp)}</Text>
            <View style={styles.tickSpace}>{renderTicks()}</View>
          </View>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { maxWidth: '82%', marginBottom: 10 },
  glassWrap: { overflow: 'hidden' },
  bubble: { paddingVertical: 12, paddingHorizontal: 16 },
  text: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  time: { fontSize: 10, fontWeight: '700' },
  tickSpace: { marginLeft: 4 },
  mediaImage: { width: 220, height: 160, backgroundColor: 'rgba(255,255,255,0.1)' },
  audioWrap: { flexDirection: 'row', alignItems: 'center', padding: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingRight: 12 }
});
