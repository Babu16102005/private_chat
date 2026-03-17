import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

interface MessageBubbleProps {
  content: string;
  isMe: boolean;
  timestamp: string;
  delivered_at?: string | null;
  read_at?: string | null;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ content, isMe, timestamp, delivered_at, read_at }) => {
  const renderTicks = () => {
    if (!isMe) return null;

    if (read_at) {
      return <Text style={[styles.ticks, { color: theme.colors.tertiary }]}>✓✓</Text>;
    }
    if (delivered_at) {
      return <Text style={styles.ticks}>✓✓</Text>;
    }
    return <Text style={styles.ticks}>✓</Text>;
  };

  return (
    <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
      <Text style={[styles.text, isMe ? styles.myText : styles.theirText]}>{content}</Text>
      <View style={styles.timeContainer}>
        <Text style={[styles.time, isMe ? styles.myTime : styles.theirTime]}>
          {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {renderTicks()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    maxWidth: '80%',
    marginBottom: 8,
  },
  myBubble: {
    backgroundColor: theme.colors.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 5,
  },
  theirBubble: {
    backgroundColor: theme.colors.white,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 5,
  },
  text: {
    fontSize: 16,
    color: theme.colors.text,
  },
  myText: {
    color: theme.colors.white,
  },
  theirText: {
    color: theme.colors.text,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  time: {
    fontSize: 11,
    marginRight: 5,
  },
  myTime: {
    color: theme.colors.lightGray,
  },
  theirTime: {
    color: theme.colors.gray,
  },
  ticks: {
    fontSize: 12,
    color: theme.colors.lightGray,
  }
});
