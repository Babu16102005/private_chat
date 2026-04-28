import React, { useState, useEffect, useRef } from 'react';
import { Modal, View, Image, TouchableOpacity, StyleSheet, Dimensions, Text, StatusBar, Platform, Alert } from 'react-native';
import { Audio } from 'expo-av';

const { height } = Dimensions.get('window');

interface MediaViewerProps {
  uri: string;
  visible: boolean;
  onClose: () => void;
  messageType?: 'image' | 'video' | 'audio';
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ uri, visible, onClose, messageType = 'image' }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  const playAudio = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((s: any) => {
        if (s.isLoaded) {
          setProgress(s.positionMillis || 0);
          if (s.durationMillis) setDuration(s.durationMillis);
          if (s.didJustFinish) {
            setIsPlaying(false);
            setProgress(0);
          }
        }
      });
      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to play audio:', error);
      Alert.alert('Playback failed', 'Could not play this voice message. Please check your connection and try again.');
      setIsPlaying(false);
    }
  };

  const toggleAudioPlayback = async () => {
    if (!soundRef.current) {
      await playAudio();
      return;
    }

    const status = (await soundRef.current.getStatusAsync()) as any;
    if (!status.isLoaded) return;

    if (isPlaying) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (!visible) {
      (async () => {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        setIsPlaying(false);
        setProgress(0);
        setDuration(0);
      })();
    }
  }, [visible]);

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar hidden />
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <View style={styles.closeIconWrap}>
            <Text style={styles.closeText}>&#x2715;</Text>
          </View>
        </TouchableOpacity>

        {/* Image */}
        {messageType === 'image' && (
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        )}

        {/* Audio */}
        {messageType === 'audio' && (
          <View style={styles.audioContainer}>
            <Text style={styles.audioTitle}>Voice Message</Text>
            <View style={styles.audioPlayer}>
              <View style={styles.audioVisualizer}>
                {[...Array(30)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.audioBar,
                      {
                        height: 10 + Math.sin(i * 0.5) * 20,
                        opacity: progress / (duration || 1) > i / 30 ? 1 : 0.3,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
            <View style={styles.audioControls}>
              <Text style={styles.timeText}>{formatTime(progress)}</Text>
              <TouchableOpacity style={styles.playButton} onPress={toggleAudioPlayback}>
                <View style={[styles.playBtn, isPlaying ? styles.pauseBtn : null]}>
                  <Text style={styles.playSymbol}>
                    {isPlaying ? '\u2215\u2215' : '>'}
                  </Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.timeText}>{duration > 0 ? formatTime(duration) : '--:--'}</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }]} />
            </View>
          </View>
        )}

        {/* Video - use native video element on web, or link on mobile */}
        {messageType === 'video' && (
          <View style={styles.videoContainer}>
            {Platform.OS === 'web' ? (
              <video
                src={uri}
                controls
                autoPlay
                style={styles.videoElement}
              />
            ) : (
              <View style={styles.videoPlaceholder}>
                <Image source={{ uri }} style={styles.videoThumbnail} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.videoPlayOverlay}
                  onPress={() => {
                    // Open video in browser on mobile
                    const { Linking } = require('react-native');
                    Linking.openURL(uri);
                  }}
                >
                  <Text style={styles.playSymbol}>▶</Text>
                </TouchableOpacity>
                <Text style={styles.videoHint}>Tap to open video in player</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: height * 0.7,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 16,
    zIndex: 10,
  },
  closeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: 'white',
    fontSize: 24,
    lineHeight: 28,
  },
  audioContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 40,
  },
  audioTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  audioPlayer: {
    width: '100%',
    paddingVertical: 20,
  },
  audioVisualizer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
    height: 100,
  },
  audioBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: '#7D5CFF',
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  timeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontFamily: Platform.select({ ios: 'SF Mono', android: 'monospace' }) || 'monospace',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7D5CFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseBtn: {
    flexDirection: 'row',
    gap: 4,
    paddingLeft: 8,
  },
  playSymbol: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
  },
  progressBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 10,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#7D5CFF',
  },
  videoContainer: {
    width: '100%',
    height: height * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoElement: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoPlayOverlay: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 12,
  },
});
