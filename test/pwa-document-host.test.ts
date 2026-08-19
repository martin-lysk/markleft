import { describe, expect, it } from "vitest";
import {
  normalizeRelativeAssetPath,
  PwaDocumentConflictError,
  PwaDocumentHost,
  revisionFor,
  type PwaDirectoryHandle,
  type PwaFileHandle,
} from "../src/host/pwa/document-host";

function fakeHandle(initial = "# Start\n"): PwaFileHandle & { contents: string; lastModified: number } {
  const handle = {
    name: "notes.md",
    contents: initial,
    lastModified: 100,
    getFile() {
      return Promise.resolve({
        lastModified: handle.lastModified,
        size: handle.contents.length,
        text: () => Promise.resolve(handle.contents),
      });
    },
    queryPermission() {
      return Promise.resolve("granted" as PermissionState);
    },
    createWritable() {
      return Promise.resolve({
        write: (value: string) => {
          handle.contents = value;
          handle.lastModified += 1;
          return Promise.resolve();
        },
        close: () => Promise.resolve(),
      });
    },
  };
  return handle;
}

describe("PwaDocumentHost", () => {
  it("reads and directly saves the selected local file", async () => {
    const handle = fakeHandle();
    const host = new PwaDocumentHost(handle);
    const opened = await host.read();

    expect(opened).toEqual({ markdown: "# Start\n", revision: revisionFor("# Start\n", 100, 8) });
    await host.write("# Saved\n");

    expect(handle.contents).toBe("# Saved\n");
    expect((await host.read()).markdown).toBe("# Saved\n");
  });

  it("refuses to overwrite a disk change made after opening", async () => {
    const handle = fakeHandle();
    const host = new PwaDocumentHost(handle);
    await host.read();
    handle.contents = "# Changed elsewhere\n";
    handle.lastModified += 1;

    await expect(host.write("# My edit\n")).rejects.toBeInstanceOf(PwaDocumentConflictError);
    expect(handle.contents).toBe("# Changed elsewhere\n");
  });

  it("resolves only safe relative assets from an explicitly opened folder", async () => {
    const asset = new Blob(["image"], { type: "image/png" });
    const directory: PwaDirectoryHandle = {
      name: "docs",
      getDirectoryHandle: () => Promise.reject(new Error("unexpected folder")),
      getFileHandle: (name) => {
        if (name !== "diagram.png") return Promise.reject(new Error("missing"));
        return Promise.resolve({
          ...fakeHandle(),
          name,
          getFile: () => Promise.resolve(asset as unknown as { lastModified: number; size: number; text(): Promise<string> }),
        });
      },
    };
    const host = new PwaDocumentHost(fakeHandle(), {
      root: directory,
      documentPath: ["notes.md"],
      lastVerifiedAt: 0,
    });

    expect(normalizeRelativeAssetPath("images/../secret.png")).toBe("secret.png");
    expect(normalizeRelativeAssetPath("https://example.com/image.png")).toBeNull();
    expect(normalizeRelativeAssetPath("./diagram.png")).toBe("diagram.png");
    await expect(host.resolveAsset("diagram.png")).resolves.toMatch(/^blob:/);
  });
});
