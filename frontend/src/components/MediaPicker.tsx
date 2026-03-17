import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../constants/theme';

interface MediaPickerProps {
  onMediaSelect: (asset: ImagePicker.ImagePickerAsset) => void;
}

export const MediaPicker: React.FC<MediaPickerProps> = ({ onMediaSelect }) => {
  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permission.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera roll access to send photos and videos.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      videoMaxDuration: 30,
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      onMediaSelect(result.assets[0]);
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={pickMedia}>
      <Text style={styles.text}>📸</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 5,
  },
  text: {
    fontSize: 24,
    color: theme.colors.primary,
  }
});
