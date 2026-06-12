import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
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
  type NodeChange,
  type OnNodeDrag
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

type EditActions = {
  addFollowUp: () => void;
  editReviewer: () => void;
  deleteReviewer: () => void;
  deleteRequestEdge: () => void;
};

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

  const editActions = {
    addFollowUp: () => addFollowUpNode(setDemoNodes, playback),
    editReviewer: () => editReviewerLabel(setDemoNodes, playback),
    deleteReviewer: () =>
      deleteReviewerNode(demoNodes, demoEdges, setDemoNodes, setDemoEdges, playback),
    deleteRequestEdge: () => deleteRequestEdge(demoEdges, setDemoEdges, playback)
  };

  return (
    <SplitPlaybackLayout
      canvas={
        <FlowCanvas
          edges={flowEdges}
          nodes={flowNodes}
          onConnect={onConnect}
          onNodesChange={onNodesChange}
          onNodeDragStart={(_, node) => playback.recordNodeDragStart(snapshotNode(node))}
          onNodeDragStop={(_, node) => playback.recordNodeDragStop(snapshotNode(node))}
        />
      }
      deleteStep={deleteStep}
      deletedStepTitles={deletedStepTitles}
      editActions={editActions}
      guidedViewport={guidedViewport}
      playback={playback}
      setGuidedViewport={setGuidedViewport}
    />
  );
}

function SplitPlaybackLayout({
  canvas,
  deleteStep,
  deletedStepTitles,
  editActions,
  guidedViewport,
  playback,
  setGuidedViewport
}: PrototypeViewProps) {
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  return (
    <main
      className={[
        "prototype-shell",
        "prototype-variant-c",
        isLeftPanelOpen ? "prototype-left-open" : "prototype-left-collapsed",
        isRightPanelOpen ? "prototype-right-open" : "prototype-right-collapsed"
      ].join(" ")}
    >
      {isLeftPanelOpen ? (
        <aside
          aria-label="Playback controls panel"
          className="prototype-side-panel prototype-left-panel"
        >
          <div className="prototype-panel-header">
            <div>
              <p className="eyebrow">React Flow adapter demo</p>
              <h1 id="demo-title">Customer Onboarding Playback</h1>
            </div>
            <button
              aria-label="Hide playback controls panel"
              className="prototype-panel-toggle"
              onClick={() => setIsLeftPanelOpen(false)}
              type="button"
            >
              Hide
            </button>
          </div>
          <FlowPlaybackControls
            aria-label="Playback controls"
            className="playback-controls prototype-toolbar-playback"
            playback={playback}
            role="group"
          />
          <ModeAndViewportControls
            guidedViewport={guidedViewport}
            playback={playback}
            setGuidedViewport={setGuidedViewport}
          />
          <FlowEditMenu actions={editActions} />
        </aside>
      ) : (
        <aside
          aria-label="Collapsed playback controls panel"
          className="prototype-panel-rail prototype-left-rail"
        >
          <button
            aria-label="Show playback controls panel"
            className="prototype-panel-toggle"
            onClick={() => setIsLeftPanelOpen(true)}
            type="button"
          >
            Controls
          </button>
        </aside>
      )}
      <section
        aria-label="Customer onboarding flow canvas"
        className="canvas-shell prototype-canvas-primary"
        role="application"
      >
        {canvas}
      </section>
      {isRightPanelOpen ? (
        <aside aria-label="Step timeline panel" className="prototype-side-panel prototype-right-panel">
          <div className="prototype-panel-header">
            <div>
              <p className="eyebrow">Step timeline</p>
              <h2>{getQueueLabel(playback)}</h2>
            </div>
            <button
              aria-label="Hide step timeline panel"
              className="prototype-panel-toggle"
              onClick={() => setIsRightPanelOpen(false)}
              type="button"
            >
              Hide
            </button>
          </div>
          <CurrentStep playback={playback} />
          <StepTimeline deleteStep={deleteStep} playback={playback} />
          <QueueStatus deletedStepTitles={deletedStepTitles} playback={playback} />
        </aside>
      ) : (
        <aside
          aria-label="Collapsed step timeline panel"
          className="prototype-panel-rail prototype-right-rail"
        >
          <button
            aria-label="Show step timeline panel"
            className="prototype-panel-toggle"
            onClick={() => setIsRightPanelOpen(true)}
            type="button"
          >
            Steps
          </button>
        </aside>
      )}
    </main>
  );
}

