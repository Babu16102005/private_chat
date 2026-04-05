import React, { useState } from 'react';
import { Modal, View, Image, TouchableOpacity, StyleSheet, Dimensions, StatusBar, Animated, PanResponder } from 'react-native';
import { X } from 'lucide-react-native';

const { height, width } = Dimensions.get('window');

interface ImageViewerProps {
  uri: string;
  visible: boolean;
  onClose: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ uri, visible, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);
  const panY = React.useRef(new Animated.Value(0)).current;

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
      onPanResponderMove: (_, gestureState) => {
        panY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dy) > 100) {
          handleClose();
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const handleClose = () => {
    setIsClosing(true);
    Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start(() => {
      setIsClosing(false);
      onClose();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <StatusBar hidden />
        <Animated.View
          style={[styles.imageWrap, { transform: [{ translateY: panY }] }]}
          {...panResponder.panHandlers}
        >
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        </Animated.View>

        {/* Close button */}
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <View style={styles.closeBtnWrap}>
            <X size={24} color="white" />
          </View>
        </TouchableOpacity>

        {/* Tap area to close */}
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
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
  imageWrap: {
    width: '100%',
    height: height * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  closeBtnWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
