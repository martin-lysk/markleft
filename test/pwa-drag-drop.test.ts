import { describe, expect, it } from "vitest";
import { firstDroppedMarkdownHandle, isMarkdownFileName } from "../src/host/pwa/drag-drop";

describe("PWA Markdown drag and drop", () => {
  it("recognizes Markleft's supported Markdown extensions", () => {
    expect(isMarkdownFileName("notes.md")).toBe(true);
    expect(isMarkdownFileName("notes.MDX")).toBe(true);
    expect(isMarkdownFileName("notes.txt")).toBe(false);
  });

  it("keeps the dropped FileSystemFileHandle for direct saving", async () => {
    const handle = { kind: "file" as const, name: "review.md" };
    const found = await firstDroppedMarkdownHandle([
      { kind: "string" },
      { kind: "file", getAsFileSystemHandle: () => Promise.resolve(handle) },
    ]);

    expect(found).toBe(handle);
  });

  it("does not treat directories or non-Markdown files as documents", async () => {
    await expect(
      firstDroppedMarkdownHandle([
        { kind: "file", getAsFileSystemHandle: () => Promise.resolve({ kind: "directory" as const, name: "docs" }) },
        { kind: "file", getAsFileSystemHandle: () => Promise.resolve({ kind: "file" as const, name: "notes.txt" }) },
      ]),
    ).resolves.toBeNull();
  });
});
