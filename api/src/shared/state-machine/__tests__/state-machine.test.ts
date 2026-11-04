import { describe, it, expect } from 'vitest';
import { CAMPAIGN_STATUS, ASSIGNMENT_STATUS } from '@ap/shared-constants';
import { campaignStateMachine } from '../../../modules/campaigns/campaigns.state-machine.js';
import { assignmentStateMachine } from '../../../modules/assignments/assignments.state-machine.js';
import { InvalidStateTransitionError } from '../../errors/index.js';

describe('shared/state-machine', () => {
  describe('campaignStateMachine', () => {
    it('allows valid campaign transitions', async () => {
      expect(
        campaignStateMachine.can(
          CAMPAIGN_STATUS.DRAFT,
          CAMPAIGN_STATUS.SUBMITTED,
        ),
      ).toBe(true);

      expect(
        campaignStateMachine.can(
          CAMPAIGN_STATUS.SUBMITTED,
          CAMPAIGN_STATUS.UNDER_REVIEW,
        ),
      ).toBe(true);

      expect(
        campaignStateMachine.can(
          CAMPAIGN_STATUS.UNDER_REVIEW,
          CAMPAIGN_STATUS.APPROVED,
        ),
      ).toBe(true);

      expect(
        campaignStateMachine.can(
          CAMPAIGN_STATUS.APPROVED,
          CAMPAIGN_STATUS.AWAITING_PAYMENT,
        ),
      ).toBe(true);

      expect(
        campaignStateMachine.can(
          CAMPAIGN_STATUS.AWAITING_PAYMENT,
          CAMPAIGN_STATUS.LIVE,
        ),
      ).toBe(true);

      expect(
        campaignStateMachine.can(
          CAMPAIGN_STATUS.LIVE,
          CAMPAIGN_STATUS.RUNNING,
        ),
      ).toBe(true);

      expect(
        campaignStateMachine.can(
          CAMPAIGN_STATUS.RUNNING,
          CAMPAIGN_STATUS.COMPLETED,
        ),
      ).toBe(true);

      expect(
        campaignStateMachine.can(
          CAMPAIGN_STATUS.COMPLETED,
          CAMPAIGN_STATUS.SETTLED,
        ),
      ).toBe(true);

      await expect(
        campaignStateMachine.assertTransition(
          CAMPAIGN_STATUS.DRAFT,
          CAMPAIGN_STATUS.SUBMITTED,
        ),
      ).resolves.toBeUndefined();
    });

    it('rejects invalid campaign transitions with InvalidStateTransitionError', async () => {
      expect(
        campaignStateMachine.can(
          CAMPAIGN_STATUS.DRAFT,
          CAMPAIGN_STATUS.RUNNING,
        ),
      ).toBe(false);

      expect(
        campaignStateMachine.can(
          CAMPAIGN_STATUS.SETTLED,
          CAMPAIGN_STATUS.DRAFT,
        ),
      ).toBe(false);

      await expect(
        campaignStateMachine.assertTransition(
          CAMPAIGN_STATUS.DRAFT,
          CAMPAIGN_STATUS.RUNNING,
        ),
      ).rejects.toThrow(InvalidStateTransitionError);
    });
  });

  describe('assignmentStateMachine', () => {
    it('allows valid assignment transitions', async () => {
      expect(
        assignmentStateMachine.can(
          ASSIGNMENT_STATUS.RESERVED,
          ASSIGNMENT_STATUS.INSTALLING,
        ),
      ).toBe(true);

      expect(
        assignmentStateMachine.can(
          ASSIGNMENT_STATUS.INSTALLING,
          ASSIGNMENT_STATUS.INSTALL_SUBMITTED,
        ),
      ).toBe(true);

      expect(
        assignmentStateMachine.can(
          ASSIGNMENT_STATUS.INSTALL_SUBMITTED,
          ASSIGNMENT_STATUS.INSTALL_APPROVED,
        ),
      ).toBe(true);

      expect(
        assignmentStateMachine.can(
          ASSIGNMENT_STATUS.INSTALL_APPROVED,
          ASSIGNMENT_STATUS.RUNNING,
        ),
      ).toBe(true);

      expect(
        assignmentStateMachine.can(
          ASSIGNMENT_STATUS.RUNNING,
          ASSIGNMENT_STATUS.COMPLETED,
        ),
      ).toBe(true);

      expect(
        assignmentStateMachine.can(
          ASSIGNMENT_STATUS.COMPLETED,
          ASSIGNMENT_STATUS.PAID,
        ),
      ).toBe(true);

      await expect(
        assignmentStateMachine.assertTransition(
          ASSIGNMENT_STATUS.RESERVED,
          ASSIGNMENT_STATUS.INSTALLING,
        ),
      ).resolves.toBeUndefined();
    });

    it('rejects invalid assignment transitions with InvalidStateTransitionError', async () => {
      expect(
        assignmentStateMachine.can(
          ASSIGNMENT_STATUS.RESERVED,
          ASSIGNMENT_STATUS.PAID,
        ),
      ).toBe(false);

      await expect(
        assignmentStateMachine.assertTransition(
          ASSIGNMENT_STATUS.RESERVED,
          ASSIGNMENT_STATUS.PAID,
        ),
      ).rejects.toThrow(InvalidStateTransitionError);
    });
  });
});
