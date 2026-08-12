import { expect, test } from "@playwright/test";

import { openExample } from "./helpers";

test("block IDs are enabled by default for documents without IDs", async ({ page }) => {
  await openExample(page);
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page.getByTestId("markdown-editor").fill("# Title\n\nParagraph.");

  await expect(page.getByTestId("include-block-ids")).toBeChecked();
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-rendered").click();
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();

  await expect(page.getByTestId("markdown-editor")).toHaveValue(
    /<!-- markleft:block id="b[a-f0-9]{7}" -->\n# Title/,
  );
});

test("block ID toggle identifies only real document blocks", async ({ page }) => {
  await openExample(page);
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(["# Title", "", "Paragraph.", "", "[^ordinary]: Footnote body."].join("\n"));

  await page.getByTestId("include-block-ids").check();
  const markdown = await page.getByTestId("markdown-editor").inputValue();
  expect(markdown.match(/<!-- markleft:block id="b[a-f0-9]{7}" -->/g)).toHaveLength(2);
  expect(markdown.slice(markdown.indexOf("[^ordinary]:"))).not.toContain("markleft:block");

  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-rendered").click();
  await page.locator("[data-block-id^='b']").nth(1).click();
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  const roundtripped = await page.getByTestId("markdown-editor").inputValue();
  expect(roundtripped.match(/<!-- markleft:block id="b[a-f0-9]{7}" -->/g)).toHaveLength(2);
});

test("renders and applies an append-only update suggestion", async ({ page }) => {
  await openExample(page);
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        '<!-- markleft:block id="b55" -->',
        "Original paragraph.",
        "",
        "[^suggestion-s1-update-block-b55]: Updated paragraph.",
      ].join("\n"),
    );
  await page.getByTestId("include-block-ids").check();
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-review").click();

  await expect(page.locator(".local-md-review-suggestion")).toContainText("Updated paragraph.");
  await page.getByTestId("suggestion-discussion-card").getByTitle("Apply suggestion").click();
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await expect(page.getByTestId("markdown-editor")).toHaveValue(
    /id="b55" -->\nUpdated paragraph\./,
  );
  await expect(page.getByTestId("markdown-editor")).not.toHaveValue(/suggestion-s1-update/);
});

test("renders an append-only table update suggestion", async ({ page }) => {
  await openExample(page);
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        '<!-- markleft:block id="bchart" -->',
        "```mermaid",
        "flowchart LR",
        "    A[Before] --> B[Table]",
        "```",
        "",
        '<!-- markleft:block id="btable" -->',
        "| Before | Value |",
        "| --- | --- |",
        "| A | Technical term[^block-101-abcd] |",
        "",
        "[^block-101-abcd]: Explain this.",
        "",
        "[^suggestion-s2-update-block-btable]:",
        "    | After | Value |",
        "    | --- | --- |",
        "    | A | Explained |",
        "",
        "    [^block-101-abcd]",
      ].join("\n"),
    );
  await page.getByTestId("include-block-ids").check();
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-review").click();

  const suggestion = page.locator(".local-md-review-suggestion");
  await expect(suggestion).toHaveCount(1);
  await expect(suggestion.locator("table")).toHaveCount(1);
  await expect(suggestion).toContainText("Explained");
  await expect(page.getByTestId("rendered-editor")).not.toContainText("Technical term");
  await expect(page.locator(".local-md-diff-marker")).toHaveCount(2);
  await expect(page.locator(".local-md-diff-marker").first()).toHaveAttribute(
    "data-original",
    "Before",
  );
  await expect(page.locator(".local-md-diff-marker").last()).toHaveAttribute(
    "data-original",
    "Technical term",
  );
  await expect.poll(() => diffHighlightRangeCount(page, "local-md-diff-replace")).toBe(2);
});

