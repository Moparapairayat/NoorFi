import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

type BiometricType = 'face' | 'fingerprint' | 'iris' | 'biometric';

type BiometricCapability = {
  available: boolean;
  type: BiometricType;
};

const SESSION_TOKEN_KEY = 'noorfi.session.token';
const BIOMETRIC_ENABLED_KEY = 'noorfi.biometric.enabled';
const LOGIN_ALERT_ENABLED_KEY = 'noorfi.security.login_alert.enabled';

function mapBiometricType(
  type: LocalAuthentication.AuthenticationType | null | undefined
): BiometricType {
  if (type === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) {
    return 'face';
  }

  if (type === LocalAuthentication.AuthenticationType.FINGERPRINT) {
    return 'fingerprint';
  }

  if (type === LocalAuthentication.AuthenticationType.IRIS) {
    return 'iris';
  }

  return 'biometric';
}

export function getBiometricDisplayName(type: BiometricType): string {
  if (type === 'face') {
    return 'Face ID';
  }

  if (type === 'fingerprint') {
    return 'Fingerprint';
  }

  if (type === 'iris') {
    return 'Iris';
  }

  return 'Biometrics';
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  if (Platform.OS === 'web') {
    return {
      available: false,
      type: 'biometric',
    };
  }

  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const preferredType = supportedTypes[0];

  return {
    available: hasHardware && isEnrolled,
    type: mapBiometricType(preferredType),
  };
}

export async function authenticateWithBiometrics(promptMessage: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
    fallbackLabel: 'Use device passcode',
  });

  return result.success;
}

export async function setBiometricLoginEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? '1' : '0');
}

export async function isBiometricLoginEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return value === '1';
}

export async function setLoginAlertPreferenceEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(LOGIN_ALERT_ENABLED_KEY, enabled ? '1' : '0');
}

export async function isLoginAlertPreferenceEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(LOGIN_ALERT_ENABLED_KEY);
  if (value === null) {
    return true;
  }

  return value === '1';
}

export async function persistSessionToken(token: string | null): Promise<void> {
  if (!token) {
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    return;
  }

  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token, {
    keychainService: 'noorfi.session.token',
  });
}

export async function getPersistedSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
}

export async function isBiometricLoginAvailable(): Promise<{
  available: boolean;
  type: BiometricType;
}> {
  const [enabled, capability, token] = await Promise.all([
    isBiometricLoginEnabled(),
    getBiometricCapability(),
    getPersistedSessionToken(),
  ]);

  return {
    available: enabled && capability.available && typeof token === 'string' && token.length > 0,
    type: capability.type,
  };
}
