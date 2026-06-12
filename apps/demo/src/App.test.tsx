import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the edit, curate, then play workflow with accessible playback states", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Customer Onboarding Playback" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("application", { name: "Customer onboarding flow canvas" })
    ).toBeInTheDocument();
    const controlsPanel = screen.getByRole("complementary", { name: "Playback controls panel" });
    const timelinePanel = screen.getByRole("complementary", { name: "Step timeline panel" });
    const stepList = screen.getByRole("list", { name: "Curated playback steps" });
    const playbackControls = screen.getByRole("group", { name: "Playback controls" });

    expect(controlsPanel).toContainElement(playbackControls);
    expect(timelinePanel).toContainElement(stepList);
    expect(screen.getByRole("button", { name: "Hide playback controls panel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Hide step timeline panel" })).toBeEnabled();
    expect(within(playbackControls).getByRole("button", { name: "Play" })).toBeEnabled();
    expect(within(playbackControls).getByRole("button", { name: "Pause" })).toBeDisabled();
    expect(within(playbackControls).getByRole("button", { name: "Previous step" })).toBeDisabled();
    expect(within(playbackControls).getByRole("button", { name: "Next step" })).toBeEnabled();
    expect(within(playbackControls).getByRole("button", { name: "Reset playback" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Guided viewport" })).not.toBeChecked();
    expect(screen.queryByRole("radiogroup", { name: "Playback mode" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Highlight" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Replay" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Collect request context" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Capture the customer signal and prepare the handoff path.")
    ).toBeInTheDocument();

    expect(within(stepList).getAllByText("Highlight")).toHaveLength(3);
    expect(within(stepList).getAllByText("Enabled")).toHaveLength(3);
    expect(
      within(stepList).getByRole("button", { name: "Validate routing conditions" })
    ).toBeInTheDocument();
    expect(
      within(stepList).getByRole("switch", {
        name: "Include Collect request context in playback"
      })
    ).toBeChecked();
    expect(screen.getByTestId("node-request").dataset.active).toBe("true");
    expect(screen.getByText("request-triage")).toBeInTheDocument();

    fireEvent.click(
      within(stepList).getByRole("switch", {
        name: "Include Collect request context in playback"
      })
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Validate routing conditions" })
    ).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    expect(
      within(stepList).getByRole("switch", {
        name: "Include Collect request context in playback"
      })
    ).not.toBeChecked();
    expect(within(stepList).getByText("Disabled")).toBeInTheDocument();

    fireEvent.click(within(playbackControls).getByRole("button", { name: "Next step" }));
    expect(
      screen.getByRole("heading", { level: 2, name: "Complete the handoff" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("node-handoff").dataset.active).toBe("true");

    fireEvent.click(within(stepList).getByRole("button", { name: "Delete Complete the handoff" }));
    expect(screen.queryByRole("button", { name: "Complete the handoff" })).not.toBeInTheDocument();
    expect(screen.getByTestId("node-handoff")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Validate routing conditions" })
    ).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Deleted playback steps" })).toHaveTextContent(
      "Deleted step: Complete the handoff"
    );

    fireEvent.click(
      within(stepList).getByRole("switch", {
        name: "Include Validate routing conditions in playback"
      })
    );
    expect(within(playbackControls).getByRole("button", { name: "Play" })).toBeDisabled();
    expect(
      within(timelinePanel).getAllByRole("heading", {
        level: 2,
        name: "No playback steps enabled"
      }).length
    ).toBeGreaterThan(0);
    expect(screen.getByRole("status", { name: "Playback queue state" })).toHaveTextContent(
      "No playback steps enabled"
    );

    fireEvent.click(screen.getByRole("switch", { name: "Guided viewport" }));
    expect(screen.getByRole("switch", { name: "Guided viewport" })).toBeChecked();
  });

  it("collapses and restores the split side panels", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Hide playback controls panel" }));
    expect(
      screen.queryByRole("complementary", { name: "Playback controls panel" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Collapsed playback controls panel" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide step timeline panel" }));
    expect(
      screen.queryByRole("complementary", { name: "Step timeline panel" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Collapsed step timeline panel" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show playback controls panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Show step timeline panel" }));
    expect(
      screen.getByRole("complementary", { name: "Playback controls panel" })
    ).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Step timeline panel" })).toBeInTheDocument();
  });

  it("records visible typed steps from demo node edit controls", () => {
    render(<App />);

    fireEvent.click(screen.getByText("Edit flow"));
    fireEvent.click(screen.getByRole("button", { name: "Add follow-up node" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit reviewer label" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete reviewer node" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete request edge" }));

    const stepList = screen.getByRole("list", { name: "Curated playback steps" });
    expect(within(stepList).getByText("Node add")).toBeInTheDocument();
    expect(within(stepList).getByRole("button", { name: "Add Follow-up review" })).toBeEnabled();
    expect(within(stepList).getByText("Node edit")).toBeInTheDocument();
    expect(within(stepList).getByRole("button", { name: "Edit Reviewer queue" })).toBeEnabled();
    expect(
      within(stepList).getByRole("switch", {
        name: "Include Edit Reviewer queue in playback"
      })
    ).toBeChecked();
    expect(within(stepList).getByText("Node delete")).toBeInTheDocument();
    expect(
      within(stepList).getByRole("button", { name: "Delete Review queue updated" })
    ).toBeEnabled();
    expect(within(stepList).getByText("Edge delete")).toBeInTheDocument();
    expect(within(stepList).getByRole("button", { name: "Delete request-triage" })).toBeEnabled();
    expect(screen.queryByTestId("node-review")).not.toBeInTheDocument();
    expect(screen.queryByTestId("edge-request-triage")).not.toBeInTheDocument();
  });
});
