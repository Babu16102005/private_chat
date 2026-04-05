import React, { useState } from 'react';
import { Modal, View, Image, TouchableOpacity, StyleSheet, Dimensions, Text, StatusBar } from 'react-native';

const { height } = Dimensions.get('window');

interface MediaViewerProps {
  uri: string;
  visible: boolean;
  onClose: () => void;
  messageType?: 'image' | 'video' | 'audio';
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ uri, visible, onClose, messageType = 'image' }) => {
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
            <Text style={styles.closeText}>×</Text>
          </View>
        </TouchableOpacity>

        {messageType === 'image' && (
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        )}

        {messageType === 'audio' && (
          <View style={styles.audioContainer}>
            <Text style={styles.audioTitle}>Voice Message</Text>
            <View style={styles.audioVisualizer}>
              {[...Array(30)].map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.audioBar,
                    { height: 10 + Math.random() * 40 },
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        {messageType === 'video' && (
          <View style={styles.videoPlaceholder}>
            <Text style={styles.videoText}>Video Playback</Text>
            <Text style={styles.videoSubtext}>Video player not yet implemented</Text>
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
  audioVisualizer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 100,
    paddingVertical: 20,
  },
  audioBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: '#7D5CFF',
  },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  videoText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  videoSubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
});
