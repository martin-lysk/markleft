import {
  activeCommentIdFromSourceRange,
  blockSuggestionsForComment,
  commentChildrenForComment,
  commentHash,
  createBlockComment,
  createBlockSuggestionForSourceRange,
  createBlockSuggestion,
  createChildComment,
  createCodeComment,
  createImageComment,
  createRangeComment,
  createSvgComment,
  editCommentBody,
  markdownForRendering,
  markdownBlockRanges,
  markdownWithoutCommentSyntax,
  parseComments,
  parseBlockSuggestions,
  projectAnchorTextForSourceRange,
  projectHashTextForSourceRange,
  projectedTextForSourceRange,
  projectMarkdownText,
  resolveRenderedTextRange,
  removeComment,
  stripCommentSyntax,
  unescapeCommentReferences,
  updateCommentAnchor,
  appendBlockOperationSuggestion,
  applyBlockOperationSuggestion,
} from "../src/markdown/comments";
import { ensureDocumentBlockIds, identifiedMarkdownBlocks } from "../src/roundtrip/block-ids";
import { markdownToHtml } from "../src/markdown/to-html";

test("parses append-only block operation suggestions and trailing addressed comments", () => {
  const markdown = [
    '<!-- markleft:block id="b55" -->',
    "Original paragraph.[^block-100-abcd]",
    "",
    "[^block-100-abcd]: Make this clearer.",
    "",
    "[^suggestion-s1-update-block-b55]: Updated paragraph.",
    "",
    "    [^block-100-abcd]",
  ].join("\n");

  const [suggestion] = parseBlockSuggestions(markdown);
  expect(suggestion?.operation).toBe("update");
  expect(suggestion?.targetBlockId).toBe("b55");
  expect(suggestion?.bodyMarkdown).toBe("Updated paragraph.");
  expect(suggestion?.relatedCommentIds).toEqual(["block-100-abcd"]);
  expect(suggestion?.missingTarget).toBe(false);
  expect(parseComments(markdown)).toHaveLength(1);
});

test("parses and renders a table operation suggestion with an indented addressed-comment paragraph", async () => {
  const markdown = [
    '<!-- markleft:block id="btable" -->',
    "| Before | Value |",
    "| --- | --- |",
    "| A | B[^block-101-abcd] |",
    "",
    "[^block-101-abcd]: Explain this.",
    "",
    "[^suggestion-s2-update-block-btable]:",
    "    | After | Value |",
    "    | --- | --- |",
    "    | A | Explained |",
    "",
    "    [^block-101-abcd]",
  ].join("\n");

  const [suggestion] = parseBlockSuggestions(markdown);
  expect(suggestion?.bodyMarkdown).toBe("| After | Value |\n| --- | --- |\n| A | Explained |");
  expect(suggestion?.relatedCommentIds).toEqual(["block-101-abcd"]);
  expect(parseComments(markdown)).toHaveLength(1);

  const rendered = await markdownToHtml(suggestion?.bodyMarkdown ?? "");
  expect(rendered).toContain("<table>");
  expect(rendered).toContain("<th>After</th>");
  expect(rendered).not.toContain("block-101-abcd");
});

test("applies update, insert, and delete operations using stable block ids", () => {
  const base = ensureDocumentBlockIds("First.\n\nSecond.", {
    createId: (() => {
      const values = ["bfirst", "bsecond"];
      return () => values.shift() ?? "bfallback";
    })(),
  });
  const updated = appendBlockOperationSuggestion(base, "update", "bfirst", "First updated.", [], 1);
  const afterUpdate = applyBlockOperationSuggestion(updated.markdown, updated.id);
  expect(afterUpdate).toContain('id="bfirst" -->\nFirst updated.');

  const inserted = appendBlockOperationSuggestion(afterUpdate, "insert-before", "bsecond", "Inserted.", [], 2);
  const afterInsert = applyBlockOperationSuggestion(inserted.markdown, inserted.id);
  expect(identifiedMarkdownBlocks(afterInsert).map((block) => block.markdown)).toEqual([
    "First updated.",
    "Inserted.",
    "Second.",
  ]);

  const deleted = appendBlockOperationSuggestion(afterInsert, "delete", "bsecond", "", [], 3);
  const afterDelete = applyBlockOperationSuggestion(deleted.markdown, deleted.id);
  expect(identifiedMarkdownBlocks(afterDelete).map((block) => block.markdown)).toEqual(["First updated.", "Inserted."]);
});

