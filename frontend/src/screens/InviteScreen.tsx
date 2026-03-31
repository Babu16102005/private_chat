import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Linking, Platform, ActivityIndicator, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, UserPlus, Mail } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { inviteService } from '../services/supabaseService';
import { handleError } from '../utils/errorHandler';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';

const { width, height } = Dimensions.get('window');

type InviteScreenRouteProp = RouteProp<RootStackParamList, 'Invite'>;

export const InviteScreen = () => {
  const navigation = useNavigation<any>();
  const { user, signOut, loading: authLoading } = useAuth();
  const route = useRoute<InviteScreenRouteProp>();
  const { colors, isDark } = useTheme();
  const [pairEmail, setPairEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (route.params?.token) { handleAcceptInvite(route.params.token); } }, [route.params?.token]);

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

  const renderBackgroundGlows = () => (
    <View style={styles.glowOverlay}>
      <LinearGradient colors={['rgba(210, 118, 25, 0.2)', 'transparent'] as any} style={[styles.glowBall, { top: -50, left: -100, width: 400, height: 400 }]} />
      <LinearGradient colors={['rgba(210, 118, 25, 0.1)', 'transparent'] as any} style={[styles.glowBall, { bottom: 100, right: -100, width: 350, height: 350 }]} />
    </View>
  );

  if (authLoading || loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderBackgroundGlows()}
      
      <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backBtn}>
        <ArrowLeft size={30} color={colors.text} strokeWidth={2.5} />
      </TouchableOpacity>

      <View style={styles.content}>
        <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.iconBox, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth, borderRadius: 28 }]}>
          <UserPlus size={40} color={colors.primary} strokeWidth={2} />
        </BlurView>
        
        <Text style={[styles.title, { color: colors.text }]}>New Chat</Text>
        <Text style={[styles.subtitle, { color: colors.gray }]}>Invite your partner to start a private, secure conversation.</Text>
        
        <View style={[styles.inputGroup, { backgroundColor: colors.white, borderColor: colors.glassBorder, borderWidth: colors.borderWidth, borderRadius: colors.radius.card }]}>
          <Mail size={20} color={colors.gray} style={{ marginRight: 15 }} />
          <TextInput style={[styles.input, { color: colors.text }]} placeholder="Partner Email Address" value={pairEmail} onChangeText={setPairEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.gray} />
        </View>

        <TouchableOpacity style={[styles.button, { borderRadius: colors.radius.card }]} onPress={sendInvite} disabled={loading}>
          <LinearGradient colors={colors.gradientPrimary as any} style={styles.btnGrad}>
            <Text style={styles.buttonText}>Send Invite</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => signOut()} style={styles.signOutBtn}>
          <Text style={[styles.signOutTxt, { color: colors.gray }]}>Logout Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 30 },
  glowOverlay: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  glowBall: { position: 'absolute', borderRadius: 200 },
  backBtn: { position: 'absolute', top: 60, left: 20, zIndex: 10, width: 44, height: 44, justifyContent: 'center' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconBox: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center', marginBottom: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4, overflow: 'hidden' },
  title: { fontSize: 34, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 40, fontWeight: '600', paddingHorizontal: 15 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 60, marginBottom: 20, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  input: { flex: 1, fontSize: 16, fontWeight: '600' },
  button: { width: '100%', height: 60, overflow: 'hidden', elevation: 8, shadowColor: '#D27619', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, marginTop: 10 },
  btnGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 },
  signOutBtn: { marginTop: 35 },
  signOutTxt: { fontSize: 14, fontWeight: '700' }
});
