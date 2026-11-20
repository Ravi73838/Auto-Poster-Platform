import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../services/api';
import { useMobileAuthStore } from '../../store/authStore';
import { ApiError } from '@ap/api-client';

interface Props {
  onChangeLanguage: () => void;
  onLoginSuccess?: () => void;
}

export function MobileInputScreen({ onChangeLanguage, onLoginSuccess }: Props) {
  const { t, i18n } = useTranslation(['auth', 'common', 'errors']);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    const rawNumber = mobile.trim();
    if (!/^[6-9]\d{9}$/.test(rawNumber)) {
      setError(t('errors:INVALID_MOBILE_FORMAT', { defaultValue: 'Please enter a valid 10-digit Indian mobile number' }));
      return;
    }

    if (!password || password.length < 6) {
      setError(t('errors:PASSWORD_TOO_SHORT', { defaultValue: 'Please enter a password with at least 6 characters' }));
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const fullMobile = `+91${rawNumber}`;
      const currentLang = (i18n.language || 'en') as 'en' | 'hi' | 'gu';
      const res = isRegisterMode
        ? await apiClient.driverPasswordRegister({ mobile: fullMobile, password, language: currentLang })
        : await apiClient.driverPasswordLogin({ mobile: fullMobile, password });

      await useMobileAuthStore.getState().login(res);
      onLoginSuccess?.();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const details = err.details as {
          fieldErrors?: Record<string, string[]>;
          formErrors?: string[];
          issues?: Array<{ message?: string }>;
        } | null;

        const firstFieldError = details?.fieldErrors
          ? Object.values(details.fieldErrors).flat()[0]
          : undefined;
        const firstFormError = details?.formErrors?.[0];
        const firstIssue = Array.isArray(details?.issues) ? details.issues[0]?.message : undefined;

        const specificMsg = firstFieldError || firstFormError || firstIssue;
        setError(specificMsg || t(`errors:${err.code}`, { defaultValue: err.message }));
      } else {
        setError(t('errors:AUTH_FAILED', { defaultValue: 'Authentication failed. Please check credentials and try again.' }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>
            {isRegisterMode
              ? t('auth:driverRegister', { defaultValue: 'Register Driver' })
              : t('auth:driverSignIn', { defaultValue: 'Driver Sign In' })}
          </Text>
          <Text style={styles.subtitle}>
            {isRegisterMode
              ? t('auth:driverRegisterSubtitle', { defaultValue: 'Create a driver account using your mobile number and password' })
              : t('auth:driverSignInSubtitle', { defaultValue: 'Enter your 10-digit mobile number and password' })}
          </Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.inputContainer}>
          <View style={styles.prefixBox}>
            <Text style={styles.prefixText}>+91</Text>
          </View>
          <TextInput
            style={styles.input}
            keyboardType="phone-pad"
            maxLength={10}
            placeholder="9876543210"
            placeholderTextColor="#94A3B8"
            value={mobile}
            onChangeText={(val) => {
              setMobile(val.replace(/\D/g, ''));
              if (error) setError(null);
            }}
          />
        </View>

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            secureTextEntry={!showPassword}
            placeholder={
              isRegisterMode
                ? t('auth:enterPasswordRegister', { defaultValue: 'Password (min. 6 characters)' })
                : t('auth:password', { defaultValue: 'Password' })
            }
            placeholderTextColor="#94A3B8"
            value={password}
            onChangeText={(val) => {
              setPassword(val);
              if (error) setError(null);
            }}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.showHideButton}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
          >
            <Text style={styles.showHideIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              {isRegisterMode
                ? t('auth:registerAccount', { defaultValue: 'Register Account' })
                : t('auth:signIn', { defaultValue: 'Sign In' })}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setIsRegisterMode(!isRegisterMode);
            setError(null);
          }}
          style={styles.modeToggle}
        >
          <Text style={styles.modeToggleText}>
            {isRegisterMode
              ? t('auth:alreadyAccountSignInPrompt', { defaultValue: 'Already have an account? Sign In' })
              : t('auth:newDriverRegisterPrompt', { defaultValue: 'New driver? Register Here' })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onChangeLanguage} style={styles.langLink}>
          <Text style={styles.langLinkText}>Change Language / भाषा बदलें / ભાષા બદલો</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 96,
    height: 96,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginBottom: 16,
    overflow: 'hidden',
  },
  prefixBox: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F1F5F9',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  prefixText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '600',
    letterSpacing: 1,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0F172A',
  },
  showHideButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  showHideIcon: {
    fontSize: 18,
  },
  button: {
    backgroundColor: '#0284C7',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modeToggle: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  modeToggleText: {
    fontSize: 14,
    color: '#0284C7',
    fontWeight: '600',
  },
  langLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  langLinkText: {
    fontSize: 13,
    color: '#64748B',
    textDecorationLine: 'underline',
  },
});
