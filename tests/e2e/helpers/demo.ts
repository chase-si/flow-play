import { expect, type Locator, type Page } from "@playwright/test";

export async function openDemo(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Customer Onboarding Playback" })).toBeVisible();
}

export function curatedStepList(page: Page) {
  return page.getByRole("list", { name: "Curated playback steps" });
}

export function playbackControls(page: Page) {
  return page.getByRole("group", { name: "Playback controls" });
}

export async function expectStepTypeAndTitle(
  stepList: Locator,
  typeLabel: string,
  title: string
) {
  const stepButton = stepList.getByRole("button", { name: title, exact: true });
  await expect(stepButton).toBeVisible();
  await expect(stepButton.getByText(typeLabel, { exact: true })).toBeVisible();
}

export async function countStepsWithType(stepList: Locator, typeLabel: string) {
  return stepList.locator("li").filter({ hasText: typeLabel }).count();
}

export async function connectFlowNodes(page: Page, sourceId: string, targetId: string) {
  const sourceNode = page.getByTestId(`node-${sourceId}`);
  const targetNode = page.getByTestId(`node-${targetId}`);

  await sourceNode.scrollIntoViewIfNeeded();
  await targetNode.scrollIntoViewIfNeeded();

  const sourceHandle = sourceNode.locator(
    ".react-flow__handle.source, .react-flow__handle[data-handlepos='right']"
  );
  const targetHandle = targetNode.locator(
    ".react-flow__handle.target, .react-flow__handle[data-handlepos='left']"
  );

  const sourceBox = await sourceHandle.first().boundingBox();
  const targetBox = await targetHandle.first().boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error(`Could not resolve connection handles for ${sourceId} -> ${targetId}`);
  }

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 16 }
  );
  await page.mouse.up();
}

export async function dragFlowNodeBy(page: Page, nodeId: string, offsetX: number, offsetY: number) {
  const node = page.getByTestId(`node-${nodeId}`);
  const box = await node.boundingBox();

  if (!box) {
    throw new Error(`Could not resolve bounds for node ${nodeId}`);
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + offsetX, startY + offsetY, { steps: 12 });
  await page.mouse.up();
}
