import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Image, ScrollView, TextInput, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Edit3, Mail, User, Lock, Moon, Sun, LogOut, ChevronLeft, ShieldCheck, ArrowRight, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { profileService, storageService } from '../services/supabaseService';

const { height } = Dimensions.get('window');

export const ProfileScreen = ({ navigation }: any) => {
  const { user, signOut } = useAuth();
  const { themeMode, toggleTheme, colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [about, setAbout] = useState('Hey there! I am using kiba');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [aboutText, setAboutText] = useState('');
  const [nameText, setNameText] = useState('');

  const DEFAULT_ABOUT = 'Hey there! I am using kiba';

  useEffect(() => { if (user?.id) fetchProfile(); }, [user]);

  const fetchProfile = async () => {
    try {
      const profile = await profileService.getProfile(user!.id);
      if (profile) {
        if (profile.name) setName(profile.name);
        if (profile.about) setAbout(profile.about);
        if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
      }
    } catch (error) { console.error('Failed to fetch profile:', error); }
  };

  const updateProfile = async (nextName = nameText) => {
    if (!user?.id) return;
    const trimmedName = nextName.trim();
    if (!trimmedName) { Alert.alert('Error', 'Name cannot be empty'); return; }
    setLoading(true);
    try {
      await profileService.updateProfile(user.id, { name: trimmedName });
      setName(trimmedName);
      setShowNameModal(false);
      Alert.alert('Saved', 'Name updated');
    }
    catch (error: any) { Alert.alert('Error', error.message || 'Failed to update profile'); }
    finally { setLoading(false); }
  };

  const openNameEdit = () => {
    setNameText(name || user?.email?.split('@')[0] || '');
    setShowNameModal(true);
  };

  const pickAvatar = async () => {
    if (!user?.id || loading) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please allow photo access to update your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'image/jpeg';
      const ext = mimeType.includes('png') ? 'png' : 'jpg';
      const fileName = asset.fileName || `profile-avatar.${ext}`;

      setLoading(true);
      const uploadedUrl = await storageService.uploadFile({
        uri: asset.uri,
        name: fileName,
        type: mimeType,
      });
      await profileService.updateProfile(user.id, { avatar_url: uploadedUrl });
      setAvatarUrl(uploadedUrl);
      Alert.alert('Saved', 'Profile photo updated');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile photo');
    } finally {
      setLoading(false);
    }
  };

  const openAboutEdit = () => {
    setAboutText(about);
    setShowAboutModal(true);
  };

  const saveAbout = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await profileService.updateProfile(user.id, { about: aboutText.trim() || DEFAULT_ABOUT });
      setAbout(aboutText.trim() || DEFAULT_ABOUT);
      setShowAboutModal(false);
    } catch (error: any) { Alert.alert('Error', error.message || 'Failed to update about'); }
    finally { setLoading(false); }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim()) { Alert.alert('Error', 'Please enter a new password'); return; }
    if (newPassword.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const { authService } = await import('../services/supabaseService');
      await authService.updatePassword(newPassword);
      Alert.alert('Success', 'Password changed successfully');
      setNewPassword('');
    } catch (error: any) { Alert.alert('Error', error.message || 'Failed to change password'); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    try { await signOut(); }
    catch (error: any) { Alert.alert('Error', error.message || 'Failed to logout'); }
  };

  const avatarSeed = name || user?.email || 'User';
  const avatarSource = avatarUrl ? { uri: avatarUrl } : { uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}` };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={colors.gradientPrimary as any} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(185, 76, 255, 0.42)', 'transparent'] as any} style={[styles.glowBall, { top: -120, right: -90, width: 340, height: 340 }]} />
        <LinearGradient colors={['rgba(37, 214, 255, 0.2)', 'transparent'] as any} style={[styles.glowBall, { top: height * 0.34, left: -130, width: 300, height: 300 }]} />
        <LinearGradient colors={['rgba(255, 122, 92, 0.16)', 'transparent'] as any} style={[styles.glowBall, { bottom: -90, right: -80, width: 280, height: 280 }]} />
      </View>

      {/* Header */}
      <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.headerBar, { paddingTop: insets.top + 8, borderBottomColor: colors.glassBorder, borderBottomWidth: StyleSheet.hairlineWidth }]}> 
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { borderColor: colors.glassBorder }]}> 
          <ChevronLeft size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </BlurView>

      <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <BlurView intensity={colors.glassBlur + 10} tint="dark" style={[styles.profileCard, { borderColor: 'rgba(255,255,255,0.16)' }]}> 
          <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(115,55,185,0.22)', 'rgba(10,2,28,0.52)'] as any} style={StyleSheet.absoluteFill} />
          <View style={styles.frostFill} />
          <View style={styles.profileTop}>
            <TouchableOpacity activeOpacity={0.8} onPress={pickAvatar} style={styles.avatarButton}>
              <Image
                source={avatarSource}
                style={[styles.profileAvatar, { borderRadius: colors.radius.pill, borderColor: colors.glassBorder }]}
              />
              <View style={[styles.avatarEditBadge, { backgroundColor: colors.primary }]}>
                <Camera size={14} color="white" />
              </View>
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
                {name || user?.email || 'User'}
              </Text>
              {/* WhatsApp-style About / Status */}
              <View style={styles.aboutRow}>
                <Text style={[styles.profileAbout, { color: colors.gray }]} numberOfLines={1}>
                  {about}
                </Text>
                <TouchableOpacity onPress={openAboutEdit}>
                  <Edit3 size={12} color={colors.gray} />
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity onPress={openNameEdit}>
              <ArrowRight size={18} color={colors.gray} />
            </TouchableOpacity>
          </View>
        </BlurView>

        {/* Settings sections */}
        <SettingSection label="Account">
          <SettingItem icon={<User size={20} color={colors.text} />} label="Name" value={name || 'Set your name'} onPress={openNameEdit} />
          <SettingItem icon={<Mail size={20} color={colors.text} />} label="Email" value={user?.email || ''} onPress={() => {}} isLast />
        </SettingSection>

        <SettingSection label="Appearance">
          <TouchableOpacity style={styles.menuItem} onPress={toggleTheme}>
            <View style={[styles.iconBox, { backgroundColor: themeMode === 'obsidian' ? 'rgba(125, 92, 255, 0.15)' : 'rgba(255, 107, 74, 0.15)' }]}>
              {themeMode === 'obsidian' ? <Moon size={20} color={colors.primary} /> : <Sun size={20} color={colors.primary} />}
            </View>
            <Text style={[styles.menuLabel, { color: colors.text }]}>{themeMode === 'obsidian' ? 'Obsidian' : 'Mocha'} Theme</Text>
            <View style={styles.toggleBackground}>
              <View style={[styles.toggleKnob, { transform: [{ translateX: themeMode === 'obsidian' ? 18 : 0 }] }]} />
            </View>
          </TouchableOpacity>
        </SettingSection>

        <SettingSection label="Security">
          <View style={styles.securityCard}>
            <View style={styles.inputRow}>
              <ShieldCheck size={20} color={colors.gray} />
              <Text style={[styles.inputLabel, { color: colors.gray }]}>Change Password</Text>
            </View>
            <View style={[styles.passwordInputWrap, { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, borderColor: colors.glassBorder }]}> 
              <Lock size={18} color={colors.gray} style={{ marginRight: 10 }} />
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                placeholder="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholderTextColor={colors.gray}
              />
            </View>
            <TouchableOpacity
              style={[styles.updatePwdBtn, { borderRadius: 20, borderColor: colors.glassBorder, opacity: newPassword.length < 6 || loading ? 0.5 : 1 }]}
              onPress={handleChangePassword}
              disabled={newPassword.length < 6 || loading}
            >
              <LinearGradient colors={colors.gradientSecondary as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profileButtonGradient}>
                <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }} style={styles.buttonShine} />
                <Text style={[styles.updatePwdText, { color: loading ? colors.gray : colors.text }]}> 
                  {loading ? 'Updating...' : 'Update Password'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SettingSection>

        <View style={{ height: 30 }} />

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={20} color="#FF4B4B" />
          <Text style={[styles.logoutTxt, { color: '#FF4B4B' }]}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit About Modal */}
      <Modal visible={showNameModal} transparent animationType="fade" onRequestClose={() => setShowNameModal(false)}>
        <View style={styles.modalOverlay}>
          <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.modalContent, { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: colors.glassBorder }]}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Name</Text>
              <TouchableOpacity onPress={() => setShowNameModal(false)}>
                <X size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.aboutInput, { color: colors.text, borderColor: colors.glassBorder, backgroundColor: 'rgba(255,255,255,0.08)' }]}
              placeholder="Your name"
              placeholderTextColor={colors.gray}
              value={nameText}
              onChangeText={setNameText}
              maxLength={40}
              autoFocus
            />
            <Text style={[styles.charCount, { color: colors.gray }]}>{nameText.length}/40</Text>
            <TouchableOpacity style={[styles.modalSaveBtn, { borderColor: colors.glassBorder, opacity: loading ? 0.5 : 1 }]} onPress={() => updateProfile()} disabled={loading}>
              <LinearGradient colors={colors.gradientSecondary as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profileButtonGradient}>
                <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }} style={styles.buttonShine} />
                <Text style={styles.modalSaveText}>{loading ? 'Saving...' : 'Save'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </BlurView>
        </View>
      </Modal>

      <Modal visible={showAboutModal} transparent animationType="fade" onRequestClose={() => setShowAboutModal(false)}>
        <View style={styles.modalOverlay}>
          <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.modalContent, { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: colors.glassBorder }]}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>About</Text>
              <TouchableOpacity onPress={() => setShowAboutModal(false)}>
                <X size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.aboutInput, { color: colors.text, borderColor: colors.glassBorder, backgroundColor: 'rgba(255,255,255,0.08)' }]}
              placeholder="type your status..."
              placeholderTextColor={colors.gray}
              value={aboutText}
              onChangeText={setAboutText}
              maxLength={139}
              autoFocus
            />
            <Text style={[styles.charCount, { color: colors.gray }]}>{aboutText.length}/139</Text>
            <TouchableOpacity style={[styles.modalSaveBtn, { borderColor: colors.glassBorder, opacity: loading ? 0.5 : 1 }]} onPress={saveAbout} disabled={loading}>
              <LinearGradient colors={colors.gradientSecondary as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profileButtonGradient}>
                <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }} style={styles.buttonShine} />
                <Text style={styles.modalSaveText}>{loading ? 'Saving...' : 'Save'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
};

// --- Sub-components ---

function SettingSection({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors, isDark } = useTheme();
  return (
    <View style={{ marginBottom: 28 }}>
      <Text style={[styles.sectionLabel, { color: colors.gray }]}>{label}</Text>
      <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.sectionGroup, { backgroundColor: 'rgba(255,255,255,0.075)', borderColor: colors.glassBorder }]}> 
        {children}
      </BlurView>
    </View>
  );
}

function SettingItem({ icon, label, value, onPress, isLast }: {
  icon: React.ReactNode; label: string; value: string; onPress: () => void; isLast?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.settingItem, !isLast && { borderBottomColor: 'rgba(255,255,255,0.06)' }]}
      onPress={onPress}
    >
      {icon}
      <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.settingValue, { color: colors.gray }]} numberOfLines={1}>{value}</Text>
      <ChevronLeft size={18} color={colors.gray} style={{ transform: [{ rotate: '180deg' }] }} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  glowBall: { position: 'absolute', borderRadius: 180, overflow: 'hidden' },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  backBtn: { width: 40, height: 40, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  scrollArea: { paddingHorizontal: 16, paddingTop: 16 },

  // Profile card
  profileCard: { padding: 18, borderRadius: 34, marginBottom: 28, overflow: 'hidden', backgroundColor: 'rgba(18,7,42,0.58)', borderWidth: 1, shadowColor: '#B94CFF', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.32, shadowRadius: 36, elevation: 10 },
  frostFill: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(110,42,190,0.08)' },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarButton: { position: 'relative', borderRadius: 38, padding: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', shadowColor: '#B94CFF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 5 },
  profileAvatar: { width: 66, height: 66, borderWidth: StyleSheet.hairlineWidth },
  avatarEditBadge: { position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', shadowColor: '#B94CFF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 19, fontWeight: '800', letterSpacing: 0.2 },
  profileEmail: { fontSize: 13, marginTop: 2 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  profileAbout: { fontSize: 13, flex: 1 },

  // Sections
  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8, marginLeft: 8, opacity: 0.7 },
  sectionGroup: { borderRadius: 24, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 22, elevation: 4 },
  settingItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  settingLabel: { flex: 1, fontSize: 16, fontWeight: '500', marginLeft: 14 },
  settingValue: { fontSize: 13, marginRight: 6, maxWidth: 140, textAlign: 'right' },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },

  // Toggle
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
  toggleBackground: { width: 42, height: 22, borderRadius: 11, justifyContent: 'center', paddingHorizontal: 2 },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF' },

  // Security
  securityCard: { borderRadius: 20, padding: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  inputLabel: { fontSize: 15, fontWeight: '500', marginLeft: 10 },
  passwordInputWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 46, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth },
  passwordInput: { flex: 1, fontSize: 15, fontWeight: '400' },
  updatePwdBtn: { height: 46, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },
  profileButtonGradient: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  buttonShine: { position: 'absolute', top: 1, left: 8, right: 8, height: 18, borderRadius: 999, opacity: 0.34 },
  updatePwdText: { fontSize: 15, fontWeight: '600' },

  // Logout
  logoutBtn: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, paddingVertical: 14, borderRadius: 22, backgroundColor: 'rgba(255,75,75,0.1)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,75,75,0.28)' },
  logoutTxt: { fontSize: 16, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '84%', borderRadius: 24, padding: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  aboutInput: { fontSize: 15, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 44, textAlignVertical: 'top' },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 6 },
  modalSaveBtn: { borderRadius: 20, height: 48, marginTop: 16, alignItems: 'center', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },
  modalSaveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
