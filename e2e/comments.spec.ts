import { expect, type Locator, type Page, test } from "@playwright/test";

import { openExample } from "./helpers";

test("toolbar format dropdown applies heading styles in Markdown mode", async ({ page }) => {
  await openExample(page);

  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill("Toolbar heading");
  await editor.evaluate((textarea) => {
    (textarea as HTMLTextAreaElement).setSelectionRange(
      0,
      (textarea as HTMLTextAreaElement).value.length,
    );
  });

  await page.locator("[data-format-trigger]").click();
  await expect(page.locator(".local-md-format-popover")).toBeVisible();
  await page.locator(".local-md-format-popover [data-toolbar-command='heading-2']").click();

  await expect(editor).toHaveValue("## Toolbar heading");
  await expect(page.locator("[data-format-label]")).toHaveText("Heading 2");
});

test("toolbar mode dropdown switches between editing and suggestions", async ({ page }) => {
  await openExample(page);

  await page.locator("[data-mode-trigger]").click();
  await expect(page.locator(".local-md-mode-popover")).toBeVisible();
  await page.getByTestId("mode-review").click();

  await expect(page.locator("[data-mode-label]")).toHaveText("Suggestions");

  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-rendered").click();
  await expect(page.locator("[data-mode-label]")).toHaveText("Editing");
});

test("adds a range comment from Markdown mode and reconstructs it in rendered mode", async ({
  page,
}) => {
  await openExample(page);

  await page.locator("[data-mode-trigger]").click();
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill("# Local Markdown Demo\n\nClean body.\n");
  await editor.evaluate((textarea) => {
    const value = (textarea as HTMLTextAreaElement).value;
    const start = value.indexOf("Local Markdown Demo");
    (textarea as HTMLTextAreaElement).setSelectionRange(
      start,
      start + "Local Markdown Demo".length,
    );
  });

  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Comment from e2e");

  await expect(editor).toHaveValue(/range-prev-\d+-chars-\d+-[0-9a-f]{4}/);
  await page.getByTestId("mode-rendered").click();
  await expect(page.getByTestId("comment-card")).toContainText("Comment from e2e");
  await expect(page.locator(".local-md-comment-anchor")).toHaveCount(1);
  await expect.poll(() => hasHighlight(page, "local-md-comment-range-current")).toBe(true);
});

test("adds rendered comments to the selected repeated occurrence", async ({ page }) => {
  await openExample(page);

  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page.getByTestId("markdown-editor").fill("# Markdown\n\nPick this Markdown word.");
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-rendered").click();
  await selectRenderedText(page, "Markdown", 1);

  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Repeated word");

  await page.getByTestId("mode-markdown").click();
  await expect(page.getByTestId("markdown-editor")).toHaveValue(
    /^# Markdown\n\nPick this Markdown\[\^range-prev-\d+-chars-\d+-[0-9a-f]{4}\] word\.\n\n\[\^range-prev-/,
  );
});

test("anchors a rendered selection across a soft line break with inline code and pipes", async ({
  page,
}) => {
  await openExample(page);

  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      "The prefix, which handles `long` rules (`|w| > 2`) natively with no PDS\nnormalization. After.",
    );
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-rendered").click();
  await selectRenderedText(
    page,
    "which handles long rules (|w| > 2) natively with no PDS\nnormalization.",
    0,
  );

  await page.getByTestId("selection-add-comment").click();
  await saveDraftComment(page, "Soft-break selection");

  await expect(page.locator(".local-md-comment-anchor")).toHaveCount(1);
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await expect(page.getByTestId("markdown-editor")).toHaveValue(/normalization\.\[\^range-prev-/);
  await expect(page.getByTestId("markdown-editor")).not.toHaveValue(/\[\^block-/);
});

test("anchors a rendered selection from bold text across an inline link", async ({ page }) => {
  await openExample(page);

  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      "- **Aliasing is derived, not supplied** ([`perobject`](src/perobject.rs)). Aliasing is a *product*.",
    );
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-rendered").click();
  await selectRenderedText(page, "not supplied (perobject). Aliasing i", 0);

  await page.getByTestId("selection-add-comment").click();
  await saveDraftComment(page, "Bold-link selection");

  await expect(page.locator(".local-md-comment-anchor")).toHaveCount(1);
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await expect(page.getByTestId("markdown-editor")).toHaveValue(/Aliasing i\[\^range-prev-/);
  await expect(page.getByTestId("markdown-editor")).not.toHaveValue(/\[\^block-/);
});

test("shows a rendered selection toolbar for adding comments", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page.getByTestId("markdown-editor").fill("Select this phrase for a contextual comment.");
  await page.getByTestId("mode-rendered").click();
  await selectRenderedText(page, "this phrase", 0);

  await expect(page.getByTestId("selection-toolbar")).toBeVisible();
  await expect.poll(() => selectionToolbarIsAtSelectionFocusLine(page)).toBe(true);
  await page.getByTestId("selection-add-comment").click();
  await saveDraftComment(page, "Toolbar note");

  await expect(page.getByTestId("comment-card")).toContainText("Toolbar note");
  await expect(page.locator(".local-md-comment-anchor")).toHaveCount(1);
  await expect(page.getByTestId("selection-toolbar")).toBeHidden();
});

test("places the rendered selection toolbar at a backward selection focus", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill("Start backward selection.<br>End backward selection.");
  await page.getByTestId("mode-rendered").click();
  await selectRenderedTextBackward(page, "Start backward", "End backward");

  await expect(page.getByTestId("selection-toolbar")).toBeVisible();
  await expect.poll(() => selectionToolbarIsAtSelectionFocusLine(page)).toBe(true);
});

test("cancels unsaved draft comments by removing their anchor", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page.getByTestId("markdown-editor").fill("Draft anchor target.");
  await page.getByTestId("mode-rendered").click();
  await selectRenderedText(page, "anchor", 0);
  await page.getByTestId("add-comment").click();

  await expect(page.getByTestId("comment-input")).toBeFocused();
  await expect(page.getByTestId("comment-card")).toHaveAttribute("data-comment-state", "current");
  await page.getByTestId("comment-input").press("Escape");

  await expect(page.getByTestId("comment-card")).toHaveCount(0);
  await page.getByTestId("mode-markdown").click();
  await expect(page.getByTestId("markdown-editor")).not.toHaveValue(/\[\^range-/);
});

test("saves comments and replies with Cmd/Ctrl+Enter", async ({ page }) => {
  await openExample(page);

  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill("Shortcut save target.");
  await editor.evaluate((textarea) => {
    const input = textarea as HTMLTextAreaElement;
    input.setSelectionRange(0, "Shortcut save".length);
  });
  await page.getByTestId("add-comment").click();

  const input = page.getByTestId("comment-input");
  await input.fill("Saved by shortcut");
  await input.press("ControlOrMeta+Enter");

  await expect(page.getByTestId("comment-card")).toContainText("Saved by shortcut");
  await expect(editor).toHaveValue(
    /\[\^range-prev-\d+-chars-\d+-[0-9a-f]{4}\]: Saved by shortcut/,
  );

  await page.getByTestId("comment-card").click();
  const replyInput = page.getByTestId("comment-reply-input");
  await replyInput.fill("Reply by shortcut");
  await replyInput.press("ControlOrMeta+Enter");

  await expect(page.getByTestId("comment-card")).toContainText("Reply by shortcut");
  await expect(editor).toHaveValue(/\[\^comment-\d+[^\n]*\]: Reply to/);
  await expect(editor).toHaveValue(/Reply by shortcut/);
});

test("keeps an unsaved comment draft when focus leaves and returns to the input", async ({
  page,
}) => {
  await openExample(page);

  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page.getByTestId("markdown-editor").fill("Keep this draft comment.");
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-rendered").click();
  await selectRenderedText(page, "draft", 0);
  await page.getByTestId("add-comment").click();

  const input = page.getByTestId("comment-input");
  await input.fill("Unsaved but not forgotten");
  await page.getByTestId("rendered-editor").click({ position: { x: 12, y: 12 } });
  await input.click();

  await expect(input).toHaveValue("Unsaved but not forgotten");
});

test("discards a new empty comment when focus leaves its card", async ({ page }) => {
  await openExample(page);

  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page.getByTestId("markdown-editor").fill("Discard this empty comment anchor.");
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-rendered").click();
  await selectRenderedText(page, "empty comment", 0);
  await page.getByTestId("add-comment").click();

  await expect(page.getByTestId("comment-input")).toBeFocused();
  await page.getByTestId("rendered-editor").click({ position: { x: 12, y: 12 } });

  await expect(page.getByTestId("comment-card")).toHaveCount(0);
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await expect(page.getByTestId("markdown-editor")).not.toHaveValue(/\[\^range-/);
});

test("rendered phrase ranges count non-whitespace chars but highlight the visible space", async ({
  page,
}) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page.getByTestId("markdown-editor").fill("hello world");
  await page.getByTestId("mode-rendered").click();
  await selectRenderedText(page, "hello world", 0);

  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Phrase");

  await expect
    .poll(() => highlightTexts(page, "local-md-comment-range-active"))
    .toContain("hello world");
  await page.getByTestId("mode-markdown").click();
  await expect(page.getByTestId("markdown-editor")).toHaveValue(
    /^hello world\[\^range-prev-10-chars-\d+-[0-9a-f]{4}\]/,
  );
});

test("adds rendered code block comments after the fence", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(["```ts", "const value = 1;", "console.log(value);", "```"].join("\n"));
  await page.getByTestId("mode-rendered").click();
  await selectRenderedText(page, "log", 0);

  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Code note");

  await expect(page.getByTestId("comment-card")).toContainText("Code note");
  await expect.poll(() => highlightTexts(page, "local-md-comment-range-active")).toContain("log");
  await page.getByTestId("mode-markdown").click();
  const source = await page.getByTestId("markdown-editor").inputValue();
  expect(source).toMatch(
    /console\.log\(value\);\n```\n\[\^code-line-2-col-9-len-3-\d+-[0-9a-f]{4}\]/,
  );
  expect(source).not.toMatch(/console\.\[\^/);
});

test("adds rendered Mermaid label comments as code block comments", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(["```mermaid", "flowchart LR", "  A[Draft] --> B[Review]", "```"].join("\n"));
  await page.getByTestId("mode-rendered").click();
  await expect(page.locator(".local-md-mermaid svg")).toBeVisible();
  await selectRenderedText(page, "Review", 0);

  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Mermaid note");

  await page.getByTestId("mode-markdown").click();
  const source = await page.getByTestId("markdown-editor").inputValue();
  expect(source).toMatch(
    /  A\[Draft\] --> B\[Review\]\n```\n\[\^code-line-2-col-\d+-len-6-\d+-[0-9a-f]{4}\]/,
  );
  expect(source).not.toMatch(/range-prev/);
});

test("rendered whitespace-only selections create block comments", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page.getByTestId("markdown-editor").fill("hello   world");
  await page.getByTestId("mode-rendered").click();
  await selectRenderedText(page, "   ", 0);

  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Whitespace");

  await page.getByTestId("mode-markdown").click();
  await expect(page.getByTestId("markdown-editor")).toHaveValue(
    /^hello   world\[\^block-\d+-[0-9a-f]{4}\]/,
  );
});

