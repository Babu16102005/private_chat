import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { handleError } from '../utils/errorHandler';

export const SignupScreen = ({ navigation }: any) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { colors } = useTheme();

  const handleSignup = async () => {
    if (!email || !password || !name) { handleError('Please fill in all fields'); return; }
    setLoading(true);
    try { await signUp(email, password, name); Alert.alert('Success', 'Account created! Please verify your email to start chatting.'); navigation.navigate('Login'); }
    catch (error: any) { handleError(error, 'Signup failed'); }
    finally { setLoading(false); }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.primary }]}>Join PrivateChat</Text>
      <Text style={[styles.subtitle, { color: colors.text }]}>Create your profile to get started</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.white, borderColor: colors.lightGray, color: colors.text }]} placeholder="Full Name" value={name} onChangeText={setName} placeholderTextColor={colors.gray} />
      <TextInput style={[styles.input, { backgroundColor: colors.white, borderColor: colors.lightGray, color: colors.text }]} placeholder="Email Address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.gray} />
      <TextInput style={[styles.input, { backgroundColor: colors.white, borderColor: colors.lightGray, color: colors.text }]} placeholder="Choose Password" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor={colors.gray} />
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleSignup} disabled={loading}><Text style={styles.buttonText}>Create Account</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}><Text style={[styles.switchText, { color: colors.gray }]}>Already on PrivateChat? <Text style={[styles.link, { color: colors.primary }]}>Log In</Text></Text></TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 30 },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 40 },
  input: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: 25, marginBottom: 15, fontSize: 16, borderWidth: 1 },
  button: { padding: 18, borderRadius: 25, alignItems: 'center', marginBottom: 25, ...Platform.select({ ios: { shadowColor: '#E91E63', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 }, android: { elevation: 8 }, web: { boxShadow: '0px 5px 10px rgba(233, 30, 99, 0.3)' } }) },
  buttonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 },
  switchText: { textAlign: 'center', fontSize: 14 },
  link: { fontWeight: 'bold' }
});
