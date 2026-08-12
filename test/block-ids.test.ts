import {
  blockById,
  documentHasBlockIds,
  ensureDocumentBlockIds,
  identifiedMarkdownBlocks,
  stripDocumentBlockIds,
} from "../src/roundtrip/block-ids";

function ids(...values: string[]) {
  let index = 0;
  return () => values[index++] ?? `bfallback${index}`;
}

test("adds stable ids to real document blocks but not footnote bodies", () => {
  const markdown =
    "# Title\n\nParagraph.\n\n[^c1042]: Comment paragraph.\n\n    More comment text.";
  const identified = ensureDocumentBlockIds(markdown, { createId: ids("btitle", "bparagraph") });

  expect(identified).toContain('<!-- markleft:block id="btitle" -->\n# Title');
  expect(identified).toContain('<!-- markleft:block id="bparagraph" -->\nParagraph.');
  expect(identified).not.toContain('id="bfallback');
  expect(identifiedMarkdownBlocks(identified).map((block) => block.id)).toEqual([
    "btitle",
    "bparagraph",
  ]);
});

test("keeps existing ids and only fills missing ids", () => {
  const markdown = '<!-- markleft:block id="btitle" -->\n# Title\n\nParagraph.';
  const identified = ensureDocumentBlockIds(markdown, { createId: ids("bparagraph") });

  expect(identified.match(/id="btitle"/g)).toHaveLength(1);
  expect(identified).toContain('id="bparagraph"');
  expect(blockById(identified, "btitle")?.markdown).toBe("# Title");
});

test("removes only Markleft block id comments", () => {
  const markdown = [
    '<!-- markleft:block id="btitle" -->',
    "# Title",
    "",
    "<!-- truncate -->",
    "",
    '<!-- markleft:block id="bparagraph" -->',
    "Paragraph.",
  ].join("\n");

  expect(stripDocumentBlockIds(markdown)).toBe("# Title\n\n<!-- truncate -->\n\nParagraph.");
  expect(documentHasBlockIds(markdown)).toBe(true);
  expect(documentHasBlockIds(stripDocumentBlockIds(markdown))).toBe(false);
});

test("ignores footnote-looking examples inside fenced code when locating document footnotes", () => {
  const markdown = [
    "# Title",
    "",
    "```markdown",
    "[^suggestion-s1-update-block-b55]: replacement",
    "```",
    "",
    "Paragraph after the example.",
    "",
    "[^ordinary]: Actual footnote.",
  ].join("\n");

  const identified = ensureDocumentBlockIds(markdown, {
    createId: ids("btitle", "bexample", "bparagraph"),
  });

  expect(identified).toContain(
    '<!-- markleft:block id="bparagraph" -->\nParagraph after the example.',
  );
  expect(identified.slice(identified.indexOf("[^ordinary]:"))).not.toContain("markleft:block");
  expect(stripDocumentBlockIds(identified)).toBe(markdown);
});

test("removes escaped block ID pile-ups created by older save cycles", () => {
  const markdown = [
    '<!-- markleft:block id="borphan" -->',
    '\\<!-- markleft:block id="bold1" --> \\<!-- markleft:block id="bold2" -->',
    '<!-- markleft:block id="bparagraph" -->',
    "Paragraph.",
  ].join("\n");

  const identified = ensureDocumentBlockIds(markdown);

  expect(identified).toBe('<!-- markleft:block id="bparagraph" -->\nParagraph.');
  expect(stripDocumentBlockIds(markdown)).toBe("Paragraph.");
});
