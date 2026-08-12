import { readFile } from "node:fs/promises";

import { markdownToHtml } from "../src/markdown/to-html";

test("renders common Markdown blocks and inline formatting", async () => {
  const html = await markdownToHtml(`# Hello

This is *emphasis* and **strong** with [a link](https://example.com).

\`\`\`js
console.log("ok");
\`\`\`

- One
- Two

1. First
2. Second

> Quote
`);

  expect(html).toContain("<h1>Hello</h1>");
  expect(html).toContain("<em>emphasis</em>");
  expect(html).toContain("<strong>strong</strong>");
  expect(html).toContain('<a href="https://example.com">a link</a>');
  expect(html).toContain('class="language-js"');
  expect(html).toContain('console.log("ok");');
  expect(html).toContain("<ul>");
  expect(html).toContain("<ol>");
  expect(html).toContain("<blockquote>");
});

test("renders GitHub-flavored Markdown", async () => {
  const markdown = await readFile("test/fixtures/gfm.md", "utf8");
  const html = await markdownToHtml(markdown);

  expect(html).toContain('<input type="checkbox" checked disabled>');
  expect(html).toContain("<table>");
  expect(html).toContain("<del>Removed</del>");
  expect(html).toContain('<a href="https://github.github.com/gfm/">https://github.github.com/gfm/</a>');
});
