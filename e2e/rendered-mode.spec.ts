import { expect, test } from "@playwright/test";

import { openExample } from "./helpers";

test("edits rendered content and exposes normalized Markdown", async ({ page }) => {
  await openExample(page);

  const rendered = page.getByTestId("rendered-editor");
  await rendered.getByRole("heading", { name: "Local Markdown Demo" }).fill("Edited Heading");
  await rendered.getByText(/This file is a self-rendering Markdown/).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Extra sentence.");
  await rendered.getByText("Task lists").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("New task");
  await rendered.locator("td").filter({ hasText: "Supported" }).fill("Still supported");

  await page.getByTestId("mode-markdown").click();
  const source = await page.getByTestId("markdown-editor").inputValue();

  expect(source).toContain("# Edited Heading");
  expect(source).toContain("Extra sentence.");
  expect(source).toContain("New task");
  expect(source).toContain("Still supported");
});

test("development debug selection and composition diagnostics are available", async ({ page }) => {
  await openExample(page);

  await page.getByRole("heading", { name: "Local Markdown Demo" }).click();
  const selection = await page.evaluate(() => window.__localMdDebug?.getSelectionState());
  expect(selection?.blockId).toMatch(/^block-/);
  expect(selection?.collapsed).toBe(true);

  const before = await page.evaluate(() => window.__localMdDebug?.getSyncCount() ?? 0);
  await page.getByTestId("rendered-editor").dispatchEvent("compositionstart");
  await page.keyboard.type("ime");
  const during = await page.evaluate(() => window.__localMdDebug?.getSyncCount() ?? 0);
  await page.getByTestId("rendered-editor").dispatchEvent("compositionend");
  await expect
    .poll(() => page.evaluate(() => window.__localMdDebug?.getSyncCount() ?? 0))
    .toBeGreaterThan(during);
  expect(during).toBe(before);
});

test("uses GitHub-like document width with a right comments rail", async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 900 });
  await openExample(page);

  const layout = await page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>("[data-testid='rendered-editor']");
    const comments = document.querySelector<HTMLElement>("[data-testid='comments-column']");
    if (!editor || !comments) throw new Error("Expected editor and comments column");
    const editorRect = editor.getBoundingClientRect();
    const commentsRect = comments.getBoundingClientRect();
    return {
      commentsWidth: commentsRect.width,
      editorCenter: editorRect.left + editorRect.width / 2,
      editorWidth: editorRect.width,
      viewportCenter: window.innerWidth / 2,
    };
  });

  expect(layout.editorWidth).toBeLessThanOrEqual(1014);
  expect(layout.commentsWidth).toBeGreaterThanOrEqual(280);
  expect(layout.commentsWidth).toBeLessThanOrEqual(420);
  expect(Math.abs(layout.editorCenter - layout.viewportCenter)).toBeLessThanOrEqual(2);
});
