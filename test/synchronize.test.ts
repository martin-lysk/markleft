// @vitest-environment jsdom

import { readFile } from "node:fs/promises";

import { markdownToHtml } from "../src/markdown/to-html";
import { syncRenderedToMarkdown, type SyncState } from "../src/editor/synchronize";
import { stampBlocks } from "../src/editor/blocks";
import { documentBlockIds, stripDocumentBlockIds } from "../src/roundtrip/block-ids";

test("rendered sync preserves suggestion refs and definitions without rendered footnote sections", async () => {
  const body = [
    "Markleft is a footnote-based annotation format for Markdown.[^suggest-block-11778-743d]",
    "",
    "[^suggest-block-11778-743d]: Markleft is a footnote-based annotation format for Markdown.s",
  ].join("\n");
  const rendered = document.createElement("article");
  rendered.innerHTML = await markdownToHtml(body);
  const paragraph = rendered.querySelector("p");
  if (!paragraph) throw new Error("Expected paragraph");
  paragraph.firstChild?.replaceWith(
    "Markleft is a footnote-based annotation format for Markdown with an edit.",
  );

  const state: SyncState = { markdown: body, body, frontmatter: "", dirty: false, syncCount: 0 };
  await syncRenderedToMarkdown(rendered, state);

  expect(state.body).toContain("Markdown with an edit.[^suggest-block-11778-743d]");
  expect(state.body).toContain(
    "[^suggest-block-11778-743d]: Markleft is a footnote-based annotation format for Markdown.s",
  );
  expect(state.body).not.toContain("## Footnotes");
  expect(state.body).not.toContain("[1](#user-content-fn-suggest-block-11778-743d)");
});

test("rendered sync preserves ordinary footnote refs and definitions", async () => {
  const body = [
    "Regular footnote text.[^ordinary-note]",
    "",
    "[^ordinary-note]: Ordinary note body",
  ].join("\n");
  const rendered = document.createElement("article");
  rendered.innerHTML = await markdownToHtml(body);
  const paragraph = rendered.querySelector("p");
  if (!paragraph) throw new Error("Expected paragraph");
  paragraph.firstChild?.replaceWith("Edited regular footnote text.");

  const state: SyncState = { markdown: body, body, frontmatter: "", dirty: false, syncCount: 0 };
  await syncRenderedToMarkdown(rendered, state);

  expect(state.body).toContain("Edited regular footnote text.[^ordinary-note]");
  expect(state.body).toContain("[^ordinary-note]: Ordinary note body");
  expect(state.body).not.toContain("## Footnotes");
});

test("rendered sync preserves HTML comments without escaping them", async () => {
  const body = "Before.\n\n<!-- truncate -->\n\nAfter.";
  const rendered = document.createElement("article");
  rendered.innerHTML = await markdownToHtml(body);
  const state: SyncState = { markdown: body, body, frontmatter: "", dirty: false, syncCount: 0 };

  await syncRenderedToMarkdown(rendered, state);

  expect(state.body).toBe(`${body}\n`);
  expect(state.body).not.toContain("\\<!-- truncate -->");
});

test("rendered sync preserves persistent ids and excludes footnote bodies", async () => {
  const body = [
    '<!-- markleft:block id="btitle" -->',
    "# Title",
    "",
    '<!-- markleft:block id="bparagraph" -->',
    "Paragraph.[^block-100-abcd]",
    "",
    "[^block-100-abcd]: Comment body.",
  ].join("\n");
  const rendered = document.createElement("article");
  rendered.innerHTML = await markdownToHtml(stripDocumentBlockIds(body));
  stampBlocks(rendered, documentBlockIds(body));
  const paragraph = rendered.querySelector<HTMLElement>("[data-block-id='bparagraph']");
  if (!paragraph) throw new Error("Expected identified paragraph");
  paragraph.firstChild?.replaceWith("Edited paragraph.");

  const state: SyncState = {
    markdown: body,
    body,
    frontmatter: "",
    dirty: false,
    syncCount: 0,
    includeBlockIds: true,
  };
  await syncRenderedToMarkdown(rendered, state);

  expect(state.body).toContain('<!-- markleft:block id="btitle" -->\n# Title');
  expect(state.body).toContain('<!-- markleft:block id="bparagraph" -->\nEdited paragraph.');
  expect(state.body?.match(/markleft:block/g)).toHaveLength(2);
  expect(state.body).toContain("[^block-100-abcd]: Comment body.");
});

test("rendered sync preserves raw HTML tables from the Markdown source", async () => {
  const body = "<table><td>you</td></table>";
  const rendered = document.createElement("article");
  rendered.innerHTML = await markdownToHtml(body);
  const state: SyncState = { markdown: body, body, frontmatter: "", dirty: false, syncCount: 0 };

  await syncRenderedToMarkdown(rendered, state);

  expect(state.body).toBe(`${body}\n`);
  expect(state.body).not.toContain("| you |");
});

test("rendered sync preserves raw HTML tables containing rendered Markdown", async () => {
  const table = await readFile("test/fixtures/raw-html-markdown-table.md", "utf8");
  let body = `<!-- markleft:block id="btable" -->\n${table}`;

  for (let cycle = 0; cycle < 3; cycle += 1) {
    const rendered = document.createElement("article");
    rendered.innerHTML = await markdownToHtml(stripDocumentBlockIds(body));
    stampBlocks(rendered, documentBlockIds(body));
    const state: SyncState = {
      markdown: body,
      body,
      frontmatter: "",
      dirty: false,
      syncCount: 0,
      includeBlockIds: true,
    };
    await syncRenderedToMarkdown(rendered, state);
    body = state.body ?? "";
  }

  expect(body).toBe(`<!-- markleft:block id="btable" -->\n${table}`);
  expect(body.match(/<!-- markleft:block/g)).toHaveLength(1);
  expect(body).not.toContain("| Markdown");
});

test("repeated rendered saves do not escape or multiply block IDs after fenced footnote examples", async () => {
  let body = [
    '<!-- markleft:block id="btitle" -->',
    "# Title",
    "",
    '<!-- markleft:block id="bexample" -->',
    "```markdown",
    "[^suggestion-s1-update-block-b55]: replacement",
    "```",
    "",
    '<!-- markleft:block id="bparagraph" -->',
    "Paragraph after the example.",
  ].join("\n");

  for (let cycle = 0; cycle < 3; cycle += 1) {
    const rendered = document.createElement("article");
    rendered.innerHTML = await markdownToHtml(stripDocumentBlockIds(body));
    stampBlocks(rendered, documentBlockIds(body));
    const state: SyncState = {
      markdown: body,
      body,
      frontmatter: "",
      dirty: false,
      syncCount: 0,
      includeBlockIds: true,
    };
    await syncRenderedToMarkdown(rendered, state);
    body = state.body ?? "";
  }

  expect(body.match(/<!-- markleft:block/g)).toHaveLength(3);
  expect(body).not.toContain("\\<!-- markleft:block");
  expect(body).toContain('<!-- markleft:block id="bparagraph" -->\nParagraph after the example.');
});
