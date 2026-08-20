import type { MarkleftDocumentHost, MarkleftDocumentSnapshot } from "../document-host";

const maxDocumentBytes = 5 * 1024 * 1024;

export class HttpDocumentReadOnlyError extends Error {
  constructor() {
    super("This remote Markdown document is read-only. Save a local project copy to edit it on disk.");
    this.name = "HttpDocumentReadOnlyError";
  }
}

export class HttpDocumentHost implements MarkleftDocumentHost {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities = {
    canWatch: false,
    canResolveAssets: true,
    canInvokeAgent: false,
    canWrite: false,
  };
  readonly source: { kind: "http"; requestedUrl: string; canonicalUrl: string };

  private constructor(
    requestedUrl: string,
    private readonly canonicalUrl: URL,
    private readonly markdown: string,
  ) {
    this.id = `http:${canonicalUrl.href}`;
    this.displayName = fileNameFromUrl(canonicalUrl);
    this.source = { kind: "http", requestedUrl, canonicalUrl: canonicalUrl.href };
  }

  static async open(requestedUrl: string, fetcher: typeof fetch = fetch): Promise<HttpDocumentHost> {
    const requested = normalizeGithubBlobUrl(parseHttpsUrl(requestedUrl));
    let response: Response;
    try {
      response = await fetcher(requested.href, {
        credentials: "omit",
        redirect: "follow",
        headers: { Accept: "text/markdown, text/plain;q=0.9, */*;q=0.1" },
      });
    } catch {
      throw new Error("Markleft could not fetch that remote Markdown file. Check the URL, network access, and CORS policy.");
    }
    if (!response.ok) throw new Error(`The remote Markdown request failed (${response.status} ${response.statusText}).`);
    const canonical = parseHttpsUrl(response.url || requested.href);
    const length = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(length) && length > maxDocumentBytes) {
      throw new Error("The remote Markdown file is larger than Markleft's 5 MB review limit.");
    }
    const markdown = await response.text();
    if (new TextEncoder().encode(markdown).byteLength > maxDocumentBytes) {
      throw new Error("The remote Markdown file is larger than Markleft's 5 MB review limit.");
    }
    return new HttpDocumentHost(requestedUrl, canonical, markdown);
  }

  async read(): Promise<MarkleftDocumentSnapshot> {
    return { markdown: this.markdown, revision: `http:${this.canonicalUrl.href}:${this.markdown.length}` };
  }

  async write(_markdown: string, _options: { expectedRevision?: string } = {}): Promise<MarkleftDocumentSnapshot> {
    throw new HttpDocumentReadOnlyError();
  }

  async resolveAsset(relativePath: string): Promise<string | null> {
    try {
      const resolved = new URL(relativePath, this.canonicalUrl);
      return resolved.protocol === "https:" ? resolved.href : null;
    } catch {
      return null;
    }
  }
}

function normalizeGithubBlobUrl(url: URL): URL {
  const host = url.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") return url;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 5 || segments[2] !== "blob") return url;

  const raw = new URL(url.href);
  raw.hostname = "raw.githubusercontent.com";
  raw.pathname = `/${segments[0]}/${segments[1]}/${segments.slice(3).join("/")}`;
  raw.search = "";
  raw.hash = "";
  return raw;
}

function parseHttpsUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Enter a complete HTTPS URL for the remote Markdown file.");
  }
  if (parsed.protocol !== "https:") throw new Error("Remote Markdown files must use HTTPS.");
  return parsed;
}

function fileNameFromUrl(url: URL): string {
  const last = url.pathname.split("/").filter(Boolean).at(-1);
  try {
    return last ? decodeURIComponent(last) : url.host;
  } catch {
    return last || url.host;
  }
}