test("adds bitmap image comments as positioned footnote anchors", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      "![Tiny bitmap](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8AARLJgYGBgAAA8BAID7Pq3mwAAAABJRU5ErkJggg==)\n\nAfter image.\n",
    );
  await page.getByTestId("mode-rendered").click();

  await page.locator("img").click({ position: { x: 20, y: 20 } });
  await saveDraftComment(page, "Pixel note");

  await expect(page.locator(".local-md-image-comment-anchor")).toHaveCount(1);
  await expect(page.getByTestId("comment-card")).toContainText("Pixel note");
  await expect(page.locator(".local-md-image-comment-anchor")).toHaveText("1");
  await page.locator(".local-md-image-comment-anchor").click();
  await expect(page.getByTestId("comment-card")).toHaveClass(/local-md-comment-card-active/);

  await page.getByTestId("mode-markdown").click();
  await expect(page.getByTestId("markdown-editor")).toHaveValue(
    /!\[Tiny bitmap\]\(data:image\/png;base64,[^)]+\)\n\[\^image-\d+-\d+-\d+-[0-9a-f]{4}\]\n\nAfter image\./,
  );
});

test("switches active image footnote anchor when sidebar comments are clicked", async ({
  page,
}) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      "![Tiny bitmap](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8AARLJgYGBgAAA8BAID7Pq3mwAAAABJRU5ErkJggg==)\n\nAfter image.\n",
    );
  await page.getByTestId("mode-rendered").click();

  await page.locator("img").click({ position: { x: 15, y: 15 } });
  await saveDraftComment(page, "First image note");

  await page.locator("img").click({ position: { x: 35, y: 35 } });
  await saveDraftComment(page, "Second image note");

  const markers = page.locator(".local-md-image-comment-anchor");
  await expect(markers).toHaveCount(2);
  await expect(markers.nth(1)).toHaveClass(/local-md-image-comment-anchor-active/);

  await page.getByTestId("comment-card").filter({ hasText: "First image note" }).click();

  await expect(markers.nth(0)).toHaveClass(/local-md-image-comment-anchor-active/);
  await expect(markers.nth(1)).not.toHaveClass(/local-md-image-comment-anchor-active/);
});

test("sorts image comment cards by their position inside the image", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        "![Tiny bitmap](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8AARLJgYGBgAAA8BAID7Pq3mwAAAABJRU5ErkJggg==)",
        "[^image-5000-9000-100-a1b2][^image-5000-1000-200-b2c3]",
        "",
        "[^image-5000-9000-100-a1b2]: Lower note",
        "",
        "[^image-5000-1000-200-b2c3]: Upper note",
      ].join("\n"),
    );

  await page.getByTestId("mode-rendered").click();
  await expect(page.getByTestId("comment-card")).toHaveCount(2);
  await expect
    .poll(() => commentCardIsAboveCommentCard(page, "Upper note", "Lower note"))
    .toBe(true);
});

test("aligns active image comment cards with their positioned markers", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        "Intro original.[^suggest-block-100-a1b2]",
        "",
        "![Diagram](local-md-logo.svg)[^image-5000-8000-200-b2c3]",
        "",
        "[^suggest-block-100-a1b2]: Intro replacement.",
        "",
        "[^image-5000-8000-200-b2c3]: Image note",
      ].join("\n"),
    );

  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-review").click();
  await page.getByTestId("suggestion-discussion-card").click();
  await page.locator(".local-md-image-comment-anchor").click();
  await expect.poll(() => imageCardIsNearMarker(page, "image-5000-8000-200-b2c3")).toBe(true);
});

test("adds inline SVG comments with an element path anchor", async ({ page }) => {
  await openExample(page);

  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      '<svg viewBox="0 0 100 50" width="400" height="200"><rect width="100" height="50" fill="gold"/></svg>\n\nAfter svg.\n',
    );
  await page.getByTestId("mode-rendered").click();

  await page
    .getByTestId("rendered-editor")
    .locator("rect")
    .click({ position: { x: 20, y: 20 } });
  await saveDraftComment(page, "SVG note");

  await expect(page.locator(".local-md-image-comment-anchor")).toHaveCount(1);
  await expect(page.getByTestId("comment-card")).toContainText("SVG note");
  await page.getByTestId("mode-markdown").click();
  await expect(page.getByTestId("markdown-editor")).toHaveValue(
    /<svg[\s\S]*<\/svg>\n\[\^svg-xpath_svg\.1-rect\.1_\d+-[0-9a-f]{4}\]\n\nAfter svg\./,
  );
});

test("adds external SVG file comments as normal image coordinate anchors", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill("![Status circles](svg-object-comment-test.svg)\n\nAfter svg image.\n");
  await page.getByTestId("mode-rendered").click();

  await expect(page.locator('img[src="svg-object-comment-test.svg"]')).toBeVisible();
  await page
    .locator('img[src="svg-object-comment-test.svg"]')
    .click({ position: { x: 82, y: 80 } });
  await saveDraftComment(page, "Change this circle color");

  await expect(page.locator(".local-md-image-comment-anchor")).toHaveCount(1);
  await expect(page.getByTestId("comment-card")).toContainText("Change this circle color");
  await page.getByTestId("mode-markdown").click();
  await expect(page.getByTestId("markdown-editor")).toHaveValue(
    /!\[Status circles\]\(svg-object-comment-test\.svg\)\n\[\^image-\d+-\d+-\d+-[0-9a-f]{4}\]\n\nAfter svg image\./,
  );
  await expect(page.getByTestId("markdown-editor")).toHaveValue(
    /\[\^image-\d+-\d+-\d+-[0-9a-f]{4}\]: Change this circle color/,
  );
});

test("adds rendered comments across inline element boundaries", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page.getByTestId("markdown-editor").fill("This **start of** the range works.");
  await page.getByTestId("mode-rendered").click();
  await selectRenderedText(page, "start of the range", 0);

  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Crosses formatting");

  await expect(page.locator(".local-md-comment-anchor")).toHaveCount(1);
  await expect.poll(() => hasHighlight(page, "local-md-comment-range-active")).toBe(true);
  await page.getByTestId("mode-markdown").click();
  await expect(page.getByTestId("markdown-editor")).toHaveValue(
    /^This \*\*start of\*\* the range\[\^range-prev-\d+-chars-\d+-[0-9a-f]{4}\] works\.\n\n\[\^range-prev-/,
  );
});

test("activates the comment highlight when the caret overlaps its range", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page.getByTestId("markdown-editor").fill("Active range here.");
  const editor = page.getByTestId("markdown-editor");
  await editor.evaluate((textarea) => {
    (textarea as HTMLTextAreaElement).setSelectionRange(0, "Active range".length);
  });
  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Active note");
  await page.getByTestId("mode-rendered").click();
  await selectRenderedText(page, "range", 0);
  await page.keyboard.press("ArrowRight");

  await expect.poll(() => hasHighlight(page, "local-md-comment-range-active")).toBe(true);
  await expect(page.getByTestId("comment-card")).toHaveClass(/local-md-comment-card-active/);
});

test("lays out rendered sidebar comments at anchors without overlap", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        "Spacer paragraph.",
        "",
        "Another spacer paragraph.",
        "",
        "A third spacer paragraph.",
        "",
        "A fourth spacer paragraph.",
        "",
        "First alpha[^range-prev-5-chars-101-0000]",
        "",
        "Second beta[^range-prev-4-chars-102-0000]",
        "",
        "Third gamma[^range-prev-5-chars-103-0000]",
        "",
        ...Array.from({ length: 60 }, (_, index) => `Trailing paragraph ${index + 1}.`),
        "",
        "[^range-prev-5-chars-101-0000]: First note",
        "[^range-prev-4-chars-102-0000]: Second note",
        "[^range-prev-5-chars-103-0000]: Third note",
      ].join("\n"),
    );
  await page.getByTestId("mode-rendered").click();

  await expect(page.getByTestId("comment-card")).toHaveCount(3);
  await expect.poll(() => cardIsNearAnchor(page, "range-prev-5-chars-101-0000")).toBe(true);
  await expect.poll(() => commentCardsDoNotOverlap(page)).toBe(true);

  const secondCard = page.getByTestId("comment-card").filter({ hasText: "Second note" });
  await secondCard.evaluate((card) => {
    (card as HTMLElement).dataset.identityProbe = "kept";
  });
  await secondCard.locator("p").click();
  await expect(secondCard).toHaveAttribute("data-identity-probe", "kept");
  await expect(secondCard).toHaveClass(/local-md-comment-card-active/);
  await expect.poll(() => activeCardIsNearAnchor(page, "range-prev-4-chars-102-0000")).toBe(true);
  await expect.poll(() => commentCardsDoNotOverlap(page)).toBe(true);
  await expect
    .poll(() => orderedCardTops(page))
    .toEqual(["First note", "Second note", "Third note"]);
  const beforeScrollDelta = await cardAnchorTopDelta(page, "range-prev-4-chars-102-0000");
  await page.evaluate(() => window.scrollTo(0, 120));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect
    .poll(
      async () =>
        Math.abs(
          (await cardAnchorTopDelta(page, "range-prev-4-chars-102-0000")) - beforeScrollDelta,
        ) <= 2,
    )
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect
    .poll(() => cardAndAnchorTopsAreAboveViewport(page, "range-prev-4-chars-102-0000"))
    .toBe(true);

  const thirdCard = page.getByTestId("comment-card").filter({ hasText: "Third note" });
  await thirdCard.evaluate((card) => {
    (card as HTMLElement).dataset.identityProbe = "kept";
  });
  await thirdCard.locator("p").click();
  await expect(thirdCard).toHaveAttribute("data-identity-probe", "kept");
  await expect(thirdCard).toHaveClass(/local-md-comment-card-active/);
  await expect.poll(() => activeCardIsNearAnchor(page, "range-prev-5-chars-103-0000")).toBe(true);
  await expect.poll(() => commentCardsDoNotOverlap(page)).toBe(true);
  await expect
    .poll(() => orderedCardTops(page))
    .toEqual(["First note", "Second note", "Third note"]);
});

test("keeps existing sidebar cards mounted when a new rendered comment is added", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        "First alpha[^range-prev-5-chars-201-0000]",
        "",
        "Second beta[^range-prev-4-chars-202-0000]",
        "",
        "Add a comment to this target.",
        "",
        "[^range-prev-5-chars-201-0000]: First note",
        "[^range-prev-4-chars-202-0000]: Second note",
      ].join("\n"),
    );
  await page.getByTestId("mode-rendered").click();

  const firstCard = page.getByTestId("comment-card").filter({ hasText: "First note" });
  const secondCard = page.getByTestId("comment-card").filter({ hasText: "Second note" });
  await firstCard.evaluate((card) => {
    (card as HTMLElement).dataset.identityProbe = "first-kept";
  });
  await secondCard.evaluate((card) => {
    (card as HTMLElement).dataset.identityProbe = "second-kept";
  });
  await page.evaluate(() => {
    const testWindow = window as Window & { __newCommentCardTransformStarted?: boolean };
    testWindow.__newCommentCardTransformStarted = false;
    document.addEventListener(
      "transitionstart",
      (event) => {
        const target = event.target;
        if (
          event.propertyName === "transform" &&
          target instanceof HTMLElement &&
          target.matches("[data-testid='comment-card']") &&
          target.textContent?.includes("New note")
        ) {
          testWindow.__newCommentCardTransformStarted = true;
        }
      },
      { capture: true },
    );
  });

  await selectRenderedText(page, "this target", 0);
  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "New note");

  await expect(page.getByTestId("comment-card")).toHaveCount(3);
  await expect(firstCard).toHaveAttribute("data-identity-probe", "first-kept");
  await expect(secondCard).toHaveAttribute("data-identity-probe", "second-kept");
  await expect.poll(() => commentCardsDoNotOverlap(page)).toBe(true);
  await page.waitForTimeout(250);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const testWindow = window as Window & { __newCommentCardTransformStarted?: boolean };
        return testWindow.__newCommentCardTransformStarted;
      }),
    )
    .toBe(false);
});

