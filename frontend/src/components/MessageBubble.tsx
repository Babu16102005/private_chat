import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface MessageBubbleProps {
  content: string;
  isMe: boolean;
  timestamp: string;
  delivered_at?: string | null;
  read_at?: string | null;
  onDelete?: () => void;
  onReact?: (emoji: string) => void;
  reactions?: { emoji: string; count: number; users: string[] }[];
  showFullTimestamp?: boolean;
}

const EMOJI_REACTIONS = ['❤️', '😂', '😢', '👍', '😮'];

export const MessageBubble: React.FC<MessageBubbleProps> = ({ content, isMe, timestamp, delivered_at, read_at, onDelete, onReact, reactions = [], showFullTimestamp = false }) => {
  const { colors } = useTheme();

  const renderTicks = () => {
    if (!isMe) return null;
    if (read_at) return <Text style={[styles.ticks, { color: colors.tertiary }]}>✓✓</Text>;
    if (delivered_at) return <Text style={styles.ticks}>✓✓</Text>;
    return <Text style={styles.ticks}>✓</Text>;
  };

  const formatFullTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleLongPress = () => {
    if (!isMe && !onDelete) return;
    const options = [
      ...EMOJI_REACTIONS.map(emoji => ({ text: emoji, onPress: () => onReact?.(emoji) })),
      ...(isMe && onDelete ? [{ text: 'Delete for me', style: 'destructive' as const, onPress: () => onDelete() }] : []),
      { text: 'Cancel', style: 'cancel' as const }
    ];
    Alert.alert('Message Options', '', options);
  };

  const bubbleStyle = isMe 
    ? [styles.bubble, styles.myBubble, { backgroundColor: colors.primary }]
    : [styles.bubble, styles.theirBubble, { backgroundColor: colors.white }];

  const textStyle = isMe ? [styles.text, styles.myText] : [styles.text, styles.theirText, { color: colors.text }];
  const timeStyle = isMe ? [styles.time, styles.myTime] : [styles.time, styles.theirTime, { color: colors.gray }];

  return (
    <TouchableOpacity onLongPress={handleLongPress} activeOpacity={0.8}>
      <View style={bubbleStyle}>
        <Text style={textStyle}>{content}</Text>
        <View style={styles.timeContainer}>
          <Text style={timeStyle}>
            {showFullTimestamp ? formatFullTimestamp(timestamp) : new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {renderTicks()}
        </View>
        {reactions.length > 0 && (
          <View style={styles.reactionsContainer}>
            {reactions.map((r, i) => (
              <View key={i} style={[styles.reactionBadge, { backgroundColor: colors.lightGray }]}>
                <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                <Text style={[styles.reactionCount, { color: colors.gray }]}>{r.count}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  bubble: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, maxWidth: '80%', marginBottom: 8 },
  myBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 5 },
  theirBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 5 },
  text: { fontSize: 16 },
  myText: { color: '#FFFFFF' },
  theirText: { color: '#333333' },
  timeContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8, alignSelf: 'flex-end' },
  time: { fontSize: 11, marginRight: 5 },
  myTime: { color: '#F0F0F0' },
  theirTime: { color: '#888888' },
  ticks: { fontSize: 12, color: '#F0F0F0' },
  reactionsContainer: { flexDirection: 'row', marginTop: 5, gap: 5 },
  reactionBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  reactionEmoji: { fontSize: 14, marginRight: 3 },
  reactionCount: { fontSize: 12 }
});
