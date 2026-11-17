import { Stack } from 'expo-router';
import { useMobileTheme } from '../../src/theme/ThemeProvider';

export default function PublicLayout() {
  const { colors } = useMobileTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="language" options={{ title: 'Select Language', headerShown: false }} />
      <Stack.Screen name="maintenance" options={{ title: 'Maintenance', headerShown: false }} />
      <Stack.Screen name="update-required" options={{ title: 'Update Required', headerShown: false }} />
    </Stack>
  );
}
