import { expect, test } from "@playwright/test";

test("demo playback journey exposes controls, state, and highlights", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Customer Onboarding Playback" })).toBeVisible();
  const timelinePanel = page.getByRole("complementary", { name: "Step timeline panel" });

  await expect(
    page.getByRole("heading", { level: 2, name: "Collect request context" })
  ).toBeVisible();
  await expect(timelinePanel.getByText("Step 1 of 3")).toBeVisible();
  await expect(timelinePanel.getByText("idle")).toBeVisible();
  await expect(page.getByTestId("node-request")).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId("edge-request-triage")).toHaveAttribute("data-active", "true");

  await page.getByRole("button", { exact: true, name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeEnabled();
  await expect(timelinePanel.getByText("playing")).toBeVisible();

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(timelinePanel.getByText("paused")).toBeVisible();

  await page.getByRole("button", { name: "Next step" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Validate routing conditions" })
  ).toBeVisible();
  await expect(timelinePanel.getByText("Step 2 of 3")).toBeVisible();
  await expect(page.getByTestId("node-triage")).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId("edge-triage-review")).toHaveAttribute("data-active", "true");

  await page.getByRole("button", { name: "Previous step" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Collect request context" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Reset playback" }).click();
  await expect(timelinePanel.getByText("idle")).toBeVisible();
  await expect(timelinePanel.getByText("Step 1 of 3")).toBeVisible();
  await expect(page.getByTestId("node-request")).toHaveAttribute("data-active", "true");

  await page.getByRole("button", { name: "Hide playback controls panel" }).click();
  await expect(
    page.getByRole("complementary", { name: "Collapsed playback controls panel" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Show playback controls panel" }).click();
  await expect(page.getByRole("complementary", { name: "Playback controls panel" })).toBeVisible();
});
