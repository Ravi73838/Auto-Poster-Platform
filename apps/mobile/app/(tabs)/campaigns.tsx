import React from 'react';
import { useRouter } from 'expo-router';
import { CampaignsScreen } from '../../src/features/campaigns';

export default function DriverCampaignsTab() {
  const router = useRouter();

  return (
    <CampaignsScreen
      onSelectCampaign={(id) => {
        router.push(`/campaigns/${id}`);
      }}
    />
  );
}
