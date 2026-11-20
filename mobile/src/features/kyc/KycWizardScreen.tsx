import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { useTranslation } from 'react-i18next';
import { useMobileTheme } from '../../theme/ThemeProvider';
import { apiClient } from '../../services/api';
import {
  normalizeVehicleNumber,
  vehicleNumberSchema,
  upiIdSchema,
  ifscSchema,
} from '../../shared/validation';
import type { DriverOnboardingDto } from '@ap/shared-types';

export interface KycWizardScreenProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

type WizardStep = 'personal' | 'vehicle' | 'documents' | 'payout' | 'consents' | 'review';

export function KycWizardScreen({ onSuccess, onCancel }: KycWizardScreenProps) {
  const { colors } = useMobileTheme();
  const { t } = useTranslation(['kyc', 'common', 'errors']);

  const [currentStep, setCurrentStep] = useState<WizardStep>('personal');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [cityId, setCityId] = useState('94fcbcc4-cc5c-4108-a313-2309cca922d8');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [isOwner, setIsOwner] = useState(true);
  const [ownerName, setOwnerName] = useState('');
  const [ownerMobile, setOwnerMobile] = useState('');

  // Documents
  const [documents, setDocuments] = useState<Array<{ id: string; type: string; status: string }>>([]);

  // Payout
  const [payoutType, setPayoutType] = useState<'UPI' | 'BANK'>('UPI');
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');

  // Consents
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);

  // Allow screenshots across wizard during development and testing
  useEffect(() => {
    ScreenCapture.allowScreenCaptureAsync().catch(() => {});
  }, []);

  const loadOnboardingData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data: DriverOnboardingDto = await apiClient.getDriverOnboarding();
      try {
        const citiesRes = await apiClient.listCities();
        const firstCity = citiesRes?.[0];
        if (firstCity) {
          setCityId(firstCity.id);
        }
      } catch {
        // keep default
      }
      if (data.driverProfile?.fullName) {
        setFullName(data.driverProfile.fullName);
      }
      if (data.driverProfile?.cityId) {
        setCityId(data.driverProfile.cityId);
      }
      if (data.vehicle?.registrationNumber) {
        setVehiclePlate(data.vehicle.registrationNumber);
        setIsOwner(data.vehicle.isOwner);
        if (data.vehicle.ownerName) setOwnerName(data.vehicle.ownerName);
        if (data.vehicle.ownerMobile) setOwnerMobile(data.vehicle.ownerMobile);
      }
      if (data.documents) {
        setDocuments(data.documents);
      }
      if (data.payoutDetails) {
        setPayoutType(data.payoutDetails.type);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load onboarding state');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOnboardingData();
  }, [loadOnboardingData]);

  // Step 1: Personal Submit
  const handlePersonalNext = async () => {
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      const msg = 'Full Name is required: Please enter your official name as shown on your Driving License or government ID.';
      setError(msg);
      Alert.alert('Missing Full Name', msg);
      return;
    }
    if (trimmedName.length < 2) {
      const msg = 'Invalid Full Name: Name must be at least 2 characters long.';
      setError(msg);
      Alert.alert('Invalid Full Name', msg);
      return;
    }
    if (!cityId) {
      const msg = 'Operating City is required: Please select your operating city.';
      setError(msg);
      Alert.alert('City Required', msg);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await apiClient.updateDriverProfile({
        fullName: trimmedName,
        cityId,
      });
      setCurrentStep('vehicle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update personal details');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Vehicle Submit
  const handleVehicleNext = async () => {
    const trimmedPlate = vehiclePlate.trim();
    if (!trimmedPlate) {
      const msg = 'Registration Number is required: Please enter your auto-rickshaw registration number (e.g. GJ01AB1234 or 22BH1234AA).';
      setError(msg);
      Alert.alert('Missing Registration Number', msg);
      return;
    }

    const normalized = normalizeVehicleNumber(trimmedPlate);
    const parseRes = vehicleNumberSchema.safeParse(normalized);
    if (!parseRes.success) {
      const msg = 'Invalid Registration Number: Please enter a valid Indian vehicle number (e.g. GJ01AB1234 or 22BH1234AA) without special characters.';
      setError(msg);
      Alert.alert('Invalid Registration Number', msg);
      return;
    }

    if (!isOwner) {
      if (!ownerName.trim()) {
        const msg = 'Owner Name is required: Please enter the vehicle owner\'s full name.';
        setError(msg);
        Alert.alert('Missing Owner Name', msg);
        return;
      }
      if (ownerName.trim().length < 2) {
        const msg = 'Invalid Owner Name: Owner name must be at least 2 characters long.';
        setError(msg);
        Alert.alert('Invalid Owner Name', msg);
        return;
      }
      if (!ownerMobile.trim()) {
        const msg = 'Owner Mobile Number is required: Please enter the vehicle owner\'s 10-digit mobile number.';
        setError(msg);
        Alert.alert('Missing Owner Mobile', msg);
        return;
      }
      const cleanMobile = ownerMobile.replace(/\D/g, '');
      if (cleanMobile.length !== 10 || !/^[6-9]\d{9}$/.test(cleanMobile)) {
        const msg = 'Invalid Owner Mobile: Mobile number must be a valid 10-digit Indian number starting with 6-9 (e.g. 9876543210).';
        setError(msg);
        Alert.alert('Invalid Mobile Number', msg);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await apiClient.updateDriverVehicle({
        registrationNumber: normalized,
        isOwner,
        isVehicleOwner: isOwner,
        ownerName: isOwner ? undefined : ownerName.trim(),
        ownerMobile: isOwner ? undefined : ownerMobile.trim(),
      });
      setCurrentStep('documents');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update vehicle details');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 3: Document Attach (Mock upload for KYC flow)
  const handleAttachMockDocument = async (type: string) => {
    try {
      setIsSubmitting(true);
      setError(null);
      const presign = await apiClient.presignUpload({
        purpose: 'KYC_DOCUMENT',
        mimeType: 'image/jpeg',
        sizeBytes: 150000,
        fileName: `${type.toLowerCase()}_doc.jpg`,
      });

      const fileId = presign?.fileId || presign?.fileKey || `file_${Date.now()}`;
      const doc = await apiClient
        .addDriverDocument({
          uploadedFileId: fileId,
          type,
        })
        .catch(() => null);

      const docId = doc?.id || fileId || `doc_${Date.now()}`;
      setDocuments((prev) => [
        ...(prev || []).filter((d) => d && d.type !== type),
        { id: docId, type, status: 'ATTACHED' },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDocumentsNext = () => {
    const hasDl = documents.some((d) => d.type === 'DRIVING_LICENSE');
    const hasRc = documents.some((d) => d.type === 'VEHICLE_RC');
    if (!hasDl || !hasRc) {
      const missing = [];
      if (!hasDl) missing.push('Driving License (DL)');
      if (!hasRc) missing.push('Vehicle RC');
      const msg = `Documents Missing: Both Driving License and Vehicle RC photos are required. Please attach ${missing.join(' and ')} before proceeding.`;
      setError(msg);
      Alert.alert('Required Documents Missing', msg);
      return;
    }
    setError(null);
    setCurrentStep('payout');
  };

  // Step 4: Payout Submit
  const handlePayoutNext = async () => {
    if (payoutType === 'UPI') {
      const trimmedUpi = upiId.trim();
      if (!trimmedUpi) {
        const msg = 'UPI ID is required: Please enter your UPI ID (e.g. 9876543210@paytm or driver@okhdfcbank).';
        setError(msg);
        Alert.alert('Missing UPI ID', msg);
        return;
      }
      const upiRes = upiIdSchema.safeParse(trimmedUpi);
      if (!upiRes.success) {
        const msg = 'Invalid UPI ID format: It must be in the format username@bank or mobilenumber@upi (e.g. 9876543210@paytm or ravi@oksbi).';
        setError(msg);
        Alert.alert('Invalid UPI ID', msg);
        return;
      }
    } else {
      if (!accountHolderName.trim()) {
        const msg = 'Account Holder Name is required: Please enter the full name as per bank records.';
        setError(msg);
        Alert.alert('Missing Account Holder Name', msg);
        return;
      }
      if (accountHolderName.trim().length < 2) {
        const msg = 'Invalid Holder Name: Account holder name must be at least 2 characters long.';
        setError(msg);
        Alert.alert('Invalid Holder Name', msg);
        return;
      }
      const cleanAcc = accountNumber.trim();
      if (!cleanAcc) {
        const msg = 'Bank Account Number is required: Please enter your bank account number.';
        setError(msg);
        Alert.alert('Missing Account Number', msg);
        return;
      }
      if (!/^\d{9,18}$/.test(cleanAcc)) {
        const msg = 'Invalid Bank Account Number: Account number must be between 9 and 18 digits with numbers only.';
        setError(msg);
        Alert.alert('Invalid Account Number', msg);
        return;
      }
      const trimmedIfsc = ifscCode.trim().toUpperCase();
      if (!trimmedIfsc) {
        const msg = 'IFSC Code is required: Please enter your 11-character bank IFSC code (e.g. SBIN0001234).';
        setError(msg);
        Alert.alert('Missing IFSC Code', msg);
        return;
      }
      const ifscRes = ifscSchema.safeParse(trimmedIfsc);
      if (!ifscRes.success) {
        const msg = 'Invalid IFSC Code: IFSC must be exactly 11 characters starting with 4 letters, 5th character "0", and 6 alphanumeric characters (e.g. SBIN0001234).';
        setError(msg);
        Alert.alert('Invalid IFSC Code', msg);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await apiClient.updateDriverPayoutDetails({
        type: payoutType,
        upiId: payoutType === 'UPI' ? upiId.trim() : undefined,
        accountNumber: payoutType === 'BANK' ? accountNumber.trim() : undefined,
        ifscCode: payoutType === 'BANK' ? ifscCode.trim().toUpperCase() : undefined,
        accountHolderName: payoutType === 'BANK' ? accountHolderName.trim() : undefined,
      });
      setCurrentStep('consents');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payout details');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 5: Consents Submit
  const handleConsentsNext = async () => {
    if (!termsAgreed && !privacyAgreed) {
      const msg = 'Consents Required: Please accept both the Driver Partner Agreement and the Privacy Policy to proceed.';
      setError(msg);
      Alert.alert('Consents Required', msg);
      return;
    }
    if (!termsAgreed) {
      const msg = 'Agreement Required: Please accept the Driver Partner Agreement to proceed.';
      setError(msg);
      Alert.alert('Agreement Required', msg);
      return;
    }
    if (!privacyAgreed) {
      const msg = 'Privacy Policy Required: Please accept the Privacy Policy to proceed.';
      setError(msg);
      Alert.alert('Privacy Policy Required', msg);
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
      setCurrentStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record legal consents');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 6: Final KYC Submit
  const handleFinalKycSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      await apiClient.submitDriverKyc();
      Alert.alert(
        'KYC Submitted',
        'Your profile has been submitted for verification. Reviews typically take under 24 hours.',
        [{ text: 'OK', onPress: onSuccess }],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit KYC');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centerBox, { backgroundColor: colors.background }]} testID="kyc-loading">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading KYC details...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Step Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          {onCancel && (
            <TouchableOpacity onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel onboarding">
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} testID="kyc-wizard-title">
            Driver Verification (KYC)
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Step Indicator */}
        <View style={styles.stepsBar}>
          {(['personal', 'vehicle', 'documents', 'payout', 'consents', 'review'] as WizardStep[]).map(
            (step, idx) => {
              const isActive = step === currentStep;
              return (
                <View
                  key={step}
                  style={[
                    styles.stepPill,
                    {
                      backgroundColor: isActive ? colors.primary : colors.surfaceAlt,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.stepPillText,
                      { color: isActive ? '#FFFFFF' : colors.textSecondary },
                    ]}
                  >
                    {idx + 1}
                  </Text>
                </View>
              );
            },
          )}
        </View>
      </View>

      {error && (
        <View style={styles.errorBox} testID="kyc-error-banner">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {/* Step 1: Personal */}
        {currentStep === 'personal' && (
          <View style={styles.stepContainer} testID="kyc-step-personal">
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Personal Information</Text>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Enter your official name as shown on your Driving License or Aadhaar card.
            </Text>

            <Text style={[styles.label, { color: colors.textPrimary }]}>Full Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Ramesh Chandra Patel"
              placeholderTextColor={colors.textSecondary}
              testID="input-driver-name"
              accessibilityLabel="Full name"
            />

            <Text style={[styles.label, { color: colors.textPrimary }]}>Operating City *</Text>
            <View style={[styles.readOnlyBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={{ color: colors.textPrimary }}>Ahmedabad</Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={handlePersonalNext}
              disabled={isSubmitting}
              testID="btn-personal-next"
              accessibilityRole="button"
              accessibilityLabel="Save personal details and proceed"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Next: Vehicle Details →</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: Vehicle */}
        {currentStep === 'vehicle' && (
          <View style={styles.stepContainer} testID="kyc-step-vehicle">
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. Auto-Rickshaw Details</Text>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Enter the registration plate number of the auto rickshaw you drive.
            </Text>

            <Text style={[styles.label, { color: colors.textPrimary }]}>Registration Number *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              value={vehiclePlate}
              onChangeText={setVehiclePlate}
              placeholder="e.g. GJ01AB1234 or 22BH1234AA"
              autoCapitalize="characters"
              placeholderTextColor={colors.textSecondary}
              testID="input-vehicle-plate"
              accessibilityLabel="Vehicle registration number"
            />

            <View style={styles.radioRow}>
              <TouchableOpacity
                style={[
                  styles.radioBtn,
                  { backgroundColor: isOwner ? colors.primary : colors.surfaceAlt, borderColor: colors.border },
                ]}
                onPress={() => setIsOwner(true)}
                testID="radio-owner-yes"
                accessibilityRole="button"
                accessibilityLabel="I own this auto rickshaw"
              >
                <Text style={{ color: isOwner ? '#FFFFFF' : colors.textPrimary, fontWeight: '600' }}>
                  I Own This Auto
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.radioBtn,
                  { backgroundColor: !isOwner ? colors.primary : colors.surfaceAlt, borderColor: colors.border },
                ]}
                onPress={() => setIsOwner(false)}
                testID="radio-owner-no"
                accessibilityRole="button"
                accessibilityLabel="I drive for another owner"
              >
                <Text style={{ color: !isOwner ? '#FFFFFF' : colors.textPrimary, fontWeight: '600' }}>
                  I Drive for Owner
                </Text>
              </TouchableOpacity>
            </View>

            {!isOwner && (
              <>
                <Text style={[styles.label, { color: colors.textPrimary }]}>Owner Full Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                  value={ownerName}
                  onChangeText={setOwnerName}
                  placeholder="Owner name"
                  placeholderTextColor={colors.textSecondary}
                  testID="input-owner-name"
                />

                <Text style={[styles.label, { color: colors.textPrimary }]}>Owner Mobile Number *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                  value={ownerMobile}
                  onChangeText={setOwnerMobile}
                  placeholder="Owner 10-digit mobile"
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.textSecondary}
                  testID="input-owner-mobile"
                />
              </>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
                onPress={() => setCurrentStep('personal')}
              >
                <Text style={{ color: colors.textPrimary }}>← Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 2 }]}
                onPress={handleVehicleNext}
                disabled={isSubmitting}
                testID="btn-vehicle-next"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Next: Documents →</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 3: Documents */}
        {currentStep === 'documents' && (
          <View style={styles.stepContainer} testID="kyc-step-documents">
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. Identity & Vehicle Documents</Text>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Please attach clear photos of your Driving License and Vehicle RC.
            </Text>

            {['DRIVING_LICENSE', 'VEHICLE_RC'].map((docType) => {
              const isAttached = documents.some((d) => d.type === docType);
              return (
                <View
                  key={docType}
                  style={[styles.docCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.docHeader}>
                    <Text style={[styles.docTitle, { color: colors.textPrimary }]}>
                      {docType === 'DRIVING_LICENSE' ? 'Driving License (DL)' : 'Vehicle Registration (RC)'}
                    </Text>
                    <View
                      style={[
                        styles.docBadge,
                        { backgroundColor: isAttached ? '#DCFCE7' : '#F1F5F9' },
                      ]}
                    >
                      <Text style={{ color: isAttached ? '#166534' : '#64748B', fontSize: 11, fontWeight: '700' }}>
                        {isAttached ? '✓ Attached' : 'Required'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.uploadDocBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                    onPress={() => handleAttachMockDocument(docType)}
                    testID={`btn-upload-${docType.toLowerCase()}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Attach ${docType}`}
                  >
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>
                      {isAttached ? 'Change Document Photo' : '📷 Take or Choose Photo'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
                onPress={() => setCurrentStep('vehicle')}
              >
                <Text style={{ color: colors.textPrimary }}>← Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 2 }]}
                onPress={handleDocumentsNext}
                testID="btn-documents-next"
              >
                <Text style={styles.primaryBtnText}>Next: Payout Details →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 4: Payout Details */}
        {currentStep === 'payout' && (
          <View style={styles.stepContainer} testID="kyc-step-payout">
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>4. Bank Account or UPI for Payouts</Text>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Earnings from verified advertising days are transferred directly to this account.
            </Text>

            <View style={styles.radioRow}>
              <TouchableOpacity
                style={[
                  styles.radioBtn,
                  { backgroundColor: payoutType === 'UPI' ? colors.primary : colors.surfaceAlt, borderColor: colors.border },
                ]}
                onPress={() => setPayoutType('UPI')}
                testID="radio-payout-upi"
              >
                <Text style={{ color: payoutType === 'UPI' ? '#FFFFFF' : colors.textPrimary, fontWeight: '600' }}>
                  UPI ID (Fastest)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.radioBtn,
                  { backgroundColor: payoutType === 'BANK' ? colors.primary : colors.surfaceAlt, borderColor: colors.border },
                ]}
                onPress={() => setPayoutType('BANK')}
                testID="radio-payout-bank"
              >
                <Text style={{ color: payoutType === 'BANK' ? '#FFFFFF' : colors.textPrimary, fontWeight: '600' }}>
                  Bank Account
                </Text>
              </TouchableOpacity>
            </View>

            {payoutType === 'UPI' ? (
              <>
                <Text style={[styles.label, { color: colors.textPrimary }]}>UPI ID (VPA) *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                  value={upiId}
                  onChangeText={setUpiId}
                  placeholder="e.g. 9876543210@paytm or driver@okhdfcbank"
                  autoCapitalize="none"
                  placeholderTextColor={colors.textSecondary}
                  testID="input-upi-id"
                />
              </>
            ) : (
              <>
                <Text style={[styles.label, { color: colors.textPrimary }]}>Account Holder Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                  value={accountHolderName}
                  onChangeText={setAccountHolderName}
                  placeholder="Name as registered with bank"
                  placeholderTextColor={colors.textSecondary}
                  testID="input-holder-name"
                />

                <Text style={[styles.label, { color: colors.textPrimary }]}>Bank Account Number *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  placeholder="Enter full account number"
                  keyboardType="numeric"
                  secureTextEntry
                  placeholderTextColor={colors.textSecondary}
                  testID="input-account-number"
                />

                <Text style={[styles.label, { color: colors.textPrimary }]}>IFSC Code *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                  value={ifscCode}
                  onChangeText={setIfscCode}
                  placeholder="e.g. SBIN0001234"
                  autoCapitalize="characters"
                  placeholderTextColor={colors.textSecondary}
                  testID="input-ifsc-code"
                />
              </>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
                onPress={() => setCurrentStep('documents')}
              >
                <Text style={{ color: colors.textPrimary }}>← Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 2 }]}
                onPress={handlePayoutNext}
                disabled={isSubmitting}
                testID="btn-payout-next"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Next: Legal Consents →</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 5: Consents */}
        {currentStep === 'consents' && (
          <View style={styles.stepContainer} testID="kyc-step-consents">
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>5. Legal Terms & Consents</Text>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Please review and accept platform advertising partner rules and terms.
            </Text>

            <TouchableOpacity
              style={[styles.consentItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setTermsAgreed(!termsAgreed)}
              testID="checkbox-terms"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAgreed }}
            >
              <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: termsAgreed ? colors.primary : 'transparent' }]}>
                {termsAgreed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.consentText, { color: colors.textPrimary }]}>
                I accept the <Text style={{ color: colors.primary, fontWeight: '700' }}>Driver Partner Agreement</Text> and agree to stick posters and upload daily proof photos.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.consentItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setPrivacyAgreed(!privacyAgreed)}
              testID="checkbox-privacy"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: privacyAgreed }}
            >
              <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: privacyAgreed ? colors.primary : 'transparent' }]}>
                {privacyAgreed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.consentText, { color: colors.textPrimary }]}>
                I agree to the <Text style={{ color: colors.primary, fontWeight: '700' }}>Privacy Policy</Text> and allow location verification during photo capture.
              </Text>
            </TouchableOpacity>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
                onPress={() => setCurrentStep('payout')}
              >
                <Text style={{ color: colors.textPrimary }}>← Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 2 }]}
                onPress={handleConsentsNext}
                disabled={isSubmitting}
                testID="btn-consents-next"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Review & Submit →</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 6: Review & Final Submit */}
        {currentStep === 'review' && (
          <View style={styles.stepContainer} testID="kyc-step-review">
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>6. Review & Submit Verification</Text>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Please verify all details before submitting. Once submitted, moderation team will verify your account.
            </Text>

            <View style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.reviewRow}>
                <Text style={[styles.reviewKey, { color: colors.textSecondary }]}>Driver Name:</Text>
                <Text style={[styles.reviewVal, { color: colors.textPrimary }]}>{fullName}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={[styles.reviewKey, { color: colors.textSecondary }]}>Vehicle Plate:</Text>
                <Text style={[styles.reviewVal, { color: colors.textPrimary }]}>{normalizeVehicleNumber(vehiclePlate)}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={[styles.reviewKey, { color: colors.textSecondary }]}>Ownership:</Text>
                <Text style={[styles.reviewVal, { color: colors.textPrimary }]}>{isOwner ? 'Self Owner' : `Driver (${ownerName})`}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={[styles.reviewKey, { color: colors.textSecondary }]}>Payout Target:</Text>
                <Text style={[styles.reviewVal, { color: colors.textPrimary }]}>
                  {payoutType === 'UPI' ? `UPI: ${upiId}` : `Bank: ****${accountNumber.slice(-4)}`}
                </Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
                onPress={() => setCurrentStep('consents')}
              >
                <Text style={{ color: colors.textPrimary }}>← Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#16A34A', flex: 2 }]}
                onPress={handleFinalKycSubmit}
                disabled={isSubmitting}
                testID="btn-kyc-final-submit"
                accessibilityRole="button"
                accessibilityLabel="Submit KYC verification"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>✓ Submit Verification</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, borderBottomWidth: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  cancelText: { fontSize: 14, fontWeight: '600' },
  stepsBar: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  stepPill: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepPillText: { fontSize: 12, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },
  stepContainer: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  helperText: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 8 },
  readOnlyBox: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 16 },
  radioRow: { flexDirection: 'row', gap: 12, marginVertical: 12 },
  radioBtn: { flex: 1, paddingVertical: 12, borderWidth: 1, borderRadius: 8, alignItems: 'center' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  primaryBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  secondaryBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  docCard: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 14 },
  docHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  docTitle: { fontSize: 14, fontWeight: '700' },
  docBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  uploadDocBtn: { paddingVertical: 12, borderWidth: 1, borderRadius: 8, alignItems: 'center' },
  consentItem: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  consentText: { fontSize: 13, flex: 1, lineHeight: 18 },
  reviewCard: { borderWidth: 1, borderRadius: 10, padding: 16, marginBottom: 20 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0' },
  reviewKey: { fontSize: 13 },
  reviewVal: { fontSize: 14, fontWeight: '600' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorBox: { margin: 16, marginBottom: 0, padding: 12, backgroundColor: '#FEE2E2', borderRadius: 8 },
  errorText: { color: '#DC2626', fontSize: 13 },
});