test("accepting a human block operation suggestion preserves unaddressed anchors inside replacement content", () => {
  const base = [
    '<!-- markleft:block id="bparagraph" -->',
    "Neither is a per-chsang[^range-prev-5-chars-27698-49b2]e decision.",
    "",
    "[^range-prev-5-chars-27698-49b2]: typo",
  ].join("\n");
  const suggested = appendBlockOperationSuggestion(
    base,
    "update",
    "bparagraph",
    "Neither is a pers-chsang[^range-prev-5-chars-27698-49b2]e decision.",
    [],
    170037,
  );
  const [suggestion] = parseBlockSuggestions(suggested.markdown);
  const accepted = applyBlockOperationSuggestion(suggested.markdown, suggested.id);

  expect(suggestion?.bodyMarkdown).toBe("Neither is a pers-chsang[^range-prev-5-chars-27698-49b2]e decision.");
  expect(suggestion?.relatedCommentIds).toEqual([]);
  expect(accepted).toContain("Neither is a pers-chsang[^range-prev-5-chars-27698-49b2]e decision.");
  expect(accepted).toContain("[^range-prev-5-chars-27698-49b2]: typo");
  expect(accepted).not.toContain("[^suggestion-s70037-update-block-bparagraph]");
});

test("accepting an addressed block operation suggestion removes only metadata-linked comments", () => {
  const base = [
    '<!-- markleft:block id="bparagraph" -->',
    "Neither is a per-chsang[^range-prev-5-chars-27698-49b2]e decision.",
    "",
    "[^range-prev-5-chars-27698-49b2]: typo",
  ].join("\n");
  const suggested = appendBlockOperationSuggestion(
    base,
    "update",
    "bparagraph",
    "Neither is a pers-chsange decision.",
    ["range-prev-5-chars-27698-49b2"],
    170038,
  );
  const [suggestion] = parseBlockSuggestions(suggested.markdown);
  const accepted = applyBlockOperationSuggestion(suggested.markdown, suggested.id);

  expect(suggestion?.relatedCommentIds).toEqual(["range-prev-5-chars-27698-49b2"]);
  expect(accepted).toContain("Neither is a pers-chsange decision.");
  expect(accepted).not.toContain("range-prev-5-chars-27698-49b2");
  expect(accepted).not.toContain("suggestion-s70038-update-block-bparagraph");
});

test("creates a range comment from a selected source range", () => {
  const markdown = createRangeComment("Selected text here", 0, 13, "About selection", 148217);

  expect(markdown).toContain("Selected text[^range-prev-12-chars-48217-");
  expect(markdown).toContain(": About selection");
  const [comment] = parseComments(markdown);
  expect(comment?.kind).toBe("range");
  expect(comment?.stale).toBe(false);
});

test("range ids count non-whitespace anchor chars while hashes keep normalized visible whitespace", () => {
  const markdown = createRangeComment("hello world", 0, "hello world".length, "Phrase", 148217);
  const [comment] = parseComments(markdown);

  expect(markdown).toContain("hello world[^range-prev-10-chars-48217-");
  expect(comment?.kind).toBe("range");
  if (comment?.kind !== "range") throw new Error("Expected range comment");
  expect(comment.currentHash).toBe(commentHash("hello world"));
});

test("repeated source whitespace does not change anchor length and hashes as normalized rendered whitespace", () => {
  const markdown = createRangeComment("hello  world", 0, "hello  world".length, "Phrase", 148218);
  const [comment] = parseComments(markdown);

  expect(markdown).toContain("hello  world[^range-prev-10-chars-48218-");
  expect(comment?.kind).toBe("range");
  if (comment?.kind !== "range") throw new Error("Expected range comment");
  expect(comment.currentHash).toBe(commentHash("hello world"));
});

test("whitespace-only selections fall back to block comments", () => {
  const markdown = createRangeComment("hello   world", 5, 8, "Space", 148219);
  const [comment] = parseComments(markdown);

  expect(markdown).toContain("hello   [^block-48219-");
  expect(comment?.kind).toBe("block");
});

test("source active comments resolve from caret and selection overlap", () => {
  const markdown = createRangeComment("hello world", 0, "hello world".length, "Phrase", 148220);
  const [comment] = parseComments(markdown);

  expect(activeCommentIdFromSourceRange(markdown, 6, 6)).toBe(comment?.id);
  expect(activeCommentIdFromSourceRange(markdown, 5, 8)).toBe(comment?.id);
  expect(activeCommentIdFromSourceRange(markdown, markdown.length, markdown.length)).toBeNull();
});

test("ignores comment markers inside inline code and fenced code", () => {
  const markdown = [
    "Literal `[^range-prev-4-chars-12345-abcd]` marker.",
    "",
    "```md",
    "Fenced [^block-12345-abcd] marker.",
    "[^range-prev-4-chars-12345-abcd]: not a definition",
    "```",
  ].join("\n");

  expect(parseComments(markdown)).toHaveLength(0);
  expect(stripCommentSyntax(markdown)).toContain("`[^range-prev-4-chars-12345-abcd]`");
  expect(stripCommentSyntax(markdown)).toContain("[^block-12345-abcd] marker");
  expect(stripCommentSyntax(markdown)).toContain("[^range-prev-4-chars-12345-abcd]: not a definition");
});

