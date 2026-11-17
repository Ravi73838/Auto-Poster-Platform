import { Stack } from 'expo-router';
import { useMobileTheme } from '../../src/theme/ThemeProvider';

export default function OnboardingLayout() {
  const { colors } = useMobileTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="wizard" options={{ title: 'Driver KYC', headerShown: false }} />
      <Stack.Screen name="status" options={{ title: 'KYC Status', headerShown: false }} />
    </Stack>
  );
}
