import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { LockKeyhole } from 'lucide-react-native';
import { useLock } from '../context/LockContext';
import { useTheme } from '../context/ThemeContext';

const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

export const PinLockOverlay = () => {
  const { colors, isDark } = useTheme();
  const { isLocked, unlock } = useLock();
  const [pin, setPin] = useState('');

  if (!isLocked) return null;

  const submitPin = async (nextPin: string) => {
    const ok = await unlock(nextPin);
    if (!ok) {
      setPin('');
      Alert.alert('Wrong PIN', 'Please try again.');
    }
  };

  const handleDigit = (digit: string) => {
    if (!digit) return;
    if (digit === 'back') {
      setPin((current) => current.slice(0, -1));
      return;
    }

    const next = `${pin}${digit}`.slice(0, 4);
    setPin(next);
    if (next.length === 4) submitPin(next);
  };

  return (
    <View style={styles.overlay}>
      <LinearGradient colors={colors.gradientPrimary as any} style={StyleSheet.absoluteFill} />
      <BlurView intensity={colors.glassBlur + 24} tint={isDark ? 'dark' : 'light'} style={[styles.panel, { borderColor: colors.glassBorder, borderWidth: colors.borderWidth }]}> 
        <LockKeyhole size={36} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>Kiba locked</Text>
        <Text style={[styles.subtitle, { color: colors.gray }]}>Enter your 4-digit PIN</Text>
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.dot, { backgroundColor: pin.length > i ? colors.primary : 'rgba(255,255,255,0.2)' }]} />
          ))}
        </View>
        <View style={styles.keypad}>
          {digits.map((digit, index) => (
            <TouchableOpacity key={`${digit}-${index}`} disabled={!digit} onPress={() => handleDigit(digit)} style={styles.key}>
              <Text style={[styles.keyText, { color: colors.text }]}>{digit === 'back' ? '⌫' : digit}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 3000, justifyContent: 'center', alignItems: 'center', padding: 24 },
  panel: { width: '100%', maxWidth: 360, borderRadius: 34, padding: 24, alignItems: 'center', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)' },
  title: { fontSize: 26, fontWeight: '900', marginTop: 16 },
  subtitle: { fontSize: 14, fontWeight: '600', marginTop: 6 },
  dotsRow: { flexDirection: 'row', gap: 12, marginVertical: 26 },
  dot: { width: 13, height: 13, borderRadius: 7 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 264, justifyContent: 'center' },
  key: { width: 78, height: 58, margin: 5, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  keyText: { fontSize: 24, fontWeight: '800' },
});
