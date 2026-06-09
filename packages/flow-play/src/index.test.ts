import { describe, expect, it, vi } from "vitest";
import {
  createFlowPlayback,
  createFlowPlaybackPreview,
  FlowPlaybackError,
  type FlowPlay,
  type FlowStep,
  type FlowPlaybackStep
} from "./index";

interface DemoMetadata {
  tone: "intro" | "warning" | "success";
}

const steps: FlowPlaybackStep<DemoMetadata>[] = [
  {
    id: "intro",
    type: "highlight",
    title: "Introduce the path",
    description: "Explain why this path matters.",
    nodeIds: ["start"],
    edgeIds: ["start-review"],
    viewport: { nodeIds: ["start"], padding: 0.2 },
    durationMs: 500,
    metadata: { tone: "intro" }
  },
  {
    id: "review",
    type: "highlight",
    title: "Review the branch",
    nodeIds: ["review"],
    edgeIds: ["review-finish"],
    metadata: { tone: "warning" }
  },
  {
    id: "finish",
    type: "highlight",
    title: "Complete the path",
    nodeIds: ["finish"],
    edgeIds: [],
    metadata: { tone: "success" }
  }
];

const timeline: FlowPlay<DemoMetadata> = {
  steps: [
    {
      id: "intro",
      type: "highlight",
      title: "Introduce the path",
      nodeIds: ["start"],
      edgeIds: ["start-review"],
      metadata: { tone: "intro" }
    },
    {
      id: "notes",
      type: "highlight",
      title: "Static guide notes",
      playbackEnabled: false,
      nodeIds: ["review"],
      edgeIds: ["review-finish"],
      metadata: { tone: "warning" }
    },
    {
      id: "finish",
      type: "highlight",
      title: "Complete the path",
      nodeIds: ["finish"],
      edgeIds: [],
      metadata: { tone: "success" }
    }
  ]
};

describe("createFlowPlaybackPreview", () => {
  it("summarizes the first playable step through the public package API", () => {
    const preview = createFlowPlaybackPreview(steps);

    expect(preview).toEqual({
      initialStepId: "intro",
      status: "idle",
      stepCount: 3
    });
  });
});

