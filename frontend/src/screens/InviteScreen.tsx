import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
  const { colors } = useTheme();
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
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backBtn}>
          <ArrowLeft size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.text }]}>New Chat</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
            <UserPlus size={36} color={colors.primary} strokeWidth={1.5} />
          </View>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Invite your partner</Text>
        <Text style={[styles.subtitle, { color: colors.gray }]}>
          Send an invite to your partner with their email address. Once they accept, you&apos;ll be connected in a private chat.
        </Text>

        <View style={[styles.inputWrap, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: colors.glassBorder, borderRadius: 14 }]}>
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
        </View>

        <TouchableOpacity style={[styles.inviteBtn, { borderRadius: 14 }]} onPress={sendInvite} disabled={loading}>
          <LinearGradient colors={colors.gradientPrimary as any} style={styles.inviteGrad}>
            <Text style={styles.btnText}>
              {loading ? 'Sending Invite...' : 'Send Invite'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBarTitle: { fontSize: 20, fontWeight: '700' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 20 },
  iconWrap: { marginBottom: 8 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56, width: '100%' },
  input: { flex: 1, fontSize: 16 },
  inviteBtn: { height: 56, overflow: 'hidden', width: '100%' },
  inviteGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  signOutBtn: { marginTop: 12 },
  signOutText: { fontSize: 14, textAlign: 'center' },
});