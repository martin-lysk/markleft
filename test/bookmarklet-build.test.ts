import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

function sourceEmbeddedIn(bookmarklet: string): string {
  const match = bookmarklet.match(/atob\(("(?:[^"\\]|\\.)*")\)/);
  if (!match?.[1]) throw new Error("Bookmarklet does not contain an encoded source payload.");

  const encoded = JSON.parse(match[1]) as unknown;
  if (typeof encoded !== "string") throw new Error("Bookmarklet payload is not a string.");

  return Buffer.from(encoded, "base64").toString("utf8");
}

test("publishes the configured bookmark adapter in both bookmark files", async () => {
  await execFile(process.execPath, ["build-bookmarklet.mjs"]);
  const [source, noMarkdownSource, bookmarklet, bookmark] = await Promise.all([
    readFile("bookmark.js", "utf8"),
    readFile("no-markdown.md", "utf8"),
    readFile("bookmarklet.txt", "utf8"),
    readFile("bookmark.txt", "utf8"),
  ]);
  const expectedSource = source.replace(
    /\/\* __MARKLEFT_NO_MARKDOWN_SOURCE__ \*\/ ""/,
    JSON.stringify(noMarkdownSource.replace(/\r\n?/g, "\n")),
  );

  expect(bookmark).toBe(bookmarklet);
  expect(bookmarklet).toMatch(/^javascript:/);
  expect(sourceEmbeddedIn(bookmarklet)).toBe(expectedSource);
});

test("bookmark adapter keeps the portable document bootstrap contract", async () => {
  const source = await readFile("bookmark.js", "utf8");

  expect(source).toContain("body>textarea:first-of-type");
  expect(source).toContain("bootstrap.matches(\"textarea[data-testid='bootstrap-source']\")");
  expect(source).toContain('data-testid="bootstrap-source"');
  expect(source).toContain('data-source-hash="');
  expect(source).toContain("readPreludeFrontmatter");
  expect(source).toContain("no-markdown-guide");
  expect(source).toContain("escapeTextarea");
  expect(source).toContain("loadLocalMd(wrapped.hash, wrapped.length)");
});
