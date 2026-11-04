import { describe, it, expect } from 'vitest';
import { addBusinessDaysIST, calculateHoldAmount } from '../disputes.math.js';
import { disputeStateMachine } from '../disputes.state-machine.js';
import { DISPUTE_STATUS } from '@ap/shared-constants';

describe('Disputes Math & State Machine Tests', () => {
  describe('SLA Business Days Math (IST)', () => {
    it('adds business days within the same week', () => {
      // Wednesday 2026-10-07 (UTC 05:00)
      const wednesday = new Date('2026-10-07T05:00:00Z');
      const due = addBusinessDaysIST(wednesday, 1);

      // Should be Thursday 2026-10-08 at 12:30 UTC (18:00 IST)
      expect(due.toISOString()).toBe('2026-10-08T12:30:00.000Z');
    });

    it('skips Saturday and Sunday when crossing a weekend', () => {
      // Friday 2026-10-09 (UTC 05:00)
      const friday = new Date('2026-10-09T05:00:00Z');
      const due = addBusinessDaysIST(friday, 1);

      // 1 business day from Friday should be Monday 2026-10-12 at 12:30 UTC
      expect(due.toISOString()).toBe('2026-10-12T12:30:00.000Z');
    });

    it('calculates 3 business days SLA correctly', () => {
      // Thursday 2026-10-08
      const thursday = new Date('2026-10-08T05:00:00Z');
      const due = addBusinessDaysIST(thursday, 3);

      // Thu -> Fri (1) -> Mon (2) -> Tue (3)
      expect(due.toISOString()).toBe('2026-10-13T12:30:00.000Z');
    });
  });

  describe('calculateHoldAmount', () => {
    const mockAssignment = {
      totalDays: 30,
      campaign: {
        dailyRentPaise: 150000n, // Rs 1500 / day
        printingAllowancePaise: 25000n, // Rs 250
      },
    };

    it('returns claimed amount directly if provided', () => {
      const hold = calculateHoldAmount({
        reason: 'OTHER',
        assignment: mockAssignment,
        claimedPaise: 50000n,
      });
      expect(hold).toBe(50000n);
    });

    it('holds 1 day rent for photo rejection appeal', () => {
      const hold = calculateHoldAmount({
        reason: 'PHOTO_WRONGLY_REJECTED',
        assignment: mockAssignment,
      });
      expect(hold).toBe(150000n);
    });

    it('holds printing allowance for installation rejection appeal', () => {
      const hold = calculateHoldAmount({
        reason: 'INSTALL_WRONGLY_REJECTED',
        assignment: mockAssignment,
      });
      expect(hold).toBe(25000n);
    });

    it('holds 3 days rent for settlement amount dispute', () => {
      const hold = calculateHoldAmount({
        reason: 'SETTLEMENT_AMOUNT',
        assignment: mockAssignment,
      });
      expect(hold).toBe(450000n);
    });

    it('returns 0 if no campaign or reason has no hold', () => {
      const hold = calculateHoldAmount({
        reason: 'OTHER',
        assignment: null,
      });
      expect(hold).toBe(0n);
    });
  });

  describe('disputeStateMachine', () => {
    it('allows valid standard transition path', () => {
      expect(disputeStateMachine.can(DISPUTE_STATUS.OPEN, DISPUTE_STATUS.UNDER_REVIEW)).toBe(true);
      expect(disputeStateMachine.can(DISPUTE_STATUS.UNDER_REVIEW, DISPUTE_STATUS.RESOLVED)).toBe(true);
    });

    it('allows second-level review reopening', () => {
      expect(disputeStateMachine.can(DISPUTE_STATUS.RESOLVED, DISPUTE_STATUS.UNDER_REVIEW)).toBe(true);
      expect(disputeStateMachine.can(DISPUTE_STATUS.REJECTED, DISPUTE_STATUS.UNDER_REVIEW)).toBe(true);
    });

    it('blocks invalid transitions', () => {
      expect(disputeStateMachine.can(DISPUTE_STATUS.OPEN, DISPUTE_STATUS.RESOLVED)).toBe(false);
      expect(disputeStateMachine.can(DISPUTE_STATUS.WITHDRAWN, DISPUTE_STATUS.UNDER_REVIEW)).toBe(false);
    });
  });
});
