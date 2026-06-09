export type FlowPlaybackStatus = "idle" | "playing" | "paused" | "completed";

export interface FlowPlaybackViewportIntent {
  nodeIds?: readonly string[];
  edgeIds?: readonly string[];
  x?: number;
  y?: number;
  zoom?: number;
  padding?: number;
}

export interface FlowNodePosition {
  x: number;
  y: number;
}

export interface FlowNodeSnapshot {
  id: string;
  position?: FlowNodePosition;
  data?: unknown;
  [key: string]: unknown;
}

export interface FlowEdgeSnapshot {
  id: string;
  source: string;
  target: string;
  data?: unknown;
  [key: string]: unknown;
}

export interface FlowNodeLabelReference {
  id: string;
  data?: unknown;
}

export type FlowStepType =
  | "highlight"
  | "node-drag"
  | "node-add"
  | "node-edit"
  | "edge-connect";

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

export interface FlowNodeDragStep<Metadata = Record<string, unknown>> {
  id: string;
  type: "node-drag";
  title: string;
  description?: string;
  playbackEnabled?: boolean;
  nodeId: string;
  from: FlowNodePosition;
  to: FlowNodePosition;
  durationMs?: number;
  metadata?: Metadata;
}

export interface FlowNodeAddStep<Metadata = Record<string, unknown>> {
  id: string;
  type: "node-add";
  title: string;
  description?: string;
  playbackEnabled?: boolean;
  node: FlowNodeSnapshot;
  durationMs?: number;
  metadata?: Metadata;
}

export interface FlowNodeEditStep<Metadata = Record<string, unknown>> {
  id: string;
  type: "node-edit";
  title: string;
  description?: string;
  playbackEnabled?: boolean;
  before: FlowNodeSnapshot;
  after: FlowNodeSnapshot;
  durationMs?: number;
  metadata?: Metadata;
}

export interface FlowEdgeConnectStep<Metadata = Record<string, unknown>> {
  id: string;
  type: "edge-connect";
  title: string;
  description?: string;
  playbackEnabled?: boolean;
  edge: FlowEdgeSnapshot;
  durationMs?: number;
  metadata?: Metadata;
}

export type FlowStep<Metadata = Record<string, unknown>> =
  | FlowHighlightStep<Metadata>
  | FlowNodeDragStep<Metadata>
  | FlowNodeAddStep<Metadata>
  | FlowNodeEditStep<Metadata>
  | FlowEdgeConnectStep<Metadata>;

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
  formatNodeLabel?: (node: FlowNodeLabelReference) => string | undefined;
  stepTypeLabels?: Partial<Record<FlowStepType, string>>;
  onStatusChange?: (status: FlowPlaybackStatus, state: FlowPlaybackState<Metadata>) => void;
  onStepChange?: (step: FlowStep<Metadata>, state: FlowPlaybackState<Metadata>) => void;
}

export interface RecordNodeDragOptions<Metadata = Record<string, unknown>> {
  nodeId: string;
  from: FlowNodePosition;
  to: FlowNodePosition;
  title?: string;
  description?: string;
  playbackEnabled?: boolean;
  durationMs?: number;
  metadata?: Metadata;
}

export interface RecordNodeAddOptions<Metadata = Record<string, unknown>> {
  node: FlowNodeSnapshot;
  title?: string;
  description?: string;
  playbackEnabled?: boolean;
  durationMs?: number;
  metadata?: Metadata;
}

export interface RecordNodeEditOptions<Metadata = Record<string, unknown>> {
  before: FlowNodeSnapshot;
  after: FlowNodeSnapshot;
  title?: string;
  description?: string;
  playbackEnabled?: boolean;
  durationMs?: number;
  metadata?: Metadata;
}

export interface RecordEdgeConnectOptions<Metadata = Record<string, unknown>> {
  edge: FlowEdgeSnapshot;
  title?: string;
  description?: string;
  playbackEnabled?: boolean;
  durationMs?: number;
  metadata?: Metadata;
}

export interface FlowPlaybackController<Metadata = Record<string, unknown>> {
  getState: () => FlowPlaybackState<Metadata>;
  getSteps: () => FlowStep<Metadata>[];
  getStepList: () => FlowStepListItem[];
  recordNodeDrag: (options: RecordNodeDragOptions<Metadata>) => FlowPlaybackState<Metadata>;
  recordNodeAdd: (options: RecordNodeAddOptions<Metadata>) => FlowPlaybackState<Metadata>;
  recordNodeEdit: (options: RecordNodeEditOptions<Metadata>) => FlowPlaybackState<Metadata>;
  recordEdgeConnect: (options: RecordEdgeConnectOptions<Metadata>) => FlowPlaybackState<Metadata>;
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

