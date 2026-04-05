import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, ScrollView, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Shield, Bell, MessageSquare, Eraser, Image as ImageIcon, Link, LogOut } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { chatSettingsService } from '../services/supabaseService';

export const ChatSettingsScreen = ({ route, navigation }: any) => {
  const { pairId, partner } = route.params;
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [isBlocked, setIsBlocked] = useState(false);

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8, borderBottomColor: colors.glassBorder, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Chat Info</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {/* Partner Profile Header */}
        <View style={styles.profileHeader}>
          <Image
            source={{ uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}` }}
            style={[styles.profileAvatar, { borderRadius: colors.radius.pill }]}
          />
          <Text style={[styles.profileName, { color: colors.text }]}>{partner?.name || 'Partner'}</Text>
          <Text style={[styles.profileStatus, { color: statusColor }]}>
            {statusText}
          </Text>
        </View>

        {/* Settings Menu Items */}
        <View style={styles.section}>
          <SettingItem
            icon={<Bell size={20} color={colors.text} />}
            label="Notifications"
            value="On"
            onPress={() => {}}
            isLast
          />
        </View>

        <View style={styles.section}>
          <View style={styles.menuItem}>
            <MessageSquare size={20} color={colors.text} />
            <Text style={[styles.menuLabel, { color: colors.text }]}>Media, Links &amp; Docs</Text>
          </View>
          <View style={[styles.mediaCount, { backgroundColor: 'rgba(255,255,255,0.04)' }]}>
            <View style={styles.mediaCountItem}>
              <ImageIcon size={16} color={colors.gray} />
              <Text style={[styles.mediaLabel, { color: colors.gray }]}>Photos &amp; Videos</Text>
              <Text style={[styles.mediaValue, { color: colors.text }]}>0</Text>
            </View>
            <View style={styles.mediaCountItem}>
              <Link size={16} color={colors.gray} />
              <Text style={[styles.mediaLabel, { color: colors.gray }]}>Links</Text>
              <Text style={[styles.mediaValue, { color: colors.text }]}>0</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
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
        </View>
      </ScrollView>
    </View>
  );
};

// --- Sub-components ---

function SettingItem({ icon, label, value, onPress, isLast }: {
  icon: React.ReactNode; label: string; value: string; onPress: () => void; isLast?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.menuItem, !isLast && { borderBottomColor: 'rgba(255,255,255,0.06)' }]}>
      {icon}
      <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.settingValue, { color: colors.gray }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  scrollArea: { paddingHorizontal: 16, paddingTop: 20 },

  // Profile header
  profileHeader: { alignItems: 'center', marginBottom: 30, paddingBottom: 20 },
  profileAvatar: { width: 80, height: 80, marginBottom: 12 },
  profileName: { fontSize: 22, fontWeight: '700' },
  profileStatus: { fontSize: 14, marginTop: 4 },

  // Sections
  section: { marginBottom: 24 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '500', marginLeft: 14 },
  settingValue: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  menuItemLast: { borderBottomWidth: 0 },

  // Media counts
  mediaCount: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  mediaCountItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  mediaLabel: { flex: 1, fontSize: 15, marginLeft: 14 },
  mediaValue: { fontSize: 15 },
});
