import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
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
      <Text style={[styles.title, { color: colors.primary }]}>Your Profile</Text>
      <Text style={[styles.label, { color: colors.gray }]}>Display Name</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.white, borderColor: colors.lightGray, color: colors.text }]} placeholder="Display Name" value={name} onChangeText={setName} placeholderTextColor={colors.gray} />
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={updateProfile} disabled={loading}><Text style={styles.buttonText}>Save Changes</Text></TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: colors.lightGray }]} />

      <Text style={[styles.label, { color: colors.gray }]}>Dark Mode</Text>
      <TouchableOpacity style={[styles.button, { backgroundColor: isDark ? '#4CAF50' : colors.gray }]} onPress={toggleTheme}>
        <Text style={styles.buttonText}>{isDark ? '🌙 Dark Mode On' : '☀️ Switch to Dark'}</Text>
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: colors.lightGray }]} />

      <Text style={[styles.label, { color: colors.gray }]}>Change Password</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.white, borderColor: colors.lightGray, color: colors.text }]} placeholder="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholderTextColor={colors.gray} />
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.secondary }]} onPress={handleChangePassword} disabled={loading}><Text style={styles.buttonText}>Update Password</Text></TouchableOpacity>
      
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.text, marginTop: 10 }]} onPress={handleLogout}><Text style={styles.buttonText}>Logout</Text></TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}><Text style={[styles.switchText, { color: colors.primary }]}>Back to Chat</Text></TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 30 },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 40 },
  input: { padding: 15, borderRadius: 25, marginBottom: 15, borderWidth: 1, fontSize: 16 },
  button: { padding: 18, borderRadius: 25, alignItems: 'center', marginBottom: 15, ...Platform.select({ ios: { shadowColor: '#E91E63', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 }, android: { elevation: 8 }, web: { boxShadow: '0px 5px 10px rgba(233, 30, 99, 0.3)' } }) },
  logoutButton: { marginTop: 10 },
  passwordButton: { marginBottom: 10 },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, marginLeft: 10 },
  divider: { height: 1, marginVertical: 20 },
  buttonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  switchText: { textAlign: 'center', fontWeight: 'bold' }
});
