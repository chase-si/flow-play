export type FlowPlaybackStatus = "idle" | "playing" | "paused" | "completed";

export interface FlowPlaybackViewportIntent {
  nodeIds?: readonly string[];
  edgeIds?: readonly string[];
  x?: number;
  y?: number;
  zoom?: number;
  padding?: number;
}

export type FlowStepType = "highlight";

export interface FlowHighlightStep<Metadata = Record<string, unknown>> {
  id: string;
  type: "highlight";
  title: string;
  description?: string;
  playbackEnabled?: boolean;
  nodeIds: readonly string[];
  edgeIds: readonly string[];
  viewport?: FlowPlaybackViewportIntent;
  durationMs?: number;
  metadata?: Metadata;
}

export type FlowStep<Metadata = Record<string, unknown>> = FlowHighlightStep<Metadata>;

export type FlowPlaybackStep<Metadata = Record<string, unknown>> = FlowStep<Metadata>;

export interface FlowPlay<Metadata = Record<string, unknown>> {
  steps: readonly FlowStep<Metadata>[];
}

export interface FlowPlaybackPreview {
  initialStepId: string | undefined;
  status: "idle";
  stepCount: number;
}

export interface FlowPlaybackState<Metadata = Record<string, unknown>> {
  currentStep: FlowStep<Metadata> | undefined;
  currentStepIndex: number;
  elapsedMs: number;
  status: FlowPlaybackStatus;
  stepCount: number;
  stepDurationMs: number;
}

export interface FlowStepListItem {
  id: string;
  type: FlowStepType;
  typeLabel: string;
  title: string;
  playbackEnabled: boolean;
}

export interface CreateFlowPlaybackOptions<Metadata = Record<string, unknown>> {
  steps: readonly FlowStep<Metadata>[];
  defaultDurationMs: number;
  onStatusChange?: (status: FlowPlaybackStatus, state: FlowPlaybackState<Metadata>) => void;
  onStepChange?: (step: FlowStep<Metadata>, state: FlowPlaybackState<Metadata>) => void;
}

export interface FlowPlaybackController<Metadata = Record<string, unknown>> {
  getState: () => FlowPlaybackState<Metadata>;
  getStepList: () => FlowStepListItem[];
  play: () => FlowPlaybackState<Metadata>;
  pause: () => FlowPlaybackState<Metadata>;
  next: () => FlowPlaybackState<Metadata>;
  previous: () => FlowPlaybackState<Metadata>;
  reset: () => FlowPlaybackState<Metadata>;
  goToStep: (stepId: string) => FlowPlaybackState<Metadata>;
  setStepPlaybackEnabled: (stepId: string, playbackEnabled: boolean) => FlowPlaybackState<Metadata>;
  deleteStep: (stepId: string) => FlowPlaybackState<Metadata>;
  advanceBy: (elapsedMs: number) => FlowPlaybackState<Metadata>;
}

export class FlowPlaybackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlowPlaybackError";
  }
}

export function createFlowPlaybackPreview(
  steps: readonly Pick<FlowStep, "id" | "playbackEnabled">[]
): FlowPlaybackPreview {
  const playbackQueue = projectPlaybackQueue(steps);
  const firstStep = playbackQueue[0];

  return {
    initialStepId: firstStep?.id,
    status: "idle",
    stepCount: playbackQueue.length
  };
}

