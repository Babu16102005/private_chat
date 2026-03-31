import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.primary }]}>Forgot Password?</Text>
      <Text style={[styles.subtitle, { color: colors.text }]}>Enter your email to get a reset link</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.white, borderColor: colors.lightGray, color: colors.text }]} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.gray} />
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleReset} disabled={loading}><Text style={styles.buttonText}>Send Reset Link</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}><Text style={[styles.switchText, { color: colors.gray }]}>Back to <Text style={[styles.link, { color: colors.primary }]}>Login</Text></Text></TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 30 },
  title: { fontSize: 36, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 40 },
  input: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: 25, marginBottom: 20, fontSize: 16, borderWidth: 1 },
  button: { padding: 18, borderRadius: 25, alignItems: 'center', marginBottom: 25, ...Platform.select({ ios: { shadowColor: '#E91E63', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 }, android: { elevation: 8 }, web: { boxShadow: '0px 5px 10px rgba(233, 30, 99, 0.3)' } }) },
  buttonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 },
  switchText: { textAlign: 'center', fontSize: 14 },
  link: { fontWeight: 'bold' }
});
