import type { SimulatorContext } from '../harness';

export async function runCampaignsScenario(
  ctx: SimulatorContext,
  driverAuth: { driverUserId: string; driverToken: string },
): Promise<{ assignmentId: string }> {
  const { client, testCampaignId } = ctx;
  (client as any).setTokens({ accessToken: driverAuth.driverToken, refreshToken: null });

  // 1. Browse campaigns
  const campaignsRes = await client.listDriverCampaigns();
  const items = Array.isArray(campaignsRes) ? campaignsRes : (campaignsRes as any)?.items || [];
  if (items.length === 0) {
    throw new Error('Driver campaigns list returned empty');
  }

  // 2. Fetch campaign details
  const detail = await client.getDriverCampaignDetail(testCampaignId);
  if (!detail || detail.id !== testCampaignId) {
    throw new Error('Failed to fetch campaign details for test campaign');
  }

  // 3. Select and reserve campaign slot
  const selectRes: any = await client.selectCampaign(testCampaignId);
  const assignmentId = selectRes?.assignment?.id || selectRes?.id;
  if (!assignmentId) {
    throw new Error('Selecting campaign slot failed to create assignment');
  }

  // 4. Vehicle busy rejection: trying to reserve another campaign simultaneously
  let busyRejected = false;
  try {
    await client.selectCampaign(testCampaignId);
  } catch (err: any) {
    if (err?.code === 'ASSIGNMENT_ALREADY_ACTIVE' || err?.code === 'ASSIGNMENT_VEHICLE_BUSY' || err?.status === 409) {
      busyRejected = true;
    }
  }
  if (!busyRejected) {
    throw new Error('Driver with active assignment was allowed to select another campaign concurrently');
  }

  return { assignmentId };
}
