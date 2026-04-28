import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, ScrollView, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Mail, Lock, ArrowRight } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { handleError } from '../utils/errorHandler';

const { height } = Dimensions.get('window');

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
          <LinearGradient colors={colors.gradientPrimary as any} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(185, 76, 255, 0.46)', 'transparent'] as any} style={[styles.glowBall, { top: -130, right: -90, width: 360, height: 360 }]} />
          <LinearGradient colors={['rgba(37, 214, 255, 0.22)', 'transparent'] as any} style={[styles.glowBall, { top: height * 0.38, left: -140, width: 320, height: 320 }]} />
          <LinearGradient colors={['rgba(255, 122, 92, 0.18)', 'transparent'] as any} style={[styles.glowBall, { bottom: -90, right: -80, width: 280, height: 280 }]} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <BlurView intensity={colors.glassBlur} tint={isDark ? 'dark' : 'light'} style={[styles.authPanel, { borderColor: colors.glassBorder }]}> 
            <View style={styles.topSection}>
              <Text style={[styles.brandText, { color: colors.primary }]}>CoupleChat</Text>
              <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
              <Text style={[styles.subtitle, { color: colors.gray }]}>Sign in to your account</Text>
            </View>

            <View style={styles.form}>
            <BlurView intensity={colors.glassBlur + 8} tint={isDark ? 'dark' : 'light'} style={[styles.inputWrap, { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: colors.glassBorder, borderRadius: 22 }]}> 
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

            <BlurView intensity={colors.glassBlur + 8} tint={isDark ? 'dark' : 'light'} style={[styles.inputWrap, { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: colors.glassBorder, borderRadius: 22 }]}> 
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

            <TouchableOpacity style={[styles.signInBtn, { borderRadius: 14 }]} onPress={handleLogin} disabled={loading}>
              <LinearGradient colors={colors.gradientSecondary as any} style={styles.signInGrad}>
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
  glowBall: { position: 'absolute', borderRadius: 180, overflow: 'hidden' },
  scrollArea: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  authPanel: { borderRadius: 32, padding: 24, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)', shadowColor: '#B94CFF', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.28, shadowRadius: 30, elevation: 8 },
  topSection: { marginBottom: 36 },
  brandText: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 24 },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 16, fontWeight: '400' },
  form: { gap: 14 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, fontSize: 16 },
  forgotBtn: { alignSelf: 'flex-end', paddingVertical: 6 },
  forgotText: { fontSize: 14, fontWeight: '600' },
  signInBtn: { height: 56, overflow: 'hidden', marginTop: 8, shadowColor: '#D946EF', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 18, elevation: 7 },
  signInGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  signUpBtn: { marginTop: 12, paddingTop: 8, alignItems: 'center' },
  signUpText: { fontSize: 14, textAlign: 'center' },
});
