import { createElement, useMemo, useRef, useState } from "react";
import type {
  ButtonHTMLAttributes,
  ChangeEvent,
  HTMLAttributes,
  MouseEvent,
  SelectHTMLAttributes
} from "react";
import type { Edge, Node, ReactFlowInstance } from "@xyflow/react";
import {
  createFlowPlayback,
  type CreateFlowPlaybackOptions,
  type FlowNodeSnapshot,
  type FlowPlaybackState,
  type FlowPlaybackStep,
  type FlowStep,
  type FlowStepListItem,
  type RecordNodeAddOptions,
  type RecordNodeDeleteOptions,
  type RecordNodeEditOptions,
  type RecordEdgeConnectOptions,
  type RecordEdgeDeleteOptions
} from "./index";

export interface FlowPlaybackDiagnostic {
  code: "unknown-node" | "unknown-edge";
  id: string;
  stepId: string;
  message: string;
}

export interface UseFlowPlaybackOptions<
  NodeData extends Record<string, unknown> = Record<string, unknown>,
  EdgeData extends Record<string, unknown> = Record<string, unknown>,
  Metadata = Record<string, unknown>
> extends CreateFlowPlaybackOptions<Metadata> {
  nodes: readonly Node<NodeData>[];
  edges: readonly Edge<EdgeData>[];
  viewport?: {
    enabled?: boolean;
    reactFlow?: Pick<ReactFlowInstance, "fitView" | "setViewport">;
  };
}

export interface UseFlowPlaybackResult<
  NodeData extends Record<string, unknown> = Record<string, unknown>,
  EdgeData extends Record<string, unknown> = Record<string, unknown>,
  Metadata = Record<string, unknown>
> extends FlowPlaybackState<Metadata> {
  steps: readonly FlowPlaybackStep<Metadata>[];
  stepList: FlowStepListItem[];
  nodes: Node<NodeData & { flowPlayActive: boolean }>[];
  edges: Edge<EdgeData & { flowPlayActive: boolean }>[];
  activeNodeIds: string[];
  activeEdgeIds: string[];
  diagnostics: FlowPlaybackDiagnostic[];
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  reset: () => void;
  goToStep: (stepId: string) => void;
  recordNodeDragStart: (node: FlowNodeSnapshot) => void;
  recordNodeDragStop: (node: FlowNodeSnapshot) => void;
  recordNodeAdd: (options: RecordNodeAddOptions<Metadata>) => void;
  recordNodeEdit: (options: RecordNodeEditOptions<Metadata>) => void;
  recordNodeDelete: (options: RecordNodeDeleteOptions<Metadata>) => void;
  recordEdgeDelete: (options: RecordEdgeDeleteOptions<Metadata>) => void;
  recordEdgeConnect: (options: RecordEdgeConnectOptions<Metadata>) => void;
  setStepPlaybackEnabled: (stepId: string, playbackEnabled: boolean) => void;
  deleteStep: (stepId: string) => void;
  advanceBy: (elapsedMs: number) => void;
}

export function useFlowPlayback<
  NodeData extends Record<string, unknown> = Record<string, unknown>,
  EdgeData extends Record<string, unknown> = Record<string, unknown>,
  Metadata = Record<string, unknown>
