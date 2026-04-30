import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const PIN_HASH_KEY = 'kiba.pin.hash';
const PIN_SALT_KEY = 'kiba.pin.salt';

const hashPin = async (pin: string, salt: string) => {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
};

const createSalt = () => `${Date.now()}:${Math.random().toString(36).slice(2)}`;

export const pinLockService = {
  async isEnabled() {
    const hash = await SecureStore.getItemAsync(PIN_HASH_KEY);
    return !!hash;
  },

  async setPin(pin: string) {
    const salt = createSalt();
    const hash = await hashPin(pin, salt);
    await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
    await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
  },

  async verifyPin(pin: string) {
    const [salt, storedHash] = await Promise.all([
      SecureStore.getItemAsync(PIN_SALT_KEY),
      SecureStore.getItemAsync(PIN_HASH_KEY),
    ]);

    if (!salt || !storedHash) return false;
    const nextHash = await hashPin(pin, salt);
    return nextHash === storedHash;
  },

  async clearPin() {
    await Promise.all([
      SecureStore.deleteItemAsync(PIN_HASH_KEY),
      SecureStore.deleteItemAsync(PIN_SALT_KEY),
    ]);
  },
};
