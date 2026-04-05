import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, ScrollView, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
  const { colors } = useTheme();

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
        <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={28} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.topSection}>
            <Text style={[styles.brandText, { color: colors.primary }]}>CoupleChat</Text>
            <Text style={[styles.title, { color: colors.text }]}>Create account</Text>
            <Text style={[styles.subtitle, { color: colors.gray }]}>Start your private conversation space</Text>
          </View>

          <View style={styles.form}>
            <View style={[styles.inputWrap, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: colors.glassBorder, borderRadius: 14 }]}>
              <User size={20} color={colors.gray} style={{ marginRight: 12 }} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Full name"
                value={name}
                onChangeText={setName}
                placeholderTextColor={colors.gray}
              />
            </View>

            <View style={[styles.inputWrap, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: colors.glassBorder, borderRadius: 14 }]}>
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
            </View>

            <View style={[styles.inputWrap, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: colors.glassBorder, borderRadius: 14 }]}>
              <Lock size={20} color={colors.gray} style={{ marginRight: 12 }} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor={colors.gray}
              />
            </View>

            <TouchableOpacity style={[styles.signUpBtn, { borderRadius: 14 }]} onPress={handleSignup} disabled={loading}>
              <LinearGradient colors={colors.gradientSecondary as any} style={styles.signUpGrad}>
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
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  scrollArea: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 60, paddingBottom: 40 },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  topSection: { marginBottom: 32 },
  brandText: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 24 },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 16, fontWeight: '400' },
  form: { gap: 14 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56 },
  input: { flex: 1, fontSize: 16 },
  signUpBtn: { height: 56, overflow: 'hidden', marginTop: 8 },
  signUpGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  loginBtn: { paddingTop: 8, alignItems: 'center' },
  loginText: { fontSize: 14, textAlign: 'center' },
});