>(
  options: UseFlowPlaybackOptions<NodeData, EdgeData, Metadata>
): UseFlowPlaybackResult<NodeData, EdgeData, Metadata> {
  const {
    nodes,
    edges,
    steps,
    defaultDurationMs,
    formatNodeLabel,
    onStatusChange,
    onStepChange,
    stepTypeLabels
  } = options;
  const viewport = options.viewport;
  const playback = useMemo(
    () =>
      createFlowPlayback({
        steps,
        defaultDurationMs,
        ...(formatNodeLabel === undefined ? {} : { formatNodeLabel }),
        ...(onStatusChange === undefined ? {} : { onStatusChange }),
        ...(onStepChange === undefined ? {} : { onStepChange }),
        ...(stepTypeLabels === undefined ? {} : { stepTypeLabels })
      }),
    [defaultDurationMs, formatNodeLabel, onStatusChange, onStepChange, stepTypeLabels, steps]
  );
  const [state, setState] = useState(() => playback.getState());
  const [stepList, setStepList] = useState(() => playback.getStepList());
  const [historySteps, setHistorySteps] = useState(() => playback.getSteps());
  const dragStartPositions = useRef(new Map<string, FlowNodeSnapshot>());
  const latestPlayback = useRef(playback);
  latestPlayback.current = playback;
  const playbackStepIds = useMemo(
    () => new Set(stepList.filter((step) => step.playbackEnabled).map((step) => step.id)),
    [stepList]
  );
  const playbackSteps = useMemo(
    () => historySteps.filter((step) => playbackStepIds.has(step.id)),
    [historySteps, playbackStepIds]
  );

  const activeNodeIds = useMemo(() => getStepNodeIds(state.currentStep), [state.currentStep]);
  const activeEdgeIds = useMemo(() => getStepEdgeIds(state.currentStep), [state.currentStep]);
  const activeNodeIdSet = useMemo(() => new Set(activeNodeIds), [activeNodeIds]);
  const activeEdgeIdSet = useMemo(() => new Set(activeEdgeIds), [activeEdgeIds]);

  const enhancedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...(node.data ?? {}),
          flowPlayActive: activeNodeIdSet.has(node.id)
        } as NodeData & { flowPlayActive: boolean }
      })),
    [activeNodeIdSet, nodes]
  );
  const enhancedEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        data: {
          ...(edge.data ?? {}),
          flowPlayActive: activeEdgeIdSet.has(edge.id)
        } as EdgeData & { flowPlayActive: boolean }
      })),
    [activeEdgeIdSet, edges]
  );

  const diagnostics = useMemo(
    () =>
      state.currentStep
        ? collectDiagnostics(nodes, edges, state.currentStep.id, activeNodeIds, activeEdgeIds)
        : [],
    [activeEdgeIds, activeNodeIds, edges, nodes, state.currentStep]
  );

  const applyViewport = (nextState: FlowPlaybackState<Metadata>) => {
    if (
      viewport?.enabled !== true ||
      !viewport.reactFlow ||
      !nextState.currentStep ||
      nextState.currentStep.type !== "highlight" ||
      !nextState.currentStep.viewport
    ) {
      return;
    }

    const intent = nextState.currentStep.viewport;

    if (intent.x !== undefined && intent.y !== undefined && intent.zoom !== undefined) {
      void viewport.reactFlow.setViewport({ x: intent.x, y: intent.y, zoom: intent.zoom });
      return;
    }

    if (intent.nodeIds && intent.nodeIds.length > 0) {
      const fitViewOptions = {
        nodes: intent.nodeIds.map((id) => ({ id })),
        ...(intent.padding === undefined ? {} : { padding: intent.padding })
      };
      void viewport.reactFlow.fitView(fitViewOptions);
    }
  };

  const apply = (nextState: FlowPlaybackState<Metadata>) => {
    setState(nextState);
    setStepList(latestPlayback.current.getStepList());
    setHistorySteps(latestPlayback.current.getSteps());
    applyViewport(nextState);
  };

  return {
    ...state,
    steps: playbackSteps,
    stepList,
    nodes: enhancedNodes,
    edges: enhancedEdges,
    activeNodeIds,
    activeEdgeIds,
    diagnostics,
    play: () => apply(latestPlayback.current.play()),
    pause: () => apply(latestPlayback.current.pause()),
    next: () => apply(latestPlayback.current.next()),
    previous: () => apply(latestPlayback.current.previous()),
    reset: () => apply(latestPlayback.current.reset()),
    goToStep: (stepId) => apply(latestPlayback.current.goToStep(stepId)),
    recordNodeDragStart: (node) => {
      dragStartPositions.current.set(node.id, node);
    },
    recordNodeDragStop: (node) => {
      const startNode = dragStartPositions.current.get(node.id);
      dragStartPositions.current.delete(node.id);

      if (!startNode?.position || !node.position) {
        return;
      }

      if (startNode.position.x === node.position.x && startNode.position.y === node.position.y) {
        return;
      }

      apply(
        latestPlayback.current.recordNodeDrag({
          nodeId: node.id,
          from: startNode.position,
          to: node.position
        })
      );
    },
    recordNodeAdd: (recordOptions) => apply(latestPlayback.current.recordNodeAdd(recordOptions)),
    recordNodeEdit: (recordOptions) => apply(latestPlayback.current.recordNodeEdit(recordOptions)),
    recordNodeDelete: (recordOptions) =>
      apply(latestPlayback.current.recordNodeDelete(recordOptions)),
    recordEdgeDelete: (recordOptions) =>
      apply(latestPlayback.current.recordEdgeDelete(recordOptions)),
    recordEdgeConnect: (recordOptions) =>
      apply(latestPlayback.current.recordEdgeConnect(recordOptions)),
    setStepPlaybackEnabled: (stepId, playbackEnabled) =>
      apply(latestPlayback.current.setStepPlaybackEnabled(stepId, playbackEnabled)),
    deleteStep: (stepId) => apply(latestPlayback.current.deleteStep(stepId)),
    advanceBy: (elapsedMs) => apply(latestPlayback.current.advanceBy(elapsedMs))
  };
}

