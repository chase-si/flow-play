import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders a smoke path that imports the package API", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Flow Play Demo" })).toBeInTheDocument();
    expect(screen.getByText("3 steps ready")).toBeInTheDocument();
    expect(screen.getByText("Initial step: intro")).toBeInTheDocument();
  });
});
