import { describe, expect, it } from "vitest";
import { createFlowPlaybackPreview } from "./index";

describe("createFlowPlaybackPreview", () => {
  it("summarizes the first playable step through the public package API", () => {
    const preview = createFlowPlaybackPreview([
      { id: "start", title: "Start" },
      { id: "finish", title: "Finish" }
    ]);

    expect(preview).toEqual({
      initialStepId: "start",
      status: "idle",
      stepCount: 2
    });
  });
});
