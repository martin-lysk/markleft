import {
  mergeImportedBodyWithPrevious,
  parseMarkleftDocument,
  replaceDocumentBlock,
  serializeMarkleftDocument,
} from "../src/roundtrip/document";
import { appendBlockOperationSuggestion } from "../src/markdown/comments";

function ids(...values: string[]) {
  let index = 0;
  return () => values[index++] ?? `bfallback${index}`;
}

test("parses Markdown into an AST-owned document with source-backed blocks", () => {
  const document = parseMarkleftDocument("# Title\n\nParagraph.", {
    ensureBlockIds: true,
    createBlockId: ids("btitle", "bparagraph"),
  });

  expect(document.ast.type).toBe("root");
  expect(document.blocks.map((block) => ({ id: block.id, kind: block.kind, markdown: block.markdown }))).toEqual([
    { id: "btitle", kind: "heading", markdown: "# Title" },
    { id: "bparagraph", kind: "paragraph", markdown: "Paragraph." },
  ]);
  expect(serializeMarkleftDocument(document)).toBe(
    '<!-- markleft:block id="btitle" -->\n# Title\n\n<!-- markleft:block id="bparagraph" -->\nParagraph.',
  );
});

test("indexes comments and block operation suggestions by id and target block", () => {
  const identified = parseMarkleftDocument("Original paragraph.[^block-100-abcd]", {
    ensureBlockIds: true,
    createBlockId: ids("boriginal"),
  });
  const suggested = appendBlockOperationSuggestion(
    `${serializeMarkleftDocument(identified)}\n\n[^block-100-abcd]: Make this clearer.`,
    "update",
    "boriginal",
    "Clearer paragraph.",
    ["block-100-abcd"],
    1,
  );
  const document = parseMarkleftDocument(suggested.markdown);

  expect(document.annotations.commentsById.get("block-100-abcd")?.bodyMarkdown).toBe("Make this clearer.");
  expect(document.annotations.suggestionsById.get(suggested.id)?.bodyMarkdown).toBe("Clearer paragraph.");
  expect(document.annotations.suggestionsByBlockId.get("boriginal")?.map((item) => item.id)).toEqual([
    suggested.id,
  ]);
});

test("replaces one identified block while preserving untouched source slices and frontmatter", () => {
  const source = [
    "---",
    "slug: ast-roundtrip",
    "---",
    "",
    '<!-- markleft:block id="btitle" -->',
    "# Title",
    "",
    '<!-- markleft:block id="bparagraph" -->',
    "Paragraph with **formatting**.",
    "",
    '<!-- markleft:block id="btable" -->',
    "| A | B |",
    "| --- | --- |",
    "| x | y |",
    "",
    "[^note]: Definition",
  ].join("\n");
  const document = parseMarkleftDocument(source);
  const replaced = replaceDocumentBlock(document, "bparagraph", "Updated paragraph.");

  expect(serializeMarkleftDocument(replaced)).toBe([
    "---",
    "slug: ast-roundtrip",
    "---",
    "",
    '<!-- markleft:block id="btitle" -->',
    "# Title",
    "",
    '<!-- markleft:block id="bparagraph" -->',
    "Updated paragraph.",
    "",
    '<!-- markleft:block id="btable" -->',
    "| A | B |",
    "| --- | --- |",
    "| x | y |",
    "",
    "[^note]: Definition",
  ].join("\n"));
});

test("keeps protected artifacts as document blocks instead of deriving them from rendered DOM", () => {
  const source = [
    "Before.",
    "",
    "<!-- truncate -->",
    "",
    "<table>",
    "<tr><td>",
    "Raw HTML table content.",
    "</td></tr>",
    "</table>",
    "",
    "```mermaid",
    "flowchart TD",
    "  A --> B",
    "```",
  ].join("\n");
  const document = parseMarkleftDocument(source);

  expect(document.blocks.map((block) => block.kind)).toEqual([
    "paragraph",
    "raw-html",
    "code",
  ]);
  expect(parseMarkleftDocument(source, { ensureBlockIds: true, createBlockId: ids("bbefore", "bhtml", "bcode") }).blocks.map((block) => block.id)).toEqual([
    "bbefore",
    "bhtml",
    "bcode",
  ]);
});

test("merges rendered imports by preserving unchanged block source slices", () => {
  const previous = [
    '<!-- markleft:block id="btitle" -->',
    "# Title",
    "",
    '<!-- markleft:block id="btable" -->',
    "| Feature   | Result                           |",
    "| --------- | -------------------------------- |",
    "| Tables    | Supported                        |",
    "",
    '<!-- markleft:block id="bparagraph" -->',
    "Paragraph with **formatting**.",
  ].join("\n");
  const imported = [
    '<!-- markleft:block id="btitle" -->',
    "# Title changed",
    "",
    '<!-- markleft:block id="btable" -->',
    "| Feature | Result |",
    "| - | - |",
    "| Tables | Supported |",
    "",
    '<!-- markleft:block id="bparagraph" -->',
    "Paragraph with **formatting**.",
  ].join("\n");
  const previousWithSourceTrivia = previous.replace(
    "Paragraph with **formatting**.",
    "Paragraph with **formatting**.  ",
  );

  expect(mergeImportedBodyWithPrevious(previousWithSourceTrivia, imported, { includeBlockIds: true })).toBe([
    '<!-- markleft:block id="btitle" -->',
    "# Title changed",
    "",
    '<!-- markleft:block id="btable" -->',
    "| Feature | Result |",
    "| - | - |",
    "| Tables | Supported |",
    "",
    '<!-- markleft:block id="bparagraph" -->',
    "Paragraph with **formatting**.  ",
  ].join("\n"));
});
