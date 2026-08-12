import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { suggestedFileNameFromLocation } from "../src/file/save";
import { serializeFile } from "../src/file/serialize";

test("serializes plain Markdown without a loader wrapper", () => {
  expect(serializeFile("# Title")).toBe("# Title");
});

test("preserves edge cases and does not mutate input", () => {
  const markdown = "\uFEFFUnicode cafe\n\n";
  const copy = markdown.slice();
  const serialized = serializeFile(markdown);

  expect(markdown).toBe(copy);
  expect(serialized).toBe("Unicode cafe\n\n");
  expect(serializeFile("")).toBe("");
});

test("does not inject runtime loader, textarea, or local-md note documentation", () => {
  const serialized = serializeFile("# Title");

  expect(serialized).not.toContain("local-md notes:");
  expect(serialized).not.toMatch(/<script\b[^>]*local-md\.js/i);
  expect(serialized).not.toMatch(/<textarea\b/i);
  expect(serialized).not.toMatch(/<\/textarea/i);
});

test("preserves frontmatter in plain Markdown", () => {
  expect(serializeFile("---\ntitle: Saved\n---\n\n# Title")).toBe(`---
title: Saved
---

# Title`);
});

test("allows text that used to be dangerous only for the old textarea wrapper", () => {
  expect(serializeFile("</TEXTAREA><script>bad()</script>")).toBe("</TEXTAREA><script>bad()</script>");
});

test("golden file is byte-for-byte stable", async () => {
  const dir = join(process.cwd(), "test-results", "unit");
  const path = join(dir, "golden.md.html");
  const contents = serializeFile("# Golden\n\nLine\n");
  await mkdir(dir, { recursive: true });
  await writeFile(path, contents, "utf8");

  await expect(readFile(path, "utf8")).resolves.toBe(contents);
});

test("derives a save suggestion from a file URL", () => {
  const location = new URL("file:///Users/martinlysk/Documents/rendered-md/My%20Doc.md.html");

  expect(suggestedFileNameFromLocation(location as unknown as Location)).toBe("My Doc.md.html");
});

test("falls back to the example name for non-file URLs", () => {
  const location = new URL("https://example.com/doc.md.html");

  expect(suggestedFileNameFromLocation(location as unknown as Location)).toBe("example.md.html");
});
