import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ArrowLeft, UserPlus, Mail } from 'lucide-react-native';
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
  const { colors, isDark } = useTheme();
  const [pairEmail, setPairEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAcceptInvite = async (token: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const pair = await inviteService.acceptInvite(token);
      if (pair && user) {
        Alert.alert('Connected!', 'You are now paired with your partner.');
        const partner = pair.user_a?.id === user.id ? pair.user_b : pair.user_a;
        navigation.replace('Chat', { pairId: pair.id, partner });
      } else { navigation.replace('Home'); }
    } catch (error: any) { handleError(error, 'Invite error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (route.params?.token) { handleAcceptInvite(route.params.token); } }, []);

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

  const sendInvite = async () => {
    if (!pairEmail.trim()) { handleError('Please enter your partner\'s email'); return; }
    setLoading(true);
    try {
      await inviteService.sendInvite(pairEmail);
      Alert.alert('Invite Sent!', `Your partner will receive an invite at ${pairEmail}.`);
      navigation.navigate('Home');
    } catch (error: any) { handleError(error, 'Failed to send invite'); }
    finally { setLoading(false); }
  };

  if (authLoading || loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={colors.gradientPrimary as any} start={{ x: 0.08, y: 0 }} end={{ x: 0.95, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(100,243,255,0.12)', 'rgba(233,199,255,0.07)', 'transparent'] as any} start={{ x: 1, y: 0 }} end={{ x: 0.18, y: 0.76 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['transparent', 'rgba(141,255,213,0.08)', 'rgba(5,7,18,0.22)'] as any} start={{ x: 0, y: 0.25 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </View>

      {/* Header */}
      <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={[styles.backBtn, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
          <ArrowLeft size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.text }]}>New Chat</Text>
        <View style={{ width: 40 }} />
      </BlurView>

      <View style={styles.content}>
        <BlurView intensity={colors.glassBlur + 16} tint="dark" style={[styles.glassPanel, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
          <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)'] as any} style={StyleSheet.absoluteFill} />
          <View style={styles.frostFill} />
          <View style={styles.iconWrap}>
          <View style={[styles.iconCircle, { borderColor: 'rgba(255,255,255,0.14)' }]}> 
            <UserPlus size={36} color={colors.primary} strokeWidth={1.5} />
          </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>Invite your partner</Text>
          <Text style={[styles.subtitle, { color: colors.gray }]}> 
            Send an invite to your partner with their email address. Once they accept, you&apos;ll be connected in a private chat.
          </Text>

        <BlurView intensity={colors.glassBlur + 18} tint="dark" style={[styles.inputWrap, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: colors.glassBorder, borderRadius: 24, borderWidth: colors.borderWidth }]}> 
          <Mail size={20} color={colors.gray} style={{ marginRight: 12 }} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Partner's email address"
            value={pairEmail}
            onChangeText={setPairEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={colors.gray}
          />
        </BlurView>

        <TouchableOpacity style={[styles.inviteBtn, { borderRadius: 22, borderColor: 'rgba(255,255,255,0.16)' }]} onPress={sendInvite} disabled={loading}>
          <LinearGradient colors={colors.gradientSecondary as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.inviteGrad}>
            <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }} style={styles.buttonShine} />
            <Text style={styles.btnText}>
              {loading ? 'Sending Invite...' : 'Send Invite'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        </BlurView>

        <TouchableOpacity onPress={() => signOut()} style={styles.signOutBtn}>
          <Text style={[styles.signOutText, { color: colors.gray }]}>
            or <Text style={{ color: '#FF4B4B', fontWeight: '600' }}>Sign Out</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  backBtn: { width: 40, height: 40, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5 },
  topBarTitle: { fontSize: 20, fontWeight: '700' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, gap: 20 },
  glassPanel: { width: '100%', borderRadius: 36, padding: 24, alignItems: 'center', gap: 20, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)', shadowColor: '#E9C7FF', shadowOffset: { width: 0, height: 28 }, shadowOpacity: 0.28, shadowRadius: 44, elevation: 14 },
  frostFill: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.07)' },
  iconWrap: { marginBottom: 8 },
  iconCircle: { width: 84, height: 84, borderRadius: 42, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 58, width: '100%', overflow: 'hidden', shadowColor: '#64F3FF', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 22, elevation: 6 },
  input: { flex: 1, fontSize: 16 },
  inviteBtn: { height: 56, overflow: 'hidden', width: '100%', borderWidth: 0.5, backgroundColor: 'rgba(255,255,255,0.15)', shadowColor: '#E9C7FF', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.3, shadowRadius: 26, elevation: 9 },
  inviteGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  buttonShine: { position: 'absolute', top: 1, left: 8, right: 8, height: 20, borderRadius: 999, opacity: 0.34 },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  signOutBtn: { marginTop: 12 },
  signOutText: { fontSize: 14, textAlign: 'center' },
});