test("keeps active top comments anchored by allowing earlier cards to move out of view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        "# Tight top",
        "",
        "Alpha one[^range-prev-3-chars-301-0000] beta two[^range-prev-3-chars-302-0000] gamma three[^range-prev-5-chars-303-0000] delta four[^range-prev-4-chars-304-0000].",
        "",
        ...Array.from({ length: 30 }, (_, index) => `Trailing ${index + 1}.`),
        "",
        "[^range-prev-3-chars-301-0000]: First top note",
        "[^range-prev-3-chars-302-0000]: Second top note",
        "[^range-prev-5-chars-303-0000]: Third top note",
        "[^range-prev-4-chars-304-0000]: Fourth top note",
      ].join("\n"),
    );
  await page.getByTestId("mode-rendered").click();
  await expect(page.getByTestId("comment-card")).toHaveCount(4);

  const activeCard = page.getByTestId("comment-card").filter({ hasText: "Fourth top note" });
  await activeCard.locator("p").click();

  await expect(activeCard).toHaveClass(/local-md-comment-card-active/);
  await expect.poll(() => activeCardIsNearAnchor(page, "range-prev-4-chars-304-0000")).toBe(true);
  await expect.poll(() => commentCardsDoNotOverlap(page)).toBe(true);
  await expect
    .poll(() => cardsBeforeActiveCanMoveAboveColumn(page, "range-prev-4-chars-304-0000"))
    .toBe(true);
});

test("activates and selects range comments in Markdown mode", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill("Active range here.");
  await editor.evaluate((textarea) => {
    (textarea as HTMLTextAreaElement).setSelectionRange(0, "Active range".length);
  });
  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Markdown active note");

  await editor.focus();
  await editor.evaluate((textarea) => {
    const input = textarea as HTMLTextAreaElement;
    const caret = input.value.indexOf("range") + 2;
    input.setSelectionRange(caret, caret);
  });
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("comment-card")).toHaveClass(/local-md-comment-card-active/);

  await editor.evaluate((textarea) => {
    const input = textarea as HTMLTextAreaElement;
    const end = input.value.length;
    input.setSelectionRange(end, end);
    input.dispatchEvent(new Event("select", { bubbles: true }));
  });
  await page.getByTestId("comment-card").locator("p").click();

  const selectedText = await editor.evaluate((textarea) => {
    const input = textarea as HTMLTextAreaElement;
    return input.value.slice(input.selectionStart, input.selectionEnd);
  });
  expect(selectedText).toBe("Active range");
});

test("edits comment bodies from Markdown mode", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill("Editable comment range.");
  await editor.evaluate((textarea) => {
    (textarea as HTMLTextAreaElement).setSelectionRange(0, "Editable comment".length);
  });
  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Original note");

  await page.getByTestId("comment-card").hover();
  await page.getByRole("button", { name: "Edit comment" }).click();
  await saveDraftComment(page, "Updated note");

  await expect(editor).toHaveValue(/\]: Updated note/);
  await expect(page.getByTestId("comment-card")).toContainText("Updated note");
});

test("deletes comments from the comment card", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill("Delete target.");
  await editor.evaluate((textarea) => {
    const input = textarea as HTMLTextAreaElement;
    input.setSelectionRange(0, "Delete target".length);
  });
  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Delete me");

  await page.getByTestId("comment-card").hover();
  await page.getByRole("button", { name: "Delete comment" }).click();

  await expect(page.getByTestId("comment-card")).toHaveCount(0);
  await expect(editor).not.toHaveValue(/\[\^range-/);
});

test("adds a reply from an active saved comment card", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill("Reply target.");
  await editor.evaluate((textarea) => {
    const input = textarea as HTMLTextAreaElement;
    input.setSelectionRange(0, "Reply target".length);
  });
  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Original note");

  await page.getByTestId("comment-card").click();
  await page.getByTestId("comment-reply-input").fill("Follow-up thought");
  await page.locator("button[data-action='save-reply']").click();

  await expect(page.getByTestId("comment-card")).toContainText("Follow-up thought");
  await expect(editor).toHaveValue(
    /\[\^range-prev-\d+-chars-\d+-[0-9a-f]{4}\]: Original note \[\^comment-\d+-[0-9a-f]{4}\]/,
  );
  await expect(editor).toHaveValue(/\[\^comment-\d+-[0-9a-f]{4}\]: Follow-up thought/);

  const childComment = page
    .locator(".local-md-comment-reply")
    .filter({ hasText: "Follow-up thought" });
  await childComment.hover();
  await childComment.getByRole("button", { name: "Edit comment" }).click();
  await childComment.getByTestId("child-comment-input").fill("Updated follow-up");
  await childComment.locator("button[data-action='save-child-comment']").click();

  await expect(page.getByTestId("comment-card")).toContainText("Updated follow-up");
  await expect(editor).toHaveValue(/\[\^comment-\d+-[0-9a-f]{4}\]: Updated follow-up/);

  const updatedChildComment = page
    .locator(".local-md-comment-reply")
    .filter({ hasText: "Updated follow-up" });
  await updatedChildComment.hover();
  await updatedChildComment.getByRole("button", { name: "Delete comment" }).click();

  await expect(page.locator(".local-md-comment-reply")).toHaveCount(0);
  await expect(editor).not.toHaveValue(/\[\^comment-\d+-[0-9a-f]{4}\]/);
});

test("shows reply composers only for active comments or unsaved reply text", async ({ page }) => {
  await openExample(page);

  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        "First alpha[^range-prev-5-chars-101-0000]",
        "",
        "Second beta[^range-prev-4-chars-102-0000]",
        "",
        "[^range-prev-5-chars-101-0000]: First note",
        "[^range-prev-4-chars-102-0000]: Second note",
      ].join("\n"),
    );

  await expect(page.getByTestId("comment-reply-input")).toHaveCount(0);

  const firstCard = page.getByTestId("comment-card").filter({ hasText: "First note" });
  const secondCard = page.getByTestId("comment-card").filter({ hasText: "Second note" });
  await firstCard.locator("p").click();
  await expect(page.getByTestId("comment-reply-input")).toHaveCount(1);
  await expect(firstCard.locator("[data-reply-actions]")).toBeHidden();
  await firstCard.getByTestId("comment-reply-input").focus();
  await expect(firstCard.locator("[data-reply-actions]")).toBeVisible();
  await expect(firstCard.locator("button[data-action='save-reply']")).toBeDisabled();
  await expect.poll(() => commentCardsDoNotOverlap(page)).toBe(true);

  await secondCard.locator("p").click();
  await expect(firstCard.getByTestId("comment-reply-input")).toHaveCount(0);
  await firstCard.locator("p").click();
  await firstCard.getByTestId("comment-reply-input").focus();
  await firstCard.getByTestId("comment-reply-input").fill("Unsaved reply");
  await expect(firstCard.locator("button[data-action='save-reply']")).toBeEnabled();
  await expect.poll(() => commentCardsDoNotOverlap(page)).toBe(true);
  const singleLineReplyHeight = await textareaHeight(firstCard.getByTestId("comment-reply-input"));
  await firstCard.getByTestId("comment-reply-input").fill("Line one\nLine two\nLine three");
  await expect
    .poll(() => textareaHeight(firstCard.getByTestId("comment-reply-input")))
    .toBeGreaterThan(singleLineReplyHeight + 20);
  await expect.poll(() => commentCardsDoNotOverlap(page)).toBe(true);
  await firstCard.getByTestId("comment-reply-input").fill("Short");
  await expect
    .poll(() => textareaHeight(firstCard.getByTestId("comment-reply-input")))
    .toBeLessThan(singleLineReplyHeight + 10);
  await expect.poll(() => commentCardsDoNotOverlap(page)).toBe(true);

  await secondCard.locator("p").click();
  await expect(firstCard.getByTestId("comment-reply-input")).toHaveValue("Short");
  await expect(secondCard.getByTestId("comment-reply-input")).toBeVisible();
  await expect(page.getByTestId("comment-reply-input")).toHaveCount(2);

  await firstCard.locator("button[data-action='cancel-reply']").click();
  await expect(firstCard.getByTestId("comment-reply-input")).toHaveCount(0);
  await expect(secondCard.getByTestId("comment-reply-input")).toBeVisible();
  await expect(page.getByTestId("comment-reply-input")).toHaveCount(1);

  await firstCard.locator("p").click();
  await expect(firstCard.getByTestId("comment-reply-input")).toBeVisible();
  await secondCard.locator("p").click();
  await expect(firstCard.getByTestId("comment-reply-input")).toHaveCount(0);
});

test("keeps an empty reply composer open when the same rendered comment is reactivated", async ({
  page,
}) => {
  await openExample(page);

  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      "First alpha[^range-prev-5-chars-101-0000]\n\n[^range-prev-5-chars-101-0000]: First note",
    );
  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-rendered").click();

  const card = page.getByTestId("comment-card").filter({ hasText: "First note" });
  await card.locator("p").click();
  await card.getByTestId("comment-reply-input").focus();
  await expect(card.locator("[data-reply-actions]")).toBeVisible();

  await page.getByTestId("rendered-editor").getByText("First alpha").click();

  await expect(card.getByTestId("comment-reply-input")).toBeVisible();
  await expect(card.locator("[data-reply-actions]")).toBeVisible();
});

test("comment cards do not show a standalone suggestion input", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill("Original block.\n\nAfter block.");
  await editor.evaluate((textarea) => {
    const input = textarea as HTMLTextAreaElement;
    input.setSelectionRange(0, 0);
  });
  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Please rewrite this block");

  await expect(page.getByTestId("block-suggestion-input")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save suggestion" })).toHaveCount(0);
  await expect(page.getByTestId("comment-card")).toContainText("Please rewrite this block");
});

test("review mode renders and edits suggestion content instead of the original block", async ({
  page,
}) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill(
    "Original block.[^suggest-block-100-a1b2]\n\nAfter block.\n\n[^suggest-block-100-a1b2]: Replacement block.",
  );

  await page.getByTestId("mode-review").click();
  await expect(page.locator(".local-md-review-suggestion")).toContainText("Replacement block.");
  await expect(page.locator(".local-md-review-suggestion")).not.toHaveCSS(
    "box-shadow",
    /rgb\(204, 99, 36\)/,
  );
  await setCaretInReviewSuggestion(page, 0);
  await expect(page.locator(".local-md-review-suggestion")).toHaveClass(
    /local-md-review-suggestion-active/,
  );
  await expect(page.locator(".local-md-review-suggestion")).toHaveCSS(
    "box-shadow",
    /rgb\(204, 99, 36\)/,
  );
  await expect(page.getByTestId("rendered-editor")).not.toContainText("Original block.");

  await page.locator("p.local-md-review-suggestion").fill("Edited replacement.");
  await page.getByTestId("mode-markdown").click();

  await expect(editor).toHaveValue(/Original block\.\[\^suggest-block-100-a1b2\]/);
  await expect(editor).toHaveValue(/\[\^suggest-block-100-a1b2\]: Edited replacement\./);
});

