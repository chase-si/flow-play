export interface FlowPlaybackStep {
  id: string;
  title: string;
}

export interface FlowPlaybackPreview {
  initialStepId: string;
  status: "idle";
  stepCount: number;
}

export function createFlowPlaybackPreview(steps: readonly FlowPlaybackStep[]): FlowPlaybackPreview {
  const firstStep = steps[0];

  if (!firstStep) {
    throw new Error("Flow playback requires at least one step.");
  }

  return {
    initialStepId: firstStep.id,
    status: "idle",
    stepCount: steps.length
  };
}
