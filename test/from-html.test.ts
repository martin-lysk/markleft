import { readFile } from "node:fs/promises";

import { htmlToMarkdown } from "../src/markdown/from-html";
import { markdownToHtml } from "../src/markdown/to-html";

function compact(html: string): string {
  return html.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
}

test("converts semantic HTML to normalized Markdown", async () => {
  await expect(htmlToMarkdown("<h1>Hello</h1><p><strong>Hello</strong></p>")).resolves.toBe(
    "# Hello\n\n**Hello**\n",
  );
  await expect(htmlToMarkdown("<p><em>A</em> and <strong>B</strong></p>")).resolves.toBe(
    "*A* and **B**\n",
  );
  await expect(htmlToMarkdown('<a href="https://example.com">Example</a>')).resolves.toBe(
    "[Example](https://example.com)\n",
  );
});

test("converts lists, code, quotes, tables, and tasks", async () => {
  const markdown = await htmlToMarkdown(`
    <ul><li>One</li></ul>
    <ol><li>First</li></ol>
    <pre><code class="language-ts">const x = 1;</code></pre>
    <blockquote><p>Quote</p></blockquote>
    <table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table>
    <ul><li><input type="checkbox" checked disabled> Done</li></ul>
  `);

  expect(markdown).toContain("- One");
  expect(markdown).toContain("1. First");
  expect(markdown).toContain("```ts");
  expect(markdown).toContain("> Quote");
  expect(markdown).toContain("| A |");
  expect(markdown).toContain("- [x] Done");
});

test("round trips inline code inside a single-cell GFM table", async () => {
  const source = "| Value |\n| --- |\n| `test` |\n";

  const html = await markdownToHtml(source);
  expect(html).toContain("<table>");
  expect(html).toContain("<code>test</code>");

  const roundTripped = await htmlToMarkdown(html);
  expect(roundTripped).toContain("| `test` |");
  await expect(markdownToHtml(roundTripped)).resolves.toContain("<code>test</code>");
});

test("removes editor-only wrappers and attributes", async () => {
  const markdown = await htmlToMarkdown(`
    <div data-local-md-wrapper="true">Toolbar</div>
    <p data-testid="rendered-editor" style="color:red" onclick="bad()">Safe</p>
    <script>bad()</script>
  `);

  expect(markdown).toBe("Safe\n");
});

test("semantic round trip preserves rendered meaning", async () => {
  const original = "# Title\n\n- [x] Done\n\nA **bold** [link](https://example.com).\n";
  const html = await markdownToHtml(original);
  const normalizedMarkdown = await htmlToMarkdown(html);
  const nextHtml = await markdownToHtml(normalizedMarkdown);

  expect(compact(nextHtml)).toBe(compact(html));
});

test("renders HTML comments as visible protected blocks and preserves them on round trip", async () => {
  const original = "# Title\n\nIntro text.\n\n<!-- truncate -->\n\nAfter text.\n";
  const html = await markdownToHtml(original);

  expect(html).toContain('class="local-md-html-comment-block"');
  expect(html).toContain("&lt;!-- truncate --&gt;");
  await expect(htmlToMarkdown(html)).resolves.toBe(original);
});

test("preserves a raw HTML table as HTML instead of converting it to a Markdown table", async () => {
  const original = "<table><td>you</td></table>";
  const html = await markdownToHtml(original);

  expect(html).toContain('data-local-md-raw-html="');
  expect(html).toContain("<td>you</td>");
  await expect(htmlToMarkdown(html)).resolves.toBe(`${original}\n`);
});

test("preserves a raw HTML table containing Markdown across parser node boundaries", async () => {
  const original = await readFile("test/fixtures/raw-html-markdown-table.md", "utf8");
  const html = await markdownToHtml(original);

  expect(html).toContain('data-local-md-raw-html="');
  expect(html).toContain("<pre><code>### A Poor Pelican");
  expect(html).toContain("<h3>A Poor Pelican</h3>");
  expect(html).toContain('src="./pelican-on-a-bycicle-v1.svg"');
  await expect(htmlToMarkdown(html)).resolves.toBe(original);
});
