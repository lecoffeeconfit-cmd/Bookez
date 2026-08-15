import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-get-random-values';
import * as aesjs from 'aes-js';

const encryptedValuePrefix = 'bookez-secure-v1:';
const keyPrefix = 'bookez.secure-storage.key.v1.';

type KeyValueStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

function keyReference(storageKey: string) {
  // SecureStore keys are deliberately derived from the app-owned key rather
  // than from user input, and never contain manuscript content.
  return `${keyPrefix}${storageKey}`.replace(/[^A-Za-z0-9._-]/g, '_');
}

async function encryptionKey(storageKey: string) {
  const reference = keyReference(storageKey);
  const saved = await SecureStore.getItemAsync(reference);
  if (saved && /^[a-f0-9]{64}$/i.test(saved)) return aesjs.utils.hex.toBytes(saved);

  const next = crypto.getRandomValues(new Uint8Array(32));
  await SecureStore.setItemAsync(reference, aesjs.utils.hex.fromBytes(next), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return next;
}

async function encrypt(storageKey: string, value: string) {
  const key = await encryptionKey(storageKey);
  const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
  return `${encryptedValuePrefix}${aesjs.utils.hex.fromBytes(cipher.encrypt(aesjs.utils.utf8.toBytes(value)))}`;
}

async function decrypt(storageKey: string, value: string) {
  const payload = value.slice(encryptedValuePrefix.length);
  const key = await encryptionKey(storageKey);
  const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
  return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(payload)));
}

class EncryptedAsyncStorage implements KeyValueStorage {
  async getItem(key: string) {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;

    if (!stored.startsWith(encryptedValuePrefix)) {
      // Migrate Bookez data saved by earlier builds as it is read. The raw
      // value is immediately replaced, so manuscripts and sessions do not
      // remain in plaintext after a successful upgrade.
      await this.setItem(key, stored);
      return stored;
    }

    try {
      return await decrypt(key, stored);
    } catch {
      // A damaged or undecryptable value is unusable. Removing it avoids
      // repeatedly attempting to parse corrupted local auth or project data.
      await this.removeItem(key);
      return null;
    }
  }

  async setItem(key: string, value: string) {
    await AsyncStorage.setItem(key, await encrypt(key, value));
  }

  async removeItem(key: string) {
    await Promise.all([AsyncStorage.removeItem(key), SecureStore.deleteItemAsync(keyReference(key))]);
  }

  async getAllKeys() {
    return AsyncStorage.getAllKeys();
  }

  async multiRemove(keys: string[]) {
    await Promise.all(keys.map((key) => this.removeItem(key)));
  }
}

// SecureStore has no encrypted web equivalent. Bookez's production targets are
// native apps; web keeps the existing storage behavior instead of pretending it
// offers the same protection.
export const bookezSecureStorage: KeyValueStorage & Pick<EncryptedAsyncStorage, 'getAllKeys' | 'multiRemove'> = Platform.OS === 'web'
  ? {
      ...AsyncStorage,
      getAllKeys: () => AsyncStorage.getAllKeys(),
      multiRemove: (keys: string[]) => AsyncStorage.multiRemove(keys),
    }
  : new EncryptedAsyncStorage();