test("anchors inline-code selections after the closing delimiter and recognizes existing markers", () => {
  const inlineCode = "| Value |\n| --- |\n| `test` |\n";
  const start = inlineCode.indexOf("test");
  const created = createRangeComment(inlineCode, start, start + "test".length, "On code", 29413);

  expect(created).toMatch(/`test`\[\^range-prev-4-chars-29413-[0-9a-f]{4}\]/);
  expect(parseComments(created)[0]).toMatchObject({ kind: "range", stale: false });

  const id = /\[\^([^\]]+)\]/.exec(created)?.[1];
  if (!id) throw new Error("Expected a generated range comment id");
  const legacy = `| Value |\n| --- |\n| \`test[^${id}]\` |\n\n[^${id}]: On code\n`;

  expect(parseComments(legacy)[0]).toMatchObject({ kind: "range", id, stale: false });
});

test("ignores child comments and suggestions inside code in comment bodies", () => {
  const markdown = [
    "Reviewed text[^range-prev-12-chars-12345-abcd].",
    "",
    "[^range-prev-12-chars-12345-abcd]: Parent `[^comment-12346-bbbb]`",
    "    ```md",
    "    [^suggest-block-12347-cccc]",
    "    ```",
    "[^comment-12346-bbbb]: Child body",
    "[^suggest-block-12347-cccc]: Replacement",
  ].join("\n");

  const [comment] = parseComments(markdown);
  expect(comment?.id).toBe("range-prev-12-chars-12345-abcd");
  expect(commentChildrenForComment(markdown, "range-prev-12-chars-12345-abcd")).toHaveLength(0);
  expect(blockSuggestionsForComment(markdown, "range-prev-12-chars-12345-abcd")).toHaveLength(0);
});

test("creates block comments at beginning, middle, and end of a block", () => {
  const beginning = parseComments(createBlockComment("Paragraph text", 0, "Beginning", 1))[0];
  const middle = parseComments(createBlockComment("Paragraph text", 5, "Middle", 1))[0];
  const end = parseComments(createBlockComment("Paragraph text", 14, "End", 1))[0];

  expect(beginning?.kind).toBe("block");
  expect(middle?.kind).toBe("block");
  expect(end?.kind).toBe("block");
  expect(beginning?.stale).toBe(false);
  expect(middle?.stale).toBe(false);
  expect(end?.stale).toBe(false);
});

test("creates standalone block suggestions attached to all comments in the target block", () => {
  const commented = createBlockComment("Original block.\n\nAfter.", 4, "Rewrite this", 148224);
  const [comment] = parseComments(commented);
  if (!comment || comment.kind === "dangling") throw new Error("Expected anchored comment");

  const suggested = createBlockSuggestion(commented, comment.id, "Replacement block.", 148225);
  const suggestions = blockSuggestionsForComment(suggested, comment.id);
  const [standalone] = parseBlockSuggestions(suggested);

  expect(suggestions).toHaveLength(1);
  expect(suggestions[0]?.id).toMatch(/^suggest-block-48225-[0-9a-f]{4}$/);
  expect(suggestions[0]?.bodyMarkdown).toBe("Replacement block.");
  expect(standalone?.blockSourceStart).toBe(0);
  expect(stripCommentSyntax(suggested.slice(standalone?.blockSourceStart ?? 0, standalone?.blockSourceEnd ?? 0))).toBe(
    "Original block.",
  );
  expect(suggested).toMatch(/\[\^block-48224-[0-9a-f]{4}\]: Rewrite this \[\^suggest-block-48225-[0-9a-f]{4}\]/);
  expect(parseComments(suggested)).toHaveLength(1);
});

test("creates standalone block suggestions directly from a source block range", () => {
  const source = "First block.\n\nSecond block.";
  const [first] = markdownBlockRanges(source);
  if (!first) throw new Error("Expected source block");

  const result = createBlockSuggestionForSourceRange(source, first, "Updated first.", 148244);
  const [suggestion] = parseBlockSuggestions(result.markdown);

  expect(result.id).toMatch(/^suggest-block-48244-[0-9a-f]{4}$/);
  expect(result.markdown).toContain("First block.[^suggest-block-48244-");
  expect(suggestion?.bodyMarkdown).toBe("Updated first.");
  expect(suggestion?.relatedCommentIds).toEqual([]);
});

test("treats Markdown lists as one suggestion block", () => {
  const source = "- First item\n- Second item\n- Third item\n\nAfter.";
  const [list, after] = markdownBlockRanges(source);
  if (!list || !after) throw new Error("Expected list and following block");

  const result = createBlockSuggestionForSourceRange(source, list, "- First item changed\n- Second item\n- Third item", 148246);
  const [suggestion] = parseBlockSuggestions(result.markdown);

  expect(list.markdown).toBe("- First item\n- Second item\n- Third item");
  expect(after.markdown).toBe("After.");
  expect(result.markdown).toContain("- Third item[^suggest-block-48246-");
  expect(suggestion?.blockSourceStart).toBe(0);
  expect(stripCommentSyntax(result.markdown.slice(suggestion?.blockSourceStart ?? 0, suggestion?.blockSourceEnd ?? 0))).toBe(
    "- First item\n- Second item\n- Third item",
  );
  expect(suggestion?.bodyMarkdown).toBe("- First item changed\n- Second item\n- Third item");
});

