import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ImagePlus, SendHorizontal } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { storyService, storageService } from '../services/supabaseService';
import { useTheme } from '../context/ThemeContext';

export const CreateStoryScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);

  const pickStory = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setAsset(result.assets[0]);
  };

  const postStory = async () => {
    if (!asset) return;
    try {
      setPosting(true);
      const isVideo = asset.type === 'video';
      const name = asset.uri.split('?')[0].split('/').pop() || (isVideo ? 'story.mp4' : 'story.jpg');
      const url = await storageService.uploadFile({ uri: asset.uri, name, type: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg') });
      await storyService.createStory(url, isVideo ? 'video' : 'image', caption.trim() || undefined);
      navigation.goBack();
    } catch (error) {
      console.error('Post story failed:', error);
      Alert.alert('Story failed', 'Could not post your story. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <LinearGradient colors={colors.gradientPrimary as any} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}><ChevronLeft size={28} color={colors.text} /></TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>New story</Text>
          <TouchableOpacity disabled={!asset || posting} onPress={postStory} style={styles.iconButton}><SendHorizontal size={22} color={asset ? colors.primary : colors.gray} /></TouchableOpacity>
        </View>
        <TouchableOpacity onPress={pickStory} activeOpacity={0.84} style={[styles.picker, { borderColor: colors.glassBorder }]}> 
          {asset ? (
            <Image source={{ uri: asset.uri }} style={styles.preview} resizeMode="cover" />
          ) : (
            <View style={styles.emptyPicker}>
              <ImagePlus size={44} color={colors.primary} />
              <Text style={[styles.pickText, { color: colors.text }]}>Choose a photo or video</Text>
            </View>
          )}
        </TouchableOpacity>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Add a caption..."
          placeholderTextColor={colors.gray}
          style={[styles.caption, { color: colors.text, borderColor: colors.glassBorder }]}
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 18 },
  header: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '900' },
  picker: { flex: 1, marginVertical: 18, borderRadius: 32, overflow: 'hidden', borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  preview: { width: '100%', height: '100%' },
  emptyPicker: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  pickText: { fontSize: 17, fontWeight: '800' },
  caption: { minHeight: 54, borderRadius: 24, borderWidth: 0.5, paddingHorizontal: 18, fontSize: 15, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 18 },
});