  const { steps, defaultDurationMs, formatNodeLabel, onStatusChange, onStepChange } = options;
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

  const getSteps = () => [...historySteps];

  const getStepList = () =>
    historySteps.map((step) => projectStepListItem(step, options.stepTypeLabels));

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
    getSteps,
    getStepList,
    recordNodeDrag: (recordOptions) => {
      const label = formatNodeLabel?.({ id: recordOptions.nodeId }) ?? recordOptions.nodeId;
      const step = {
        id: createRecordedStepId("node-drag", recordOptions.nodeId, historySteps.length + 1),
        type: "node-drag",
        title: recordOptions.title ?? `Move ${label}`,
        nodeId: recordOptions.nodeId,
        from: recordOptions.from,
        to: recordOptions.to,
        ...(recordOptions.description === undefined
          ? {}
          : { description: recordOptions.description }),
        ...(recordOptions.playbackEnabled === undefined
          ? {}
          : { playbackEnabled: recordOptions.playbackEnabled }),
        ...(recordOptions.durationMs === undefined ? {} : { durationMs: recordOptions.durationMs }),
        ...(recordOptions.metadata === undefined ? {} : { metadata: recordOptions.metadata })
      } satisfies FlowNodeDragStep<Metadata>;

      return appendStep(step);
    },
    recordNodeAdd: (recordOptions) => {
      const label =
        formatNodeLabel?.({ id: recordOptions.node.id, data: recordOptions.node.data }) ??
        recordOptions.node.id;
      const step = {
        id: createRecordedStepId("node-add", recordOptions.node.id, historySteps.length + 1),
        type: "node-add",
        title: recordOptions.title ?? `Add ${label}`,
        node: recordOptions.node,
        ...(recordOptions.description === undefined
          ? {}
          : { description: recordOptions.description }),
        ...(recordOptions.playbackEnabled === undefined
          ? {}
          : { playbackEnabled: recordOptions.playbackEnabled }),
        ...(recordOptions.durationMs === undefined ? {} : { durationMs: recordOptions.durationMs }),
        ...(recordOptions.metadata === undefined ? {} : { metadata: recordOptions.metadata })
      } satisfies FlowNodeAddStep<Metadata>;

      return appendStep(step);
    },
    recordNodeEdit: (recordOptions) => {
      const label =
        formatNodeLabel?.({ id: recordOptions.after.id, data: recordOptions.after.data }) ??
        recordOptions.after.id;
      const step = {
        id: createRecordedStepId("node-edit", recordOptions.after.id, historySteps.length + 1),
        type: "node-edit",
        title: recordOptions.title ?? `Edit ${label}`,
        before: recordOptions.before,
        after: recordOptions.after,
        ...(recordOptions.description === undefined
          ? {}
          : { description: recordOptions.description }),
        ...(recordOptions.playbackEnabled === undefined
          ? {}
          : { playbackEnabled: recordOptions.playbackEnabled }),
        ...(recordOptions.durationMs === undefined ? {} : { durationMs: recordOptions.durationMs }),
        ...(recordOptions.metadata === undefined ? {} : { metadata: recordOptions.metadata })
      } satisfies FlowNodeEditStep<Metadata>;

      return appendStep(step);
    },
    recordEdgeConnect: (recordOptions) => {
      const step = {
        id: createRecordedStepId("edge-connect", recordOptions.edge.id, historySteps.length + 1),
        type: "edge-connect",
        title: recordOptions.title ?? `Connect ${recordOptions.edge.id}`,
        edge: recordOptions.edge,
        ...(recordOptions.description === undefined
          ? {}
          : { description: recordOptions.description }),
        ...(recordOptions.playbackEnabled === undefined
          ? {}
          : { playbackEnabled: recordOptions.playbackEnabled }),
        ...(recordOptions.durationMs === undefined ? {} : { durationMs: recordOptions.durationMs }),
        ...(recordOptions.metadata === undefined ? {} : { metadata: recordOptions.metadata })
      } satisfies FlowEdgeConnectStep<Metadata>;

      return appendStep(step);
    },
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

  function appendStep(step: FlowStep<Metadata>) {
    validateStep(step, new Set(historySteps.map((historyStep) => historyStep.id)));
    const hadPlaybackSteps = getPlaybackQueue().length > 0;
    historySteps = [...historySteps, step];

    if (!hadPlaybackSteps && step.playbackEnabled !== false) {
      currentStepId = step.id;
    }

    return reconcileCurrentStep(historySteps.length - 1);
  }
}