test("creates empty standalone block suggestions for deleted blocks", () => {
  const source = "Keep.\n\nDelete me.\n\nAfter.";
  const blocks = markdownBlockRanges(source);
  const deleted = blocks[1];
  if (!deleted) throw new Error("Expected deleted source block");

  const result = createBlockSuggestionForSourceRange(source, deleted, "", 148245);
  const [suggestion] = parseBlockSuggestions(result.markdown);

  expect(result.markdown).toContain("Delete me.[^suggest-block-48245-");
  expect(suggestion?.bodyMarkdown).toBe("");
});

test("preserves multiline Markdown in block suggestion footnotes", () => {
  const commented = createBlockComment("Original block.\n\nAfter.", 4, "Rewrite this", 148242);
  const [comment] = parseComments(commented);
  if (!comment || comment.kind === "dangling") throw new Error("Expected anchored comment");

  const suggested = createBlockSuggestion(commented, comment.id, "Replacement paragraph.\n\n- with a list", 148243);
  const [suggestion] = parseBlockSuggestions(suggested);

  expect(suggestion?.bodyMarkdown).toBe("Replacement paragraph.\n\n- with a list");
  expect(suggested).toContain("[^suggest-block-48243-");
  expect(suggested).toContain("    - with a list");
});

test("creates ordered child comments and standalone suggestions inside comment footnotes", () => {
  const commented = createBlockComment("Original block.\n\nAfter.", 4, "Parent", 148226);
  const [comment] = parseComments(commented);
  if (!comment || comment.kind === "dangling") throw new Error("Expected anchored comment");

  const withReply = createChildComment(commented, comment.id, "Reply first", 148227);
  const withSuggestion = createBlockSuggestion(withReply, comment.id, "Replacement second", 148228);
  const children = commentChildrenForComment(withSuggestion, comment.id);
  const reparsed = parseComments(withSuggestion);

  expect(children.map((child) => child.kind)).toEqual(["comment", "block-suggestion"]);
  expect(children[0]?.id).toBe("comment-48227");
  expect(children[0]?.bodyMarkdown).toBe("Reply first");
  expect(children[1]?.id).toMatch(/^suggest-block-48228-[0-9a-f]{4}$/);
  expect(reparsed).toHaveLength(1);
  expect(withSuggestion).toMatch(new RegExp(`\\[\\^${comment.id}\\]: Parent \\[\\^suggest-block-48228-[0-9a-f]{4}\\]`));
  expect(withSuggestion).toMatch(new RegExp(`\\[\\^comment-48227\\]: Reply to \\[\\^${comment.id}\\]`));
  expect(withSuggestion).toContain("    Reply first");
});

test("parses append-only child replies without treating reply metadata as document anchors", () => {
  const markdown = [
    "Original block.[^block-100-abcd]",
    "",
    "[^block-100-abcd]: Parent",
    "",
    "[^comment-101]: Reply to [^block-100-abcd]",
    "    ",
    "    Child body",
  ].join("\n");

  const comments = parseComments(markdown);
  const children = commentChildrenForComment(markdown, "block-100-abcd");

  expect(comments.map((comment) => comment.id)).toEqual(["block-100-abcd"]);
  expect(children).toHaveLength(1);
  expect(children[0]?.kind).toBe("comment");
  expect(children[0]?.id).toBe("comment-101");
  expect(children[0]?.bodyMarkdown).toBe("Child body");
});

test("parses legacy child reply ids with suffixes", () => {
  const markdown = [
    "Original block.[^block-100-abcd]",
    "",
    "[^block-100-abcd]: Parent",
    "",
    "[^comment-101-ax01]: Reply to [^block-100-abcd]",
    "    ",
    "    Child body",
  ].join("\n");

  const [child] = commentChildrenForComment(markdown, "block-100-abcd");

  expect(child?.id).toBe("comment-101-ax01");
  expect(child?.bodyMarkdown).toBe("Child body");
});

test("editing append-only child replies preserves the reply relation metadata", () => {
  const markdown = [
    "Original block.[^block-100-abcd]",
    "",
    "[^block-100-abcd]: Parent",
    "",
    "[^comment-101-bbbb]: Reply to [^block-100-abcd]",
    "    ",
    "    Child body",
  ].join("\n");

  const edited = editCommentBody(markdown, "comment-101-bbbb", "Updated child body");
  const [child] = commentChildrenForComment(edited, "block-100-abcd");

  expect(edited).toContain("[^comment-101-bbbb]: Reply to [^block-100-abcd]");
  expect(edited).toContain("    Updated child body");
  expect(child?.bodyMarkdown).toBe("Updated child body");
});

test("block suggestions fan out to range comments in the same block", () => {
  const first = createRangeComment("Hallo world.", 0, 5, "Should be Hello", 148230);
  const second = createRangeComment(first, first.indexOf("world"), first.indexOf("world") + 5, "Should be Mars", 148231);
  const comments = parseComments(second);
  const suggested = createBlockSuggestion(second, comments[0]?.id ?? "", "Hello Mars.", 148232);
  const suggestions = parseBlockSuggestions(suggested);

  expect(suggestions).toHaveLength(1);
  expect(suggestions[0]?.relatedCommentIds.sort()).toEqual(comments.map((comment) => comment.id).sort());
  for (const comment of comments) {
    expect(blockSuggestionsForComment(suggested, comment.id)[0]?.id).toBe(suggestions[0]?.id);
    expect(suggested).toContain(`[^${comment.id}]: ${comment.bodyMarkdown} [^${suggestions[0]?.id}]`);
  }
});

