import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Bell, MessagesSquare, Eraser, Image as ImageIcon, Link, LogOut, Palette, Upload, RotateCcw } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { chatSettingsService, storageService } from '../services/supabaseService';
import { chatBackgroundPresets, defaultChatBackgroundSettings, normalizeBackgroundOpacity } from '../utils/chatBackground';

export const ChatSettingsScreen = ({ route, navigation }: any) => {
  const { pairId, partner } = route.params;
  const { user } = useAuth();
  const { colors, isDark, themeMode } = useTheme();
  const insets = useSafeAreaInsets();
  const [isBlocked, setIsBlocked] = useState(false);
  const [backgroundSettings, setBackgroundSettings] = useState(defaultChatBackgroundSettings);
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);
  const [contentCounts, setContentCounts] = useState({ mediaCount: 0, linkCount: 0, docsCount: 0 });

  useEffect(() => {
    let active = true;

    (async () => {
      const [backgroundSettingsResult, counts] = await Promise.all([
        chatSettingsService.getChatBackground(pairId),
        chatSettingsService.getChatContentCounts(pairId),
      ]);

      if (active) {
        setBackgroundSettings(backgroundSettingsResult);
        setContentCounts(counts);
      }
    })();

    return () => {
      active = false;
    };
  }, [pairId]);

  const handleSelectBackground = async (backgroundId: string) => {
    setBackgroundSettings((current) => ({ ...current, background_id: backgroundId }));
    try {
      await chatSettingsService.setChatBackground(pairId, backgroundId);
    } catch (error) {
      Alert.alert('Could not save', 'Please check your connection and try again.');
    }
  };

  const handleUploadBackground = async () => {
    if (isUploadingBackground) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please allow photo access to choose a chat background.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'image/jpeg';
      const ext = mimeType.includes('png') ? 'png' : 'jpg';
      const fileName = asset.fileName || `chat-background.${ext}`;

      setIsUploadingBackground(true);
      const backgroundUrl = await storageService.uploadFile({
        uri: asset.uri,
        name: fileName,
        type: mimeType,
      }, 'chat-media');

      const nextSettings = {
        ...backgroundSettings,
        background_image_url: backgroundUrl,
      };
      setBackgroundSettings(nextSettings);
      await chatSettingsService.updateChatBackground(pairId, nextSettings);
    } catch (error: any) {
      Alert.alert('Upload failed', error.message || 'Could not update chat background.');
    } finally {
      setIsUploadingBackground(false);
    }
  };

  const handleClearCustomBackground = async () => {
    const nextSettings = { ...backgroundSettings, background_image_url: null };
    setBackgroundSettings(nextSettings);
    try {
      await chatSettingsService.updateChatBackground(pairId, nextSettings);
    } catch (error) {
      Alert.alert('Could not save', 'Please check your connection and try again.');
    }
  };

  const handleOpacityChange = async (nextOpacity: number) => {
    const normalizedOpacity = normalizeBackgroundOpacity(nextOpacity);
    const nextSettings = { ...backgroundSettings, background_opacity: normalizedOpacity };
    setBackgroundSettings(nextSettings);
    try {
      await chatSettingsService.updateChatBackground(pairId, nextSettings);
    } catch (error) {
      Alert.alert('Could not save', 'Please check your connection and try again.');
    }
  };

  const handleClearChat = async () => {
    Alert.alert(
      'Clear Chat',
      'This will remove all messages from your view. Your partner will still see them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await chatSettingsService.clearChat(pairId);
            Alert.alert('Cleared', 'Chat history removed from your view');
            navigation.goBack();
          },
        },
      ],
    );
  };

  const handleBlockUser = async () => {
    if (isBlocked) {
      chatSettingsService.unblockUser(pairId);
      setIsBlocked(false);
      Alert.alert('Unblocked', `${partner?.name || 'Partner'} has been unblocked`);
    } else {
      Alert.alert(
        'Block Contact',
        `You will no longer receive messages from ${partner?.name || 'this contact'}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              chatSettingsService.blockUser(pairId);
              setIsBlocked(true);
              Alert.alert('Blocked', `${partner?.name || 'Contact'} has been blocked`);
            },
          },
        ],
      );
    }
  };

  const statusText = isBlocked ? 'Blocked' : 'Active';
  const statusColor = isBlocked ? '#FF4B4B' : colors.tertiary;
  const avatarSeed = partner?.name || partner?.email || 'Partner';
  const avatarSource = partner?.avatar_url
    ? { uri: partner.avatar_url }
    : { uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}` };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={colors.gradientPrimary as any} start={{ x: 0.08, y: 0 }} end={{ x: 0.95, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={themeMode === 'mocha'
            ? ['rgba(71,111,155,0.2)', 'rgba(127,165,194,0.14)', 'transparent'] as any
            : ['rgba(100,243,255,0.12)', 'rgba(233,199,255,0.07)', 'transparent'] as any}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.18, y: 0.76 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={themeMode === 'mocha'
            ? ['transparent', 'rgba(82,122,167,0.16)', 'rgba(48,80,113,0.16)'] as any
            : ['transparent', 'rgba(141,255,213,0.08)', 'rgba(5,7,18,0.22)'] as any}
          start={{ x: 0, y: 0.25 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Header */}
      <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.headerBar, { paddingTop: insets.top + 8, borderBottomColor: colors.glassBorder, borderBottomWidth: StyleSheet.hairlineWidth }]}> 
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { borderColor: colors.glassBorder }]}> 
          <ChevronLeft size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Chat Info</Text>
        <View style={{ width: 40 }} />
      </BlurView>

      <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {/* Partner Profile Header */}
        <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.profileHeader, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
          <Image
            source={avatarSource}
            style={[styles.profileAvatar, { borderRadius: colors.radius.pill, borderColor: colors.glassBorder }]}
          />
          <Text style={[styles.profileName, { color: colors.text }]}>{partner?.name || 'Partner'}</Text>
          <Text style={[styles.profileStatus, { color: statusColor }]}> 
            {statusText}
          </Text>
        </BlurView>

        {/* Settings Menu Items */}
        <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.section, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
          <SettingItem
            icon={<Bell size={20} color={colors.text} />}
            label="Notifications"
            value="On"
            onPress={() => {}}
            isLast
          />
        </BlurView>

        <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.section, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
          <View style={styles.menuItem}>
            <Palette size={20} color={colors.text} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>Chat Background</Text>
          </View>
          <View style={styles.backgroundGrid}>
            {chatBackgroundPresets.map((preset) => {
              const isSelected = backgroundSettings.background_id === preset.id;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[styles.backgroundOption, isSelected && { borderColor: colors.primary }]}
                  onPress={() => handleSelectBackground(preset.id)}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={preset.preview as any} style={styles.backgroundPreview} />
                  <Text style={[styles.backgroundName, { color: isSelected ? colors.text : colors.gray }]} numberOfLines={1}>
                    {preset.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.customBackgroundArea}>
            <TouchableOpacity style={[styles.uploadButton, { borderColor: colors.glassBorder }]} onPress={handleUploadBackground} disabled={isUploadingBackground}>
              <Upload size={18} color={colors.primary} />
              <Text style={[styles.uploadText, { color: colors.text }]}>{isUploadingBackground ? 'Uploading...' : 'Upload Image'}</Text>
            </TouchableOpacity>
            {backgroundSettings.background_image_url && (
              <TouchableOpacity style={[styles.uploadButton, { borderColor: colors.glassBorder }]} onPress={handleClearCustomBackground}>
                <RotateCcw size={18} color={colors.gray} />
                <Text style={[styles.uploadText, { color: colors.gray }]}>Remove Image</Text>
              </TouchableOpacity>
            )}
          </View>
          {backgroundSettings.background_image_url && (
            <View style={styles.opacityArea}>
              <Text style={[styles.opacityLabel, { color: colors.gray }]}>Image opacity</Text>
              <View style={styles.opacityControls}>
                {[0.2, 0.38, 0.55, 0.72].map((opacity) => {
                  const isSelected = Math.abs(backgroundSettings.background_opacity - opacity) < 0.03;
                  return (
                    <TouchableOpacity
                      key={opacity}
                      style={[styles.opacityPill, { borderColor: isSelected ? colors.primary : colors.glassBorder, backgroundColor: isSelected ? (isDark ? 'rgba(255,255,255,0.22)' : 'rgba(48,80,113,0.14)') : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(48,80,113,0.08)') }]}
                      onPress={() => handleOpacityChange(opacity)}
                    >
                      <Text style={[styles.opacityText, { color: isSelected ? colors.text : colors.gray }]}>{Math.round(opacity * 100)}%</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </BlurView>

        <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.section, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
          <View style={styles.menuItem}>
            <MessagesSquare size={20} color={colors.text} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>Media, Links &amp; Docs</Text>
          </View>
          <View style={[styles.mediaCount, { backgroundColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(48,80,113,0.1)', borderColor: colors.glassBorder }]}> 
            <View style={styles.mediaCountItem}>
              <ImageIcon size={16} color={colors.gray} />
              <Text style={[styles.mediaLabel, { color: colors.gray }]}>Photos &amp; Videos</Text>
              <Text style={[styles.mediaValue, { color: colors.text }]}>{contentCounts.mediaCount}</Text>
            </View>
            <View style={styles.mediaCountItem}>
              <Link size={16} color={colors.gray} />
              <Text style={[styles.mediaLabel, { color: colors.gray }]}>Links</Text>
              <Text style={[styles.mediaValue, { color: colors.text }]}>{contentCounts.linkCount}</Text>
            </View>
            <View style={styles.mediaCountItem}>
              <MessagesSquare size={16} color={colors.gray} />
              <Text style={[styles.mediaLabel, { color: colors.gray }]}>Docs</Text>
              <Text style={[styles.mediaValue, { color: colors.text }]}>{contentCounts.docsCount}</Text>
            </View>
          </View>
        </BlurView>

        <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.section, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
          <TouchableOpacity style={styles.menuItem} onPress={handleClearChat}>
            <Eraser size={20} color={colors.text} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>Clear Chat</Text>
            <ChevronLeft size={18} color={colors.gray} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={handleBlockUser}>
            <LogOut size={20} color={isBlocked ? '#10B981' : '#FF4B4B'} />
            <Text style={[styles.menuLabel, { color: isBlocked ? '#10B981' : '#FF4B4B' }]}>
              {isBlocked ? 'Unblock Contact' : 'Block Contact'}
            </Text>
            <ChevronLeft size={18} color={colors.gray} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        </BlurView>
      </ScrollView>
    </View>
  );
};

// --- Sub-components ---

function SettingItem({ icon, label, value, onPress, isLast }: {
  icon: React.ReactNode; label: string; value: string; onPress: () => void; isLast?: boolean;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.menuItem, !isLast && { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(48,80,113,0.12)' }]}> 
      {icon}
      <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.settingValue, { color: colors.gray }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, justifyContent: 'space-between', overflow: 'hidden' },
  backBtn: { width: 40, height: 40, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(48,80,113,0.1)', borderWidth: 0.5 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  scrollArea: { paddingHorizontal: 16, paddingTop: 20 },

  // Profile header
  profileHeader: { alignItems: 'center', marginBottom: 24, paddingVertical: 24, borderRadius: 30, overflow: 'hidden', backgroundColor: 'rgba(128,128,128,0.06)' },
  profileAvatar: { width: 88, height: 88, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth },
  profileName: { fontSize: 22, fontWeight: '700' },
  profileStatus: { fontSize: 14, marginTop: 4 },

  // Sections
  section: { marginBottom: 18, borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(128,128,128,0.04)' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(48,80,113,0.12)' },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '500', marginLeft: 14 },
  settingValue: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  menuItemLast: { borderBottomWidth: 0 },

  // Media counts
  mediaCount: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, margin: 12, borderWidth: 0.5, backgroundColor: 'rgba(128,128,128,0.06)' },
  mediaCountItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  mediaLabel: { flex: 1, fontSize: 15, marginLeft: 14 },
  mediaValue: { fontSize: 15 },
  backgroundGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12 },
  backgroundOption: { width: '30%', minWidth: 88, borderRadius: 18, padding: 6, borderWidth: 1, borderColor: 'rgba(48,80,113,0.18)', backgroundColor: 'rgba(48,80,113,0.08)' },
  backgroundPreview: { height: 64, borderRadius: 14, marginBottom: 8 },
  backgroundName: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  customBackgroundArea: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingBottom: 12 },
  uploadButton: { flex: 1, minHeight: 46, borderRadius: 18, borderWidth: 1, backgroundColor: 'rgba(48,80,113,0.09)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10 },
  uploadText: { fontSize: 13, fontWeight: '700' },
  opacityArea: { paddingHorizontal: 12, paddingBottom: 14 },
  opacityLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  opacityControls: { flexDirection: 'row', gap: 8 },
  opacityPill: { flex: 1, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  opacityText: { fontSize: 12, fontWeight: '700' },
});