test("review mode preserves heading layout for heading suggestions", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      "Intro paragraph.\n\n## Original heading[^suggest-block-100-a1b2]\n\nNext paragraph.\n\n[^suggest-block-100-a1b2]: ## Suggested heading",
    );

  await page.getByTestId("mode-review").click();
  const heading = page.locator("h2.local-md-review-suggestion");
  await expect(heading).toContainText("Suggested heading");
  await expect.poll(() => headingSpacingIsCloseToNormal(page)).toBe(true);
});

test("review mode preserves paragraph spacing for adjacent paragraph suggestions", async ({
  page,
}) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        "First paragraph keeps its normal vertical rhythm.",
        "",
        "Second paragraph has a suggestion.[^suggest-block-100-a1b2]",
        "",
        "Third paragraph follows after the suggestion.",
        "",
        "[^suggest-block-100-a1b2]: Second paragraph has a better suggestion.",
      ].join("\n"),
    );

  await page.getByTestId("mode-rendered").click();
  const renderedGap = await paragraphGapAfterFirstParagraph(page);

  await page.getByTestId("mode-review").click();
  await expect(page.locator("p.local-md-review-suggestion")).toContainText("better suggestion");
  const reviewGap = await paragraphGapAfterFirstParagraph(page);

  expect(Math.abs(reviewGap - renderedGap)).toBeLessThanOrEqual(1);
});

test("rendered edits preserve suggestion footnotes without materializing footnote sections", async ({
  page,
}) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill(
    [
      "Markleft is a footnote-based annotation format for Markdown.[^suggest-block-11778-743d]",
      "",
      "[^suggest-block-11778-743d]: Markleft is a footnote-based annotation format for Markdown.s",
    ].join("\n"),
  );

  await page.getByTestId("mode-rendered").click();
  await page
    .locator("p")
    .first()
    .evaluate((paragraph) => {
      const text = paragraph.firstChild;
      if (!text || text.nodeType !== Node.TEXT_NODE)
        throw new Error("Expected paragraph text node");
      text.textContent =
        "Markleft is a footnote-based annotation format for Markdown with an edit.";
      paragraph.dispatchEvent(
        new InputEvent("input", { bubbles: true, inputType: "insertText", data: " with an edit" }),
      );
    });
  await page.getByTestId("mode-markdown").click();

  await expect(editor).toHaveValue(/Markdown with an edit\.\[\^suggest-block-11778-743d\]/);
  await expect(editor).toHaveValue(
    /\[\^suggest-block-11778-743d\]: Markleft is a footnote-based annotation format for Markdown\.s/,
  );
  await expect(editor).not.toHaveValue(/## Footnotes/);
  await expect(editor).not.toHaveValue(/\[1\]\(#user-content-fn-suggest-block-11778-743d\)/);
});

test("review mode shows low-noise text diffs for suggestion blocks", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill(
    "We choose to fly the Atlantic.[^suggest-block-100-a1b2]\n\n[^suggest-block-100-a1b2]: We choose to go to the Moon.",
  );

  await page.getByTestId("mode-review").click();
  await expect(page.locator(".local-md-review-suggestion")).toContainText(
    "We choose to go to the Moon.",
  );
  await expect.poll(() => hasHighlight(page, "local-md-diff-replace")).toBe(true);
  await expect(page.locator(".local-md-diff-marker")).toHaveAttribute(
    "data-original",
    "fly the Atlantic",
  );
  await expect(page.locator(".local-md-diff-tooltip")).toHaveCount(0);

  await page.getByTestId("mode-markdown").click();
  await expect(editor).toHaveValue(/\[\^suggest-block-100-a1b2\]: We choose to go to the Moon\./);
  await expect(editor).not.toHaveValue(/×/);
});

test("review mode highlights multiple text diffs in one suggestion block", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      "Alpha old one and beta old two.[^suggest-block-100-a1b2]\n\n[^suggest-block-100-a1b2]: Alpha new one and beta new two.",
    );

  await page.getByTestId("mode-review").click();
  await expect(page.locator(".local-md-review-suggestion")).toContainText(
    "Alpha new one and beta new two.",
  );
  await expect(page.locator(".local-md-diff-marker")).toHaveCount(2);
  await expect(page.locator(".local-md-diff-marker").first()).toHaveAttribute(
    "data-original",
    "old",
  );
  await expect(page.locator(".local-md-diff-marker").last()).toHaveAttribute(
    "data-original",
    "old",
  );
  await expect.poll(() => highlightRangeCount(page, "local-md-diff-replace")).toBe(2);
});

test("review mode treats list suggestions as whole list blocks", async ({ page }) => {
  await openExample(page);

  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        "1. First item's target in the document.",
        "2. A matching footnote definition contains content, reply, or proposed replacement.[^suggest-block-100-a1b2]",
        "",
        "[^suggest-block-100-a1b2]: 1. First item's target in the document.",
        "    2. A matching footnote definition contains tasdasdadent, reply, or proposed replacement.",
      ].join("\n"),
    );

  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-review").click();
  const suggestion = page.locator("ol.local-md-review-suggestion");
  await expect(suggestion).toContainText("tasdasdadent");
  await expect(suggestion.locator("li")).toHaveCount(2);
  await expect(page.locator(".local-md-diff-marker")).toHaveCount(1);
  await expect.poll(() => highlightRangeCount(page, "local-md-diff-replace")).toBe(1);
});

test("review mode highlights mixed insertions and replacements in one suggestion block", async ({
  page,
}) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        "But why, some say, the Moon? Why choose this as our goal? And they may well ask, why climb the highest mountain? Why, years ago, fly the Atlantic? We choose to go to the Moon.[^suggest-block-100-a1b2]",
        "",
        "[^suggest-block-100-a1b2]: But why, some say, go to the Moon? Why choose this as our goal? And they may well ask, why climb the highest mountain? Why, over 100 years ago, fly the Atlantic? We choose to go to the Moon.",
      ].join("\n"),
    );

  await page.getByTestId("mode-review").click();
  await expect(page.locator(".local-md-review-suggestion")).toContainText("go to the Moon");
  await expect.poll(() => highlightRangeCount(page, "local-md-diff-insert")).toBe(2);
});

test("review mode treats appended word characters as insertions", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      "This file is stable.[^suggest-block-100-a1b2]\n\n[^suggest-block-100-a1b2]: This filec is stable.",
    );

  await page.getByTestId("mode-review").click();
  await expect(page.locator(".local-md-review-suggestion")).toContainText("This filec is stable.");
  await expect(page.locator(".local-md-diff-marker")).toHaveCount(0);
  await expect.poll(() => highlightRangeCount(page, "local-md-diff-insert")).toBe(1);
});

test("review mode highlights insertions next to inline comment anchors", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        "This file is a self-rendering Markdown[^range-prev-8-chars-111-a1b2] document. It keeps the rest of the file.[^suggest-block-100-a1b2]",
        "",
        "[^range-prev-8-chars-111-a1b2]: Existing note",
        "",
        "[^suggest-block-100-a1b2]: This file is a self-rendering Markdown[^range-prev-8-chars-111-a1b2] c. document. It keeps the rest of the filec.",
      ].join("\n"),
    );

  await page.getByTestId("mode-review").click();
  await expect(page.locator(".local-md-review-suggestion")).toContainText("Markdown");
  await expect(page.locator(".local-md-review-suggestion")).toContainText("c. document");
  await expect(page.locator(".local-md-review-suggestion")).toContainText("filec");
  await expect(page.locator(".local-md-diff-marker")).toHaveCount(0);
  await expect.poll(() => highlightRangeCount(page, "local-md-diff-insert")).toBe(2);
});

test("review mode highlights repeated word edits without collapsing to unchanged text", async ({
  page,
}) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      "Orginal text with no changes[^suggest-block-100-a1b2]\n\n[^suggest-block-100-a1b2]: Orginal changed with another change changes",
    );

  await page.getByTestId("mode-review").click();
  await expect(page.locator(".local-md-review-suggestion")).toContainText(
    "Orginal changed with another change changes",
  );
  await expect(page.locator(".local-md-review-suggestion")).not.toContainText(
    "Orginal text with no changes",
  );
  await expect.poll(() => highlightRangeCount(page, "local-md-diff-replace")).toBe(2);
});

test("review mode refreshes visual diffs while typing inside a suggestion", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      "This file is stable.[^suggest-block-100-a1b2]\n\n[^suggest-block-100-a1b2]: This file is stable.",
    );

  await page.getByTestId("mode-review").click();
  await page
    .locator("p.local-md-review-suggestion, .local-md-review-suggestion p")
    .evaluate((paragraph) => {
      const text = paragraph.firstChild;
      if (!text) throw new Error("Expected suggestion text");
      const offset = text.textContent?.indexOf("file") ?? -1;
      if (offset === -1) throw new Error("Expected file text");
      const selection = document.getSelection();
      const range = document.createRange();
      range.setStart(text, offset + "file".length);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  await page.keyboard.type("c");

  await expect(page.locator(".local-md-review-suggestion")).toContainText("This filec is stable.");
  await expect(page.locator(".local-md-diff-marker")).toHaveCount(0);
  await expect.poll(() => highlightRangeCount(page, "local-md-diff-insert")).toBe(1);
});

test("review diff delete markers do not participate in caret movement", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill(
    "helloY world[^suggest-block-100-a1b2]\n\n[^suggest-block-100-a1b2]: helloX world",
  );

  await page.getByTestId("mode-review").click();
  await expect(page.locator(".local-md-diff-marker")).toHaveCount(1);
  await page
    .locator("p.local-md-review-suggestion, .local-md-review-suggestion p")
    .evaluate((paragraph) => {
      const text = paragraph.firstChild;
      if (!text) throw new Error("Expected suggestion text");
      const selection = document.getSelection();
      const range = document.createRange();
      range.setStart(text, "helloX".length);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    });

  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const selection = document.getSelection();
        return (
          selection?.anchorNode?.textContent?.slice(
            selection.anchorOffset,
            selection.anchorOffset + 1,
          ) ?? ""
        );
      }),
    )
    .toBe("w");

  await page.keyboard.press("Backspace");
  await expect(page.locator(".local-md-review-suggestion")).toContainText("helloXworld");
  await page.getByTestId("mode-markdown").click();
  await expect(editor).toHaveValue(/\[\^suggest-block-100-a1b2\]: helloXworld/);
});

test("review diff delete markers render after toggling modes", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill("helloY world[^suggest-block-100-a1b2]\n\n[^suggest-block-100-a1b2]: helloX world");

  await page.getByTestId("mode-review").click();
  await expect(page.locator(".local-md-diff-marker")).toHaveCount(1);
  await page.getByTestId("mode-rendered").click();
  await expect(page.locator(".local-md-diff-marker")).toHaveCount(0);
  await page.getByTestId("mode-review").click();
  await expect(page.locator(".local-md-diff-marker")).toHaveCount(1);
});

test("review mode shows all visual diffs by default", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        "Alpha old.[^suggest-block-100-a1b2]",
        "",
        "Beta old.[^suggest-block-200-b2c3]",
        "",
        "Gamma plain.",
        "",
        "[^suggest-block-100-a1b2]: Alpha new.",
        "",
        "[^suggest-block-200-b2c3]: Beta new.",
      ].join("\n"),
    );

  await page.getByTestId("mode-review").click();
  await expect(page.locator(".local-md-diff-marker")).toHaveCount(2);
});

