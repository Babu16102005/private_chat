import React, { memo } from 'react';
import { View, Text, TouchableOpacity, Image, Alert, StyleSheet, Platform, Linking } from 'react-native';
import { Check, CheckCheck, PlayCircle, X, Reply } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { formatMessageTime } from '../utils/date';

export interface ReplyToMessage {
  id: string;
  content?: string;
  senderName: string;
  messageType?: string;
  mediaUrl?: string;
}

interface MessageBubbleProps {
  content?: string;
  isMe: boolean;
  timestamp: string;
  delivered_at?: string | null;
  read_at?: string | null;
  onDelete?: () => void;
  onReply?: () => void;
  mediaUrl?: string;
  messageType?: 'text' | 'image' | 'video' | 'audio';
  replyToMessage?: ReplyToMessage | null;
  onImageTap?: (uri: string) => void;
}

// URL detection regex
const URL_REGEX = /\b(https?:\/\/[^\s]+)/g;

interface TextPart {
  type: 'text' | 'url';
  text: string;
}

function parseTextWithLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let lastIndex = 0;
  const matches = text.match(URL_REGEX);

  if (!matches) return [{ type: 'text' as const, text }];

  matches.forEach((match) => {
    const index = text.indexOf(match, lastIndex);
    if (index > lastIndex) {
      parts.push({ type: 'text' as const, text: text.slice(lastIndex, index) });
    }
    parts.push({ type: 'url' as const, text: match });
    lastIndex = index + match.length;
  });

  if (lastIndex < text.length) {
    parts.push({ type: 'text' as const, text: text.slice(lastIndex) });
  }

  return parts;
}

