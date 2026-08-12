import { expect, test } from "@playwright/test";

import { openExample } from "./helpers";

test("undoes and redoes throttled Markdown typing", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill("Base");
  await page.waitForTimeout(750);
  await editor.focus();
  await page.keyboard.type(" plus");
  await page.waitForTimeout(750);

  await page.keyboard.press("Meta+Z");
  await expect(editor).toHaveValue("Base");

  await page.keyboard.press("Meta+Y");
  await expect(editor).toHaveValue("Base plus");

  await page.keyboard.press("Meta+Z");
  await expect(editor).toHaveValue("Base");

  await page.keyboard.press("Meta+Shift+Z");
  await expect(editor).toHaveValue("Base plus");
});

test("treats layout-mapped Cmd+Z as undo even when the physical code is KeyY", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill("Base");
  await page.waitForTimeout(750);
  await editor.fill("Base plus");
  await page.waitForTimeout(750);

  await editor.evaluate((textarea) => {
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "z",
        code: "KeyY",
        metaKey: true,
      }),
    );
  });

  await expect(editor).toHaveValue("Base");
});

test("handles browser history beforeinput events", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill("Before");
  await page.waitForTimeout(750);
  await editor.fill("After");
  await page.waitForTimeout(750);

  await editor.evaluate((textarea) => {
    textarea.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "historyUndo" }));
  });
  await expect(editor).toHaveValue("Before");

  await editor.evaluate((textarea) => {
    textarea.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "historyRedo" }));
  });
  await expect(editor).toHaveValue("After");
});

test("undoes and redoes saved comments as Markdown snapshots", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("mode-markdown").click();
  const editor = page.getByTestId("markdown-editor");
  await editor.fill("Comment target.");
  await page.waitForTimeout(750);
  await editor.evaluate((textarea) => {
    const input = textarea as HTMLTextAreaElement;
    const start = input.value.indexOf("target");
    input.setSelectionRange(start, start + "target".length);
  });

  await page.getByTestId("add-comment").click();
  await page.getByTestId("comment-input").fill("Undoable note");
  await page.locator("button[data-action='save-comment']").click();
  await expect(editor).toHaveValue(/\[\^range-prev-\d+-chars-\d+-[0-9a-f]{4}\]/);

  await page.keyboard.press("Meta+Z");
  await expect(editor).toHaveValue("Comment target.");

  await page.keyboard.press("Meta+Y");
  await expect(editor).toHaveValue(/\[\^range-prev-\d+-chars-\d+-[0-9a-f]{4}\]: Undoable note/);
});
