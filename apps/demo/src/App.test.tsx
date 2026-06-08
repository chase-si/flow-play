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
    expect(
      within(stepList).getByRole("button", { name: "Validate routing conditions" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("node-request").dataset.active).toBe("true");
    expect(screen.getByText("request-triage")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(
      screen.getByRole("heading", { level: 2, name: "Validate routing conditions" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Check plan fit, risk, and required reviewer context.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("node-triage").dataset.active).toBe("true");

    fireEvent.click(within(stepList).getByRole("button", { name: "Complete the handoff" }));
    expect(
      screen.getByRole("heading", { level: 2, name: "Complete the handoff" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("node-handoff").dataset.active).toBe("true");

    fireEvent.click(screen.getByRole("switch", { name: "Guided viewport" }));
    expect(screen.getByRole("switch", { name: "Guided viewport" })).toBeChecked();
  });
});
