import type { SimulatorContext } from '../harness';
import { resolveEntryRoute } from '../../../src/navigation/resolveEntryRoute';
import { ACCOUNT_STATUS } from '../../../src/shared/constants/index';

export async function runDisciplineDisputesScenario(
  ctx: SimulatorContext,
  driverAuth: { driverUserId: string; driverToken: string },
  assignmentId?: string,
): Promise<void> {
  const { client, testPrisma } = ctx;
  (client as any).setTokens({ accessToken: driverAuth.driverToken, refreshToken: null });

  // 1. Fetch driver disciplinary records (initially clean)
  const disciplineMe: any = await client.driverGetDisciplineMe();
  if (disciplineMe.activeStrikes === undefined && disciplineMe.activeStrikesCount === undefined && disciplineMe.totalStrikesCount === undefined) {
    throw new Error('Discipline me endpoint failed to return strike information');
  }

  // 2. Add 3 strikes to trigger automatic termination / account block
  for (let i = 1; i <= 3; i++) {
    await testPrisma.strike.create({
      data: {
        driverId: driverAuth.driverUserId,
        reason: 'FAKE_OR_OLD_PHOTO',
        notes: `GPS Tampering detected in simulation strike ${i}`,
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
        status: 'ACTIVE',
      },
    });
  }

  // Update user status to BLOCKED in test schema
  await testPrisma.user.update({
    where: { id: driverAuth.driverUserId },
    data: { status: ACCOUNT_STATUS.BLOCKED },
  });

  // Verify routing redirects blocked driver to /blocked
  const blockedRoute = resolveEntryRoute({
    isAuthenticated: true,
    me: { user: { role: 'DRIVER', status: ACCOUNT_STATUS.BLOCKED } } as any,
  });
  if (blockedRoute !== '/blocked') {
    throw new Error(`Expected /blocked route for 3-strike driver, got: ${blockedRoute}`);
  }

  // Reinstate driver status to APPROVED for dispute filing and subsequent tests
  await testPrisma.user.update({
    where: { id: driverAuth.driverUserId },
    data: { status: ACCOUNT_STATUS.APPROVED },
  });

  // Find assignment for dispute
  let targetAssignmentId = assignmentId;
  if (!targetAssignmentId) {
    const existing = await testPrisma.assignment.findFirst({
      where: { driverId: driverAuth.driverUserId },
    });
    targetAssignmentId = existing?.id;
  }
  if (!targetAssignmentId) {
    const anyAssignment = await testPrisma.assignment.findFirst();
    targetAssignmentId = anyAssignment?.id;
  }

  // 3. File appeal dispute
  const disputeRes = await client.driverCreateDispute({
    assignmentId: targetAssignmentId!,
    reason: 'STRIKE_APPEAL',
    description: 'Driver appeals GPS tampering strike; phone was in basement with poor signal.',
  });

  if (!disputeRes.id) {
    throw new Error('Failed to create strike appeal dispute');
  }

  const disputeId = disputeRes.id;

  // 4. Send follow-up evidence message on dispute thread
  await client.addDisputeMessage(
    disputeId,
    {
      body: 'Attaching auto stand parking receipt showing legitimate route.',
    },
    'driver',
  );

  // 5. Admin resolution simulation in test schema
  await testPrisma.dispute.update({
    where: { id: disputeId },
    data: {
      status: 'RESOLVED',
      resolution: 'Appeal reviewed and resolved with warning.',
    },
  });

  // Re-fetch dispute detail in app
  const disputeDetail = await client.getDisputeDetail(disputeId, 'driver');
  if (disputeDetail.status !== 'RESOLVED') {
    throw new Error(`Expected dispute status RESOLVED, got: ${disputeDetail.status}`);
  }

  // Reinstate driver status to APPROVED for subsequent scenarios
  await testPrisma.user.update({
    where: { id: driverAuth.driverUserId },
    data: { status: ACCOUNT_STATUS.APPROVED },
  });
}