test("review mode turns edits to original blocks into block suggestions", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill("Original block.\n\nAfter block.");

  await page.getByTestId("mode-review").click();
  await page.locator("p").filter({ hasText: "Original block." }).fill("Edited block.");

  await expect(page.locator(".local-md-review-suggestion")).toContainText("Edited block.");
  await page.getByTestId("mode-markdown").click();

  await expect(editor).toHaveValue(/Original block\.\[\^suggest-block-\d+-[0-9a-f]{4}\]/);
  await expect(editor).toHaveValue(/\[\^suggest-block-\d+-[0-9a-f]{4}\]: Edited block\./);
  await expect(editor).toHaveValue(/After block\./);
});

test("review mode keeps the caret when an original block becomes a suggestion", async ({
  page,
}) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill("Alpha beta.");

  await page.getByTestId("mode-review").click();
  await page
    .locator("p")
    .filter({ hasText: "Alpha beta." })
    .evaluate((paragraph) => {
      const text = paragraph.firstChild;
      if (!text) throw new Error("Expected paragraph text");
      const selection = document.getSelection();
      const range = document.createRange();
      range.setStart(text, "Alpha".length);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  await page.keyboard.type("XY");

  await expect(page.locator(".local-md-review-suggestion")).toContainText("AlphaXY beta.");
  await page.getByTestId("mode-markdown").click();
  await expect(editor).toHaveValue(/\[\^suggest-block-\d+-[0-9a-f]{4}\]: AlphaXY beta\./);
});

test("review mode keeps editing inside an existing suggestion without nesting suggestion refs", async ({
  page,
}) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill(
    "Original block.[^suggest-block-100-a1b2]\n\nAfter block.\n\n[^suggest-block-100-a1b2]: Suggested block.",
  );

  await page.getByTestId("mode-review").click();
  await page
    .locator("p.local-md-review-suggestion, .local-md-review-suggestion p")
    .evaluate((paragraph) => {
      const text = paragraph.firstChild;
      if (!text) throw new Error("Expected suggestion text");
      const selection = document.getSelection();
      const range = document.createRange();
      range.setStart(text, "Suggested".length);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  await page.keyboard.type(" better");
  await page.keyboard.type(" now");

  await expect(page.locator(".local-md-review-suggestion")).toContainText(
    "Suggested better now block.",
  );
  await expect(page.locator(".local-md-review-suggestion")).not.toContainText("[^suggest-block");
  await page.getByTestId("mode-markdown").click();
  await expect(editor).toHaveValue(/\[\^suggest-block-100-a1b2\]: Suggested better now block\./);
  await expect(editor).not.toHaveValue(/\[\^suggest-block-100-a1b2\]: .*suggest-block/);
});

test("review mode creates whole-list suggestions when editing a list item", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill("- Task lists\n- Markdown mode\n- Rendered editing");

  await page.getByTestId("mode-review").click();
  await page
    .locator("li")
    .first()
    .evaluate((item) => {
      const text = item.firstChild;
      if (!text) throw new Error("Expected list item text");
      const selection = document.getSelection();
      const range = document.createRange();
      range.setStart(text, 0);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  await page.keyboard.type("Changed ");

  await expect(page.locator("ul.local-md-review-suggestion")).toHaveCount(1);
  await expect(page.locator("ul.local-md-review-suggestion")).toContainText("Changed Task lists");
  await expect(page.locator("ul.local-md-review-suggestion > li")).toHaveCount(3);
  await page.getByTestId("mode-markdown").click();
  await expect(editor).toHaveValue(/- Rendered editing\[\^suggest-block-\d+-[0-9a-f]{4}\]/);
  await expect(editor).toHaveValue(/\[\^suggest-block-\d+-[0-9a-f]{4}\]: - Changed Task lists/);
  await expect(editor).toHaveValue(/    - Markdown mode/);
  await expect(editor).toHaveValue(/    - Rendered editing/);
});

test("review mode creates whole-table suggestions when editing a table cell", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill(
    [
      "| Feature   | Result    |",
      "| --------- | --------- |",
      "| Tables    | Supported |",
      "| Autolinks | <https://github.github.com/gfm/> |",
    ].join("\n"),
  );

  await page.getByTestId("mode-review").click();
  await page
    .locator("td")
    .filter({ hasText: "Supported" })
    .evaluate((cell) => {
      const text = cell.firstChild;
      if (!text) throw new Error("Expected cell text");
      const selection = document.getSelection();
      const range = document.createRange();
      range.setStart(text, "Supported".length);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      cell.dispatchEvent(
        new InputEvent("beforeinput", { bubbles: true, inputType: "insertText", data: " changed" }),
      );
      text.textContent = "Supported changed";
      cell.dispatchEvent(
        new InputEvent("input", { bubbles: true, inputType: "insertText", data: " changed" }),
      );
    });

  await expect(page.locator(".local-md-review-suggestion table")).toContainText(
    "Supported changed",
  );
  await page.getByTestId("mode-markdown").click();
  await expect(editor).toHaveValue(
    /\| Autolinks \| <https:\/\/github.github.com\/gfm\/> \|\n\n\[\^suggest-block-\d+-[0-9a-f]{4}\]/,
  );
  await expect(editor).toHaveValue(
    /\[\^suggest-block-\d+-[0-9a-f]{4}\]: \| Feature\s+\| Result\s+\|/,
  );
  await expect(editor).toHaveValue(/    \| Tables\s+\| Supported changed\s+\|/);
  await expect(editor).toHaveValue(/\| Autolinks \| <https:\/\/github.github.com\/gfm\/> \|/);
});

test("review mode restores the caret inside the edited table cell", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        "| Feature   | Result    |",
        "| --------- | --------- |",
        "| Tables    | Supported |",
        "| Autolinks | <https://github.github.com/gfm/> |",
      ].join("\n"),
    );

  await page.getByTestId("mode-review").click();
  await page
    .locator("td")
    .filter({ hasText: "Supported" })
    .evaluate((cell) => {
      const text = cell.firstChild;
      if (!text) throw new Error("Expected cell text");
      const selection = document.getSelection();
      const range = document.createRange();
      range.setStart(text, "Supported".length);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      cell.dispatchEvent(
        new InputEvent("beforeinput", { bubbles: true, inputType: "insertText", data: " changed" }),
      );
      text.textContent = "Supported changed";
      cell.dispatchEvent(
        new InputEvent("input", { bubbles: true, inputType: "insertText", data: " changed" }),
      );
    });

  await expect(page.locator(".local-md-review-suggestion table")).toContainText(
    "Supported changed",
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const selection = document.getSelection();
        const node = selection?.anchorNode;
        const cell = node?.parentElement?.closest("td,th");
        return cell?.textContent ?? "";
      }),
    )
    .toBe("Supported changed");
});

test("review mode creates blockquote suggestions that preserve quote markers", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill("> Switch modes, edit this document, and save it back.\n>\n> adasd\n\nAfter.");

  await page.getByTestId("mode-review").click();
  const originalQuoteLeft = await page
    .locator("blockquote")
    .evaluate((quote) => Math.round(quote.getBoundingClientRect().left));
  await page
    .locator("blockquote p")
    .first()
    .evaluate((paragraph) => {
      const text = paragraph.firstChild;
      if (!text) throw new Error("Expected quote text");
      const selection = document.getSelection();
      const range = document.createRange();
      range.setStart(text, paragraph.textContent?.length ?? 0);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  await page.keyboard.type(" CHANGED");

  await expect(page.locator("blockquote.local-md-review-suggestion")).toContainText("CHANGED");
  await expect
    .poll(() =>
      page
        .locator("blockquote.local-md-review-suggestion")
        .evaluate((quote) => Math.round(quote.getBoundingClientRect().left)),
    )
    .toBe(originalQuoteLeft);
  await page.getByTestId("mode-markdown").click();
  await expect(editor).toHaveValue(
    /> Switch modes, edit this document, and save it back\.\n>\n> adasd\[\^suggest-block-\d+-[0-9a-f]{4}\]/,
  );
  await expect(editor).toHaveValue(
    /\[\^suggest-block-\d+-[0-9a-f]{4}\]: > Switch modes, edit this document, and save it back\. CHANGED/,
  );
  await expect(editor).toHaveValue(/    > adasd/);
});

test("review mode creates a quote suggestion after an existing table suggestion", async ({
  page,
}) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill(
    [
      "| Feature   | Result    |",
      "| --------- | --------- |",
      "| Tables    | Supported |",
      "| Autolinks | <https://github.github.com/gfm/> |",
      "",
      "[^suggest-block-100-a1b2]",
      "",
      "> Switch modes, edit this document, and save it back.",
      ">",
      "> adasd",
      "",
      "[^suggest-block-100-a1b2]: | Feature   | Result    |",
      "    | --------- | --------- |",
      "    | Tables    | Supported changed |",
      "    | Autolinks | <https://github.github.com/gfm/> |",
    ].join("\n"),
  );

  await page.getByTestId("mode-review").click();
  await page
    .locator("blockquote:not(.local-md-review-suggestion) p")
    .first()
    .evaluate((paragraph) => {
      const text = paragraph.firstChild;
      if (!text) throw new Error("Expected quote text");
      const selection = document.getSelection();
      const range = document.createRange();
      range.setStart(text, paragraph.textContent?.indexOf("save") ?? 0);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  await page.keyboard.type("s");

  await expect(page.locator(".local-md-review-suggestion table")).toContainText(
    "Supported changed",
  );
  await expect(page.locator("blockquote.local-md-review-suggestion")).toContainText("ssave");
  await expect(page.locator("blockquote.local-md-review-suggestion")).toHaveCount(1);
  await page.getByTestId("mode-markdown").click();
  await expect(editor).toHaveValue(
    /\[\^suggest-block-\d+-[0-9a-f]{4}\]: > Switch modes, edit this document, and ssave it back\./,
  );
});

test("review mode creates fenced code suggestions without breaking the fence", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill('```js\nconsole.log("hello from a fenced code block");\n```\n\nAfter.');

  await page.getByTestId("mode-review").click();
  await page.locator("pre code").evaluate((code) => {
    const text = code.firstChild;
    if (!text) throw new Error("Expected code text");
    const selection = document.getSelection();
    const range = document.createRange();
    range.setStart(text, code.textContent?.length ?? 0);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.keyboard.type(" CHANGED");

  await expect(page.locator("pre.local-md-review-suggestion code")).toContainText("CHANGED");
  await expect(page.locator("pre.local-md-review-suggestion")).toHaveCSS(
    "background-color",
    "rgb(32, 37, 40)",
  );
  await expect(page.locator("pre.local-md-review-suggestion")).toHaveCSS("padding-top", "14px");
  await page.getByTestId("mode-markdown").click();
  await expect(editor).toHaveValue(
    /```js\nconsole\.log\("hello from a fenced code block"\);\n```\n\[\^suggest-block-\d+-[0-9a-f]{4}\]/,
  );
  await expect(editor).toHaveValue(
    /\[\^suggest-block-\d+-[0-9a-f]{4}\]: ```js\n    console\.log\("hello from a fenced code block"\); CHANGED\n    ```/,
  );
});

test("review mode creates update and deletion suggestions for multi-block replacements", async ({
  page,
}) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill("First block.\n\nSecond block.\n\nThird block.");

  await page.getByTestId("mode-review").click();
  await page
    .locator("p")
    .first()
    .evaluate((first) => {
      const second = first.nextElementSibling;
      if (!second) throw new Error("Expected a second block");
      const selection = document.getSelection();
      const range = document.createRange();
      range.setStart(first.firstChild ?? first, 0);
      range.setEnd(second.firstChild ?? second, second.textContent?.length ?? 0);
      selection?.removeAllRanges();
      selection?.addRange(range);
      first.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          inputType: "insertText",
          data: "Replacement block.",
        }),
      );
      first.textContent = "Replacement block.";
      second.remove();
      first.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: "Replacement block.",
        }),
      );
    });

  await expect(page.locator(".local-md-review-suggestion")).toHaveCount(2);
  await expect(page.locator(".local-md-review-suggestion").first()).toContainText(
    "Replacement block.",
  );
  await expect(page.locator(".local-md-review-empty-suggestion")).toHaveCount(1);
  await page.getByTestId("mode-markdown").click();

  await expect(editor).toHaveValue(/First block\.\[\^suggest-block-\d+-[0-9a-f]{4}\]/);
  await expect(editor).toHaveValue(/Second block\.\[\^suggest-block-\d+-[0-9a-f]{4}\]/);
  await expect(editor).toHaveValue(/\[\^suggest-block-\d+-[0-9a-f]{4}\]: Replacement block\./);
  await expect(editor).toHaveValue(/\[\^suggest-block-\d+-[0-9a-f]{4}\]:\s*(?:\n|$)/);
});

