import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Mail, ChevronLeft, Send } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { handleError } from '../utils/errorHandler';

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
          <LinearGradient colors={colors.gradientPrimary as any} start={{ x: 0.12, y: 0 }} end={{ x: 0.92, y: 1 }} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(100,243,255,0.12)', 'rgba(233,199,255,0.07)', 'transparent'] as any} start={{ x: 1, y: 0 }} end={{ x: 0.2, y: 0.78 }} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['transparent', 'rgba(141,255,213,0.08)', 'rgba(5,7,18,0.22)'] as any} start={{ x: 0, y: 0.28 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </View>
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}> 
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { borderColor: colors.glassBorder }]}> 
            <ChevronLeft size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <BlurView intensity={colors.glassBlur + 14} tint={isDark ? 'dark' : 'light'} style={[styles.glassPanel, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
          <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.04)'] as any} style={StyleSheet.absoluteFill} />
          <Text style={[styles.title, { color: colors.text }]}>Forgot Password?</Text>
          <Text style={[styles.subtitle, { color: colors.gray }]}>Enter your email and we&apos;ll send you a link to reset your password.</Text>

          <BlurView intensity={colors.glassBlur + 18} tint={isDark ? 'dark' : 'light'} style={[styles.inputWrap, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: colors.glassBorder, borderRadius: 22, borderWidth: colors.borderWidth }]}> 
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
  topBar: { paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  glassPanel: { borderRadius: 34, padding: 24, gap: 20, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)', shadowColor: '#E9C7FF', shadowOffset: { width: 0, height: 28 }, shadowOpacity: 0.28, shadowRadius: 44, elevation: 14 },
  title: { fontSize: 30, fontWeight: '800' },
  subtitle: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56, marginBottom: 4, overflow: 'hidden', shadowColor: '#64F3FF', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 22, elevation: 6 },
  input: { flex: 1, fontSize: 16 },
  sendBtn: { overflow: 'hidden', height: 56, borderWidth: 0.5, backgroundColor: 'rgba(255,255,255,0.15)', shadowColor: '#E9C7FF', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.3, shadowRadius: 26, elevation: 9 },
  sendGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  buttonShine: { position: 'absolute', top: 1, left: 8, right: 8, height: 20, borderRadius: 999, opacity: 0.34 },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  backToLoginBtn: { paddingTop: 8, alignItems: 'center' },
  backToLoginText: { fontSize: 14, textAlign: 'center' },
});
