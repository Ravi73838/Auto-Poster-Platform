import { DISPUTE_STATUS, type DisputeStatus } from '@ap/shared-constants';
import {
  createStateMachine,
  type StateMachine,
} from '../../shared/state-machine/index.js';

export const DISPUTE_TRANSITIONS: Record<
  DisputeStatus,
  readonly DisputeStatus[]
> = {
  [DISPUTE_STATUS.OPEN]: [
    DISPUTE_STATUS.UNDER_REVIEW,
    DISPUTE_STATUS.WITHDRAWN,
  ],
  [DISPUTE_STATUS.UNDER_REVIEW]: [
    DISPUTE_STATUS.RESOLVED,
    DISPUTE_STATUS.REJECTED,
  ],
  [DISPUTE_STATUS.RESOLVED]: [
    DISPUTE_STATUS.UNDER_REVIEW, // Second-level review by Super Admin
  ],
  [DISPUTE_STATUS.REJECTED]: [
    DISPUTE_STATUS.UNDER_REVIEW, // Second-level review by Super Admin
  ],
  [DISPUTE_STATUS.WITHDRAWN]: [],
};

export const disputeStateMachine: StateMachine<DisputeStatus> =
  createStateMachine({
    transitions: DISPUTE_TRANSITIONS,
  });