describe("createFlowPlayback", () => {
  it("exposes every history step with curation data for playback lists", () => {
    const playback = createFlowPlayback({ steps: timeline.steps, defaultDurationMs: 1_000 });

    expect(playback.getStepList()).toEqual([
      {
        id: "intro",
        type: "highlight",
        typeLabel: "Highlight",
        title: "Introduce the path",
        playbackEnabled: true
      },
      {
        id: "notes",
        type: "highlight",
        typeLabel: "Highlight",
        title: "Static guide notes",
        playbackEnabled: false
      },
      {
        id: "finish",
        type: "highlight",
        typeLabel: "Highlight",
        title: "Complete the path",
        playbackEnabled: true
      }
    ]);
  });

  it("projects enabled highlight steps into the playback queue", () => {
    const playback = createFlowPlayback({ steps: timeline.steps, defaultDurationMs: 1_000 });

    expect(playback.getState()).toMatchObject({
      currentStep: timeline.steps[0],
      currentStepIndex: 0,
      stepCount: 2,
      status: "idle"
    });

    expect(playback.next()).toMatchObject({
      currentStep: timeline.steps[2],
      currentStepIndex: 1,
      stepCount: 2
    });
  });

  it("supports an empty enabled playback queue without throwing", () => {
    const disabledSteps: FlowStep[] = [
      {
        id: "notes",
        type: "highlight",
        title: "Static guide notes",
        playbackEnabled: false,
        nodeIds: ["review"],
        edgeIds: []
      }
    ];
    const playback = createFlowPlayback({ steps: disabledSteps, defaultDurationMs: 1_000 });

    expect(playback.getState()).toEqual({
      currentStep: undefined,
      currentStepIndex: -1,
      elapsedMs: 0,
      status: "idle",
      stepCount: 0,
      stepDurationMs: 0
    });
    expect(playback.play().status).toBe("idle");
    expect(playback.next().currentStep).toBeUndefined();
  });

  it("toggles playback inclusion while keeping disabled steps in history", () => {
    const playback = createFlowPlayback({ steps, defaultDurationMs: 1_000 });

    expect(playback.setStepPlaybackEnabled("review", false)).toMatchObject({
      currentStep: steps[0],
      currentStepIndex: 0,
      stepCount: 2
    });
    expect(playback.getStepList()[1]).toMatchObject({
      id: "review",
      playbackEnabled: false
    });

    expect(playback.next()).toMatchObject({
      currentStep: steps[2],
      currentStepIndex: 1,
      stepCount: 2
    });

    expect(playback.setStepPlaybackEnabled("review", true)).toMatchObject({
      currentStep: steps[2],
      currentStepIndex: 2,
      stepCount: 3
    });
  });

  it("moves the pointer when disabling the current playback step", () => {
    const playback = createFlowPlayback({ steps, defaultDurationMs: 1_000 });

    playback.goToStep("review");
    expect(playback.setStepPlaybackEnabled("review", false)).toMatchObject({
      currentStep: steps[2],
      currentStepIndex: 1,
      stepCount: 2
    });

    expect(playback.setStepPlaybackEnabled("finish", false)).toMatchObject({
      currentStep: steps[0],
      currentStepIndex: 0,
      stepCount: 1
    });

    expect(playback.setStepPlaybackEnabled("intro", false)).toEqual({
      currentStep: undefined,
      currentStepIndex: -1,
      elapsedMs: 0,
      status: "idle",
      stepCount: 0,
      stepDurationMs: 0
    });
  });

  it("deletes history steps without behaving as undo", () => {
    const playback = createFlowPlayback({ steps, defaultDurationMs: 1_000 });

    playback.goToStep("review");

    expect(playback.deleteStep("intro")).toMatchObject({
      currentStep: steps[1],
      currentStepIndex: 0,
      stepCount: 2
    });
    expect(playback.getStepList().map((step) => step.id)).toEqual(["review", "finish"]);

    expect(playback.deleteStep("review")).toMatchObject({
      currentStep: steps[2],
      currentStepIndex: 0,
      stepCount: 1
    });

    expect(playback.deleteStep("finish")).toEqual({
      currentStep: undefined,
      currentStepIndex: -1,
      elapsedMs: 0,
      status: "idle",
      stepCount: 0,
      stepDurationMs: 0
    });

    const playbackAtEnd = createFlowPlayback({ steps, defaultDurationMs: 1_000 });
    playbackAtEnd.goToStep("finish");

    expect(playbackAtEnd.deleteStep("finish")).toMatchObject({
      currentStep: steps[1],
      currentStepIndex: 1,
      stepCount: 2
    });
  });

  it("records node drag, add, edit, node delete, and edge delete steps with generated labels", () => {
    const playback = createFlowPlayback({
      steps: [],
      defaultDurationMs: 1_000,
      formatNodeLabel: (node) => (node.id === "review" ? "Reviewer queue" : undefined)
    });

    playback.recordNodeDrag({
      nodeId: "review",
      from: { x: 10, y: 20 },
      to: { x: 40, y: 80 }
    });
    playback.recordNodeAdd({
      node: {
        id: "approve",
        position: { x: 120, y: 40 },
        data: { label: "Approval gate" }
      }
    });
    playback.recordNodeEdit({
      before: {
        id: "fallback",
        position: { x: 0, y: 0 },
        data: { label: "Old label" }
      },
      after: {
        id: "fallback",
        position: { x: 0, y: 0 },
        data: { label: "New label" }
      }
    });
    playback.recordNodeDelete({
      node: {
        id: "review",
        position: { x: 80, y: 40 },
        data: { label: "Reviewer queue", customNodeField: "kept" },
        type: "reviewNode"
      },
      connectedEdges: [
        {
          id: "request-review",
          source: "request",
          target: "review",
          data: { customEdgeField: "incoming" },
          markerEnd: { type: "arrowclosed" }
        },
        {
          id: "review-finish",
          source: "review",
          target: "finish",
          data: { customEdgeField: "outgoing" },
          animated: true
        }
      ]
    });
    playback.recordEdgeDelete({
      edge: {
        id: "request-approve",
        source: "request",
        target: "approve",
        data: { rule: "approved" },
        label: "approved path"
      }
    });

    expect(playback.getStepList()).toEqual([
      expect.objectContaining({
        id: "node-drag-review-1",
        type: "node-drag",
        typeLabel: "Node drag",
        title: "Move Reviewer queue",
        playbackEnabled: true
      }),
      expect.objectContaining({
        id: "node-add-approve-2",
        type: "node-add",
        typeLabel: "Node add",
        title: "Add approve",
        playbackEnabled: true
      }),
      expect.objectContaining({
        id: "node-edit-fallback-3",
        type: "node-edit",
        typeLabel: "Node edit",
        title: "Edit fallback",
        playbackEnabled: true
      }),
      expect.objectContaining({
        id: "node-delete-review-4",
        type: "node-delete",
        typeLabel: "Node delete",
        title: "Delete Reviewer queue",
        playbackEnabled: true
      }),
      expect.objectContaining({
        id: "edge-delete-request-approve-5",
        type: "edge-delete",
        typeLabel: "Edge delete",
        title: "Delete request-approve",
        playbackEnabled: true
      })
    ]);
    expect(playback.getState()).toMatchObject({
      currentStep: {
        id: "node-drag-review-1",
        type: "node-drag",
        nodeId: "review",
        from: { x: 10, y: 20 },
        to: { x: 40, y: 80 }
      },
      stepCount: 5
    });
    expect(playback.getSteps()).toEqual([
      expect.objectContaining({
        id: "node-drag-review-1",
        type: "node-drag",
        nodeId: "review",
        from: { x: 10, y: 20 },
        to: { x: 40, y: 80 }
      }),
      expect.objectContaining({
        id: "node-add-approve-2",
        type: "node-add",
        node: {
          id: "approve",
          position: { x: 120, y: 40 },
          data: { label: "Approval gate" }
        }
      }),
      expect.objectContaining({
        id: "node-edit-fallback-3",
        type: "node-edit",
        before: {
          id: "fallback",
          position: { x: 0, y: 0 },
          data: { label: "Old label" }
        },
        after: {
          id: "fallback",
          position: { x: 0, y: 0 },
          data: { label: "New label" }
        }
      }),
      expect.objectContaining({
        id: "node-delete-review-4",
        type: "node-delete",
        node: {
          id: "review",
          position: { x: 80, y: 40 },
          data: { label: "Reviewer queue", customNodeField: "kept" },
          type: "reviewNode"
        },
        connectedEdges: [
          {
            id: "request-review",
            source: "request",
            target: "review",
            data: { customEdgeField: "incoming" },
            markerEnd: { type: "arrowclosed" }
          },
          {
            id: "review-finish",
            source: "review",
            target: "finish",
            data: { customEdgeField: "outgoing" },
            animated: true
          }
        ]
      }),
      expect.objectContaining({
        id: "edge-delete-request-approve-5",
        type: "edge-delete",
        edge: {
          id: "request-approve",
          source: "request",
          target: "approve",
          data: { rule: "approved" },
          label: "approved path"
        }
      })
    ]);
  });

  it("allows callers to override node edit type labels", () => {
    const playback = createFlowPlayback({
      steps: [
        {
          id: "move-review",
          type: "node-drag",
          title: "Move review",
          nodeId: "review",
          from: { x: 0, y: 0 },
          to: { x: 20, y: 10 }
        }
      ],
      defaultDurationMs: 1_000,
      stepTypeLabels: {
        "node-drag": "Moved node",
        "node-delete": "Removed node"
      }
    });

    expect(playback.getStepList()).toEqual([
      {
        id: "move-review",
        type: "node-drag",
        typeLabel: "Moved node",
        title: "Move review",
        playbackEnabled: true
      }
    ]);
  });

  it("exposes serializable step definitions and non-controlled playback state", () => {
    const playback = createFlowPlayback({ steps, defaultDurationMs: 1_000 });

    expect(playback.getState()).toEqual({
      currentStep: steps[0],
      currentStepIndex: 0,
      elapsedMs: 0,
      status: "idle",
      stepCount: 3,
      stepDurationMs: 500
    });
  });

  it("supports play, pause, next, previous, reset, and go-to-step transitions", () => {
    const playback = createFlowPlayback({ steps, defaultDurationMs: 1_000 });

    expect(playback.play().status).toBe("playing");
    expect(playback.next().currentStep?.id).toBe("review");
    expect(playback.pause().status).toBe("paused");
    expect(playback.previous().currentStep?.id).toBe("intro");
    expect(playback.goToStep("finish").currentStepIndex).toBe(2);
    expect(playback.reset()).toMatchObject({
      currentStep: steps[0],
      currentStepIndex: 0,
      elapsedMs: 0,
      status: "idle"
    });
  });

  it("advances with timers using step overrides before the global default", () => {
    const playback = createFlowPlayback({ steps, defaultDurationMs: 1_000 });

    playback.play();

    expect(playback.advanceBy(499)).toMatchObject({
      currentStep: steps[0],
      elapsedMs: 499,
      status: "playing",
      stepDurationMs: 500
    });

    expect(playback.advanceBy(1)).toMatchObject({
      currentStep: steps[1],
      elapsedMs: 0,
      status: "playing",
      stepDurationMs: 1_000
    });

    expect(playback.advanceBy(1_000)).toMatchObject({
      currentStep: steps[2],
      elapsedMs: 0,
      status: "playing",
      stepDurationMs: 1_000
    });

    expect(playback.advanceBy(1_000)).toMatchObject({
      currentStep: steps[2],
      elapsedMs: 1_000,
      status: "completed"
    });
  });

  it("exposes status and step change callbacks", () => {
    const onStatusChange = vi.fn();
    const onStepChange = vi.fn();
    const playback = createFlowPlayback({
      steps,
      defaultDurationMs: 1_000,
      onStatusChange,
      onStepChange
    });

    playback.play();
    playback.next();
    playback.pause();
    playback.goToStep("finish");

    expect(onStatusChange).toHaveBeenNthCalledWith(
      1,
      "playing",
      expect.objectContaining({ currentStepIndex: 0 })
    );
    expect(onStatusChange).toHaveBeenNthCalledWith(
      2,
      "paused",
      expect.objectContaining({ currentStepIndex: 1 })
    );
    expect(onStepChange).toHaveBeenNthCalledWith(
      1,
      steps[1],
      expect.objectContaining({ status: "playing" })
    );
    expect(onStepChange).toHaveBeenNthCalledWith(
      2,
      steps[2],
      expect.objectContaining({ status: "paused" })
    );
  });

  it("validates invalid core configuration with clear errors", () => {
    expect(() =>
      createFlowPlayback({
        steps: [
          { id: "duplicate", type: "highlight", title: "First", nodeIds: [], edgeIds: [] },
          { id: "duplicate", type: "highlight", title: "Second", nodeIds: [], edgeIds: [] }
        ],
        defaultDurationMs: 1_000
      })
    ).toThrow(
      new FlowPlaybackError('Flow playback step IDs must be unique. Duplicate ID: "duplicate".')
    );
    expect(() => createFlowPlayback({ steps, defaultDurationMs: 0 })).toThrow(
      new FlowPlaybackError("Flow playback defaultDurationMs must be greater than 0.")
    );
    expect(() =>
      createFlowPlayback({
        steps: [
          {
            id: "invalid-duration",
            type: "highlight",
            title: "Invalid",
            nodeIds: [],
            edgeIds: [],
            durationMs: -1
          }
        ],
        defaultDurationMs: 1_000
      })
    ).toThrow(
      new FlowPlaybackError(
        'Flow playback step "invalid-duration" durationMs must be greater than 0 when provided.'
      )
    );
    expect(() =>
      createFlowPlayback({ steps, defaultDurationMs: 1_000 }).goToStep("missing")
    ).toThrow(new FlowPlaybackError('Flow playback step "missing" does not exist.'));
    expect(() =>
      createFlowPlayback({
        steps: [{ id: "missing-title", type: "highlight", title: "", nodeIds: [], edgeIds: [] }],
        defaultDurationMs: 1_000
      })
    ).toThrow(new FlowPlaybackError('Flow playback step "missing-title" title must not be empty.'));
    expect(() =>
      createFlowPlayback({
        steps: [
          {
            id: "invalid-refs",
            type: "highlight",
            title: "Invalid refs",
            nodeIds: "node-a",
            edgeIds: []
          } as unknown as FlowPlaybackStep
        ],
        defaultDurationMs: 1_000
      })
    ).toThrow(new FlowPlaybackError('Flow playback step "invalid-refs" nodeIds must be an array.'));
  });
});
