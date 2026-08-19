import { describe, expect, it } from "vitest";
import type { PwaDirectoryHandle, PwaFileHandle } from "../src/host/pwa/document-host";
import {
  chooseWidestProjectLocation,
  findDocumentInRoot,
  resolveProjectRelativePath,
} from "../src/host/pwa/project-access";

class FakeFile implements PwaFileHandle {
  readonly kind = "file" as const;

  constructor(readonly name: string) {}

  async isSameEntry(other: unknown): Promise<boolean> {
    return other === this;
  }

  async getFile() {
    return { lastModified: 0, size: 0, text: async () => "" };
  }

  async createWritable() {
    return { write: async () => undefined, close: async () => undefined };
  }
}

class FakeDirectory implements PwaDirectoryHandle {
  readonly kind = "directory" as const;
  private readonly entries = new Map<string, FakeDirectory | FakeFile>();

  constructor(readonly name: string) {}

  add(entry: FakeDirectory | FakeFile): this {
    this.entries.set(entry.name, entry);
    return this;
  }

  async isSameEntry(other: unknown): Promise<boolean> {
    return other === this;
  }

  async getDirectoryHandle(name: string): Promise<PwaDirectoryHandle> {
    const entry = this.entries.get(name);
    if (!(entry instanceof FakeDirectory)) throw new Error("missing directory");
    return entry;
  }

  async getFileHandle(name: string): Promise<PwaFileHandle> {
    const entry = this.entries.get(name);
    if (!(entry instanceof FakeFile)) throw new Error("missing file");
    return entry;
  }

  async *values(): AsyncIterable<FakeDirectory | FakeFile> {
    yield* this.entries.values();
  }
}

describe("PWA project access", () => {
  it("finds the exact Markdown handle rather than trusting a matching filename", async () => {
    const opened = new FakeFile("review.md");
    const other = new FakeFile("review.md");
    const root = new FakeDirectory("repo").add(other).add(
      new FakeDirectory("docs").add(new FakeDirectory("reviews").add(opened)),
    );

    await expect(findDocumentInRoot(root, opened)).resolves.toEqual(["docs", "reviews", "review.md"]);
  });

  it("resolves parent-relative assets inside the verified project root", () => {
    expect(resolveProjectRelativePath(["docs", "reviews", "review.md"], "../images/flow.svg")).toEqual([
      "docs",
      "images",
      "flow.svg",
    ]);
    expect(resolveProjectRelativePath(["docs", "review.md"], "../../outside.svg")).toBeNull();
    expect(resolveProjectRelativePath(["docs", "review.md"], "https://example.com/image.svg")).toBeNull();
  });

  it("prefers the widest verified folder containing the same document", () => {
    const handle = new FakeFile("review.md");
    const directParent = new FakeDirectory("reviews");
    const project = new FakeDirectory("repo");
    const widest = chooseWidestProjectLocation([
      { root: directParent, documentPath: ["review.md"], lastVerifiedAt: 2 },
      { root: project, documentPath: ["docs", "reviews", "review.md"], lastVerifiedAt: 1 },
    ]);

    expect(widest?.root).toBe(project);
    expect(widest?.documentPath).toEqual(["docs", "reviews", "review.md"]);
    expect(handle.name).toBe("review.md");
  });
});
