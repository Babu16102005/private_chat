import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, KeyboardAvoidingView } from 'react-native';
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

  const handleReset = async () => {
    if (!email.trim()) { handleError('Please enter your email'); return; }
    setLoading(true);
    try { await resetPassword(email); Alert.alert('Success', 'A password reset link has been sent to your email.'); navigation.navigate('Login'); }
    catch (error: any) { handleError(error, 'Failed to send reset email'); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.topShape}>
          <LinearGradient colors={colors.gradientPrimary as any} style={styles.glowCircle} />
        </View>

        <View style={styles.content}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={34} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Forgot Password?</Text>
          <Text style={[styles.subtitle, { color: colors.gray }]}>Enter your email to receive a recovery link</Text>
          
          <View style={styles.inputArea}>
            <View style={[styles.inputWrapper, { backgroundColor: colors.white, borderColor: colors.glassBorder, borderWidth: colors.borderWidth, borderRadius: colors.radius.card }]}>
              <Mail size={20} color={colors.gray} style={styles.inputIcon} />
              <TextInput 
                style={[styles.input, { color: colors.text }]} 
                placeholder="Recovery Email Address" 
                value={email} 
                onChangeText={setEmail} 
                autoCapitalize="none" 
                keyboardType="email-address" 
                placeholderTextColor={colors.gray} 
              />
            </View>

            <TouchableOpacity style={[styles.button, { borderRadius: colors.radius.card }]} onPress={handleReset} disabled={loading}>
              <LinearGradient colors={colors.gradientPrimary as any} style={styles.buttonGrad}>
                <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send Recovery Link'}</Text>
                {!loading && <Send size={20} color="white" style={{ marginLeft: 10 }} />}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.switchBtn}>
              <Text style={[styles.switchText, { color: colors.gray }]}>
                Remembered? <Text style={[styles.link, { color: colors.primary }]}>Go back to Login</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 30, justifyContent: 'center' },
  topShape: { position: 'absolute', top: -100, right: -50, opacity: 0.3 },
  glowCircle: { width: 300, height: 300, borderRadius: 150 },
  content: { zIndex: 1 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 20, marginLeft: -10 },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 10 },
  subtitle: { fontSize: 16, marginBottom: 40, fontWeight: '500' },
  inputArea: { marginTop: 10 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, paddingHorizontal: 20, height: 60, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  inputIcon: { marginRight: 15 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  button: { height: 60, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  buttonGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 },
  switchBtn: { marginTop: 25 },
  switchText: { textAlign: 'center', fontSize: 14, fontWeight: '500' },
  link: { fontWeight: '700' }
});
