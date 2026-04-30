import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { storyService } from '../services/supabaseService';
import { useTheme } from '../context/ThemeContext';

export const StoryViewerScreen = ({ route, navigation }: any) => {
  const { story } = route.params;
  const { colors } = useTheme();
  const player = useVideoPlayer(story.media_type === 'video' ? story.media_url : null, (nextPlayer) => {
    nextPlayer.loop = true;
    nextPlayer.play();
  });

  useEffect(() => {
    storyService.markViewed(story.id);
  }, [story.id]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#030511', '#17112A', '#050712']} style={StyleSheet.absoluteFill} />
      {story.media_type === 'video' ? (
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" />
      ) : (
        <Image source={{ uri: story.media_url }} style={StyleSheet.absoluteFill} resizeMode="contain" />
      )}
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ChevronLeft size={28} color="white" />
          </TouchableOpacity>
          <View>
            <Text style={styles.name}>{story.user?.name || 'Story'}</Text>
            <Text style={[styles.time, { color: colors.gray }]}>Expires in 24 hours</Text>
          </View>
        </View>
        {!!story.caption && <Text style={styles.caption}>{story.caption}</Text>}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030511' },
  safe: { flex: 1, justifyContent: 'space-between' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  name: { color: 'white', fontSize: 16, fontWeight: '900' },
  time: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  caption: { color: 'white', fontSize: 16, fontWeight: '700', textAlign: 'center', paddingHorizontal: 24, paddingBottom: 34 },
});