test("block suggestions fan out to block comments in the same block", () => {
  const first = createBlockComment("Paragraph under review.", 0, "First block note", 148239);
  const second = createBlockComment(first, first.indexOf("review"), "Second block note", 148240);
  const comments = parseComments(second);
  const suggested = createBlockSuggestion(second, comments[0]?.id ?? "", "Better paragraph.", 148241);
  const [suggestion] = parseBlockSuggestions(suggested);

  expect(suggestion?.relatedCommentIds.sort()).toEqual(comments.map((comment) => comment.id).sort());
  for (const comment of comments) {
    expect(blockSuggestionsForComment(suggested, comment.id)[0]?.id).toBe(suggestion?.id);
  }
});

test("block suggestions fan out to code comments for the same fenced block", () => {
  const source = ["```ts", "const msg = 'hallo';", "```", "", "After"].join("\n");
  const first = createCodeComment(source, 0, 2, 14, 5, "Typo", 148233);
  const second = createCodeComment(first, 0, 2, 7, 3, "Use let", 148234);
  const comments = parseComments(second);
  const suggested = createBlockSuggestion(second, comments[0]?.id ?? "", "```ts\nconst msg = 'hello';\n```", 148235);
  const [suggestion] = parseBlockSuggestions(suggested);

  expect(suggested).toMatch(/```\n\[\^code-line-2-col-14-len-5-48233-[0-9a-f]{4}\]\n\[\^code-line-2-col-7-len-3-48234-[0-9a-f]{4}\]\n\[\^suggest-block-48235-[0-9a-f]{4}\]/);
  expect(suggestion?.relatedCommentIds.sort()).toEqual(comments.map((comment) => comment.id).sort());
});

test("block suggestions fan out to image comments for the same image block", () => {
  const source = "![Alt text](photo.png)\n\nAfter\n";
  const first = createImageComment(source, 0, 1000, 2000, "First point", 148236);
  const second = createImageComment(first, 0, 3000, 4000, "Second point", 148237);
  const comments = parseComments(second);
  const suggested = createBlockSuggestion(second, comments[0]?.id ?? "", "![Alt text](photo-v2.png)", 148238);
  const [suggestion] = parseBlockSuggestions(suggested);

  expect(suggested).toMatch(/\[\^image-1000-2000-48236-[0-9a-f]{4}\]\n\[\^image-3000-4000-48237-[0-9a-f]{4}\]\n\[\^suggest-block-48238-[0-9a-f]{4}\]/);
  expect(suggestion?.relatedCommentIds.sort()).toEqual(comments.map((comment) => comment.id).sort());
});

test("detached code suggestion markers target the preceding fenced code even with a code comment ref on the same line", () => {
  const markdown = [
    "```markdown",
    "This wording feels vague.[^range-prev-5-chars-48217-a1b2]",
    "```",
    "[^code-line-1-col-1-len-24-71193-7e2b][^suggest-block-84216-c4d7]",
    "",
    "[^code-line-1-col-1-len-24-71193-7e2b]: Use a real textual example. [^suggest-block-84216-c4d7]",
    "[^suggest-block-84216-c4d7]:",
    "    ```markdown",
    "    The launch is soon.[^range-prev-4-chars-48217-a1b2]",
    "    ```",
  ].join("\n");

  const [suggestion] = parseBlockSuggestions(markdown);

  expect(suggestion?.id).toBe("suggest-block-84216-c4d7");
  expect(markdown.slice(suggestion?.blockSourceStart ?? -1, suggestion?.blockSourceEnd ?? -1)).toBe(
    "```markdown\nThis wording feels vague.[^range-prev-5-chars-48217-a1b2]\n```",
  );
});

test("suggestions referenced only from an image comment still target the related image block", () => {
  const markdown = [
    "![Markleft review process](./markleft-review-process.svg)[^image-4806-7805-31454-ebc4]",
    "",
    "[^image-4806-7805-31454-ebc4]: this rendering is broken [^suggest-block-84217-e9f2]",
    "[^suggest-block-84217-e9f2]: ![Markleft review process](./markleft-review-process-fixed.svg)",
  ].join("\n");

  const [suggestion] = parseBlockSuggestions(markdown);

  expect(suggestion?.id).toBe("suggest-block-84217-e9f2");
  expect(suggestion?.relatedCommentIds).toEqual(["image-4806-7805-31454-ebc4"]);
  expect(markdown.slice(suggestion?.blockSourceStart ?? -1, suggestion?.blockSourceEnd ?? -1)).toBe(
    "![Markleft review process](./markleft-review-process.svg)",
  );
});

