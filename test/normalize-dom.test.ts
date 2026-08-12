// @vitest-environment jsdom

import { normalizeElement, normalizedFragmentHtml } from "../src/editor/normalize-dom";

test("normalizes browser-created editable paragraph fragments", () => {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = "Hello<div>world</div><br><br>";

  normalizeElement(wrapper);

  expect(wrapper.innerHTML).toBe("Helloworld<br>");
});

test("removes styling, event handlers, wrappers, and transient markers", () => {
  expect(
    normalizedFragmentHtml(`
      <div data-local-md-wrapper="true">toolbar</div>
      <p style="color:red" onclick="bad()">Text<span data-caret-marker="true"></span></p>
    `),
  ).toBe("<p>Text</p>");
});

test("preserves semantic elements and removes unsafe pasted content", () => {
  expect(
    normalizedFragmentHtml(`
      <p><strong>Allowed</strong><script>bad()</script><iframe src="x"></iframe></p>
      <img src="x.png" alt="x" onerror="bad()">
    `),
  ).toBe('<p><strong>Allowed</strong></p> <img src="x.png" alt="x">');
});