test("text suggestions after a mixed HTML and Markdown table replace their original blocks", async ({
  page,
}) => {
  await openExample(page);
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        '<!-- markleft:block id="btable" -->',
        "<table>",
        "<tr><td>",
        "",
        "```",
        "### Markdown inside HTML",
        "```",
        "",
        "</td><td>",
        "",
        "### Rendered heading",
        "",
        "Rendered paragraph.",
        "",
        "</td></tr>",
        "</table>",
        "",
        '<!-- markleft:block id="bfirst" -->',
        "Original first paragraph.",
        "",
        '<!-- markleft:block id="bsecond" -->',
        "Original second paragraph.",
        "",
        "[^suggestion-s1-update-block-bfirst]: Replacement first paragraph.",
        "",
        "[^suggestion-s2-update-block-bsecond]: Replacement second paragraph.",
      ].join("\n"),
    );
  await page.getByTestId("include-block-ids").check();
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-review").click();

  const editor = page.getByTestId("rendered-editor");
  await expect(editor).not.toContainText("Original first paragraph.");
  await expect(editor).not.toContainText("Original second paragraph.");
  await expect(editor).toContainText("Replacement first paragraph.");
  await expect(editor).toContainText("Replacement second paragraph.");
  await expect(editor.locator(".local-md-review-suggestion")).toHaveCount(2);
});

test("diffs text inside corresponding list items", async ({ page }) => {
  await openExample(page);
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        '<!-- markleft:block id="blist" -->',
        "- Keep this item",
        "- Old list wording",
        "- Keep the last item",
        "",
        "[^suggestion-s5-update-block-blist]:",
        "    - Keep this item",
        "    - New list wording",
        "    - Keep the last item",
      ].join("\n"),
    );
  await page.getByTestId("include-block-ids").check();
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-review").click();

  const suggestion = page.locator("ul.local-md-review-suggestion");
  await expect(suggestion.locator("li")).toHaveCount(3);
  await expect(page.locator(".local-md-diff-marker")).toHaveCount(1);
  await expect(page.locator(".local-md-diff-marker")).toHaveAttribute("data-original", "Old");
  await expect.poll(() => diffHighlightRangeCount(page, "local-md-diff-replace")).toBe(1);
});

test("reveals the original image with a slider when its linked annotation is clicked", async ({
  page,
}) => {
  await openExample(page);
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        '<!-- markleft:block id="bimage" -->',
        "![Original image](local-md-logo.svg)",
        "[^image-2500-5000-100-a1b2]",
        "",
        '<!-- markleft:block id="boutside" -->',
        "Outside paragraph.",
        "",
        "[^image-2500-5000-100-a1b2]: Keep this marker visible.",
        "",
        "[^suggestion-s6-update-block-bimage]:",
        "    ![Suggested image](svg-object-comment-test.svg)",
        "",
        "    [^image-2500-5000-100-a1b2]",
      ].join("\n"),
    );
  await page.getByTestId("include-block-ids").check();
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-review").click();

  const comparison = page.locator(".local-md-image-comparison");
  const slider = comparison.locator(".local-md-image-comparison-slider");
  const stage = comparison.locator(".local-md-image-comparison-stage");
  await expect(comparison).toHaveCount(1);
  await expect(comparison.locator(".local-md-image-comparison-original img")).toHaveAttribute(
    "src",
    "local-md-logo.svg",
  );
  await expect(comparison.locator(".local-md-image-comparison-suggestion img")).toHaveAttribute(
    "src",
    "svg-object-comment-test.svg",
  );
  await expect(comparison).toHaveCSS("--local-md-image-reveal", "0%");
  await expect(slider).toBeHidden();

  await comparison.locator(".local-md-image-comparison-suggestion img").click();
  await expect(page.getByTestId("comment-input")).toHaveCount(0);

  await page.getByTestId("suggestion-discussion-card").click();
  await expect(comparison).toHaveClass(/local-md-review-suggestion-active/);
  await expect(slider).toBeVisible();
  await expect(slider).toHaveAttribute("aria-valuenow", "50");

  await slider.scrollIntoViewIfNeeded();
  const bounds = await stage.boundingBox();
  const sliderBounds = await slider.boundingBox();
  if (!bounds) throw new Error("Expected image comparison bounds");
  if (!sliderBounds) throw new Error("Expected image slider bounds");
  const viewport = page.viewportSize();
  const dragY = Math.max(
    1,
    Math.min((viewport?.height ?? 720) - 1, sliderBounds.y + sliderBounds.height / 2),
  );
  await page.mouse.move(sliderBounds.x + sliderBounds.width / 2, dragY);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.75, dragY);
  await page.mouse.up();
  await expect(slider).toHaveAttribute("aria-valuenow", "75");

  const marker = comparison.locator(".local-md-image-comment-anchor");
  await expect(marker).toBeVisible();
  await expect(marker).toHaveAttribute("data-comment-id", "image-2500-5000-100-a1b2");
  await expect
    .poll(() => marker.evaluate((node) => Number(getComputedStyle(node).zIndex)))
    .toBeGreaterThan(2);

  await page.getByText("Outside paragraph.").click();
  await expect(comparison).not.toHaveClass(/local-md-review-suggestion-active/);
  await expect(comparison).toHaveCSS("--local-md-image-reveal", "0%");
  await expect(slider).toBeHidden();
  await expect(marker).toBeVisible();

  await marker.click();
  await expect(comparison).toHaveClass(/local-md-review-suggestion-active/);
  await expect(slider).toBeVisible();
  await expect(slider).toHaveAttribute("aria-valuenow", "50");
});

