import { describe, expect, it } from "vitest";
import { createFlowPlayback } from "./index";
import {
  reconstructFinalFlowState,
  reconstructFlowState,
  type FlowReplayState
} from "./flow-replay";
import type { FlowEdgeSnapshot, FlowNodeSnapshot, FlowStep } from "./index";

const initialNodes: FlowNodeSnapshot[] = [
  { id: "request", position: { x: 0, y: 0 }, data: { label: "Request" } },
  { id: "review", position: { x: 100, y: 0 }, data: { label: "Review" } }
];

const initialEdges: FlowEdgeSnapshot[] = [
  {
    id: "request-review",
    source: "request",
    target: "review",
    data: { lane: "primary" }
  },
  {
    id: "request-approve",
    source: "request",
    target: "approve",
    data: { rule: "approved" },
    label: "approved path"
  }
];

function replayThrough(
  steps: readonly FlowStep[],
  throughHistoryIndex: number
): FlowReplayState {
  return reconstructFlowState({
    initialNodes,
    initialEdges,
    steps,
    throughHistoryIndex
  });
}

describe("flow replay state reconstruction", () => {
  it("reconstructs after node-add at an enabled playback stop", () => {
    const steps: FlowStep[] = [
      {
        id: "add-approve",
        type: "node-add",
        title: "Add approve",
        node: {
          id: "approve",
          position: { x: 200, y: 40 },
          data: { label: "Approval gate" }
        }
      }
    ];

    expect(replayThrough(steps, 0)).toEqual({
      nodes: [
        ...initialNodes,
        {
          id: "approve",
          position: { x: 200, y: 40 },
          data: { label: "Approval gate" }
        }
      ],
      edges: initialEdges
    });
  });

  it("reconstructs after node-delete at an enabled playback stop", () => {
    const steps: FlowStep[] = [
      {
        id: "delete-review",
        type: "node-delete",
        title: "Delete review",
        node: {
          id: "review",
          position: { x: 100, y: 0 },
          data: { label: "Review" },
          type: "reviewNode"
        },
        connectedEdges: [initialEdges[0]!]
      }
    ];

    expect(replayThrough(steps, 0)).toEqual({
      nodes: [initialNodes[0]],
      edges: [initialEdges[1]]
    });
  });

  it("reconstructs after node-drag at an enabled playback stop", () => {
    const steps: FlowStep[] = [
      {
        id: "drag-review",
        type: "node-drag",
        title: "Move review",
        nodeId: "review",
        from: { x: 100, y: 0 },
        to: { x: 140, y: 60 }
      }
    ];

    expect(replayThrough(steps, 0)).toEqual({
      nodes: [initialNodes[0], { ...initialNodes[1], position: { x: 140, y: 60 } }],
      edges: initialEdges
    });
  });

  it("reconstructs after node-edit at an enabled playback stop", () => {
    const steps: FlowStep[] = [
      {
        id: "edit-review",
        type: "node-edit",
        title: "Rename review",
        before: initialNodes[1]!,
        after: {
          id: "review",
          position: { x: 100, y: 0 },
          data: { label: "Reviewer queue" }
        }
      }
    ];

    expect(replayThrough(steps, 0)).toEqual({
      nodes: [
        initialNodes[0],
        {
          id: "review",
          position: { x: 100, y: 0 },
          data: { label: "Reviewer queue" }
        }
      ],
      edges: initialEdges
    });
  });

  it("reconstructs after edge-connect at an enabled playback stop", () => {
    const connectedEdge: FlowEdgeSnapshot = {
      id: "review-finish",
      source: "review",
      target: "finish",
      data: { customEdgeField: "outgoing" },
      animated: true
    };
    const steps: FlowStep[] = [
      {
        id: "connect-review-finish",
        type: "edge-connect",
        title: "Connect review to finish",
        edge: connectedEdge
      }
    ];

    expect(replayThrough(steps, 0)).toEqual({
      nodes: initialNodes,
      edges: [...initialEdges, connectedEdge]
    });
  });

  it("reconstructs after edge-delete at an enabled playback stop", () => {
    const steps: FlowStep[] = [
      {
        id: "delete-request-approve",
        type: "edge-delete",
        title: "Delete approved path",
        edge: initialEdges[1]!
      }
    ];

    expect(replayThrough(steps, 0)).toEqual({
      nodes: initialNodes,
      edges: [initialEdges[0]]
    });
  });

  it("applies disabled steps into replay state without becoming playback stops", () => {
    const steps: FlowStep[] = [
      {
        id: "add-approve",
        type: "node-add",
        title: "Add approve",
        node: {
          id: "approve",
          position: { x: 200, y: 40 },
          data: { label: "Approval gate" }
        }
      },
      {
        id: "silent-edit",
        type: "node-edit",
        title: "Silent rename",
        playbackEnabled: false,
        before: {
          id: "approve",
          position: { x: 200, y: 40 },
          data: { label: "Approval gate" }
        },
        after: {
          id: "approve",
          position: { x: 200, y: 40 },
          data: { label: "Approval queue" }
        }
      },
      {
        id: "drag-review",
        type: "node-drag",
        title: "Move review",
        nodeId: "review",
        from: { x: 100, y: 0 },
        to: { x: 160, y: 20 }
      }
    ];

    const playback = createFlowPlayback({
      steps,
      defaultDurationMs: 1_000,
      replay: { initialNodes, initialEdges }
    });

    expect(playback.getState()).toMatchObject({
      currentStep: steps[0],
      currentStepIndex: 0,
      stepCount: 2
    });

    expect(playback.getReconstructedFlow().nodes.find((node) => node.id === "approve")?.data).toEqual(
      { label: "Approval gate" }
    );

    playback.next();

    expect(playback.getState().currentStep).toBe(steps[2]);
    expect(playback.getReconstructedFlow()).toEqual({
      nodes: [
        initialNodes[0],
        { ...initialNodes[1], position: { x: 160, y: 20 } },
        {
          id: "approve",
          position: { x: 200, y: 40 },
          data: { label: "Approval queue" }
        }
      ],
      edges: initialEdges
    });

    playback.previous();

    expect(playback.getReconstructedFlow().nodes.find((node) => node.id === "approve")?.data).toEqual(
      { label: "Approval gate" }
    );
  });

  it("exposes final reconstructed flow after the full history", () => {
    const steps: FlowStep[] = [
      {
        id: "delete-review",
        type: "node-delete",
        title: "Delete review",
        node: initialNodes[1]!,
        connectedEdges: [initialEdges[0]!]
      }
    ];

    const playback = createFlowPlayback({
      steps,
      defaultDurationMs: 1_000,
      replay: { initialNodes, initialEdges }
    });

    expect(playback.getFinalReconstructedFlow()).toEqual(replayThrough(steps, 0));
    expect(reconstructFinalFlowState({ initialNodes, initialEdges, steps })).toEqual(
      replayThrough(steps, 0)
    );
  });
});
