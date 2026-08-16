import { expect, test } from "@playwright/test";

import { exampleUrl } from "./helpers";

test("bookmarklet preserves a self-rendering document's frontmatter and Markdown", async ({ page }) => {
  await page.goto(exampleUrl);
  await expect(page.getByTestId("rendered-editor")).toBeVisible();

  const beforeFrontmatter = await page.getByTestId("frontmatter-source").inputValue();
  await page.getByTestId("mode-markdown").click();
  const beforeMarkdown = await page.getByTestId("markdown-editor").inputValue();
  expect(beforeFrontmatter).toContain("title: Local Markdown Demo");
  expect(beforeMarkdown).toContain("# Local Markdown Demo");

  await page.goto(exampleUrl);
  await expect(page.getByTestId("rendered-editor")).toBeVisible();

  await page.addScriptTag({ path: `${process.cwd()}/bookmark.js` });

  await expect(page.getByTestId("rendered-editor")).toBeVisible();
  await expect(page.getByTestId("frontmatter-source")).toHaveValue(beforeFrontmatter);
  await page.getByTestId("mode-markdown").click();
  await expect(page.getByTestId("markdown-editor")).toHaveValue(beforeMarkdown);
});