test("review mode suggestions after HTML comments target the following rendered block", async ({
  page,
}) => {
  await openExample(page);

  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill(
    "# Making NFS3 reactive\n\nBefore truncate.\n\n<!-- truncate -->\n\nThe topic outlined here is part of a bigger research.\n",
  );

  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-review").click();
  await expect(page.locator(".local-md-html-comment-block")).toBeVisible();
  await page.locator("p", { hasText: "The topic outlined" }).evaluate((paragraph) => {
    const text = paragraph.firstChild;
    if (!text) throw new Error("Expected paragraph text");
    const selection = document.getSelection();
    const range = document.createRange();
    range.setStart(text, paragraph.textContent?.length ?? 0);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.keyboard.type(" Updated.");

  await page.locator("[data-mode-trigger]").click();
  await page.getByTestId("mode-markdown").click();
  await expect(editor).toHaveValue(
    /<!-- truncate -->\n\nThe topic outlined here is part of a bigger research\.\[\^suggest-block-\d+-[0-9a-f]{4}\]/,
  );
  await expect(editor).toHaveValue(
    /\[\^suggest-block-\d+-[0-9a-f]{4}\]: The topic outlined here is part of a bigger research\. Updated\./,
  );
  await expect(editor).not.toHaveValue(/<!-- truncate -->\[\^suggest-block-/);
});

test("review mode adds comments inside suggestion footnote content", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill(
    "Original block.[^suggest-block-100-a1b2]\n\n[^suggest-block-100-a1b2]: Replacement block.",
  );

  await page.getByTestId("mode-review").click();
  await page
    .locator("p.local-md-review-suggestion, .local-md-review-suggestion p")
    .evaluate((paragraph) => {
      const text = paragraph.firstChild;
      if (!text) throw new Error("Expected suggestion text");
      const selection = document.getSelection();
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, "Replacement".length);
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  await page.getByTestId("add-comment").click();
  const discussion = page.getByTestId("suggestion-discussion-card");
  await discussion.getByTestId("comment-input").fill("Comment on suggested text");
  await discussion.locator("button[data-action='save-review-comment']").click();
  await expect(page.locator(".local-md-review-suggestion")).not.toContainText("[^range-prev");
  await expect(page.locator(".local-md-review-suggestion .local-md-comment-anchor")).toHaveCount(1);
  await page.getByTestId("mode-markdown").click();

  await expect(editor).toHaveValue(
    /\[\^suggest-block-100-a1b2\]: Replacement\[\^range-prev-11-chars-\d+-[0-9a-f]{4}\] block\./,
  );
  await expect(editor).toHaveValue(
    /\[\^range-prev-11-chars-\d+-[0-9a-f]{4}\]: Comment on suggested text/,
  );
});

test("review mode groups hidden block comments and suggestion comments in a discussion card", async ({
  page,
}) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill(
    [
      "Original text[^range-prev-8-chars-100-abcd].[^suggest-block-200-bbbb]",
      "",
      "[^range-prev-8-chars-100-abcd]: Fix original text [^suggest-block-200-bbbb]",
      "[^suggest-block-200-bbbb]: Suggested text[^range-prev-9-chars-300-cdef].",
      "",
      "[^range-prev-9-chars-300-cdef]: Note on suggestion",
    ].join("\n"),
  );

  await page.getByTestId("mode-review").click();

  await expect(page.getByTestId("comment-card")).toHaveCount(0);
  const discussion = page.getByTestId("suggestion-discussion-card");
  await expect(discussion).toHaveCount(1);
  await expect(discussion).toContainText("Should address");
  await expect(discussion).toContainText("Fix original text");
  await expect(discussion).toContainText("On suggestion");
  await expect(discussion).toContainText("Note on suggestion");
  await expect(discussion.locator(".local-md-review-comment-box")).toHaveCount(2);
  await expect(discussion.locator(".local-md-review-comment-box").first()).toContainText(
    "Fix original text",
  );
  await expect(page.locator(".local-md-review-suggestion .local-md-comment-anchor")).toHaveCount(1);

  await discussion.getByRole("button", { name: "Discard suggestion" }).click();
  await page.getByTestId("mode-markdown").click();
  await expect(editor).not.toHaveValue(/suggest-block-200-bbbb/);
  await expect(editor).toHaveValue(/Original text\[\^range-prev-8-chars-100-abcd\]\./);
});

test("review mode applies a suggestion from its discussion card", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill(
    "Original block.[^suggest-block-200-bbbb]\n\nAfter block.\n\n[^suggest-block-200-bbbb]: Suggested block.",
  );

  await page.getByTestId("mode-review").click();
  await page
    .getByTestId("suggestion-discussion-card")
    .getByRole("button", { name: "Apply suggestion" })
    .click();
  await page.getByTestId("mode-markdown").click();

  await expect(editor).toHaveValue(/^Suggested block\.\n\nAfter block\./);
  await expect(editor).not.toHaveValue(/suggest-block-200-bbbb|Original block/);
});

test("review mode keeps ordinary image notes below earlier suggestion cards", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        "Intro original.[^suggest-block-100-a1b2]",
        "",
        "![Diagram](local-md-logo.svg)[^image-5000-5000-200-b2c3]",
        "",
        "[^suggest-block-100-a1b2]: Intro replacement.",
        "",
        "[^image-5000-5000-200-b2c3]: Image note",
      ].join("\n"),
    );

  await page.getByTestId("mode-review").click();
  await expect(page.getByTestId("suggestion-discussion-card")).toBeVisible();
  await expect(page.getByTestId("comment-card").filter({ hasText: "Image note" })).toBeVisible();
  await expect.poll(() => suggestionCardIsAboveCommentCard(page, "Image note")).toBe(true);
});

test("review mode aligns the active suggestion discussion with its suggested block", async ({
  page,
}) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      [
        "First original.[^suggest-block-100-a1b2]",
        "",
        "Second original.[^suggest-block-200-b2c3]",
        "",
        "[^suggest-block-100-a1b2]: First replacement with a taller discussion card.",
        "",
        "[^suggest-block-200-b2c3]: Second replacement.",
      ].join("\n"),
    );

  await page.getByTestId("mode-review").click();
  await setCaretInReviewSuggestion(page, 1);
  await expect
    .poll(() => suggestionCardIsNearSuggestionBlock(page, "suggest-block-200-b2c3"))
    .toBe(true);
});

test("scrolls Markdown view to the selected comment anchor", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  const lines = Array.from({ length: 80 }, (_, index) => `Line ${index + 1}`);
  lines.push("Bottom anchor target.");
  await editor.fill(lines.join("\n"));
  await editor.evaluate((textarea) => {
    const input = textarea as HTMLTextAreaElement;
    const start = input.value.indexOf("Bottom anchor");
    input.setSelectionRange(start, start + "Bottom anchor".length);
  });
  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Bottom note");

  await editor.evaluate((textarea) => {
    const input = textarea as HTMLTextAreaElement;
    input.setSelectionRange(0, 0);
    input.dispatchEvent(new Event("select", { bubbles: true }));
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByTestId("comment-card").click();

  const state = await editor.evaluate((textarea) => {
    const input = textarea as HTMLTextAreaElement;
    return {
      scrollTop: input.scrollTop,
      selectedText: input.value.slice(input.selectionStart, input.selectionEnd),
      pageScrollY: window.scrollY,
    };
  });
  expect(state.scrollTop).toBe(0);
  expect(state.pageScrollY).toBeGreaterThan(0);
  expect(state.selectedText).toBe("Bottom anchor");
});

test("active overlapping comments paint above normal overlapping comments", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      "This file is a self-rend[^range-prev-3-chars-21684-6a8e]ering[^range-prev-9-chars-97464-ff7c] Markdown document.\n\n[^range-prev-3-chars-21684-6a8e]: First\n[^range-prev-9-chars-97464-ff7c]: Second\n",
    );
  await page.getByTestId("mode-rendered").click();
  await selectRenderedText(page, "ering", 0);
  await page.keyboard.press("ArrowRight");

  const priorities = await page.evaluate(() => ({
    active: CSS.highlights.get("local-md-comment-range-active")?.priority,
    current: CSS.highlights.get("local-md-comment-range-current")?.priority,
  }));
  expect(priorities.active).toBeGreaterThan(priorities.current ?? 0);
  await expect.poll(() => hasHighlight(page, "local-md-comment-range-active")).toBe(true);
});

test("adds a rendered range comment when the selection crosses an existing footnote anchor", async ({
  page,
}) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page.getByTestId("markdown-editor").fill("This renders the text.\n");
  const editor = page.getByTestId("markdown-editor");
  await editor.evaluate((textarea) => {
    const value = (textarea as HTMLTextAreaElement).value;
    const start = value.indexOf("render");
    (textarea as HTMLTextAreaElement).setSelectionRange(start, start + "render".length);
  });
  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Outer");
  await page.getByTestId("mode-rendered").click();
  await selectAcrossRenderedAnchor(page, "render", "s the");

  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Crosses anchor");

  await page.getByTestId("mode-markdown").click();
  const source = await page.getByTestId("markdown-editor").inputValue();
  expect(source).not.toMatch(/^\[\^block-/);
  expect(source).toMatch(
    /render\[\^range-prev-6-chars-\d+-[0-9a-f]{4}\]s the\[\^range-prev-10-chars-\d+-[0-9a-f]{4}\]/,
  );
});

test("adds collapsed rendered comments at the end of the current block", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill("# Title\n\nFirst paragraph.\n\nSecond paragraph.\n");
  await page.getByTestId("mode-rendered").click();
  await collapseCaretInRenderedText(page, "Second paragraph.");

  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Block note");

  await page.getByTestId("mode-markdown").click();
  await expect(page.getByTestId("markdown-editor")).toHaveValue(
    /^# Title\n\nFirst paragraph\.\n\nSecond paragraph\.\[\^block-\d+-[0-9a-f]{4}\]\n\n\[\^block-/,
  );
});

