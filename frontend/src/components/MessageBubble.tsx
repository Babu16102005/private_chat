import React, { useState, useRef, useEffect, memo } from 'react';
import { View, Text, TouchableOpacity, Image, Alert, StyleSheet, Platform, Linking, Animated } from 'react-native';
import { Check, CheckCheck, FileText, Phone, Play, Pause, Reply } from 'lucide-react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../context/ThemeContext';
import { formatMessageTime } from '../utils/date';
import { getStickerById } from '../utils/stickers';

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
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'system_call' | 'encrypted' | 'sticker';
  fileName?: string;
  fileSize?: number | null;
  mimeType?: string | null;
  audioDurationMs?: number | null;
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

const getWebAudioDuration = (uri: string) => new Promise<number>((resolve) => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    resolve(0);
    return;
  }

  const audio = document.createElement('audio');
  const cleanup = () => {
    audio.removeAttribute('src');
    audio.load();
  };

  audio.preload = 'metadata';
  audio.onloadedmetadata = () => {
    const seconds = Number.isFinite(audio.duration) ? audio.duration : 0;
    cleanup();
    resolve(Math.round(seconds * 1000));
  };
  audio.onerror = () => {
    cleanup();
    resolve(0);
  };
  audio.src = uri;
});

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
    onDelete, onReply, mediaUrl, messageType, fileName, fileSize, mimeType, audioDurationMs,
    replyToMessage, onImageTap, onMediaTap,
  }) {
    const { colors, isDark } = useTheme();

    // Audio playback state
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const playerRef = useRef<AudioPlayer | null>(null);
    const stickerAnim = useRef(new Animated.Value(0)).current;

    const normalizedMessageType = messageType === 'voice' ? 'audio' : messageType;
    const sticker = normalizedMessageType === 'sticker' ? getStickerById(mediaUrl || content) : undefined;
    const displayDuration = duration || audioDurationMs || 0;

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
      const canSaveMedia = !!mediaUrl && (normalizedMessageType === 'image' || normalizedMessageType === 'video' || normalizedMessageType === 'document');
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
      if (!mediaUrl || (normalizedMessageType !== 'image' && normalizedMessageType !== 'video' && normalizedMessageType !== 'document')) return;

      try {
        if (Platform.OS === 'web') {
          const link = document.createElement('a');
          link.href = mediaUrl;
          link.download = fileName || `kiba-${Date.now()}.${getMediaExtension(mediaUrl, normalizedMessageType)}`;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          return;
        }

        const extension = getMediaExtension(mediaUrl, normalizedMessageType);
        const downloadedFileName = fileName || `kiba-${Date.now()}.${extension}`;
        
        const dir = Paths.document || Paths.cache;
        const destination = new File(dir, downloadedFileName);
        
        const { uri } = await File.downloadFileAsync(mediaUrl, destination);
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        } else {
          Alert.alert('Downloaded', `Saved as ${downloadedFileName}`);
        }
      } catch (error) {
        console.error('Media download failed:', error);
        Alert.alert('Download failed', 'Could not download or open this media.');
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
        if (playerRef.current) {
          playerRef.current.remove();
          playerRef.current = null;
        }

        const player = createAudioPlayer({ uri: mediaUrl }, { updateInterval: 250 });
        const subscription = player.addListener('playbackStatusUpdate', (status) => {
          if (status.isLoaded) {
            setProgress(Math.round((status.currentTime || 0) * 1000));
            if (status.duration) setDuration(Math.round(status.duration * 1000));
            if (status.didJustFinish) {
              setIsPlaying(false);
              setProgress(0);
              subscription.remove();
              player.remove();
              if (playerRef.current === player) playerRef.current = null;
            }
          }
        });
        player.play();
        playerRef.current = player;
        setIsPlaying(true);
      } catch (error) {
        console.error('Failed to play audio:', error);
        Alert.alert('Playback failed', 'Could not play this voice message. Please check your connection and try again.');
        setIsPlaying(false);
      }
    };

    const pauseAudio = async () => {
      if (playerRef.current) {
        playerRef.current.pause();
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
        if (playerRef.current) {
          playerRef.current.remove();
          playerRef.current = null;
        }
      };
    }, []);

    useEffect(() => {
      let isMounted = true;
      if (normalizedMessageType !== 'audio' || !mediaUrl || audioDurationMs || duration > 0) return;

      const loadDuration = async () => {
        try {
          if (Platform.OS === 'web') {
            const nextDuration = await getWebAudioDuration(mediaUrl);
            if (isMounted && nextDuration > 0) setDuration(nextDuration);
            return;
          }

          const player = createAudioPlayer({ uri: mediaUrl });
          if (player.duration && isMounted) {
            setDuration(Math.round(player.duration * 1000));
          }
          player.remove();
        } catch (error) {
          console.warn('Failed to load audio duration:', error);
        }
      };

      loadDuration();

      return () => {
        isMounted = false;
      };
    }, [audioDurationMs, duration, mediaUrl, normalizedMessageType]);

    useEffect(() => {
      if (!sticker) return;

      stickerAnim.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(stickerAnim, { toValue: 1, duration: 850, useNativeDriver: true }),
          Animated.timing(stickerAnim, { toValue: 0, duration: 850, useNativeDriver: true }),
        ])
      );
      loop.start();

      return () => loop.stop();
    }, [sticker, stickerAnim]);

    const getStickerAnimatedStyle = () => {
      if (!sticker) return null;

      const scale = stickerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] });
      const translateY = stickerAnim.interpolate({ inputRange: [0, 1], outputRange: [5, -7] });
      const rotate = stickerAnim.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '7deg'] });

      if (sticker.animation === 'pulse') return { transform: [{ scale }] };
      if (sticker.animation === 'float') return { transform: [{ translateY }] };
      if (sticker.animation === 'spin') return { transform: [{ rotate }] };
      if (sticker.animation === 'shake') return { transform: [{ rotate }, { translateY: stickerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] };
      if (sticker.animation === 'bounce') return { transform: [{ translateY }, { scale }] };
      return { transform: [{ scale }, { rotate }] };
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
          {replyToMessage.messageType === 'sticker' ? (
            <Text style={[styles.quoteText, { color: colors.gray }]} numberOfLines={1}>Sticker</Text>
          ) : replyToMessage.messageType === 'image' ? (
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

    const progressPercent = displayDuration > 0 ? Math.min(progress / displayDuration, 1) : 0;

    const formatFileSize = (size?: number | null) => {
      if (!size) return mimeType || 'Document';
      if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    };

    if (messageType === 'system_call') {
      return (
        <View style={styles.systemOuter}>
          <View style={[styles.systemPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' }]}>
            {isMe ? <Phone size={12} color={colors.text} /> : <Phone size={12} color={colors.text} />}
            <Text style={[styles.systemText, { color: colors.text }]}>{content || 'Call ended'}</Text>
          </View>
        </View>
      );
    }

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
              borderWidth: colors.borderWidth,
            },
          ]}
        >
          <LinearGradient 
            colors={isMe 
              ? ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.06)'] as any 
              : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)'] as any} 
            style={StyleSheet.absoluteFill} 
          />
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
                style={[styles.audioBubble, { borderColor: colors.glassBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' }]}
              >
                <View style={[styles.playBtn, { backgroundColor: isMe ? colors.primary : 'rgba(255,255,255,0.2)' }]}>
                  {isPlaying ? (
                    <Pause size={16} color="white" />
                  ) : (
                    <Play size={16} color="white" />
                  )}
                </View>
                <View style={styles.audioProgressWrap}>
                  <View style={styles.waveformRow}>
                    {Array.from({ length: 18 }).map((_, index) => {
                      const isFilled = progressPercent > index / 18;
                      const height = 8 + ((index * 7) % 18);
                      return (
                        <View
                          key={index}
                          style={[
                            styles.waveformBar,
                            {
                              height,
                              backgroundColor: isFilled
                                ? (isDark ? 'rgba(255,255,255,0.82)' : colors.primary)
                                : (isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.18)'),
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>
                <Text style={[styles.audioDuration, { color: isMe ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.8)' }]}> 
                  {displayDuration > 0 ? formatTime(displayDuration) : '0:00'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {messageType === 'document' && mediaUrl ? (
            <TouchableOpacity activeOpacity={0.78} onPress={handleDownloadMedia} style={[styles.documentCard, { borderColor: colors.glassBorder }]}> 
              <View style={[styles.documentIcon, { backgroundColor: colors.primary }]}> 
                <FileText size={22} color="white" />
              </View>
              <View style={styles.documentTextWrap}>
                <Text style={[styles.documentName, { color: colors.text }]} numberOfLines={1}>{fileName || content || 'Document'}</Text>
                <Text style={[styles.documentMeta, { color: colors.gray }]} numberOfLines={1}>{formatFileSize(fileSize)}</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {normalizedMessageType === 'sticker' && sticker ? (
            <View style={styles.stickerWrap}>
              <Animated.View style={[styles.stickerGlow, { backgroundColor: sticker.accent }, { opacity: stickerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.34] }), transform: [{ scale: stickerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.12] }) }] }]} />
              <Animated.Text style={[styles.stickerEmoji, getStickerAnimatedStyle()]}>{sticker.emoji}</Animated.Text>
              <View style={styles.stickerSparkRow}>
                <Animated.Text style={[styles.stickerSpark, { opacity: stickerAnim }]}>✦</Animated.Text>
                <Animated.Text style={[styles.stickerSpark, { opacity: stickerAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }) }]}>✧</Animated.Text>
                <Animated.Text style={[styles.stickerSpark, { opacity: stickerAnim }]}>✦</Animated.Text>
              </View>
            </View>
          ) : null}

          {/* Text content */}
          {content && normalizedMessageType !== 'sticker' ? (
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
              { color: isDark ? (isMe ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.6)') : colors.gray },
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
  systemOuter: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 0.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  systemText: {
    fontSize: 12,
    fontWeight: '700',
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
        shadowRadius: 20,
      },
      android: {
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
  stickerWrap: {
    width: 132,
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -4,
    marginTop: -2,
    marginBottom: 6,
  },
  stickerGlow: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    opacity: 0.2,
  },
  stickerEmoji: {
    fontSize: 70,
    lineHeight: 82,
  },
  stickerSparkRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stickerSpark: {
    color: '#FFE8A3',
    fontSize: 16,
    fontWeight: '900',
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
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
    minWidth: 210,
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
    minWidth: 90,
    maxWidth: 118,
  },
  waveformRow: {
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
  },
  audioDuration: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
    flexShrink: 0,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 220,
    marginVertical: 4,
    marginBottom: 10,
    padding: 10,
    borderRadius: 18,
    borderWidth: 0.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  documentIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  documentTextWrap: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '800',
  },
  documentMeta: {
    fontSize: 12,
    marginTop: 3,
  },

  // Quote/Reply preview
  quoteContainer: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 6,
    paddingVertical: 6,
    paddingRight: 8,
    borderRadius: 12,
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
