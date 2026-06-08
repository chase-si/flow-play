import { useMemo, useRef, useState } from "react";
import type { Edge, Node, ReactFlowInstance } from "@xyflow/react";
import { createFlowPlayback, type CreateFlowPlaybackOptions, type FlowPlaybackState } from "./index";

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
  advanceBy: (elapsedMs: number) => void;
}

export function useFlowPlayback<
  NodeData extends Record<string, unknown> = Record<string, unknown>,
  EdgeData extends Record<string, unknown> = Record<string, unknown>,
  Metadata = Record<string, unknown>
>(
  options: UseFlowPlaybackOptions<NodeData, EdgeData, Metadata>
): UseFlowPlaybackResult<NodeData, EdgeData, Metadata> {
  const { nodes, edges, steps, defaultDurationMs, onStatusChange, onStepChange } = options;
  const viewport = options.viewport;
  const playback = useMemo(
    () =>
      createFlowPlayback({
        steps,
        defaultDurationMs,
        ...(onStatusChange === undefined ? {} : { onStatusChange }),
        ...(onStepChange === undefined ? {} : { onStepChange })
      }),
    [defaultDurationMs, onStatusChange, onStepChange, steps]
  );
  const [state, setState] = useState(() => playback.getState());
  const latestPlayback = useRef(playback);
  latestPlayback.current = playback;

  const activeNodeIds = useMemo(() => [...state.currentStep.nodeIds], [state.currentStep.nodeIds]);
  const activeEdgeIds = useMemo(() => [...state.currentStep.edgeIds], [state.currentStep.edgeIds]);
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
    () => collectDiagnostics(nodes, edges, state.currentStep.id, activeNodeIds, activeEdgeIds),
    [activeEdgeIds, activeNodeIds, edges, nodes, state.currentStep.id]
  );

  const applyViewport = (nextState: FlowPlaybackState<Metadata>) => {
    if (viewport?.enabled !== true || !viewport.reactFlow || !nextState.currentStep.viewport) {
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
    applyViewport(nextState);
  };

  return {
    ...state,
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
    advanceBy: (elapsedMs) => apply(latestPlayback.current.advanceBy(elapsedMs))
  };
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
