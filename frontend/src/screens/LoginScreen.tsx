import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { handleError } from '../utils/errorHandler';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { colors } = useTheme();

  const handleLogin = async () => {
    if (!email || !password) { handleError('Please fill in all fields'); return; }
    setLoading(true);
    try { await signIn(email, password); }
    catch (error: any) { handleError(error, 'Authentication failed'); }
    finally { setLoading(false); }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.primary }]}>Welcome Back</Text>
      <Text style={[styles.subtitle, { color: colors.text }]}>Log in to continue your story</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.white, borderColor: colors.lightGray, color: colors.text }]} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.gray} />
      <TextInput style={[styles.input, { backgroundColor: colors.white, borderColor: colors.lightGray, color: colors.text }]} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor={colors.gray} />
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleLogin} disabled={loading}><Text style={styles.buttonText}>Login</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Signup')}><Text style={[styles.switchText, { color: colors.gray }]}>Don't have an account? <Text style={[styles.link, { color: colors.primary }]}>Sign Up</Text></Text></TouchableOpacity>
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
