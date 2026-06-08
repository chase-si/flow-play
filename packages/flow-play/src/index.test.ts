import { describe, expect, it, vi } from "vitest";
import {
  createFlowPlayback,
  createFlowPlaybackPreview,
  FlowPlaybackError,
  type FlowPlaybackStep
} from "./index";

interface DemoMetadata {
  tone: "intro" | "warning" | "success";
}

const steps: FlowPlaybackStep<DemoMetadata>[] = [
  {
    id: "intro",
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
    title: "Review the branch",
    nodeIds: ["review"],
    edgeIds: ["review-finish"],
    metadata: { tone: "warning" }
  },
  {
    id: "finish",
    title: "Complete the path",
    nodeIds: ["finish"],
    edgeIds: [],
    metadata: { tone: "success" }
  }
];

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
    expect(playback.next().currentStep.id).toBe("review");
    expect(playback.pause().status).toBe("paused");
    expect(playback.previous().currentStep.id).toBe("intro");
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
    expect(() => createFlowPlayback({ steps: [], defaultDurationMs: 1_000 })).toThrow(
      new FlowPlaybackError("Flow playback requires at least one step.")
    );
    expect(() =>
      createFlowPlayback({
        steps: [
          { id: "duplicate", title: "First", nodeIds: [], edgeIds: [] },
          { id: "duplicate", title: "Second", nodeIds: [], edgeIds: [] }
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
          { id: "invalid-duration", title: "Invalid", nodeIds: [], edgeIds: [], durationMs: -1 }
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
        steps: [{ id: "missing-title", title: "", nodeIds: [], edgeIds: [] }],
        defaultDurationMs: 1_000
      })
    ).toThrow(new FlowPlaybackError('Flow playback step "missing-title" title must not be empty.'));
    expect(() =>
      createFlowPlayback({
        steps: [
          {
            id: "invalid-refs",
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
