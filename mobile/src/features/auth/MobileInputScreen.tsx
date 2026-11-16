import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../services/api';
import { useMobileAuthStore } from '../../store/authStore';
import { ApiError } from '@ap/api-client';

interface Props {
  onOtpSent: (mobile: string, devCode?: string) => void;
  onChangeLanguage: () => void;
  onLoginSuccess?: () => void;
}

export function MobileInputScreen({ onOtpSent, onChangeLanguage, onLoginSuccess }: Props) {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isOtpDisabled, setIsOtpDisabled] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    apiClient.getPublicAppConfig().then((config) => {
      if (config.auth && config.auth.otpEnabled === false) {
        setIsOtpDisabled(true);
      }
    }).catch(() => {
      // fallback
    });
  }, []);

  const handleSubmit = async () => {
    const rawNumber = mobile.trim();
    if (!/^[6-9]\d{9}$/.test(rawNumber)) {
      setError('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    if (isOtpDisabled) {
      if (!password || password.length < 6) {
        setError('Please enter a password with at least 6 characters');
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const fullMobile = `+91${rawNumber}`;
        const res = isRegisterMode
          ? await apiClient.driverPasswordRegister({ mobile: fullMobile, password, language: 'en' })
          : await apiClient.driverPasswordLogin({ mobile: fullMobile, password });

        await useMobileAuthStore.getState().login(res);
        onLoginSuccess?.();
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          setError(t(`errors:${err.code}`, { defaultValue: err.message }));
        } else {
          setError('Authentication failed. Please check credentials and try again.');
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.driverOtpRequest({ mobile: rawNumber });
      onOtpSent(rawNumber, res.devCode);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(t(`errors:${err.code}`, { defaultValue: err.message }));
      } else {
        setError('Failed to send OTP. Please check connection and try again.');
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
        {isOtpDisabled ? (
          <View style={styles.warningBanner}>
            <Text style={styles.warningBannerTitle}>⚠️ TESTING MODE</Text>
            <Text style={styles.warningBannerText}>
              OTP authentication is DISABLED. Log in or register with mobile and password.
            </Text>
          </View>
        ) : null}

        <View style={styles.header}>
          <Text style={styles.title}>
            {isOtpDisabled
              ? isRegisterMode
                ? 'Register Driver'
                : 'Driver Sign In'
              : t('auth:enterPhone', { defaultValue: 'Enter Mobile Number' })}
          </Text>
          <Text style={styles.subtitle}>
            {isOtpDisabled
              ? isRegisterMode
                ? 'Create a driver account using your mobile number and password'
                : 'Enter your 10-digit mobile number and password'
              : 'We will send a 6-digit verification code to sign in or register'}
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

        {isOtpDisabled ? (
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              secureTextEntry={!showPassword}
              placeholder="Password"
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
            >
              <Text style={styles.showHideText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

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
              {isOtpDisabled
                ? isRegisterMode
                  ? 'Register Account'
                  : 'Sign In'
                : t('auth:sendOtp', { defaultValue: 'Get OTP' })}
            </Text>
          )}
        </TouchableOpacity>

        {isOtpDisabled ? (
          <TouchableOpacity
            onPress={() => {
              setIsRegisterMode(!isRegisterMode);
              setError(null);
            }}
            style={styles.modeToggle}
          >
            <Text style={styles.modeToggleText}>
              {isRegisterMode
                ? 'Already have an account? Sign In'
                : "New driver? Register Here"}
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity onPress={onChangeLanguage} style={styles.langLink}>
          <Text style={styles.langLinkText}>Change Language / भाषा बदलें</Text>
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
    marginBottom: 20,
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
  warningBanner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  warningBannerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  warningBannerText: {
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
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
  },
  showHideText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
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

