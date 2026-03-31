import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Check, CheckCheck } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

interface MessageBubbleProps {
  content: string;
  isMe: boolean;
  timestamp: string;
  delivered_at?: string | null;
  read_at?: string | null;
  onDelete?: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ content, isMe, timestamp, delivered_at, read_at, onDelete }) => {
  const { colors, isDark } = useTheme();

  const renderTicks = () => {
    if (!isMe) return null;
    const size = 14;
    const color = read_at ? colors.tertiary : colors.gray;
    return (read_at || delivered_at) 
      ? <CheckCheck size={size} color={color} strokeWidth={3} /> 
      : <Check size={size} color={color} strokeWidth={3} />;
  };

  const formatTime = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const Content = (
    <View style={[
      styles.bubble, 
      isMe 
        ? [styles.myBubble, { backgroundColor: colors.black }] // Solid Obsidian for outgoing
        : [styles.theirBubble, { backgroundColor: 'transparent' }], // Glass for incoming
      { borderRadius: colors.radius.bubble, borderBottomRightRadius: isMe ? 4 : colors.radius.bubble, borderBottomLeftRadius: !isMe ? 4 : colors.radius.bubble }
    ]}>
      <Text style={[styles.text, { color: '#FFF' }]}>{content}</Text>
      <View style={styles.metaRow}>
        <Text style={[styles.time, { color: 'rgba(255,255,255,0.6)' }]}>{formatTime(timestamp)}</Text>
        <View style={styles.tickSpace}>{renderTicks()}</View>
      </View>
    </View>
  );

  return (
    <TouchableOpacity 
      onLongPress={() => isMe && onDelete && Alert.alert('Delete', 'Delete this message?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', onPress: onDelete, style: 'destructive' }])} 
      activeOpacity={0.9} 
      style={[styles.container, { alignSelf: isMe ? 'flex-end' : 'flex-start' }]}
    >
      {!isMe ? (
        <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.glassWrap, { borderRadius: colors.radius.bubble, borderBottomLeftRadius: 4, borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}>
          {Content}
        </BlurView>
      ) : Content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { maxWidth: '82%', marginBottom: 10 },
  glassWrap: { overflow: 'hidden' },
  bubble: { paddingVertical: 12, paddingHorizontal: 16 },
  myBubble: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  theirBubble: {},
  text: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  time: { fontSize: 10, fontWeight: '700' },
  tickSpace: { marginLeft: 4 }
});