function projectStepListItem<Metadata>(
  step: FlowStep<Metadata>,
  stepTypeLabels: Partial<Record<FlowStepType, string>> | undefined
): FlowStepListItem {
  return {
    id: step.id,
    type: step.type,
    typeLabel: stepTypeLabels?.[step.type] ?? getStepTypeLabel(step.type),
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
    case "node-drag":
      return "Node drag";
    case "node-add":
      return "Node add";
    case "node-edit":
      return "Node edit";
    case "edge-connect":
      return "Edge connect";
  }
}

function validateOptions<Metadata>(options: CreateFlowPlaybackOptions<Metadata>) {
  if (!Number.isFinite(options.defaultDurationMs) || options.defaultDurationMs <= 0) {
    throw new FlowPlaybackError("Flow playback defaultDurationMs must be greater than 0.");
  }

  const stepIds = new Set<string>();

  for (const step of options.steps) {
    validateStep(step, stepIds);
    stepIds.add(step.id);
  }
}

function validateStep<Metadata>(step: FlowStep<Metadata>, existingStepIds: Set<string>) {
  if (step.id.length === 0) {
    throw new FlowPlaybackError("Flow playback step IDs must not be empty.");
  }

  if (step.title.length === 0) {
    throw new FlowPlaybackError(`Flow playback step "${step.id}" title must not be empty.`);
  }

  if (existingStepIds.has(step.id)) {
    throw new FlowPlaybackError(
      `Flow playback step IDs must be unique. Duplicate ID: "${step.id}".`
    );
  }

  switch (step.type) {
    case "highlight":
      if (!Array.isArray(step.nodeIds)) {
        throw new FlowPlaybackError(`Flow playback step "${step.id}" nodeIds must be an array.`);
      }

      if (!Array.isArray(step.edgeIds)) {
        throw new FlowPlaybackError(`Flow playback step "${step.id}" edgeIds must be an array.`);
      }
      break;
    case "node-drag":
      if (step.nodeId.length === 0) {
        throw new FlowPlaybackError(`Flow playback step "${step.id}" nodeId must not be empty.`);
      }
      validatePosition(step.id, "from", step.from);
      validatePosition(step.id, "to", step.to);
      break;
    case "node-add":
      validateNodeSnapshot(step.id, "node", step.node);
      break;
    case "node-edit":
      validateNodeSnapshot(step.id, "before", step.before);
      validateNodeSnapshot(step.id, "after", step.after);
      break;
    case "edge-connect":
      validateEdgeSnapshot(step.id, "edge", step.edge);
      break;
  }

  if (
    step.durationMs !== undefined &&
    (!Number.isFinite(step.durationMs) || step.durationMs <= 0)
  ) {
    throw new FlowPlaybackError(
      `Flow playback step "${step.id}" durationMs must be greater than 0 when provided.`
    );
  }
}

function validateNodeSnapshot(stepId: string, field: string, node: FlowNodeSnapshot) {
  if (!node || typeof node !== "object" || typeof node.id !== "string" || node.id.length === 0) {
    throw new FlowPlaybackError(`Flow playback step "${stepId}" ${field}.id must not be empty.`);
  }

  if (node.position !== undefined) {
    validatePosition(stepId, `${field}.position`, node.position);
  }
}

function validateEdgeSnapshot(stepId: string, field: string, edge: FlowEdgeSnapshot) {
  if (!edge || typeof edge !== "object" || typeof edge.id !== "string" || edge.id.length === 0) {
    throw new FlowPlaybackError(`Flow playback step "${stepId}" ${field}.id must not be empty.`);
  }

  if (typeof edge.source !== "string" || edge.source.length === 0) {
    throw new FlowPlaybackError(
      `Flow playback step "${stepId}" ${field}.source must not be empty.`
    );
  }

  if (typeof edge.target !== "string" || edge.target.length === 0) {
    throw new FlowPlaybackError(
      `Flow playback step "${stepId}" ${field}.target must not be empty.`
    );
  }
}

function validatePosition(stepId: string, field: string, position: FlowNodePosition) {
  if (
    !position ||
    typeof position !== "object" ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y)
  ) {
    throw new FlowPlaybackError(
      `Flow playback step "${stepId}" ${field} must contain finite x and y coordinates.`
    );
  }
}

function createRecordedStepId(type: FlowStepType, nodeId: string, count: number) {
  return `${type}-${slugifyId(nodeId)}-${count}`;
}

function slugifyId(id: string) {
  const slug = id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "node";
}

function projectPlaybackQueue<Step extends Pick<FlowStep, "playbackEnabled">>(
  steps: readonly Step[]
) {
  return steps.filter((step) => step.playbackEnabled !== false);
}