export interface FlowPlaybackControlLabels {
  play?: string;
  playAriaLabel?: string;
  pause?: string;
  pauseAriaLabel?: string;
  previous?: string;
  previousAriaLabel?: string;
  next?: string;
  nextAriaLabel?: string;
  reset?: string;
  resetAriaLabel?: string;
  stepSelect?: string;
  stepSelectAriaLabel?: string;
}

type FlowPlaybackControlPlayback<Metadata = Record<string, unknown>> = Pick<
  UseFlowPlaybackResult<Record<string, unknown>, Record<string, unknown>, Metadata>,
  | "currentStep"
  | "currentStepIndex"
  | "goToStep"
  | "next"
  | "pause"
  | "play"
  | "previous"
  | "reset"
  | "status"
  | "stepCount"
  | "steps"
>;

export interface FlowPlaybackControlProps<
  Metadata = Record<string, unknown>
> extends ButtonHTMLAttributes<HTMLButtonElement> {
  labels?: FlowPlaybackControlLabels | undefined;
  playback: FlowPlaybackControlPlayback<Metadata>;
}

export interface FlowPlaybackStepSelectProps<
  Metadata = Record<string, unknown>
> extends SelectHTMLAttributes<HTMLSelectElement> {
  labels?: FlowPlaybackControlLabels | undefined;
  playback: FlowPlaybackControlPlayback<Metadata>;
}

export interface FlowPlaybackControlsProps<
  Metadata = Record<string, unknown>
> extends HTMLAttributes<HTMLDivElement> {
  labels?: FlowPlaybackControlLabels | undefined;
  playback: FlowPlaybackControlPlayback<Metadata>;
}

const defaultControlLabels = {
  play: "Play",
  pause: "Pause",
  previous: "Previous",
  previousAriaLabel: "Previous step",
  next: "Next",
  nextAriaLabel: "Next step",
  reset: "Reset",
  resetAriaLabel: "Reset playback",
  stepSelect: "Go to step"
} satisfies Required<
  Pick<FlowPlaybackControlLabels, "play" | "pause" | "previous" | "next" | "reset" | "stepSelect">
> &
  Pick<FlowPlaybackControlLabels, "previousAriaLabel" | "nextAriaLabel" | "resetAriaLabel">;

export function FlowPlaybackPlayButton<Metadata = Record<string, unknown>>(
  props: FlowPlaybackControlProps<Metadata>
) {
  const { labels, playback, disabled = false, onClick, ...buttonProps } = props;
  const label = labels?.play ?? defaultControlLabels.play;

  return createElement(
    "button",
    {
      type: "button",
      ...buttonProps,
      "aria-label": labels?.playAriaLabel ?? label,
      disabled:
        disabled ||
        playback.stepCount === 0 ||
        playback.status === "playing" ||
        playback.status === "completed",
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          playback.play();
        }
      }
    },
    label
  );
}

export function FlowPlaybackPauseButton<Metadata = Record<string, unknown>>(
  props: FlowPlaybackControlProps<Metadata>
) {
  const { labels, playback, disabled = false, onClick, ...buttonProps } = props;
  const label = labels?.pause ?? defaultControlLabels.pause;

  return createElement(
    "button",
    {
      type: "button",
      ...buttonProps,
      "aria-label": labels?.pauseAriaLabel ?? label,
      disabled: disabled || playback.stepCount === 0 || playback.status !== "playing",
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          playback.pause();
        }
      }
    },
    label
  );
}

export function FlowPlaybackPreviousButton<Metadata = Record<string, unknown>>(
  props: FlowPlaybackControlProps<Metadata>
) {
  const { labels, playback, disabled = false, onClick, ...buttonProps } = props;
  const label = labels?.previous ?? defaultControlLabels.previous;

  return createElement(
    "button",
    {
      type: "button",
      ...buttonProps,
      "aria-label": labels?.previousAriaLabel ?? defaultControlLabels.previousAriaLabel,
      disabled: disabled || playback.stepCount === 0 || playback.currentStepIndex <= 0,
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          playback.previous();
        }
      }
    },
    label
  );
}

export function FlowPlaybackNextButton<Metadata = Record<string, unknown>>(
  props: FlowPlaybackControlProps<Metadata>
) {
  const { labels, playback, disabled = false, onClick, ...buttonProps } = props;
  const label = labels?.next ?? defaultControlLabels.next;

  return createElement(
    "button",
    {
      type: "button",
      ...buttonProps,
      "aria-label": labels?.nextAriaLabel ?? defaultControlLabels.nextAriaLabel,
      disabled: disabled || playback.stepCount === 0 || playback.status === "completed",
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          playback.next();
        }
      }
    },
    label
  );
}