test("adds rendered range comments across table cell boundaries", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      "| Feature | Result |\n| --- | --- |\n| Tables | Supported |\n| Autolinks | <https://github.github.com/gfm/> |\n",
    );
  await page.getByTestId("mode-rendered").click();
  await selectAcrossTableCells(page, "Tables", 3, "Supported", 3);

  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Across cells");

  await page.getByTestId("mode-markdown").click();
  const source = await page.getByTestId("markdown-editor").inputValue();
  expect(source).not.toMatch(/\[\^block-/);
  expect(source).toMatch(/\| Tables \| Sup\[\^range-prev-6-chars-\d+-[0-9a-f]{4}\]ported \|/);
});

test("keeps table-cell comment references unescaped when editing rendered text after the anchor", async ({
  page,
}) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      "| Feature | Result |\n| --- | --- |\n| Tables | Supported [^range-prev-7-chars-31717-113d]dddlkmlk |\n\n[^range-prev-7-chars-31717-113d]: Existing\n",
    );
  await page.getByTestId("mode-rendered").click();
  await boldRenderedText(page, "ddl");
  await page.getByTestId("mode-markdown").click();

  await expect(page.getByTestId("markdown-editor")).toHaveValue(
    /\| Tables\s+\| Supported \[\^range-prev-7-chars-31717-113d\]d\*\*ddl\*\*kmlk\s+\|/,
  );
  await expect(page.getByTestId("markdown-editor")).not.toHaveValue(
    /\\\[\^range-prev-7-chars-31717-113d\]/,
  );
});

test("adds rendered range comments across blockquote paragraph boundaries", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  await page
    .getByTestId("markdown-editor")
    .fill(
      "> Switch modes, edit this document, and save it back into the same portable format.\n>\n> adasd\n",
    );
  await page.getByTestId("mode-rendered").click();
  await selectAcrossBlockquoteParagraphs(page, "ormat.", "adasd");

  await page.getByTestId("add-comment").click();
  await saveDraftComment(page, "Across quote");

  await page.getByTestId("mode-markdown").click();
  const source = await page.getByTestId("markdown-editor").inputValue();
  expect(source).not.toMatch(/\[\^block-/);
  expect(source).toMatch(/> adasd\[\^range-prev-11-chars-\d+-[0-9a-f]{4}\]/);
});

async function hasHighlight(page: Page, name: string): Promise<boolean> {
  return page.evaluate(
    (highlightName) =>
      CSS.highlights.has(highlightName) ||
      Array.from(CSS.highlights.keys()).some((name) => name.startsWith(`${highlightName}-`)),
    name,
  );
}

async function highlightRangeCount(page: Page, name: string): Promise<number> {
  return page.evaluate(
    (highlightName) =>
      Array.from(CSS.highlights.entries()).reduce(
        (count, [name, highlight]) =>
          name === highlightName || name.startsWith(`${highlightName}-`)
            ? count + Array.from(highlight).length
            : count,
        0,
      ),
    name,
  );
}

async function setCaretInReviewSuggestion(page: Page, index: number): Promise<void> {
  await page
    .locator(".local-md-review-suggestion")
    .nth(index)
    .evaluate((region) => {
      const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
      const text = walker.nextNode();
      if (!text) throw new Error("Expected suggestion text");
      const selection = document.getSelection();
      const range = document.createRange();
      range.setStart(text, 0);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
}

async function saveDraftComment(page: Page, text: string): Promise<void> {
  const card = page
    .getByTestId("comment-card")
    .filter({ has: page.getByTestId("comment-input") })
    .last();
  const input = card.getByTestId("comment-input");
  await expect(input).toBeVisible();
  await input.fill(text);
  await card.locator("button[data-action='save-comment']").click();
}

async function textareaHeight(input: Locator): Promise<number> {
  return input.evaluate((node) => (node as HTMLTextAreaElement).getBoundingClientRect().height);
}

async function headingSpacingIsCloseToNormal(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-testid='rendered-editor']");
    const suggested = root?.querySelector<HTMLElement>("h2.local-md-review-suggestion");
    if (!root || !suggested) return false;
    const normal = document.createElement("h2");
    normal.textContent = "Normal heading";
    normal.style.position = "absolute";
    normal.style.visibility = "hidden";
    root.append(normal);
    const suggestedStyle = getComputedStyle(suggested);
    const normalStyle = getComputedStyle(normal);
    const close =
      Math.abs(parseFloat(suggestedStyle.marginTop) - parseFloat(normalStyle.marginTop)) <= 1 &&
      Math.abs(parseFloat(suggestedStyle.marginBottom) - parseFloat(normalStyle.marginBottom)) <= 1;
    normal.remove();
    return close;
  });
}

async function paragraphGapAfterFirstParagraph(page: Page): Promise<number> {
  return page.evaluate(() => {
    const paragraphs = Array.from(
      document.querySelectorAll<HTMLElement>("[data-testid='rendered-editor'] p"),
    );
    const first = paragraphs[0];
    const second = paragraphs[1];
    if (!first || !second) throw new Error("Expected adjacent paragraphs");
    return second.getBoundingClientRect().top - first.getBoundingClientRect().bottom;
  });
}

async function commentCardsDoNotOverlap(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>("[data-testid='comment-card']"),
    );
    const rects = cards
      .map((card) => card.getBoundingClientRect())
      .sort((left, right) => left.top - right.top);
    return rects.every(
      (rect, index) => index === 0 || rect.top >= (rects[index - 1]?.bottom ?? 0) - 1,
    );
  });
}

async function suggestionCardIsAboveCommentCard(page: Page, text: string): Promise<boolean> {
  return page.evaluate((needle) => {
    const suggestion = document.querySelector<HTMLElement>(
      "[data-testid='suggestion-discussion-card']",
    );
    const comment = Array.from(
      document.querySelectorAll<HTMLElement>("[data-testid='comment-card']"),
    ).find((card) => card.textContent?.includes(needle));
    if (!suggestion || !comment) return false;
    return suggestion.getBoundingClientRect().top < comment.getBoundingClientRect().top;
  }, text);
}

async function commentCardIsAboveCommentCard(
  page: Page,
  upperText: string,
  lowerText: string,
): Promise<boolean> {
  return page.evaluate(
    ({ upperNeedle, lowerNeedle }) => {
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>("[data-testid='comment-card']"),
      );
      const upper = cards.find((card) => card.textContent?.includes(upperNeedle));
      const lower = cards.find((card) => card.textContent?.includes(lowerNeedle));
      if (!upper || !lower) return false;
      return upper.getBoundingClientRect().top < lower.getBoundingClientRect().top;
    },
    { upperNeedle: upperText, lowerNeedle: lowerText },
  );
}

async function imageCardIsNearMarker(page: Page, commentId: string): Promise<boolean> {
  return page.evaluate((id) => {
    const card = document.querySelector<HTMLElement>(
      `.local-md-comment-card[data-comment-id="${CSS.escape(id)}"]`,
    );
    const marker = document.querySelector<HTMLElement>(
      `.local-md-image-comment-anchor[data-comment-id="${CSS.escape(id)}"]`,
    );
    if (!card || !marker) return false;
    return Math.abs(card.getBoundingClientRect().top - marker.getBoundingClientRect().top) <= 8;
  }, commentId);
}

async function suggestionCardIsNearSuggestionBlock(
  page: Page,
  suggestionId: string,
): Promise<boolean> {
  return page.evaluate((id) => {
    const card = document.querySelector<HTMLElement>(
      `.local-md-suggestion-discussion-card[data-suggestion-id="${CSS.escape(id)}"]`,
    );
    const block = document.querySelector<HTMLElement>(
      `.local-md-review-suggestion[data-suggestion-id="${CSS.escape(id)}"]`,
    );
    if (!card || !block) return false;
    return Math.abs(card.getBoundingClientRect().top - block.getBoundingClientRect().top) <= 8;
  }, suggestionId);
}

async function activeCardIsNearAnchor(page: Page, id: string): Promise<boolean> {
  return page.evaluate((commentId) => {
    const card = document.querySelector<HTMLElement>(
      `.local-md-comment-card-active[data-comment-id="${CSS.escape(commentId)}"]`,
    );
    const anchor = document.querySelector<HTMLElement>(
      `.local-md-comment-anchor[data-comment-id="${CSS.escape(commentId)}"]`,
    );
    if (!card || !anchor) return false;
    return Math.abs(card.getBoundingClientRect().top - anchor.getBoundingClientRect().top) <= 8;
  }, id);
}

async function cardIsNearAnchor(page: Page, id: string): Promise<boolean> {
  return page.evaluate((commentId) => {
    const card = document.querySelector<HTMLElement>(
      `.local-md-comment-card[data-comment-id="${CSS.escape(commentId)}"]`,
    );
    const anchor = document.querySelector<HTMLElement>(
      `.local-md-comment-anchor[data-comment-id="${CSS.escape(commentId)}"]`,
    );
    if (!card || !anchor) return false;
    return Math.abs(card.getBoundingClientRect().top - anchor.getBoundingClientRect().top) <= 8;
  }, id);
}

async function cardAndAnchorTopsAreAboveViewport(page: Page, id: string): Promise<boolean> {
  return page.evaluate((commentId) => {
    const card = document.querySelector<HTMLElement>(
      `.local-md-comment-card[data-comment-id="${CSS.escape(commentId)}"]`,
    );
    const anchor = document.querySelector<HTMLElement>(
      `.local-md-comment-anchor[data-comment-id="${CSS.escape(commentId)}"]`,
    );
    if (!card || !anchor) return false;
    return card.getBoundingClientRect().top < 0 && anchor.getBoundingClientRect().top < 0;
  }, id);
}

async function cardAnchorTopDelta(page: Page, id: string): Promise<number> {
  return page.evaluate((commentId) => {
    const card = document.querySelector<HTMLElement>(
      `.local-md-comment-card[data-comment-id="${CSS.escape(commentId)}"]`,
    );
    const anchor = document.querySelector<HTMLElement>(
      `.local-md-comment-anchor[data-comment-id="${CSS.escape(commentId)}"]`,
    );
    if (!card || !anchor) return Number.NaN;
    return card.getBoundingClientRect().top - anchor.getBoundingClientRect().top;
  }, id);
}

async function cardsBeforeActiveCanMoveAboveColumn(page: Page, id: string): Promise<boolean> {
  return page.evaluate((commentId) => {
    const activeCard = document.querySelector<HTMLElement>(
      `.local-md-comment-card-active[data-comment-id="${CSS.escape(commentId)}"]`,
    );
    const column = document.querySelector<HTMLElement>("[data-testid='comments-column']");
    if (!activeCard || !column) return false;
    const activeTop = activeCard.getBoundingClientRect().top;
    const columnTop = column.getBoundingClientRect().top;
    return Array.from(document.querySelectorAll<HTMLElement>("[data-testid='comment-card']")).some(
      (card) => {
        const rect = card.getBoundingClientRect();
        return rect.top < activeTop && rect.top < columnTop;
      },
    );
  }, id);
}

async function orderedCardTops(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-testid='comment-card']"))
      .map((card) => ({
        text: card.textContent ?? "",
        top: card.getBoundingClientRect().top,
      }))
      .sort((left, right) => left.top - right.top)
      .map((item) => {
        if (item.text.includes("First note")) return "First note";
        if (item.text.includes("Second note")) return "Second note";
        if (item.text.includes("Third note")) return "Third note";
        return "unknown";
      }),
  );
}

