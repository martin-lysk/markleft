import { expect, test } from "@playwright/test";

import { openExample } from "./helpers";

test("keeps Save and editor mode visible while format commands overflow", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 720 });
  await openExample(page);

  await expect(page.getByTestId("save")).toBeVisible();
  await expect(page.locator("[data-mode-trigger]")).toBeVisible();
  await expect(page.locator("[data-toolbar-overflow-trigger]")).toBeVisible();

  await page.locator("[data-toolbar-overflow-trigger]").click();
  await expect(
    page.locator("[data-toolbar-overflow-content] [data-toolbar-command='image']"),
  ).toBeVisible();
});

test("offers Save without block IDs from the Save split-button menu", async ({ page }) => {
  await openExample(page);
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill('<!-- markleft:block id="b1234567" -->\n# Title\n');

  await page.getByTestId("save-options").click();
  await expect(page.getByTestId("save-options-menu")).toBeVisible();
  await page.getByTestId("save-without-ids").click();

  await expect(page.getByTestId("markdown-editor")).not.toHaveValue(/markleft:block/);
});
