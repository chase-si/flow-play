import { expect, test } from "@playwright/test";
import {
  connectFlowNodes,
  countStepsWithType,
  curatedStepList,
  dragFlowNodeBy,
  expectStepTypeAndTitle,
  openDemo,
  playbackControls
} from "./helpers/demo";

test.describe("editable FlowPlay demo", () => {
  test("initial highlight timeline shows seeded steps and playback controls", async ({ page }) => {
    await openDemo(page);

    const stepList = curatedStepList(page);
    await expectStepTypeAndTitle(stepList, "Highlight", "Collect request context");
    await expectStepTypeAndTitle(stepList, "Highlight", "Validate routing conditions");
    await expectStepTypeAndTitle(stepList, "Highlight", "Complete the handoff");

    const controls = playbackControls(page);
    await expect(controls.getByRole("button", { name: "Play", exact: true })).toBeEnabled();
    await expect(controls.getByRole("button", { name: "Pause", exact: true })).toBeDisabled();
    await expect(controls.getByRole("button", { name: "Previous step", exact: true })).toBeDisabled();
    await expect(controls.getByRole("button", { name: "Next step", exact: true })).toBeEnabled();
    await expect(
      controls.getByRole("button", { name: "Reset playback", exact: true })
    ).toBeDisabled();

    await expect(
      stepList.getByRole("switch", { name: "Include Collect request context in playback" })
    ).toBeChecked();
  });

  test("add and edit a node produce typed steps with enabled playback toggles", async ({ page }) => {
    await openDemo(page);

    await page.getByText("Edit flow").click();
    await page.getByRole("button", { name: "Add follow-up node" }).click();
    await page.getByRole("button", { name: "Edit reviewer label" }).click();

    const stepList = curatedStepList(page);
    await expectStepTypeAndTitle(stepList, "Node add", "Add Follow-up review");
    await expectStepTypeAndTitle(stepList, "Node edit", "Edit Reviewer queue");

    await expect(
      stepList.getByRole("switch", { name: "Include Add Follow-up review in playback" })
    ).toBeChecked();
    await expect(
      stepList.getByRole("switch", { name: "Include Edit Reviewer queue in playback" })
    ).toBeChecked();
  });

  test("dragging a node records one node-drag step", async ({ page }) => {
    await openDemo(page);

    const stepList = curatedStepList(page);
    const dragStepsBefore = await countStepsWithType(stepList, "Node drag");

    await dragFlowNodeBy(page, "triage", 48, 32);

    await expect.poll(async () => countStepsWithType(stepList, "Node drag")).toBe(
      dragStepsBefore + 1
    );
    await expect(stepList.getByText("Node drag").last()).toBeVisible();
    await expect(page.getByTestId("node-triage")).toBeVisible();
  });

  test("curate playback queue skips disabled steps then includes them again", async ({ page }) => {
    await openDemo(page);

    const stepList = curatedStepList(page);
    const validateToggle = stepList.getByRole("switch", {
      name: "Include Validate routing conditions in playback"
    });

    await validateToggle.uncheck();
    await expect(page.getByRole("status", { name: "Playback queue state" })).toHaveText(
      "2 playback steps are enabled"
    );

    await playbackControls(page).getByRole("button", { name: "Next step" }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Complete the handoff" })
    ).toBeVisible();
    await expect(page.getByText("Step 2 of 2")).toBeVisible();

    await validateToggle.check();
    await expect(page.getByRole("status", { name: "Playback queue state" })).toHaveText(
      "3 playback steps are enabled"
    );

    await playbackControls(page).getByRole("button", { name: "Reset playback" }).click();
    await playbackControls(page).getByRole("button", { name: "Next step" }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Validate routing conditions" })
    ).toBeVisible();
  });

  test("connect and delete edges record edge-connect and edge-delete steps", async ({ page }) => {
    await openDemo(page);

    await page.getByText("Edit flow").click();
    await connectFlowNodes(page, "request", "handoff");
    await page.getByRole("button", { name: "Delete request edge" }).click();

    const stepList = curatedStepList(page);
    await expectStepTypeAndTitle(stepList, "Edge connect", "Connect request to handoff");
    await expectStepTypeAndTitle(stepList, "Edge delete", "Delete request-triage");
    await expect(page.getByTestId("edge-request-triage")).toHaveCount(0);
    await expect(page.getByTestId("edge-connect-request-handoff-4")).toBeVisible();
  });

  test("highlight-only demo keeps edited flow visible without replay controls", async ({ page }) => {
    await openDemo(page);

    await expect(page.getByRole("radiogroup", { name: "Playback mode" })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "Replay" })).toHaveCount(0);

    await page.getByText("Edit flow").click();
    await page.getByRole("button", { name: "Add follow-up node" }).click();
    await page.getByRole("button", { name: "Edit reviewer label" }).click();

    const stepList = curatedStepList(page);

    await stepList.getByRole("button", { name: "Collect request context", exact: true }).click();
    await expect(page.getByTestId("node-follow-up")).toHaveCount(1);
    await expect(page.getByTestId("node-review")).toHaveCount(1);

    await stepList.getByRole("button", { name: "Add Follow-up review", exact: true }).click();
    await expect(page.getByTestId("node-follow-up")).toHaveCount(1);

    await stepList.getByRole("button", { name: "Edit Reviewer queue", exact: true }).click();
    await expect(page.getByTestId("node-review")).toHaveText(/Review queue updated/);
  });
});
