// @vitest-environment jsdom

import { loadMarkdown } from "../src/file/load";

test("loads Markdown from the example bootstrap textarea", () => {
  document.body.innerHTML = `<textarea data-testid="bootstrap-source">
# Example
`;

  expect(loadMarkdown(document)).toBe("# Example\n");
});

test("loads Markdown from the serialized plain textarea", () => {
  document.body.innerHTML = `<textarea>
# Saved
`;

  expect(loadMarkdown(document)).toBe("# Saved\n");
});

test("loads frontmatter from the HTML prelude before the loader script", () => {
  document.body.innerHTML = `---
title: Saved
---

<script src="local-md.js"></script><textarea>
# Saved
`;

  expect(loadMarkdown(document)).toBe(`---
title: Saved
---

# Saved
`);
});

test("does not confuse the runtime editor for the bootstrap textarea", () => {
  document.body.innerHTML = `
    <main>
      <textarea data-testid="markdown-editor">Runtime</textarea>
    </main>
  `;

  expect(loadMarkdown(document)).toBe("");
});
