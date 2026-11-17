import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMobileTheme } from '../src/theme/ThemeProvider';
import { apiClient } from '../src/services/api';

export default function ConsentGateScreen() {
  const { colors } = useMobileTheme();
  const { t: _t } = useTranslation(['common']);
  const router = useRouter();

  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!termsAgreed || !privacyAgreed) {
      Alert.alert('Required', 'You must review and accept the terms to continue using the application.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await apiClient.submitDriverConsents({
        consents: [
          { type: 'DRIVER_AGREEMENT', version: '1.0' },
          { type: 'PRIVACY_POLICY', version: '1.0' },
        ],
      });
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record consent');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="consent-gate-card">
        <Text style={[styles.title, { color: colors.textPrimary }]}>Updated Terms & Policy</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          Before you proceed, please read and accept the updated terms of service and driver partner agreement.
        </Text>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.consentItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          onPress={() => setTermsAgreed(!termsAgreed)}
          testID="consent-terms-checkbox"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: termsAgreed }}
        >
          <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: termsAgreed ? colors.primary : 'transparent' }]}>
            {termsAgreed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.consentText, { color: colors.textPrimary }]}>
            I have read and agree to the <Text style={{ color: colors.primary, fontWeight: '700' }}>Driver Partner Terms</Text>.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.consentItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          onPress={() => setPrivacyAgreed(!privacyAgreed)}
          testID="consent-privacy-checkbox"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: privacyAgreed }}
        >
          <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: privacyAgreed ? colors.primary : 'transparent' }]}>
            {privacyAgreed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.consentText, { color: colors.textPrimary }]}>
            I consent to the <Text style={{ color: colors.primary, fontWeight: '700' }}>Privacy Policy</Text> and location verification rules.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: termsAgreed && privacyAgreed ? colors.primary : '#94A3B8' },
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting || !termsAgreed || !privacyAgreed}
          testID="btn-accept-consents"
          accessibilityRole="button"
          accessibilityLabel="Accept consents and continue"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Accept & Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, justifyContent: 'center' },
  card: { borderRadius: 16, borderWidth: 1, padding: 24 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  desc: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  consentItem: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  consentText: { fontSize: 13, flex: 1, lineHeight: 18 },
  primaryBtn: { width: '100%', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  errorBanner: { padding: 10, backgroundColor: '#FEE2E2', borderRadius: 8, marginBottom: 14 },
  errorText: { color: '#DC2626', fontSize: 13 },
});