type PrototypeViewProps = {
  canvas: React.ReactNode;
  deleteStep: (stepId: string) => void;
  deletedStepTitles: string[];
  editActions: EditActions;
  guidedViewport: boolean;
  playback: DemoPlayback;
  setGuidedViewport: Dispatch<SetStateAction<boolean>>;
};

function FlowEditMenu({ actions }: { actions: EditActions }) {
  return (
    <details className="prototype-edit-menu">
      <summary>Edit flow</summary>
      <div className="edit-controls" role="group" aria-label="Edit flow">
        <button onClick={actions.addFollowUp} type="button">
          Add follow-up node
        </button>
        <button onClick={actions.editReviewer} type="button">
          Edit reviewer label
        </button>
        <button onClick={actions.deleteReviewer} type="button">
          Delete reviewer node
        </button>
        <button onClick={actions.deleteRequestEdge} type="button">
          Delete request edge
        </button>
      </div>
    </details>
  );
}

function FlowCanvas({
  edges,
  nodes,
  onConnect,
  onNodeDragStart,
  onNodeDragStop,
  onNodesChange
}: {
  edges: Edge<DemoEdgeData>[];
  nodes: Node<DemoNodeData>[];
  onConnect: (connection: Connection) => void;
  onNodeDragStart: OnNodeDrag<Node<DemoNodeData>>;
  onNodeDragStop: OnNodeDrag<Node<DemoNodeData>>;
  onNodesChange: (changes: NodeChange<Node<DemoNodeData>>[]) => void;
}) {
  return (
    <ReactFlow
      edges={edges}
      fitView
      nodes={nodes}
      onConnect={onConnect}
      onNodesChange={onNodesChange}
      onNodeDragStart={onNodeDragStart}
      onNodeDragStop={onNodeDragStop}
      panOnScroll
    >
      <Background />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

function StepTimeline({
  deleteStep,
  playback
}: {
  deleteStep: (stepId: string) => void;
  playback: DemoPlayback;
}) {
  return (
    <ol aria-label="Curated playback steps" className="step-list prototype-step-timeline">
      {playback.stepList.map((step, index) => (
        <li key={step.id}>
          <button
            disabled={!step.playbackEnabled}
            aria-current={playback.currentStep?.id === step.id ? "step" : undefined}
            aria-label={step.title}
            className={playback.currentStep?.id === step.id ? "step-button active" : "step-button"}
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
  );
}

function ModeAndViewportControls({
  guidedViewport,
  playback,
  setGuidedViewport
}: {
  guidedViewport: boolean;
  playback: DemoPlayback;
  setGuidedViewport: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <div className="prototype-secondary-controls">
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
  );
}

function QueueStatus({
  deletedStepTitles,
  playback
}: {
  deletedStepTitles: string[];
  playback: DemoPlayback;
}) {
  return (
    <div className="prototype-queue-status">
      <p className="queue-status" role="status" aria-label="Playback queue state">
        {getQueueLabel(playback)}
      </p>
      <p className="queue-status" role="status" aria-label="Deleted playback steps">
        {deletedStepTitles.length > 0
          ? deletedStepTitles.map((title) => `Deleted step: ${title}`).join(". ")
          : "No deleted playback steps"}
      </p>
    </div>
  );
}

function nodeDomAttributes(id: string, isActive: boolean) {
  return {
    "data-testid": `node-${id}`,
    "data-active": String(isActive)
  } as NonNullable<Node<DemoNodeData>["domAttributes"]>;
}

function addFollowUpNode(
  setDemoNodes: Dispatch<SetStateAction<Node<DemoNodeData>[]>>,
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
  setDemoNodes: Dispatch<SetStateAction<Node<DemoNodeData>[]>>,
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
  setDemoNodes: Dispatch<SetStateAction<Node<DemoNodeData>[]>>,
  setDemoEdges: Dispatch<SetStateAction<Edge<DemoEdgeData>[]>>,
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
  setDemoEdges: Dispatch<SetStateAction<Edge<DemoEdgeData>[]>>,
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
        <span>{playback.activeNodeIds.join(", ") || "No active node"}</span>
        <span>{playback.activeEdgeIds.join(", ") || "No active edge"}</span>
      </div>
    </article>
  );
}

function getQueueLabel(playback: DemoPlayback) {
  if (playback.stepCount === 0) {
    return "No playback steps enabled";
  }

  return `${playback.stepCount} playback ${playback.stepCount === 1 ? "step is" : "steps are"} enabled`;
}
