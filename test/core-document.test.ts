import {
  parseMarkleftDocument,
  replaceDocumentBlock,
  serializeMarkleftDocument,
} from "../src/core";

test("core document API normalizes Markdown while preserving frontmatter", () => {
  const document = parseMarkleftDocument("\uFEFF---\r\ntitle: Core\r\n---\r\n\r\n# Heading\r\n", {
    ensureBlockIds: true,
    createBlockId: () => "bcore001",
  });

  expect(document.frontmatter).toBe("title: Core");
  expect(document.body).toBe('<!-- markleft:block id="bcore001" -->\n# Heading\n');
  expect(serializeMarkleftDocument(document)).toBe(`---
title: Core
---

<!-- markleft:block id="bcore001" -->
# Heading
`);
});

test("core document API replaces an identified block without changing its identity", () => {
  const document = parseMarkleftDocument('<!-- markleft:block id="bintro" -->\n# Before\n');

  const replaced = replaceDocumentBlock(document, "bintro", "# After");

  expect(replaced.body).toBe('<!-- markleft:block id="bintro" -->\n# After\n');
  expect(replaced.blocks).toHaveLength(1);
  expect(replaced.blocks[0]?.id).toBe("bintro");
});
