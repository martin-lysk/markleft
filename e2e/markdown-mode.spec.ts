import { expect, test } from "@playwright/test";

import { openExample } from "./helpers";

test("switches to Markdown, edits source, and renders the change", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await expect(editor).toBeVisible();
  await editor.fill("# Changed\n\nA changed paragraph.\n");

  await page.getByTestId("mode-rendered").click();
  await expect(page.getByRole("heading", { name: "Changed" })).toBeVisible();
  await expect(page.getByText("A changed paragraph.")).toBeVisible();

  await page.getByTestId("mode-markdown").click();
  await expect(editor).toHaveValue("# Changed\n\nA changed paragraph.\n");
});

test("grows the Markdown textarea with extra breathing room", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  const initialHeight = await editor.evaluate((textarea) => (textarea as HTMLTextAreaElement).getBoundingClientRect().height);
  await editor.fill(Array.from({ length: 40 }, (_, index) => `Line ${index + 1}`).join("\n"));
  const grownHeight = await editor.evaluate((textarea) => (textarea as HTMLTextAreaElement).getBoundingClientRect().height);

  expect(grownHeight).toBeGreaterThan(initialHeight);
  await expect(editor).toHaveJSProperty("scrollTop", 0);
});

test("highlights Markdown source ranges and anchors comments to source lines", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill("First paragraph.\n\nSecond anchor paragraph.");
  await editor.evaluate((textarea) => {
    const input = textarea as HTMLTextAreaElement;
    const start = input.value.indexOf("anchor");
    input.setSelectionRange(start, start + "anchor".length);
  });

  await page.getByTestId("add-comment").click();
  await page.getByTestId("comment-input").fill("Markdown highlight note");
  await page.locator("button[data-action='save-comment']").click();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  await expect.poll(async () =>
    page.locator(".local-md-markdown-highlights mark").evaluateAll((marks) => marks.map((mark) => mark.textContent).join("")),
  ).toContain("anchor");
  await expect.poll(async () => {
    return page.evaluate(() => {
      const editorElement = document.querySelector<HTMLTextAreaElement>("[data-testid='markdown-editor']");
      const card = document.querySelector<HTMLElement>(".local-md-comment-card");
      const mark = document.querySelector<HTMLElement>(".local-md-markdown-highlights mark");
      if (!editorElement || !card || !mark) return false;
      return Math.abs(card.getBoundingClientRect().top - mark.getBoundingClientRect().top) < 8;
    });
  }).toBe(true);
});

test("anchors Markdown comments to visual wrapped lines", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill(
    "This intentionally long line should wrap across several visual rows before the final anchor word appears near the end of the text.",
  );
  await editor.evaluate((textarea) => {
    const input = textarea as HTMLTextAreaElement;
    const start = input.value.indexOf("anchor");
    input.setSelectionRange(start, start + "anchor".length);
  });

  await page.getByTestId("add-comment").click();
  await page.getByTestId("comment-input").fill("Wrapped note");
  await page.locator("button[data-action='save-comment']").click();

  await expect.poll(async () => {
    return page.evaluate(() => {
      const editorElement = document.querySelector<HTMLTextAreaElement>("[data-testid='markdown-editor']");
      const card = document.querySelector<HTMLElement>(".local-md-comment-card");
      const mark = document.querySelector<HTMLElement>(".local-md-markdown-highlight-active");
      if (!editorElement || !card || !mark) return false;
      const expected = mark.getBoundingClientRect().top;
      const actual = card.getBoundingClientRect().top;
      return Math.abs(actual - expected) < 8;
    });
  }).toBe(true);
});
