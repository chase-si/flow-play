export type FlowPlaybackStatus = "idle" | "playing" | "paused" | "completed";

export interface FlowPlaybackViewportIntent {
  nodeIds?: readonly string[];
  edgeIds?: readonly string[];
  x?: number;
  y?: number;
  zoom?: number;
  padding?: number;
}

export interface FlowPlaybackStep<Metadata = Record<string, unknown>> {
  id: string;
  title: string;
  description?: string;
  nodeIds: readonly string[];
  edgeIds: readonly string[];
  viewport?: FlowPlaybackViewportIntent;
  durationMs?: number;
  metadata?: Metadata;
}

export interface FlowPlaybackPreview {
  initialStepId: string;
  status: "idle";
  stepCount: number;
}

export interface FlowPlaybackState<Metadata = Record<string, unknown>> {
  currentStep: FlowPlaybackStep<Metadata>;
  currentStepIndex: number;
  elapsedMs: number;
  status: FlowPlaybackStatus;
  stepCount: number;
  stepDurationMs: number;
}

export interface CreateFlowPlaybackOptions<Metadata = Record<string, unknown>> {
  steps: readonly FlowPlaybackStep<Metadata>[];
  defaultDurationMs: number;
  onStatusChange?: (status: FlowPlaybackStatus, state: FlowPlaybackState<Metadata>) => void;
  onStepChange?: (step: FlowPlaybackStep<Metadata>, state: FlowPlaybackState<Metadata>) => void;
}

export interface FlowPlaybackController<Metadata = Record<string, unknown>> {
  getState: () => FlowPlaybackState<Metadata>;
  play: () => FlowPlaybackState<Metadata>;
  pause: () => FlowPlaybackState<Metadata>;
  next: () => FlowPlaybackState<Metadata>;
  previous: () => FlowPlaybackState<Metadata>;
  reset: () => FlowPlaybackState<Metadata>;
  goToStep: (stepId: string) => FlowPlaybackState<Metadata>;
  advanceBy: (elapsedMs: number) => FlowPlaybackState<Metadata>;
}

export class FlowPlaybackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlowPlaybackError";
  }
}

export function createFlowPlaybackPreview(
  steps: readonly Pick<FlowPlaybackStep, "id">[]
): FlowPlaybackPreview {
  const firstStep = steps[0];

  if (!firstStep) {
    throw new FlowPlaybackError("Flow playback requires at least one step.");
  }

  return {
    initialStepId: firstStep.id,
    status: "idle",
    stepCount: steps.length
  };
}

