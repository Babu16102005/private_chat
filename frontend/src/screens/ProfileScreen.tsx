import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Image, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Edit3, Mail, User, Lock, Moon, Sun, LogOut, ChevronLeft, ShieldCheck, ArrowRight, X } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { profileService } from '../services/supabaseService';

export const ProfileScreen = ({ navigation }: any) => {
  const { user, signOut } = useAuth();
  const { themeMode, toggleTheme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [about, setAbout] = useState('Hey there! I am using CoupleChat');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [aboutText, setAboutText] = useState('');

  const DEFAULT_ABOUT = 'Hey there! I am using CoupleChat';

  useEffect(() => { if (user?.id) fetchProfile(); }, [user]);

  const fetchProfile = async () => {
    try {
      const profile = await profileService.getProfile(user!.id);
      if (profile) {
        if (profile.name) setName(profile.name);
        if (profile.about) setAbout(profile.about);
      }
    } catch (error) { console.error('Failed to fetch profile:', error); }
  };

  const updateProfile = async () => {
    if (!user?.id) return;
    if (!name.trim()) { Alert.alert('Error', 'Name cannot be empty'); return; }
    setLoading(true);
    try { await profileService.updateProfile(user.id, { name }); Alert.alert('Saved', 'Profile updated'); }
    catch (error: any) { Alert.alert('Error', error.message || 'Failed to update profile'); }
    finally { setLoading(false); }
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8, borderBottomColor: colors.glassBorder, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <Image
              source={{ uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}` }}
              style={[styles.profileAvatar, { borderRadius: colors.radius.pill }]}
            />
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
            <TouchableOpacity onPress={() => {}}>
              <ArrowRight size={18} color={colors.gray} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings sections */}
        <SettingSection label="Account">
          <SettingItem icon={<User size={20} color={colors.text} />} label="Name" value={name || 'Set your name'} onPress={() => {}} />
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
            <View style={[styles.passwordInputWrap, { backgroundColor: 'rgba(128,128,128,0.06)', borderRadius: 12 }]}>
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
              style={[styles.updatePwdBtn, { borderRadius: 12, opacity: newPassword.length < 6 || loading ? 0.5 : 1 }]}
              onPress={handleChangePassword}
              disabled={newPassword.length < 6 || loading}
            >
              <Text style={[styles.updatePwdText, { color: loading ? colors.gray : colors.text }]}>
                {loading ? 'Updating...' : 'Update Password'}
              </Text>
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
      <Modal visible={showAboutModal} transparent animationType="fade" onRequestClose={() => setShowAboutModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.glassBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>About</Text>
              <TouchableOpacity onPress={() => setShowAboutModal(false)}>
                <X size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.aboutInput, { color: colors.text, borderColor: colors.glassBorder }]}
              placeholder="type your status..."
              placeholderTextColor={colors.gray}
              value={aboutText}
              onChangeText={setAboutText}
              maxLength={139}
              autoFocus
            />
            <Text style={[styles.charCount, { color: colors.gray }]}>{aboutText.length}/139</Text>
            <TouchableOpacity style={[styles.modalSaveBtn, { backgroundColor: colors.primary, opacity: loading ? 0.5 : 1 }]} onPress={saveAbout} disabled={loading}>
              <Text style={styles.modalSaveText}>{loading ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// --- Sub-components ---

function SettingSection({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 28 }}>
      <Text style={[styles.sectionLabel, { color: colors.gray }]}>{label}</Text>
      <View style={[styles.sectionGroup, { backgroundColor: 'rgba(255,255,255,0.04)' }]}>
        {children}
      </View>
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
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  scrollArea: { paddingHorizontal: 16, paddingTop: 16 },

  // Profile card
  profileCard: { padding: 16, borderRadius: 16, marginBottom: 28 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileAvatar: { width: 60, height: 60 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700' },
  profileEmail: { fontSize: 13, marginTop: 2 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  profileAbout: { fontSize: 13, flex: 1 },

  // Sections
  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8, marginLeft: 8, opacity: 0.7 },
  sectionGroup: { borderRadius: 14, overflow: 'hidden' },
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
  securityCard: { borderRadius: 14, padding: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  inputLabel: { fontSize: 15, fontWeight: '500', marginLeft: 10 },
  passwordInputWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 46, marginBottom: 12 },
  passwordInput: { flex: 1, fontSize: 15, fontWeight: '400' },
  updatePwdBtn: { height: 46, alignItems: 'center', justifyContent: 'center' },
  updatePwdText: { fontSize: 15, fontWeight: '600' },

  // Logout
  logoutBtn: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  logoutTxt: { fontSize: 16, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', borderRadius: 20, padding: 20, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  aboutInput: { fontSize: 15, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 44, textAlignVertical: 'top' },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 6 },
  modalSaveBtn: { borderRadius: 12, paddingVertical: 14, marginTop: 16, alignItems: 'center' },
  modalSaveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
