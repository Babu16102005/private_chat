import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { theme } from '../constants/theme';
import { handleError } from '../utils/errorHandler';

export const SignupScreen = ({ navigation }: any) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const handleSignup = async () => {
    if (!email || !password || !name) {
      handleError('Please fill in all fields (Name, Email, Password)');
      return;
    }

    setLoading(true);
    try {
      // In a more complex app, we'd update the profile 'name' after signup. 
      // For now, we sign up and the backend trigger creates the initial profile.
      await signUp(email, password);
      // We'll update the name in the context once the session is active, 
      // or here we just tell them to verify.
      Alert.alert('Success', 'Verification email sent! Please verify to start chatting.');
      navigation.navigate('Login');
    } catch (error: any) {
      handleError(error, 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join PrivateChat</Text>
      <Text style={styles.subtitle}>Create your profile to get started</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Full Name (e.g. John Doe)"
        value={name}
        onChangeText={setName}
        placeholderTextColor={theme.colors.gray}
      />
      <TextInput
        style={styles.input}
        placeholder="Email Address"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor={theme.colors.gray}
      />
      <TextInput
        style={styles.input}
        placeholder="Choose Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor={theme.colors.gray}
      />
      
      <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
        <Text style={styles.buttonText}>Create Account</Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.switchText}>
          Already on PrivateChat? <Text style={styles.link}>Log In</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 30, backgroundColor: theme.colors.background },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, color: theme.colors.primary },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 40, color: theme.colors.text },
  input: { backgroundColor: theme.colors.white, paddingVertical: 15, paddingHorizontal: 20, borderRadius: 25, marginBottom: 15, fontSize: 16, borderWidth: 1, borderColor: theme.colors.lightGray, color: theme.colors.text },
  button: { 
    backgroundColor: theme.colors.primary, 
    padding: 18, 
    borderRadius: 25, 
    alignItems: 'center', 
    marginBottom: 25,
    ...Platform.select({
      ios: { shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 8 },
      web: { boxShadow: '0px 5px 10px rgba(233, 30, 99, 0.3)' }
    }),
  },
  buttonText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 18 },
  switchText: { textAlign: 'center', color: theme.colors.gray, fontSize: 14 },
  link: { color: theme.colors.primary, fontWeight: 'bold' }
});
