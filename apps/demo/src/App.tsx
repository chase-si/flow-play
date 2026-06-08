import { createFlowPlaybackPreview, type FlowPlaybackStep } from "flow-play";

const steps: FlowPlaybackStep[] = [
  { id: "intro", title: "Introduce the flow" },
  { id: "review", title: "Review the decision point" },
  { id: "complete", title: "Complete the path" }
];

const preview = createFlowPlaybackPreview(steps);

export function App() {
  return (
    <main className="app-shell">
      <section className="demo-panel" aria-labelledby="demo-title">
        <p className="eyebrow">Workspace smoke path</p>
        <h1 id="demo-title">Flow Play Demo</h1>
        <p className="summary">{preview.stepCount} steps ready</p>
        <p className="summary">Initial step: {preview.initialStepId}</p>
        <ol className="step-list">
          {steps.map((step) => (
            <li key={step.id}>{step.title}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
