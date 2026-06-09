// @vitest-environment jsdom

import React from "react";
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Edge, Node, ReactFlowInstance } from "@xyflow/react";
import { FlowPlaybackControls, useFlowPlayback } from "./react-flow";
import type { FlowPlaybackStep } from "./index";

const nodes: Node[] = [
  { id: "start", position: { x: 0, y: 0 }, data: { label: "Start" } },
  { id: "finish", position: { x: 100, y: 0 }, data: { label: "Finish" } }
];

const edges: Edge[] = [{ id: "start-finish", source: "start", target: "finish" }];

const steps: FlowPlaybackStep[] = [
  {
    id: "intro",
    type: "highlight",
    title: "Introduce the path",
    nodeIds: ["start"],
    edgeIds: ["start-finish"]
  },
  {
    id: "done",
    type: "highlight",
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

    expect(result.current.currentStep?.id).toBe("done");
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

  it("exposes curation actions and keeps playback pointer valid", () => {
    const { result } = renderHook(() =>
      useFlowPlayback({
        nodes,
        edges,
        steps,
        defaultDurationMs: 1_000
      })
    );

    expect(result.current.stepList).toEqual([
      expect.objectContaining({
        id: "intro",
        typeLabel: "Highlight",
        title: "Introduce the path",
        playbackEnabled: true
      }),
      expect.objectContaining({
        id: "done",
        typeLabel: "Highlight",
        title: "Finish the path",
        playbackEnabled: true
      })
    ]);

    act(() => result.current.setStepPlaybackEnabled("intro", false));

    expect(result.current.currentStep?.id).toBe("done");
    expect(result.current.stepCount).toBe(1);
    expect(result.current.steps.map((step) => step.id)).toEqual(["done"]);
    expect(result.current.stepList[0]).toMatchObject({
      id: "intro",
      playbackEnabled: false
    });

    act(() => result.current.deleteStep("done"));

    expect(result.current.currentStep).toBeUndefined();
    expect(result.current.stepCount).toBe(0);
    expect(result.current.steps).toEqual([]);
    expect(result.current.stepList.map((step) => step.id)).toEqual(["intro"]);
  });

  it("reports diagnostics for unknown dynamic node and edge references", () => {
    const { result } = renderHook(() =>
      useFlowPlayback({
        nodes,
        edges,
        steps: [
          {
            id: "missing-refs",
            type: "highlight",
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
        type: "highlight",
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
        type: "highlight",
        title: "Focus finish",
        nodeIds: ["finish"],
        edgeIds: [],
        viewport: { nodeIds: ["finish"], padding: 0.25 }
      },
      {
        id: "pan",
        type: "highlight",
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

describe("FlowPlaybackControls", () => {
  it("renders accessible unstyled controls that drive playback actions", () => {
    render(React.createElement(PlaybackControlsHarness));

    expect(button("Play").disabled).toBe(false);
    expect(button("Pause").disabled).toBe(true);
    expect(button("Previous step").disabled).toBe(true);
    expect(button("Next step").disabled).toBe(false);
    expect(button("Reset playback").disabled).toBe(true);
    expect(select("Go to step").value).toBe("intro");

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByTestId("playback-status").textContent).toBe("playing");
    expect(button("Play").disabled).toBe(true);
    expect(button("Pause").disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByTestId("current-step").textContent).toBe("done");
    expect(button("Previous step").disabled).toBe(false);
    expect(button("Reset playback").disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    expect(screen.getByTestId("current-step").textContent).toBe("intro");

    fireEvent.change(screen.getByRole("combobox", { name: "Go to step" }), {
      target: { value: "done" }
    });
    expect(screen.getByTestId("current-step").textContent).toBe("done");

    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByTestId("playback-status").textContent).toBe("completed");
    expect(button("Next step").disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Reset playback" }));
    expect(screen.getByTestId("playback-status").textContent).toBe("idle");
    expect(screen.getByTestId("current-step").textContent).toBe("intro");
  });

  it("disables controls and hides disabled timeline steps when no playback steps are enabled", () => {
    const { container } = render(
      React.createElement(PlaybackControlsHarness, { playbackEnabled: false })
    );
    const rendered = within(container);

    expect((rendered.getByRole("button", { name: "Play" }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect((rendered.getByRole("button", { name: "Pause" }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(
      (rendered.getByRole("button", { name: "Previous step" }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      (rendered.getByRole("button", { name: "Next step" }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      (rendered.getByRole("button", { name: "Reset playback" }) as HTMLButtonElement).disabled
    ).toBe(true);
    const stepSelect = rendered.getByRole("combobox", { name: "Go to step" }) as HTMLSelectElement;
    expect(stepSelect.disabled).toBe(true);
    expect(stepSelect.value).toBe("");
    expect(rendered.getByTestId("playback-status").textContent).toBe("idle");
    expect(rendered.getByTestId("current-step").textContent).toBe("none");
    expect(rendered.queryByRole("option", { name: "Introduce the path" })).toBeNull();
  });

  it("updates controls when curation removes the active playback step", () => {
    const { container } = render(React.createElement(PlaybackControlsHarness));
    const rendered = within(container);

    fireEvent.click(rendered.getByRole("button", { name: "Disable Introduce the path" }));

    expect(rendered.getByTestId("current-step").textContent).toBe("done");
    expect(
      (rendered.getByRole("combobox", { name: "Go to step" }) as HTMLSelectElement).value
    ).toBe("done");
    expect(rendered.queryByRole("option", { name: "Introduce the path" })).toBeNull();

    fireEvent.click(rendered.getByRole("button", { name: "Delete Finish the path" }));

    expect(rendered.getByTestId("current-step").textContent).toBe("none");
    expect((rendered.getByRole("button", { name: "Play" }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(
      (rendered.getByRole("combobox", { name: "Go to step" }) as HTMLSelectElement).disabled
    ).toBe(true);
  });

  it("allows visible labels and aria labels to be customized", () => {
    render(
      React.createElement(PlaybackControlsHarness, {
        labels: {
          play: "Start",
          playAriaLabel: "Start the tour",
          pause: "Stop",
          pauseAriaLabel: "Stop the tour",
          previous: "Back",
          previousAriaLabel: "Back one step",
          next: "Forward",
          nextAriaLabel: "Forward one step",
          reset: "Restart",
          resetAriaLabel: "Restart the tour",
          stepSelect: "Jump",
          stepSelectAriaLabel: "Jump to step"
        }
      })
    );

    expect(screen.getByRole("button", { name: "Start the tour" }).textContent).toBe("Start");
    expect(screen.getByRole("button", { name: "Stop the tour" }).textContent).toBe("Stop");
    expect(screen.getByRole("button", { name: "Back one step" }).textContent).toBe("Back");
    expect(screen.getByRole("button", { name: "Forward one step" }).textContent).toBe("Forward");
    expect(screen.getByRole("button", { name: "Restart the tour" }).textContent).toBe("Restart");
    expect(screen.getByRole("combobox", { name: "Jump to step" })).toBeDefined();
    expect(screen.getByText("Jump")).toBeDefined();
  });
});

function createReactFlowViewport() {
  return {
    fitView: vi.fn(),
    setViewport: vi.fn()
  } as unknown as Pick<ReactFlowInstance, "fitView" | "setViewport">;
}

function button(name: string) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

function select(name: string) {
  return screen.getByRole("combobox", { name }) as HTMLSelectElement;
}

function PlaybackControlsHarness({
  labels,
  playbackEnabled = true
}: {
  labels?: React.ComponentProps<typeof FlowPlaybackControls>["labels"];
  playbackEnabled?: boolean;
}) {
  const harnessSteps = playbackEnabled
    ? steps
    : steps.map((step) => ({ ...step, playbackEnabled: false }));
  const playback = useFlowPlayback({
    nodes,
    edges,
    steps: harnessSteps,
    defaultDurationMs: 1_000
  });

  return React.createElement(
    "div",
    {},
    React.createElement(FlowPlaybackControls, { labels, playback }),
    playback.stepList.map((step) =>
      React.createElement(
        "button",
        {
          key: `toggle-${step.id}`,
          type: "button",
          onClick: () => playback.setStepPlaybackEnabled(step.id, !step.playbackEnabled)
        },
        `${step.playbackEnabled ? "Disable" : "Enable"} ${step.title}`
      )
    ),
    playback.stepList.map((step) =>
      React.createElement(
        "button",
        {
          key: `delete-${step.id}`,
          type: "button",
          onClick: () => playback.deleteStep(step.id)
        },
        `Delete ${step.title}`
      )
    ),
    React.createElement("output", { "data-testid": "playback-status" }, playback.status),
    React.createElement(
      "output",
      { "data-testid": "current-step" },
      playback.currentStep?.id ?? "none"
    )
  );
}
