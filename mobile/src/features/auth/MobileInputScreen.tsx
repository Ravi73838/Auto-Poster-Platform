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
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../services/api';
import { ApiError } from '@ap/api-client';

interface Props {
  onOtpSent: (mobile: string, devCode?: string) => void;
  onChangeLanguage: () => void;
}

export function MobileInputScreen({ onOtpSent, onChangeLanguage }: Props) {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    const rawNumber = mobile.trim();
    if (!/^[6-9]\d{9}$/.test(rawNumber)) {
      setError('Please enter a valid 10-digit Indian mobile number');
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

  const handleQuickFill = (num: string) => {
    setMobile(num);
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth:enterPhone', { defaultValue: 'Enter Mobile Number' })}</Text>
          <Text style={styles.subtitle}>
            We will send a 6-digit verification code to sign in or register
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

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>{t('auth:sendOtp', { defaultValue: 'Get OTP' })}</Text>
          )}
        </TouchableOpacity>

        {/* Dev helper */}
        <View style={styles.devBox}>
          <Text style={styles.devTitle}>Dev Quick-Fill:</Text>
          <TouchableOpacity
            onPress={() => handleQuickFill('9876543210')}
            style={styles.devChip}
          >
            <Text style={styles.devChipText}>Seeded Driver: 9876543210</Text>
          </TouchableOpacity>
        </View>

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
  devBox: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
  },
  devTitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 8,
  },
  devChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
  },
  devChipText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
  },
  langLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  langLinkText: {
    fontSize: 13,
    color: '#64748B',
    textDecorationLine: 'underline',
  },
});