export function createFlowPlayback<Metadata = Record<string, unknown>>(
  options: CreateFlowPlaybackOptions<Metadata>
): FlowPlaybackController<Metadata> {
  validateOptions(options);

  const { steps, defaultDurationMs, onStatusChange, onStepChange } = options;
  let currentStepIndex = 0;
  let elapsedMs = 0;
  let status: FlowPlaybackStatus = "idle";

  const getCurrentStep = () => {
    const currentStep = steps[currentStepIndex];

    if (!currentStep) {
      throw new FlowPlaybackError(`Flow playback step index ${currentStepIndex} does not exist.`);
    }

    return currentStep;
  };

  const getStepDurationMs = () => getCurrentStep().durationMs ?? defaultDurationMs;

  const getState = (): FlowPlaybackState<Metadata> => ({
    currentStep: getCurrentStep(),
    currentStepIndex,
    elapsedMs,
    status,
    stepCount: steps.length,
    stepDurationMs: getStepDurationMs()
  });

  const setStatus = (nextStatus: FlowPlaybackStatus) => {
    if (status === nextStatus) {
      return getState();
    }

    status = nextStatus;
    const state = getState();
    onStatusChange?.(status, state);
    return state;
  };

  const moveToStep = (nextStepIndex: number) => {
    if (currentStepIndex === nextStepIndex) {
      elapsedMs = 0;
      return getState();
    }

    currentStepIndex = nextStepIndex;
    elapsedMs = 0;
    const state = getState();
    onStepChange?.(state.currentStep, state);
    return state;
  };

  const complete = () => setStatus("completed");

  return {
    getState,
    play: () => {
      if (status === "completed") {
        return getState();
      }

      return setStatus("playing");
    },
    pause: () => {
      if (status === "completed") {
        return getState();
      }

      return setStatus("paused");
    },
    next: () => {
      if (currentStepIndex >= steps.length - 1) {
        return complete();
      }

      return moveToStep(currentStepIndex + 1);
    },
    previous: () => {
      if (currentStepIndex === 0) {
        elapsedMs = 0;
        return getState();
      }

      if (status === "completed") {
        status = "paused";
      }

      return moveToStep(currentStepIndex - 1);
    },
    reset: () => {
      currentStepIndex = 0;
      elapsedMs = 0;
      status = "idle";
      return getState();
    },
    goToStep: (stepId: string) => {
      const nextStepIndex = steps.findIndex((step) => step.id === stepId);

      if (nextStepIndex === -1) {
        throw new FlowPlaybackError(`Flow playback step "${stepId}" does not exist.`);
      }

      return moveToStep(nextStepIndex);
    },
    advanceBy: (elapsedDeltaMs: number) => {
      if (!Number.isFinite(elapsedDeltaMs) || elapsedDeltaMs < 0) {
        throw new FlowPlaybackError(
          "Flow playback advanceBy elapsedMs must be a non-negative finite number."
        );
      }

      if (status !== "playing") {
        return getState();
      }

      let remainingMs = elapsedDeltaMs;

      while (remainingMs > 0 && status === "playing") {
        const stepDurationMs = getStepDurationMs();
        const nextElapsedMs = elapsedMs + remainingMs;

        if (nextElapsedMs < stepDurationMs) {
          elapsedMs = nextElapsedMs;
          remainingMs = 0;
          continue;
        }

        const consumedMs = stepDurationMs - elapsedMs;
        remainingMs -= consumedMs;
        elapsedMs = stepDurationMs;

        if (currentStepIndex >= steps.length - 1) {
          complete();
          remainingMs = 0;
          continue;
        }

        moveToStep(currentStepIndex + 1);
      }

      return getState();
    }
  };
}

function validateOptions<Metadata>(options: CreateFlowPlaybackOptions<Metadata>) {
  if (options.steps.length === 0) {
    throw new FlowPlaybackError("Flow playback requires at least one step.");
  }

  if (!Number.isFinite(options.defaultDurationMs) || options.defaultDurationMs <= 0) {
    throw new FlowPlaybackError("Flow playback defaultDurationMs must be greater than 0.");
  }

  const stepIds = new Set<string>();

  for (const step of options.steps) {
    if (step.id.length === 0) {
      throw new FlowPlaybackError("Flow playback step IDs must not be empty.");
    }

    if (step.title.length === 0) {
      throw new FlowPlaybackError(`Flow playback step "${step.id}" title must not be empty.`);
    }

    if (!Array.isArray(step.nodeIds)) {
      throw new FlowPlaybackError(`Flow playback step "${step.id}" nodeIds must be an array.`);
    }

    if (!Array.isArray(step.edgeIds)) {
      throw new FlowPlaybackError(`Flow playback step "${step.id}" edgeIds must be an array.`);
    }

    if (stepIds.has(step.id)) {
      throw new FlowPlaybackError(
        `Flow playback step IDs must be unique. Duplicate ID: "${step.id}".`
      );
    }

    stepIds.add(step.id);

    if (
      step.durationMs !== undefined &&
      (!Number.isFinite(step.durationMs) || step.durationMs <= 0)
    ) {
      throw new FlowPlaybackError(
        `Flow playback step "${step.id}" durationMs must be greater than 0 when provided.`
      );
    }
  }
}
