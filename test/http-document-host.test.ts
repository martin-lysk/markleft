import { describe, expect, it } from "vitest";
import { HttpDocumentHost, HttpDocumentReadOnlyError } from "../src/host/http/document-host";

describe("HttpDocumentHost", () => {
  it("uses the final redirected HTTPS URL as the base for relative assets", async () => {
    const host = await HttpDocumentHost.open(
      "https://raw.github.com/example/project/main/review.md",
      async () => {
        const response = new Response("# Review\n", {
          status: 200,
          headers: { "content-type": "text/markdown" },
        });
        Object.defineProperty(response, "url", {
          value: "https://raw.githubusercontent.com/example/project/main/docs/review.md",
        });
        return response;
      },
    );

    expect(host.source.canonicalUrl).toBe("https://raw.githubusercontent.com/example/project/main/docs/review.md");
    await expect(host.resolveAsset("../images/flow.svg")).resolves.toBe(
      "https://raw.githubusercontent.com/example/project/main/images/flow.svg",
    );
    await expect(host.write("# Changed\n")).rejects.toBeInstanceOf(HttpDocumentReadOnlyError);
  });

  it("rejects non-HTTPS and failed remote requests", async () => {
    await expect(HttpDocumentHost.open("http://example.com/review.md")).rejects.toThrow("HTTPS");
    await expect(
      HttpDocumentHost.open("https://example.com/review.md", async () => new Response("no", { status: 404 })),
    ).rejects.toThrow("404");
  });
});
