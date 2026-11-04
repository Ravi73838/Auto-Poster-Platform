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
  mobile: string;
  devCode?: string;
  onSuccess: () => void;
  onBack: () => void;
}

export function OtpVerifyScreen({ mobile, devCode, onSuccess, onBack }: Props) {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const login = useMobileAuthStore((s) => s.login);

  const [code, setCode] = useState(devCode || '');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(30);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.driverOtpVerify({
        mobile,
        code: code.trim(),
        device: {
          platform: 'ANDROID',
        },
      });

      await login(response);
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(t(`errors:${err.code}`, { defaultValue: err.message }));
      } else {
        setError('Verification failed. Please check the code and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError(null);
    try {
      await apiClient.driverOtpRequest({ mobile });
      setCooldown(30);
    } catch {
      setError('Failed to resend OTP.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Enter 6-Digit Code</Text>
          <Text style={styles.subtitle}>
            Code sent to <Text style={styles.bold}>+91 {mobile}</Text>
          </Text>
        </View>

        {devCode ? (
          <View style={styles.devBanner}>
            <Text style={styles.devBannerText}>
              DEV SMS Code: <Text style={styles.bold}>{devCode}</Text>
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TextInput
          style={styles.otpInput}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="••••••"
          placeholderTextColor="#94A3B8"
          value={code}
          onChangeText={(val) => {
            setCode(val.replace(/\D/g, ''));
            if (error) setError(null);
          }}
          autoFocus
        />

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>{t('auth:verifyOtp', { defaultValue: 'Verify and Sign In' })}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>Didn&apos;t get the code? </Text>
          <TouchableOpacity onPress={handleResend} disabled={cooldown > 0}>
            <Text style={[styles.resendBtn, cooldown > 0 && styles.resendDisabled]}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={onBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>Edit mobile number</Text>
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
    marginBottom: 24,
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
  },
  bold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  devBanner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  devBannerText: {
    fontSize: 13,
    color: '#92400E',
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
  otpInput: {
    borderWidth: 1.5,
    borderColor: '#0284C7',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 12,
    color: '#0F172A',
    marginBottom: 24,
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
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  resendLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  resendBtn: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284C7',
  },
  resendDisabled: {
    color: '#94A3B8',
  },
  backLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  backLinkText: {
    fontSize: 13,
    color: '#64748B',
    textDecorationLine: 'underline',
  },
});

