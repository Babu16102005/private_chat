import React, { useState, useRef, useEffect, memo } from 'react';
import { View, Text, TouchableOpacity, Image, Alert, StyleSheet, Platform, Linking } from 'react-native';
import { Check, CheckCheck, Play, Pause, Reply } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { File, Paths } from 'expo-file-system';
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
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'voice';
  replyToMessage?: ReplyToMessage | null;
  onImageTap?: (uri: string) => void;
  onMediaTap?: (uri: string, type: 'image' | 'video' | 'audio') => void;
}

// URL detection regex
const URL_REGEX = /\b(https?:\/\/[^\s]+)/g;

const getMediaExtension = (uri: string, messageType?: string) => {
  const cleanUri = uri.split('?')[0];
  const ext = cleanUri.split('.').pop()?.toLowerCase();

  if (ext && ext.length <= 5 && /^[a-z0-9]+$/.test(ext)) return ext;
  return messageType === 'video' ? 'mp4' : 'jpg';
};

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
    replyToMessage, onImageTap, onMediaTap,
  }) {
    const { colors } = useTheme();

    // Audio playback state
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const soundRef = useRef<Audio.Sound | null>(null);

    const normalizedMessageType = messageType === 'voice' ? 'audio' : messageType;

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
      const canSaveMedia = !!mediaUrl && (normalizedMessageType === 'image' || normalizedMessageType === 'video');
      if (!onDelete && !onReply && !canSaveMedia) return;

      const buttons: any[] = [
        { text: 'Cancel', style: 'cancel' },
      ];
      if (canSaveMedia) {
        buttons.push({ text: 'Save media', style: 'default', onPress: handleDownloadMedia });
      }
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

    const handleVideoTap = () => {
      if (mediaUrl && onMediaTap) {
        onMediaTap(mediaUrl, 'video');
      }
    };

    async function handleDownloadMedia() {
      if (!mediaUrl || (normalizedMessageType !== 'image' && normalizedMessageType !== 'video')) return;

      try {
        if (Platform.OS === 'web') {
          const link = document.createElement('a');
          link.href = mediaUrl;
          link.download = `couplechat-${Date.now()}.${getMediaExtension(mediaUrl, normalizedMessageType)}`;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          return;
        }

        const extension = getMediaExtension(mediaUrl, normalizedMessageType);
        const fileName = `couplechat-${Date.now()}.${extension}`;
        await File.downloadFileAsync(mediaUrl, new File(Paths.document, fileName), { idempotent: true });

        Alert.alert('Downloaded', `Saved to app storage as ${fileName}`);
      } catch (error) {
        console.error('Media download failed:', error);
        Alert.alert('Download failed', 'Could not download this media. Please check your connection and try again.');
      }
    }

    const handleAudioTap = () => {
      if (!mediaUrl) return;
      if (isPlaying) {
        pauseAudio();
      } else {
        playAudio();
      }
    };

    const playAudio = async () => {
      if (!mediaUrl) return;
      try {
        // Stop any previous sound
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri: mediaUrl },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              setProgress(status.positionMillis || 0);
              if (status.durationMillis) setDuration(status.durationMillis);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setProgress(0);
              }
            }
          }
        );
        soundRef.current = sound;
        setIsPlaying(true);
      } catch (error) {
        console.error('Failed to play audio:', error);
        Alert.alert('Playback failed', 'Could not play this voice message. Please check your connection and try again.');
        setIsPlaying(false);
      }
    };

    const pauseAudio = async () => {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      }
    };

    const formatTime = (ms: number) => {
      const totalSec = Math.floor(ms / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    // Cleanup audio when component unmounts
    useEffect(() => {
      return () => {
        if (soundRef.current) {
          soundRef.current.unloadAsync();
          soundRef.current = null;
        }
      };
    }, []);

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
            <Text style={[styles.quoteText, { color: colors.gray }]} numberOfLines={1}>Photo</Text>
          ) : replyToMessage.messageType === 'audio' ? (
            <Text style={[styles.quoteText, { color: colors.gray }]} numberOfLines={1}>Voice message</Text>
          ) : replyToMessage.messageType === 'video' ? (
            <Text style={[styles.quoteText, { color: colors.gray }]} numberOfLines={1}>Video</Text>
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

    const progressPercent = duration > 0 ? Math.min(progress / duration, 1) : 0;

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
              borderBottomRightRadius: isMe ? 8 : 22,
              borderBottomLeftRadius: isMe ? 22 : 8,
              borderColor: colors.glassBorder,
              borderWidth: colors.borderWidth > 0 ? colors.borderWidth : StyleSheet.hairlineWidth,
            },
          ]}
        >
          {/* Quoted/Reply message */}
          {renderQuotedMessage()}

          {/* Image message */}
          {messageType === 'image' && mediaUrl && (
            <TouchableOpacity activeOpacity={0.9} onPress={handleImageTap}>
              <View style={styles.mediaContainer}>
                <Image source={{ uri: mediaUrl }} style={[styles.mediaImage, isEmojiOnly ? styles.emojiOnlyImage : null]} resizeMode="cover" />
              </View>
            </TouchableOpacity>
          )}

          {/* Video message */}
          {messageType === 'video' && mediaUrl && (
            <TouchableOpacity activeOpacity={0.8} onPress={handleVideoTap}>
              <View style={[styles.videoThumbnail, isMe ? { backgroundColor: 'rgba(128,128,128,0.2)' } : { backgroundColor: 'rgba(128,128,128,0.15)' }]}>
                <Image source={{ uri: mediaUrl }} style={styles.videoThumbnailImage} resizeMode="cover" />
                <View style={styles.playOverlay}>
                  <Play size={32} color="white" strokeWidth={2} />
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Audio/Voice message */}
          {normalizedMessageType === 'audio' && mediaUrl ? (
            <View style={styles.audioContainer}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleAudioTap}
                style={[styles.audioBubble, { borderColor: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.15)' }]}
              >
                <View style={[styles.playBtn, { backgroundColor: isMe ? colors.primary : 'rgba(255,255,255,0.2)' }]}>
                  {isPlaying ? (
                    <Pause size={16} color="white" />
                  ) : (
                    <Play size={16} color="white" />
                  )}
                </View>
                <View style={styles.audioProgressWrap}>
                  <View style={styles.audioProgressTrack}>
                    <View style={[styles.audioProgressFill, { width: `${progressPercent * 100}%` }]} />
                  </View>
                </View>
                <Text style={[styles.audioDuration, { color: isMe ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.8)' }]}>
                  {duration > 0 ? formatTime(duration) : '--:--'}
                </Text>
              </TouchableOpacity>
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
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#B94CFF',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
      },
      android: {
        elevation: 5,
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
    position: 'relative',
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

  // Video thumbnail
  videoThumbnail: {
    width: 200,
    height: 150,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginHorizontal: -14,
    marginTop: -8,
    marginBottom: 2,
  },
  videoThumbnailImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  playOverlay: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Audio
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
    minWidth: 160,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioProgressWrap: {
    flex: 1,
    marginHorizontal: 10,
    height: 24,
    justifyContent: 'center',
  },
  audioProgressTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  audioProgressFill: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  audioDuration: {
    fontSize: 12,
  },

  // Quote/Reply preview
  quoteContainer: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 6,
    paddingVertical: 6,
    paddingRight: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
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
