// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Edge, Node, ReactFlowInstance } from "@xyflow/react";
import { useFlowPlayback } from "./react-flow";
import type { FlowPlaybackStep } from "./index";

const nodes: Node[] = [
  { id: "start", position: { x: 0, y: 0 }, data: { label: "Start" } },
  { id: "finish", position: { x: 100, y: 0 }, data: { label: "Finish" } }
];

const edges: Edge[] = [{ id: "start-finish", source: "start", target: "finish" }];

const steps: FlowPlaybackStep[] = [
  {
    id: "intro",
    title: "Introduce the path",
    nodeIds: ["start"],
    edgeIds: ["start-finish"]
  },
  {
    id: "done",
    title: "Finish the path",
    nodeIds: ["finish"],
    edgeIds: []
  }
];
const introStep = steps[0] as FlowPlaybackStep;

describe("useFlowPlayback", () => {
  it("enhances React Flow nodes and edges with active playback state", () => {
    const { result } = renderHook(() =>
      useFlowPlayback({
        nodes,
        edges,
        steps,
        defaultDurationMs: 1_000
      })
    );

    expect(result.current.activeNodeIds).toEqual(["start"]);
    expect(result.current.activeEdgeIds).toEqual(["start-finish"]);
    expect(result.current.nodes).toEqual([
      expect.objectContaining({
        id: "start",
        data: expect.objectContaining({ flowPlayActive: true })
      }),
      expect.objectContaining({
        id: "finish",
        data: expect.objectContaining({ flowPlayActive: false })
      })
    ]);
    expect(result.current.edges).toEqual([
      expect.objectContaining({
        id: "start-finish",
        data: expect.objectContaining({ flowPlayActive: true })
      })
    ]);
  });

  it("exposes playback controls and callback behavior through the headless engine", () => {
    const onStatusChange = vi.fn();
    const onStepChange = vi.fn();
    const { result } = renderHook(() =>
      useFlowPlayback({
        nodes,
        edges,
        steps,
        defaultDurationMs: 1_000,
        onStatusChange,
        onStepChange
      })
    );

    act(() => result.current.play());
    act(() => result.current.next());

    expect(result.current.currentStep.id).toBe("done");
    expect(result.current.activeNodeIds).toEqual(["finish"]);
    expect(result.current.activeEdgeIds).toEqual([]);
    expect(onStatusChange).toHaveBeenCalledWith(
      "playing",
      expect.objectContaining({ currentStepIndex: 0 })
    );
    expect(onStepChange).toHaveBeenCalledWith(
      steps[1],
      expect.objectContaining({ status: "playing", currentStepIndex: 1 })
    );
  });

  it("reports diagnostics for unknown dynamic node and edge references", () => {
    const { result } = renderHook(() =>
      useFlowPlayback({
        nodes,
        edges,
        steps: [
          {
            id: "missing-refs",
            title: "Missing refs",
            nodeIds: ["missing-node"],
            edgeIds: ["missing-edge"]
          }
        ],
        defaultDurationMs: 1_000
      })
    );

    expect(result.current.diagnostics).toEqual([
      {
        code: "unknown-node",
        id: "missing-node",
        stepId: "missing-refs",
        message:
          'Flow playback step "missing-refs" references unknown React Flow node "missing-node".'
      },
      {
        code: "unknown-edge",
        id: "missing-edge",
        stepId: "missing-refs",
        message:
          'Flow playback step "missing-refs" references unknown React Flow edge "missing-edge".'
      }
    ]);
  });

  it("keeps viewport behavior disabled by default", () => {
    const reactFlow = createReactFlowViewport();
    const viewportSteps: FlowPlaybackStep[] = [
      introStep,
      {
        id: "focus-finish",
        title: "Focus finish",
        nodeIds: ["finish"],
        edgeIds: [],
        viewport: { nodeIds: ["finish"], padding: 0.25 }
      }
    ];
    const { result } = renderHook(() =>
      useFlowPlayback({
        nodes,
        edges,
        steps: viewportSteps,
        defaultDurationMs: 1_000,
        viewport: { reactFlow }
      })
    );

    act(() => result.current.next());

    expect(reactFlow.fitView).not.toHaveBeenCalled();
    expect(reactFlow.setViewport).not.toHaveBeenCalled();
  });

  it("applies optional viewport behavior when enabled", () => {
    const reactFlow = createReactFlowViewport();
    const viewportSteps: FlowPlaybackStep[] = [
      introStep,
      {
        id: "focus-finish",
        title: "Focus finish",
        nodeIds: ["finish"],
        edgeIds: [],
        viewport: { nodeIds: ["finish"], padding: 0.25 }
      },
      {
        id: "pan",
        title: "Pan",
        nodeIds: [],
        edgeIds: [],
        viewport: { x: 10, y: 20, zoom: 1.5 }
      }
    ];
    const { result } = renderHook(() =>
      useFlowPlayback({
        nodes,
        edges,
        steps: viewportSteps,
        defaultDurationMs: 1_000,
        viewport: { enabled: true, reactFlow }
      })
    );

    act(() => result.current.next());
    act(() => result.current.next());

    expect(reactFlow.fitView).toHaveBeenCalledWith({
      nodes: [{ id: "finish" }],
      padding: 0.25
    });
    expect(reactFlow.setViewport).toHaveBeenCalledWith({ x: 10, y: 20, zoom: 1.5 });
  });
});

function createReactFlowViewport() {
  return {
    fitView: vi.fn(),
    setViewport: vi.fn()
  } as unknown as Pick<ReactFlowInstance, "fitView" | "setViewport">;
}
