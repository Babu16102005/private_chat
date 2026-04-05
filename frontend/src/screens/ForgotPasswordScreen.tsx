import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, ChevronLeft, Send } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { handleError } from '../utils/errorHandler';

export const ForgotPasswordScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();
  const { colors } = useTheme();
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
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Forgot Password?</Text>
          <Text style={[styles.subtitle, { color: colors.gray }]}>Enter your email and we&apos;ll send you a link to reset your password.</Text>

          <View style={[styles.inputWrap, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: colors.glassBorder, borderRadius: 14 }]}>
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
          </View>

          <TouchableOpacity style={[styles.sendBtn, { borderRadius: 14 }]} onPress={handleReset} disabled={loading}>
            <LinearGradient colors={colors.gradientPrimary as any} style={styles.sendGrad}>
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
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingTop: 10 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 20 },
  title: { fontSize: 30, fontWeight: '800' },
  subtitle: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56, marginBottom: 4 },
  input: { flex: 1, fontSize: 16 },
  sendBtn: { overflow: 'hidden', height: 56 },
  sendGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  backToLoginBtn: { paddingTop: 8, alignItems: 'center' },
  backToLoginText: { fontSize: 14, textAlign: 'center' },
});
