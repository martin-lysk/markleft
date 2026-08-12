import {
  isFencedCodeBlock,
  isMarkdownListBlock,
  isMarkdownTableBlock,
  lineRangeAt,
  markdownBlockAt,
  markdownBlockEndingAt,
  markdownBlockRanges,
} from "../src/roundtrip/blocks";

test("parses paragraphs and headings as source blocks", () => {
  const markdown = "# Title\n\nFirst paragraph.\n\nSecond paragraph.";
  const blocks = markdownBlockRanges(markdown);

  expect(blocks.map((block) => block.kind)).toEqual(["heading", "paragraph", "paragraph"]);
  expect(blocks.map((block) => block.markdown)).toEqual([
    "# Title",
    "First paragraph.",
    "Second paragraph.",
  ]);
});

test("keeps a whole list as one block, including indented continuations", () => {
  const markdown = "- One\n  continued\n\n  still one\n- Two\n\nAfter";
  const blocks = markdownBlockRanges(markdown);

  expect(blocks).toHaveLength(2);
  expect(blocks[0]?.kind).toBe("list");
  expect(blocks[0]?.markdown).toBe("- One\n  continued\n\n  still one\n- Two");
  expect(blocks[1]?.markdown).toBe("After");
  expect(isMarkdownListBlock(blocks[0]?.markdown ?? "")).toBe(true);
});

test("keeps a whole table as one block", () => {
  const markdown = "| A | B |\n| --- | --- |\n| x | y |\n\nAfter";
  const blocks = markdownBlockRanges(markdown);

  expect(blocks).toHaveLength(2);
  expect(blocks[0]?.kind).toBe("table");
  expect(blocks[0]?.markdown).toBe("| A | B |\n| --- | --- |\n| x | y |");
  expect(isMarkdownTableBlock(blocks[0]?.markdown ?? "")).toBe(true);
});

test("keeps a raw HTML table with Markdown content as one source block", () => {
  const table = [
    "<table>",
    "<tr><td>",
    "",
    "```",
    "### Markdown inside the cell",
    "```",
    "",
    "</td></tr>",
    "</table>",
  ].join("\n");
  const blocks = markdownBlockRanges(`${table}\n\nAfter`);

  expect(blocks.map((block) => block.kind)).toEqual(["raw-html", "paragraph"]);
  expect(blocks[0]?.markdown).toBe(table);
});

test("keeps a whole blockquote as one block", () => {
  const markdown = "> First paragraph\n>\n> Second paragraph\n\nAfter";
  const blocks = markdownBlockRanges(markdown);

  expect(blocks.map((block) => block.kind)).toEqual(["blockquote", "paragraph"]);
  expect(blocks[0]?.markdown).toBe("> First paragraph\n>\n> Second paragraph");
});

test("keeps fenced code as one block even when it contains blank lines and markers", () => {
  const markdown = [
    "```md",
    "before",
    "",
    "[^range-prev-4-chars-12345-a1b2]",
    "after",
    "```",
    "",
    "Next",
  ].join("\n");
  const blocks = markdownBlockRanges(markdown);

  expect(blocks.map((block) => block.kind)).toEqual(["code", "paragraph"]);
  expect(blocks[0]?.markdown).toContain("[^range-prev-4-chars-12345-a1b2]");
  expect(isFencedCodeBlock(blocks[0]?.markdown ?? "")).toBe(true);
});

test("skips HTML comment blocks by default but can include them as protected blocks", () => {
  const markdown = "Before.\n\n<!-- truncate -->\n\nAfter.";

  expect(markdownBlockRanges(markdown).map((block) => block.markdown)).toEqual([
    "Before.",
    "After.",
  ]);
  expect(
    markdownBlockRanges(markdown, { includeHtmlComments: true }).map((block) => block.kind),
  ).toEqual(["paragraph", "html-comment", "paragraph"]);
});

test("skips multiline HTML comment blocks without attaching following text", () => {
  const markdown = "Before.\n\n<!--\ntruncate\n-->\n\nAfter.";
  const blocks = markdownBlockRanges(markdown, { includeHtmlComments: true });

  expect(blocks.map((block) => block.kind)).toEqual(["paragraph", "html-comment", "paragraph"]);
  expect(blocks[1]?.markdown).toBe("<!--\ntruncate\n-->");
  expect(blocks[2]?.markdown).toBe("After.");
});

test("keeps a heading separate from a following standalone HTML comment", () => {
  const markdown = [
    '## <!-- markleft:block id="bheading" -->',
    '<!-- markleft:block id="bnext" -->',
    "## Next heading",
  ].join("\n");

  expect(markdownBlockRanges(markdown).map((block) => block.markdown)).toEqual([
    '## <!-- markleft:block id="bheading" -->',
    "## Next heading",
  ]);
});

test("stops body blocks before footnote definitions", () => {
  const markdown = "Body.[^note]\n\n[^note]: Footnote body\n\nNot body";
  const blocks = markdownBlockRanges(markdown);

  expect(blocks).toHaveLength(1);
  expect(blocks[0]?.markdown).toBe("Body.[^note]");
});

test("finds blocks by source position and ending position", () => {
  const markdown = "One.\n\n- Two\n- Three\n\nFour.";
  const list = markdownBlockAt(markdown, markdown.indexOf("Three"));
  const sameList = markdownBlockEndingAt(markdown, list?.end ?? -1);

  expect(list?.kind).toBe("list");
  expect(sameList?.markdown).toBe("- Two\n- Three");
});

test("line ranges normalize out-of-range positions", () => {
  const markdown = "One\nTwo";

  expect(lineRangeAt(markdown, -10)).toEqual({ start: 0, end: 3, next: 4 });
  expect(lineRangeAt(markdown, 999)).toEqual({ start: 4, end: 7, next: 7 });
});
