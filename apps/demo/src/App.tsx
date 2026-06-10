import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange
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

const initialNodes = [
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

const initialEdges = [
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
  const [demoNodes, setDemoNodes] = useState<Node<DemoNodeData>[]>(initialNodes);
  const [demoEdges, setDemoEdges] = useState<Edge<DemoEdgeData>[]>(initialEdges);
  const [deletedStepTitles, setDeletedStepTitles] = useState<string[]>([]);
  const onNodesChange = (changes: NodeChange<Node<DemoNodeData>>[]) => {
    setDemoNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
  };
  const playback = useFlowPlayback({
    nodes: demoNodes,
    edges: demoEdges,
    steps,
    defaultDurationMs: 2_400,
    formatNodeLabel: formatDemoNodeLabel,
    initialReplayMode: false,
    onReplayExit: (state) => {
      setDemoNodes(state.nodes as Node<DemoNodeData>[]);
      setDemoEdges(state.edges as Edge<DemoEdgeData>[]);
    },
    replay: {
      initialNodes,
      initialEdges
    },
    viewport: { enabled: guidedViewport, reactFlow }
  });
  const hasPlaybackQueue = playback.stepCount > 0;

  useEffect(() => {
    if (playback.status !== "playing") {
      return;
    }

    const interval = window.setInterval(() => playback.advanceBy(250), 250);
    return () => window.clearInterval(interval);
  }, [playback]);

  const onConnect = (connection: Connection) => {
    const edge: Edge<DemoEdgeData> = {
      ...connection,
      id: `connect-${connection.source}-${connection.target}-${demoEdges.length + 1}`
    };

    setDemoEdges((currentEdges) => addEdge(edge, currentEdges));
    playback.recordEdgeConnect({
      edge: snapshotEdge(edge),
      title: `Connect ${connection.source} to ${connection.target}`
    });
  };

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

  const deleteStep = (stepId: string) => {
    const step = playback.stepList.find((candidate) => candidate.id === stepId);

    if (step) {
      setDeletedStepTitles((currentTitles) => [...currentTitles, step.title]);
    }

    playback.deleteStep(stepId);
  };

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

        <div className="workflow-stack">
          <div className="edit-controls" role="group" aria-label="Edit flow">
            <button onClick={() => addFollowUpNode(setDemoNodes, playback)} type="button">
              Add follow-up node
            </button>
            <button onClick={() => editReviewerLabel(setDemoNodes, playback)} type="button">
              Edit reviewer label
            </button>
            <button
              onClick={() =>
                deleteReviewerNode(demoNodes, demoEdges, setDemoNodes, setDemoEdges, playback)
              }
              type="button"
            >
              Delete reviewer node
            </button>
            <button
              onClick={() => deleteRequestEdge(demoEdges, setDemoEdges, playback)}
              type="button"
            >
              Delete request edge
            </button>
          </div>

          <ol aria-label="Curated playback steps" className="step-list">
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
                  <span className={step.playbackEnabled ? "step-state enabled" : "step-state"}>
                    {step.playbackEnabled ? "Enabled" : "Disabled"}
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
                    onClick={() => deleteStep(step.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ol>

          <p className="queue-status" role="status" aria-label="Playback queue state">
            {hasPlaybackQueue
              ? `${playback.stepCount} playback ${
                  playback.stepCount === 1 ? "step is" : "steps are"
                } enabled`
              : "No playback steps enabled"}
          </p>
          <p className="queue-status" role="status" aria-label="Deleted playback steps">
            {deletedStepTitles.length > 0
              ? deletedStepTitles.map((title) => `Deleted step: ${title}`).join(". ")
              : "No deleted playback steps"}
          </p>

          <div className="mode-controls" role="radiogroup" aria-label="Playback mode">
            <label>
              <input
                checked={!playback.isReplayMode}
                name="playback-mode"
                onChange={() => playback.exitReplayMode()}
                type="radio"
              />
              <span>Highlight</span>
            </label>
            <label>
              <input
                checked={playback.isReplayMode}
                name="playback-mode"
                onChange={() => playback.enterReplayMode()}
                type="radio"
              />
              <span>Replay</span>
            </label>
          </div>

          <div className="control-row">
            <FlowPlaybackControls
              aria-label="Playback controls"
              className="playback-controls"
              playback={playback}
              role="group"
            />
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

          <CurrentStep playback={playback} />
        </div>
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
          onConnect={onConnect}
          onNodesChange={onNodesChange}
          onNodeDragStart={(_, node) => playback.recordNodeDragStart(snapshotNode(node))}
          onNodeDragStop={(_, node) => playback.recordNodeDragStop(snapshotNode(node))}
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

function addFollowUpNode(
  setDemoNodes: React.Dispatch<React.SetStateAction<Node<DemoNodeData>[]>>,
  playback: DemoPlayback
) {
  const node = {
    id: "follow-up",
    position: { x: 1_120, y: 80 },
    data: { label: "Follow-up review" }
  };

  setDemoNodes((currentNodes) =>
    currentNodes.some((currentNode) => currentNode.id === node.id)
      ? currentNodes
      : [...currentNodes, node]
  );
  playback.recordNodeAdd({
    node: snapshotNode(node),
    title: "Add Follow-up review"
  });
}

function editReviewerLabel(
  setDemoNodes: React.Dispatch<React.SetStateAction<Node<DemoNodeData>[]>>,
  playback: DemoPlayback
) {
  const before = initialNodes.find((node) => node.id === "review");

  if (!before) {
    return;
  }

  const after = {
    ...before,
    data: { ...before.data, label: "Review queue updated" }
  };

  setDemoNodes((currentNodes) =>
    currentNodes.map((node) => (node.id === after.id ? { ...node, data: after.data } : node))
  );
  playback.recordNodeEdit({
    before: snapshotNode(before),
    after: snapshotNode(after),
    title: "Edit Reviewer queue"
  });
}

function deleteReviewerNode(
  demoNodes: Node<DemoNodeData>[],
  demoEdges: Edge<DemoEdgeData>[],
  setDemoNodes: React.Dispatch<React.SetStateAction<Node<DemoNodeData>[]>>,
  setDemoEdges: React.Dispatch<React.SetStateAction<Edge<DemoEdgeData>[]>>,
  playback: DemoPlayback
) {
  const node = demoNodes.find((demoNode) => demoNode.id === "review");

  if (!node) {
    return;
  }

  const connectedEdges = demoEdges.filter(
    (edge) => edge.source === node.id || edge.target === node.id
  );

  setDemoNodes((currentNodes) => currentNodes.filter((currentNode) => currentNode.id !== node.id));
  setDemoEdges((currentEdges) =>
    currentEdges.filter((edge) => edge.source !== node.id && edge.target !== node.id)
  );
  playback.recordNodeDelete({
    node: snapshotNode(node),
    connectedEdges: connectedEdges.map(snapshotEdge)
  });
}

function deleteRequestEdge(
  demoEdges: Edge<DemoEdgeData>[],
  setDemoEdges: React.Dispatch<React.SetStateAction<Edge<DemoEdgeData>[]>>,
  playback: DemoPlayback
) {
  const edge = demoEdges.find((demoEdge) => demoEdge.id === "request-triage");

  if (!edge) {
    return;
  }

  setDemoEdges((currentEdges) => currentEdges.filter((currentEdge) => currentEdge.id !== edge.id));
  playback.recordEdgeDelete({
    edge: snapshotEdge(edge)
  });
}

function snapshotNode(node: Node<DemoNodeData>) {
  return {
    id: node.id,
    ...(node.type === undefined ? {} : { type: node.type }),
    position: node.position,
    data: node.data
  };
}

function snapshotEdge(edge: Edge<DemoEdgeData>) {
  return {
    ...edge
  };
}

function formatDemoNodeLabel(node: { id: string; data?: unknown }) {
  if (node.data && typeof node.data === "object" && "label" in node.data) {
    const label = (node.data as { label?: unknown }).label;

    if (typeof label === "string" && label.length > 0) {
      return label;
    }
  }

  return initialNodes.find((demoNode) => demoNode.id === node.id)?.data.label;
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
