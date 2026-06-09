import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders an interactive React Flow playback review surface", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Customer Onboarding Playback" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("application", { name: "Customer onboarding flow canvas" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous step" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next step" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reset playback" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Guided viewport" })).not.toBeChecked();
    expect(
      screen.getByRole("heading", { level: 2, name: "Collect request context" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Capture the customer signal and prepare the handoff path.")
    ).toBeInTheDocument();

    const stepList = screen.getByRole("list", { name: "Playback steps" });
    expect(within(stepList).getAllByText("Highlight")).toHaveLength(3);
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

    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
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

    fireEvent.click(
      within(stepList).getByRole("switch", {
        name: "Include Validate routing conditions in playback"
      })
    );
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
    expect(
      screen.getByRole("heading", { level: 2, name: "No playback steps enabled" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: "Guided viewport" }));
    expect(screen.getByRole("switch", { name: "Guided viewport" })).toBeChecked();
  });

  it("records visible typed steps from demo node edit controls", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Add follow-up node" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit reviewer label" }));

    const stepList = screen.getByRole("list", { name: "Playback steps" });
    expect(within(stepList).getByText("Node add")).toBeInTheDocument();
    expect(within(stepList).getByRole("button", { name: "Add Follow-up review" })).toBeEnabled();
    expect(within(stepList).getByText("Node edit")).toBeInTheDocument();
    expect(within(stepList).getByRole("button", { name: "Edit Reviewer queue" })).toBeEnabled();
  });
});
