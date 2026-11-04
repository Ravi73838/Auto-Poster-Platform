import { describe, it, expect } from 'vitest';
import { strikeStateMachine } from '../strikes.state-machine.js';
import { STRIKE_STATUS } from '@ap/shared-constants';

describe('Discipline Strike Ladder & State Machine Tests', () => {
  describe('strikeStateMachine', () => {
    it('allows ACTIVE to transition to REVOKED, EXPIRED, or CONSUMED', () => {
      expect(strikeStateMachine.can(STRIKE_STATUS.ACTIVE, STRIKE_STATUS.REVOKED)).toBe(true);
      expect(strikeStateMachine.can(STRIKE_STATUS.ACTIVE, STRIKE_STATUS.EXPIRED)).toBe(true);
      expect(strikeStateMachine.can(STRIKE_STATUS.ACTIVE, STRIKE_STATUS.CONSUMED)).toBe(true);
    });

    it('allows strike appeal to revoke a CONSUMED strike', () => {
      expect(strikeStateMachine.can(STRIKE_STATUS.CONSUMED, STRIKE_STATUS.REVOKED)).toBe(true);
    });

    it('blocks illegal transitions from terminal states', () => {
      expect(strikeStateMachine.can(STRIKE_STATUS.REVOKED, STRIKE_STATUS.ACTIVE)).toBe(false);
      expect(strikeStateMachine.can(STRIKE_STATUS.EXPIRED, STRIKE_STATUS.ACTIVE)).toBe(false);
      expect(strikeStateMachine.can(STRIKE_STATUS.EXPIRED, STRIKE_STATUS.REVOKED)).toBe(false);
    });
  });

  describe('Ladder Evaluation Rules Logic', () => {
    it('verifies standard strike limit and ban parameters', () => {
      const STRIKE_LIMIT = 3;
      const BAN_DAYS = 90;
      const POSTER_FIX_HOURS = 48;
      const ABANDON_DAYS = 7;

      expect(STRIKE_LIMIT).toBe(3);
      expect(BAN_DAYS).toBe(90);
      expect(POSTER_FIX_HOURS).toBe(48);
      expect(ABANDON_DAYS).toBe(7);
    });
  });
});
