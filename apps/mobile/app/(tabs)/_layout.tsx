import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMobileTheme } from '../../src/theme/ThemeProvider';

export default function TabLayout() {
  const { colors } = useMobileTheme();
  const { t } = useTranslation(['common', 'settings']);

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.textPrimary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('common:dashboard'),
        }}
      />
      <Tabs.Screen
        name="campaigns"
        options={{
          title: 'Campaigns',
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Earnings',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('settings:title'),
        }}
      />
    </Tabs>
  );
}

