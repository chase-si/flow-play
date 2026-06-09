import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node
} from "@xyflow/react";
import {
  FlowPlaybackControls,
  useFlowPlayback,
  type UseFlowPlaybackResult
} from "flow-play/react-flow";
import type { FlowPlaybackStep } from "flow-play";

type DemoNodeData = {
  label: string;
  flowPlayActive?: boolean;
};

type DemoEdgeData = {
  flowPlayActive?: boolean;
};

type DemoPlayback = UseFlowPlaybackResult<DemoNodeData, DemoEdgeData>;

const nodes = [
  {
    id: "request",
    position: { x: 0, y: 80 },
    data: { label: "Customer request" }
  },
  {
    id: "triage",
    position: { x: 280, y: 0 },
    data: { label: "Triage signals" }
  },
  {
    id: "review",
    position: { x: 560, y: 80 },
    data: { label: "Reviewer queue" }
  },
  {
    id: "handoff",
    position: { x: 840, y: 0 },
    data: { label: "Handoff ready" }
  }
] satisfies Node<DemoNodeData>[];

const edges = [
  { id: "request-triage", source: "request", target: "triage" },
  { id: "triage-review", source: "triage", target: "review" },
  { id: "review-handoff", source: "review", target: "handoff" }
] satisfies Edge<DemoEdgeData>[];

const steps = [
  {
    id: "collect",
    type: "highlight",
    title: "Collect request context",
    description: "Capture the customer signal and prepare the handoff path.",
    nodeIds: ["request"],
    edgeIds: ["request-triage"],
    viewport: { nodeIds: ["request", "triage"], padding: 0.35 }
  },
  {
    id: "validate",
    type: "highlight",
    title: "Validate routing conditions",
    description: "Check plan fit, risk, and required reviewer context.",
    nodeIds: ["triage", "review"],
    edgeIds: ["triage-review"],
    viewport: { nodeIds: ["triage", "review"], padding: 0.35 }
  },
  {
    id: "handoff",
    type: "highlight",
    title: "Complete the handoff",
    description: "Confirm the next owner and leave a replayable decision trail.",
    nodeIds: ["handoff"],
    edgeIds: ["review-handoff"],
    viewport: { nodeIds: ["review", "handoff"], padding: 0.35 }
  }
] satisfies FlowPlaybackStep[];

export function App() {
  return (
    <ReactFlowProvider>
      <PlaybackDemo />
    </ReactFlowProvider>
  );
}

function PlaybackDemo() {
  const reactFlow = useReactFlow();
  const [guidedViewport, setGuidedViewport] = useState(false);
  const playback = useFlowPlayback({
    nodes,
    edges,
    steps,
    defaultDurationMs: 2_400,
    viewport: { enabled: guidedViewport, reactFlow }
  });

  useEffect(() => {
    if (playback.status !== "playing") {
      return;
    }

    const interval = window.setInterval(() => playback.advanceBy(250), 250);
    return () => window.clearInterval(interval);
  }, [playback]);

  const flowNodes = useMemo(
    () =>
      playback.nodes.map((node) => ({
        ...node,
        className: node.data.flowPlayActive ? "flow-node flow-node-active" : "flow-node",
        domAttributes: nodeDomAttributes(node.id, node.data.flowPlayActive)
      })),
    [playback.nodes]
  );
  const flowEdges = useMemo(
    () =>
      playback.edges.map((edge) => {
        const isActive = edge.data?.flowPlayActive === true;

        return {
          ...edge,
          animated: isActive,
          className: isActive ? "flow-edge flow-edge-active" : "flow-edge",
          domAttributes: edgeDomAttributes(edge.id, isActive),
          style: {
            stroke: isActive ? "#0f766e" : "#94a3b8",
            strokeWidth: isActive ? 3 : 2
          }
        };
      }),
    [playback.edges]
  );

  return (
    <main className="app-shell">
      <section className="review-panel" aria-labelledby="demo-title">
        <div className="intro-copy">
          <p className="eyebrow">React Flow adapter demo</p>
          <h1 id="demo-title">Customer Onboarding Playback</h1>
          <p className="summary">
            Review package-powered playback controls, step navigation, highlights, and optional
            guided viewport behavior in one focused surface.
          </p>
        </div>

        <CurrentStep playback={playback} />

        <div className="control-row">
          <FlowPlaybackControls className="playback-controls" playback={playback} />
          <label className="viewport-toggle">
            <input
              checked={guidedViewport}
              onChange={(event) => setGuidedViewport(event.currentTarget.checked)}
              role="switch"
              type="checkbox"
            />
            <span>Guided viewport</span>
          </label>
        </div>

        <ol aria-label="Playback steps" className="step-list">
          {playback.stepList.map((step, index) => (
            <li key={step.id}>
              <button
                disabled={!step.playbackEnabled}
                aria-current={playback.currentStep?.id === step.id ? "step" : undefined}
                aria-label={step.title}
                className={
                  playback.currentStep?.id === step.id ? "step-button active" : "step-button"
                }
                onClick={() => playback.goToStep(step.id)}
                type="button"
              >
                <span className="step-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="step-copy">
                  <span className="step-type">{step.typeLabel}</span>
                  <span>{step.title}</span>
                </span>
              </button>
              <div className="step-actions">
                <label className="step-toggle">
                  <input
                    aria-label={`Include ${step.title} in playback`}
                    checked={step.playbackEnabled}
                    onChange={(event) =>
                      playback.setStepPlaybackEnabled(step.id, event.currentTarget.checked)
                    }
                    role="switch"
                    type="checkbox"
                  />
                  <span>Playback</span>
                </label>
                <button
                  aria-label={`Delete ${step.title}`}
                  className="step-delete"
                  onClick={() => playback.deleteStep(step.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-label="Customer onboarding flow canvas"
        className="canvas-shell"
        role="application"
      >
        <ReactFlow
          edges={flowEdges}
          fitView
          nodes={flowNodes}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnScroll
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </section>
    </main>
  );
}

function nodeDomAttributes(id: string, isActive: boolean) {
  return {
    "data-testid": `node-${id}`,
    "data-active": String(isActive)
  } as NonNullable<Node<DemoNodeData>["domAttributes"]>;
}

function edgeDomAttributes(id: string, isActive: boolean) {
  return {
    "data-testid": `edge-${id}`,
    "data-active": String(isActive)
  } as NonNullable<Edge<DemoEdgeData>["domAttributes"]>;
}

function CurrentStep({ playback }: { playback: DemoPlayback }) {
  const currentStep = playback.currentStep;

  return (
    <article className="current-step" aria-live="polite">
      <p className="step-count">
        Step {playback.currentStepIndex + 1} of {playback.stepCount}
      </p>
      <h2>{currentStep?.title ?? "No playback steps enabled"}</h2>
      <p>{currentStep?.description ?? "Enable a timeline step to start playback."}</p>
      <div className="active-path">
        <span>{playback.status}</span>
        <span>{playback.activeNodeIds.join(", ")}</span>
        <span>{playback.activeEdgeIds.join(", ") || "No active edge"}</span>
      </div>
    </article>
  );
}