test("associates an image marker immediately following its image on the same line", () => {
  const image = "![Review loop](./docs/landing-review-loop-v3.svg)";
  const markdown = [
    `${image}[^image-4949-3754-67993-d717]`,
    "",
    "[^image-4949-3754-67993-d717]: Can we use the real logos here?",
  ].join("\n");

  const [comment] = parseComments(markdown);

  expect(comment).toMatchObject({ kind: "image", x: 4949, y: 3754 });
  if (comment?.kind !== "image") throw new Error("Expected image comment");
  expect(comment.imageSourceStart).toBe(0);
  expect(comment.imageMarkdown).toBe(image);
});

test("creates image comments under Markdown image anchors", () => {
  const source = "Before\n\n![Alt text](photo.png)\n\nAfter\n";
  const imageStart = source.indexOf("![Alt text]");
  const markdown = createImageComment(source, imageStart, 2500, 7500, "Image point", 148221);
  const [comment] = parseComments(markdown);

  expect(markdown).toMatch(/!\[Alt text\]\(photo\.png\)\n\[\^image-2500-7500-48221-[0-9a-f]{4}\]\n\nAfter/);
  expect(comment?.kind).toBe("image");
  if (comment?.kind !== "image") throw new Error("Expected image comment");
  expect(comment.target).toBe("bitmap");
  expect(comment.x).toBe(2500);
  expect(comment.y).toBe(7500);
  expect(comment.stale).toBe(false);
});

test("creates multiple image comments under the same image anchor", () => {
  const source = "![Alt text](photo.png)\n\nAfter\n";
  const first = createImageComment(source, 0, 1000, 2000, "First", 1);
  const second = createImageComment(first, 0, 3000, 4000, "Second", 2);

  expect(second).toMatch(/!\[Alt text\]\(photo\.png\)\n\[\^image-1000-2000-1-[0-9a-f]{4}\]\n\[\^image-3000-4000-2-[0-9a-f]{4}\]\n\nAfter/);
  expect(parseComments(second).filter((comment) => comment.kind === "image")).toHaveLength(2);
});

test("creates svg comments with a DOM path anchor", () => {
  const source = '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>\n';
  const markdown = createSvgComment(source, 0, "svg.1-rect.1", 5000, 5000, "SVG point", 148222);
  const [comment] = parseComments(markdown);

  expect(markdown).toMatch(/<svg[\s\S]*<\/svg>\n\[\^svg-xpath_svg\.1-rect\.1_48222-[0-9a-f]{4}\]/);
  expect(comment?.kind).toBe("image");
  if (comment?.kind !== "image") throw new Error("Expected image comment");
  expect(comment.target).toBe("svg");
  expect(comment.svgPath).toBe("svg.1-rect.1");
});

