import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
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
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const currentLang = (i18n.language || 'en') as 'en' | 'hi' | 'gu';

    if (isRegisterMode) {
      const trimmedName = name.trim();
      const rawMobile = mobile.trim();
      const trimmedEmail = email.trim();

      if (!trimmedName || trimmedName.length < 2) {
        setError(t('errors:NAME_REQUIRED', { defaultValue: 'Please enter your full name (min. 2 characters)' }));
        return;
      }

      if (!/^[6-9]\d{9}$/.test(rawMobile)) {
        setError(t('errors:INVALID_MOBILE_FORMAT', { defaultValue: 'Please enter a valid 10-digit Indian mobile number' }));
        return;
      }

      if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setError(t('errors:INVALID_EMAIL', { defaultValue: 'Please enter a valid email address' }));
        return;
      }

      if (!password || password.length < 6) {
        setError(t('errors:PASSWORD_TOO_SHORT', { defaultValue: 'Please enter a password with at least 6 characters' }));
        return;
      }

      setIsLoading(true);
      try {
        const fullMobile = `+91${rawMobile}`;
        const res = await apiClient.driverPasswordRegister({
          name: trimmedName,
          mobile: fullMobile,
          email: trimmedEmail.toLowerCase(),
          password,
          language: currentLang,
        });

        await useMobileAuthStore.getState().login(res);
        onLoginSuccess?.();
      } catch (err: unknown) {
        handleApiError(err);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Login mode: Email or Mobile
      const rawId = identifier.trim();
      if (!rawId) {
        setError(t('errors:IDENTIFIER_REQUIRED', { defaultValue: 'Please enter your mobile number or email address' }));
        return;
      }

      let loginIdentifier = rawId;
      let mobilePayload: string | undefined;

      if (rawId.includes('@')) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawId)) {
          setError(t('errors:INVALID_EMAIL', { defaultValue: 'Please enter a valid email address' }));
          return;
        }
        loginIdentifier = rawId.toLowerCase();
      } else {
        // Mobile number mode - robustly handle raw 10-digits, +91, leading 0, spaces, dashes
        const digits = rawId.replace(/\D/g, '');
        const last10 = digits.slice(-10);
        if (digits.length < 10 || !/^[6-9]\d{9}$/.test(last10)) {
          setError(t('errors:INVALID_MOBILE_FORMAT', { defaultValue: 'Please enter a valid 10-digit Indian mobile number' }));
          return;
        }
        loginIdentifier = last10;
        mobilePayload = `+91${last10}`;
      }

      if (!password || password.length < 1) {
        setError(t('errors:PASSWORD_REQUIRED', { defaultValue: 'Please enter your password' }));
        return;
      }

      setIsLoading(true);
      try {
        const res = await apiClient.driverPasswordLogin({
          identifier: loginIdentifier,
          mobile: mobilePayload,
          password,
        });

        await useMobileAuthStore.getState().login(res);
        onLoginSuccess?.();
      } catch (err: unknown) {
        handleApiError(err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleApiError = (err: unknown) => {
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
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
              ? t('auth:driverRegisterSubtitle4Fields', {
                  defaultValue: 'Create your driver account with name, mobile, email, and password',
                })
              : t('auth:driverSignInSubtitleWithIdentifier', {
                  defaultValue: 'Enter your mobile number or email and password',
                })}
          </Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {isRegisterMode ? (
          <>
            {/* 1. Name */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{t('auth:fullName', { defaultValue: 'Full Name' })}</Text>
              <TextInput
                style={styles.simpleInput}
                placeholder={t('auth:enterFullName', { defaultValue: 'Enter your full name' })}
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={(val) => {
                  setName(val);
                  if (error) setError(null);
                }}
              />
            </View>

            {/* 2. Mobile Number */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{t('auth:phone', { defaultValue: 'Mobile Number' })}</Text>
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
            </View>

            {/* 3. Email */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{t('auth:email', { defaultValue: 'Email Address' })}</Text>
              <TextInput
                style={styles.simpleInput}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder={t('auth:enterEmail', { defaultValue: 'Enter your email address' })}
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  if (error) setError(null);
                }}
              />
            </View>
          </>
        ) : (
          /* Login Mode: Email or Mobile Number */
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{t('auth:identifier', { defaultValue: 'Email or Mobile Number' })}</Text>
            <TextInput
              style={styles.simpleInput}
              autoCapitalize="none"
              placeholder={t('auth:enterIdentifier', { defaultValue: 'Enter email or 10-digit mobile number' })}
              placeholderTextColor="#94A3B8"
              value={identifier}
              onChangeText={(val) => {
                setIdentifier(val);
                if (error) setError(null);
              }}
            />
          </View>
        )}

        {/* Password (common to both) */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>{t('auth:password', { defaultValue: 'Password' })}</Text>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 48,
    paddingBottom: 48,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 88,
    height: 88,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    textAlign: 'center',
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
    textAlign: 'center',
  },
  fieldContainer: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  simpleInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#0F172A',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  prefixBox: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#F1F5F9',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  prefixText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
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
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
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
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
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
    color: '#0284C7',
    fontSize: 14,
    fontWeight: '600',
  },
  langLink: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  langLinkText: {
    color: '#64748B',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