export function createFlowPlayback<Metadata = Record<string, unknown>>(
  options: CreateFlowPlaybackOptions<Metadata>
): FlowPlaybackController<Metadata> {
  validateOptions(options);

  const { steps, defaultDurationMs, onStatusChange, onStepChange } = options;
  let historySteps = [...steps];
  let currentStepId = projectPlaybackQueue(historySteps)[0]?.id;
  let elapsedMs = 0;
  let status: FlowPlaybackStatus = "idle";

  const getPlaybackQueue = () => projectPlaybackQueue(historySteps);

  const getCurrentStep = () => {
    const playbackQueue = getPlaybackQueue();
    const currentStepIndex = currentStepId
      ? playbackQueue.findIndex((step) => step.id === currentStepId)
      : -1;

    if (currentStepIndex === -1) {
      return undefined;
    }

    return playbackQueue[currentStepIndex];
  };

  const getStepDurationMs = () => {
    const currentStep = getCurrentStep();

    return currentStep?.durationMs ?? (currentStep ? defaultDurationMs : 0);
  };

  const getState = (): FlowPlaybackState<Metadata> => {
    const playbackQueue = getPlaybackQueue();
    const currentStep = getCurrentStep();

    return {
      currentStep,
      currentStepIndex: currentStep
        ? playbackQueue.findIndex((step) => step.id === currentStep.id)
        : -1,
      elapsedMs,
      status,
      stepCount: playbackQueue.length,
      stepDurationMs: getStepDurationMs()
    };
  };

  const getStepList = () => historySteps.map(projectStepListItem);

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
    const playbackQueue = getPlaybackQueue();
    const currentStepIndex = getState().currentStepIndex;

    if (currentStepIndex === nextStepIndex) {
      elapsedMs = 0;
      return getState();
    }

    currentStepId = playbackQueue[nextStepIndex]?.id;
    elapsedMs = 0;
    const state = getState();
    if (state.currentStep) {
      onStepChange?.(state.currentStep, state);
    }
    return state;
  };

  const complete = () => setStatus("completed");

  const selectReplacementStepId = (historyIndex: number, removedStep = false) => {
    const nextStep = historySteps
      .slice(removedStep ? historyIndex : historyIndex + 1)
      .find((step) => step.playbackEnabled !== false);
    const previousStep = findPreviousEnabledStep(
      historySteps,
      removedStep ? historyIndex : historyIndex
    );

    return nextStep?.id ?? previousStep?.id;
  };

  const reconcileCurrentStep = (replacementHistoryIndex: number, removedStep = false) => {
    const playbackQueue = getPlaybackQueue();

    if (playbackQueue.length === 0) {
      currentStepId = undefined;
      elapsedMs = 0;
      status = "idle";
      return getState();
    }

    if (currentStepId && playbackQueue.some((step) => step.id === currentStepId)) {
      return getState();
    }

    const previousStepId = currentStepId;
    currentStepId =
      selectReplacementStepId(replacementHistoryIndex, removedStep) ?? playbackQueue[0]?.id;
    elapsedMs = 0;
    if (status === "completed") {
      status = "paused";
    }

    const state = getState();
    if (previousStepId !== currentStepId && state.currentStep) {
      onStepChange?.(state.currentStep, state);
    }

    return state;
  };

  return {
    getState,
    getStepList,
    play: () => {
      const playbackQueue = getPlaybackQueue();

      if (status === "completed" || playbackQueue.length === 0) {
        return getState();
      }

      return setStatus("playing");
    },
    pause: () => {
      const playbackQueue = getPlaybackQueue();

      if (status === "completed" || playbackQueue.length === 0) {
        return getState();
      }

      return setStatus("paused");
    },
    next: () => {
      const playbackQueue = getPlaybackQueue();
      const currentStepIndex = getState().currentStepIndex;

      if (playbackQueue.length === 0) {
        return getState();
      }

      if (currentStepIndex >= playbackQueue.length - 1) {
        return complete();
      }

      return moveToStep(currentStepIndex + 1);
    },
    previous: () => {
      const playbackQueue = getPlaybackQueue();
      const currentStepIndex = getState().currentStepIndex;

      if (playbackQueue.length === 0 || currentStepIndex === 0) {
        elapsedMs = 0;
        return getState();
      }

      if (status === "completed") {
        status = "paused";
      }

      return moveToStep(currentStepIndex - 1);
    },
    reset: () => {
      const playbackQueue = getPlaybackQueue();

      currentStepId = playbackQueue[0]?.id;
      elapsedMs = 0;
      status = "idle";
      return getState();
    },
    goToStep: (stepId: string) => {
      const playbackQueue = getPlaybackQueue();
      const nextStepIndex = playbackQueue.findIndex((step) => step.id === stepId);

      if (nextStepIndex === -1) {
        throw new FlowPlaybackError(`Flow playback step "${stepId}" does not exist.`);
      }

      return moveToStep(nextStepIndex);
    },
    setStepPlaybackEnabled: (stepId: string, playbackEnabled: boolean) => {
      const historyIndex = historySteps.findIndex((step) => step.id === stepId);

      if (historyIndex === -1) {
        throw new FlowPlaybackError(`Flow playback step "${stepId}" does not exist.`);
      }

      historySteps = historySteps.map((step) =>
        step.id === stepId ? { ...step, playbackEnabled } : step
      );

      return reconcileCurrentStep(historyIndex);
    },
    deleteStep: (stepId: string) => {
      const historyIndex = historySteps.findIndex((step) => step.id === stepId);

      if (historyIndex === -1) {
        throw new FlowPlaybackError(`Flow playback step "${stepId}" does not exist.`);
      }

      historySteps = historySteps.filter((step) => step.id !== stepId);

      return reconcileCurrentStep(historyIndex, true);
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
        const playbackQueue = getPlaybackQueue();
        const currentStepIndex = getState().currentStepIndex;
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

        if (currentStepIndex >= playbackQueue.length - 1) {
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

function projectStepListItem<Metadata>(step: FlowStep<Metadata>): FlowStepListItem {
  return {
    id: step.id,
    type: step.type,
    typeLabel: getStepTypeLabel(step.type),
    title: step.title,
    playbackEnabled: step.playbackEnabled !== false
  };
}

function findPreviousEnabledStep<Metadata>(
  steps: readonly FlowStep<Metadata>[],
  beforeIndex: number
) {
  for (let index = beforeIndex - 1; index >= 0; index -= 1) {
    const step = steps[index];

    if (step?.playbackEnabled !== false) {
      return step;
    }
  }

  return undefined;
}

function getStepTypeLabel(type: FlowStepType) {
  switch (type) {
    case "highlight":
      return "Highlight";
  }
}

function validateOptions<Metadata>(options: CreateFlowPlaybackOptions<Metadata>) {
  if (!Number.isFinite(options.defaultDurationMs) || options.defaultDurationMs <= 0) {
    throw new FlowPlaybackError("Flow playback defaultDurationMs must be greater than 0.");
  }

  const stepIds = new Set<string>();

  for (const step of options.steps) {
    if (step.id.length === 0) {
      throw new FlowPlaybackError("Flow playback step IDs must not be empty.");
    }

    if (step.type !== "highlight") {
      throw new FlowPlaybackError(`Flow playback step "${step.id}" type must be "highlight".`);
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

function projectPlaybackQueue<Step extends Pick<FlowStep, "playbackEnabled">>(
  steps: readonly Step[]
) {
  return steps.filter((step) => step.playbackEnabled !== false);
}