test("image comparison slider supports keyboard control", async ({ page }) => {
  await openExample(page);
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        '<!-- markleft:block id="bimage" -->',
        "![Original image](local-md-logo.svg)",
        "",
        "[^suggestion-s7-update-block-bimage]: ![Suggested image](svg-object-comment-test.svg)",
      ].join("\n"),
    );
  await page.getByTestId("include-block-ids").check();
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-review").click();
  await page.getByTestId("suggestion-discussion-card").click();

  const slider = page.locator(".local-md-image-comparison-slider");
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "55");
  await page.keyboard.press("End");
  await expect(slider).toHaveAttribute("aria-valuenow", "100");
  await page.keyboard.press("Home");
  await expect(slider).toHaveAttribute("aria-valuenow", "0");
});

test("does not create an image comparison for a mixed-content replacement", async ({ page }) => {
  await openExample(page);
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        '<!-- markleft:block id="bmixed" -->',
        "Original caption with ![Original image](local-md-logo.svg)",
        "",
        "[^suggestion-s8-update-block-bmixed]: Suggested caption with ![Suggested image](svg-object-comment-test.svg)",
      ].join("\n"),
    );
  await page.getByTestId("include-block-ids").check();
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-review").click();

  await expect(page.locator(".local-md-image-comparison")).toHaveCount(0);
  await expect(page.locator(".local-md-review-suggestion")).toContainText("Suggested caption");
});

test("diffs an append-only insertion against an empty prior state", async ({ page }) => {
  await openExample(page);
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        '<!-- markleft:block id="bheading" -->',
        "## How the fingerprint is built",
        "",
        "[^suggestion-s3-insert-after-block-bheading]: **TL;DR:** A compact fingerprint makes near-duplicates quick to identify.",
      ].join("\n"),
    );
  await page.getByTestId("include-block-ids").check();
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-review").click();

  const suggestion = page.locator(".local-md-review-suggestion");
  await expect(suggestion).toContainText("A compact fingerprint");
  await expect(suggestion.locator(".local-md-diff-marker")).toHaveCount(0);
  await expect(page.getByTestId("rendered-editor")).not.toContainText("is builtis built");
});

async function diffHighlightRangeCount(
  page: import("@playwright/test").Page,
  name: string,
): Promise<number> {
  return page.evaluate(
    (highlightName) =>
      Array.from(CSS.highlights.entries()).reduce(
        (count, [currentName, highlight]) =>
          currentName === highlightName || currentName.startsWith(`${highlightName}-`)
            ? count + Array.from(highlight).length
            : count,
        0,
      ),
    name,
  );
}
