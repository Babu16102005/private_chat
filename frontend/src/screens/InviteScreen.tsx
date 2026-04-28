import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Linking, ActivityIndicator, Dimensions } from 'react-native';
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

const { height } = Dimensions.get('window');

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
        <LinearGradient colors={colors.gradientPrimary as any} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(185, 76, 255, 0.58)', 'transparent'] as any} style={[styles.glowBall, { top: -130, right: -90, width: 360, height: 360 }]} />
        <LinearGradient colors={['rgba(96, 42, 255, 0.34)', 'transparent'] as any} style={[styles.glowBall, { top: height * 0.3, left: -140, width: 340, height: 340 }]} />
        <LinearGradient colors={['rgba(37, 214, 255, 0.16)', 'transparent'] as any} style={[styles.glowBall, { bottom: -90, right: -80, width: 280, height: 280 }]} />
      </View>

      {/* Header */}
      <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={[styles.backBtn, { borderColor: colors.glassBorder }]}> 
          <ArrowLeft size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.text }]}>New Chat</Text>
        <View style={{ width: 40 }} />
      </BlurView>

      <View style={styles.content}>
        <BlurView intensity={colors.glassBlur + 16} tint="dark" style={[styles.glassPanel, { borderColor: 'rgba(255,255,255,0.14)' }]}> 
          <LinearGradient colors={['rgba(255,255,255,0.09)', 'rgba(128,61,214,0.2)', 'rgba(46,17,92,0.42)', 'rgba(11,3,28,0.34)'] as any} style={StyleSheet.absoluteFill} />
          <View style={styles.frostFill} />
          <View style={styles.iconWrap}>
          <View style={[styles.iconCircle, { borderColor: 'rgba(255,255,255,0.14)' }]}> 
            <LinearGradient colors={['rgba(255,255,255,0.13)', 'rgba(136,66,255,0.2)', 'rgba(18,5,48,0.35)'] as any} style={StyleSheet.absoluteFill} />
            <UserPlus size={36} color={colors.primary} strokeWidth={1.5} />
          </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>Invite your partner</Text>
          <Text style={[styles.subtitle, { color: colors.gray }]}> 
            Send an invite to your partner with their email address. Once they accept, you&apos;ll be connected in a private chat.
          </Text>

        <BlurView intensity={colors.glassBlur + 14} tint="dark" style={[styles.inputWrap, { backgroundColor: 'rgba(24,8,56,0.54)', borderColor: 'rgba(255,255,255,0.13)', borderRadius: 24 }]}> 
          <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(121,58,210,0.18)', 'rgba(10,2,30,0.28)'] as any} style={StyleSheet.absoluteFill} />
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
  glowBall: { position: 'absolute', borderRadius: 180, overflow: 'hidden' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  backBtn: { width: 40, height: 40, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: StyleSheet.hairlineWidth },
  topBarTitle: { fontSize: 20, fontWeight: '700' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, gap: 20 },
  glassPanel: { width: '100%', borderRadius: 36, padding: 24, alignItems: 'center', gap: 20, overflow: 'hidden', borderWidth: 1, backgroundColor: 'rgba(28,10,62,0.46)', shadowColor: '#B94CFF', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.34, shadowRadius: 38, elevation: 10 },
  frostFill: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(126,55,218,0.075)' },
  iconWrap: { marginBottom: 8 },
  iconCircle: { width: 84, height: 84, borderRadius: 42, justifyContent: 'center', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', backgroundColor: 'rgba(24,8,56,0.48)' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 58, width: '100%', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, shadowColor: '#B94CFF', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 4 },
  input: { flex: 1, fontSize: 16 },
  inviteBtn: { height: 56, overflow: 'hidden', width: '100%', borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.14)', shadowColor: '#D946EF', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.34, shadowRadius: 22, elevation: 7 },
  inviteGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  buttonShine: { position: 'absolute', top: 1, left: 8, right: 8, height: 20, borderRadius: 999, opacity: 0.34 },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  signOutBtn: { marginTop: 12 },
  signOutText: { fontSize: 14, textAlign: 'center' },
});
