import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Mail, ChevronLeft, Send } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { handleError } from '../utils/errorHandler';

const { height } = Dimensions.get('window');

export const ForgotPasswordScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const handleReset = async () => {
    if (!email.trim()) { handleError('Please enter your email'); return; }
    setLoading(true);
    try { await resetPassword(email); Alert.alert('Sent', 'Check your email for the reset link.'); navigation.navigate('Login'); }
    catch (error: any) { handleError(error, 'Failed to send reset email'); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={[styles.inner, { backgroundColor: colors.background }]}> 
        <View style={StyleSheet.absoluteFill}>
          <LinearGradient colors={colors.gradientPrimary as any} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(185, 76, 255, 0.46)', 'transparent'] as any} style={[styles.glowBall, { top: -130, right: -90, width: 360, height: 360 }]} />
          <LinearGradient colors={['rgba(37, 214, 255, 0.22)', 'transparent'] as any} style={[styles.glowBall, { top: height * 0.38, left: -140, width: 320, height: 320 }]} />
          <LinearGradient colors={['rgba(255, 122, 92, 0.18)', 'transparent'] as any} style={[styles.glowBall, { bottom: -90, right: -80, width: 280, height: 280 }]} />
        </View>
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}> 
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { borderColor: colors.glassBorder }]}> 
            <ChevronLeft size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.glassPanel, { borderColor: colors.glassBorder }]}> 
          <Text style={[styles.title, { color: colors.text }]}>Forgot Password?</Text>
          <Text style={[styles.subtitle, { color: colors.gray }]}>Enter your email and we&apos;ll send you a link to reset your password.</Text>

          <BlurView intensity={colors.glassBlur + 8} tint={isDark ? 'dark' : 'light'} style={[styles.inputWrap, { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: colors.glassBorder, borderRadius: 22 }]}> 
            <Mail size={20} color={colors.gray} style={{ marginRight: 12 }} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={colors.gray}
            />
          </BlurView>

          <TouchableOpacity style={[styles.sendBtn, { borderRadius: 22, borderColor: colors.glassBorder }]} onPress={handleReset} disabled={loading}>
            <LinearGradient colors={colors.gradientSecondary as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendGrad}>
              <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }} style={styles.buttonShine} />
              {loading ? <Text style={styles.btnText}>Sending...</Text> : (
                <>
                  <Text style={styles.btnText}>Send Reset Link</Text>
                  <Send size={18} color="white" style={{ marginLeft: 8 }} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.backToLoginBtn}>
            <Text style={[styles.backToLoginText, { color: colors.gray }]}>
              Remember your password?{' '}
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign In</Text>
            </Text>
          </TouchableOpacity>
          </BlurView>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  glowBall: { position: 'absolute', borderRadius: 180, overflow: 'hidden' },
  topBar: { paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: StyleSheet.hairlineWidth },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  glassPanel: { borderRadius: 32, padding: 24, gap: 20, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)', shadowColor: '#B94CFF', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.28, shadowRadius: 30, elevation: 8 },
  title: { fontSize: 30, fontWeight: '800' },
  subtitle: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56, marginBottom: 4, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, fontSize: 16 },
  sendBtn: { overflow: 'hidden', height: 56, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.14)', shadowColor: '#D946EF', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.34, shadowRadius: 22, elevation: 7 },
  sendGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  buttonShine: { position: 'absolute', top: 1, left: 8, right: 8, height: 20, borderRadius: 999, opacity: 0.34 },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  backToLoginBtn: { paddingTop: 8, alignItems: 'center' },
  backToLoginText: { fontSize: 14, textAlign: 'center' },
});
