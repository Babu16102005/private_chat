import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Lock, Moon, Sun, LogOut, ChevronRight, ChevronLeft, Save, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { profileService } from '../services/supabaseService';

export const ProfileScreen = ({ navigation }: any) => {
  const { user, signOut } = useAuth();
  const { isDark, toggleTheme, colors } = useTheme();
  const [name, setName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user?.id) fetchProfile(); }, [user]);

  const fetchProfile = async () => {
    try {
      const profile = await profileService.getProfile(user!.id);
      if (profile && profile.name) setName(profile.name);
    } catch (error) { console.error('Failed to fetch profile:', error); }
  };

  const updateProfile = async () => {
    if (!user?.id) return;
    setLoading(true);
    try { await profileService.updateProfile(user.id, { name }); Alert.alert('Success', 'Profile updated'); }
    catch (error: any) { Alert.alert('Error', error.message || 'Failed to update profile'); }
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerArea}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={32} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.gray }]}>Profile Information</Text>
          <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.glassBorder, borderWidth: colors.borderWidth, borderRadius: colors.radius.card }]}>
            <View style={styles.inputFieldRow}>
              <User size={20} color={colors.gray} />
              <TextInput style={[styles.input, { color: colors.text }]} placeholder="Full Name" value={name} onChangeText={setName} placeholderTextColor={colors.gray} />
            </View>
            <TouchableOpacity style={[styles.saveBtn, { borderRadius: 16 }]} onPress={updateProfile} disabled={loading}>
              <LinearGradient colors={colors.gradientPrimary as any} style={styles.btnGrad}>
                <Save size={18} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.btnTxt}>Save Changes</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.gray }]}>App Experience</Text>
          <TouchableOpacity 
            style={[styles.card, { backgroundColor: colors.white, borderColor: colors.glassBorder, borderWidth: colors.borderWidth, borderRadius: colors.radius.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} 
            onPress={toggleTheme}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(168, 85, 247, 0.1)' : 'rgba(124, 58, 237, 0.05)' }]}>
                {isDark ? <Moon size={20} color={colors.primary} /> : <Sun size={20} color={colors.primary} />}
              </View>
              <Text style={[styles.themeLabel, { color: colors.text }]}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
            </View>
            <View style={[styles.toggleBackground, { backgroundColor: isDark ? colors.primary : colors.lightGray }]}>
              <View style={[styles.toggleCircle, { transform: [{ translateX: isDark ? 20 : 0 }] }]} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.gray }]}>Privacy & Security</Text>
          <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.glassBorder, borderWidth: colors.borderWidth, borderRadius: colors.radius.card }]}>
            <View style={styles.inputFieldRow}>
              <ShieldCheck size={20} color={colors.gray} />
              <TextInput style={[styles.input, { color: colors.text }]} placeholder="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholderTextColor={colors.gray} />
            </View>
            <TouchableOpacity style={[styles.saveBtn, { borderRadius: 16 }]} onPress={handleChangePassword} disabled={loading}>
              <LinearGradient colors={colors.gradientSecondary as any} style={styles.btnGrad}>
                <Lock size={18} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.btnTxt}>Update Password</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
        
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={20} color="#FF4B4B" style={{ marginRight: 10 }} />
          <Text style={[styles.logoutTxt, { color: '#FF4B4B' }]}>Logout Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerArea: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 50 : 20, paddingBottom: 10 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginLeft: -10 },
  title: { fontSize: 24, fontWeight: '800', marginLeft: 5 },
  scrollArea: { paddingHorizontal: 25, paddingVertical: 20 },
  section: { marginBottom: 30 },
  sectionLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 12, marginLeft: 5 },
  card: { padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  inputFieldRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', marginBottom: 20, paddingBottom: 5 },
  input: { flex: 1, fontSize: 16, fontWeight: '600', paddingVertical: 10, marginLeft: 15 },
  saveBtn: { height: 50, overflow: 'hidden' },
  btnGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  btnTxt: { color: 'white', fontWeight: 'bold' },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  themeLabel: { fontSize: 16, fontWeight: '600' },
  toggleBackground: { width: 44, height: 24, borderRadius: 12, padding: 2 },
  toggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'white' },
  logoutBtn: { marginVertical: 40, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  logoutTxt: { fontSize: 16, fontWeight: 'bold' }
});
