// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { resolveDocumentAssets, restoreAuthoredBlobImageSources } from "../src/host/document-assets";
import type { MarkleftDocumentHost } from "../src/host/document-host";

function host(resolveAsset: (path: string) => Promise<string | null>): MarkleftDocumentHost {
  return {
    id: "test",
    displayName: "test.md",
    capabilities: { canWatch: false, canResolveAssets: true, canInvokeAgent: false },
    read: async () => ({ markdown: "" }),
    write: async () => ({ markdown: "" }),
    resolveAsset,
  };
}

describe("document assets", () => {
  it("never lets an image-comparison blob URL replace the authored image URL", () => {
    const restored = restoreAuthoredBlobImageSources(
      "![Review loop](./docs/landing-review-loop-v4.svg)",
      "![Review loop](blob:http://localhost:4174/65017949-b123-4249-a506-d4d88419ea49)",
    );

    expect(restored).toBe("![Review loop](./docs/landing-review-loop-v4.svg)");
  });

  it("keeps Markdown-relative sources out of the document model while using a resolved display URL", async () => {
    const root = document.createElement("article");
    root.innerHTML = '<img src="./images/flow.svg" alt="Flow">';

    const result = await resolveDocumentAssets(root, host(async () => "blob:markleft-flow"));

    expect(result.unresolvedRelativeSources).toEqual([]);
    expect(root.querySelector("img")?.src).toBe("blob:markleft-flow");
    expect(root.querySelector("img")?.dataset.markleftMarkdownSource).toBe("./images/flow.svg");
  });

  it("replaces an inaccessible PWA-local image with an actionable visual placeholder", async () => {
    const root = document.createElement("article");
    root.innerHTML = '<img src="../images/flow.svg" alt="Architecture flow">';

    const result = await resolveDocumentAssets(root, host(async () => null), {
      showUnavailablePlaceholders: true,
    });
    const image = root.querySelector("img");

    expect(result.unresolvedRelativeSources).toEqual(["../images/flow.svg"]);
    expect(image?.dataset.markleftAssetPlaceholder).toBe("true");
    expect(image?.dataset.markleftAssetSource).toBe("../images/flow.svg");
    expect(image?.getAttribute("src")).toMatch(/^data:image\/svg\+xml,/);
  });

  it("does not ask a local host to resolve already-absolute remote images", async () => {
    const root = document.createElement("article");
    root.innerHTML = '<img src="https://example.com/flow.svg">';
    const resolveAsset = vi.fn(async () => null);

    await resolveDocumentAssets(root, host(resolveAsset), { showUnavailablePlaceholders: true });

    expect(resolveAsset).not.toHaveBeenCalled();
    expect(root.querySelector("img")?.getAttribute("src")).toBe("https://example.com/flow.svg");
  });
});
