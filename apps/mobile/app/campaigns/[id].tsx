import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CampaignDetailScreen } from '../../src/features/campaigns';

export default function DriverCampaignDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <CampaignDetailScreen
      campaignId={id as string}
      onBack={() => {
        router.back();
      }}
    />
  );
}

