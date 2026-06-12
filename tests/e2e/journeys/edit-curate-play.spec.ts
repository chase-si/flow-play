import { expect, test } from "@playwright/test";
import {
  connectFlowNodes,
  curatedStepList,
  dragFlowNodeBy,
  openDemo,
  playbackControls
} from "../helpers/demo";

test("smoke journey: edit, curate, highlight play, and replay after-state", async ({ page }) => {
  await openDemo(page);

  await page.getByRole("button", { name: "Add follow-up node" }).click();
  await page.getByRole("button", { name: "Edit reviewer label" }).click();
  await dragFlowNodeBy(page, "follow-up", 24, 16);
  await connectFlowNodes(page, "request", "handoff");

  const stepList = curatedStepList(page);
  const editStepToggle = stepList.getByRole("switch", {
    name: "Include Edit Reviewer queue in playback"
  });
  await editStepToggle.uncheck();

  await stepList.getByRole("button", { name: "Add Follow-up review", exact: true }).click();
  const controls = playbackControls(page);
  await controls.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Edit Reviewer queue" })
  ).not.toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Connect request to handoff" })
  ).toBeVisible();

  await controls.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByText("playing")).toBeVisible();
  await controls.getByRole("button", { name: "Pause", exact: true }).click();

  await page.getByRole("radio", { name: "Replay" }).check();
  await stepList.getByRole("button", { name: "Connect request to handoff", exact: true }).click();
  await expect(page.getByTestId("node-follow-up")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("connect-request-handoff-4");
});