export function FlowPlaybackResetButton<Metadata = Record<string, unknown>>(
  props: FlowPlaybackControlProps<Metadata>
) {
  const { labels, playback, disabled = false, onClick, ...buttonProps } = props;
  const label = labels?.reset ?? defaultControlLabels.reset;

  return createElement(
    "button",
    {
      type: "button",
      ...buttonProps,
      "aria-label": labels?.resetAriaLabel ?? defaultControlLabels.resetAriaLabel,
      disabled:
        disabled ||
        playback.stepCount === 0 ||
        (playback.status === "idle" && playback.currentStepIndex === 0),
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          playback.reset();
        }
      }
    },
    label
  );
}

export function FlowPlaybackStepSelect<Metadata = Record<string, unknown>>(
  props: FlowPlaybackStepSelectProps<Metadata>
) {
  const { labels, playback, disabled = false, id, onChange, ...selectProps } = props;
  const label = labels?.stepSelect ?? defaultControlLabels.stepSelect;
  const selectId = id ?? "flow-playback-step-select";

  return createElement(
    "label",
    {},
    label,
    createElement(
      "select",
      {
        ...selectProps,
        "aria-label": labels?.stepSelectAriaLabel ?? label,
        disabled: disabled || playback.stepCount === 0,
        id: selectId,
        value: playback.currentStep?.id ?? "",
        onChange: (event: ChangeEvent<HTMLSelectElement>) => {
          onChange?.(event);
          if (!event.defaultPrevented) {
            playback.goToStep(event.currentTarget.value);
          }
        }
      },
      playback.steps.map((step) =>
        createElement("option", { key: step.id, value: step.id }, step.title)
      )
    )
  );
}

export function FlowPlaybackControls<Metadata = Record<string, unknown>>(
  props: FlowPlaybackControlsProps<Metadata>
) {
  const { labels, playback, ...containerProps } = props;

  return createElement(
    "div",
    containerProps,
    createElement(FlowPlaybackPlayButton, { labels, playback }),
    createElement(FlowPlaybackPauseButton, { labels, playback }),
    createElement(FlowPlaybackPreviousButton, { labels, playback }),
    createElement(FlowPlaybackNextButton, { labels, playback }),
    createElement(FlowPlaybackResetButton, { labels, playback }),
    createElement(FlowPlaybackStepSelect, { labels, playback })
  );
}

function collectDiagnostics<
  NodeData extends Record<string, unknown>,
  EdgeData extends Record<string, unknown>
>(
  nodes: readonly Node<NodeData>[],
  edges: readonly Edge<EdgeData>[],
  stepId: string,
  activeNodeIds: readonly string[],
  activeEdgeIds: readonly string[]
) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set(edges.map((edge) => edge.id));
  const diagnostics: FlowPlaybackDiagnostic[] = [];

  for (const id of activeNodeIds) {
    if (!nodeIds.has(id)) {
      diagnostics.push({
        code: "unknown-node",
        id,
        stepId,
        message: `Flow playback step "${stepId}" references unknown React Flow node "${id}".`
      });
    }
  }

  for (const id of activeEdgeIds) {
    if (!edgeIds.has(id)) {
      diagnostics.push({
        code: "unknown-edge",
        id,
        stepId,
        message: `Flow playback step "${stepId}" references unknown React Flow edge "${id}".`
      });
    }
  }

  return diagnostics;
}

function getStepNodeIds<Metadata>(step: FlowStep<Metadata> | undefined) {
  if (!step) {
    return [];
  }

  switch (step.type) {
    case "highlight":
      return [...step.nodeIds];
    case "node-drag":
      return [step.nodeId];
    case "node-add":
      return [step.node.id];
    case "node-edit":
      return [step.after.id];
    case "node-delete":
      return [step.node.id];
    case "edge-delete":
    case "edge-connect":
      return [];
  }
}

function getStepEdgeIds<Metadata>(step: FlowStep<Metadata> | undefined) {
  if (!step) {
    return [];
  }

  switch (step.type) {
    case "highlight":
      return [...step.edgeIds];
    case "node-delete":
      return step.connectedEdges.map((edge) => edge.id);
    case "edge-delete":
    case "edge-connect":
      return [step.edge.id];
    case "node-drag":
    case "node-add":
    case "node-edit":
      return [];
  }
}