async function selectionToolbarIsAtSelectionFocusLine(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const toolbar = document.querySelector<HTMLElement>("[data-testid='selection-toolbar']");
    const documentPane = document.querySelector<HTMLElement>(".local-md-document-pane");
    const selection = document.getSelection();
    if (!toolbar || !documentPane || !selection || selection.rangeCount === 0) return false;

    const focusRect = boundaryLineRect(selection.focusNode, selection.focusOffset);
    if (!focusRect) return false;

    const toolbarRect = toolbar.getBoundingClientRect();
    const documentRect = documentPane.getBoundingClientRect();
    const toolbarCenterY = toolbarRect.top + toolbarRect.height / 2;
    const selectionLineCenterY = focusRect.top + focusRect.height / 2;
    const toolbarCenterX = toolbarRect.left + toolbarRect.width / 2;
    return (
      Math.abs(toolbarCenterY - selectionLineCenterY) <= 2 &&
      Math.abs(toolbarCenterX - (documentRect.right + 8)) <= 2
    );

    function boundaryLineRect(node: Node | null, offset: number): DOMRect | null {
      if (!node) return null;
      const collapsed = document.createRange();
      try {
        collapsed.setStart(node, offset);
        collapsed.collapse(true);
      } catch {
        return null;
      }
      const collapsedRect = firstVisibleRect(collapsed);
      if (collapsedRect) return collapsedRect;

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node as Text;
        const start = Math.max(0, Math.min(offset - 1, text.data.length - 1));
        const end = Math.min(text.data.length, Math.max(offset, start + 1));
        if (start < end) {
          const textRange = document.createRange();
          textRange.setStart(text, start);
          textRange.setEnd(text, end);
          return firstVisibleRect(textRange);
        }
      }

      const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
      const child =
        element?.childNodes[Math.min(offset, Math.max(0, element.childNodes.length - 1))] ?? null;
      if (!child) return null;
      const childRange = document.createRange();
      childRange.selectNode(child);
      return firstVisibleRect(childRange);
    }

    function firstVisibleRect(range: Range): DOMRect | null {
      return (
        Array.from(range.getClientRects()).find((rect) => rect.width > 0 || rect.height > 0) ?? null
      );
    }
  });
}

async function highlightTexts(page: Page, name: string): Promise<string[]> {
  return page.evaluate((highlightName) => {
    const highlight = CSS.highlights.get(highlightName);
    return highlight
      ? Array.from(highlight, (range) => (range instanceof Range ? range.toString() : ""))
      : [];
  }, name);
}

async function selectAcrossBlockquoteParagraphs(page: Page, startText: string, endText: string) {
  await page.evaluate(
    ({ startText: selectedStartText, endText: selectedEndText }) => {
      const root = document.querySelector<HTMLElement>("[data-testid='rendered-editor']");
      if (!root) throw new Error("Rendered editor not found");
      const paragraphs = Array.from(root.querySelectorAll("blockquote p"));
      const startNode = paragraphs[0]?.firstChild;
      const endNode = paragraphs[1]?.firstChild;
      if (
        !startNode ||
        !endNode ||
        startNode.nodeType !== Node.TEXT_NODE ||
        endNode.nodeType !== Node.TEXT_NODE
      ) {
        throw new Error("Expected blockquote paragraph text nodes");
      }
      const startTextNode = startNode as Text;
      const endTextNode = endNode as Text;
      const start = startTextNode.data.indexOf(selectedStartText);
      const end = endTextNode.data.indexOf(selectedEndText);
      if (start === -1 || end === -1) throw new Error("Selection text not found");

      const range = document.createRange();
      range.setStart(startTextNode, start);
      range.setEnd(endTextNode, end + selectedEndText.length);
      const selection = document.getSelection();
      root.focus();
      selection?.removeAllRanges();
      selection?.addRange(range);
    },
    { startText, endText },
  );
}

async function boldRenderedText(page: Page, text: string) {
  await page.evaluate((selectedText) => {
    const root = document.querySelector<HTMLElement>("[data-testid='rendered-editor']");
    if (!root) throw new Error("Rendered editor not found");
    root.focus();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    while (node) {
      const offset = node.data.indexOf(selectedText);
      if (offset !== -1) {
        const range = document.createRange();
        range.setStart(node, offset);
        range.setEnd(node, offset + selectedText.length);
        const selection = document.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand("bold");
        root.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "formatBold" }));
        return;
      }
      node = walker.nextNode() as Text | null;
    }
    throw new Error(`Text not found: ${selectedText}`);
  }, text);
}

async function selectAcrossTableCells(
  page: Page,
  startCellText: string,
  startBackLength: number,
  endCellText: string,
  endLength: number,
) {
  await page.evaluate(
    ({ startCellText, startBackLength, endCellText, endLength }) => {
      const root = document.querySelector<HTMLElement>("[data-testid='rendered-editor']");
      if (!root) throw new Error("Rendered editor not found");
      const cells = Array.from(root.querySelectorAll<HTMLTableCellElement>("td,th"));
      const startCell = cells.find((cell) => cell.textContent === startCellText);
      const endCell = cells.find((cell) => cell.textContent === endCellText);
      const startNode = startCell?.firstChild;
      const endNode = endCell?.firstChild;
      if (
        !startNode ||
        !endNode ||
        startNode.nodeType !== Node.TEXT_NODE ||
        endNode.nodeType !== Node.TEXT_NODE
      ) {
        throw new Error("Expected text cells");
      }
      const startText = startNode as Text;
      const endText = endNode as Text;
      const range = document.createRange();
      range.setStart(startText, startText.data.length - startBackLength);
      range.setEnd(endText, endLength);
      const selection = document.getSelection();
      root.focus();
      selection?.removeAllRanges();
      selection?.addRange(range);
    },
    { startCellText, startBackLength, endCellText, endLength },
  );
}

async function collapseCaretInRenderedText(page: Page, text: string) {
  await page.evaluate((selectedText) => {
    const root = document.querySelector<HTMLElement>("[data-testid='rendered-editor']");
    if (!root) throw new Error("Rendered editor not found");
    root.focus();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    while (node) {
      const offset = node.data.indexOf(selectedText);
      if (offset !== -1) {
        const range = document.createRange();
        range.setStart(node, offset + selectedText.length);
        range.collapse(true);
        const selection = document.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        return;
      }
      node = walker.nextNode() as Text | null;
    }
    throw new Error(`Text not found: ${selectedText}`);
  }, text);
}

async function selectAcrossRenderedAnchor(page: Page, startText: string, endText: string) {
  await page.evaluate(
    ({ startText: selectedStartText, endText: selectedEndText }) => {
      const root = document.querySelector<HTMLElement>("[data-testid='rendered-editor']");
      if (!root) throw new Error("Rendered editor not found");
      const anchor = root.querySelector<HTMLElement>(".local-md-comment-anchor");
      if (!anchor) throw new Error("Comment anchor not found");
      const rootElement = root;
      const anchorElement = anchor;

      const before = previousTextNode();
      const after = nextTextNode();
      if (!before || !after) throw new Error("Anchor-adjacent text nodes not found");

      const start = before.data.indexOf(selectedStartText);
      const end = after.data.indexOf(selectedEndText);
      if (start === -1 || end === -1) throw new Error("Selection text not found");

      const range = document.createRange();
      range.setStart(before, start);
      range.setEnd(after, end + selectedEndText.length);
      const selection = document.getSelection();
      rootElement.focus();
      selection?.removeAllRanges();
      selection?.addRange(range);

      function previousTextNode(): Text | null {
        const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
        let previous: Text | null = null;
        let current = walker.nextNode() as Text | null;
        while (current) {
          if (anchorElement.contains(current)) return previous;
          previous = current;
          current = walker.nextNode() as Text | null;
        }
        return previous;
      }

      function nextTextNode(): Text | null {
        const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
        let seenAnchor = false;
        let current = walker.nextNode() as Text | null;
        while (current) {
          if (anchorElement.contains(current)) seenAnchor = true;
          else if (seenAnchor) return current;
          current = walker.nextNode() as Text | null;
        }
        return null;
      }
    },
    { startText, endText },
  );
}

async function selectRenderedText(page: Page, text: string, occurrenceIndex: number) {
  await page.evaluate(
    ({ text: selectedText, occurrenceIndex: selectedOccurrenceIndex }) => {
      const root = document.querySelector<HTMLElement>("[data-testid='rendered-editor']");
      if (!root) throw new Error("Rendered editor not found");
      root.focus();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let occurrence = 0;
      let node = walker.nextNode() as Text | null;
      while (node) {
        const start = node.data.indexOf(selectedText);
        if (start !== -1 && occurrence === selectedOccurrenceIndex) {
          const range = document.createRange();
          range.setStart(node, start);
          range.setEnd(node, start + selectedText.length);
          const selection = document.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          return;
        }
        if (start !== -1) occurrence += 1;
        node = walker.nextNode() as Text | null;
      }

      const fullText = root.textContent ?? "";
      const globalStart = nthIndexOf(fullText, selectedText, selectedOccurrenceIndex);
      if (globalStart === -1) throw new Error(`Text not found: ${selectedText}`);
      const range = document.createRange();
      setRangePoint(root, range, globalStart, true);
      setRangePoint(root, range, globalStart + selectedText.length, false);
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      function nthIndexOf(source: string, search: string, occurrenceToFind: number): number {
        let from = 0;
        for (let count = 0; ; count += 1) {
          const found = source.indexOf(search, from);
          if (found === -1) return -1;
          if (count === occurrenceToFind) return found;
          from = found + search.length;
        }
      }

      function setRangePoint(
        rootElement: HTMLElement,
        rangeToSet: Range,
        offset: number,
        startPoint: boolean,
      ): void {
        const textWalker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
        let current = 0;
        let textNode = textWalker.nextNode() as Text | null;
        while (textNode) {
          const next = current + textNode.data.length;
          if (offset <= next) {
            if (startPoint) rangeToSet.setStart(textNode, offset - current);
            else rangeToSet.setEnd(textNode, offset - current);
            return;
          }
          current = next;
          textNode = textWalker.nextNode() as Text | null;
        }
      }
    },
    { text, occurrenceIndex },
  );
}

async function selectRenderedTextBackward(page: Page, startText: string, endText: string) {
  await page.evaluate(
    ({ startText: selectedStartText, endText: selectedEndText }) => {
      const root = document.querySelector<HTMLElement>("[data-testid='rendered-editor']");
      if (!root) throw new Error("Rendered editor not found");
      root.focus();

      const startPoint = findTextPoint(root, selectedStartText, "start");
      const endPoint = findTextPoint(root, selectedEndText, "end");
      if (!startPoint || !endPoint) throw new Error("Selection text not found");

      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.setBaseAndExtent(
        endPoint.node,
        endPoint.offset,
        startPoint.node,
        startPoint.offset,
      );
      document.dispatchEvent(new Event("selectionchange"));

      function findTextPoint(
        rootElement: HTMLElement,
        text: string,
        edge: "start" | "end",
      ): { node: Text; offset: number } | null {
        const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode() as Text | null;
        while (node) {
          const offset = node.data.indexOf(text);
          if (offset !== -1) {
            return { node, offset: edge === "start" ? offset : offset + text.length };
          }
          node = walker.nextNode() as Text | null;
        }
        return null;
      }
    },
    { startText, endText },
  );
}
