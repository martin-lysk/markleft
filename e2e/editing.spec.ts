import { expect, test } from "@playwright/test";

import { openExample } from "./helpers";

declare global {
  interface Window {
    __pasteRan?: boolean;
  }
}

test("sanitizes pasted executable and styling content", async ({ page }) => {
  await openExample(page);

  await page.getByTestId("rendered-editor").evaluate((element) => {
    element.innerHTML = `
      <p><strong>Allowed</strong><script>window.__pasteRan = true</script></p>
      <img alt="unsafe image" onerror="window.__pasteRan = true">
      <iframe src="https://example.com"></iframe>
      <span style="color:red">Styled</span>
    `;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));
  });

  await page.getByTestId("mode-markdown").click();
  const source = await page.getByTestId("markdown-editor").inputValue();
  const scriptRan = await page.evaluate(() => Boolean(window.__pasteRan));

  expect(scriptRan).toBe(false);
  expect(source).toContain("**Allowed**");
  expect(source).toContain("Styled");
  expect(source).not.toMatch(/script|iframe|onerror|style=/i);
});
