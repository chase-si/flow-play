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
    const editControls = screen.getByRole("group", { name: "Edit flow" });
    const stepList = screen.getByRole("list", { name: "Curated playback steps" });
    const modeSwitch = screen.getByRole("radiogroup", { name: "Playback mode" });
    const playbackControls = screen.getByRole("group", { name: "Playback controls" });

    expect(editControls.compareDocumentPosition(stepList)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(stepList.compareDocumentPosition(modeSwitch)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(modeSwitch.compareDocumentPosition(playbackControls)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(playbackControls).getByRole("button", { name: "Play" })).toBeEnabled();
    expect(within(playbackControls).getByRole("button", { name: "Pause" })).toBeDisabled();
    expect(within(playbackControls).getByRole("button", { name: "Previous step" })).toBeDisabled();
    expect(within(playbackControls).getByRole("button", { name: "Next step" })).toBeEnabled();
    expect(within(playbackControls).getByRole("button", { name: "Reset playback" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Guided viewport" })).not.toBeChecked();
    expect(within(modeSwitch).getByRole("radio", { name: "Highlight" })).toBeChecked();
    expect(within(modeSwitch).getByRole("radio", { name: "Replay" })).not.toBeChecked();
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
      screen.getByRole("heading", { level: 2, name: "No playback steps enabled" })
    ).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Playback queue state" })).toHaveTextContent(
      "No playback steps enabled"
    );

    fireEvent.click(screen.getByRole("switch", { name: "Guided viewport" }));
    expect(screen.getByRole("switch", { name: "Guided viewport" })).toBeChecked();

    fireEvent.click(within(modeSwitch).getByRole("radio", { name: "Replay" }));
    expect(within(modeSwitch).getByRole("radio", { name: "Replay" })).toBeChecked();
  });

  it("records visible typed steps from demo node edit controls", () => {
    render(<App />);

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
