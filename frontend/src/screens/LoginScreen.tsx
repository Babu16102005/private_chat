import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Mail, Lock, ArrowRight } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { handleError } from '../utils/errorHandler';

export const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { colors, isDark } = useTheme();

  const handleLogin = async () => {
    if (!email || !password) { handleError('Please fill in all fields'); return; }
    setLoading(true);
    try { await signIn(email, password); }
    catch (error: any) { handleError(error, 'Authentication failed'); }
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
        <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <BlurView intensity={colors.glassBlur + 14} tint={isDark ? 'dark' : 'light'} style={[styles.authPanel, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
            <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)'] as any} style={StyleSheet.absoluteFill} />
            <View style={styles.frostFill} />
            <View style={styles.topSection}>
              <Text style={[styles.brandText, { color: colors.primary }]}>kiba</Text>
              <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
              <Text style={[styles.subtitle, { color: colors.gray }]}>Sign in to your account</Text>
            </View>

            <View style={styles.form}>
            <BlurView intensity={colors.glassBlur + 18} tint={isDark ? 'dark' : 'light'} style={[styles.inputWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)', borderColor: colors.glassBorder, borderRadius: 24, borderWidth: colors.borderWidth }]}> 
              <Mail size={20} color={colors.gray} style={{ marginRight: 12 }} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor={colors.gray}
              />
            </BlurView>

            <BlurView intensity={colors.glassBlur + 18} tint={isDark ? 'dark' : 'light'} style={[styles.inputWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)', borderColor: colors.glassBorder, borderRadius: 24, borderWidth: colors.borderWidth }]}> 
              <Lock size={20} color={colors.gray} style={{ marginRight: 12 }} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor={colors.gray}
              />
            </BlurView>

            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotBtn}>
              <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.signInBtn, { borderRadius: 22, borderColor: colors.glassBorder }]} onPress={handleLogin} disabled={loading}>
              <LinearGradient colors={colors.gradientSecondary as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.signInGrad}>
                <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }} style={styles.buttonShine} />
                {loading ? <Text style={styles.btnText}>Signing in...</Text> : (
                  <>
                    <Text style={styles.btnText}>Sign In</Text>
                    <ArrowRight size={20} color="white" style={{ marginLeft: 8 }} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={styles.signUpBtn}>
              <Text style={[styles.signUpText, { color: colors.gray }]}>
                Don&apos;t have an account?{' '}
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
            </View>
          </BlurView>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  scrollArea: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  authPanel: { borderRadius: 36, padding: 24, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },
  frostFill: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  topSection: { marginBottom: 36 },
  brandText: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 24 },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 16, fontWeight: '400' },
  form: { gap: 14 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 58, overflow: 'hidden' },
  input: { flex: 1, fontSize: 16 },
  forgotBtn: { alignSelf: 'flex-end', paddingVertical: 6 },
  forgotText: { fontSize: 14, fontWeight: '600' },
  signInBtn: { height: 56, overflow: 'hidden', marginTop: 8, borderWidth: 0.5, backgroundColor: 'rgba(255,255,255,0.08)' },
  signInGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  buttonShine: { position: 'absolute', top: 1, left: 8, right: 8, height: 20, borderRadius: 999, opacity: 0.34 },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  signUpBtn: { marginTop: 12, paddingTop: 8, alignItems: 'center' },
  signUpText: { fontSize: 14, textAlign: 'center' },
});
