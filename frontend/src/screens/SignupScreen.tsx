import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, KeyboardAvoidingView, ScrollView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Mail, Lock, UserPlus, ArrowRight } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { handleError } from '../utils/errorHandler';

const { width, height } = Dimensions.get('window');

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
    try { 
      await signUp(email, password, name); 
      Alert.alert('Success', 'Account created! Please verify your email.'); 
      navigation.navigate('Login'); 
    }
    catch (error: any) { handleError(error, 'Signup failed'); }
    finally { setLoading(false); }
  };

  const renderBackgroundGlows = () => (
    <View style={styles.glowOverlay}>
      <LinearGradient colors={['rgba(210, 118, 25, 0.2)', 'transparent'] as any} style={[styles.glowBall, { top: -100, left: -60, width: 350, height: 350 }]} />
      <LinearGradient colors={['rgba(210, 118, 25, 0.1)', 'transparent'] as any} style={[styles.glowBall, { bottom: 0, right: -50, width: 400, height: 400 }]} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderBackgroundGlows()}
      
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Hello!</Text>
            <Text style={[styles.subtitle, { color: colors.gray }]}>Join our community and start your story</Text>
          </View>
          
          <View style={styles.formContainer}>
            <View style={[styles.inputGroup, { backgroundColor: colors.white, borderColor: colors.glassBorder, borderWidth: colors.borderWidth, borderRadius: colors.radius.card }]}>
              <User size={20} color={colors.gray} style={styles.inputIcon} />
              <TextInput style={[styles.input, { color: colors.text }]} placeholder="Full Name" value={name} onChangeText={setName} placeholderTextColor={colors.gray} />
            </View>

            <View style={[styles.inputGroup, { backgroundColor: colors.white, borderColor: colors.glassBorder, borderWidth: colors.borderWidth, borderRadius: colors.radius.card }]}>
              <Mail size={20} color={colors.gray} style={styles.inputIcon} />
              <TextInput style={[styles.input, { color: colors.text }]} placeholder="Email Address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.gray} />
            </View>

            <View style={[styles.inputGroup, { backgroundColor: colors.white, borderColor: colors.glassBorder, borderWidth: colors.borderWidth, borderRadius: colors.radius.card }]}>
              <Lock size={20} color={colors.gray} style={styles.inputIcon} />
              <TextInput style={[styles.input, { color: colors.text }]} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor={colors.gray} />
            </View>

            <TouchableOpacity style={[styles.button, { borderRadius: colors.radius.card }]} onPress={handleSignup} disabled={loading}>
              <LinearGradient colors={colors.gradientSecondary as any} style={styles.buttonGrad}>
                <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create Account'}</Text>
                {!loading && <UserPlus size={20} color="white" style={{ marginLeft: 10 }} />}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.switchBtn}>
              <Text style={[styles.switchText, { color: colors.gray }]}>
                Already have an account? <Text style={[styles.link, { color: colors.secondary }]}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  glowOverlay: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  glowBall: { position: 'absolute', borderRadius: 200 },
  scrollArea: { flexGrow: 1, justifyContent: 'center', padding: 30 },
  header: { marginBottom: 35 },
  title: { fontSize: 38, fontWeight: '800', marginBottom: 12 },
  subtitle: { fontSize: 16, fontWeight: '600' },
  formContainer: { gap: 15 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 60, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 2 },
  inputIcon: { marginRight: 15 },
  input: { flex: 1, fontSize: 16, fontWeight: '600' },
  button: { height: 60, overflow: 'hidden', elevation: 8, shadowColor: '#D27619', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, marginTop: 15 },
  buttonGrad: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 },
  switchBtn: { marginTop: 20, paddingVertical: 10 },
  switchText: { textAlign: 'center', fontSize: 14, fontWeight: '600' },
  link: { fontWeight: '800' }
});
