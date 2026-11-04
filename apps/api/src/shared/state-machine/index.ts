import { InvalidStateTransitionError } from '../errors/index.js';

export interface StateMachineConfig<TState extends string, TContext = unknown> {
  transitions: Record<TState, readonly TState[]>;
  onTransition?: (
    from: TState,
    to: TState,
    context?: TContext,
  ) => Promise<void> | void;
}

export interface StateMachine<TState extends string, TContext = unknown> {
  can(from: TState, to: TState): boolean;
  assertTransition(
    from: TState,
    to: TState,
    context?: TContext,
  ): Promise<void>;
  getAllowedTransitions(from: TState): readonly TState[];
}

export function createStateMachine<TState extends string, TContext = unknown>(
  config: StateMachineConfig<TState, TContext>,
): StateMachine<TState, TContext> {
  return {
    can(from: TState, to: TState): boolean {
      const allowed = config.transitions[from];
      if (!allowed) {
        return false;
      }
      return allowed.includes(to);
    },

    async assertTransition(
      from: TState,
      to: TState,
      context?: TContext,
    ): Promise<void> {
      if (!this.can(from, to)) {
        throw new InvalidStateTransitionError(
          `Cannot transition from state "${from}" to "${to}". Allowed transitions: [${this.getAllowedTransitions(from).join(', ')}]`,
          { from, to, allowed: this.getAllowedTransitions(from) },
        );
      }

      if (config.onTransition) {
        await config.onTransition(from, to, context);
      }
    },

    getAllowedTransitions(from: TState): readonly TState[] {
      return config.transitions[from] ?? [];
    },
  };
}
