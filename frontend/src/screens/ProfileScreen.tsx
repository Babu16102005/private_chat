import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Image, ScrollView, TextInput, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Edit3, Mail, User, Lock, Palette, LogOut, ChevronLeft, ShieldCheck, ArrowRight, X, Download } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLock } from '../context/LockContext';
import { profileService, storageService } from '../services/supabaseService';

export const ProfileScreen = ({ navigation }: any) => {
  const { user, signOut } = useAuth();
  const { themeMode, toggleTheme, colors, isDark } = useTheme();
  const { isPinEnabled, setPin, disablePin } = useLock();
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
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinText, setPinText] = useState('');

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
    setLoading(true);
    try { await signOut(); }
    catch (error: any) { Alert.alert('Error', error.message || 'Failed to logout'); }
    finally { setLoading(false); }
  };

  const savePin = async () => {
    if (!/^\d{4}$/.test(pinText)) {
      Alert.alert('PIN required', 'Enter exactly 4 digits.');
      return;
    }
    await setPin(pinText);
    setPinText('');
    setShowPinModal(false);
    Alert.alert('App lock enabled', 'Kiba will ask for this PIN when you open the app.');
  };

  const togglePinLock = async () => {
    if (isPinEnabled) {
      Alert.alert('Disable app lock?', 'Kiba will stop asking for your PIN.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disable', style: 'destructive', onPress: disablePin },
      ]);
      return;
    }
    setShowPinModal(true);
  };

  const avatarSeed = name || user?.email || 'User';
  const avatarSource = avatarUrl ? { uri: avatarUrl } : { uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}` };

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
      <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.headerBar, { paddingTop: insets.top + 8 }]}> 
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { borderColor: colors.glassBorder }]}> 
          <ChevronLeft size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </BlurView>

      <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
          <BlurView intensity={colors.glassBlur + 14} tint={isDark ? 'dark' : 'light'} style={[styles.profileCard, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
          <LinearGradient colors={isDark ? ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.02)'] as any : ['rgba(48,80,113,0.12)', 'rgba(48,80,113,0.04)'] as any} style={StyleSheet.absoluteFill} />
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
            <View style={[styles.iconBox, { backgroundColor: themeMode === 'obsidian' ? 'rgba(233, 199, 255, 0.18)' : 'rgba(255, 122, 92, 0.18)' }]}> 
              <Palette size={20} color={colors.primary} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.text }]}>{themeMode === 'obsidian' ? 'Obsidian' : 'Mocha'} Theme</Text>
            <View style={[styles.themeSwitch, { borderColor: colors.glassBorder }]}> 
              <LinearGradient colors={colors.gradientSecondary as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <View style={[styles.themeSwitchKnob, { transform: [{ translateX: themeMode === 'obsidian' ? 0 : 18 }] }]} />
            </View>
          </TouchableOpacity>
        </SettingSection>

        <SettingSection label="Security">
          <SettingItem icon={<Lock size={20} color={colors.text} />} label="4-digit App Lock" value={isPinEnabled ? 'Enabled' : 'Off'} onPress={togglePinLock} />
          <View style={styles.securityCard}>
            <View style={styles.inputRow}>
              <ShieldCheck size={20} color={colors.gray} />
              <Text style={[styles.inputLabel, { color: colors.gray }]}>Change Password</Text>
            </View>
            <View style={[styles.passwordInputWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(48,80,113,0.09)', borderRadius: 16, borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
              <Lock size={18} color={colors.gray} style={{ marginRight: 10 }} />
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                placeholder="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                underlineColorAndroid="transparent"
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

        <SettingSection label="Developer">
          <SettingItem 
            icon={<Download size={20} color={colors.text} />} 
            label="Download Resume" 
            value="View PDF" 
            onPress={() => Linking.openURL('https://drive.google.com/file/d/1mBN6ajP7a70U85v5MIuyLdBpkZiiFoFe/view?usp=drive_link')} 
            isLast 
          />
        </SettingSection>

        <View style={{ height: 30 }} />

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={20} color="#FF4B4B" />
          <Text style={[styles.logoutTxt, { color: '#FF4B4B' }]}>{loading ? 'Logging out...' : 'Log Out'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit About Modal */}
      <Modal visible={showNameModal} transparent animationType="fade" onRequestClose={() => setShowNameModal(false)}>
        <View style={styles.modalOverlay}>
          <BlurView intensity={colors.glassBlur + 16} tint={isDark ? 'dark' : 'light'} style={[styles.modalContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(48,80,113,0.08)', borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Name</Text>
              <TouchableOpacity onPress={() => setShowNameModal(false)}>
                <X size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.aboutInput, { color: colors.text, borderColor: colors.glassBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(48,80,113,0.09)', borderWidth: colors.borderWidth }]}
              placeholder="Your name"
              placeholderTextColor={colors.gray}
              value={nameText}
              onChangeText={setNameText}
              maxLength={40}
              autoFocus
              underlineColorAndroid="transparent"
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
          <BlurView intensity={colors.glassBlur + 16} tint={isDark ? 'dark' : 'light'} style={[styles.modalContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(48,80,113,0.08)', borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>About</Text>
              <TouchableOpacity onPress={() => setShowAboutModal(false)}>
                <X size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.aboutInput, { color: colors.text, borderColor: colors.glassBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(48,80,113,0.12)' }]}
              placeholder="type your status..."
              placeholderTextColor={colors.gray}
              value={aboutText}
              onChangeText={setAboutText}
              maxLength={139}
              autoFocus
              underlineColorAndroid="transparent"
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

      <Modal visible={showPinModal} transparent animationType="fade" onRequestClose={() => setShowPinModal(false)}>
        <View style={styles.modalOverlay}>
          <BlurView intensity={colors.glassBlur + 16} tint={isDark ? 'dark' : 'light'} style={[styles.modalContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(48,80,113,0.08)', borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Set App PIN</Text>
              <TouchableOpacity onPress={() => setShowPinModal(false)}>
                <X size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.aboutInput, { color: colors.text, borderColor: colors.glassBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(48,80,113,0.09)', borderWidth: colors.borderWidth, textAlign: 'center', fontSize: 28, letterSpacing: 10 }]}
              placeholder="0000"
              placeholderTextColor={colors.gray}
              value={pinText}
              onChangeText={(value) => setPinText(value.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              autoFocus
              underlineColorAndroid="transparent"
            />
            <TouchableOpacity style={[styles.modalSaveBtn, { borderColor: colors.glassBorder }]} onPress={savePin}>
              <LinearGradient colors={colors.gradientSecondary as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profileButtonGradient}>
                <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }} style={styles.buttonShine} />
                <Text style={styles.modalSaveText}>Enable Lock</Text>
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
      <BlurView intensity={colors.glassBlur + 14} tint={isDark ? 'dark' : 'light'} style={[styles.sectionGroup, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(48,80,113,0.08)', borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
        {children}
      </BlurView>
    </View>
  );
}

function SettingItem({ icon, label, value, onPress, isLast }: {
  icon: React.ReactNode; label: string; value: string; onPress: () => void; isLast?: boolean;
}) {
  const { colors, isDark } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.settingItem, !isLast && { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(48,80,113,0.12)' }]}
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
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, justifyContent: 'space-between', overflow: 'hidden' },
  backBtn: { width: 40, height: 40, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(128,128,128,0.1)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  scrollArea: { paddingHorizontal: 16, paddingTop: 16 },

  // Profile card
  profileCard: { padding: 18, borderRadius: 34, marginBottom: 28, overflow: 'hidden' },
  frostFill: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarButton: { position: 'relative', borderRadius: 38, padding: 4, backgroundColor: 'rgba(48,80,113,0.08)', borderWidth: 0.5, borderColor: 'rgba(48,80,113,0.18)' },
  profileAvatar: { width: 66, height: 66 },
  avatarEditBadge: { position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.24, shadowRadius: 10, elevation: 5 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 19, fontWeight: '800', letterSpacing: 0.2 },
  profileEmail: { fontSize: 13, marginTop: 2 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  profileAbout: { fontSize: 13, flex: 1 },

  // Sections
  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8, marginLeft: 8, opacity: 0.7 },
  sectionGroup: { borderRadius: 24, overflow: 'hidden' },
  settingItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  settingLabel: { flex: 1, fontSize: 16, fontWeight: '500', marginLeft: 14 },
  settingValue: { fontSize: 13, marginRight: 6, maxWidth: 140, textAlign: 'right' },
  iconBox: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 14 },

  // Toggle
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
  themeSwitch: { width: 46, height: 26, borderRadius: 13, borderWidth: 0.5, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(48,80,113,0.09)' },
  themeSwitchKnob: { position: 'absolute', left: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', zIndex: 1 },

  // Security
  securityCard: { borderRadius: 20, padding: 16, backgroundColor: 'rgba(48,80,113,0.08)' },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  inputLabel: { fontSize: 15, fontWeight: '500', marginLeft: 10 },
  passwordInputWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 46, marginBottom: 12 },
  passwordInput: { flex: 1, fontSize: 15, fontWeight: '400' },
  updatePwdBtn: { height: 46, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 0.5, backgroundColor: 'rgba(48,80,113,0.09)' },
  profileButtonGradient: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  buttonShine: { position: 'absolute', top: 1, left: 8, right: 8, height: 18, borderRadius: 999, opacity: 0.34 },
  updatePwdText: { fontSize: 15, fontWeight: '600' },

  // Logout
  logoutBtn: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, paddingVertical: 14, borderRadius: 22, backgroundColor: 'rgba(255,75,75,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,75,75,0.2)' },
  logoutTxt: { fontSize: 16, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '84%', borderRadius: 24, padding: 20, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  aboutInput: { fontSize: 15, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 44, textAlignVertical: 'top' },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 6 },
  modalSaveBtn: { borderRadius: 20, height: 48, marginTop: 16, alignItems: 'center', overflow: 'hidden', borderWidth: 0.5, backgroundColor: 'rgba(48,80,113,0.09)' },
  modalSaveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