export const MessageBubble: React.FC<MessageBubbleProps> = memo(
  function MessageBubble({
    content, isMe, timestamp, delivered_at, read_at,
    onDelete, onReply, mediaUrl, messageType,
    replyToMessage, onImageTap,
  }) {
    const { colors } = useTheme();

    const isEmojiOnly = content
      ? /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]{1,8}$/u.test(content.trim())
      : false;

    const renderTicks = () => {
      if (!isMe) return null;

      const isDelivered = !!delivered_at;
      const isRead = !!read_at;
      const tickColor = isRead ? colors.primary : 'rgba(255,255,255,0.4)';

      return (
        <View style={styles.tickContainer}>
          <View style={styles.tickIconWrap}>
            {isRead ? (
              <CheckCheck size={14} color={tickColor} strokeWidth={2.5} />
            ) : isDelivered ? (
              <CheckCheck size={14} color={tickColor} strokeWidth={2.5} />
            ) : (
              <Check size={14} color={tickColor} strokeWidth={2.5} />
            )}
          </View>
          <Text style={[styles.statusText, { color: tickColor }]}>
            {isRead ? 'Read' : isDelivered ? 'Delivered' : 'Sent'}
          </Text>
        </View>
      );
    };

    const handleLongPress = () => {
      if (!onDelete && !onReply) return;
      const buttons: any[] = [
        { text: 'Cancel', style: 'cancel' },
      ];
      if (onReply) {
        buttons.push({ text: 'Reply', style: 'default', onPress: onReply });
      }
      if (onDelete) {
        buttons.push({ text: 'Delete for me', style: 'destructive', onPress: onDelete });
      }

      Alert.alert(
        'Message',
        'What would you like to do?',
        buttons,
      );
    };

    const handleImageTap = () => {
      if (mediaUrl && onImageTap) {
        onImageTap(mediaUrl);
      }
    };

    const renderQuotedMessage = () => {
      if (!replyToMessage) return null;
      return (
        <View style={[styles.quoteContainer, { borderLeftColor: isMe ? colors.primary : colors.tertiary }]}>
          <View style={styles.quoteTopRow}>
            <Reply size={10} color={isMe ? colors.primary : colors.tertiary} />
            <Text style={[styles.quoteName, { color: isMe ? colors.primary : colors.tertiary }]} numberOfLines={1}>
              {replyToMessage.senderName}
            </Text>
          </View>
          {replyToMessage.messageType === 'image' ? (
            <Text style={[styles.quoteText, { color: colors.gray }]} numberOfLines={1}>📷 Photo</Text>
          ) : replyToMessage.messageType === 'audio' ? (
            <Text style={[styles.quoteText, { color: colors.gray }]} numberOfLines={1}>🎤 Voice message</Text>
          ) : (
            <Text style={[styles.quoteText, { color: colors.gray }]} numberOfLines={1}>
              {replyToMessage.content}
            </Text>
          )}
        </View>
      );
    };

    const renderTextWithLinks = (text: string) => {
      const parts = parseTextWithLinks(text);
      return (
        <Text style={[styles.bodyText, { color: isEmojiOnly ? undefined : colors.text }]}>
          {parts.map((part, i) =>
            part.type === 'url' ? (
              <Text
                key={i}
                style={[styles.linkText, { color: colors.primary }]}
                onPress={() => Linking.openURL(part.text)}
              >
                {part.text}
              </Text>
            ) : (
              <Text key={i}>{part.text}</Text>
            ),
          )}
        </Text>
      );
    };

    return (
      <View style={[styles.outer, { alignItems: isMe ? 'flex-end' : 'flex-start' }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onLongPress={handleLongPress}
          delayLongPress={400}
          style={[
            styles.bubble,
            {
              backgroundColor: isMe ? colors.bubbleSentBg : colors.bubbleReceivedBg,
              borderBottomRightRadius: isMe ? 4 : 18,
              borderBottomLeftRadius: isMe ? 18 : 4,
              borderColor: colors.glassBorder,
              borderWidth: colors.borderWidth > 0 ? colors.borderWidth : 0,
            },
          ]}
        >
          {/* Quoted/Reply message */}
          {renderQuotedMessage()}

          {/* Image message */}
          {messageType === 'image' && mediaUrl && (
            <TouchableOpacity activeOpacity={0.9} onPress={handleImageTap}>
              <View style={styles.mediaContainer}>
                <Image source={{ uri: mediaUrl }} style={[styles.mediaImage, isEmojiOnly ? styles.emojiOnlyImage : null]} />
              </View>
            </TouchableOpacity>
          )}

          {/* Audio/Voice message */}
          {messageType === 'audio' && mediaUrl ? (
            <View style={styles.audioContainer}>
              <View style={[styles.audioBubble, { borderColor: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.15)' }]}>
                <PlayCircle size={24} color={isMe ? colors.primary : 'white'} />
                <View style={styles.audioProgress}>
                  <View style={styles.audioProgressTrack} />
                  <View style={styles.audioProgressThumb} />
                </View>
                <Text style={[styles.audioDuration, { color: isMe ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.8)' }]}>0:0</Text>
              </View>
            </View>
          ) : null}

          {/* Text content */}
          {content ? (
            <View style={styles.textContent}>
              {isEmojiOnly
                ? <Text style={styles.emojiText}>{content}</Text>
                : renderTextWithLinks(content)
              }
            </View>
          ) : null}

          {/* Meta row: timestamp + read ticks + status */}
          <View style={styles.metaRow}>
            <Text style={[
              styles.timeText,
              { color: isMe ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.6)' },
            ]}>
              {formatMessageTime(timestamp)}
            </Text>
            {renderTicks()}
          </View>
        </TouchableOpacity>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  outer: {
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  bubble: {
    minWidth: 40,
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 20,
  },
  linkText: {
    fontSize: 15,
    lineHeight: 20,
    textDecorationLine: 'underline',
  },
  emojiText: {
    fontSize: 48,
    lineHeight: 56,
  },
  textContent: {
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
  },
  timeText: {
    fontSize: 11,
  },
  tickContainer: {
    marginLeft: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tickIconWrap: {
    marginRight: 2,
  },
  statusText: {
    fontSize: 10,
  },
  mediaContainer: {
    marginHorizontal: -14,
    marginTop: -8,
    marginBottom: 2,
  },
  mediaImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
  emojiOnlyImage: {
    width: 140,
    height: 140,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  audioContainer: {
    marginVertical: 4,
    marginBottom: 10,
  },
  audioBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  audioProgress: {
    flex: 1,
    marginHorizontal: 12,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  audioProgressTrack: {
    width: '60%',
    height: 3,
    borderRadius: 1.5,
  },
  audioProgressThumb: {
    position: 'absolute',
    left: '60%',
    top: -4,
    height: 11,
    backgroundColor: 'white',
  },
  audioDuration: {
    fontSize: 12,
    position: 'absolute',
    left: '50%',
  },

  // Quote/Reply preview
  quoteContainer: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 6,
    paddingVertical: 6,
  },
  quoteTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quoteName: {
    fontSize: 11,
    fontWeight: '600',
  },
  quoteText: {
    fontSize: 12,
    marginTop: 2,
  },
});
