import { STRIKE_STATUS, type StrikeStatus } from '@ap/shared-constants';
import {
  createStateMachine,
  type StateMachine,
} from '../../shared/state-machine/index.js';

export const STRIKE_TRANSITIONS: Record<
  StrikeStatus,
  readonly StrikeStatus[]
> = {
  [STRIKE_STATUS.ACTIVE]: [
    STRIKE_STATUS.REVOKED,
    STRIKE_STATUS.EXPIRED,
    STRIKE_STATUS.CONSUMED,
  ],
  [STRIKE_STATUS.REVOKED]: [],
  [STRIKE_STATUS.EXPIRED]: [],
  [STRIKE_STATUS.CONSUMED]: [
    STRIKE_STATUS.REVOKED, // Strike appeal revoking a consumed strike
  ],
};

export const strikeStateMachine: StateMachine<StrikeStatus> =
  createStateMachine({
    transitions: STRIKE_TRANSITIONS,
  });