test("creates code comments after fenced code blocks", () => {
  const source = ["```ts", "const value = 1;", "console.log(value);", "```", "", "After"].join("\n");
  const markdown = createCodeComment(source, 0, 2, 9, "log".length, "Code note", 148223);
  const [comment] = parseComments(markdown);

  expect(markdown).toMatch(/```\n\[\^code-line-2-col-9-len-3-48223-[0-9a-f]{4}\]\n\nAfter/);
  expect(comment?.kind).toBe("code");
  if (comment?.kind !== "code") throw new Error("Expected code comment");
  expect(comment.line).toBe(2);
  expect(comment.col).toBe(9);
  expect(comment.length).toBe(3);
  expect(comment.stale).toBe(false);
  expect(source.slice(comment.rangeSourceStart, comment.rangeSourceEnd)).toBe("log");
});

test("footnote markers are excluded from logical hashes", () => {
  const withOrdinaryFootnote = "Text[^source] with a comment[^block-12345-a1b2].";
  expect(stripCommentSyntax(withOrdinaryFootnote)).toBe("Text[^source] with a comment.");
  expect(commentHash("Text[^source].")).toBe(commentHash("Text."));
});

test("adding a second comment does not invalidate the first comment hash", () => {
  const first = createBlockComment("Paragraph text", 3, "First", 10);
  const second = createBlockComment(first, first.indexOf("text") + 2, "Second", 11);

  const comments = parseComments(second);
  expect(comments).toHaveLength(2);
  expect(comments.every((comment) => !comment.stale)).toBe(true);
});

test("adding a marker inside an existing range does not change the logical range", () => {
  const range = createRangeComment("abcdef", 1, 5, "Range", 20);
  const nested = createBlockComment(range, 3, "Nested", 21);
  const [rangeComment] = parseComments(nested).filter((comment) => comment.kind === "range");

  expect(rangeComment?.kind).toBe("range");
  expect(rangeComment?.stale).toBe(false);
});

test("edited content makes comments stale without changing the marker", () => {
  const markdown = createRangeComment("hello world", 0, 5, "Greeting", 30);
  const changed = markdown.replace("hello", "hullo");
  const [comment] = parseComments(changed);

  expect(comment?.stale).toBe(true);
  expect(changed).toContain(comment?.id ?? "missing");
});

test("editing a comment body does not change its identifier", () => {
  const markdown = createBlockComment("Paragraph", 4, "Old", 40);
  const [comment] = parseComments(markdown);
  const edited = editCommentBody(markdown, comment?.id ?? "", "New body");

  expect(edited).toContain(`[^${comment?.id}]: New body`);
  expect(parseComments(edited)[0]?.id).toBe(comment?.id);
});

test("removing a comment removes marker and definition", () => {
  const markdown = createBlockComment("Paragraph", 4, "Remove me", 50);
  const [comment] = parseComments(markdown);
  const removed = removeComment(markdown, comment?.id ?? "");

  expect(parseComments(removed)).toHaveLength(0);
  expect(removed).not.toContain("blockcomment");
});

test("updating a stale anchor recalculates the hash explicitly", () => {
  const markdown = createBlockComment("Paragraph", 4, "Body", 60).replace("graph", "gruph");
  const [stale] = parseComments(markdown);
  expect(stale?.stale).toBe(true);

  const updated = updateCommentAnchor(markdown, stale?.id ?? "");
  const [current] = parseComments(updated);
  expect(current?.stale).toBe(false);
});

test("multiple and overlapping range comments keep Markdown footnotes for rendering", () => {
  const first = createRangeComment("abcdef", 0, 4, "First", 70);
  const second = createRangeComment(first, 1, first.indexOf("\n\n"), "Second", 71);
  const rendered = markdownForRendering(second);

  expect(parseComments(second)).toHaveLength(2);
  expect(rendered).toContain("[^range-prev-4-chars-70-");
});

test("range hashes use logical rendered characters, not Markdown delimiters", () => {
  const markdown = createRangeComment("**test**", 0, 8, "Bold", 82);
  const [comment] = parseComments(markdown);

  expect(markdown).toContain("[^range-prev-4-chars-82-");
  expect(comment?.kind).toBe("range");
  if (comment?.kind !== "range") throw new Error("Expected range comment");
  expect(commentHash("test")).toBe(comment?.currentHash);
  expect(comment?.stale).toBe(false);
});

test("range bounds keep fixed logical length after text is inserted inside the referenced area", () => {
  const markdown = createRangeComment("abcdefghij klm", 0, 10, "Ten chars", 83);
  const changed = markdown.replace("abc", "abcZZZ");
  const [comment] = parseComments(changed);

  expect(comment?.kind).toBe("range");
  if (comment?.kind !== "range") throw new Error("Expected range comment");
  expect(comment.logicalLength).toBe(10);
  expect(projectedTextForSourceRange(changed, comment.rangeSourceStart, comment.rangeSourceEnd)).toBe("ZZZdefghij");
  expect(comment.stale).toBe(true);
});

test("editing visible whitespace inside an anchored range marks it stale without losing anchor resolution", () => {
  const markdown = createRangeComment("hello world", 0, "hello world".length, "Phrase", 84);
  const changed = markdown.replace("hello world", "helloworld");
  const [comment] = parseComments(changed);

  expect(comment?.kind).toBe("range");
  if (comment?.kind !== "range") throw new Error("Expected range comment");
  expect(comment.logicalLength).toBe(10);
  expect(projectAnchorTextForSourceRange(changed, comment.rangeSourceStart, comment.rangeSourceEnd)).toBe("helloworld");
  expect(projectHashTextForSourceRange(changed, comment.rangeSourceStart, comment.rangeSourceEnd)).toBe("helloworld");
  expect(comment.stale).toBe(true);
});

test("rendered text range resolution respects repeated occurrences", () => {
  const markdown = "# Markdown\n\nThis Markdown word is the selected one.";
  const secondMarkdown = resolveRenderedTextRange(markdown, "Markdown", 1);

  expect(markdown.slice(secondMarkdown?.start, secondMarkdown?.end)).toBe("Markdown");
  expect(secondMarkdown?.start).toBe(markdown.lastIndexOf("Markdown"));
});

test("rendered text range resolution crosses inline markup boundaries", () => {
  const markdown = "This **start of** the range keeps going.";
  const range = resolveRenderedTextRange(markdown, "start of the range", 0);

  expect(range).not.toBeNull();
  expect(markdown.slice(range?.start, range?.end)).toBe("start of** the range");
  expect(projectedTextForSourceRange(markdown, range?.start ?? 0, range?.end ?? 0)).toBe("start of the range");
});

test("rendered text range resolution tolerates soft-line-break whitespace around inline code and pipes", () => {
  const markdown =
    "The prefix, which handles `long` rules (`|w| > 2`) natively with no PDS\nnormalization. After.";
  const fullSelection = "which handles long rules (|w| > 2) natively with no PDS\nnormalization.";
  const partialSelection = "which handles long rules (|w| > 2) natively with no PDS\nnorma";

  const fullRange = resolveRenderedTextRange(markdown, fullSelection, 0);
  const partialRange = resolveRenderedTextRange(markdown, partialSelection, 0);

  expect(fullRange).not.toBeNull();
  expect(partialRange).not.toBeNull();
  expect(projectAnchorTextForSourceRange(markdown, fullRange?.start ?? 0, fullRange?.end ?? 0)).toBe(
    "whichhandleslongrules|w|>2nativelywithnoPDSnormalization.",
  );
  expect(projectAnchorTextForSourceRange(markdown, partialRange?.start ?? 0, partialRange?.end ?? 0)).toBe(
    "whichhandleslongrules|w|>2nativelywithnoPDSnorma",
  );
});

test("rendered text range resolution skips hidden inline-link destinations after bold text", () => {
  const markdown =
    "- **Aliasing is derived, not supplied** ([`perobject`](src/perobject.rs)). Aliasing is a *product*.";
  const selectedText = "not supplied (perobject). Aliasing i";
  const range = resolveRenderedTextRange(markdown, selectedText, 0);

  expect(projectMarkdownText(markdown).text).toBe(
    " Aliasing is derived, not supplied perobject. Aliasing is a product.",
  );
  expect(range).not.toBeNull();
  expect(markdown.slice(range?.start, range?.end)).toBe(
    "not supplied** ([`perobject`](src/perobject.rs)). Aliasing i",
  );
  expect(projectAnchorTextForSourceRange(markdown, range?.start ?? 0, range?.end ?? 0)).toBe(
    "notsuppliedperobject.Aliasingi",
  );
});

test("rendered text range resolution crosses GFM table cell boundaries", () => {
  const markdown = "| Feature | Result |\n| --- | --- |\n| Tables | Supported |\n";
  const projected = projectMarkdownText(markdown);
  const range = resolveRenderedTextRange(markdown, "lesSup", 0);

  expect(projected.text).toBe("FeatureResultTablesSupported");
  expect(range).not.toBeNull();
  expect(markdown.slice(range?.start, range?.end)).toBe("les | Sup");
  expect(projectedTextForSourceRange(markdown, range?.start ?? 0, range?.end ?? 0)).toBe("lesSup");
});

test("rendered text range resolution crosses blockquote paragraph boundaries", () => {
  const markdown = "> Switch modes, edit this document, and save it back into the same portable format.\n>\n> adasd\n";
  const range = resolveRenderedTextRange(markdown, "ormat.adasd", 0);

  expect(projectMarkdownText(markdown).text).toBe(
    "Switch modes, edit this document, and save it back into the same portable format.adasd",
  );
  expect(range).not.toBeNull();
  expect(projectedTextForSourceRange(markdown, range?.start ?? 0, range?.end ?? 0)).toBe("ormat.adasd");
});

test("range comments across blockquote paragraphs stay ranges", () => {
  const markdown = "> Switch modes, edit this document, and save it back into the same portable format.\n>\n> adasd\n";
  const range = resolveRenderedTextRange(markdown, "ormat.adasd", 0);
  if (!range) throw new Error("Expected blockquote range");
  const commented = createRangeComment(markdown, range.start, range.end, "Across quote", 86);

  expect(commented).toContain("> adasd[^range-prev-11-chars-86-");
  expect(parseComments(commented)[0]?.kind).toBe("range");
});

test("range comments across GFM table cells use logical table characters", () => {
  const markdown = "| Feature | Result |\n| --- | --- |\n| Tables | Supported |\n";
  const range = resolveRenderedTextRange(markdown, "lesSup", 0);
  if (!range) throw new Error("Expected table range");
  const commented = createRangeComment(markdown, range.start, range.end, "Across cells", 85);

  expect(commented).toContain("Sup[^range-prev-6-chars-85-");
  expect(parseComments(commented)[0]?.stale).toBe(false);
});

test("clean rendering source keeps Markdown content but removes local comment syntax", () => {
  const markdown = createRangeComment("This **start of** the range", 5, 27, "Comment", 90);
  const renderedSource = markdownWithoutCommentSyntax(markdown);

  expect(renderedSource).toContain("This **start of** the range");
  expect(renderedSource).not.toContain("rangecomment");
});

test("unicode and line ending normalization are stable", () => {
  expect(commentHash("emoji 😀\r\n")).toBe(commentHash("emoji 😀\n"));
  expect(createRangeComment("a😀b", 1, 3, "Emoji", 80)).toContain("range-prev-2-chars-80-");
});

test("missing definitions and malformed identifiers are handled", () => {
  expect(parseComments("Text[^blockcomment-12345-a1b2]")[0]?.missingDefinition).toBe(true);
  expect(parseComments("Text[^blockcomment-oops]")).toHaveLength(0);
});

test("orphaned comment definitions produce dangling comments", () => {
  const [comment] = parseComments("[^block-12345-a1b2]: Orphan");

  expect(comment?.kind).toBe("dangling");
  expect(comment?.bodyMarkdown).toBe("Orphan");
});

test("unescapes local note references after Markdown stringification", () => {
  expect(unescapeCommentReferences("\\[^range-prev-7-chars-31717-113d]d**ddl**")).toBe(
    "[^range-prev-7-chars-31717-113d]d**ddl**",
  );
  expect(unescapeCommentReferences("\\[^ordinary-note]")).toBe("\\[^ordinary-note]");
});
