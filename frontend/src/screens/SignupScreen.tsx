import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { User, Mail, Lock, UserPlus, ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { handleError } from '../utils/errorHandler';

export const SignupScreen = ({ navigation }: any) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { colors, isDark } = useTheme();

  const handleSignup = async () => {
    if (!email || !password || !name) { handleError('Please fill in all fields'); return; }
    if (password.length < 6) { handleError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await signUp(email, password, name);
      Alert.alert('Created', 'Account created! Please verify your email.');
      navigation.navigate('Login');
    }
    catch (error: any) { handleError(error, 'Signup failed'); }
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { borderColor: colors.glassBorder }]}> 
            <ChevronLeft size={28} color={colors.text} />
          </TouchableOpacity>

          <BlurView intensity={colors.glassBlur + 14} tint={isDark ? 'dark' : 'light'} style={[styles.authPanel, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
            <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)'] as any} style={StyleSheet.absoluteFill} />
            <View style={styles.topSection}>
              <Text style={[styles.brandText, { color: colors.primary }]}>kiba</Text>
              <Text style={[styles.title, { color: colors.text }]}>Create account</Text>
              <Text style={[styles.subtitle, { color: colors.gray }]}>Start your private conversation space</Text>
            </View>

            <View style={styles.form}>
            <BlurView intensity={colors.glassBlur + 18} tint={isDark ? 'dark' : 'light'} style={[styles.inputWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)', borderColor: colors.glassBorder, borderRadius: 22, borderWidth: colors.borderWidth }]}> 
              <User size={20} color={colors.gray} style={{ marginRight: 12 }} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Full name"
                value={name}
                onChangeText={setName}
                placeholderTextColor={colors.gray}
              />
            </BlurView>

            <BlurView intensity={colors.glassBlur + 18} tint={isDark ? 'dark' : 'light'} style={[styles.inputWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)', borderColor: colors.glassBorder, borderRadius: 22, borderWidth: colors.borderWidth }]}> 
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

            <BlurView intensity={colors.glassBlur + 18} tint={isDark ? 'dark' : 'light'} style={[styles.inputWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)', borderColor: colors.glassBorder, borderRadius: 22, borderWidth: colors.borderWidth }]}> 
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

            <TouchableOpacity style={[styles.signUpBtn, { borderRadius: 22, borderColor: colors.glassBorder }]} onPress={handleSignup} disabled={loading}>
              <LinearGradient colors={colors.gradientSecondary as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.signUpGrad}>
                <LinearGradient colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }} style={styles.buttonShine} />
                {loading ? <Text style={styles.btnText}>Creating...</Text> : (
                  <>
                    <Text style={styles.btnText}>Create Account</Text>
                    <UserPlus size={18} color="white" style={{ marginLeft: 8 }} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginBtn}>
              <Text style={[styles.loginText, { color: colors.gray }]}>
                Already have an account?{' '}
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign In</Text>
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
  scrollArea: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40 },
  authPanel: { borderRadius: 34, padding: 24, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 40, height: 40, borderRadius: 18, justifyContent: 'center', alignItems: 'center', zIndex: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)' },
  topSection: { marginBottom: 32 },
  brandText: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 24 },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 16, fontWeight: '400' },
  form: { gap: 14 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56, overflow: 'hidden' },
  input: { flex: 1, fontSize: 16 },
  signUpBtn: { height: 56, overflow: 'hidden', marginTop: 8, borderWidth: 0.5, backgroundColor: 'rgba(255,255,255,0.08)' },
  signUpGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  buttonShine: { position: 'absolute', top: 1, left: 8, right: 8, height: 20, borderRadius: 999, opacity: 0.34 },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  loginBtn: { paddingTop: 8, alignItems: 'center' },
  loginText: { fontSize: 14, textAlign: 'center' },
});
