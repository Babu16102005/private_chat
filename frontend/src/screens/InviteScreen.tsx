import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Linking, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { inviteService } from '../services/supabaseService';
import { handleError } from '../utils/errorHandler';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';

type InviteScreenRouteProp = RouteProp<RootStackParamList, 'Invite'>;

export const InviteScreen = () => {
  const navigation = useNavigation<any>();
  const { user, signOut, loading: authLoading } = useAuth();
  const route = useRoute<InviteScreenRouteProp>();
  const { colors } = useTheme();
  const [pairEmail, setPairEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (route.params?.token) { handleAcceptInvite(route.params.token); }
  }, [route.params?.token]);

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const { url } = event;
      if (url.includes('token=')) {
        const token = url.split('token=')[1];
        if (token) handleAcceptInvite(token);
      }
    };
    const sub = Linking.addEventListener('url', handleDeepLink);
    return () => { if (sub) sub.remove(); };
  }, []);

  const handleAcceptInvite = async (token: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const pair = await inviteService.acceptInvite(token);
      if (pair && user) {
        Alert.alert('Success!', 'Connected with your partner.');
        const partner = pair.user_a?.id === user.id ? pair.user_b : pair.user_a;
        navigation.replace('Chat', { pairId: pair.id, partner });
      } else { navigation.replace('Home'); }
    } catch (error: any) { handleError(error, 'Invite error'); }
    finally { setLoading(false); }
  };

  const sendInvite = async () => {
    if (!pairEmail.trim()) { handleError('Please enter your partner\'s email'); return; }
    setLoading(true);
    try {
      await inviteService.sendInvite(pairEmail);
      Alert.alert('Invite Sent!', `Invite link generated for ${pairEmail}.`);
      setPairEmail('');
      navigation.navigate('Home');
    } catch (error: any) { handleError(error, 'Failed to send invite'); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => { await signOut(); };

  if (authLoading || loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.subtitle, { marginTop: 20, color: colors.text }]}>Connecting...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backButton}><Text style={[styles.backIcon, { color: colors.primary }]}>←</Text></TouchableOpacity>
      <Text style={[styles.title, { color: colors.primary }]}>New Connection</Text>
      <Text style={[styles.subtitle, { color: colors.text }]}>Invite a partner to start a private chat.</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.white, borderColor: colors.lightGray, color: colors.text }]} placeholder="Enter partner's email" value={pairEmail} onChangeText={setPairEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.gray} />
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={sendInvite} disabled={loading}><Text style={styles.buttonText}>Send Chat Invite</Text></TouchableOpacity>
      <TouchableOpacity onPress={handleLogout}><Text style={[styles.switchText, { color: colors.gray }]}>Not your time? <Text style={[styles.link, { color: colors.primary }]}>Logout</Text></Text></TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 30 },
  backButton: { position: 'absolute', top: 60, left: 20 },
  backIcon: { fontSize: 30 },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 40 },
  input: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: 25, marginBottom: 20, fontSize: 16, borderWidth: 1 },
  button: { padding: 18, borderRadius: 25, alignItems: 'center', marginBottom: 25, ...Platform.select({ ios: { shadowColor: '#E91E63', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 }, android: { elevation: 8 }, web: { boxShadow: '0px 5px 10px rgba(233, 30, 99, 0.3)' } }) },
  buttonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 },
  switchText: { textAlign: 'center', fontSize: 14 },
  link: { fontWeight: 'bold' }
});
