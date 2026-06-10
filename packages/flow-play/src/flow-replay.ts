import type { FlowEdgeSnapshot, FlowNodeSnapshot, FlowStep } from "./index";

export interface FlowReplayState {
  nodes: FlowNodeSnapshot[];
  edges: FlowEdgeSnapshot[];
}

export interface ReconstructFlowStateOptions<Metadata = Record<string, unknown>> {
  initialNodes: readonly FlowNodeSnapshot[];
  initialEdges: readonly FlowEdgeSnapshot[];
  steps: readonly FlowStep<Metadata>[];
  throughHistoryIndex: number;
}

export function cloneFlowReplayState(
  initialNodes: readonly FlowNodeSnapshot[],
  initialEdges: readonly FlowEdgeSnapshot[]
): FlowReplayState {
  return {
    nodes: initialNodes.map((node) => ({ ...node })),
    edges: initialEdges.map((edge) => ({ ...edge }))
  };
}

export function reconstructFlowState<Metadata = Record<string, unknown>>(
  options: ReconstructFlowStateOptions<Metadata>
): FlowReplayState {
  const { initialNodes, initialEdges, steps, throughHistoryIndex } = options;

  if (!Number.isInteger(throughHistoryIndex) || throughHistoryIndex < -1) {
    throw new Error("Flow replay throughHistoryIndex must be an integer greater than or equal to -1.");
  }

  if (throughHistoryIndex >= steps.length) {
    throw new Error("Flow replay throughHistoryIndex must be within the step history.");
  }

  let state = cloneFlowReplayState(initialNodes, initialEdges);

  if (throughHistoryIndex === -1) {
    return state;
  }

  for (let index = 0; index <= throughHistoryIndex; index += 1) {
    const step = steps[index];

    if (step) {
      state = applyFlowStepToReplayState(state, step);
    }
  }

  return state;
}

export function reconstructFlowStateForStepId<Metadata = Record<string, unknown>>(
  options: Omit<ReconstructFlowStateOptions<Metadata>, "throughHistoryIndex"> & {
    stepId: string;
  }
): FlowReplayState {
  const historyIndex = options.steps.findIndex((step) => step.id === options.stepId);

  if (historyIndex === -1) {
    throw new Error(`Flow replay step "${options.stepId}" does not exist in history.`);
  }

  return reconstructFlowState({
    initialNodes: options.initialNodes,
    initialEdges: options.initialEdges,
    steps: options.steps,
    throughHistoryIndex: historyIndex
  });
}

export function reconstructFinalFlowState<Metadata = Record<string, unknown>>(
  options: Omit<ReconstructFlowStateOptions<Metadata>, "throughHistoryIndex">
): FlowReplayState {
  return reconstructFlowState({
    ...options,
    throughHistoryIndex: options.steps.length - 1
  });
}

export function resolveReplayHistoryIndex<Metadata = Record<string, unknown>>(
  steps: readonly FlowStep<Metadata>[],
  currentStep: FlowStep<Metadata> | undefined
): number {
  if (steps.length === 0) {
    return -1;
  }

  if (!currentStep) {
    return -1;
  }

  const historyIndex = steps.findIndex((step) => step.id === currentStep.id);

  return historyIndex === -1 ? steps.length - 1 : historyIndex;
}

export function applyFlowStepToReplayState<Metadata>(
  state: FlowReplayState,
  step: FlowStep<Metadata>
): FlowReplayState {
  switch (step.type) {
    case "highlight":
      return state;
    case "node-drag":
      return {
        nodes: state.nodes.map((node) =>
          node.id === step.nodeId ? { ...node, position: { ...step.to } } : node
        ),
        edges: state.edges
      };
    case "node-add":
      return {
        nodes: state.nodes.some((node) => node.id === step.node.id)
          ? state.nodes.map((node) => (node.id === step.node.id ? { ...step.node } : node))
          : [...state.nodes, { ...step.node }],
        edges: state.edges
      };
    case "node-edit":
      return {
        nodes: state.nodes.some((node) => node.id === step.after.id)
          ? state.nodes.map((node) => (node.id === step.after.id ? { ...step.after } : node))
          : [...state.nodes, { ...step.after }],
        edges: state.edges
      };
    case "node-delete": {
      const removedEdgeIds = new Set(step.connectedEdges.map((edge) => edge.id));

      return {
        nodes: state.nodes.filter((node) => node.id !== step.node.id),
        edges: state.edges.filter((edge) => !removedEdgeIds.has(edge.id))
      };
    }
    case "edge-delete":
      return {
        nodes: state.nodes,
        edges: state.edges.filter((edge) => edge.id !== step.edge.id)
      };
    case "edge-connect":
      return {
        nodes: state.nodes,
        edges: state.edges.some((edge) => edge.id === step.edge.id)
          ? state.edges.map((edge) => (edge.id === step.edge.id ? { ...step.edge } : edge))
          : [...state.edges, { ...step.edge }]
      };
  }
}
